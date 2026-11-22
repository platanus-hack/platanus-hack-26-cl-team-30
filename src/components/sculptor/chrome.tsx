"use client";

// Barra superior y cierre de la landing de Sculptor.
// La barra se esconde al bajar y vuelve al subir. El cierre tiene la palabra
// "sculptor" a todo el ancho, que se arma letra por letra al llegar al final.

import Link from "next/link";
import { useRef } from "react";
import { EXPO, MOTION_OK, ScrollTrigger, gsap, useGSAP } from "@/components/landing/gsap";
import { CLOSING } from "./content";
import { GalaxyMark } from "./galaxy-mark";

const LINKS = [
  { href: "#protocolo", label: "Protocolo" },
  { href: "#mercado", label: "Mercado" },
  { href: "#galaxia", label: "Galaxia" },
  { href: "#hackathon", label: "Platanus Hack" },
  { href: "#equipo", label: "Equipo" },
];

/** Un caso completo, jugado en la demo: sale de la landing hacia su página. */
const EXAMPLE_LINK = { href: "/casos/logistica", label: "Ver un caso" };
const LINK_CLASS = "rounded-full px-4 py-2 text-sm font-semibold text-(--piedra) transition-colors hover:text-(--marmol)";

export function Nav() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const hide = gsap.to(root.current, { yPercent: -120, duration: 0.45, ease: "power3.out", paused: true });
        ScrollTrigger.create({
          start: 120,
          end: "max",
          onUpdate: (self) => (self.direction === 1 ? hide.play() : hide.reverse()),
          onLeaveBack: () => hide.reverse(),
        });
      });
    },
    { scope: root },
  );

  return (
    <header ref={root} className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-8">
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-(--basalto)/70 bg-(--obsidiana)/70 py-2 pr-2 pl-4 backdrop-blur-md">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Sculptor, volver al inicio">
          <GalaxyMark className="h-6 w-auto" title="" aria-hidden />
          <span className="font-sans text-lg font-extrabold tracking-[-0.05em] text-(--marmol)">sculptor</span>
        </a>
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className={LINK_CLASS}>
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <Link href={EXAMPLE_LINK.href} className={LINK_CLASS}>
              {EXAMPLE_LINK.label}
            </Link>
          </li>
        </ul>
        {/* En el celular no hay menú: el único link que queda a la vista es el del ejemplo. */}
        <Link href={EXAMPLE_LINK.href} className={`${LINK_CLASS} ml-auto px-3 lg:hidden`}>
          {EXAMPLE_LINK.label}
        </Link>
        <span className="shrink-0 rounded-full bg-(--grafito) px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-(--cincel) uppercase">
          Equipo 30
        </span>
      </nav>
    </header>
  );
}

export function Footer() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-end-letter]", {
          yPercent: 110,
          rotation: (i) => (i % 2 ? 8 : -8),
          duration: 1.2,
          ease: EXPO,
          stagger: 0.05,
          scrollTrigger: { trigger: root.current, start: "top 85%", once: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <footer ref={root} className="overflow-hidden px-6 pt-24 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-8 border-t border-(--basalto) pt-10">
        <div className="space-y-2 font-mono text-xs tracking-[0.14em] text-(--piedra) uppercase">
          <p>Platanus Hack 26 · Santiago ft. Buk</p>
          <p>Equipo 30 · Track Multiplayer · 2026</p>
          <p className="font-serif text-xl tracking-normal text-(--marmol) normal-case italic">{CLOSING}</p>
        </div>
        <Link
          href="/demo"
          className="inline-flex items-center gap-2 rounded-full bg-(--cincel) px-6 py-3 text-sm font-bold text-(--obsidiana) transition-transform duration-300 ease-out hover:-translate-y-0.5"
        >
          Abrir la demo <span aria-hidden>→</span>
        </Link>
      </div>
      <p
        aria-hidden
        className="mt-10 flex justify-center overflow-hidden font-sans text-[clamp(5rem,24vw,22rem)] leading-[0.8] font-extrabold tracking-[-0.06em] text-(--marmol)"
      >
        {[..."sculptor"].map((ch, i) => (
          <span key={i} data-end-letter className="inline-block">
            {ch}
          </span>
        ))}
      </p>
    </footer>
  );
}
