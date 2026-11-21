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
 */
function OverlapDrawing() {
  const [index, setIndex] = useState(0);
  const scene = SCENES[index];
  const Icon = scene.icon;

  useEffect(() => {
    if (!window.matchMedia(MOTION_OK).matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SCENES.length), 3600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <figure className="relative mx-auto w-full max-w-[34rem]" aria-label="Dos organizaciones, una sola cosa que escasea">
      <svg viewBox="0 0 520 360" className="w-full overflow-visible" aria-hidden>
        <circle cx="190" cy="180" r="150" fill="var(--brand-soft)" fillOpacity="0.55" stroke="var(--brand)" strokeWidth="2.5" />
        <circle cx="330" cy="180" r="150" fill="var(--brand-soft)" fillOpacity="0.55" stroke="var(--brand-ink)" strokeWidth="2.5" />
        <path d="M260 47.5a150 150 0 0 1 0 265a150 150 0 0 1 0-265Z" fill="var(--card)" />
        {/* Lo privado de cada lado: líneas tachadas que nunca cruzan al otro círculo. */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={78} y={140 + i * 26} width={100} height={12} rx={6} fill="var(--brand)" fillOpacity="0.18" />
            <rect x={342} y={140 + i * 26} width={100} height={12} rx={6} fill="var(--brand-ink)" fillOpacity="0.18" />
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-start px-[4%] pt-[13%] text-center">
        <p key={`a-${index}`} className="small font-semibold text-brand-ink motion-safe:animate-in motion-safe:fade-in">
          {scene.a}
        </p>
        <span />
        <p key={`b-${index}`} className="small font-semibold text-brand-ink motion-safe:animate-in motion-safe:fade-in">
          {scene.b}
        </p>
      </div>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div key={`r-${index}`} className="flex flex-col items-center gap-1.5 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in">
          <span className="grid size-14 place-items-center rounded-full bg-clash text-primary-foreground shadow-lift">
            <Icon className="size-7" aria-hidden />
          </span>
          <span className="small max-w-[8.5rem] text-center font-semibold leading-tight">{scene.resource}</span>
          {scene.tag && <span className="text-xs font-semibold text-clash">{scene.tag}</span>}
        </div>
      </div>
      <figcaption className="sr-only">
        Ejemplos: dos hospitales y una cama UCI; dos constructoras y una grúa; dos distribuidoras y un camión; dos áreas y un presupuesto.
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
          <div data-follow className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/stage/demo-cross" className="btn btn-primary btn-lg">
              <MonitorPlay className="size-5" aria-hidden />
              Ver el ejemplo
            </Link>
            <a href="#probar" className="btn btn-line btn-lg">
              <Sparkles className="size-5" aria-hidden />
              Probar mi caso
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
