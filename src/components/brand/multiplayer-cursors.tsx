"use client";

// Varias personas en la misma sala: cursores con nombre que se mueven sobre el
// contenido (la Clínica, el Hospital Rural y el Comité), y el tuyo con una lente
// de «rayos X» que deja ver una capa oculta solo donde estás. Adaptado de X-Ray
// Figma Cursor de 21st.dev (46517) con GSAP (ya instalado). Con
// prefers-reduced-motion los cursores quedan quietos y la lente no aparece.

import { useRef, type ReactNode } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";

export type CursorPerson = { name: string; color: string };

const DEFAULT_PEOPLE: CursorPerson[] = [
  { name: "Clínica", color: "#6faf9b" },
  { name: "Hospital Rural", color: "#c58f7b" },
  { name: "Comité", color: "#b9aaf0" },
];

function Pointer({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 2l16 9-7 2-3 7z" fill={color} stroke="#151515" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function MultiplayerCursors({ children, reveal, people = DEFAULT_PEOPLE, className }: { children: ReactNode; reveal?: ReactNode; people?: CursorPerson[]; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // Cada persona recorre su propio camino, sin repetir el de las otras.
        root.current?.querySelectorAll<HTMLElement>("[data-cursor]").forEach((element, index) => {
          const timeline = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 2.4 + index * 0.4, ease: "sine.inOut" } });
          const spots = [
            [12 + index * 22, 20 + index * 18],
            [55 - index * 10, 35 + index * 12],
            [30 + index * 15, 70 - index * 14],
          ];
          spots.forEach(([x, y]) => timeline.to(element, { left: `${x}%`, top: `${y}%` }));
        });
        // La lente sigue al mouse.
        const box = root.current;
        const glass = lens.current;
        if (!box || !glass) return;
        // Las variables llevan px: sin unidad, clip-path no es válido y la capa se vería entera.
        const move = (event: PointerEvent) => {
          const rect = box.getBoundingClientRect();
          glass.style.opacity = "1";
          gsap.to(glass, { "--x": `${event.clientX - rect.left}px`, "--y": `${event.clientY - rect.top}px`, duration: 0.3, ease: "power3", overwrite: true });
        };
        const leave = () => {
          glass.style.opacity = "0";
        };
        box.addEventListener("pointermove", move);
        box.addEventListener("pointerleave", leave);
        return () => {
          box.removeEventListener("pointermove", move);
          box.removeEventListener("pointerleave", leave);
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={`relative overflow-hidden ${className ?? ""}`}>
      {children}
      {reveal && (
        <div
          ref={lens}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
          style={{ clipPath: "circle(90px at var(--x, -200px) var(--y, -200px))" }}
        >
          {reveal}
        </div>
      )}
      {people.map((person, index) => (
        <span key={person.name} data-cursor className="pointer-events-none absolute flex items-start gap-1" style={{ left: `${12 + index * 22}%`, top: `${20 + index * 18}%` }} aria-hidden>
          <Pointer color={person.color} />
          <span className="mt-4 rounded-full px-2.5 py-1 text-sm font-bold whitespace-nowrap text-[#151515]" style={{ background: person.color }}>
            {person.name}
          </span>
        </span>
      ))}
    </div>
  );
}
