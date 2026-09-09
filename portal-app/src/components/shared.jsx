/* Ícones e componentes visuais compartilhados pelo portal. */
import React from "react";

// Ícones lineares 24x24, traçado herdando a cor do texto.
const I = ({ d, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
);

// A patinha e os ícones de marca são preenchidos, não traçados.
const Cheio = ({ vb, d, ...p }) => (
  <svg viewBox={vb} fill="currentColor" {...p}>{d}</svg>
);

export const PIcons = {
  paw: (p) => <Cheio {...p} vb="0 0 64 64" d={<><ellipse cx="32" cy="45" rx="16" ry="13" /><circle cx="12" cy="30" r="6.4" /><circle cx="25" cy="19" r="7" /><circle cx="39" cy="19" r="7" /><circle cx="52" cy="30" r="6.4" /></>} />,
  home: (p) => <I {...p} d={<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>} />,
  book: (p) => <I {...p} d={<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M19 17H6a2 2 0 0 0-2 2" /></>} />,
  cal: (p) => <I {...p} d={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></>} />,
  bell: (p) => <I {...p} d={<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>} />,
  link: (p) => <I {...p} d={<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>} />,
  award: (p) => <I {...p} d={<><circle cx="12" cy="9" r="5" /><path d="M9 13.5 7.5 21l4.5-2.5L16.5 21 15 13.5" /></>} />,
  users: (p) => <I {...p} d={<><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6" /></>} />,
  chart: (p) => <I {...p} d={<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />} />,
  out: (p) => <I {...p} d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>} />,
  dl: (p) => <I {...p} d={<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>} />,
  check: (p) => <I {...p} d={<polyline points="20 6 9 17 4 12" />} />,
  plus: (p) => <I {...p} d={<path d="M12 5v14M5 12h14" />} />,
  trash: (p) => <I {...p} d={<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>} />,
  edit: (p) => <I {...p} d={<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>} />,
  up: (p) => <I {...p} d={<path d="m18 15-6-6-6 6" />} />,
  down: (p) => <I {...p} d={<path d="m6 9 6 6 6-6" />} />,
  x: (p) => <I {...p} d={<path d="M18 6 6 18M6 6l12 12" />} />,
  eye: (p) => <I {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>} />,
  lock: (p) => <I {...p} d={<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>} />,
  clock: (p) => <I {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>} />,
  pin: (p) => <I {...p} d={<><path d="M12 17v5" /><path d="M9 3h6l1 7 2 2H6l2-2z" /></>} />,
  file: (p) => <I {...p} d={<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></>} />,
  upload: (p) => <I {...p} d={<><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></>} />,
  money: (p) => <I {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 6.5v11" /><path d="M15 8.8c-.6-.8-1.7-1.3-3-1.3-1.7 0-3 .8-3 2.1s1.2 1.8 3 2.2 3 .9 3 2.2-1.3 2.1-3 2.1c-1.3 0-2.4-.5-3-1.3" /></>} />,
  wa: (p) => <Cheio {...p} vb="0 0 24 24" d={<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2m0 18.13c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.35c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24m4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01s-.43.06-.66.31c-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28" />} />,
  ig: (p) => <Cheio {...p} vb="0 0 24 24" d={<path d="M12 2c2.72 0 3.06.01 4.12.06 1.07.05 1.8.22 2.43.47.66.25 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.25.63.42 1.36.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.07-.22 1.8-.47 2.43-.25.66-.6 1.22-1.15 1.77-.55.55-1.11.9-1.77 1.15-.63.25-1.36.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.07-.05-1.8-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.63-.42-1.36-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.07.22-1.8.47-2.43.25-.66.6-1.22 1.15-1.77.55-.55 1.11-.9 1.77-1.15.63-.25 1.36-.42 2.43-.47C8.94 2.01 9.28 2 12 2m0 3.4A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4m0 1.8A4.8 4.8 0 1 1 7.2 12 4.8 4.8 0 0 1 12 7.2m5.35-1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4" />} />,
};

/* ---------- primitivos visuais ---------- */

export const Chip = ({ tone, children }) => (
  <span className={"chip " + (tone || "")}>{children}</span>
);

// Iniciais do nome, no máximo duas.
export function Avt({ nome, size, tone }) {
  const iniciais = (nome || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={"avt " + (tone || "")}
      style={size ? { width: size, height: size, fontSize: size * 0.38 } : {}}>
      {iniciais}
    </span>
  );
}

export const Bar = ({ pct, tone }) => (
  <span className="bar">
    <i className={tone || ""} style={{ width: Math.max(0, Math.min(100, pct)) + "%" }} />
  </span>
);

// Anel de progresso desenhado com conic-gradient.
export function Ring({ pct, size, label }) {
  const n = size || 120;
  return (
    <div className="ring" style={{ width: n, height: n,
      background: `conic-gradient(var(--lima) ${pct * 3.6}deg, var(--cream-2) 0deg)` }}>
      <div className="ring-in"><b>{pct}%</b><span>{label || "concluído"}</span></div>
    </div>
  );
}

// Fecha ao clicar fora, mas não ao arrastar de dentro para fora.
export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal" + (wide ? " wide" : "")}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Fechar">
            <PIcons.x style={{ width: 18, height: 18 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, text }) {
  const Ic = PIcons[icon] || PIcons.paw;
  return (
    <div className="empty">
      <span className="empty-ic"><Ic style={{ width: 26, height: 26 }} /></span>
      <p>{text}</p>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <div className="pfield"><label className="lbl">{label}</label>{children}</div>
);

// Tipos de evento do cronograma.
export const TIPO_EVENTO = {
  aula: { label: "Aula ao vivo", cls: "soft" },
  pratica: { label: "Prática", cls: "lima" },
  prova: { label: "Prova", cls: "warm" },
};
