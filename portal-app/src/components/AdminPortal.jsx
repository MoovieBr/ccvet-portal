/* Painel da COORDENAÇÃO e da equipe — cada seção exige a sua permissão. */
import React from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase.js";
import { PIcons, Chip, Avt, Bar, Modal, Empty, Field } from "./shared.jsx";
import {
  criar, atualizar, excluir, gravar, trocarOrdem,
  uploadApostila, removerApostilaArquivo,
  fnCreateAluno, fnToggleAlunoAtivo, fnDeleteAluno,
  fnCreateStaff, fnToggleStaffAtivo, fnDeleteStaff, fnSetStaffRole,
  fnMuxCriarUpload, fnMuxConferirUpload, fnMuxRemoverVideo, uploadVideoMux,
  fnEmitirNota, fnConferirNota, buscarCep,
  fnDefinirStatusTurma, fnLiberarCertificado, fnSalvarPlano, fnPagarParcela
} from "../lib/db.js";
import {
  fmtDataHora, hojeISO, fmtDia,
  fmtMoney, diasAte, parcelaAtrasada, proximaParcela, waNumero
} from "../lib/format.js";
import { Agenda, Aviso } from "./AlunoPortal.jsx";

export default function AdminPortal({ me, isAdmin, perms, staffMe, staff, config, turmas, presencas, modulos, alunos, avisos, cronograma, links, logs, onLogout, toast, onPreview }) {
  // Contexto global: a turma escolhida filtra alunos, avisos, cronograma,
  // visão geral e financeiro. "todas" mostra tudo junto.
  const turmaPadrao = (turmas.find((t) => t.status === "ativa") || turmas[0] || {}).id || "todas";
  const [turmaSel, setTurmaSel] = React.useState(turmaPadrao);
  const turmaAtual = turmas.find((t) => t.id === turmaSel) || null;
  const rotuloTurma = turmaAtual ? turmaAtual.nome : "todas as turmas";

  // Filtros: itens sem turmaId valem para todas as turmas (avisos gerais).
  const daTurma = (lista, incluirGerais) => (turmaSel === "todas"
    ? lista
    : lista.filter((x) => x.turmaId === turmaSel || (incluirGerais && !x.turmaId)));
  const alunosF = daTurma(alunos, false);
  const avisosF = daTurma(avisos, true);
  const cronogramaF = daTurma(cronograma, true);

  const TITULOS = {
    visao: ["Visão geral", "Um resumo rápido da " + rotuloTurma + "."],
    turmas: ["Turmas", "Crie e organize as turmas do curso."],
    modulos: ["Módulos e apostilas", "Crie, ordene e publique o material de cada módulo."],
    alunos: ["Alunas e alunos", "Cadastre novos acessos e gerencie quem está ativo."],
    avisos: ["Avisos", "Publique comunicados para toda a turma."],
    cronograma: ["Cronograma", "Monte a agenda de aulas, práticas e provas."],
    links: ["Links úteis", "Acessos rápidos que aparecem para a turma."],
    financeiro: ["Financeiro", "Planos de pagamento, vencimentos e cobranças da turma."],
    equipe: ["Equipe", "Crie acessos para professores e defina o que cada um pode gerenciar."],
  };

  // Cada aba exige a permissão da seção; a visão geral usa dados de alunos.
  const NAV = [
    ["visao", "Visão geral", PIcons.chart, isAdmin || perms.alunos],
    ["turmas", "Turmas", PIcons.cal, isAdmin || perms.turmas],
    ["modulos", "Módulos e apostilas", PIcons.book, isAdmin || perms.modulos],
    ["alunos", "Alunas e alunos", PIcons.users, isAdmin || perms.alunos],
    ["avisos", "Avisos", PIcons.bell, isAdmin || perms.avisos],
    ["cronograma", "Cronograma", PIcons.cal, isAdmin || perms.cronograma],
    ["links", "Links úteis", PIcons.link, isAdmin || perms.links],
    ["financeiro", "Financeiro", PIcons.money, isAdmin || perms.financeiro],
    ["equipe", "Equipe", PIcons.users, isAdmin],
  ].filter(([, , , ok]) => ok);

  const [tab, setTab] = React.useState(NAV.length ? NAV[0][0] : "");

  if (!NAV.length) {
    return (
      <div className="gate static">
        <div className="gcard">
          <span className="gic"><PIcons.lock style={{ width: 34, height: 34 }} /></span>
          <h2>Sem seções liberadas</h2>
          <p>A coordenação ainda não liberou nenhuma seção para o seu acesso.</p>
          <button className="btn btn-navy btn-sm" onClick={onLogout}>Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="side s-admin">
        <div className="auth-brand">
          <span className="mk"><PIcons.paw style={{ width: 24, height: 24 }} /></span>
          <span>
            <span className="nm">CC<b>VET</b></span>
            <span className="sb" style={{ color: "rgba(255,255,255,.5)" }}>
              {isAdmin ? "Painel da coordenação" : "Painel da equipe"}
            </span>
          </span>
        </div>
        <span className="role-tag"><Chip tone="lima">{isAdmin ? "Admin" : (staffMe.cargo || "Equipe")}</Chip></span>
        {NAV.map(([id, label, Ic]) => (
          <button key={id} className={"sitem" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
            <Ic /> <span className="sl">{label}</span>
          </button>
        ))}
        <button className="sitem preview-btn" onClick={onPreview} title="Ver o portal como aluno">
          <PIcons.eye /> <span className="sl">Ver como aluno</span>
        </button>
        <div className="side-foot">
          <Avt nome={staffMe.nome} tone="navy" />
          <span className="who">
            <b>{staffMe.nome}</b>
            <span>{staffMe.cargo || (isAdmin ? "Coordenação" : "Equipe")}</span>
          </span>
          <button className="iconbtn" onClick={onLogout} title="Sair"
            style={{ background: "transparent", borderColor: "rgba(255,255,255,.25)", color: "#fff" }}>
            <PIcons.out style={{ width: 17, height: 17 }} />
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-in">
          <div className="topbar">
            <div>
              <h1>{TITULOS[tab][0]}</h1>
              <p className="sub">{TITULOS[tab][1]}</p>
            </div>
            {/* O seletor não aparece nas seções que não são de turma. */}
            {turmas.length > 0 && !["turmas", "modulos", "links", "equipe"].includes(tab) && (
              <label className="turma-sel" title="Filtrar por turma">
                <PIcons.cal style={{ width: 16, height: 16 }} />
                <select className="in" value={turmaSel} onChange={(e) => setTurmaSel(e.target.value)}>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}{t.status === "encerrada" ? " (encerrada)" : ""}
                    </option>
                  ))}
                  <option value="todas">Todas as turmas</option>
                </select>
              </label>
            )}
          </div>
          {tab === "visao" && <Visao modulos={modulos} alunos={alunosF} logs={logs} />}
          {tab === "turmas" && (isAdmin || perms.turmas) && (
            <AdmTurmas turmas={turmas} alunos={alunos} modulos={modulos}
              presencas={presencas} cronograma={cronograma} toast={toast} />
          )}
          {tab === "modulos" && <AdmModulos modulos={modulos} logs={logs} toast={toast} />}
          {tab === "alunos" && (
            <AdmAlunos alunos={alunosF} modulos={modulos} turmas={turmas} turmaSel={turmaSel} toast={toast} />
          )}
          {tab === "avisos" && (
            <AdmAvisos avisos={avisosF} turmaSel={turmaSel} rotuloTurma={rotuloTurma} toast={toast} />
          )}
          {tab === "cronograma" && (
            <AdmCrono cronograma={cronogramaF} turmaSel={turmaSel} rotuloTurma={rotuloTurma}
              alunos={alunos} presencas={presencas} meuUid={me.uid}
              podeChamada={isAdmin || perms.presenca === true} toast={toast} />
          )}
          {tab === "links" && <AdmLinks links={links} toast={toast} />}
          {tab === "financeiro" && (isAdmin || perms.financeiro) && (
            <AdmFinanceiro alunos={alunosF} config={config} toast={toast} />
          )}
          {tab === "equipe" && isAdmin && <AdmEquipe meuUid={me.uid} staff={staff} toast={toast} />}
        </div>
      </main>
    </div>
  );
}

/* Depois de criar um acesso sem senha inicial: compartilhar o link de
   primeiro acesso por WhatsApp, e-mail ou cópia manual. */
function LinkAcessoModal({ info, onClose, toast }) {
  const { nome, email, link } = info;
  const primeiroNome = nome.split(" ")[0];
  const msg = "Olá, " + primeiroNome + "! Seu acesso ao Portal CCVET foi criado.\n\n"
    + "Seu login: " + email + "\n"
    + "Crie sua senha neste link: " + link + "\n\n"
    + "Depois é só entrar em https://ccvetitajai.com/portal";

  const porEmail = async () => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast("E-mail de primeiro acesso enviado para " + email);
      onClose();
    } catch (e) { toast("Não foi possível enviar o e-mail."); }
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); toast("Link copiado!"); }
    catch (e) { toast("Não foi possível copiar."); }
  };

  return (
    <Modal title={"Acesso criado para " + primeiroNome + "!"} onClose={onClose}>
      <p style={{ fontSize: 14, color: "var(--gray)", fontWeight: 600, lineHeight: 1.5 }}>
        Agora é só enviar o link para {primeiroNome} criar a própria senha.
        Se o link expirar, a pessoa pode usar <b>“Esqueci minha senha”</b> na tela de entrada.
      </p>
      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <a className="btn btn-sm" style={{ background: "#2bb24c", color: "#fff" }}
          href={"https://wa.me/?text=" + encodeURIComponent(msg)} target="_blank" rel="noopener noreferrer">
          <PIcons.wa style={{ width: 17, height: 17 }} /> Enviar pelo WhatsApp
        </a>
        <button className="btn btn-line btn-sm" onClick={porEmail}>Enviar por e-mail</button>
        <button className="btn btn-line btn-sm" onClick={copiar}>Copiar link</button>
      </div>
      <div className="modal-acts">
        <button className="btn btn-navy btn-sm" onClick={onClose}>Concluir</button>
      </div>
    </Modal>
  );
}

/* ---------- Visão geral ---------- */
function contaDownloads(logs) {
  const por = {};
  logs.forEach((l) => {
    if (l.tipo === "download") por[l.moduloId] = (por[l.moduloId] || 0) + 1;
  });
  return por;
}

function Visao({ modulos, alunos, logs }) {
  const ativos = alunos.filter((a) => a.ativo);
  const porModulo = contaDownloads(logs);
  const totalDownloads = Object.values(porModulo).reduce((s, n) => s + n, 0);
  const pctMedia = ativos.length
    ? Math.round(ativos.reduce((s, a) => s + (a.progresso || []).length / Math.max(1, modulos.length) * 100, 0) / ativos.length)
    : 0;
  const maior = Math.max(1, ...modulos.map((m) => porModulo[m.id] || 0));
  const recentes = [...alunos].filter((a) => a.ultimoAcesso)
    .sort((a, b) => b.ultimoAcesso.localeCompare(a.ultimoAcesso)).slice(0, 5);

  return (
    <div className="stack">
      <div className="grid4">
        <div className="stat"><span className="si"><PIcons.users style={{ width: 20, height: 20 }} /></span><b>{ativos.length}</b><span>alunas/os ativos</span></div>
        <div className="stat"><span className="si"><PIcons.book style={{ width: 20, height: 20 }} /></span><b>{modulos.length}</b><span>módulos publicados</span></div>
        <div className="stat"><span className="si"><PIcons.dl style={{ width: 20, height: 20 }} /></span><b>{totalDownloads}</b><span>downloads de apostilas</span></div>
        <div className="stat"><span className="si"><PIcons.chart style={{ width: 20, height: 20 }} /></span><b>{pctMedia}%</b><span>progresso médio da turma</span></div>
      </div>
      <div className="grid2">
        <div className="pcard">
          <h3>Downloads por apostila</h3>
          {modulos.length === 0 && <Empty icon="book" text="Nenhum módulo ainda." />}
          {modulos.map((m, i) => (
            <div className="dlrow" key={m.id}>
              <span className="dlname">{i + 1}. {m.nome}</span>
              <Bar pct={(porModulo[m.id] || 0) / maior * 100} />
              <span className="dlnum">{porModulo[m.id] || 0}</span>
            </div>
          ))}
        </div>
        <div className="pcard">
          <h3>Últimos acessos</h3>
          <div className="stack" style={{ gap: 10 }}>
            {recentes.length === 0 && <Empty icon="users" text="Nenhum acesso registrado ainda." />}
            {recentes.map((a) => (
              <div className="trow" style={{ padding: "10px 14px" }} key={a.id}>
                <Avt nome={a.nome} tone={a.ativo ? "" : "off"} />
                <span className="ttx">
                  <b>{a.nome}</b>
                  <span>{a.ativo ? "ativa/o" : "acesso desativado"}</span>
                </span>
                <Chip tone="soft"><PIcons.clock style={{ width: 12, height: 12 }} /> {fmtDataHora(a.ultimoAcesso)}</Chip>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Módulos e apostilas ---------- */
function AdmModulos({ modulos, logs, toast }) {
  const [editando, setEditando] = React.useState(null);
  const [enviando, setEnviando] = React.useState(null);   // {id, pct} da apostila
  const [videoEnv, setVideoEnv] = React.useState(null);   // {id, pct, fase}
  const porModulo = contaDownloads(logs);
  const vazio = { nome: "", desc: "" };

  const salvar = async () => {
    const { id, nome, desc } = editando;
    if (!nome.trim()) return;
    try {
      if (id) {
        await atualizar("modulos/" + id, { nome: nome.trim(), desc: desc.trim() });
        toast("Módulo atualizado");
      } else {
        const ordem = modulos.length ? Math.max(...modulos.map((m) => m.ordem || 0)) + 1 : 1;
        await criar("modulos", { nome: nome.trim(), desc: desc.trim(), ordem, apostila: null });
        toast("Módulo criado — envie a apostila quando quiser");
      }
      setEditando(null);
    } catch (e) { toast("Não foi possível salvar."); }
  };

  const excluirModulo = async (m) => {
    if (!window.confirm('Excluir o módulo "' + m.nome + '"? As alunas perdem acesso à apostila e à videoaula dele.')) return;
    try {
      if (m.apostila && m.apostila.path) await removerApostilaArquivo(m.apostila.path);
      if (m.video && m.video.assetId) {
        await fnMuxRemoverVideo({ moduloId: m.id, assetId: m.video.assetId }).catch(() => {});
      }
      await excluir("modulos/" + m.id);
      toast("Módulo excluído");
    } catch (e) { toast("Não foi possível excluir."); }
  };

  const mover = async (i, delta) => {
    const ordenados = [...modulos].sort((a, b) => a.ordem - b.ordem);
    const alvo = ordenados[i + delta];
    if (!alvo) return;
    try { await trocarOrdem(ordenados[i], alvo); }
    catch (e) { toast("Não foi possível reordenar."); }
  };

  const enviarApostila = async (m, file) => {
    if (!file) return;
    if (file.type !== "application/pdf") { toast("Envie um arquivo PDF."); return; }
    // Guarda o caminho antigo: só apagamos depois que o novo subiu, e apenas
    // se o nome mudou (senão apagaríamos o arquivo recém-enviado).
    const antigo = m.apostila && m.apostila.path;
    setEnviando({ id: m.id, pct: 0 });
    try {
      await uploadApostila(m.id, file, (pct) => setEnviando({ id: m.id, pct }));
      if (antigo && antigo !== "apostilas/" + m.id + "/" + file.name) {
        await removerApostilaArquivo(antigo);
      }
      toast("Apostila publicada 🐾");
    } catch (e) {
      toast("Falha no envio da apostila. Tente de novo.");
    } finally { setEnviando(null); }
  };

  // O arquivo vai direto do navegador para o Mux; o backend só abre o upload
  // e depois confirma quando o vídeo terminou de processar.
  const enviarVideo = async (m, file) => {
    if (!file) return;
    setVideoEnv({ id: m.id, pct: 0, fase: "enviando" });
    try {
      const up = await fnMuxCriarUpload({ moduloId: m.id });
      await uploadVideoMux(up.data.uploadUrl, file, (pct) => setVideoEnv({ id: m.id, pct, fase: "enviando" }));
      setVideoEnv({ id: m.id, fase: "processando" });
      // O Mux transcodifica em segundo plano; perguntamos de 5 em 5 segundos
      // por até 10 minutos antes de deixar a pessoa seguir com outra coisa.
      for (let i = 0; i < 120; i++) {
        const st = await fnMuxConferirUpload({ moduloId: m.id, uploadId: up.data.uploadId, arquivo: file.name });
        if (st.data.status === "pronto") { toast("Videoaula publicada 🎬"); setVideoEnv(null); return; }
        await new Promise((r) => setTimeout(r, 5000));
      }
      toast("O vídeo ainda está processando — confira daqui a pouco.");
      setVideoEnv(null);
    } catch (e) {
      toast(e.message || "Falha no envio do vídeo.");
      setVideoEnv(null);
    }
  };

  const removerVideo = async (m) => {
    if (!window.confirm('Remover a videoaula de "' + m.nome + '"?')) return;
    try {
      await fnMuxRemoverVideo({ moduloId: m.id, assetId: m.video.assetId });
      toast("Videoaula removida");
    } catch (e) { toast(e.message || "Não foi possível remover o vídeo."); }
  };

  const ordenados = [...modulos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-lima btn-sm" onClick={() => setEditando({ ...vazio })}>
          <PIcons.plus style={{ width: 16, height: 16 }} /> Novo módulo
        </button>
      </div>
      {ordenados.length === 0 && <Empty icon="book" text="Crie o primeiro módulo do curso." />}
      {ordenados.map((m, i) => {
        const env = enviando && enviando.id === m.id ? enviando : null;
        const vid = videoEnv && videoEnv.id === m.id ? videoEnv : null;
        return (
          <div className="mrow" key={m.id}>
            <span className="mnum">{i + 1}</span>
            <span className="mtx">
              <b>{m.nome}</b>
              <span>{m.desc}</span>
              <span className="mfile">
                {m.video && m.video.playbackId && <Chip tone="navy">▶ Videoaula</Chip>}
                {vid && (
                  <Chip tone="lima">
                    {vid.fase === "enviando" ? "Enviando vídeo " + vid.pct + "%" : "Processando vídeo..."}
                  </Chip>
                )}
                <PIcons.file style={{ width: 14, height: 14 }} />
                {m.apostila ? m.apostila.arquivo + " • " + m.apostila.tamanho : "Nenhuma apostila publicada ainda"}
                <Chip tone="soft"><PIcons.dl style={{ width: 11, height: 11 }} /> {porModulo[m.id] || 0}</Chip>
              </span>
            </span>
            <span className="macts">
              <button className="iconbtn" disabled={i === 0} onClick={() => mover(i, -1)} title="Subir">
                <PIcons.up style={{ width: 16, height: 16 }} />
              </button>
              <button className="iconbtn" disabled={i === ordenados.length - 1} onClick={() => mover(i, 1)} title="Descer">
                <PIcons.down style={{ width: 16, height: 16 }} />
              </button>
              <label className="filelabel" title="Enviar apostila (PDF)">
                <PIcons.upload style={{ width: 15, height: 15 }} />
                {env ? "Enviando... " + env.pct + "%" : m.apostila ? "Substituir apostila" : "Enviar apostila"}
                <input type="file" accept=".pdf,application/pdf" disabled={!!enviando}
                  onChange={(e) => { enviarApostila(m, e.target.files[0]); e.target.value = ""; }} />
              </label>
              <label className="filelabel" title="Enviar videoaula">
                <PIcons.upload style={{ width: 15, height: 15 }} />
                {vid ? (vid.fase === "enviando" ? vid.pct + "%" : "Processando...") : m.video ? "Substituir vídeo" : "Enviar vídeo"}
                <input type="file" accept="video/*" disabled={!!videoEnv}
                  onChange={(e) => { enviarVideo(m, e.target.files[0]); e.target.value = ""; }} />
              </label>
              {m.video && m.video.assetId && (
                <button className="iconbtn danger" disabled={!!videoEnv} onClick={() => removerVideo(m)} title="Remover videoaula">
                  <PIcons.x style={{ width: 16, height: 16 }} />
                </button>
              )}
              <button className="iconbtn" onClick={() => setEditando({ id: m.id, nome: m.nome, desc: m.desc })} title="Editar">
                <PIcons.edit style={{ width: 16, height: 16 }} />
              </button>
              <button className="iconbtn danger" onClick={() => excluirModulo(m)} title="Excluir">
                <PIcons.trash style={{ width: 16, height: 16 }} />
              </button>
            </span>
          </div>
        );
      })}
      {editando && (
        <Modal title={editando.id ? "Editar módulo" : "Novo módulo"} onClose={() => setEditando(null)}>
          <Field label="Nome do módulo">
            <input className="in" value={editando.nome} placeholder="Ex.: Farmacologia básica"
              onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
          </Field>
          <Field label="Descrição curta">
            <textarea className="in" value={editando.desc} placeholder="O que a turma aprende neste módulo?"
              onChange={(e) => setEditando({ ...editando, desc: e.target.value })}></textarea>
          </Field>
          <div className="modal-acts">
            <button className="btn btn-line btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn btn-lima btn-sm" onClick={salvar} disabled={!editando.nome.trim()}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Alunas e alunos ---------- */
function AdmAlunos({ alunos, modulos, turmas, turmaSel, toast }) {
  const [editando, setEditando] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const [cepBuscando, setCepBuscando] = React.useState(false);
  const [certOcupado, setCertOcupado] = React.useState(null); // uid em transição
  const [linkCriado, setLinkCriado] = React.useState(null);   // {nome, email, link}
  const nMod = Math.max(1, modulos.length);
  const ordenados = [...alunos].sort((a, b) => a.nome.localeCompare(b.nome));

  const salvar = async () => {
    const { id, nome, email, senha } = editando;
    setSalvando(true);
    try {
      if (id) {
        await atualizar("alunos/" + id, {
          nome: nome.trim(),
          whatsapp: (editando.whatsapp || "").trim() || null,
          cpf: (editando.cpf || "").replace(/\D/g, "").slice(0, 11) || null,
          cep: (editando.cep || "").replace(/\D/g, "").slice(0, 8) || null,
          endereco: (editando.endereco || "").trim() || null,
          numero: (editando.numero || "").trim() || null,
          bairro: (editando.bairro || "").trim() || null,
          turmaId: editando.turmaId || null,
        });
        toast("Cadastro atualizado");
      } else {
        const res = await fnCreateAluno({
          nome: nome.trim(), email: email.trim(), senha: senha || "",
          whatsapp: (editando.whatsapp || "").trim(), cpf: (editando.cpf || "").trim(),
          cep: (editando.cep || "").trim(), endereco: (editando.endereco || "").trim(),
          numero: (editando.numero || "").trim(), bairro: (editando.bairro || "").trim(),
          turmaId: editando.turmaId || null,
        });
        if (res.data.linkSenha) {
          setLinkCriado({ nome: nome.trim(), email: email.trim().toLowerCase(), link: res.data.linkSenha });
        } else {
          toast("Acesso criado — envie e-mail e senha para a/o aluna/o");
        }
      }
      setEditando(null);
    } catch (e) {
      toast(e.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  // Máscara o CEP e, ao completar 8 dígitos, busca rua/bairro no ViaCEP.
  const onCepChange = async (raw) => {
    const num = raw.replace(/\D/g, "").slice(0, 8);
    const masked = num.length > 5 ? num.slice(0, 5) + "-" + num.slice(5) : num;
    setEditando((ed) => ({ ...ed, cep: masked }));
    if (num.length === 8) {
      setCepBuscando(true);
      const r = await buscarCep(num);
      setCepBuscando(false);
      if (r) setEditando((ed) => ({ ...ed, endereco: r.endereco || ed.endereco, bairro: r.bairro || ed.bairro }));
      else toast("CEP não encontrado — preencha o endereço manualmente.");
    }
  };

  const toggleAtivo = async (a) => {
    try {
      await fnToggleAlunoAtivo({ uid: a.id, ativo: !a.ativo });
      toast(a.ativo ? "Acesso de " + a.nome.split(" ")[0] + " desativado" : "Acesso reativado");
    } catch (e) { toast("Não foi possível alterar o acesso."); }
  };

  const excluirAluno = async (a) => {
    if (!window.confirm("Excluir " + a.nome + "? A conta e o histórico de progresso serão perdidos.")) return;
    try { await fnDeleteAluno({ uid: a.id }); toast("Cadastro excluído"); }
    catch (e) { toast("Não foi possível excluir."); }
  };

  const redefinirSenha = async (a) => {
    try {
      await sendPasswordResetEmail(auth, a.email);
      toast("Link de redefinição enviado para " + a.email);
    } catch (e) { toast("Não foi possível enviar o e-mail."); }
  };

  // O certificado depende das aulas presenciais e práticas, então quem
  // decide é a coordenação. O progresso online entra só como referência.
  const alternarCertificado = async (a) => {
    const liberado = !(a.certificado && a.certificado.liberado);
    const pct = Math.round(((a.progresso || []).length / nMod) * 100);
    if (liberado && pct < 100) {
      if (!window.confirm(a.nome + " concluiu " + pct + "% dos módulos online.\n\n"
        + "Liberar o certificado mesmo assim? Confirme antes que a presença nas aulas "
        + "presenciais e práticas está em dia.")) return;
    }
    if (!liberado && !window.confirm("Revogar o certificado de " + a.nome + "?")) return;
    setCertOcupado(a.id);
    try {
      await fnLiberarCertificado({ alunoUids: [a.id], liberado });
      toast(liberado ? "Certificado liberado para " + a.nome.split(" ")[0] : "Certificado revogado");
    } catch (e) {
      toast(e.message || "Não foi possível alterar o certificado.");
    } finally { setCertOcupado(null); }
  };

  const turmaInicial = turmaSel !== "todas" ? turmaSel : ((turmas.find((t) => t.status === "ativa") || {}).id || "");

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-lima btn-sm" onClick={() => setEditando({
          nome: "", email: "", senha: "", whatsapp: "", cpf: "",
          cep: "", endereco: "", numero: "", bairro: "", turmaId: turmaInicial,
        })}>
          <PIcons.plus style={{ width: 16, height: 16 }} /> Nova aluna / novo aluno
        </button>
      </div>
      {ordenados.length === 0 && <Empty icon="users" text="Cadastre o primeiro acesso de aluna/o." />}
      {ordenados.map((a) => {
        const pct = Math.round(((a.progresso || []).length / nMod) * 100);
        const cert = a.certificado && a.certificado.liberado;
        return (
          <div className={"trow" + (a.ativo ? "" : " off")} key={a.id}>
            <Avt nome={a.nome} tone={a.ativo ? "" : "off"} />
            <span className="ttx"><b>{a.nome}</b><span>{a.email}</span></span>
            <span className="tcol">
              <span className="tlbl">Progresso</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bar pct={pct} /><span className="tval">{pct}%</span>
              </span>
            </span>
            <span className="tcol">
              <span className="tlbl">Último acesso</span>
              <span className="tval">{a.ultimoAcesso ? fmtDataHora(a.ultimoAcesso) : "nunca entrou"}</span>
            </span>
            <button className={"btn btn-xs " + (cert ? "btn-lima" : "btn-line")}
              disabled={certOcupado === a.id} onClick={() => alternarCertificado(a)}
              title={cert
                ? "Certificado liberado" + (a.certificado.liberadoEm ? " em " + fmtDia(a.certificado.liberadoEm) : "") + " — clique para revogar"
                : "Liberar o certificado (confirme a presença nas práticas)"}>
              <PIcons.award style={{ width: 14, height: 14 }} />
              {certOcupado === a.id ? "..." : (cert ? "Certificado" : "Liberar")}
            </button>
            <label className="sw" title={a.ativo ? "Desativar acesso" : "Ativar acesso"}>
              <input type="checkbox" checked={a.ativo} onChange={() => toggleAtivo(a)} />
              <span className="tr"></span>
            </label>
            <button className="iconbtn" title="Editar" onClick={() => setEditando({
              id: a.id, nome: a.nome, email: a.email, whatsapp: a.whatsapp || "", cpf: a.cpf || "",
              cep: a.cep || "", endereco: a.endereco || "", numero: a.numero || "",
              bairro: a.bairro || "", turmaId: a.turmaId || "",
            })}>
              <PIcons.edit style={{ width: 16, height: 16 }} />
            </button>
            <button className="iconbtn danger" onClick={() => excluirAluno(a)} title="Excluir">
              <PIcons.trash style={{ width: 16, height: 16 }} />
            </button>
          </div>
        );
      })}
      {editando && (
        <Modal title={editando.id ? "Editar cadastro" : "Novo acesso de aluna/o"} onClose={() => setEditando(null)}>
          <Field label="Nome completo">
            <input className="in" value={editando.nome} placeholder="Nome da/o aluna/o"
              onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
          </Field>
          <Field label="Turma">
            <select className="in" value={editando.turmaId || ""}
              onChange={(e) => setEditando({ ...editando, turmaId: e.target.value })}>
              <option value="">Sem turma</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}{t.status === "encerrada" ? " (encerrada)" : ""}</option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="WhatsApp">
              <input className="in" value={editando.whatsapp || ""} placeholder="(47) 99999-9999"
                onChange={(e) => setEditando({ ...editando, whatsapp: e.target.value })} />
            </Field>
            <Field label="CPF">
              <input className="in" value={editando.cpf || ""} placeholder="000.000.000-00"
                onChange={(e) => setEditando({ ...editando, cpf: e.target.value })} />
            </Field>
          </div>
          <p style={{ marginTop: 6, fontSize: 12, color: "var(--gray)", fontWeight: 600 }}>
            WhatsApp e CPF são necessários para o aluno pagar as parcelas por PIX no portal.
          </p>
          <div className="grid2">
            <Field label={cepBuscando ? "CEP — buscando endereço…" : "CEP"}>
              <input className="in" value={editando.cep || ""} placeholder="00000-000" inputMode="numeric"
                onChange={(e) => onCepChange(e.target.value)} />
            </Field>
            <Field label="Bairro">
              <input className="in" value={editando.bairro || ""} placeholder="Centro"
                onChange={(e) => setEditando({ ...editando, bairro: e.target.value })} />
            </Field>
          </div>
          <div className="grid2">
            <Field label="Endereço (rua)">
              <input className="in" value={editando.endereco || ""} placeholder="Rua / Avenida"
                onChange={(e) => setEditando({ ...editando, endereco: e.target.value })} />
            </Field>
            <Field label="Número">
              <input className="in" value={editando.numero || ""} placeholder="123"
                onChange={(e) => setEditando({ ...editando, numero: e.target.value })} />
            </Field>
          </div>
          <p style={{ marginTop: 6, fontSize: 12, color: "var(--gray)", fontWeight: 600 }}>
            Digite o CEP e a rua e o bairro são preenchidos automaticamente. O endereço é usado na emissão da nota fiscal de cada parcela paga.
          </p>
          {editando.id ? (
            <React.Fragment>
              <Field label="E-mail de acesso">
                <input className="in" type="email" value={editando.email} disabled />
              </Field>
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-line btn-xs" onClick={() => redefinirSenha(editando)}>
                  Enviar link de redefinição de senha
                </button>
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <Field label="E-mail de acesso">
                <input className="in" type="email" value={editando.email} placeholder="email@exemplo.com"
                  onChange={(e) => setEditando({ ...editando, email: e.target.value })} />
              </Field>
              <Field label="Senha inicial (opcional)">
                <input className="in" value={editando.senha} placeholder="Mínimo de 6 caracteres"
                  onChange={(e) => setEditando({ ...editando, senha: e.target.value })} />
              </Field>
              <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--gray)", fontWeight: 600 }}>
                Deixe em branco para gerar um link de primeiro acesso — você envia por WhatsApp ou e-mail e a pessoa cria a própria senha.
              </p>
            </React.Fragment>
          )}
          <div className="modal-acts">
            <button className="btn btn-line btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn btn-lima btn-sm" onClick={salvar}
              disabled={salvando || !editando.nome.trim() || (!editando.id && (!editando.email.trim() || ((editando.senha || "").length > 0 && (editando.senha || "").length < 6)))}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </Modal>
      )}
      {linkCriado && <LinkAcessoModal info={linkCriado} onClose={() => setLinkCriado(null)} toast={toast} />}
    </div>
  );
}

/* ---------- Turmas ---------- */
const STATUS_TURMA = {
  planejada: { label: "Planejada", tone: "soft" },
  ativa: { label: "Ativa", tone: "lima" },
  encerrada: { label: "Encerrada", tone: "warm" },
};

function AdmTurmas({ turmas, alunos, modulos, presencas, cronograma, toast }) {
  const [editando, setEditando] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const [ocupada, setOcupada] = React.useState(null);     // id da turma em transição
  const [certTurma, setCertTurma] = React.useState(null); // turma no painel de certificados
  const ordenadas = [...turmas].sort((a, b) => (b.inicio || "").localeCompare(a.inicio || "") || a.nome.localeCompare(b.nome));
  const vazia = { nome: "", inicio: "", fim: "", cargaHoraria: "200 horas", whatsappGrupo: "" };

  const salvar = async () => {
    const dados = {
      nome: editando.nome.trim(),
      inicio: editando.inicio || null,
      fim: editando.fim || null,
      cargaHoraria: editando.cargaHoraria.trim() || null,
      whatsappGrupo: editando.whatsappGrupo.trim() || null,
    };
    if (!dados.nome) return;
    setSalvando(true);
    try {
      if (editando.id) {
        await atualizar("turmas/" + editando.id, dados);
        toast("Turma atualizada");
      } else {
        // Id legível a partir do nome: "Turma 2026.1" -> "2026-1"
        const id = dados.nome.toLowerCase().replace(/turma\s*/g, "").trim()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || String(Date.now());
        if (turmas.some((t) => t.id === id)) throw new Error("Já existe uma turma com esse nome.");
        await gravar("turmas/" + id, { ...dados, status: "planejada", criadoEm: new Date().toISOString() });
        toast("Turma criada");
      }
      setEditando(null);
    } catch (e) {
      toast(e.message || "Não foi possível salvar a turma.");
    } finally { setSalvando(false); }
  };

  // Encerrar bloqueia as aulas e apostilas de todos os alunos da turma;
  // reabrir devolve o acesso. Roda no backend, em lote.
  const alternarEncerramento = async (t) => {
    const encerrar = t.status !== "encerrada";
    const n = alunos.filter((a) => a.turmaId === t.id).length;
    const aviso = encerrar
      ? "Encerrar " + t.nome + "?\n\n" + n + (n === 1 ? " aluno perde" : " alunos perdem")
        + " o acesso às aulas e apostilas. O certificado e o histórico financeiro continuam disponíveis."
      : "Reabrir " + t.nome + "?\n\n" + n + (n === 1 ? " aluno volta" : " alunos voltam") + " a ter acesso ao conteúdo.";
    if (!window.confirm(aviso)) return;
    setOcupada(t.id);
    try {
      const r = await fnDefinirStatusTurma({ turmaId: t.id, encerrada: encerrar });
      toast((encerrar ? "Turma encerrada — " : "Turma reaberta — ") + r.data.alunos
        + (r.data.alunos === 1 ? " aluno atualizado" : " alunos atualizados"));
    } catch (e) {
      toast(e.message || "Não foi possível alterar a turma.");
    } finally { setOcupada(null); }
  };

  const ativar = async (t) => {
    try { await atualizar("turmas/" + t.id, { status: "ativa" }); toast(t.nome + " está ativa"); }
    catch (e) { toast("Não foi possível ativar."); }
  };

  const excluirTurma = async (t) => {
    const n = alunos.filter((a) => a.turmaId === t.id).length;
    if (n) { toast("Mova os " + n + " alunos para outra turma antes de excluir."); return; }
    if (!window.confirm("Excluir " + t.nome + "? Essa ação não pode ser desfeita.")) return;
    try { await excluir("turmas/" + t.id); toast("Turma excluída"); }
    catch (e) { toast("Não foi possível excluir."); }
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-lima btn-sm" onClick={() => setEditando({ ...vazia })}>
          <PIcons.plus style={{ width: 16, height: 16 }} /> Nova turma
        </button>
      </div>
      {ordenadas.length === 0 && <Empty icon="cal" text="Crie a primeira turma para organizar os alunos." />}
      {ordenadas.map((t) => {
        const st = STATUS_TURMA[t.status] || STATUS_TURMA.planejada;
        const n = alunos.filter((a) => a.turmaId === t.id).length;
        return (
          <div className="pcard" key={t.id} style={t.status === "encerrada" ? { opacity: 0.75 } : {}}>
            <div className="trow" style={{ border: "none", padding: 0 }}>
              <span className="lic" style={{ width: 42, height: 42, borderRadius: 13, background: "var(--lima-soft)", color: "var(--lima-700)", display: "grid", placeItems: "center" }}>
                <PIcons.cal style={{ width: 21, height: 21 }} />
              </span>
              <span className="ttx">
                <b>{t.nome}</b>
                <span>
                  {n === 1 ? "1 aluno" : n + " alunos"}
                  {t.cargaHoraria ? " • " + t.cargaHoraria : ""}
                  {/* Com o ano: turmas de anos diferentes começam no mesmo dia. */}
                  {t.inicio ? " • início " + fmtDia(t.inicio) + "/" + t.inicio.slice(0, 4) : ""}
                </span>
              </span>
              <Chip tone={st.tone}>{st.label}</Chip>
              {t.status === "planejada" && (
                <button className="btn btn-lima btn-xs" onClick={() => ativar(t)}>Ativar</button>
              )}
              {n > 0 && (
                <button className="btn btn-line btn-xs" onClick={() => setCertTurma(t)} title="Liberar certificados da turma">
                  <PIcons.award style={{ width: 14, height: 14 }} /> Certificados
                </button>
              )}
              <button className="btn btn-line btn-xs" disabled={ocupada === t.id} onClick={() => alternarEncerramento(t)}>
                {ocupada === t.id ? "..." : (t.status === "encerrada" ? "Reabrir" : "Encerrar")}
              </button>
              <button className="iconbtn" title="Editar" onClick={() => setEditando({
                id: t.id, nome: t.nome, inicio: t.inicio || "", fim: t.fim || "",
                cargaHoraria: t.cargaHoraria || "", whatsappGrupo: t.whatsappGrupo || "",
              })}>
                <PIcons.edit style={{ width: 16, height: 16 }} />
              </button>
              <button className="iconbtn danger" onClick={() => excluirTurma(t)} title="Excluir">
                <PIcons.trash style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        );
      })}
      {certTurma && (
        <CertificadosTurma turma={certTurma} alunos={alunos.filter((a) => a.turmaId === certTurma.id)}
          modulos={modulos} presencas={presencas} cronograma={cronograma}
          onClose={() => setCertTurma(null)} toast={toast} />
      )}
      {editando && (
        <Modal title={editando.id ? "Editar turma" : "Nova turma"} onClose={() => setEditando(null)}>
          <Field label="Nome da turma">
            <input className="in" value={editando.nome} placeholder="Ex.: Turma 2026.2"
              onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="Início">
              <input className="in" type="date" value={editando.inicio}
                onChange={(e) => setEditando({ ...editando, inicio: e.target.value })} />
            </Field>
            <Field label="Término previsto">
              <input className="in" type="date" value={editando.fim}
                onChange={(e) => setEditando({ ...editando, fim: e.target.value })} />
            </Field>
          </div>
          <div className="grid2">
            <Field label="Carga horária">
              <input className="in" value={editando.cargaHoraria} placeholder="200 horas"
                onChange={(e) => setEditando({ ...editando, cargaHoraria: e.target.value })} />
            </Field>
            <Field label="Grupo no WhatsApp">
              <input className="in" value={editando.whatsappGrupo} placeholder="https://chat.whatsapp.com/..."
                onChange={(e) => setEditando({ ...editando, whatsappGrupo: e.target.value })} />
            </Field>
          </div>
          <div className="modal-acts">
            <button className="btn btn-line btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn btn-lima btn-sm" onClick={salvar} disabled={salvando || !editando.nome.trim()}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* Liberação de certificados de uma turma inteira. O progresso online e a
   presença são exibidos como apoio — quem decide é a coordenação. */
function CertificadosTurma({ turma, alunos, modulos, presencas, cronograma, onClose, toast }) {
  const nMod = Math.max(1, modulos.length);
  const ordenados = [...alunos].sort((a, b) => a.nome.localeCompare(b.nome));
  const jaLiberados = ordenados.filter((a) => a.certificado && a.certificado.liberado).map((a) => a.id);
  const [sel, setSel] = React.useState(() => new Set(jaLiberados));
  const [salvando, setSalvando] = React.useState(false);

  // Práticas da turma que já tiveram chamada registrada.
  const chamadas = (presencas || []).filter((p) => {
    const ev = (cronograma || []).find((e) => e.id === p.id);
    return ev && ev.tipo === "pratica" && ev.turmaId === turma.id;
  });
  const presencaDe = (uid) => chamadas.filter((c) => (c.presentes || {})[uid] === true).length;

  const alternar = (id) => setSel((s) => {
    const novo = new Set(s);
    novo.has(id) ? novo.delete(id) : novo.add(id);
    return novo;
  });

  // Só grava a diferença: quem entrou na seleção e quem saiu.
  const liberar = [...sel].filter((id) => !jaLiberados.includes(id));
  const revogar = jaLiberados.filter((id) => !sel.has(id));
  const mudou = liberar.length > 0 || revogar.length > 0;

  const aplicar = async () => {
    setSalvando(true);
    try {
      if (liberar.length) await fnLiberarCertificado({ alunoUids: liberar, liberado: true });
      if (revogar.length) await fnLiberarCertificado({ alunoUids: revogar, liberado: false });
      const partes = [];
      if (liberar.length) partes.push(liberar.length + (liberar.length === 1 ? " liberado" : " liberados"));
      if (revogar.length) partes.push(revogar.length + (revogar.length === 1 ? " revogado" : " revogados"));
      toast("Certificados: " + partes.join(" e "));
      onClose();
    } catch (e) {
      toast(e.message || "Não foi possível atualizar os certificados.");
    } finally { setSalvando(false); }
  };

  return (
    <Modal title={"Certificados — " + turma.nome} onClose={onClose}>
      <p style={{ fontSize: 13.5, color: "var(--gray)", fontWeight: 600, lineHeight: 1.5 }}>
        Marque quem concluiu o curso. Os números são apoio à decisão, não uma
        trava — a coordenação é quem sabe dos casos justificados.
      </p>
      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        <button className="btn btn-line btn-xs" onClick={() => setSel(new Set(ordenados.map((a) => a.id)))}>Marcar todos</button>
        <button className="btn btn-line btn-xs" onClick={() => setSel(new Set())}>Limpar</button>
      </div>
      <div className="stack" style={{ gap: 6, maxHeight: 340, overflowY: "auto" }}>
        {ordenados.map((a) => {
          const pct = Math.round(((a.progresso || []).length / nMod) * 100);
          return (
            <label key={a.id} className="parc" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={sel.has(a.id)} onChange={() => alternar(a.id)}
                style={{ width: 17, height: 17, accentColor: "var(--lima-700)" }} />
              <span className="ttx" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <b>{a.nome}</b>
                <span>
                  {pct}% dos módulos online
                  {chamadas.length > 0 && " • presença " + presencaDe(a.id) + "/" + chamadas.length + " práticas"}
                </span>
              </span>
              {a.certificado && a.certificado.liberado && (
                <Chip tone="lima">Liberado{a.certificado.liberadoEm ? " " + fmtDia(a.certificado.liberadoEm) : ""}</Chip>
              )}
            </label>
          );
        })}
      </div>
      <div className="modal-acts">
        <button className="btn btn-line btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-lima btn-sm" onClick={aplicar} disabled={salvando || !mudou}>
          {salvando ? "Salvando..."
            : mudou ? "Aplicar (" + (liberar.length ? "+" + liberar.length : "") + (liberar.length && revogar.length ? " / " : "") + (revogar.length ? "−" + revogar.length : "") + ")"
            : "Sem alterações"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Avisos ---------- */
function AdmAvisos({ avisos, turmaSel, rotuloTurma, toast }) {
  const [novo, setNovo] = React.useState({ titulo: "", texto: "", fixado: false, geral: false });
  const [editando, setEditando] = React.useState(null);
  const ordenados = [...avisos].sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0) || b.data.localeCompare(a.data));
  // Com "Todas as turmas" selecionado, o aviso novo só pode ser geral.
  const soGeral = turmaSel === "todas";
  const geral = soGeral || novo.geral;

  const publicar = async () => {
    if (!novo.titulo.trim() || !novo.texto.trim()) return;
    try {
      await criar("avisos", {
        titulo: novo.titulo.trim(), texto: novo.texto.trim(), fixado: novo.fixado,
        data: hojeISO(), turmaId: geral ? null : turmaSel,
      });
      setNovo({ titulo: "", texto: "", fixado: false, geral: false });
      toast(geral ? "Aviso publicado para todas as turmas" : "Aviso publicado para a " + rotuloTurma);
    } catch (e) { toast("Não foi possível publicar."); }
  };
  const salvarEdicao = async () => {
    try {
      await atualizar("avisos/" + editando.id, { titulo: editando.titulo, texto: editando.texto });
      setEditando(null);
      toast("Aviso atualizado");
    } catch (e) { toast("Não foi possível salvar."); }
  };
  const fixar = (av) => atualizar("avisos/" + av.id, { fixado: !av.fixado }).catch(() => toast("Não foi possível alterar."));
  const excluirAviso = async (av) => {
    if (!window.confirm('Excluir o aviso "' + av.titulo + '"?')) return;
    try { await excluir("avisos/" + av.id); toast("Aviso excluído"); }
    catch (e) { toast("Não foi possível excluir."); }
  };

  return (
    <div className="stack">
      <div className="pcard">
        <h3>Publicar novo aviso</h3>
        <Field label="Título">
          <input className="in" value={novo.titulo} placeholder="Ex.: Mudança de sala na prática de sábado"
            onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
        </Field>
        <Field label="Mensagem">
          <textarea className="in" value={novo.texto} placeholder="Escreva o comunicado para a turma..."
            onChange={(e) => setNovo({ ...novo, texto: e.target.value })}></textarea>
        </Field>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700, color: "var(--navy)", fontSize: 14, cursor: "pointer" }}>
            <label className="sw">
              <input type="checkbox" checked={novo.fixado} onChange={(e) => setNovo({ ...novo, fixado: e.target.checked })} />
              <span className="tr"></span>
            </label>
            Fixar no topo
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700, color: "var(--navy)", fontSize: 14, cursor: soGeral ? "default" : "pointer", opacity: soGeral ? 0.6 : 1 }}>
            <label className="sw">
              <input type="checkbox" checked={geral} disabled={soGeral}
                onChange={(e) => setNovo({ ...novo, geral: e.target.checked })} />
              <span className="tr"></span>
            </label>
            Vale para todas as turmas
          </label>
          <button className="btn btn-lima btn-sm" onClick={publicar} disabled={!novo.titulo.trim() || !novo.texto.trim()}>
            {geral ? "Publicar para todas" : "Publicar na " + rotuloTurma}
          </button>
        </div>
      </div>
      {ordenados.map((av) => (
        <Aviso key={av.id} av={av} acts={
          <div className="aacts">
            {!av.turmaId && <Chip tone="soft">Todas as turmas</Chip>}
            <button className="btn btn-line btn-xs" onClick={() => fixar(av)}>{av.fixado ? "Desafixar" : "Fixar no topo"}</button>
            <button className="btn btn-line btn-xs" onClick={() => setEditando({ ...av })}>Editar</button>
            <button className="btn btn-line btn-xs" style={{ color: "#C64A35" }} onClick={() => excluirAviso(av)}>Excluir</button>
          </div>
        } />
      ))}
      {editando && (
        <Modal title="Editar aviso" onClose={() => setEditando(null)}>
          <Field label="Título">
            <input className="in" value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} />
          </Field>
          <Field label="Mensagem">
            <textarea className="in" value={editando.texto} onChange={(e) => setEditando({ ...editando, texto: e.target.value })}></textarea>
          </Field>
          <div className="modal-acts">
            <button className="btn btn-line btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn btn-lima btn-sm" onClick={salvarEdicao}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Cronograma e chamada ---------- */

/* Chamada de uma aula prática. Um documento por evento: uma escrita só,
   e o aluno não tem acesso à coleção (a presença não fica no doc dele). */
function ChamadaModal({ evento, alunos, presenca, meuUid, onClose, toast }) {
  const ordenados = [...alunos].sort((a, b) => a.nome.localeCompare(b.nome));
  const registrados = (presenca && presenca.presentes) || {};
  // Primeira chamada começa com todos presentes — é o caso comum na sala.
  const inicial = () => {
    const s = new Set();
    ordenados.forEach((a) => {
      const v = registrados[a.id];
      if (v === true || (v === undefined && !presenca)) s.add(a.id);
    });
    return s;
  };
  const [sel, setSel] = React.useState(inicial);
  const [salvando, setSalvando] = React.useState(false);

  const alternar = (id) => setSel((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      const presentes = {};
      ordenados.forEach((a) => { presentes[a.id] = sel.has(a.id); });
      await gravar("presencas/" + evento.id, {
        turmaId: evento.turmaId || null,
        data: evento.data,
        titulo: evento.titulo,
        presentes,
        registradoPor: meuUid,
        registradoEm: new Date().toISOString(),
      });
      toast("Chamada salva — " + sel.size + " de " + ordenados.length + " presentes");
      onClose();
    } catch (e) {
      toast("Não foi possível salvar a chamada.");
    } finally { setSalvando(false); }
  };

  return (
    <Modal title={"Chamada — " + evento.titulo} onClose={onClose}>
      <p style={{ fontSize: 13.5, color: "var(--gray)", fontWeight: 600 }}>
        {fmtDia(evento.data)} • {evento.hora} • {evento.local}
        {presenca && presenca.registradoEm ? " — chamada já registrada, você está editando." : ""}
      </p>
      <div style={{ display: "flex", gap: 8, margin: "14px 0", alignItems: "center" }}>
        <button className="btn btn-line btn-xs" onClick={() => setSel(new Set(ordenados.map((a) => a.id)))}>Todos presentes</button>
        <button className="btn btn-line btn-xs" onClick={() => setSel(new Set())}>Limpar</button>
        <span style={{ marginLeft: "auto", fontWeight: 800, color: "var(--navy)", fontSize: 14 }}>
          {sel.size}/{ordenados.length}
        </span>
      </div>
      {ordenados.length === 0 && <Empty icon="users" text="Nenhum aluno nesta turma." />}
      <div className="stack" style={{ gap: 6, maxHeight: 340, overflowY: "auto" }}>
        {ordenados.map((a) => {
          const presente = sel.has(a.id);
          return (
            <label key={a.id} className="parc" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={presente} onChange={() => alternar(a.id)}
                style={{ width: 17, height: 17, accentColor: "var(--lima-700)" }} />
              <span className="ttx" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <b>{a.nome}</b>
              </span>
              <Chip tone={presente ? "lima" : "warm"}>{presente ? "Presente" : "Ausente"}</Chip>
            </label>
          );
        })}
      </div>
      <div className="modal-acts">
        <button className="btn btn-line btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-lima btn-sm" onClick={salvar} disabled={salvando || ordenados.length === 0}>
          {salvando ? "Salvando..." : "Salvar chamada"}
        </button>
      </div>
    </Modal>
  );
}

function AdmCrono({ cronograma, turmaSel, rotuloTurma, alunos, presencas, podeChamada, meuUid, toast }) {
  const vazio = { data: "", hora: "19:30", titulo: "", tipo: "aula", local: "Online (link no grupo)", geral: false };
  const [novo, setNovo] = React.useState(vazio);
  const [chamada, setChamada] = React.useState(null); // evento com a chamada aberta
  const eventos = [...cronograma].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const soGeral = turmaSel === "todas";
  const geral = soGeral || novo.geral;

  const adicionar = async () => {
    if (!novo.data || !novo.titulo.trim()) return;
    try {
      const { geral: _g, ...campos } = novo;
      await criar("cronograma", { ...campos, titulo: novo.titulo.trim(), turmaId: geral ? null : turmaSel });
      setNovo(vazio);
      toast(geral ? "Evento adicionado para todas as turmas" : "Evento adicionado à " + rotuloTurma);
    } catch (e) { toast("Não foi possível adicionar."); }
  };
  const excluirEvento = async (ev) => {
    if (!window.confirm('Remover "' + ev.titulo + '" do cronograma?')) return;
    try { await excluir("cronograma/" + ev.id); toast("Evento removido"); }
    catch (e) { toast("Não foi possível remover."); }
  };

  return (
    <div className="stack">
      <div className="pcard">
        <h3>Novo evento</h3>
        <div className="grid3">
          <Field label="Data"><input className="in" type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} /></Field>
          <Field label="Hora"><input className="in" type="time" value={novo.hora} onChange={(e) => setNovo({ ...novo, hora: e.target.value })} /></Field>
          <Field label="Tipo">
            <select className="in" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
              <option value="aula">Aula ao vivo</option>
              <option value="pratica">Prática presencial</option>
              <option value="prova">Prova</option>
            </select>
          </Field>
        </div>
        <div className="grid2">
          <Field label="Título"><input className="in" value={novo.titulo} placeholder="Ex.: Aula ao vivo: farmacologia" onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></Field>
          <Field label="Local"><input className="in" value={novo.local} onChange={(e) => setNovo({ ...novo, local: e.target.value })} /></Field>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700, color: "var(--navy)", fontSize: 14, cursor: soGeral ? "default" : "pointer", opacity: soGeral ? 0.6 : 1 }}>
            <label className="sw">
              <input type="checkbox" checked={geral} disabled={soGeral}
                onChange={(e) => setNovo({ ...novo, geral: e.target.checked })} />
              <span className="tr"></span>
            </label>
            Vale para todas as turmas
          </label>
          <button className="btn btn-lima btn-sm" onClick={adicionar} disabled={!novo.data || !novo.titulo.trim()}>
            {geral ? "Adicionar para todas" : "Adicionar na " + rotuloTurma}
          </button>
        </div>
      </div>
      <Agenda eventos={eventos} acts={(ev) => {
        // Chamada só nas práticas presenciais, e só de uma turma específica
        // (um evento "de todas as turmas" não tem uma lista de alunos única).
        const temChamada = podeChamada && ev.tipo === "pratica" && ev.turmaId;
        const p = presencas.find((x) => x.id === ev.id);
        const n = p ? Object.values(p.presentes || {}).filter(Boolean).length : 0;
        return (
          <React.Fragment>
            {temChamada && (
              <button className="btn btn-line btn-xs" onClick={() => setChamada(ev)}
                title={p ? "Editar a chamada" : "Fazer a chamada"}>
                <PIcons.check style={{ width: 14, height: 14 }} />
                {p ? "Presença " + n + "/" + Object.keys(p.presentes || {}).length : "Chamada"}
              </button>
            )}
            <button className="iconbtn danger" onClick={() => excluirEvento(ev)} title="Remover">
              <PIcons.trash style={{ width: 16, height: 16 }} />
            </button>
          </React.Fragment>
        );
      }} />
      {chamada && (
        <ChamadaModal evento={chamada} meuUid={meuUid}
          alunos={alunos.filter((a) => a.turmaId === chamada.turmaId)}
          presenca={presencas.find((x) => x.id === chamada.id)}
          onClose={() => setChamada(null)} toast={toast} />
      )}
    </div>
  );
}

/* ---------- Links úteis ---------- */
function AdmLinks({ links, toast }) {
  const vazio = { titulo: "", desc: "", url: "", tipo: "whatsapp" };
  const [novo, setNovo] = React.useState(vazio);

  const adicionar = async () => {
    if (!novo.titulo.trim() || !novo.url.trim()) return;
    try {
      await criar("links", { ...novo, titulo: novo.titulo.trim(), desc: novo.desc.trim(), url: novo.url.trim() });
      setNovo(vazio);
      toast("Link adicionado");
    }
    catch (e) { toast("Não foi possível adicionar."); }
  };
  const excluirLink = async (l) => {
    if (!window.confirm('Remover o link "' + l.titulo + '"?')) return;
    try { await excluir("links/" + l.id); toast("Link removido"); }
    catch (e) { toast("Não foi possível remover."); }
  };

  return (
    <div className="stack">
      <div className="pcard">
        <h3>Novo link</h3>
        <div className="grid2">
          <Field label="Título"><input className="in" value={novo.titulo} placeholder="Ex.: Grupo da turma no WhatsApp" onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></Field>
          <Field label="Tipo">
            <select className="in" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
        </div>
        <Field label="Descrição curta">
          <input className="in" value={novo.desc} placeholder="Ex.: Avisos rápidos e troca entre colegas"
            onChange={(e) => setNovo({ ...novo, desc: e.target.value })} />
        </Field>
        <Field label="URL">
          <input className="in" type="url" value={novo.url} placeholder="https://..."
            onChange={(e) => setNovo({ ...novo, url: e.target.value })} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-lima btn-sm" onClick={adicionar} disabled={!novo.titulo.trim() || !novo.url.trim()}>Adicionar link</button>
        </div>
      </div>
      <div className="grid2">
        {links.length === 0 && <Empty icon="link" text="Nenhum link cadastrado ainda." />}
        {links.map((l) => {
          const Ic = l.tipo === "whatsapp" ? PIcons.wa : l.tipo === "instagram" ? PIcons.ig : PIcons.link;
          return (
            <div className="linkcard" key={l.id}>
              <span className="lic"><Ic style={{ width: 22, height: 22 }} /></span>
              <span className="ltx"><b>{l.titulo}</b><span>{l.desc}</span></span>
              <button className="iconbtn danger" onClick={() => excluirLink(l)} title="Remover">
                <PIcons.trash style={{ width: 16, height: 16 }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Financeiro ---------- */
function statusParcela(p) {
  if (p.status === "paga") return { label: "Paga", cls: "lima" };
  if (parcelaAtrasada(p)) return { label: "Atrasada", cls: "warm" };
  const d = diasAte(p.vencimento);
  if (d === 0) return { label: "Vence hoje", cls: "warm" };
  if (d === 1) return { label: "Vence amanhã", cls: "warm" };
  return { label: "Em aberto", cls: "soft" };
}

function msgCobranca(aluno, p, total) {
  const nome = aluno.nome.split(" ")[0];
  const link = p.pix && p.pix.invoiceUrl;
  return "Olá, " + nome + "! Aqui é da CCVET.\n\n"
    + "Passando para lembrar da parcela " + p.n + "/" + total + " do curso, no valor de "
    + fmtMoney(p.valor) + ", com vencimento em " + fmtDia(p.vencimento) + "."
    + (link
      ? "\n\nVocê paga por aqui, no PIX ou no cartão: " + link
      : "\n\nO link de pagamento está no seu portal, na aba Financeiro.")
    + "\n\nQualquer dúvida é só responder por aqui!";
}

// Ações de nota fiscal de uma parcela paga (painel admin/financeiro).
function NotaFiscalAdmin({ aluno, parcela, toast }) {
  const [ocupado, setOcupado] = React.useState(false);
  const nf = parcela.nf;

  const emitir = async () => {
    setOcupado(true);
    try {
      await fnEmitirNota({ alunoUid: aluno.id, parcelaN: parcela.n });
      toast("Nota fiscal em emissão — o PDF fica pronto em instantes.");
    } catch (e) { toast(e.message || "Não foi possível emitir a nota."); }
    finally { setOcupado(false); }
  };
  const conferir = async () => {
    setOcupado(true);
    try {
      const r = await fnConferirNota({ alunoUid: aluno.id, parcelaN: parcela.n });
      if (r.data.status === "processando") toast("A nota ainda está sendo autorizada. Tente de novo em instantes.");
      else if (r.data.status === "erro") toast("A prefeitura recusou a nota. Reemita para tentar novamente.");
    } catch (e) { toast(e.message || "Não foi possível consultar a nota."); }
    finally { setOcupado(false); }
  };

  if (nf && nf.pdfUrl) {
    return (
      <a className="btn btn-xs btn-line" href={nf.pdfUrl} target="_blank" rel="noopener noreferrer"
        title={nf.numero ? "Nota fiscal nº " + nf.numero : "Baixar nota fiscal"}>
        <PIcons.file style={{ width: 14, height: 14 }} /> NF
      </a>
    );
  }
  if (nf && nf.invoiceId && nf.status !== "erro") {
    return <button className="btn btn-xs btn-line" onClick={conferir} disabled={ocupado}>{ocupado ? "..." : "NF processando ↻"}</button>;
  }
  return (
    <button className="btn btn-xs btn-line" onClick={emitir} disabled={ocupado}
      title={nf && nf.status === "erro" ? "Falhou: " + (nf.erro || "") : "Emitir nota fiscal"}>
      {ocupado ? "..." : (nf && nf.status === "erro" ? "Reemitir NF" : "Emitir NF")}
    </button>
  );
}

function AdmFinanceiro({ alunos, config, toast }) {
  const [plano, setPlano] = React.useState(null);       // {aluno, valor, parcelas, primeiro}
  const [detalhe, setDetalhe] = React.useState(null);   // uid do aluno expandido
  const [gerando, setGerando] = React.useState(null);   // "uid:n" da cobrança em criação
  const [salvandoPlano, setSalvandoPlano] = React.useState(false);
  const fiscalSalvo = config.fiscal || {};
  const [fiscal, setFiscal] = React.useState({
    codigoServico: fiscalSalvo.codigoServico || "",
    nomeServico: fiscalSalvo.nomeServico || "",
    aliquotaIss: fiscalSalvo.aliquotaIss != null ? String(fiscalSalvo.aliquotaIss) : "",
  });

  const ordenados = [...alunos].sort((a, b) => a.nome.localeCompare(b.nome));

  // Totais da turma
  let recebido = 0, aReceber = 0, atrasadas = 0;
  alunos.forEach((a) => (a.financeiro?.parcelas || []).forEach((p) => {
    if (p.status === "paga") recebido += p.valor;
    else { aReceber += p.valor; if (parcelaAtrasada(p)) atrasadas++; }
  }));

  const salvarFiscal = async () => {
    const iss = parseFloat(String(fiscal.aliquotaIss).replace(",", "."));
    try {
      await atualizar("config/geral", {
        fiscal: {
          codigoServico: fiscal.codigoServico.trim() || null,
          nomeServico: fiscal.nomeServico.trim() || null,
          aliquotaIss: isNaN(iss) ? null : iss,
        }
      });
      toast("Dados fiscais salvos");
    } catch (e) { toast("Não foi possível salvar os dados fiscais."); }
  };
  const fiscalMudou = fiscal.codigoServico.trim() !== (fiscalSalvo.codigoServico || "")
    || fiscal.nomeServico.trim() !== (fiscalSalvo.nomeServico || "")
    || String(fiscal.aliquotaIss) !== (fiscalSalvo.aliquotaIss != null ? String(fiscalSalvo.aliquotaIss) : "");

  // Cria a cobrança na Asaas para obter o link de pagamento. O aluno também
  // consegue gerar pelo portal; aqui é para a coordenação cobrar antes disso.
  const gerarCobranca = async (a, p) => {
    setGerando(a.id + ":" + p.n);
    try {
      await fnPagarParcela({ alunoUid: a.id, parcelaN: p.n });
      toast("Link de cobrança gerado");
    } catch (e) {
      toast(e.message || "Não foi possível gerar a cobrança.");
    } finally { setGerando(null); }
  };

  // Cria o plano e a série de cobranças na Asaas de uma vez — cada parcela já
  // sai com link de pagamento e lembrete automático, sem gerar uma a uma.
  const salvarPlano = async () => {
    const { aluno, valor, parcelas, primeiro } = plano;
    const centavos = Math.round(parseFloat(String(valor).replace(",", ".")) * 100);
    const n = parseInt(parcelas, 10);
    if (!centavos || centavos <= 0 || !n || n < 1 || n > 36 || !primeiro) return;
    setSalvandoPlano(true);
    try {
      const r = await fnSalvarPlano({
        alunoUid: aluno.id, valorTotal: centavos, parcelas: n,
        primeiroVencimento: primeiro, confirmaRefazer: true,
      });
      toast(r.data.parcelas + "x criadas na Asaas para " + aluno.nome.split(" ")[0]);
      setPlano(null);
      setDetalhe(aluno.id);
    } catch (e) {
      toast(e.message || "Não foi possível criar as cobranças.");
    } finally { setSalvandoPlano(false); }
  };

  const removerPlano = async (a) => {
    if (!window.confirm("Remover o plano de pagamento de " + a.nome + "? O histórico de parcelas será perdido.")) return;
    try { await atualizar("alunos/" + a.id, { financeiro: null }); toast("Plano removido"); }
    catch (e) { toast("Não foi possível remover."); }
  };

  const togglePaga = async (a, numero) => {
    const parcelas = a.financeiro.parcelas.map((p) =>
      p.n === numero
        ? (p.status === "paga" ? { ...p, status: "aberta", pagaEm: null } : { ...p, status: "paga", pagaEm: hojeISO() })
        : p
    );
    try { await atualizar("alunos/" + a.id, { financeiro: { ...a.financeiro, parcelas } }); }
    catch (e) { toast("Não foi possível atualizar a parcela."); }
  };

  return (
    <div className="stack">
      <div className="grid4">
        <div className="stat"><span className="si"><PIcons.money style={{ width: 20, height: 20 }} /></span><b>{fmtMoney(recebido)}</b><span>recebido</span></div>
        <div className="stat"><span className="si"><PIcons.clock style={{ width: 20, height: 20 }} /></span><b>{fmtMoney(aReceber)}</b><span>a receber</span></div>
        <div className="stat"><span className="si"><PIcons.bell style={{ width: 20, height: 20 }} /></span><b>{atrasadas}</b><span>{atrasadas === 1 ? "parcela atrasada" : "parcelas atrasadas"}</span></div>
        <div className="stat"><span className="si"><PIcons.users style={{ width: 20, height: 20 }} /></span><b>{alunos.filter((a) => a.financeiro).length}</b><span>planos ativos</span></div>
      </div>

      <div className="pcard">
        <h3>Nota fiscal de serviço</h3>
        <p style={{ fontSize: 13.5, color: "var(--gray)", fontWeight: 600, marginBottom: 12 }}>
          A cada parcela paga, a NFS-e é emitida automaticamente. A Asaas exige o
          código do serviço municipal em toda nota e não o fornece pela API, então
          ele precisa ficar aqui — peça ao seu contador o código da prefeitura de
          Itajaí e a alíquota de ISS.
        </p>
        <div className="grid2">
          <Field label="Código do serviço municipal">
            <input className="in" value={fiscal.codigoServico} placeholder="Ex.: 8.02"
              onChange={(e) => setFiscal({ ...fiscal, codigoServico: e.target.value })} />
          </Field>
          <Field label="Alíquota de ISS (%)">
            <input className="in" inputMode="decimal" value={fiscal.aliquotaIss} placeholder="Ex.: 5"
              onChange={(e) => setFiscal({ ...fiscal, aliquotaIss: e.target.value })} />
          </Field>
        </div>
        <Field label="Descrição do serviço">
          <input className="in" value={fiscal.nomeServico} placeholder="Ex.: Instrução e treinamento"
            onChange={(e) => setFiscal({ ...fiscal, nomeServico: e.target.value })} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn btn-lima btn-sm" onClick={salvarFiscal} disabled={!fiscalMudou}>Salvar dados fiscais</button>
        </div>
      </div>

      {ordenados.length === 0 && <Empty icon="users" text="Cadastre alunos para configurar os planos de pagamento." />}
      {ordenados.map((a) => {
        const fin = a.financeiro;
        const pagas = fin ? fin.parcelas.filter((p) => p.status === "paga").length : 0;
        const prox = fin ? proximaParcela(fin) : null;
        const temAtraso = fin && fin.parcelas.some(parcelaAtrasada);
        const aberto = detalhe === a.id;
        return (
          <div className="pcard" key={a.id} style={temAtraso ? { borderColor: "var(--warm)" } : {}}>
            <div className="trow" style={{ border: "none", padding: 0 }}>
              <Avt nome={a.nome} tone={a.ativo ? "" : "off"} />
              <span className="ttx">
                <b>{a.nome}</b>
                <span>
                  {fin
                    ? fmtMoney(fin.valorTotal) + " em " + fin.parcelas.length + "x • " + pagas + "/" + fin.parcelas.length + " pagas"
                    : "Sem plano de pagamento"}
                </span>
              </span>
              {fin && prox && <Chip tone={statusParcela(prox).cls}>{statusParcela(prox).label} • {fmtDia(prox.vencimento)}</Chip>}
              {fin && !prox && <Chip tone="lima">Quitado 🎉</Chip>}
              {fin ? (
                <button className="btn btn-line btn-xs" onClick={() => setDetalhe(aberto ? null : a.id)}>
                  {aberto ? "Fechar" : "Parcelas"}
                </button>
              ) : (
                <button className="btn btn-lima btn-sm" onClick={() => setPlano({ aluno: a, valor: "", parcelas: 6, primeiro: "" })}>
                  Configurar plano
                </button>
              )}
            </div>
            {fin && aberto && (
              <div className="stack" style={{ gap: 8, marginTop: 16 }}>
                {[...fin.parcelas].sort((x, y) => x.n - y.n).map((p) => {
                  const st = statusParcela(p);
                  const numeroWa = waNumero(a.whatsapp);
                  const waHref = (numeroWa ? "https://wa.me/" + numeroWa : "https://wa.me/")
                    + "?text=" + encodeURIComponent(msgCobranca(a, p, fin.parcelas.length));
                  const link = p.pix && p.pix.invoiceUrl;
                  const criando = gerando === a.id + ":" + p.n;
                  return (
                    <div className="parc" key={p.n}>
                      <b>{p.n}/{fin.parcelas.length}</b>
                      <span className="pval">{fmtMoney(p.valor)}</span>
                      <span className="pvenc">
                        vence {fmtDia(p.vencimento)}
                        {p.status === "paga" && p.pagaEm ? " • paga em " + fmtDia(p.pagaEm) : ""}
                      </span>
                      <Chip tone={st.cls}>{st.label}</Chip>
                      {p.status !== "paga" && (link ? (
                        <React.Fragment>
                          <a className="btn btn-xs btn-line" href={link} target="_blank" rel="noopener noreferrer" title="Abrir a página de pagamento">
                            <PIcons.link style={{ width: 14, height: 14 }} /> Cobrança
                          </a>
                          <button className="btn btn-xs btn-line" title="Copiar o link de pagamento"
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(link); toast("Link copiado!"); }
                              catch (e) { toast("Não foi possível copiar."); }
                            }}>Copiar link</button>
                        </React.Fragment>
                      ) : (
                        <button className="btn btn-xs btn-line" disabled={criando} onClick={() => gerarCobranca(a, p)}
                          title="Cria a cobrança na Asaas e gera o link de pagamento">
                          {criando ? "Gerando..." : "Gerar cobrança"}
                        </button>
                      ))}
                      {p.status !== "paga" && (
                        <a className="btn btn-xs" style={{ background: "#2bb24c", color: "#fff" }} href={waHref}
                          target="_blank" rel="noopener noreferrer"
                          title={numeroWa ? "Cobrar no WhatsApp" : "Sem WhatsApp no cadastro — você escolhe o contato"}>
                          <PIcons.wa style={{ width: 14, height: 14 }} /> Cobrar
                        </a>
                      )}
                      {p.status === "paga" && <NotaFiscalAdmin aluno={a} parcela={p} toast={toast} />}
                      <button className={"btn btn-xs " + (p.status === "paga" ? "btn-line" : "btn-lima")} onClick={() => togglePaga(a, p.n)}>
                        {p.status === "paga" ? "Desfazer" : "Marcar paga"}
                      </button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                  <button className="btn btn-line btn-xs" onClick={() => setPlano({ aluno: a, valor: (fin.valorTotal / 100).toFixed(2).replace(".", ","), parcelas: fin.parcelas.length, primeiro: fin.parcelas[0].vencimento })}>
                    Refazer plano
                  </button>
                  <button className="btn btn-line btn-xs" style={{ color: "#C64A35" }} onClick={() => removerPlano(a)}>Remover plano</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {plano && (
        <Modal title={"Plano de pagamento — " + plano.aluno.nome} onClose={() => setPlano(null)}>
          {plano.aluno.financeiro && (
            <p style={{ fontSize: 13, color: "#C64A35", fontWeight: 700 }}>
              Refazer o plano substitui todas as parcelas atuais e gera cobranças novas na Asaas.
            </p>
          )}
          <Field label="Valor total do curso (R$)">
            <input className="in" inputMode="decimal" value={plano.valor} placeholder="Ex.: 1200,00"
              onChange={(e) => setPlano({ ...plano, valor: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="Parcelas (PIX)">
              <select className="in" value={plano.parcelas} onChange={(e) => setPlano({ ...plano, parcelas: e.target.value })}>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
              </select>
            </Field>
            <Field label="Primeiro vencimento">
              <input className="in" type="date" value={plano.primeiro} onChange={(e) => setPlano({ ...plano, primeiro: e.target.value })} />
            </Field>
          </div>
          {(() => {
            const c = Math.round(parseFloat(String(plano.valor).replace(",", ".")) * 100);
            const n = parseInt(plano.parcelas, 10);
            return c > 0 && n >= 1
              ? <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--gray)", fontWeight: 700 }}>= {n}x de {fmtMoney(Math.floor(c / n))}{c % n ? " (última ajustada)" : ""}, todo dia {plano.primeiro ? +plano.primeiro.split("-")[2] : "…"}</p>
              : null;
          })()}
          <div className="modal-acts">
            <button className="btn btn-line btn-sm" onClick={() => setPlano(null)}>Cancelar</button>
            <button className="btn btn-lima btn-sm" onClick={salvarPlano}
              disabled={salvandoPlano || !plano.valor || !plano.primeiro || !(Math.round(parseFloat(String(plano.valor).replace(",", ".")) * 100) > 0)}>
              {salvandoPlano ? "Criando cobranças..." : "Salvar plano e gerar cobranças"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Equipe (somente admin) ---------- */
const PERM_LABELS = [
  ["modulos", "Módulos e apostilas"],
  ["avisos", "Avisos"],
  ["cronograma", "Cronograma"],
  ["links", "Links úteis"],
  ["alunos", "Alunas e alunos"],
  ["financeiro", "Financeiro"],
  ["turmas", "Turmas"],
  ["presenca", "Chamada das práticas"],
];

function PermChecks({ valor, onChange, disabled }) {
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 14, opacity: disabled ? 0.45 : 1 }}>
      <span className="lbl" style={{ marginBottom: 0 }}>Pode gerenciar</span>
      {PERM_LABELS.map(([k, label]) => (
        <label key={k} style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 600, color: "var(--ink)", fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
          <input type="checkbox" disabled={disabled} checked={!!valor[k]}
            onChange={(e) => onChange({ ...valor, [k]: e.target.checked })}
            style={{ width: 17, height: 17, accentColor: "var(--lima-700)" }} />
          {label}
        </label>
      ))}
    </div>
  );
}

function AdmEquipe({ meuUid, staff, toast }) {
  const [editando, setEditando] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const [linkCriado, setLinkCriado] = React.useState(null);
  // Admins primeiro; dentro de cada grupo, ordem alfabética.
  const ordenados = [...staff].sort((a, b) =>
    (b.admin ? 1 : 0) - (a.admin ? 1 : 0) || a.nome.localeCompare(b.nome));
  const vazio = {
    nome: "", email: "", senha: "", cargo: "Professor(a)", isAdmin: false,
    perms: { modulos: true, avisos: true, cronograma: true, links: false, alunos: false },
  };

  const salvar = async () => {
    const { id, nome, email, cargo, senha, isAdmin, perms } = editando;
    setSalvando(true);
    try {
      if (id) {
        // Papel e permissões passam pelo backend (mexem na claim do token).
        await fnSetStaffRole({ uid: id, nome: nome.trim(), cargo: cargo.trim(), isAdmin, perms });
        toast(editando.eraAdmin !== isAdmin
          ? "Papel atualizado — vale no próximo login da pessoa"
          : "Cadastro da equipe atualizado");
      } else {
        const res = await fnCreateStaff({
          nome: nome.trim(), email: email.trim(), senha: senha || "",
          cargo: cargo.trim(), isAdmin, perms,
        });
        if (res.data.linkSenha) {
          setLinkCriado({ nome: nome.trim(), email: email.trim().toLowerCase(), link: res.data.linkSenha });
        } else {
          toast("Acesso criado — envie e-mail e senha para a pessoa");
        }
      }
      setEditando(null);
    } catch (e) {
      toast(e.message || "Não foi possível salvar.");
    } finally { setSalvando(false); }
  };

  const toggleAtivo = async (s) => {
    try {
      await fnToggleStaffAtivo({ uid: s.id, ativo: s.ativo === false });
      toast(s.ativo !== false ? "Acesso de " + s.nome.split(" ")[0] + " desativado" : "Acesso reativado");
    } catch (e) { toast(e.message || "Não foi possível alterar o acesso."); }
  };

  const excluirMembro = async (s) => {
    if (!window.confirm("Excluir " + s.nome + " da equipe? A conta de acesso será removida.")) return;
    try { await fnDeleteStaff({ uid: s.id }); toast("Cadastro excluído"); }
    catch (e) { toast(e.message || "Não foi possível excluir."); }
  };

  const enviarReset = async (s) => {
    try { await sendPasswordResetEmail(auth, s.email); toast("Link de redefinição enviado para " + s.email); }
    catch (e) { toast("Não foi possível enviar o e-mail."); }
  };

  const resumoPerms = (s) => {
    if (s.admin) return "acesso total";
    const ativas = PERM_LABELS.filter(([k]) => s.perms && s.perms[k]).map(([, l]) => l);
    return ativas.length ? ativas.join(" • ") : "nenhuma seção liberada";
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-lima btn-sm" onClick={() => setEditando({ ...vazio })}>
          <PIcons.plus style={{ width: 16, height: 16 }} /> Novo membro da equipe
        </button>
      </div>
      {ordenados.map((s) => {
        const ativo = s.ativo !== false;
        const souEu = s.id === meuUid;
        return (
          <div className={"trow" + (ativo ? "" : " off")} key={s.id}>
            <Avt nome={s.nome} tone={ativo ? "navy" : "off"} />
            <span className="ttx">
              <b>
                {s.nome} {souEu && <Chip tone="soft">você</Chip>} {s.admin && <Chip tone="lima">Admin</Chip>}
              </b>
              <span>{s.email}</span>
            </span>
            <span className="tcol" style={{ width: 220 }}>
              <span className="tlbl">{s.cargo || "Equipe"}</span>
              <span className="tval" style={{ fontWeight: 600, color: "var(--gray)" }}>{resumoPerms(s)}</span>
            </span>
            {/* Ninguém se desativa ou se exclui sozinho — o painel ficaria sem dono. */}
            <label className="sw"
              title={souEu ? "Você não pode desativar o próprio acesso" : ativo ? "Desativar acesso" : "Ativar acesso"}
              style={souEu ? { opacity: 0.4, pointerEvents: "none" } : {}}>
              <input type="checkbox" checked={ativo} onChange={() => toggleAtivo(s)} />
              <span className="tr"></span>
            </label>
            <button className="iconbtn" title="Editar" onClick={() => setEditando({
              id: s.id, nome: s.nome, email: s.email, cargo: s.cargo || "",
              isAdmin: !!s.admin, eraAdmin: !!s.admin, souEu, perms: { ...(s.perms || {}) },
            })}>
              <PIcons.edit style={{ width: 16, height: 16 }} />
            </button>
            <button className="iconbtn danger" disabled={souEu} onClick={() => excluirMembro(s)}
              title={souEu ? "Você não pode excluir o próprio acesso" : "Excluir"}>
              <PIcons.trash style={{ width: 16, height: 16 }} />
            </button>
          </div>
        );
      })}
      {editando && (
        <Modal title={editando.id ? "Editar membro da equipe" : "Novo membro da equipe"} onClose={() => setEditando(null)}>
          <Field label="Nome completo">
            <input className="in" value={editando.nome} placeholder="Nome da pessoa"
              onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
          </Field>
          <Field label="Cargo">
            <input className="in" value={editando.cargo} placeholder="Ex.: Professor(a), Secretaria..."
              onChange={(e) => setEditando({ ...editando, cargo: e.target.value })} />
          </Field>
          {editando.id ? (
            <React.Fragment>
              <Field label="E-mail de acesso">
                <input className="in" type="email" value={editando.email} disabled />
              </Field>
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-line btn-xs" onClick={() => enviarReset(editando)}>
                  Enviar link de redefinição de senha
                </button>
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <Field label="E-mail de acesso">
                <input className="in" type="email" value={editando.email} placeholder="email@exemplo.com"
                  onChange={(e) => setEditando({ ...editando, email: e.target.value })} />
              </Field>
              <Field label="Senha inicial (opcional)">
                <input className="in" value={editando.senha} placeholder="Mínimo de 6 caracteres"
                  onChange={(e) => setEditando({ ...editando, senha: e.target.value })} />
              </Field>
              <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--gray)", fontWeight: 600 }}>
                Deixe em branco para gerar um link de primeiro acesso — você envia por WhatsApp ou e-mail e a pessoa cria a própria senha.
              </p>
            </React.Fragment>
          )}
          <label style={{
            display: "flex", gap: 10, alignItems: "center", marginTop: 16, fontWeight: 700,
            color: "var(--navy)", fontSize: 14.5,
            cursor: editando.souEu ? "default" : "pointer", opacity: editando.souEu ? 0.55 : 1,
          }}>
            <label className="sw" style={editando.souEu ? { pointerEvents: "none" } : {}}>
              <input type="checkbox" checked={editando.isAdmin} disabled={!!editando.souEu}
                onChange={(e) => setEditando({ ...editando, isAdmin: e.target.checked })} />
              <span className="tr"></span>
            </label>
            Acesso total (admin) — vê tudo, inclusive a Equipe
          </label>
          {editando.souEu && !editando.isAdmin && (
            <p style={{ marginTop: 6, fontSize: 12.5, color: "var(--gray)", fontWeight: 600 }}>
              Seu papel real é admin — salve para ressincronizar o cadastro.
            </p>
          )}
          {editando.souEu && editando.isAdmin && (
            <p style={{ marginTop: 6, fontSize: 12.5, color: "var(--gray)", fontWeight: 600 }}>
              Você não pode remover o próprio acesso de admin.
            </p>
          )}
          {editando.id && editando.eraAdmin !== editando.isAdmin && (
            <p style={{ marginTop: 8, fontSize: 12.5, color: "#C64A35", fontWeight: 700 }}>
              A mudança de papel vale a partir do próximo login da pessoa.
            </p>
          )}
          {editando.isAdmin ? (
            <p style={{ marginTop: 14, fontSize: 13, color: "var(--gray)", fontWeight: 600 }}>
              Admin tem acesso total a todas as seções — não precisa de permissões individuais.
            </p>
          ) : (
            <PermChecks valor={editando.perms} onChange={(perms) => setEditando({ ...editando, perms })} />
          )}
          <div className="modal-acts">
            <button className="btn btn-line btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn btn-lima btn-sm" onClick={salvar}
              disabled={salvando || !editando.nome.trim()
                || (!editando.id && (!editando.email.trim()
                  || ((editando.senha || "").length > 0 && (editando.senha || "").length < 6)))}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </Modal>
      )}
      {linkCriado && <LinkAcessoModal info={linkCriado} onClose={() => setLinkCriado(null)} toast={toast} />}
    </div>
  );
}
