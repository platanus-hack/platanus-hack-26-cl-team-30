// Pulso de la espera, tomado del prototipo de Nahum: un trazo de electrocardiograma
// rojo mientras la decisión sigue abierta, que se vuelve una línea verde y plana
// cuando queda sellada. Es decorativo: el estado ya se dice con palabras al lado.

const BEAT = "l14 0 l5 -4 l5 4 l8 0 l5 12 l7 -30 l7 26 l5 -8 l10 0 l6 -5 l8 5 l40 0";
const BEATS = 10;
const WIDTH = BEATS * 120;
const PULSE = `M0 22 ${Array.from({ length: BEATS }, () => BEAT).join(" ")}`;
const FLAT = `M0 22 L${WIDTH} 22`;

function Trace({ d, className }: { d: string; className: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${WIDTH} 40`} preserveAspectRatio="none">
      <path d={d} />
    </svg>
  );
}

export function Ecg({ calm }: { calm: boolean }) {
  return (
    <span className="nx-ecg" data-state={calm ? "calm" : "block"} aria-hidden="true">
      <Trace className="nx-ecg-trace" d={calm ? FLAT : PULSE} />
      {/* El tramo brillante que avanza: el mismo trazo, visto a través de una máscara que se desplaza. */}
      {!calm && <Trace className="nx-ecg-beam" d={PULSE} />}
    </span>
  );
}
