import type { SVGProps } from "react";
import { CELLS, TONES } from "./galaxy-data";

// Isotipo de Sculptor dibujado celda por celda en SVG. Cada celda es un <rect>
// propio para que la intro y el hero puedan mover píxeles sueltos con GSAP.
// El núcleo lima queda en (0, 0) del viewBox: rotar o escalar con svgOrigin "0 0"
// hace girar la galaxia sobre su centro.

const SIZE = 0.78;

// De atrás hacia adelante: pátina, eucalipto, mármol y el núcleo lima encima de todo.
const LAYERED = [...CELLS].sort((a, b) => a[2] - b[2]);

export const GALAXY_VIEWBOX = "-13.5 -9.5 27 21";

export function GalaxyMark({ title = "Sculptor", ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox={GALAXY_VIEWBOX} role="img" aria-label={title} {...props}>
      <g data-galaxy="">
        {LAYERED.map(([x, y, tone]) => (
          <rect
            key={`${x}:${y}`}
            data-cell=""
            data-tone={tone}
            data-x={x}
            data-y={y}
            x={x - SIZE / 2}
            y={y - SIZE / 2}
            width={SIZE}
            height={SIZE}
            fill={TONES[tone]}
          />
        ))}
      </g>
    </svg>
  );
}
