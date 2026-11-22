"use client";

// Intro de la landing de Sculptor, en cuatro tiempos:
//   1. Los píxeles de la galaxia llegan desde lejos y se arman (los del centro primero).
//   2. Las letras de "sculptor" caen y rebotan en su lugar.
//   3. La galaxia toma aire y empieza a girar: se traga las letras en espiral.
//   4. Zoom al núcleo lima: la galaxia "nos absorbe" y se abre la página.
// Un clic o cualquier tecla acelera la intro. Con movimiento reducido no corre.

import { useRef } from "react";
import { gsap, useGSAP } from "@/components/landing/gsap";
import { GalaxyMark } from "./galaxy-mark";

const WORD = [..."sculptor"];

// Posición del núcleo dentro del viewBox "-13.5 -9.5 27 21" (ver galaxy-mark.tsx).
const CORE_X = 13.5 / 27;
const CORE_Y = 9.5 / 21;

export function Intro({ onReveal, onFinish }: { onReveal: () => void; onFinish: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onFinish();
        return;
      }

      const html = document.documentElement;
      const prevOverflow = html.style.overflow;
      html.style.overflow = "hidden";
      window.scrollTo(0, 0);

      const stage = el.querySelector<HTMLElement>("[data-stage]")!;
      const svg = el.querySelector<SVGSVGElement>("svg")!;
      const group = el.querySelector<SVGGElement>("[data-galaxy]")!;
      const glow = el.querySelector<HTMLElement>("[data-glow]")!;
      const hint = el.querySelector<HTMLElement>("[data-hint]")!;
      const cells = gsap.utils.toArray<SVGRectElement>("[data-cell]", el);
      const core = cells.filter((c) => c.dataset.tone === "3");
      const halo = cells.filter((c) => c.dataset.tone !== "3");
      const letters = gsap.utils.toArray<HTMLElement>("[data-letter]", el);

      // Medir antes de cualquier transformación: centro del núcleo y de cada letra.
      const box = svg.getBoundingClientRect();
      const cx = box.left + box.width * CORE_X;
      const cy = box.top + box.height * CORE_Y;
      const spots = letters.map((l) => {
        const r = l.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });

      const cellX = (c: Element) => Number((c as SVGRectElement).dataset.x);
      const cellY = (c: Element) => Number((c as SVGRectElement).dataset.y);
      const dist = (c: Element) => Math.hypot(cellX(c), cellY(c));
      const maxDist = Math.max(...cells.map(dist));

      const finish = () => {
        html.style.overflow = prevOverflow;
        onFinish();
      };

      gsap.set(cells, { transformOrigin: "50% 50%" });

      const tl = gsap.timeline({ onComplete: finish });

      // 1. Ensamblar la galaxia, del núcleo hacia afuera.
      tl.from(cells, {
        x: () => gsap.utils.random(-34, 34),
        y: () => gsap.utils.random(-26, 26),
        rotation: () => gsap.utils.random(-220, 220),
        scale: 0,
        opacity: 0,
        duration: 1.15,
        ease: "expo.out",
        stagger: (_i, target) => (dist(target as Element) / maxDist) * 0.75,
      });
      tl.fromTo(glow, { opacity: 0, scale: 0.4 }, { opacity: 0.55, scale: 1, duration: 1.2, ease: "power2.out" }, 0.4);
      tl.to(core, { scale: 1.55, duration: 0.22, ease: "power2.out", yoyo: true, repeat: 1 }, 1.05);

      // 2. Las letras caen y rebotan.
      tl.from(
        letters,
        {
          y: () => -window.innerHeight * gsap.utils.random(0.75, 1.1),
          rotation: () => gsap.utils.random(-28, 28),
          duration: 1.25,
          ease: "bounce.out",
          stagger: 0.075,
        },
        1.15,
      );
      tl.from(hint, { opacity: 0, duration: 0.6 }, 0.8);

      // 3. La galaxia toma aire (gira un poco al revés) y se traga las letras.
      tl.to(group, { rotation: -14, svgOrigin: "0 0", duration: 0.55, ease: "power2.out" }, ">+0.25");
      tl.to(letters, { scale: 1.06, duration: 0.55, ease: "power2.out", stagger: 0.02 }, "<");
      tl.addLabel("absorb");
      tl.to(hint, { opacity: 0, duration: 0.3 }, "absorb");
      tl.to(group, { rotation: 560, svgOrigin: "0 0", duration: 1.75, ease: "power3.in" }, "absorb");
      tl.to(
        halo,
        {
          x: (_i, t) => -cellX(t as Element) * 0.5,
          y: (_i, t) => -cellY(t as Element) * 0.5,
          scale: 0.7,
          duration: 1.5,
          ease: "power3.in",
          stagger: { each: 0.004, from: "end" },
        },
        "absorb",
      );
      tl.to(glow, { opacity: 0.9, scale: 1.6, duration: 1.4, ease: "power2.in" }, "absorb");

      // Cada letra recorre una espiral hacia el núcleo: el radio se achica mientras el ángulo avanza.
      const spin = Math.PI * 2.4;
      letters.forEach((letter, i) => {
        const from = spots[i];
        const r0 = Math.hypot(from.x - cx, from.y - cy);
        const a0 = Math.atan2(from.y - cy, from.x - cx);
        const proxy = { p: 0 };
        const outerFirst = (3.5 - Math.abs(i - 3.5)) * 0.06;
        tl.to(
          proxy,
          {
            p: 1,
            duration: 1.3,
            ease: "power2.in",
            onUpdate: () => {
              const p = proxy.p;
              const a = a0 + spin * p;
              const r = r0 * Math.pow(1 - p, 1.35);
              gsap.set(letter, {
                x: cx + r * Math.cos(a) - from.x,
                y: cy + r * Math.sin(a) - from.y,
                rotation: p * 600,
                scale: 1.06 - p * 0.98,
                opacity: p > 0.82 ? (1 - p) / 0.18 : 1,
              });
            },
          },
          `absorb+=${0.12 + outerFirst}`,
        );
      });

      // 4. Zoom al núcleo: la galaxia nos absorbe y se abre la página.
      tl.addLabel("dive", "absorb+=1.3");
      tl.to(group, { scale: 48, svgOrigin: "0 0", duration: 0.85, ease: "power4.in" }, "dive");
      tl.to(glow, { scale: 9, opacity: 1, duration: 0.85, ease: "power4.in" }, "dive");
      tl.to(el, { backgroundColor: "#D7FF3D", duration: 0.15, ease: "none" }, "dive+=0.72");
      tl.add(onReveal, "dive+=0.85");
      tl.to(el, { autoAlpha: 0, duration: 0.7, ease: "power2.out" }, "dive+=0.85");

      // Ya armados los estados iniciales, mostrar el escenario.
      gsap.set(stage, { visibility: "visible" });

      // Clic o tecla: acelerar hasta el final.
      const skip = () => tl.timeScale(6);
      window.addEventListener("pointerdown", skip);
      window.addEventListener("keydown", skip);

      return () => {
        window.removeEventListener("pointerdown", skip);
        window.removeEventListener("keydown", skip);
        html.style.overflow = prevOverflow;
      };
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      data-intro=""
      aria-hidden="true"
      className="fixed inset-0 z-[100] overflow-hidden bg-[#0C0E0D] motion-reduce:hidden"
    >
      <noscript>
        <style>{"[data-intro]{display:none}"}</style>
      </noscript>
      <div data-stage="" className="invisible flex h-full flex-col items-center justify-center gap-[4vh]">
        <div className="relative w-[min(64vw,44vh,560px)]">
          <div
            data-glow=""
            className="pointer-events-none absolute aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(215,255,61,0.55),rgba(111,175,155,0.18)_55%,transparent)] blur-2xl"
            style={{ left: `${CORE_X * 100}%`, top: `${CORE_Y * 100}%` }}
          />
          <GalaxyMark className="relative block w-full overflow-visible" title="" />
        </div>
        <p className="flex font-sans text-[clamp(3.5rem,13vw,9.5rem)] leading-none font-extrabold tracking-[-0.05em] text-[#F3F0E8]">
          {WORD.map((ch, i) => (
            <span key={i} data-letter="" className="inline-block will-change-transform">
              {ch}
            </span>
          ))}
        </p>
      </div>
      <p
        data-hint=""
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[11px] tracking-[0.2em] text-[#A3A69D] uppercase"
      >
        clic o cualquier tecla para saltar
      </p>
    </div>
  );
}
