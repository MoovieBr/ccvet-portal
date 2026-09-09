/* Datas, valores e regras de vencimento — tudo em português do Brasil.
 *
 * As datas circulam como texto ISO ("2026-08-10"), nunca como Date: criar um
 * Date a partir de "2026-08-10" o interpreta como UTC e, no fuso do Brasil,
 * volta um dia. Por isso os nomes abaixo fatiam a string.
 */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez"];

function partes(iso) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return { ano: +ano, mes: +mes, dia: +dia };
}

// "10 ago"
export function fmtDia(iso) {
  const d = partes(iso);
  return d.dia + " " + MESES_CURTOS[d.mes - 1];
}

// "10 de agosto de 2026"
export function fmtDataLonga(iso) {
  const d = partes(iso);
  return d.dia + " de " + MESES[d.mes - 1] + " de " + d.ano;
}

// "Agosto 2026"
export function fmtMesAno(iso) {
  const d = partes(iso);
  const m = MESES[d.mes - 1];
  return m.charAt(0).toUpperCase() + m.slice(1) + " " + d.ano;
}

// "10 ago • 19:30" (a hora só aparece se o ISO a tiver)
export function fmtDataHora(iso) {
  const hora = iso.length > 10 ? iso.slice(11, 16) : "";
  return fmtDia(iso) + (hora ? " • " + hora : "");
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

// Valores trafegam em centavos para não acumular erro de ponto flutuante.
export function fmtMoney(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Dias até a data (negativo = já passou), comparando à meia-noite local.
export function diasAte(iso) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round((new Date(a, m - 1, d) - hoje) / 86400000);
}

export function parcelaAtrasada(p) {
  return p.status !== "paga" && diasAte(p.vencimento) < 0;
}

// A próxima parcela em aberto, pela ordem de vencimento.
export function proximaParcela(financeiro) {
  if (!financeiro || !financeiro.parcelas) return null;
  return [...financeiro.parcelas]
    .filter((p) => p.status !== "paga")
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] || null;
}

// Normaliza o telefone para o formato que o wa.me espera (com DDI).
export function waNumero(tel) {
  if (!tel) return null;
  const n = String(tel).replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) return "55" + n;
  if (n.length === 12 || n.length === 13) return n;
  return null;
}
