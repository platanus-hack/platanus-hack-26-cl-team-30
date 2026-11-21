"use client";

// Logo de Sculptor: cubo isométrico con la cara superior marfil, dos caras en
// eucalipto y el triángulo lima en el centro.
//
// Con animate, el cubo «se esculpe» al aparecer: cada cara llega desde su
// dirección y encaja, el triángulo crece desde la punta y se enciende, y el
// nombre sube al final. Al pasar el mouse se repite. Solo SVG y CSS, sin
// dependencias; respeta prefers-reduced-motion (se muestra armado y quieto).

import { useId, useState } from "react";

export interface SculptorLogoProps {
  /** Alto del símbolo en px. El nombre escala con él. */
  size?: number;
  /** Muestra el nombre «Sculptor» debajo del símbolo. */
  wordmark?: boolean;
  /** Anima la entrada (y la repite al pasar el mouse). */
  animate?: boolean;
  className?: string;
}

const COLORS = {
  top: "#f2efe8",
  left: "#71b0a0",
  right: "#2f5f53",
  core: "#d4f53c",
};

// Coordenadas en un lienzo de 200 × 210 centrado en (100, 105).
const FACES = {
  top: "15,54 100,3 186,54 146,76 54,76",
  left: "11,58 51,81 97,158 97,207 11,158",
  right: "189,58 149,81 103,158 103,207 189,158",
  core: "60,82 141,82 100,152",
};

const styles = `
.sc-logo { display: inline-flex; flex-direction: column; align-items: center; gap: .28em; line-height: 1; }
.sc-logo svg { overflow: visible; display: block; }
.sc-face, .sc-core { transform-box: fill-box; }
.sc-core { transform-origin: 50% 100%; }
.sc-glow { opacity: .55; }
.sc-word { font-family: "Manrope Variable", Manrope, system-ui, sans-serif; font-weight: 800; letter-spacing: -.035em; color: #f2efe8; }

.sc-logo[data-play="true"] .sc-top   { animation: sc-in-top .7s cubic-bezier(.2,.9,.25,1.15) both; }
.sc-logo[data-play="true"] .sc-left  { animation: sc-in-left .7s cubic-bezier(.2,.9,.25,1.15) .12s both; }
.sc-logo[data-play="true"] .sc-right { animation: sc-in-right .7s cubic-bezier(.2,.9,.25,1.15) .24s both; }
.sc-logo[data-play="true"] .sc-core  { animation: sc-core .55s cubic-bezier(.3,1.4,.4,1) .72s both; }
.sc-logo[data-play="true"] .sc-glow  { animation: sc-glow 1.6s ease-out .9s both; }
.sc-logo[data-play="true"] .sc-word  { animation: sc-word .6s ease-out 1s both; }

@keyframes sc-in-top   { from { transform: translateY(-38%) scale(.9); opacity: 0; } }
@keyframes sc-in-left  { from { transform: translate(-34%, 22%) scale(.9); opacity: 0; } }
@keyframes sc-in-right { from { transform: translate(34%, 22%) scale(.9); opacity: 0; } }
@keyframes sc-core     { from { transform: scale(0); opacity: 0; } }
@keyframes sc-glow     { 0% { opacity: 0; } 40% { opacity: 1; } 100% { opacity: .55; } }
@keyframes sc-word     { from { transform: translateY(.35em); opacity: 0; filter: blur(6px); } }

@media (prefers-reduced-motion: reduce) {
  .sc-logo * { animation: none !important; }
}
`;

export function SculptorLogo({ size = 96, wordmark = false, animate = false, className }: SculptorLogoProps) {
  const glowId = `sc-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // Cambiar la clave reinicia las animaciones CSS para repetirlas al pasar el mouse.
  const [run, setRun] = useState(0);

  return (
    <span
      className={["sc-logo", className].filter(Boolean).join(" ")}
      data-play={animate}
      onMouseEnter={animate ? () => setRun((n) => n + 1) : undefined}
      role="img"
      aria-label="Sculptor"
    >
      <style>{styles}</style>
      <svg key={run} width={(size * 200) / 210} height={size} viewBox="0 0 200 210" aria-hidden="true">
        <defs>
          <radialGradient id={glowId} cx="50%" cy="58%" r="55%">
            <stop offset="0" stopColor={COLORS.core} stopOpacity=".35" />
            <stop offset=".6" stopColor={COLORS.left} stopOpacity=".08" />
            <stop offset="1" stopColor={COLORS.left} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="sc-glow" cx="100" cy="112" r="120" fill={`url(#${glowId})`} />
        <polygon className="sc-face sc-top" points={FACES.top} fill={COLORS.top} />
        <polygon className="sc-face sc-left" points={FACES.left} fill={COLORS.left} />
        <polygon className="sc-face sc-right" points={FACES.right} fill={COLORS.right} />
        <polygon className="sc-core" points={FACES.core} fill={COLORS.core} />
      </svg>
      {wordmark && (
        <span key={`w${run}`} className="sc-word" style={{ fontSize: size * 0.42, marginTop: size * 0.08 }}>
          Sculptor
        </span>
      )}
    </span>
  );
}

export default SculptorLogo;
