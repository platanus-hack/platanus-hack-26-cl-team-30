"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BedDouble, Construction, MonitorPlay, Sparkles, Truck, Wallet, type LucideIcon } from "lucide-react";
import { EXPO, MOTION_OK, SplitText, gsap, useGSAP } from "./gsap";

/** Escenas del dibujo del hero: siempre dos organizaciones y una sola cosa que escasea. */
const SCENES: { a: string; b: string; resource: string; icon: LucideIcon; tag?: string }[] = [
  { a: "Clínica Andes", b: "Hospital Rural", resource: "1 cama UCI", icon: BedDouble, tag: "El ejemplo" },
  { a: "Constructora Norte", b: "Constructora Sur", resource: "1 grúa torre", icon: Construction },
  { a: "Distribuidora Centro", b: "Distribuidora Costa", resource: "1 camión refrigerado", icon: Truck },
  { a: "Ventas", b: "Operaciones", resource: "1 presupuesto", icon: Wallet },
];

/**
 * Dos círculos que se cruzan: cada organización guarda lo suyo y en la intersección
 * queda lo único que comparten. Las escenas rotan para decir que sirve en cualquier rubro.
 *
 * Lo privado de cada lado (las barras tachadas, con candado) nunca cruza al otro
 * círculo: solo viaja una señal, un haz de luz que va de cada lado al centro (la
 * técnica de «Pulse Beams» de 21st.dev, hecha con GSAP). Así se ve que se conectan
 * a través de Sculptor sin mostrarse los datos.
 */
const BARS = [0, 1, 2];
const barY = (i: number) => 146 + i * 26;
const leftBeam = (i: number) => `M178 ${barY(i)} Q ${226 - i * 4} ${barY(i)} 250 180`;
const rightBeam = (i: number) => `M342 ${barY(i)} Q ${294 + i * 4} ${barY(i)} 270 180`;

function OverlapDrawing() {
  const [index, setIndex] = useState(0);
  const scene = SCENES[index];
  const Icon = scene.icon;
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!window.matchMedia(MOTION_OK).matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SCENES.length), 4200);
    return () => window.clearInterval(id);
  }, []);

  // En cada escena: los círculos se juntan, los haces viajan de cada lado al centro
  // y el recurso compartido responde con un pulso.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ defaults: { ease: EXPO } });
        tl.fromTo(".ov-left", { x: -18 }, { x: 0, duration: 1.1 }, 0)
          .fromTo(".ov-right", { x: 18 }, { x: 0, duration: 1.1 }, 0)
          .fromTo(".ov-name", { opacity: 0, y: 8, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, stagger: 0.08 }, 0.1)
          .fromTo(".ov-bar", { scaleX: 0, transformOrigin: "50% 50%" }, { scaleX: 1, duration: 0.7, stagger: 0.05 }, 0.15);
        // Haces: un degradado que recorre cada camino, de la barra al centro.
        gsap.utils.toArray<SVGLinearGradientElement>(".ov-grad-l").forEach((grad, i) => {
          tl.fromTo(grad, { attr: { x1: 140, x2: 180 } }, { attr: { x1: 270, x2: 310 }, duration: 1.1, ease: "power2.in" }, 0.55 + i * 0.12);
        });
        gsap.utils.toArray<SVGLinearGradientElement>(".ov-grad-r").forEach((grad, i) => {
          tl.fromTo(grad, { attr: { x1: 380, x2: 340 } }, { attr: { x1: 250, x2: 210 }, duration: 1.1, ease: "power2.in" }, 0.55 + i * 0.12);
        });
        tl.fromTo(".ov-hub", { scale: 0.85 }, { scale: 1, duration: 0.9, ease: "elastic.out(1, 0.45)" }, 1.55)
          .fromTo(".ov-ring", { attr: { r: 30 }, opacity: 0.7 }, { attr: { r: 96 }, opacity: 0, duration: 1.3, ease: "power2.out" }, 1.55)
          .fromTo(".ov-lens", { opacity: 0.55 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, 1.5);
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [index], revertOnUpdate: true },
  );

  return (
    <figure ref={root} className="relative mx-auto w-full max-w-[34rem]" aria-label="Dos organizaciones, una sola cosa que escasea">
      <svg viewBox="0 0 520 360" className="w-full overflow-visible" aria-hidden>
        <defs>
          <pattern id="ov-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="currentColor" fillOpacity="0.08" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2.4" />
          </pattern>
          {BARS.map((i) => (
            <linearGradient key={`gl${i}`} id={`ov-gl${i}`} className="ov-grad-l" gradientUnits="userSpaceOnUse" x1="140" x2="180" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
              <stop offset="60%" stopColor="var(--brand)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          ))}
          {BARS.map((i) => (
            <linearGradient key={`gr${i}`} id={`ov-gr${i}`} className="ov-grad-r" gradientUnits="userSpaceOnUse" x1="380" x2="340" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--clash)" stopOpacity="0" />
              <stop offset="60%" stopColor="var(--clash)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--clash)" stopOpacity="0" />
            </linearGradient>
          ))}
          <radialGradient id="ov-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--clash)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--clash)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="ov-left">
          <circle cx="190" cy="180" r="150" fill="var(--brand-soft)" fillOpacity="0.55" stroke="var(--brand)" strokeWidth="2.5" />
        </g>
        <g className="ov-right">
          <circle cx="330" cy="180" r="150" fill="var(--brand-soft)" fillOpacity="0.55" stroke="var(--brand-ink)" strokeWidth="2.5" />
        </g>
        <path className="ov-lens" d="M260 47.5a150 150 0 0 1 0 265a150 150 0 0 1 0-265Z" fill="var(--card)" />
        <circle cx="260" cy="180" r="110" fill="url(#ov-glow)" />

        {/* Caminos: tenues siempre; el haz los recorre en cada escena. */}
        {BARS.map((i) => (
          <g key={`b${i}`} fill="none" strokeLinecap="round">
            <path d={leftBeam(i)} stroke="var(--brand)" strokeOpacity="0.16" strokeWidth="1.2" />
            <path d={leftBeam(i)} stroke={`url(#ov-gl${i})`} strokeWidth="2.4" />
            <path d={rightBeam(i)} stroke="var(--brand-ink)" strokeOpacity="0.16" strokeWidth="1.2" />
            <path d={rightBeam(i)} stroke={`url(#ov-gr${i})`} strokeWidth="2.4" />
          </g>
        ))}

        {/* Lo privado de cada lado: datos tachados, con candado, que nunca cruzan al otro círculo. */}
        {BARS.map((i) => (
          <g key={i}>
            <g className="ov-bar" style={{ color: "var(--brand)" }}>
              <rect x={78} y={barY(i) - 6} width={100} height={12} rx={6} fill="url(#ov-hatch)" />
            </g>
            <g className="ov-bar" style={{ color: "var(--brand-ink)" }}>
              <rect x={342} y={barY(i) - 6} width={100} height={12} rx={6} fill="url(#ov-hatch)" />
            </g>
          </g>
        ))}
        {[66, 454].map((x, side) => (
          <g key={x} transform={`translate(${x - 6} ${barY(1) - 7})`} stroke={side ? "var(--brand-ink)" : "var(--brand)"} strokeOpacity="0.7" fill="none" strokeWidth="1.4">
            <rect x="0.7" y="5.5" width="10.6" height="8" rx="1.8" />
            <path d="M3 5.5V3.6a3 3 0 0 1 6 0v1.9" />
          </g>
        ))}

        <circle className="ov-ring" cx="260" cy="180" r="30" fill="none" stroke="var(--clash)" strokeWidth="2" opacity="0" />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-start px-[4%] pt-[13%] text-center">
        <p key={`a-${index}`} className="ov-name small font-semibold text-brand-ink">
          {scene.a}
        </p>
        <span />
        <p key={`b-${index}`} className="ov-name small font-semibold text-brand-ink">
          {scene.b}
        </p>
      </div>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div key={`r-${index}`} className="flex flex-col items-center gap-1.5">
          <span className="ov-hub grid size-14 place-items-center rounded-full bg-clash text-primary-foreground shadow-lift">
            <Icon className="size-7" aria-hidden />
          </span>
          <span className="ov-name small max-w-[8.5rem] text-center font-semibold leading-tight">{scene.resource}</span>
          {scene.tag && <span className="ov-name text-xs font-semibold text-clash">{scene.tag}</span>}
        </div>
      </div>
      <figcaption className="sr-only">
        Ejemplos: dos hospitales y una cama UCI; dos constructoras y una grúa; dos distribuidoras y un camión; dos áreas y un presupuesto.
        Los datos de cada organización quedan en su lado; solo una señal llega al recurso compartido.
      </figcaption>
    </figure>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // Una sola secuencia de carga: el título sube línea por línea y luego aparece el resto.
        const split = SplitText.create("[data-hook]", { type: "lines", mask: "lines" });
        const tl = gsap.timeline({ defaults: { ease: EXPO } });
        tl.from(split.lines, { yPercent: 105, duration: 1.1, stagger: 0.09 }, 0.1)
          .from("[data-follow]", { opacity: 0, y: 14, duration: 0.8, stagger: 0.08 }, 0.5)
          .from("[data-drawing]", { opacity: 0, scale: 0.96, duration: 1.4 }, 0.3);
        return () => split.revert();
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="top" className="relative overflow-clip pt-(--nav-h)" aria-labelledby="hook">
      <div className="wrap grid items-center gap-10 py-12 lg:min-h-[calc(100svh-var(--nav-h))] lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-20">
        <div>
          <h1 id="hook" data-hook className="h-hero max-w-[15ch]">
            Algo escasea. <span className="serif text-brand">Nadie muestra sus datos.</span>
          </h1>
          <p data-follow className="lede mt-7 max-w-[34rem] text-muted-foreground">
            Deciden juntas a quién le toca, con regla conocida y firma.
          </p>
          {/* Una sola acción principal. La otra es un enlace simple, para que no compitan. */}
          <div data-follow className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link href="/stage/demo-cross" className="btn btn-primary btn-lg">
              <MonitorPlay className="size-5" aria-hidden />
              Ver la demo
            </Link>
            <a href="#probar" className="inline-flex min-h-11 items-center gap-2 font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-brand">
              <Sparkles className="size-4" aria-hidden />
              o prueba tu caso
            </a>
          </div>
        </div>
        <div data-drawing>
          <OverlapDrawing />
        </div>
      </div>
    </section>
  );
}
