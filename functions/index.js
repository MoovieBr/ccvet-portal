/* Cloud Functions do Portal CCVET
 *
 * A organização do projeto bloqueia endpoints públicos (allUsers), então as
 * operações privilegiadas NÃO usam funções chamáveis: o painel cria um doc em
 * `tarefas/{id}` e o trigger `processaTarefa` executa e grava o resultado no
 * mesmo doc. As regras do Firestore garantem que só admin/staff criam tarefas
 * em nome próprio; a autorização fina é revalidada aqui, no servidor.
 *
 * Tipos de tarefa:
 * - createAluno / toggleAlunoAtivo / deleteAluno  → admin ou staff com perm "alunos"
 * - createStaff / toggleStaffAtivo / deleteStaff  → somente admin
 *
 * - onUserCreateBootstrapAdmin (trigger de Auth) promove o primeiro admin
 *   (bootstrap único) e semeia o conteúdo inicial do curso.
 */
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();

// E-mail autorizado a virar o primeiro admin ao criar a própria conta.
// O bootstrap só funciona enquanto a coleção `staff` estiver vazia.
const BOOTSTRAP_ADMIN_EMAIL = "roger@mooviebrasil.com";

const REGION = "southamerica-east1";
const PORTAL_URL = "https://ccvetitajai.com/portal";

const PERMISSOES = ["modulos", "avisos", "cronograma", "links", "alunos", "financeiro", "turmas", "presenca"];

class TarefaErro extends Error {}

function normalizaPerms(perms) {
  const out = {};
  PERMISSOES.forEach((p) => { out[p] = !!(perms && perms[p]); });
  return out;
}

// Papel + permissões reais do autor, direto do Auth (claims) e do doc staff.
async function carregarAutor(uid) {
  const user = await admin.auth().getUser(uid);
  const role = (user.customClaims || {}).role || null;
  let perms = {};
  if (role === "staff") {
    const snap = await admin.firestore().doc(`staff/${uid}`).get();
    perms = (snap.exists && snap.data().perms) || {};
  }
  return { role, perms };
}

function exigeAlunos(autor) {
  if (autor.role === "admin") return;
  if (autor.role === "staff" && autor.perms.alunos === true) return;
  throw new TarefaErro("Você não tem permissão para gerenciar alunos.");
}

function exigeAdmin(autor) {
  if (autor.role !== "admin") {
    throw new TarefaErro("Apenas a coordenação pode gerenciar a equipe.");
  }
}

function exigeModulos(autor) {
  if (autor.role === "admin") return;
  if (autor.role === "staff" && autor.perms.modulos === true) return;
  throw new TarefaErro("Você não tem permissão para gerenciar módulos.");
}

function exigeFinanceiro(autor) {
  if (autor.role === "admin") return;
  if (autor.role === "staff" && autor.perms.financeiro === true) return;
  throw new TarefaErro("Você não tem permissão para o financeiro.");
}

function exigeTurmas(autor) {
  if (autor.role === "admin") return;
  if (autor.role === "staff" && autor.perms.turmas === true) return;
  throw new TarefaErro("Você não tem permissão para gerenciar turmas.");
}

/* ---------------- Asaas (pagamento das parcelas via PIX) ---------------- */

// Sandbox por padrão; produção usa https://api.asaas.com/v3 (chave sem "hmlg").
function asaasBase() {
  return (process.env.ASAAS_API_KEY || "").includes("_hmlg_")
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

async function asaasApi(metodo, caminho, body) {
  const res = await fetch(asaasBase() + caminho, {
    method: metodo,
    headers: {
      access_token: process.env.ASAAS_API_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json && json.errors && json.errors[0] && json.errors[0].description;
    console.error("Asaas " + metodo + " " + caminho + " -> " + res.status + " " + JSON.stringify(json).slice(0, 300));
    throw new TarefaErro(msg ? "Pagamento: " + String(msg).slice(0, 140) : "O serviço de pagamento não respondeu. Tente novamente.");
  }
  return json;
}

// Garante um cliente Asaas para o aluno (cria na 1ª vez e guarda o id).
// Exige CPF — sem ele a cobrança nominal não é gerada.
async function garantirClienteAsaas(ref, dados) {
  if (dados.asaasCustomerId) return dados.asaasCustomerId;
  const cpf = String(dados.cpf || "").replace(/\D/g, "");
  const cel = String(dados.whatsapp || "").replace(/\D/g, "");
  if (!dados.nome || cpf.length !== 11) {
    throw new TarefaErro("Cadastre o nome e o CPF do aluno antes de gerar a cobrança.");
  }
  const cli = await asaasApi("POST", "/customers", {
    name: dados.nome,
    cpfCnpj: cpf,
    email: dados.email || undefined,
    mobilePhone: cel || undefined,
    // A Asaas cuida dos lembretes de vencimento e do envio da nota por
    // e-mail/SMS — é o que automatiza a cobrança sem a coordenação no meio.
    notificationDisabled: false,
  });
  await ref.update({ asaasCustomerId: cli.id });
  return cli.id;
}

// Endereço do aluno no formato Asaas (obrigatório para emitir NFS-e).
function montarEndereco(dados) {
  const cep = String(dados.cep || "").replace(/\D/g, "");
  if (cep.length !== 8 || !dados.endereco || !dados.numero) return null;
  return {
    postalCode: cep,
    address: String(dados.endereco).slice(0, 120),
    addressNumber: String(dados.numero).slice(0, 20),
    province: String(dados.bairro || "").slice(0, 60),
    complement: dados.complemento ? String(dados.complemento).slice(0, 60) : undefined,
  };
}

// Emite (agenda + autoriza) a NFS-e de uma parcela paga. Best-effort: lança
// TarefaErro com motivo claro se faltar algo; o chamador decide se propaga.
async function emitirNotaAsaas(dados, parcela, totalParcelas) {
  if (!dados.asaasCustomerId) throw new TarefaErro("Aluno sem cadastro de pagamento.");
  const paymentId = parcela.pixId || (parcela.pix && parcela.pix.paymentId);
  if (!paymentId) throw new TarefaErro("Parcela sem cobrança vinculada.");

  const endereco = montarEndereco(dados);
  if (!endereco) throw new TarefaErro("Endereço do aluno incompleto (CEP, rua e número) — necessário para a nota fiscal.");
  await asaasApi("POST", "/customers/" + dados.asaasCustomerId, endereco);

  // A Asaas exige o código do serviço municipal em CADA nota — ela não usa as
  // Informações Fiscais da conta como padrão da API, e o catálogo
  // (/invoices/municipalServices) não está habilitado. Por isso o código fica
  // configurado no painel: deixá-lo fixo aqui emitiria notas com o serviço
  // errado para o município.
  const cfgSnap = await admin.firestore().doc("config/geral").get();
  const fiscal = (cfgSnap.exists && cfgSnap.data().fiscal) || {};
  const codigo = fiscal.codigoServico || "8.02";
  const nome = fiscal.nomeServico || "Instrução e treinamento";
  const iss = typeof fiscal.aliquotaIss === "number" ? fiscal.aliquotaIss : 5;

  const inv = await asaasApi("POST", "/invoices", {
    payment: paymentId,
    serviceDescription: "Curso de Auxiliar Veterinário — Parcela " + parcela.n + "/" + totalParcelas,
    observations: "Emitida pelo Portal CCVET.",
    value: Number((parcela.valor / 100).toFixed(2)),
    deductions: 0,
    effectiveDate: new Date().toISOString().slice(0, 10),
    municipalServiceCode: codigo,
    municipalServiceName: nome,
    taxes: { retainIss: false, iss, cofins: 0, csll: 0, inss: 0, ir: 0, pis: 0 },
  });
  await asaasApi("POST", "/invoices/" + inv.id + "/authorize").catch((e) => {
    // se a autorização falhar agora, a nota fica agendada e é consultada depois
    console.error("NF authorize " + inv.id + ": " + e.message);
  });
  return { invoiceId: inv.id, status: "processando", pdfUrl: null };
}

// Localiza o aluno e a parcela alvo, validando quem pode operar:
// o próprio aluno, ou admin/staff-financeiro (informando alunoUid).
async function parcelaAlvo({ alunoUid, parcelaN }, autor, autorUid) {
  let uid = autorUid;
  if (autor.role !== "aluno") {
    exigeFinanceiro(autor);
    uid = alunoUid;
  }
  if (!uid || !parcelaN) throw new TarefaErro("Parâmetros inválidos.");
  const ref = admin.firestore().doc(`alunos/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new TarefaErro("Aluno não encontrado.");
  const dados = snap.data();
  const fin = dados.financeiro;
  const parcela = fin && (fin.parcelas || []).find((p) => p.n === parcelaN);
  if (!parcela) throw new TarefaErro("Parcela não encontrada.");
  return { ref, fin, parcela, dados };
}

// Dá baixa na parcela e emite a nota. A falha fiscal não impede a baixa:
// o pagamento entrou, e a nota fica com o erro registrado para reemissão.
async function baixarParcelaPaga(ref, fin, parcela, dados, cobranca) {
  const { pix, ...resto } = parcela;
  const paga = {
    ...resto,
    status: "paga",
    pagaEm: (cobranca && cobranca.paymentDate) || new Date().toISOString().slice(0, 10),
    via: "pix",
    pixId: (pix && pix.paymentId) || parcela.pixId || null,
  };
  try {
    paga.nf = await emitirNotaAsaas(dados, paga, fin.parcelas.length);
  } catch (e) {
    paga.nf = { status: "erro", erro: String(e.message).slice(0, 160) };
    console.error("NF parcela " + parcela.n + ": " + e.message);
  }
  await salvarParcela(ref, fin, paga);
  return paga;
}

function salvarParcela(ref, fin, novaParcela) {
  return ref.update({
    financeiro: { ...fin, parcelas: fin.parcelas.map((p) => (p.n === novaParcela.n ? novaParcela : p)) },
  });
}

/* ---------------- Mux (vídeos das aulas) ---------------- */

async function muxApi(metodo, caminho, body) {
  const auth = Buffer.from(process.env.MUX_TOKEN_ID + ":" + process.env.MUX_TOKEN_SECRET).toString("base64");
  const res = await fetch("https://api.mux.com" + caminho, {
    method: metodo,
    headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Mux " + metodo + " " + caminho + " -> " + res.status + " " + txt.slice(0, 300));
    throw new TarefaErro("O serviço de vídeo não respondeu. Tente novamente.");
  }
  return res.status === 204 ? null : res.json();
}

// Senha é opcional: sem ela, a conta nasce sem senha e a pessoa define a sua
// pelo e-mail de redefinição (enviado pelo painel logo após a criação).
async function criarUsuario({ nome, email, senha }) {
  if (!nome || typeof nome !== "string" || !nome.trim()) {
    throw new TarefaErro("Informe o nome.");
  }
  if (!email || typeof email !== "string") {
    throw new TarefaErro("Informe o e-mail.");
  }
  if (senha != null && senha !== "" && (typeof senha !== "string" || senha.length < 6)) {
    throw new TarefaErro("A senha precisa de pelo menos 6 caracteres.");
  }
  try {
    const conta = {
      email: email.trim().toLowerCase(),
      displayName: nome.trim(),
    };
    if (senha) conta.password = senha;
    return await admin.auth().createUser(conta);
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      throw new TarefaErro("Já existe um acesso com esse e-mail.");
    }
    if (e.code === "auth/invalid-email") {
      throw new TarefaErro("E-mail inválido.");
    }
    throw new TarefaErro("Não foi possível criar o acesso. Tente novamente.");
  }
}

// Sem senha inicial, gera o link de primeiro acesso para o painel
// compartilhar por WhatsApp/e-mail. O handler /__/auth/action também é
// servido no domínio próprio, então trocamos o host para o link amigável.
async function linkPrimeiroAcesso(email, comSenha) {
  if (comSenha) return null;
  const link = await admin.auth().generatePasswordResetLink(email.trim().toLowerCase(), { url: PORTAL_URL });
  return link.replace("https://ccvet-41f5d.firebaseapp.com/", "https://ccvetitajai.com/");
}

const EXECUTORES = {
  async createAluno(payload, autor) {
    exigeAlunos(autor);
    const user = await criarUsuario(payload);
    await admin.auth().setCustomUserClaims(user.uid, { role: "aluno" });
    await admin.firestore().doc(`alunos/${user.uid}`).set({
      nome: payload.nome.trim(),
      email: payload.email.trim().toLowerCase(),
      whatsapp: (payload.whatsapp && String(payload.whatsapp).trim().slice(0, 30)) || null,
      cpf: (payload.cpf && String(payload.cpf).replace(/\D/g, "").slice(0, 11)) || null,
      cep: (payload.cep && String(payload.cep).replace(/\D/g, "").slice(0, 8)) || null,
      endereco: (payload.endereco && String(payload.endereco).trim().slice(0, 120)) || null,
      numero: (payload.numero && String(payload.numero).trim().slice(0, 20)) || null,
      bairro: (payload.bairro && String(payload.bairro).trim().slice(0, 60)) || null,
      turmaId: (payload.turmaId && String(payload.turmaId).trim()) || null,
      ativo: true,
      // Acesso às aulas e apostilas; cai para false quando a turma encerra.
      acessoConteudo: true,
      // O certificado é liberado à mão pela coordenação (há aulas presenciais
      // e práticas que o portal não tem como verificar sozinho).
      certificado: { liberado: false, liberadoEm: null, liberadoPor: null },
      progresso: [],
      ultimoAcesso: null,
      criadoEm: FieldValue.serverTimestamp(),
    });
    const linkSenha = await linkPrimeiroAcesso(payload.email, !!payload.senha);
    return linkSenha ? { uid: user.uid, linkSenha } : { uid: user.uid };
  },

  async toggleAlunoAtivo({ uid, ativo }, autor) {
    exigeAlunos(autor);
    if (!uid || typeof uid !== "string" || typeof ativo !== "boolean") {
      throw new TarefaErro("Parâmetros inválidos.");
    }
    const ref = admin.firestore().doc(`alunos/${uid}`);
    if (!(await ref.get()).exists) throw new TarefaErro("Aluno não encontrado.");
    await admin.auth().updateUser(uid, { disabled: !ativo });
    await ref.update({ ativo });
    return { uid, ativo };
  },

  async deleteAluno({ uid }, autor) {
    exigeAlunos(autor);
    if (!uid || typeof uid !== "string") throw new TarefaErro("Parâmetros inválidos.");
    const ref = admin.firestore().doc(`alunos/${uid}`);
    if (!(await ref.get()).exists) throw new TarefaErro("Aluno não encontrado.");
    await admin.auth().deleteUser(uid).catch((e) => {
      if (e.code !== "auth/user-not-found") throw e;
    });
    await ref.delete();
    return { uid };
  },

  // Encerra ou reabre uma turma. Encerrar bloqueia as aulas e apostilas de
  // todos os alunos dela (certificado e financeiro seguem acessíveis);
  // reabrir devolve o acesso.
  async definirStatusTurma({ turmaId, encerrada }, autor) {
    exigeTurmas(autor);
    if (!turmaId || typeof turmaId !== "string" || typeof encerrada !== "boolean") {
      throw new TarefaErro("Parâmetros inválidos.");
    }
    const db = admin.firestore();
    const ref = db.doc(`turmas/${turmaId}`);
    if (!(await ref.get()).exists) throw new TarefaErro("Turma não encontrada.");

    const alunos = await db.collection("alunos").where("turmaId", "==", turmaId).get();
    // Firestore aceita até 500 escritas por lote.
    const docs = alunos.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const lote = db.batch();
      docs.slice(i, i + 400).forEach((d) => lote.update(d.ref, { acessoConteudo: !encerrada }));
      await lote.commit();
    }
    await ref.update({
      status: encerrada ? "encerrada" : "ativa",
      encerradaEm: encerrada ? new Date().toISOString().slice(0, 10) : null,
    });
    return { turmaId, encerrada, alunos: docs.length };
  },

  // Libera (ou revoga) o certificado de um ou vários alunos de uma vez.
  // A conclusão depende das aulas presenciais e práticas, então quem decide
  // é a coordenação — o progresso online serve só como apoio na tela.
  async liberarCertificado({ alunoUids, liberado }, autor, autorUid) {
    exigeAlunos(autor);
    const uids = Array.isArray(alunoUids) ? alunoUids.filter((u) => typeof u === "string" && u) : [];
    if (!uids.length) throw new TarefaErro("Selecione ao menos uma aluna ou aluno.");
    if (uids.length > 400) throw new TarefaErro("Libere no máximo 400 por vez.");

    const db = admin.firestore();
    const certificado = liberado === false
      ? { liberado: false, liberadoEm: null, liberadoPor: null }
      : { liberado: true, liberadoEm: new Date().toISOString().slice(0, 10), liberadoPor: autorUid };

    const refs = uids.map((u) => db.doc(`alunos/${u}`));
    const snaps = await db.getAll(...refs);
    const existentes = snaps.filter((s) => s.exists);
    if (!existentes.length) throw new TarefaErro("Aluno não encontrado.");

    const lote = db.batch();
    existentes.forEach((s) => lote.update(s.ref, { certificado }));
    await lote.commit();
    return { total: existentes.length, liberado: certificado.liberado };
  },

  async createStaff(payload, autor) {
    exigeAdmin(autor);
    const { nome, email, cargo, isAdmin, perms } = payload;
    const user = await criarUsuario(payload);
    const role = isAdmin === true ? "admin" : "staff";
    await admin.auth().setCustomUserClaims(user.uid, { role });
    await admin.firestore().doc(`staff/${user.uid}`).set({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      cargo: (cargo && String(cargo).trim()) || (role === "admin" ? "Coordenação" : "Professor(a)"),
      admin: role === "admin",
      perms: normalizaPerms(perms),
      ativo: true,
      criadoEm: FieldValue.serverTimestamp(),
    });
    const linkSenha = await linkPrimeiroAcesso(email, !!payload.senha);
    return linkSenha ? { uid: user.uid, linkSenha } : { uid: user.uid };
  },

  async toggleStaffAtivo({ uid, ativo }, autor, autorUid) {
    exigeAdmin(autor);
    if (!uid || typeof uid !== "string" || typeof ativo !== "boolean") {
      throw new TarefaErro("Parâmetros inválidos.");
    }
    if (uid === autorUid) throw new TarefaErro("Você não pode desativar o próprio acesso.");
    const ref = admin.firestore().doc(`staff/${uid}`);
    if (!(await ref.get()).exists) throw new TarefaErro("Membro da equipe não encontrado.");
    await admin.auth().updateUser(uid, { disabled: !ativo });
    await ref.update({ ativo });
    return { uid, ativo };
  },

  // Salva o plano de pagamento criando a série inteira de cobranças na Asaas
  // numa única chamada (parcelamento nativo). O cronograma volta da Asaas e
  // vira as parcelas do aluno — assim as duas pontas nunca divergem, e cada
  // parcela já nasce com link de pagamento e lembrete automático.
  async salvarPlano(payload, autor, autorUid) {
    exigeFinanceiro(autor);
    const { alunoUid, valorTotal, parcelas, primeiroVencimento } = payload;
    const n = Number(parcelas);
    const centavos = Number(valorTotal);
    if (!alunoUid || !centavos || centavos <= 0 || !n || n < 1 || n > 36 || !primeiroVencimento) {
      throw new TarefaErro("Parâmetros inválidos.");
    }
    const ref = admin.firestore().doc(`alunos/${alunoUid}`);
    const snap = await ref.get();
    if (!snap.exists) throw new TarefaErro("Aluno não encontrado.");
    const dados = snap.data();

    const jaPago = ((dados.financeiro || {}).parcelas || []).some((p) => p.status === "paga");
    if (jaPago && !payload.confirmaRefazer) {
      throw new TarefaErro("Esse aluno já tem parcela paga. Remova o plano antes de refazer.");
    }

    const customerId = await garantirClienteAsaas(ref, dados);
    const hoje = new Date().toISOString().slice(0, 10);
    const dueDate = primeiroVencimento > hoje ? primeiroVencimento : hoje;

    const serie = await asaasApi("POST", "/payments", {
      customer: customerId,
      billingType: "UNDEFINED", // aluno escolhe PIX, boleto ou cartão
      installmentCount: n,
      totalValue: Number((centavos / 100).toFixed(2)),
      dueDate,
      description: "Curso de Auxiliar Veterinário — CCVET",
      externalReference: alunoUid,
    });

    // A série devolve só a primeira cobrança; buscamos todas para montar o plano.
    const installment = serie.installment;
    let cobrancas = [serie];
    if (installment) {
      const lista = await asaasApi("GET", "/payments?installment=" + installment + "&limit=100");
      if (lista && Array.isArray(lista.data) && lista.data.length) cobrancas = lista.data;
    }
    cobrancas.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

    const novasParcelas = cobrancas.map((c, i) => ({
      n: i + 1,
      valor: Math.round(Number(c.value) * 100),
      vencimento: c.dueDate,
      status: "aberta",
      pix: { paymentId: c.id, invoiceUrl: c.invoiceUrl || null },
    }));
    const total = novasParcelas.reduce((s, p) => s + p.valor, 0);

    await ref.update({
      financeiro: { valorTotal: total, parcelas: novasParcelas, asaasInstallment: installment || null },
    });
    return { parcelas: novasParcelas.length, valorTotal: total };
  },

  // Gera (ou reaproveita) o QR Code PIX da parcela via Asaas.
  async pagarParcela(payload, autor, autorUid) {
    const { ref, fin, parcela, dados } = await parcelaAlvo(payload, autor, autorUid);
    if (parcela.status === "paga") throw new TarefaErro("Essa parcela já está paga.");

    // Reaproveita um QR ainda válido (evita gerar cobrança nova a cada clique).
    if (parcela.pix && parcela.pix.expiresAt && new Date(parcela.pix.expiresAt) > new Date(Date.now() + 60000)) {
      return {
        brCode: parcela.pix.brCode, brCodeBase64: parcela.pix.brCodeBase64,
        expiresAt: parcela.pix.expiresAt, invoiceUrl: parcela.pix.invoiceUrl || null,
      };
    }

    const customerId = await garantirClienteAsaas(ref, dados);
    const hoje = new Date().toISOString().slice(0, 10);
    const dueDate = parcela.vencimento && parcela.vencimento > hoje ? parcela.vencimento : hoje;

    const cobranca = await asaasApi("POST", "/payments", {
      customer: customerId,
      billingType: "PIX",
      value: Number((parcela.valor / 100).toFixed(2)),
      dueDate,
      description: "Parcela " + parcela.n + "/" + fin.parcelas.length + " - Curso CCVET",
      externalReference: (payload.alunoUid || autorUid) + ":" + parcela.n,
    });
    const qr = await asaasApi("GET", "/payments/" + cobranca.id + "/pixQrCode");
    const brCodeBase64 = qr.encodedImage.startsWith("data:") ? qr.encodedImage : "data:image/png;base64," + qr.encodedImage;
    const pix = {
      paymentId: cobranca.id,
      brCode: qr.payload,
      brCodeBase64,
      expiresAt: qr.expirationDate || null,
      // Página de cobrança hospedada pela Asaas — é o link que a coordenação
      // manda por WhatsApp e que o aluno abre para pagar.
      invoiceUrl: cobranca.invoiceUrl || null,
    };
    await salvarParcela(ref, fin, { ...parcela, pix });
    return {
      brCode: pix.brCode, brCodeBase64: pix.brCodeBase64,
      expiresAt: pix.expiresAt, invoiceUrl: pix.invoiceUrl,
    };
  },

  // Confere o pagamento no Asaas; quando confirmado, baixa a parcela e emite a NF.
  async conferirPagamento(payload, autor, autorUid) {
    const { ref, fin, parcela, dados } = await parcelaAlvo(payload, autor, autorUid);
    if (parcela.status === "paga") return { status: "paga" };
    if (!parcela.pix) throw new TarefaErro("Nenhuma cobrança PIX aberta para essa parcela.");

    const cob = await asaasApi("GET", "/payments/" + parcela.pix.paymentId);
    const pago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(cob.status);
    if (pago) {
      await baixarParcelaPaga(ref, fin, parcela, dados, cob);
      return { status: "paga" };
    }
    return { status: "pendente" };
  },

  // (Re)emite a nota fiscal de uma parcela paga. Admin/staff-financeiro.
  async emitirNota(payload, autor, autorUid) {
    exigeFinanceiro(autor);
    const { ref, fin, parcela, dados } = await parcelaAlvo(payload, autor, autorUid);
    if (parcela.status !== "paga") throw new TarefaErro("A nota só é emitida após o pagamento da parcela.");
    const nf = await emitirNotaAsaas(dados, parcela, fin.parcelas.length);
    await salvarParcela(ref, fin, { ...parcela, nf });
    return nf;
  },

  // Consulta a nota no Asaas e grava o link do PDF quando autorizada.
  // O próprio aluno pode disparar para a sua parcela.
  async conferirNota(payload, autor, autorUid) {
    const { ref, fin, parcela } = await parcelaAlvo(payload, autor, autorUid);
    if (!parcela.nf || !parcela.nf.invoiceId) return { status: "sem-nota" };
    if (parcela.nf.pdfUrl) return { status: "emitida", pdfUrl: parcela.nf.pdfUrl };

    const inv = await asaasApi("GET", "/invoices/" + parcela.nf.invoiceId);
    if (inv.status === "AUTHORIZED") {
      const nf = { ...parcela.nf, status: "emitida", pdfUrl: inv.pdfUrl, xmlUrl: inv.xmlUrl || null, numero: inv.number || null };
      await salvarParcela(ref, fin, { ...parcela, nf });
      return { status: "emitida", pdfUrl: inv.pdfUrl };
    }
    if (["CANCELED", "CANCELLATION_DENIED", "ERROR"].includes(inv.status)) {
      await salvarParcela(ref, fin, { ...parcela, nf: { ...parcela.nf, status: "erro" } });
      return { status: "erro" };
    }
    return { status: "processando" };
  },

  // Simula a confirmação do pagamento (sandbox) para testes. Só admin.
  async simularPagamento(payload, autor, autorUid) {
    exigeAdmin(autor);
    const { parcela } = await parcelaAlvo({ ...payload }, autor, autorUid);
    if (!parcela.pix) throw new TarefaErro("Nenhuma cobrança PIX aberta.");
    await asaasApi("POST", "/payments/" + parcela.pix.paymentId + "/receiveInCash", {
      paymentDate: new Date().toISOString().slice(0, 10),
      value: Number((parcela.valor / 100).toFixed(2)),
      notifyCustomer: false,
    });
    return { ok: true };
  },

  // Abre um upload direto navegador → Mux para o vídeo do módulo.
  async muxCriarUpload({ moduloId }, autor) {
    exigeModulos(autor);
    if (!moduloId || typeof moduloId !== "string") throw new TarefaErro("Parâmetros inválidos.");
    const ref = admin.firestore().doc(`modulos/${moduloId}`);
    if (!(await ref.get()).exists) throw new TarefaErro("Módulo não encontrado.");
    const up = await muxApi("POST", "/video/v1/uploads", {
      cors_origin: "*",
      new_asset_settings: { playback_policies: ["public"], video_quality: "basic" },
    });
    return { uploadId: up.data.id, uploadUrl: up.data.url };
  },

  // Confere o processamento; quando pronto, grava o vídeo no módulo.
  async muxConferirUpload({ moduloId, uploadId, arquivo }, autor) {
    exigeModulos(autor);
    if (!moduloId || !uploadId) throw new TarefaErro("Parâmetros inválidos.");
    const up = await muxApi("GET", "/video/v1/uploads/" + uploadId);
    if (up.data.status === "errored") throw new TarefaErro("O envio do vídeo falhou. Tente novamente.");
    if (!up.data.asset_id) return { status: "processando" };

    const asset = await muxApi("GET", "/video/v1/assets/" + up.data.asset_id);
    if (asset.data.status === "errored") throw new TarefaErro("O vídeo não pôde ser processado. Confira o arquivo.");
    if (asset.data.status !== "ready") return { status: "processando" };

    const playbackId = (asset.data.playback_ids || [])[0]?.id;
    if (!playbackId) throw new TarefaErro("O vídeo processou sem link de reprodução. Tente de novo.");

    const ref = admin.firestore().doc(`modulos/${moduloId}`);
    const snap = await ref.get();
    if (snap.exists) {
      const anterior = (snap.data().video || {}).assetId;
      if (anterior && anterior !== up.data.asset_id) {
        await muxApi("DELETE", "/video/v1/assets/" + anterior).catch(() => {});
      }
      await ref.update({
        video: {
          assetId: up.data.asset_id,
          playbackId,
          duracao: Math.round(asset.data.duration || 0),
          arquivo: (arquivo && String(arquivo).slice(0, 200)) || null,
        },
      });
    }
    return { status: "pronto", playbackId };
  },

  // Remove o vídeo (asset no Mux + referência no módulo, se ainda existir).
  async muxRemoverVideo({ moduloId, assetId }, autor) {
    exigeModulos(autor);
    if (!assetId || typeof assetId !== "string") throw new TarefaErro("Parâmetros inválidos.");
    await muxApi("DELETE", "/video/v1/assets/" + assetId).catch((e) => {
      if (!(e instanceof TarefaErro)) throw e;
    });
    if (moduloId) {
      const ref = admin.firestore().doc(`modulos/${moduloId}`);
      const snap = await ref.get();
      if (snap.exists && (snap.data().video || {}).assetId === assetId) {
        await ref.update({ video: FieldValue.delete() });
      }
    }
    return { ok: true };
  },

  // Atualiza cadastro, papel (admin/staff) e permissões de um membro da equipe.
  // O papel vive na claim do token: a pessoa precisa entrar de novo (ou o
  // token renovar) para a mudança valer na sessão dela.
  async setStaffRole({ uid, nome, cargo, isAdmin, perms }, autor, autorUid) {
    exigeAdmin(autor);
    if (!uid || typeof uid !== "string") throw new TarefaErro("Parâmetros inválidos.");
    if (uid === autorUid && isAdmin !== true) {
      throw new TarefaErro("Você não pode remover o próprio acesso de admin.");
    }
    const ref = admin.firestore().doc(`staff/${uid}`);
    if (!(await ref.get()).exists) throw new TarefaErro("Membro da equipe não encontrado.");

    const role = isAdmin === true ? "admin" : "staff";
    await admin.auth().setCustomUserClaims(uid, { role });
    const dados = {
      cargo: (cargo && String(cargo).trim().slice(0, 60)) || (role === "admin" ? "Coordenação" : "Professor(a)"),
      admin: role === "admin",
      perms: normalizaPerms(perms),
    };
    if (nome && String(nome).trim()) dados.nome = String(nome).trim().slice(0, 120);
    await ref.update(dados);
    return { uid, role };
  },

  async deleteStaff({ uid }, autor, autorUid) {
    exigeAdmin(autor);
    if (!uid || typeof uid !== "string") throw new TarefaErro("Parâmetros inválidos.");
    if (uid === autorUid) throw new TarefaErro("Você não pode excluir o próprio acesso.");
    const ref = admin.firestore().doc(`staff/${uid}`);
    if (!(await ref.get()).exists) throw new TarefaErro("Membro da equipe não encontrado.");
    await admin.auth().deleteUser(uid).catch((e) => {
      if (e.code !== "auth/user-not-found") throw e;
    });
    await ref.delete();
    return { uid };
  },
};

exports.processaTarefa = functionsV1
  .region(REGION)
  .runWith({ secrets: ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "ASAAS_API_KEY"] })
  .firestore.document("tarefas/{id}")
  .onCreate(async (snap) => {
    const t = snap.data();
    const executor = EXECUTORES[t.tipo];
    try {
      if (!executor) throw new TarefaErro("Tipo de tarefa desconhecido.");
      const autor = await carregarAutor(t.autorUid);
      const resultado = await executor(t.payload || {}, autor, t.autorUid);
      await snap.ref.update({ status: "ok", resultado, concluidaEm: FieldValue.serverTimestamp() });
    } catch (e) {
      const msg = e instanceof TarefaErro ? e.message : "Erro interno. Tente novamente.";
      if (!(e instanceof TarefaErro)) console.error("Tarefa " + snap.id + " falhou", e);
      await snap.ref.update({ status: "erro", erro: msg, concluidaEm: FieldValue.serverTimestamp() });
    }
  });

// Concilia os pagamentos automaticamente: a cada 15 minutos, pergunta à Asaas
// quais cobranças foram pagas, dá baixa na parcela e emite a nota — sem
// ninguém precisar abrir o painel.
//
// O caminho natural seria um webhook da Asaas, mas ele exige um endpoint
// público, e a organização bloqueia isso (mesma razão pela qual as operações
// privilegiadas passam pela fila `tarefas`). O agendamento resolve sem abrir
// nada para fora; o atraso máximo é o intervalo.
exports.sincronizarPagamentos = functionsV1
  .region(REGION)
  .runWith({ secrets: ["ASAAS_API_KEY"], timeoutSeconds: 300, memory: "256MB" })
  .pubsub.schedule("every 15 minutes")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const pagos = new Map();
    // Os mesmos status que o conferirPagamento considera pagos — inclusive
    // RECEIVED_IN_CASH, de quando a coordenação registra na Asaas um
    // pagamento feito em dinheiro ou transferência fora do portal.
    for (const status of ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]) {
      try {
        const r = await asaasApi("GET", "/payments?status=" + status + "&limit=100");
        (r.data || []).forEach((c) => pagos.set(c.id, c));
      } catch (e) {
        console.error("Sync: falha ao listar " + status + ": " + e.message);
      }
    }
    if (!pagos.size) return null;

    const snap = await admin.firestore().collection("alunos").get();
    let baixadas = 0;
    for (const doc of snap.docs) {
      const parcelasAbertas = (((doc.data().financeiro || {}).parcelas) || [])
        .filter((p) => p.status !== "paga" && p.pix && pagos.has(p.pix.paymentId));
      for (const alvo of parcelasAbertas) {
        // Relê a cada baixa: salvarParcela reescreve o mapa `financeiro` inteiro.
        const atual = await doc.ref.get();
        const dados = atual.data();
        const fin = dados.financeiro;
        const parcela = ((fin || {}).parcelas || []).find((p) => p.n === alvo.n);
        if (!parcela || parcela.status === "paga") continue;
        try {
          await baixarParcelaPaga(doc.ref, fin, parcela, dados, pagos.get(alvo.pix.paymentId));
          baixadas++;
          console.log("Baixa automática: aluno " + doc.id + ", parcela " + parcela.n);
        } catch (e) {
          console.error("Sync: falha ao baixar " + doc.id + "/" + alvo.n + ": " + e.message);
        }
      }
    }
    if (baixadas) console.log("Sync: " + baixadas + " parcela(s) baixada(s).");
    return null;
  });

// Bootstrap do primeiro admin: quando o e-mail autorizado cria a própria conta
// e ainda não existe ninguém em `staff`, ele recebe a claim de admin.
// Depois do primeiro admin, novos usuários criados fora do createAluno não
// ganham papel algum (ficam sem acesso até a coordenação intervir).
// No mesmo passo, semeia o conteúdo inicial do curso se o banco estiver vazio.
exports.onUserCreateBootstrapAdmin = functionsV1
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    const email = (user.email || "").toLowerCase();
    if (email !== BOOTSTRAP_ADMIN_EMAIL) return;

    const db = admin.firestore();
    const staff = await db.collection("staff").limit(1).get();
    if (!staff.empty) return;

    await admin.auth().setCustomUserClaims(user.uid, { role: "admin" });
    await db.doc(`staff/${user.uid}`).set({
      nome: user.displayName || "Coordenação",
      email,
      cargo: "Coordenação",
      admin: true,
      perms: normalizaPerms(null),
      ativo: true,
      criadoEm: FieldValue.serverTimestamp(),
    });

    const config = await db.doc("config/geral").get();
    if (config.exists) return;

    const batch = db.batch();
    batch.set(db.doc("config/geral"), {
      curso: "Auxiliar Veterinário",
      // Legado: a turma virou coleção própria (`turmas`). Mantido enquanto as
      // telas antigas ainda leem daqui; sai quando todas migrarem.
      turma: "Turma 2026.1",
      cargaHoraria: "200 horas",
      coordenacao: user.displayName || "Coordenação CCVET",
      whatsapp: "https://wa.me/5547996551654",
    });
    batch.set(db.doc("turmas/2026-1"), {
      nome: "Turma 2026.1",
      inicio: "2026-02-01",
      fim: null,
      status: "ativa",
      cargaHoraria: "200 horas",
      whatsappGrupo: null,
      criadoEm: FieldValue.serverTimestamp(),
    });
    const MODULOS = [
      ["Boas-vindas e rotina clínica", "Como funciona o dia a dia de uma clínica veterinária e o papel do auxiliar."],
      ["Anatomia e fisiologia básica", "Estruturas e sistemas dos cães e gatos que todo auxiliar precisa dominar."],
      ["Manejo e contenção segura", "Técnicas de contenção com foco no bem-estar animal e na sua segurança."],
      ["Enfermagem veterinária na prática", "Curativos, medicação, fluidoterapia e acompanhamento de internados."],
      ["Exames, laboratório e vacinas", "Coleta de material, apoio em exames e protocolos vacinais."],
      ["Atendimento ao tutor e ética", "Comunicação acolhedora, recepção e postura profissional."],
    ];
    MODULOS.forEach(([nome, desc], i) => {
      batch.set(db.collection("modulos").doc(), { nome, desc, ordem: i + 1, apostila: null });
    });
    batch.set(db.collection("links").doc(), {
      titulo: "Coordenação no WhatsApp", desc: "Dúvidas diretas com a coordenação",
      url: "https://wa.me/5547996551654", tipo: "whatsapp",
    });
    batch.set(db.collection("links").doc(), {
      titulo: "Instagram da CCVET", desc: "Bastidores e dicas da profissão",
      url: "https://www.instagram.com/ccvetitajai", tipo: "instagram",
    });
    await batch.commit();
  });
