import React from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./lib/firebase.js";
import { useCol, useDoc, atualizar } from "./lib/db.js";
import { PIcons } from "./components/shared.jsx";
import Login from "./components/Login.jsx";
import AlunoPortal from "./components/AlunoPortal.jsx";
import AdminPortal from "./components/AdminPortal.jsx";

// Usado só enquanto config/geral não carregou (ou num projeto recém-semeado).
const CONFIG_PADRAO = {
  curso: "Auxiliar Veterinário",
  turma: "Turma 2026.1",
  cargaHoraria: "200 horas",
  coordenacao: "Coordenação CCVET",
  whatsapp: "https://wa.me/5547996551654",
};

function Gate({ icon, title, children, statico }) {
  const Ic = PIcons[icon] || PIcons.paw;
  return (
    <div className={"gate" + (statico ? " static" : "")}>
      <div className="gcard">
        <span className="gic"><Ic style={{ width: 34, height: 34 }} /></span>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

// Descobre o papel (claim) do usuário. Logo após o cadastro, a claim é
// aplicada pelo backend com um pequeno atraso — força a renovação do token
// algumas vezes antes de concluir que a conta não tem acesso.
async function resolveRole(user) {
  let tk = await user.getIdTokenResult();
  if (tk.claims.role) return tk.claims.role;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    tk = await user.getIdTokenResult(true);
    if (tk.claims.role) return tk.claims.role;
  }
  return null;
}

export default function App() {
  const [user, setUser] = React.useState(undefined); // undefined = carregando
  const [role, setRole] = React.useState(null);
  const [resolvendo, setResolvendo] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState(null);
  const tRef = React.useRef(null);

  const toast = (m) => {
    setToastMsg(m);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToastMsg(null), 2600);
  };

  React.useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setRole(null);
      if (u) {
        setResolvendo(true);
        const r = await resolveRole(u);
        setRole(r || "none");
        setResolvendo(false);
      }
    });
  }, []);

  const logout = () => signOut(auth);

  let view;
  if (user === undefined) {
    view = <Gate icon="paw"><p>Carregando o portal...</p></Gate>;
  } else if (!user) {
    view = <Login />;
  } else if (resolvendo) {
    view = <Gate icon="paw"><p>Preparando seu acesso...</p></Gate>;
  } else if (role === "admin" || role === "staff") {
    view = <AdminRoot user={user} role={role} onLogout={logout} toast={toast} />;
  } else if (role === "aluno") {
    view = <AlunoRoot user={user} onLogout={logout} toast={toast} />;
  } else {
    view = (
      <Gate icon="lock" title="Conta sem acesso" statico>
        <p>Esta conta ainda não foi liberada pela coordenação. Se você é aluna/o, fale com a coordenação pelo WhatsApp.</p>
        <button className="btn btn-navy btn-sm" onClick={logout}>Voltar ao login</button>
      </Gate>
    );
  }

  return (
    <React.Fragment>
      {view}
      {toastMsg && (
        <div className="toast">
          <span className="tc"><PIcons.check style={{ width: 13, height: 13 }} /></span>
          {toastMsg}
        </div>
      )}
    </React.Fragment>
  );
}

function AdminRoot({ user, role, onLogout, toast }) {
  const isAdmin = role === "admin";
  const [preview, setPreview] = React.useState(false);
  const config = useDoc("config/geral");
  const staffMe = useDoc("staff/" + user.uid);

  // Staff só assina as coleções que tem permissão de ver (as regras bloqueiam o resto).
  const carregouPerfil = staffMe !== undefined;
  const perms = isAdmin
    ? { modulos: true, avisos: true, cronograma: true, links: true, alunos: true,
        financeiro: true, turmas: true, presenca: true }
    : (staffMe && staffMe.perms) || {};
  const podeAlunos = isAdmin || perms.alunos === true || perms.financeiro === true;

  const modulos = useCol("modulos", "ordem");
  const alunos = useCol("alunos", undefined, carregouPerfil && podeAlunos);
  const avisos = useCol("avisos");
  const cronograma = useCol("cronograma");
  const links = useCol("links");
  const logs = useCol("logs", undefined, carregouPerfil && podeAlunos);
  const staff = useCol("staff", undefined, isAdmin);
  const turmas = useCol("turmas");
  // Chamada: lida por quem decide o certificado, escrita por quem tem `presenca`.
  const podePresenca = isAdmin || perms.presenca === true || perms.alunos === true || perms.turmas === true;
  const presencas = useCol("presencas", undefined, carregouPerfil && podePresenca);

  if (config === undefined || staffMe === undefined
    || [modulos, alunos, avisos, cronograma, links, logs, staff, turmas, presencas].some((x) => x === null)) {
    return <Gate icon="paw"><p>Carregando o painel...</p></Gate>;
  }

  if (!isAdmin && staffMe === null) {
    return (
      <Gate icon="lock" title="Cadastro não encontrado" statico>
        <p>Não encontramos seu cadastro na equipe. Fale com a coordenação.</p>
        <button className="btn btn-navy btn-sm" onClick={onLogout}>Voltar ao login</button>
      </Gate>
    );
  }

  // Pré-visualização do portal do aluno, sem sair da sessão de admin/equipe.
  // Mostra os dados REAIS de um aluno escolhido — é a única forma de ver o
  // que ele vê (plano de pagamento, progresso, certificado). Nada é gravado:
  // o modo `preview` bloqueia pagamento, progresso e registro de download.
  if (preview) {
    const nomeAdmin = (staffMe && staffMe.nome) || user.displayName || "Coordenação";
    const ordenados = [...alunos].sort((a, b) => a.nome.localeCompare(b.nome));
    const alunoReal = ordenados.find((a) => a.id === preview) || ordenados[0] || null;

    // Sem nenhum aluno cadastrado (ou sem permissão para lê-los), cai num
    // aluno de exemplo só para a coordenação conhecer o layout.
    const turmaFallback = turmas.find((t) => t.status === "ativa") || turmas[0] || null;
    const me = alunoReal || {
      id: "__exemplo__", nome: nomeAdmin, progresso: [], ativo: true,
      turmaId: turmaFallback && turmaFallback.id, acessoConteudo: true,
      certificado: { liberado: false, liberadoEm: null, liberadoPor: null },
    };
    const turmaDoAluno = turmas.find((t) => t.id === me.turmaId) || turmaFallback;

    return (
      <AlunoPortal
        preview
        previewAlunos={ordenados}
        previewUid={alunoReal && alunoReal.id}
        previewExemplo={!alunoReal}
        onTrocarPreview={(uid) => setPreview(uid)}
        onExitPreview={() => setPreview(false)}
        me={me}
        turma={turmaDoAluno}
        config={config || CONFIG_PADRAO}
        modulos={modulos}
        avisos={avisos}
        cronograma={cronograma}
        links={links}
        onLogout={onLogout}
        toast={toast}
        comentarista={{
          uid: user.uid,
          nome: nomeAdmin,
          papel: "equipe",
          podeModerar: isAdmin || perms.modulos === true,
        }}
      />
    );
  }

  return (
    <AdminPortal
      me={user}
      isAdmin={isAdmin}
      perms={perms}
      staffMe={staffMe || { nome: user.displayName || "Coordenação", cargo: "Coordenação" }}
      staff={staff}
      config={config || CONFIG_PADRAO}
      turmas={turmas}
      presencas={presencas}
      modulos={modulos}
      alunos={alunos}
      avisos={avisos}
      cronograma={cronograma}
      links={links}
      logs={logs}
      onLogout={onLogout}
      toast={toast}
      onPreview={() => setPreview(true)}
    />
  );
}

function AlunoRoot({ user, onLogout, toast }) {
  const config = useDoc("config/geral");
  const me = useDoc("alunos/" + user.uid);
  // Turma encerrada bloqueia os módulos nas regras; nem assinamos a coleção
  // para não gerar erro de permissão no console.
  const podeConteudo = me ? me.acessoConteudo !== false : false;
  const modulos = useCol("modulos", "ordem", podeConteudo);
  const avisos = useCol("avisos");
  const cronograma = useCol("cronograma");
  const links = useCol("links");
  const turmas = useCol("turmas");

  // Registra o acesso uma vez por sessão.
  React.useEffect(() => {
    atualizar("alunos/" + user.uid, { ultimoAcesso: new Date().toISOString() }).catch(() => {});
  }, [user.uid]);

  if (me === undefined || config === undefined) {
    return <Gate icon="paw"><p>Carregando seus dados...</p></Gate>;
  }
  if (me === null) {
    return (
      <Gate icon="lock" title="Cadastro não encontrado" statico>
        <p>Não encontramos seu cadastro de aluna/o. Fale com a coordenação.</p>
        <button className="btn btn-navy btn-sm" onClick={onLogout}>Voltar ao login</button>
      </Gate>
    );
  }
  if (me.ativo === false) {
    return (
      <Gate icon="lock" title="Acesso desativado" statico>
        <p>Seu acesso está desativado. Fale com a coordenação para reativá-lo.</p>
        <button className="btn btn-navy btn-sm" onClick={onLogout}>Voltar ao login</button>
      </Gate>
    );
  }
  if ([modulos, avisos, cronograma, links, turmas].some((x) => x === null)) {
    return <Gate icon="paw"><p>Carregando seus dados...</p></Gate>;
  }

  return (
    <AlunoPortal
      me={me}
      turma={turmas.find((t) => t.id === me.turmaId) || null}
      config={config || CONFIG_PADRAO}
      modulos={modulos}
      avisos={avisos}
      cronograma={cronograma}
      links={links}
      onLogout={onLogout}
      toast={toast}
      comentarista={{ uid: user.uid, nome: me.nome, papel: "aluno", podeModerar: false }}
    />
  );
}
