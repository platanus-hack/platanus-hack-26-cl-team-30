"use client";

// Logo oficial de Sculptor: la galaxia del Escultor (NGC 253) de canto, en píxeles
// de un bit, con el núcleo en lima. Los 125 píxeles salen de la imagen original del
// equipo (grilla de 17 px, cuadros de 13 px), en cuatro tonos: verde oscuro,
// eucalipto, marfil y lima.
//
// Con animate, la galaxia «se esculpe» al aparecer: cada píxel llega desde un punto
// disperso y encaja, primero el núcleo y luego los brazos; al final se enciende el
// núcleo y sube el nombre. Al pasar el mouse se repite. Solo SVG y CSS, sin
// dependencias; respeta prefers-reduced-motion (se muestra armada y quieta).

import { useState, type CSSProperties } from "react";

export interface SculptorLogoProps {
  /** Alto del símbolo en px. El nombre escala con él. */
  size?: number;
  /** Muestra el nombre «sculptor» junto al símbolo. */
  wordmark?: boolean;
  /** Nombre debajo (marca grande) o al lado (encabezados). */
  layout?: "stacked" | "inline";
  /** Anima la entrada (y la repite al pasar el mouse). */
  animate?: boolean;
  className?: string;
}

export const GALAXY_COLORS = { D: "#2b5f52", M: "#70ae9b", W: "#f3f0e6", L: "#d7fe3e" } as const;
type Tone = keyof typeof GALAXY_COLORS;

// columna,fila,tono — leído de la imagen original del logo.
const MAP =
  "0,0,D 2,0,D 4,0,D 8,0,D 2,2,D 4,2,D 6,2,D 8,2,D 10,2,D 3,3,D 7,3,M 0,4,D 2,4,D 4,4,M 6,4,M 8,4,M 9,4,M 10,4,M 12,4,D 14,4,D 16,4,D 5,5,M 7,5,M 9,5,W 11,5,M 13,5,M 2,6,D 4,6,M 6,6,M 7,6,W 8,6,W 9,6,W 10,6,W 11,6,W 12,6,W 14,6,M 16,6,D 18,6,D 7,7,M 9,7,W 10,7,W 11,7,W 12,7,W 13,7,W 14,7,W 15,7,M 4,8,D 6,8,M 8,8,M 9,8,W 10,8,W 11,8,L 12,8,L 13,8,L 14,8,L 15,8,W 16,8,M 18,8,M 20,8,D 9,9,M 11,9,W 12,9,L 13,9,L 14,9,L 15,9,W 16,9,W 17,9,M 6,10,D 8,10,M 10,10,M 11,10,W 12,10,L 13,10,L 14,10,L 15,10,L 16,10,W 17,10,W 18,10,M 20,10,M 22,10,D 11,11,M 13,11,W 14,11,W 15,11,W 16,11,W 17,11,W 19,11,M 8,12,D 10,12,D 12,12,M 13,12,M 14,12,W 15,12,W 16,12,W 17,12,W 18,12,W 19,12,W 20,12,M 22,12,M 24,12,D 13,13,M 15,13,M 17,13,W 19,13,M 21,13,M 14,14,D 16,14,M 18,14,M 19,14,M 20,14,M 22,14,M 24,14,D 26,14,D 19,15,M 23,15,D 12,16,D 16,16,D 18,16,D 20,16,D 22,16,D 24,16,D 26,16,D 22,18,D 26,18,D 24,20,D";

const PITCH = 17;
const CELL = 13;
const COLS = 27;
const ROWS = 21;
const VIEW_W = COLS * PITCH - (PITCH - CELL);
const VIEW_H = ROWS * PITCH - (PITCH - CELL);
const CORE = { x: 13, y: 9.5 };

export const GALAXY_PIXELS = MAP.split(" ").map((entry, index) => {
  const [col, row, tone] = entry.split(",");
  const x = Number(col);
  const y = Number(row);
  // Dispersión determinista (sin Math.random, para que el servidor y el cliente coincidan).
  const angle = ((index * 137.508) % 360) * (Math.PI / 180);
  const reach = 140 + ((index * 53) % 120);
  const distance = Math.hypot(x - CORE.x, y - CORE.y);
  return {
    x: x * PITCH,
    y: y * PITCH,
    tone: tone as Tone,
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach),
    delay: Math.round(distance * 38 + (index % 7) * 12),
  };
});

/** El símbolo como SVG en texto (para el ícono de la pestaña o el revelado en vidrio). */
export const GALAXY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}">${GALAXY_PIXELS.map(
  (p) => `<rect x="${p.x}" y="${p.y}" width="${CELL}" height="${CELL}" fill="${GALAXY_COLORS[p.tone]}"/>`,
).join("")}</svg>`;

const styles = `
.sc-logo { display: inline-flex; align-items: center; line-height: 1; }
.sc-logo[data-layout="stacked"] { flex-direction: column; gap: .32em; }
.sc-logo[data-layout="inline"] { flex-direction: row; gap: .4em; }
.sc-logo svg { overflow: visible; display: block; }
.sc-px { transform-box: fill-box; transform-origin: center; }
.sc-word { font-family: "Manrope Variable", Manrope, system-ui, sans-serif; font-weight: 800; letter-spacing: -.04em; color: inherit; }

.sc-logo[data-play="true"] .sc-px {
  animation: sc-px .9s cubic-bezier(.16,1,.3,1) both;
  animation-delay: var(--sc-delay);
}
.sc-logo[data-play="true"] .sc-core { animation: sc-px .9s cubic-bezier(.16,1,.3,1) both, sc-glow 1.4s ease-out 1.1s both; animation-delay: var(--sc-delay), 1.1s; }
.sc-logo[data-play="true"] .sc-word { animation: sc-word .7s ease-out 1.25s both; }

@keyframes sc-px { from { transform: translate(var(--sc-dx), var(--sc-dy)) scale(.4); opacity: 0; } }
@keyframes sc-glow { 0% { filter: none; } 40% { filter: drop-shadow(0 0 6px #d7fe3e) brightness(1.25); } 100% { filter: none; } }
@keyframes sc-word { from { transform: translateY(.3em); opacity: 0; filter: blur(6px); } }

@media (prefers-reduced-motion: reduce) {
  .sc-logo * { animation: none !important; }
}
`;

export function SculptorLogo({ size = 96, wordmark = false, layout = "stacked", animate = false, className }: SculptorLogoProps) {
  // Cambiar la clave reinicia las animaciones CSS para repetirlas al pasar el mouse.
  const [run, setRun] = useState(0);
  const width = Math.round((size * VIEW_W) / VIEW_H);

  return (
    <span
      className={["sc-logo", className].filter(Boolean).join(" ")}
      data-play={animate}
      data-layout={layout}
      onMouseEnter={animate ? () => setRun((n) => n + 1) : undefined}
      role="img"
      aria-label="sculptor"
    >
      <style>{styles}</style>
      <svg key={run} width={width} height={size} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
        {GALAXY_PIXELS.map((p, index) => (
          <rect
            key={index}
            className={p.tone === "L" ? "sc-px sc-core" : "sc-px"}
            x={p.x}
            y={p.y}
            width={CELL}
            height={CELL}
            fill={GALAXY_COLORS[p.tone]}
            style={{ "--sc-dx": `${p.dx}px`, "--sc-dy": `${p.dy}px`, "--sc-delay": `${p.delay}ms` } as CSSProperties}
          />
        ))}
      </svg>
      {wordmark && (
        <span key={`w${run}`} className="sc-word" style={{ fontSize: layout === "inline" ? size * 0.7 : size * 0.42 }}>
          sculptor
        </span>
      )}
    </span>
  );
}

export default SculptorLogo;
