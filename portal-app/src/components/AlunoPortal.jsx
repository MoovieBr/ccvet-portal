/* Área do ALUNO — dados em tempo real do Firestore */
import React from "react";
import "@mux/mux-player";
import { PIcons, Chip, Avt, Bar, Ring, Empty, Field, Modal, TIPO_EVENTO } from "./shared.jsx";
import {
  atualizar, excluir, urlApostila, registrarLog, useColFiltrada, comentar,
  fnPagarParcela, fnConferirPagamento, fnConferirNota
} from "../lib/db.js";
import {
  fmtDia, fmtDataLonga, fmtMesAno, fmtDataHora,
  fmtMoney, diasAte, parcelaAtrasada, proximaParcela
} from "../lib/format.js";

export default function AlunoPortal({ me, turma, config, modulos, avisos, cronograma, links, onLogout, toast, preview, onExitPreview, comentarista, previewAlunos, previewUid, previewExemplo, onTrocarPreview }) {
  const [tab, setTab] = React.useState("inicio");
  const [aulaId, setAulaId] = React.useState(null);
  const [pagando, setPagando] = React.useState(null); // parcela sendo paga via PIX
  const aula = aulaId ? modulos.find((m) => m.id === aulaId) : null;
  // Na pré-visualização o progresso é só local (nada é gravado no banco).
  const [previewProg, setPreviewProg] = React.useState([]);
  const progFonte = preview ? previewProg : (me.progresso || []);
  const prog = progFonte.filter((id) => modulos.some((m) => m.id === id));
  const pct = modulos.length ? Math.round((prog.length / modulos.length) * 100) : 0;
  const completo = pct === 100 && modulos.length > 0;
  const primeiroNome = me.nome.split(" ")[0];
  // Nome da turma vem da coleção `turmas`; config.turma é o legado.
  const nomeTurma = (turma && turma.nome) || config.turma || "";
  // Turma encerrada: aulas e apostilas bloqueadas (as regras também barram
  // no servidor); certificado e financeiro seguem disponíveis.
  const conteudoBloqueado = me.acessoConteudo === false;
  // O certificado é liberado à mão pela coordenação, depois das práticas.
  const certificadoLiberado = !!(me.certificado && me.certificado.liberado);

  const toggleDone = async (mid) => {
    const done = prog.includes(mid);
    const novo = done ? progFonte.filter((x) => x !== mid) : [...progFonte, mid];
    if (preview) {
      setPreviewProg(novo);
      return;
    }
    try {
      await atualizar("alunos/" + me.id, { progresso: novo });
      if (!done) registrarLog(me.id, mid, "conclusao");
      toast(done ? "Módulo desmarcado" : "Boa! Módulo marcado como concluído 🐾");
    } catch (e) {
      toast("Não foi possível salvar. Tente de novo.");
    }
  };

  const baixar = async (m) => {
    try {
      const url = await urlApostila(m.apostila.path);
      window.open(url, "_blank", "noopener");
      if (!preview) registrarLog(me.id, m.id, "download");
      toast(preview ? "Pré-visualização: apostila aberta" : "Download da apostila iniciado");
    } catch (e) {
      toast("Não foi possível baixar a apostila. Tente de novo.");
    }
  };

  const eventosOrd = [...cronograma].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const avisosOrd = [...avisos].sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0) || b.data.localeCompare(a.data));

  const TITULOS = {
    inicio: ["Olá, " + primeiroNome + "! 🐾", "Que bom te ver por aqui. Continue de onde parou."],
    modulos: ["Módulos e apostilas", conteudoBloqueado
      ? "O conteúdo fica disponível enquanto a turma está em andamento."
      : "Baixe o material de cada módulo e marque o que você já concluiu."],
    cronograma: ["Cronograma", "Aulas ao vivo, práticas presenciais e provas da " + nomeTurma + "."],
    avisos: ["Avisos da turma", "Comunicados da coordenação — os fixados ficam sempre no topo."],
    links: ["Links úteis", "Acessos rápidos da turma."],
    financeiro: ["Financeiro", "Suas parcelas, os links de pagamento e as notas fiscais."],
    certificado: ["Certificado", certificadoLiberado
      ? "Seu certificado de conclusão está pronto."
      : "A coordenação libera o certificado após as aulas presenciais e práticas."],
  };

  const NAV = [
    ["inicio", "Início", PIcons.home],
    ["modulos", "Módulos e apostilas", PIcons.book],
    ["cronograma", "Cronograma", PIcons.cal],
    ["avisos", "Avisos", PIcons.bell],
    ["links", "Links úteis", PIcons.link],
    ...(me.financeiro ? [["financeiro", "Financeiro", PIcons.money]] : []),
    ["certificado", "Certificado", PIcons.award],
  ];

  // Parcela que merece destaque no início: vence hoje/amanhã ou está atrasada.
  const proxParc = proximaParcela(me.financeiro);
  const alertaParc = proxParc && (parcelaAtrasada(proxParc) || diasAte(proxParc.vencimento) <= 1) ? proxParc : null;

  return (
    <div className={"app" + (preview ? " com-preview" : "")}>
      {preview && (
        <div className="preview-bar">
          <span className="pv-tag"><PIcons.eye style={{ width: 15, height: 15 }} /> Vendo como<span className="pv-extra"> aluno</span></span>
          {previewAlunos && previewAlunos.length > 0 ? (
            <select className="pv-sel" value={previewUid || ""}
              onChange={(e) => onTrocarPreview && onTrocarPreview(e.target.value)}>
              {previewAlunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          ) : (
            <span className="pv-txt">
              {previewExemplo ? "Nenhum aluno cadastrado — mostrando um exemplo." : ""}
            </span>
          )}
          {/* Comentar continua liberado (sai em nome da coordenação) — por isso
              a promessa é sobre os dados do aluno, não sobre a tela inteira. */}
          <span className="pv-txt">Dados reais — nada que você fizer aqui altera o cadastro dele.</span>
          <button className="btn btn-navy btn-xs" onClick={onExitPreview}>
            <PIcons.out style={{ width: 15, height: 15 }} /> Voltar ao painel
          </button>
        </div>
      )}
      <aside className="side s-aluno">
        <div className="auth-brand">
          <span className="mk"><PIcons.paw style={{ width: 24, height: 24 }} /></span>
          <span>
            <span className="nm">CC<b>VET</b></span>
            <span className="sb">Portal do Aluno</span>
          </span>
        </div>
        <span className="role-tag">
          <Chip tone={conteudoBloqueado ? "warm" : "soft"}>
            {nomeTurma}{conteudoBloqueado ? " • encerrada" : ""}
          </Chip>
        </span>
        {NAV.map(([id, label, Ic]) => (
          <button key={id} className={"sitem" + (tab === id && !aula ? " on" : "")}
            onClick={() => { setTab(id); setAulaId(null); }}>
            <Ic /> <span className="sl">{label}</span>
          </button>
        ))}
        <div className="side-foot">
          <Avt nome={me.nome} />
          <span className="who">
            <b>{me.nome}</b>
            <span>{conteudoBloqueado ? "Turma encerrada" : pct + "% concluído"}</span>
          </span>
          <button className="iconbtn" onClick={preview ? onExitPreview : onLogout}
            title={preview ? "Voltar ao painel" : "Sair"}>
            <PIcons.out style={{ width: 17, height: 17 }} />
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-in">
          {aula ? (
            <ModuloPage
              m={aula}
              numero={modulos.indexOf(aula) + 1}
              done={prog.includes(aula.id)}
              onVoltar={() => setAulaId(null)}
              onToggleDone={() => toggleDone(aula.id)}
              onBaixar={() => baixar(aula)}
              comentarista={comentarista}
              preview={preview}
              toast={toast}
            />
          ) : (
          <React.Fragment>
          <div className="topbar">
            <div>
              <h1>{TITULOS[tab][0]}</h1>
              <p className="sub">{TITULOS[tab][1]}</p>
            </div>
            {config.whatsapp && (
              <a className="btn btn-line btn-sm" href={config.whatsapp} target="_blank" rel="noopener noreferrer">
                <PIcons.wa style={{ width: 17, height: 17 }} /> Falar com a coordenação
              </a>
            )}
          </div>

          {tab === "inicio" && (
            <div className="stack">
              {alertaParc && (
                <div className="fin-banner">
                  <span className="fic"><PIcons.money style={{ width: 22, height: 22 }} /></span>
                  <div className="ftx">
                    <b>
                      {parcelaAtrasada(alertaParc)
                        ? "Sua parcela " + alertaParc.n + " está em atraso"
                        : "Sua parcela " + alertaParc.n + " vence " + (diasAte(alertaParc.vencimento) === 0 ? "hoje" : "amanhã")}
                    </b>
                    <span>{fmtMoney(alertaParc.valor)} • vencimento {fmtDia(alertaParc.vencimento)}</span>
                  </div>
                  <button className="btn btn-navy btn-xs" onClick={() => setTab("financeiro")}>Ver parcelas</button>
                </div>
              )}
              <div className="grid2">
                <div className="pcard" style={{ display: "flex", gap: 22, alignItems: "center" }}>
                  <Ring pct={conteudoBloqueado ? 100 : pct} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: 6 }}>{conteudoBloqueado ? "Curso concluído" : "Seu progresso"}</h3>
                    <p style={{ fontSize: 14, color: "var(--gray)", fontWeight: 600 }}>
                      {conteudoBloqueado
                        ? "A " + nomeTurma + " foi encerrada. Seu certificado e o histórico de pagamentos continuam disponíveis."
                        : <React.Fragment>Você concluiu <b style={{ color: "var(--navy)" }}>{prog.length} de {modulos.length}</b> módulos do curso.</React.Fragment>}
                    </p>
                    <button className="btn btn-lima btn-sm" style={{ marginTop: 14 }}
                      onClick={() => setTab(conteudoBloqueado || certificadoLiberado ? "certificado" : "modulos")}>
                      {conteudoBloqueado || certificadoLiberado ? "Ver certificado" : "Continuar estudando"}
                    </button>
                  </div>
                </div>
                <div className="pcard">
                  <h3>Próximas datas</h3>
                  <div className="stack" style={{ gap: 10 }}>
                    {eventosOrd.length === 0 && (
                      <p style={{ fontSize: 13.5, color: "var(--gray)", fontWeight: 600 }}>Nenhuma data agendada ainda.</p>
                    )}
                    {eventosOrd.slice(0, 2).map((ev) => <Evento key={ev.id} ev={ev} />)}
                  </div>
                  <button className="btn btn-line btn-xs" style={{ marginTop: 14 }} onClick={() => setTab("cronograma")}>Ver cronograma completo</button>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 18, marginBottom: 12 }}>Avisos recentes</h3>
                <div className="stack" style={{ gap: 12 }}>
                  {avisosOrd.length === 0 && <Empty icon="bell" text="Nenhum aviso por enquanto." />}
                  {avisosOrd.slice(0, 2).map((av) => <Aviso key={av.id} av={av} />)}
                </div>
                {avisosOrd.length > 0 && (
                  <button className="btn btn-line btn-xs" style={{ marginTop: 14 }} onClick={() => setTab("avisos")}>Todos os avisos</button>
                )}
              </div>
            </div>
          )}

          {tab === "modulos" && (
            <div className="stack" style={{ gap: 14 }}>
              {conteudoBloqueado ? (
                <div className="pcard locked">
                  <span className="lic"><PIcons.lock style={{ width: 30, height: 30 }} /></span>
                  <h3>A {nomeTurma} foi encerrada</h3>
                  <p>
                    As aulas e apostilas não ficam mais disponíveis, mas o seu certificado
                    e o histórico de pagamentos continuam aqui. Precisa de algo do material?
                    Fale com a coordenação.
                  </p>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn btn-navy btn-sm" onClick={() => setTab("certificado")}>Ver certificado</button>
                  </div>
                </div>
              ) : modulos.length === 0 && <Empty icon="book" text="Os módulos do curso aparecem aqui assim que forem publicados." />}
              {modulos.map((m, i) => {
                const done = prog.includes(m.id);
                return (
                  <div className="mrow clicavel" key={m.id} onClick={() => setAulaId(m.id)}>
                    <span className={"mnum" + (done ? " done" : "")}>
                      {done ? <PIcons.check style={{ width: 20, height: 20 }} /> : i + 1}
                    </span>
                    <span className="mtx">
                      <b>{m.nome}</b>
                      <span>{m.desc}</span>
                      <span className="mfile">
                        {m.video && m.video.playbackId && (
                          <Chip tone="navy">▶ Videoaula{m.video.duracao ? " • " + fmtDuracao(m.video.duracao) : ""}</Chip>
                        )}
                        <PIcons.file style={{ width: 14, height: 14 }} />
                        {m.apostila ? m.apostila.arquivo + " • " + m.apostila.tamanho : "Apostila ainda não publicada"}
                      </span>
                    </span>
                    <span className="macts" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-lima btn-sm" onClick={() => setAulaId(m.id)}>Abrir aula</button>
                      <button className={"btn btn-sm " + (done ? "btn-lima" : "btn-line")} onClick={() => toggleDone(m.id)}>
                        {done ? "Concluído" : "Marcar concluído"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "cronograma" && (
            <div>
              <Agenda eventos={eventosOrd} />
            </div>
          )}

          {tab === "avisos" && (
            <div className="stack" style={{ gap: 12 }}>
              {avisosOrd.length === 0 && <Empty icon="bell" text="Nenhum aviso por enquanto." />}
              {avisosOrd.map((av) => <Aviso key={av.id} av={av} />)}
            </div>
          )}

          {tab === "links" && (
            <div className="stack" style={{ gap: 12 }}>
              {links.length === 0 && <Empty icon="link" text="Nenhum link cadastrado ainda." />}
              {links.map((l) => {
                const Ic = l.tipo === "whatsapp" ? PIcons.wa : l.tipo === "instagram" ? PIcons.ig : PIcons.link;
                return (
                  <a className="linkcard" key={l.id} href={l.url} target="_blank" rel="noopener noreferrer">
                    <span className="lic"><Ic style={{ width: 22, height: 22 }} /></span>
                    <span className="ltx"><b>{l.titulo}</b><span>{l.desc}</span></span>
                    <PIcons.link style={{ width: 16, height: 16, color: "var(--gray)" }} />
                  </a>
                );
              })}
            </div>
          )}

          {tab === "financeiro" && me.financeiro && (
            <div className="stack">
              <div className="pcard">
                <h3>Suas parcelas — {fmtMoney(me.financeiro.valorTotal)} em {me.financeiro.parcelas.length}x</h3>
                <div className="stack" style={{ gap: 8 }}>
                  {[...me.financeiro.parcelas].sort((a, b) => a.n - b.n).map((p) => {
                    const atras = parcelaAtrasada(p);
                    const d = diasAte(p.vencimento);
                    const tone = p.status === "paga" ? "lima" : atras || d <= 1 ? "warm" : "soft";
                    const label = p.status === "paga" ? "Paga" : atras ? "Atrasada"
                      : d === 0 ? "Vence hoje" : d === 1 ? "Vence amanhã" : "Em aberto";
                    return (
                      <div className="parc" key={p.n}>
                        <b>{p.n}/{me.financeiro.parcelas.length}</b>
                        <span className="pval">{fmtMoney(p.valor)}</span>
                        <span className="pvenc">
                          vence {fmtDia(p.vencimento)}
                          {p.status === "paga" && p.pagaEm ? " • paga em " + fmtDia(p.pagaEm) : ""}
                        </span>
                        <Chip tone={tone}>{label}</Chip>
                        {!preview && p.status !== "paga" && (
                          <React.Fragment>
                            <button className="btn btn-xs btn-navy" onClick={() => setPagando(p)}>Pagar com PIX</button>
                            {/* Página da Asaas: PIX, boleto ou cartão. */}
                            {p.pix && p.pix.invoiceUrl && (
                              <a className="btn btn-xs btn-line" href={p.pix.invoiceUrl} target="_blank" rel="noopener noreferrer"
                                title="Abrir a página de pagamento (PIX, boleto ou cartão)">
                                <PIcons.link style={{ width: 14, height: 14 }} /> Outras formas
                              </a>
                            )}
                          </React.Fragment>
                        )}
                        {p.status === "paga" && <NotaFiscalAluno parcela={p} preview={preview} toast={toast} />}
                      </div>
                    );
                  })}
                </div>
                <p style={{ marginTop: 14, fontSize: 13, color: "var(--gray)", fontWeight: 600 }}>
                  Pagou e ainda aparece em aberto? A coordenação confirma o pagamento em até 1 dia útil — qualquer dúvida, chame no WhatsApp.
                </p>
              </div>
            </div>
          )}

          {tab === "certificado" && (
            certificadoLiberado ? (
              <div className="stack">
                <div className="cert-print">
                  <div className="cert">
                    <PIcons.paw className="cpaw" />
                    <span className="cbrand">
                      <span className="mk" style={{ width: 40, height: 40, borderRadius: "50% 50% 50% 12px", background: "var(--navy)", display: "grid", placeItems: "center", color: "var(--lima)", transform: "rotate(-6deg)" }}>
                        <PIcons.paw style={{ width: 22, height: 22 }} />
                      </span>
                      <span style={{ fontFamily: "Roag,'Baloo 2',sans-serif", fontWeight: 900, fontSize: 22, color: "var(--navy)" }}>CC<b style={{ color: "var(--lima-700)" }}>VET</b></span>
                    </span>
                    <div className="ctag">Certificado de conclusão</div>
                    <h2>{config.curso}</h2>
                    <div className="cname">{me.nome}</div>
                    <p className="ctext">
                      concluiu com êxito o curso de {config.curso} — {nomeTurma}, com carga horária de {config.cargaHoraria},
                      incluindo práticas presenciais e estágio supervisionado. Itajaí/SC,{" "}
                      {/* Data da liberação: o documento não pode mudar a cada visita. */}
                      {fmtDataLonga(((me.certificado && me.certificado.liberadoEm) || new Date().toISOString().slice(0, 10)) + "T12:00:00")}.
                    </p>
                    <span className="csign">{config.coordenacao}<span>Coordenação — CCVET Capacitação Veterinária</span></span>
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <button className="btn btn-lima" onClick={() => window.print()}>
                    <PIcons.dl style={{ width: 18, height: 18 }} /> Baixar certificado (PDF)
                  </button>
                </div>
              </div>
            ) : (
              <div className="pcard locked">
                <span className="lic"><PIcons.lock style={{ width: 30, height: 30 }} /></span>
                <h3>Seu certificado ainda não foi liberado</h3>
                <p>
                  O certificado de {config.cargaHoraria} é liberado pela coordenação depois que
                  você conclui os módulos <b>e</b> participa das aulas presenciais e práticas.
                  Qualquer dúvida sobre a sua situação, fale com a coordenação.
                </p>
                {!conteudoBloqueado && modulos.length > 0 && (
                  <React.Fragment>
                    <Bar pct={pct} />
                    <span className="pct">
                      {prog.length} de {modulos.length} módulos • {pct}%
                      {completo ? " — parte online concluída 🎉" : ""}
                    </span>
                    {!completo && (
                      <div style={{ marginTop: 18 }}>
                        <button className="btn btn-navy btn-sm" onClick={() => setTab("modulos")}>Ir para os módulos</button>
                      </div>
                    )}
                  </React.Fragment>
                )}
              </div>
            )
          )}
          </React.Fragment>
          )}
        </div>
      </main>
      {pagando && (
        <PixModal
          parcela={pagando}
          total={me.financeiro ? me.financeiro.parcelas.length : 0}
          onClose={() => setPagando(null)}
          toast={toast}
        />
      )}
    </div>
  );
}

/* ---------- nota fiscal da parcela paga ---------- */
function NotaFiscalAluno({ parcela, preview, toast }) {
  const nf = parcela.nf;
  const [buscando, setBuscando] = React.useState(false);

  // Nota emitida mas ainda sem link (autorização pendente): tenta buscar o PDF.
  React.useEffect(() => {
    if (preview || !nf || nf.pdfUrl || !nf.invoiceId || nf.status === "erro") return;
    let vivo = true;
    setBuscando(true);
    fnConferirNota({ parcelaN: parcela.n })
      .catch(() => {})
      .finally(() => { if (vivo) setBuscando(false); });
    return () => { vivo = false; };
  }, [parcela.n, nf && nf.pdfUrl, nf && nf.invoiceId]);

  if (!nf) return null;
  if (nf.pdfUrl) {
    return (
      <a className="btn btn-xs btn-line" href={nf.pdfUrl} target="_blank" rel="noopener noreferrer"
        title={nf.numero ? "Nota fiscal nº " + nf.numero : "Baixar nota fiscal"}>
        <PIcons.file style={{ width: 14, height: 14 }} /> Nota fiscal
      </a>
    );
  }
  if (nf.invoiceId && nf.status !== "erro") {
    return <span className="pvenc" style={{ opacity: 0.8 }}>{buscando ? "Emitindo nota…" : "Nota em emissão"}</span>;
  }
  return null;
}

/* ---------- pagamento de parcela via PIX (Asaas) ---------- */
function PixModal({ parcela, total, onClose, toast }) {
  const [estado, setEstado] = React.useState("gerando"); // gerando | aberto | pago | erro
  const [pix, setPix] = React.useState(null);
  const [erro, setErro] = React.useState("");

  React.useEffect(() => {
    let vivo = true;
    let timer;
    (async () => {
      try {
        const res = await fnPagarParcela({ parcelaN: parcela.n });
        if (!vivo) return;
        setPix(res.data);
        setEstado("aberto");
        const conferir = async () => {
          if (!vivo) return;
          try {
            const st = await fnConferirPagamento({ parcelaN: parcela.n });
            if (!vivo) return;
            if (st.data.status === "paga") { setEstado("pago"); return; }
            if (st.data.status === "expirado") {
              setEstado("erro");
              setErro("O código PIX expirou. Feche e clique em Pagar de novo para gerar outro.");
              return;
            }
          } catch (e) { /* tenta de novo no próximo ciclo */ }
          timer = setTimeout(conferir, 5000);
        };
        timer = setTimeout(conferir, 5000);
      } catch (e) {
        if (vivo) { setEstado("erro"); setErro(e.message || "Não foi possível gerar o PIX. Tente novamente."); }
      }
    })();
    return () => { vivo = false; clearTimeout(timer); };
  }, [parcela.n]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(pix.brCode); toast("Código PIX copiado!"); }
    catch (e) { toast("Não foi possível copiar."); }
  };

  const qrSrc = pix && (pix.brCodeBase64.startsWith("data:") ? pix.brCodeBase64 : "data:image/png;base64," + pix.brCodeBase64);

  return (
    <Modal title={"Pagar parcela " + parcela.n + "/" + total + " — " + fmtMoney(parcela.valor)} onClose={onClose}>
      {estado === "gerando" && (
        <p style={{ textAlign: "center", padding: "26px 0", color: "var(--gray)", fontWeight: 700 }}>Gerando seu código PIX...</p>
      )}
      {estado === "aberto" && pix && (
        <div style={{ textAlign: "center" }}>
          <img src={qrSrc} alt="QR Code PIX" className="pix-qr" />
          <p style={{ fontSize: 13.5, color: "var(--gray)", fontWeight: 600, marginTop: 10 }}>
            Escaneie o QR Code no app do seu banco, ou use o copia-e-cola:
          </p>
          <div className="pix-copia">{pix.brCode}</div>
          <button className="btn btn-lima btn-sm" style={{ marginTop: 12 }} onClick={copiar}>Copiar código PIX</button>
          {pix.invoiceUrl && (
            <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>
              Prefere boleto ou cartão?{" "}
              <a href={pix.invoiceUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--lima-700)", fontWeight: 800 }}>Abrir a página de pagamento</a>
            </p>
          )}
          <p className="pix-aguarde"><span className="pulsa"></span> Aguardando o pagamento — a confirmação aparece aqui sozinha.</p>
        </div>
      )}
      {estado === "pago" && (
        <div style={{ textAlign: "center", padding: "18px 0" }}>
          <div className="pix-ok"><PIcons.check style={{ width: 34, height: 34 }} /></div>
          <h3 style={{ marginTop: 14 }}>Pagamento confirmado! 🎉</h3>
          <p style={{ color: "var(--gray)", fontWeight: 600, fontSize: 14.5, marginTop: 6 }}>
            A parcela {parcela.n}/{total} já aparece como paga.
          </p>
          <button className="btn btn-navy btn-sm" style={{ marginTop: 18 }} onClick={onClose}>Concluir</button>
        </div>
      )}
      {estado === "erro" && (
        <div>
          <div className="auth-err">{erro}</div>
          <div className="modal-acts">
            <button className="btn btn-line btn-sm" onClick={onClose}>Fechar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------- página da aula (vídeo + materiais + comentários) ---------- */
function fmtDuracao(seg) {
  if (!seg) return "";
  const m = Math.floor(seg / 60), s = seg % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function ModuloPage({ m, numero, done, onVoltar, onToggleDone, onBaixar, comentarista, preview, toast }) {
  return (
    <div className="stack">
      <div>
        <button className="btn btn-line btn-xs" onClick={onVoltar}>← Voltar para os módulos</button>
        <div className="aula-head">
          <span className={"mnum" + (done ? " done" : "")}>
            {done ? <PIcons.check style={{ width: 20, height: 20 }} /> : numero}
          </span>
          <div>
            <h1 style={{ fontSize: 26 }}>{m.nome}</h1>
            <p className="sub" style={{ color: "var(--gray)", fontSize: 14.5, marginTop: 4 }}>{m.desc}</p>
          </div>
        </div>
      </div>

      {m.video && m.video.playbackId ? (
        <mux-player
          playback-id={m.video.playbackId}
          stream-type="on-demand"
          accent-color="#9FC83A"
          video-title={m.nome}
          class="aula-player"
        />
      ) : (
        <div className="pcard" style={{ textAlign: "center", padding: "30px 20px" }}>
          <p style={{ color: "var(--gray)", fontWeight: 600, fontSize: 14.5 }}>
            Este módulo não tem videoaula — o conteúdo está na apostila. 🐾
          </p>
        </div>
      )}

      <div className="aula-acts">
        <button className="btn btn-line btn-sm" disabled={!m.apostila} onClick={onBaixar}>
          <PIcons.dl style={{ width: 17, height: 17 }} />
          {m.apostila ? "Baixar apostila (" + m.apostila.tamanho + ")" : "Apostila ainda não publicada"}
        </button>
        <button className={"btn btn-sm " + (done ? "btn-lima" : "btn-navy")} onClick={onToggleDone}>
          {done ? "✓ Concluído" : "Marcar como concluído"}
        </button>
        {m.video && m.video.duracao ? <Chip tone="soft">▶ {fmtDuracao(m.video.duracao)}</Chip> : null}
      </div>

      <Comentarios moduloId={m.id} comentarista={comentarista} toast={toast} />
    </div>
  );
}

function Comentarios({ moduloId, comentarista, toast }) {
  const itens = useColFiltrada("comentarios", "moduloId", moduloId);
  const [texto, setTexto] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);

  const ordenados = [...(itens || [])].sort((a, b) => {
    const ta = a.criadoEm && a.criadoEm.toMillis ? a.criadoEm.toMillis() : 0;
    const tb = b.criadoEm && b.criadoEm.toMillis ? b.criadoEm.toMillis() : 0;
    return ta - tb;
  });

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await comentar(moduloId, comentarista.uid, comentarista.nome, comentarista.papel, texto);
      setTexto("");
    } catch (e) {
      toast("Não foi possível enviar o comentário.");
    } finally {
      setEnviando(false);
    }
  };

  const apagar = async (c) => {
    if (!window.confirm("Excluir este comentário?")) return;
    try { await excluir("comentarios/" + c.id); toast("Comentário excluído"); }
    catch (e) { toast("Não foi possível excluir."); }
  };

  return (
    <div className="pcard">
      <h3>Comentários da aula {ordenados.length > 0 && <Chip tone="soft">{ordenados.length}</Chip>}</h3>
      <div className="stack" style={{ gap: 12 }}>
        {itens === null && (
          <p style={{ color: "var(--gray)", fontWeight: 600, fontSize: 13.5 }}>Carregando...</p>
        )}
        {itens !== null && ordenados.length === 0 && (
          <p style={{ color: "var(--gray)", fontWeight: 600, fontSize: 14 }}>
            Nenhum comentário ainda — pergunte ou conte o que achou da aula!
          </p>
        )}
        {ordenados.map((c) => {
          const daEquipe = c.autorPapel === "equipe";
          const podeApagar = comentarista.podeModerar || c.autorUid === comentarista.uid;
          return (
            <div className={"coment" + (daEquipe ? " equipe" : "")} key={c.id}>
              <Avt nome={c.autorNome} size={34} tone={daEquipe ? "navy" : ""} />
              <div className="ctx">
                <div className="chead">
                  <b>{c.autorNome}</b>
                  {daEquipe && <Chip tone="lima">Equipe</Chip>}
                  <span className="cdata">
                    {c.criadoEm && c.criadoEm.toDate ? fmtDataHora(c.criadoEm.toDate().toISOString()) : "agora"}
                  </span>
                  {podeApagar && (
                    <button className="iconbtn danger" style={{ width: 28, height: 28, marginLeft: "auto" }}
                      onClick={() => apagar(c)} title="Excluir">
                      <PIcons.trash style={{ width: 13, height: 13 }} />
                    </button>
                  )}
                </div>
                <p>{c.texto}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>
        <Field label={"Comentar como " + comentarista.nome + (comentarista.papel === "equipe" ? " (equipe)" : "")}>
          <textarea className="in" value={texto} maxLength={2000}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva sua dúvida ou comentário..." />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button className="btn btn-lima btn-sm" onClick={enviar} disabled={enviando || !texto.trim()}>
            {enviando ? "Enviando..." : "Enviar comentário"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- blocos reaproveitados pelo painel da coordenação ---------- */

export function Evento({ ev, acts }) {
  const t = TIPO_EVENTO[ev.tipo] || TIPO_EVENTO.aula;
  const [ano, mes, dia] = ev.data.split("-");
  return (
    <div className="evrow">
      <span className="evdate">
        <b>{+dia}</b>
        <span>{fmtDia(ev.data).split(" ")[1]}</span>
      </span>
      <span className="etx">
        <b>{ev.titulo}</b>
        <span>{ev.hora}{ev.local ? " • " + ev.local : ""}</span>
      </span>
      <Chip tone={t.cls}>{t.label}</Chip>
      {acts}
    </div>
  );
}

// Agrupa os eventos por mês, com o rótulo do mês entre os blocos.
export function Agenda({ eventos, acts }) {
  const meses = [];
  eventos.forEach((ev) => {
    const chave = ev.data.slice(0, 7);
    const grupo = meses.find((m) => m.chave === chave);
    if (grupo) grupo.itens.push(ev);
    else meses.push({ chave, itens: [ev] });
  });
  if (eventos.length === 0) return <Empty icon="cal" text="Nenhum evento agendado." />;
  return (
    <div>
      {meses.map((m) => (
        <div key={m.chave}>
          <div className="month-lbl">{fmtMesAno(m.chave + "-01")}</div>
          <div className="stack" style={{ gap: 10 }}>
            {m.itens.map((ev) => <Evento key={ev.id} ev={ev} acts={acts && acts(ev)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Aviso({ av, acts }) {
  return (
    <div className={"aviso" + (av.fixado ? " fix" : "")}>
      <div className="ahead">
        <h4>
          {av.fixado && (
            <Chip tone="lima"><PIcons.pin style={{ width: 12, height: 12 }} /> Fixado</Chip>
          )}
          {av.titulo}
        </h4>
        <span className="adate">{fmtDia(av.data)}</span>
      </div>
      <p>{av.texto}</p>
      {acts}
    </div>
  );
}
