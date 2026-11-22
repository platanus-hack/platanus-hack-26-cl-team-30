"use client";

import Link from "next/link";
import { useRef } from "react";
import { MonitorPlay, Sparkles } from "lucide-react";
import { BridgeDrawing } from "./bridge";
import { HERO } from "./content";
import { EXPO, MOTION_OK, SplitText, gsap, useGSAP } from "./gsap";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // Una sola secuencia de carga: el título sube línea por línea y luego aparece el resto.
        // Cada línea va en una máscara «hl-mask» con holgura abajo (globals.css) para
        // que la máscara no corte los trazos que bajan, como la «g» o la «p».
        const split = SplitText.create("[data-hook]", { type: "lines", mask: "lines", linesClass: "hl" });
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
          {/* La segunda voz va en su propia línea: así la serif, más grande, no se monta sobre la de arriba. */}
          <h1 id="hook" data-hook className="h-hero hero-title max-w-[14ch]">
            {HERO.title} <span className="serif block text-brand">{HERO.accent}</span>
          </h1>
          {/* Una sola acción principal. La otra es un enlace simple, para que no compitan. */}
          <div data-follow className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
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
          <BridgeDrawing />
        </div>
      </div>
    </section>
  );
}
