"use client";

// El protocolo en cuatro reglas. A la izquierda, la galaxia gira con el scroll
// (fija mientras se leen las reglas); a la derecha, cada regla entra al alcanzarla:
// la línea se dibuja, el número cuenta y el texto sube.

import { useRef } from "react";
import { EXPO, MOTION_OK, ScrollTrigger, gsap, useGSAP } from "@/components/landing/gsap";
import { PRINCIPLES } from "./content";
import { GalaxyMark } from "./galaxy-mark";

export function Principles() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.to("[data-spin] [data-galaxy]", {
          rotation: 300,
          svgOrigin: "0 0",
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 1 },
        });

        for (const item of gsap.utils.toArray<HTMLElement>("[data-rule]")) {
          const tl = gsap.timeline({
            defaults: { ease: EXPO },
            scrollTrigger: { trigger: item, start: "top 82%", once: true },
          });
          tl.from(item.querySelector("[data-line]"), { scaleX: 0, transformOrigin: "0 50%", duration: 1.2 });
          tl.from(item.querySelectorAll("[data-rise]"), { yPercent: 40, opacity: 0, duration: 1, stagger: 0.08 }, 0.1);
          tl.from(item.querySelectorAll("[data-pixel]"), { scale: 0, duration: 0.5, stagger: { each: 0.04, from: "random" } }, 0.15);
        }
        ScrollTrigger.refresh();
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="protocolo" className="relative px-6 py-32 md:px-10">
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">[02] El protocolo</p>
          <h2 className="mt-6 text-[clamp(2.2rem,5vw,4.2rem)] leading-[0.98] font-extrabold tracking-[-0.035em] text-balance text-(--marmol) [font-stretch:110%]">
            Cuatro reglas que no se negocian.
          </h2>
          <div data-spin className="mt-12 hidden w-full max-w-[360px] lg:block">
            <GalaxyMark className="block w-full overflow-visible opacity-90" />
          </div>
        </div>
        <ol className="flex flex-col">
          {PRINCIPLES.map((rule, i) => (
            <li key={rule.title} data-rule className="relative py-10">
              <span data-line aria-hidden className="absolute inset-x-0 top-0 h-px bg-(--basalto)" />
              <div className="flex items-start gap-6 md:gap-10">
                <div className="flex shrink-0 flex-col items-start gap-3">
                  <span data-rise className="font-mono text-sm text-(--cincel)">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <PixelGlyph seed={i} />
                </div>
                <div>
                  <h3 data-rise className="text-2xl leading-tight font-extrabold tracking-[-0.03em] text-(--marmol) md:text-3xl">
                    {rule.title}
                  </h3>
                  <p data-rise className="mt-4 max-w-xl leading-relaxed text-(--piedra)">
                    {rule.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Un pequeño glifo de 3×3 píxeles por regla, con los tonos de la galaxia.
const GLYPHS = ["010111010", "110011001", "101010101", "111101111"];
const GLYPH_TONES = ["bg-(--patina)", "bg-(--eucalipto)", "bg-(--marmol)", "bg-(--cincel)"];

function PixelGlyph({ seed }: { seed: number }) {
  const bits = GLYPHS[seed % GLYPHS.length];
  return (
    <span aria-hidden className="grid grid-cols-3 gap-[3px]">
      {[...bits].map((b, i) => (
        <span
          key={i}
          data-pixel
          className={`size-[7px] ${b === "1" ? GLYPH_TONES[(i + seed) % GLYPH_TONES.length] : "bg-transparent"}`}
        />
      ))}
    </span>
  );
}
