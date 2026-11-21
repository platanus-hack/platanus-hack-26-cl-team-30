import { useId } from "react";
import { cn } from "@/lib/utils";

// Trazos de 160 px de ancho que se repiten. El de espera es un latido; el de
// calma, una línea casi plana.
const BEAT = "M0 24 H44 L50 19 L56 24 H66 L72 4 L80 42 L87 15 L92 24 H112 L120 17 L128 24 H160";
const REST = "M0 24 H60 Q70 20 80 24 T100 24 H160";

type Props = {
  /** true: late y avanza (alguien espera). false: línea en calma. */
  beating: boolean;
  className?: string;
};

/** Línea de pulso que cruza todo el ancho de su contenedor (que debe recortar el desborde). */
export function PulseLine({ beating, className }: Props) {
  const patternId = useId();
  return (
    <svg aria-hidden className={cn("pointer-events-none w-[calc(100%+160px)] max-w-none", beating && "pulse-scroll", className)} preserveAspectRatio="none">
      <defs>
        <pattern id={patternId} width="160" height="48" patternUnits="userSpaceOnUse">
          <path d={beating ? BEAT : REST} fill="none" stroke={beating ? "var(--bleed)" : "var(--calm)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="48" fill={`url(#${patternId})`} />
    </svg>
  );
}
