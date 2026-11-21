"use client";

// Piezas de movimiento de la landing, tomadas de la versión de Ramón.

import { useRef, type ReactNode } from "react";
import { EXPO, MOTION_OK, ScrollTrigger, SplitText, gsap, useGSAP } from "./gsap";

/** Título de sección que sube línea por línea la primera vez que se alcanza. */
export function Heading({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const split = SplitText.create(ref.current, { type: "lines", mask: "lines" });
      gsap.from(split.lines, {
        yPercent: 105,
        duration: 1,
        ease: EXPO,
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: "top 88%", once: true },
      });
      return () => split.revert();
    });
  });

  return (
    <h2 ref={ref} id={id} className={`h-section ${className}`}>
      {children}
    </h2>
  );
}

/** Los hijos entran uno tras otro cuando el grupo aparece en pantalla. */
export function Stagger({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.from(ref.current!.children, {
        opacity: 0,
        y: 22,
        duration: 0.9,
        ease: EXPO,
        stagger: 0.09,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
    });
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Franja horizontal sin fin. Avanza sola, acelera con el scroll y se detiene bajo
 * el puntero. Sin movimiento se vuelve una fila que se desplaza a mano.
 */
export function Marquee({
  children,
  seconds = 40,
  reverse = false,
  className = "",
  label,
}: {
  children: ReactNode;
  seconds?: number;
  reverse?: boolean;
  className?: string;
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const el = track.current;
        const host = root.current;
        if (!el || !host) return;
        const loop = gsap.fromTo(el, { xPercent: reverse ? -50 : 0 }, { xPercent: reverse ? 0 : -50, duration: seconds, ease: "none", repeat: -1 });
        const settle = gsap.quickTo(loop, "timeScale", { duration: 0.8, ease: "power2.out" });
        const trigger = ScrollTrigger.create({
          trigger: host,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            loop.timeScale(1 + Math.min(Math.abs(self.getVelocity()) / 400, 5));
            settle(1);
          },
        });
        const pause = () => gsap.to(loop, { timeScale: 0, duration: 0.5, overwrite: true });
        const resume = () => gsap.to(loop, { timeScale: 1, duration: 0.8, overwrite: true });
        host.addEventListener("pointerenter", pause);
        host.addEventListener("pointerleave", resume);
        return () => {
          trigger.kill();
          host.removeEventListener("pointerenter", pause);
          host.removeEventListener("pointerleave", resume);
        };
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} role="group" aria-label={label} className={`overflow-x-auto motion-safe:overflow-x-clip ${className}`}>
      <div ref={track} className="flex w-max">
        <div className="flex shrink-0">{children}</div>
        <div className="hidden shrink-0 motion-safe:flex" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
