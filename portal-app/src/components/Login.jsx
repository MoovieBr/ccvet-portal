/* Entrada no portal — e-mail e senha, sem escolher perfil.
 * O papel (aluno / equipe / coordenação) vem da claim do token depois do
 * login, então quem entra nunca erra "o lado" da tela. */
import React from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase.js";
import { PIcons, Field } from "./shared.jsx";

// Mensagens do Firebase traduzidas para algo que a pessoa entenda.
const ERROS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/user-disabled": "Seu acesso está desativado. Fale com a coordenação.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente de novo.",
};
const msgErro = (e) => ERROS[e.code] || "Não foi possível entrar. Tente novamente.";

const DESTAQUES = [
  "Apostilas em PDF por módulo",
  "Cronograma de aulas e provas",
  "Certificado ao concluir o curso",
];

export default function Login() {
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [erro, setErro] = React.useState("");
  const [aviso, setAviso] = React.useState("");
  const [entrando, setEntrando] = React.useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setErro(""); setAviso("");
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setEntrando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      // Em caso de sucesso o App troca de tela; não desligamos o "Entrando..."
      // para não piscar o botão no meio da transição.
    } catch (err) {
      setErro(msgErro(err));
      setEntrando(false);
    }
  };

  const esqueci = async () => {
    setErro(""); setAviso("");
    if (!email.trim()) {
      setErro("Digite seu e-mail no campo acima para receber o link de redefinição.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAviso("Enviamos um link de redefinição de senha para " + email.trim() + ".");
    } catch (err) {
      setErro(msgErro(err));
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-left">
          <div className="auth-brand">
            <span className="mk"><PIcons.paw style={{ width: 24, height: 24 }} /></span>
            <span>
              <span className="nm">CC<b>VET</b></span>
              <span className="sb">Capacitação Veterinária</span>
            </span>
          </div>
          <h1>Portal do <span className="lm">Aluno</span></h1>
          <p className="tag">
            Apostilas, cronograma, avisos da turma e o seu certificado — tudo em um só lugar.
          </p>
          <div className="auth-feats">
            {DESTAQUES.map((d) => (
              <span className="af" key={d}>
                <span className="c"><PIcons.check style={{ width: 13, height: 13 }} /></span> {d}
              </span>
            ))}
          </div>
        </div>

        <div className="auth-right">
          <h2>Entrar no portal</h2>
          <p className="sub">Use o e-mail e a senha enviados pela coordenação.</p>
          <form onSubmit={entrar}>
            <Field label="E-mail">
              <input className="in" type="email" value={email} autoComplete="username"
                onChange={(e) => { setEmail(e.target.value); setErro(""); }}
                placeholder="seu@email.com" />
            </Field>
            <Field label="Senha">
              <input className="in" type="password" value={senha} autoComplete="current-password"
                onChange={(e) => { setSenha(e.target.value); setErro(""); }}
                placeholder="••••••••" />
            </Field>
            {erro && <div className="auth-err">{erro}</div>}
            {aviso && <div className="auth-ok">{aviso}</div>}
            <div className="auth-actions">
              <button className="btn btn-navy" type="submit" disabled={entrando}>
                {entrando ? "Entrando..." : "Entrar"}
              </button>
            </div>
          </form>
          <div className="auth-links">
            <button type="button" onClick={esqueci}>Esqueci minha senha</button>
          </div>
          <div className="back-site"><a href="/">← Voltar para o site</a></div>
        </div>
      </div>
    </div>
  );
}
