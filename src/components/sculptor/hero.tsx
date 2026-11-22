"use client";

// Hero de Sculptor. Entra cuando la intro termina de "absorbernos" y después queda
// vivo: los píxeles se mueven con el puntero según su profundidad (la pátina, que está
// más lejos, se mueve más) y el núcleo lima respira.

import { useRef } from "react";
import { EXPO, MOTION_OK, SplitText, gsap, useGSAP } from "@/components/landing/gsap";
import { HERO } from "./content";
import { GalaxyMark } from "./galaxy-mark";
import { useIntro } from "./intro-state";

// Cuánto se desplaza cada tono con el puntero, en unidades del viewBox.
const DEPTH = [1.1, 0.7, 0.4, 0.15];

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const { revealed } = useIntro();

  // Entrada, una vez que la intro abrió la página. Después, la galaxia queda viva.
  useGSAP(
    () => {
      if (!revealed) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create("[data-hero-title]", { type: "lines", mask: "lines" });
        // La máscara recorta las letras con cola (g, j, q): se le da aire abajo sin mover el texto.
        gsap.set(split.masks, { paddingBottom: "0.14em", marginBottom: "-0.14em" });
        const cells = gsap.utils.toArray<SVGRectElement>("[data-hero-mark] [data-cell]");
        const dist = (c: Element) => Math.hypot(Number((c as SVGRectElement).dataset.x), Number((c as SVGRectElement).dataset.y));
        const tl = gsap.timeline({ defaults: { ease: EXPO } });
        gsap.set(cells, { transformOrigin: "50% 50%" });
        tl.from(cells, {
          scale: 0,
          opacity: 0,
          duration: 1.1,
          stagger: (_i, t) => dist(t as Element) * 0.035,
        });
        tl.from(split.lines, { yPercent: 110, duration: 1.2, stagger: 0.09 }, 0.15);
        tl.from("[data-hero-fade]", { opacity: 0, y: 20, duration: 1, stagger: 0.08 }, 0.35);

        // Vida propia, cuando la entrada ya terminó: parallax por profundidad,
        // parpadeo de la pátina y el núcleo que respira.
        const movers = cells.map((c) => ({
          d: DEPTH[Number(c.dataset.tone)],
          x: gsap.quickTo(c, "x", { duration: 0.9, ease: "power3.out" }),
          y: gsap.quickTo(c, "y", { duration: 0.9, ease: "power3.out" }),
        }));
        const onMove = (e: PointerEvent) => {
          const nx = (e.clientX / window.innerWidth) * 2 - 1;
          const ny = (e.clientY / window.innerHeight) * 2 - 1;
          for (const m of movers) {
            m.x(nx * m.d);
            m.y(ny * m.d);
          }
        };
        window.addEventListener("pointermove", onMove);

        tl.to(
          cells.filter((c) => c.dataset.tone === "0"),
          { opacity: 0.25, duration: 1.4, ease: "sine.inOut", stagger: { each: 0.35, from: "random", repeat: -1, yoyo: true } },
          ">",
        );
        tl.to(
          cells.filter((c) => c.dataset.tone === "3"),
          { scale: 1.18, duration: 1.6, ease: "sine.inOut", stagger: { each: 0.05, repeat: -1, yoyo: true } },
          "<",
        );

        return () => {
          window.removeEventListener("pointermove", onMove);
          split.revert();
        };
      });
    },
    { scope: root, dependencies: [revealed] },
  );

  return (
    <section ref={root} className="relative isolate flex min-h-svh items-center overflow-hidden px-6 pt-28 pb-20 md:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-[-10%] -z-10 aspect-square w-[80vmax] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(215,255,61,0.10),rgba(46,94,81,0.18)_45%,transparent)]"
      />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p data-hero-fade className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">
            {HERO.kicker.map((k) => (
              <span key={k}>[{k}]</span>
            ))}
          </p>
          <h1
            data-hero-title
            className="mt-7 text-[clamp(2.6rem,5.8vw,5.6rem)] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance text-(--marmol) [font-stretch:112%]"
          >
            {HERO.title}{" "}
            <span className="font-serif font-normal tracking-[-0.01em] text-(--eucalipto) italic [font-stretch:100%]">{HERO.accent}</span>
          </h1>
          <p data-hero-fade className="mt-8 max-w-xl text-lg leading-relaxed text-pretty text-(--piedra)">
            {HERO.body}
          </p>
          <ul data-hero-fade className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs tracking-[0.08em] text-(--marmol)">
            {HERO.motto.map((m, i) => (
              <li key={m} className="flex items-center gap-2">
                <span aria-hidden className={`size-1.5 ${["bg-(--eucalipto)", "bg-(--marmol)", "bg-(--cincel)"][i]}`} />
                {m}
              </li>
            ))}
          </ul>
          <div data-hero-fade className="mt-10 flex flex-wrap gap-3">
            <a
              href="#problema"
              className="group inline-flex items-center gap-2 rounded-full bg-(--cincel) px-6 py-3 text-sm font-bold text-(--obsidiana) transition-transform duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0"
            >
              Entender el protocolo
              <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-y-0.5">
                ↓
              </span>
            </a>
            <a
              href="#equipo"
              className="inline-flex items-center rounded-full border border-(--basalto) px-6 py-3 text-sm font-bold text-(--marmol) transition-colors duration-300 hover:border-(--eucalipto) hover:text-(--eucalipto)"
            >
              Conocer al equipo
            </a>
          </div>
        </div>
        <div data-hero-mark className="relative mx-auto w-full max-w-[560px]">
          <GalaxyMark className="block w-full overflow-visible" />
        </div>
      </div>
      <p
        data-hero-fade
        aria-hidden
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 font-mono text-[11px] tracking-[0.2em] text-(--piedra) uppercase"
      >
        <span className="inline-block size-1.5 animate-bounce bg-(--cincel)" />
        scroll
      </p>
    </section>
  );
}
