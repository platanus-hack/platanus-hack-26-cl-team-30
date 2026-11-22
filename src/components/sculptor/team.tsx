"use client";

// Equipo 30. La foto se revela como el logo: una grilla de píxeles oscuros que se
// apagan desde el centro hacia afuera; adentro, la foto se desplaza un poco más lento
// que la página. En teléfono se usa la foto vertical.

import Image from "next/image";
import { useRef } from "react";
import { EXPO, MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";
import { TEAM } from "./content";

const COLS = 16;
const ROWS = 10;
const MOSAIC_TONES = ["#0C0E0D", "#0C0E0D", "#181B1A", "#2E5E51"];

export function Team() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.to("[data-tile]", {
          scale: 0,
          duration: 0.7,
          ease: "power3.in",
          stagger: { grid: [ROWS, COLS], from: "center", amount: 1.1 },
          scrollTrigger: { trigger: "[data-frame]", start: "top 70%", once: true },
        });
        gsap.fromTo(
          "[data-frame] img",
          { yPercent: -6, scale: 1.12 },
          {
            yPercent: 6,
            ease: "none",
            scrollTrigger: { trigger: "[data-frame]", start: "top bottom", end: "bottom top", scrub: true },
          },
        );
        gsap.from("[data-member]", {
          y: 40,
          opacity: 0,
          duration: 1,
          ease: EXPO,
          stagger: 0.1,
          scrollTrigger: { trigger: "[data-members]", start: "top 85%", once: true },
        });
      });
      // Sin movimiento, la grilla no tapa la foto.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-tile]", { scale: 0 });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="equipo" className="px-6 py-32 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">[09] Quiénes somos</p>
            <h2 className="mt-6 text-[clamp(2.4rem,6vw,5rem)] leading-[0.95] font-extrabold tracking-[-0.04em] text-(--marmol) [font-stretch:112%]">
              Equipo 30.
            </h2>
          </div>
          <p className="max-w-sm leading-relaxed text-(--piedra)">
            Tres personas, tres frentes: producto, agente e infraestructura, y negocio. Lo que no alcanza, se corta; lo que se presenta, corre.
          </p>
        </div>

        <div data-frame className="relative mt-14 overflow-hidden rounded-[28px] bg-(--grafito)">
          <Image
            src="/sculptor/equipo/equipo-horizontal.jpg"
            alt="El equipo 30 (Ramón, Sebastián y Nahum) frente al cartel de Platanus Hack 26."
            width={2000}
            height={1125}
            sizes="(min-width: 1280px) 1216px, 100vw"
            className="hidden aspect-[16/9] w-full object-cover md:block"
          />
          <Image
            src="/sculptor/equipo/equipo-vertical-1.jpg"
            alt="El equipo 30 (Ramón, Sebastián y Nahum) frente al cartel de Platanus Hack 26."
            width={1125}
            height={2000}
            sizes="100vw"
            className="aspect-[4/5] w-full object-cover object-[50%_60%] md:hidden"
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
            {Array.from({ length: COLS * ROWS }, (_, i) => (
              <span
                key={i}
                data-tile
                className="-m-px block motion-reduce:hidden"
                style={{ backgroundColor: MOSAIC_TONES[(i * 7 + Math.floor(i / COLS) * 3) % MOSAIC_TONES.length] }}
              />
            ))}
          </div>
        </div>

        <ul data-members className="mt-12 grid gap-4 md:grid-cols-3">
          {TEAM.map((m) => (
            <li
              key={m.handle}
              data-member
              className="group relative overflow-hidden rounded-2xl border border-(--basalto) bg-(--grafito) p-7 transition-colors duration-300 hover:border-(--eucalipto)"
            >
              <span
                aria-hidden
                className="absolute top-0 right-0 size-3 bg-(--cincel) transition-transform duration-500 ease-out group-hover:scale-[2.5]"
              />
              <p className="font-mono text-[11px] tracking-[0.16em] text-(--eucalipto) uppercase">{m.role}</p>
              <h3 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-(--marmol)">{m.name}</h3>
              <p className="mt-3 text-(--piedra)">{m.detail}</p>
              <a
                href={`https://github.com/${m.handle}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-block font-mono text-sm text-(--marmol) underline decoration-(--basalto) underline-offset-4 transition-colors hover:decoration-(--cincel)"
              >
                github.com/{m.handle}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
