"use client";

// «¿Dónde más pasa esto?»: la misma presentación que «Mismo esqueleto, otro genoma» de la
// landing de Sculptor (src/components/sculptor/market.tsx), con la paleta de las páginas
// de caso. Una tarjeta alta por rubro, con su pregunta real y un sistema solar mínimo.
// En escritorio la sección se fija y las tarjetas pasan de lado al bajar; en el celular,
// o con prefers-reduced-motion, es una fila que se desliza con el dedo.

import Link from "next/link";
import { HoverPrefetchLink } from "@/components/ui/hover-prefetch-link";
import { useRef } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";
import type { CaseUse } from "./types";

const CARD =
  "relative flex h-[360px] w-[300px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[28px] border border-border bg-muted/45 p-7 md:w-[360px]";

export function UsesTrack({ uses }: { uses: CaseUse[] }) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        const el = track.current;
        const viewport = el?.parentElement;
        if (!el || !viewport) return;
        // La fila deja de desplazarse sola: la mueve el scroll de la página.
        viewport.style.overflowX = "visible";
        const distance = () => Math.max(0, el.scrollWidth - viewport.clientWidth);
        const slide = gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        for (const card of gsap.utils.toArray<HTMLElement>("[data-use]")) {
          gsap.fromTo(
            card.querySelector("[data-orbit]"),
            { rotation: -60 },
            {
              rotation: 60,
              ease: "none",
              scrollTrigger: { trigger: card, containerAnimation: slide, start: "left right", end: "right left", scrub: true },
            },
          );
        }
        return () => {
          viewport.style.overflowX = "";
        };
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      aria-labelledby="mas-titulo"
      className="relative overflow-hidden border-t border-border py-24 md:py-32 lg:flex lg:min-h-svh lg:flex-col lg:justify-center lg:py-20"
    >
      <div className="wrap grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
        <h2 id="mas-titulo" className="cs-h2 max-w-[12ch]">
          ¿Dónde más pasa esto?
        </h2>
        {/* El patrón, para que cada persona reconozca su propio caso: «para cualquier recurso» no orienta. */}
        <p className="cs-lede max-w-[30rem] text-muted-foreground">Cada vez que dos equipos piden lo mismo y ninguno puede mostrar sus números.</p>
      </div>

      <div className="mt-14 snap-x snap-mandatory scroll-px-4 overflow-x-auto md:scroll-px-10 xl:scroll-px-[calc((100vw-80rem)/2+2.5rem)]">
        <ul ref={track} className="flex w-max gap-5 px-4 pb-4 md:px-10 xl:px-[calc((100vw-80rem)/2+2.5rem)]">
          {uses.map((use, index) => (
            <li key={use.title} data-use className="shrink-0">
              {use.href ? (
                <Link href={use.href} className={`${CARD} group transition-[border-color,translate] duration-300 hover:-translate-y-1 hover:border-brand`}>
                  <UseCard use={use} index={index} />
                </Link>
              ) : (
                <div className={CARD}>
                  <UseCard use={use} index={index} />
                </div>
              )}
            </li>
          ))}
          {/* Cierre de la fila: el caso de quien lee. */}
          <li className="flex w-[300px] shrink-0 snap-start flex-col justify-center gap-6 md:w-[400px]">
            <p className="text-[2rem] leading-[1.05] font-extrabold tracking-[-0.035em] md:text-[2.6rem]">¿Y en tu organización?</p>
            <p className="cs-body max-w-[22rem] text-muted-foreground">Sirve para cualquiera que deba decidir con otra sin mostrar sus datos.</p>
            <HoverPrefetchLink href="/" className="cs-body inline-flex min-h-11 w-fit items-center font-semibold underline decoration-border underline-offset-4 hover:decoration-brand">
              Qué es Sculptor
            </HoverPrefetchLink>
          </li>
        </ul>
      </div>

      <p className="wrap cs-body mt-6 text-muted-foreground">«Genoma listo»: ya está armado. «Desde una frase»: el modelo lo arma y el código lo valida.</p>
    </section>
  );
}

function UseCard({ use, index }: { use: CaseUse; index: number }) {
  const linked = Boolean(use.href);
  return (
    <>
      <Orbit index={index} linked={linked} />
      <div className="relative flex items-start justify-between gap-3">
        <span className="text-base font-semibold text-muted-foreground tabular-nums">{String(index + 1).padStart(2, "0")}</span>
        <span
          className={`rounded-full px-3.5 py-1 text-base font-semibold ${
            linked ? "bg-brand-ink text-background" : "border border-border bg-background text-brand"
          }`}
        >
          {use.status}
        </span>
      </div>
      <div className="relative">
        <h3
          className={`text-[2.4rem] leading-none font-extrabold tracking-[-0.04em] ${
            linked ? "underline decoration-transparent decoration-2 underline-offset-8 transition-colors group-hover:decoration-brand" : ""
          }`}
        >
          {use.title}
        </h3>
        <p className="mt-4 text-xl leading-snug font-medium text-foreground/85">{use.detail}</p>
      </div>
    </>
  );
}

/** Un sistema solar mínimo por rubro: un núcleo (la regla) y sus organizaciones en órbita. */
function Orbit({ index, linked }: { index: number; linked: boolean }) {
  const planets = 2 + (index % 3);
  return (
    <svg data-orbit aria-hidden viewBox="-100 -100 200 200" className="pointer-events-none absolute -top-16 -right-16 w-72 opacity-80">
      <circle r="70" fill="none" stroke="var(--border)" strokeWidth="1.5" />
      <circle r="42" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="2 5" />
      <rect x="-6" y="-6" width="12" height="12" rx="2" fill={linked ? "var(--brand)" : "var(--muted-foreground)"} />
      {Array.from({ length: planets }, (_, k) => {
        const angle = (k / planets) * Math.PI * 2 + index;
        const radius = k % 2 ? 42 : 70;
        return (
          <rect
            key={k}
            x={Math.round(Math.cos(angle) * radius - 4)}
            y={Math.round(Math.sin(angle) * radius - 4)}
            width="8"
            height="8"
            rx="1.5"
            fill={k % 2 ? "var(--foreground)" : "var(--brand)"}
            opacity={k % 2 ? 0.55 : 1}
          />
        );
      })}
    </svg>
  );
}
