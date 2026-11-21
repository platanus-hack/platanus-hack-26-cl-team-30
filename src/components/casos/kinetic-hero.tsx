"use client";

// Héroe de un caso: la frase aparece palabra por palabra (un solo momento de
// movimiento al cargar) y un foco suave sigue al mouse. Adaptado de 21st.dev
// (45143) con CSS, sin framer-motion. Con prefers-reduced-motion el texto aparece
// entero y quieto (casos.css). Solo Manrope: el titular es la pieza tipográfica.

import type { ReactNode } from "react";

export function KineticHero({ title, lede, children }: { title: [string, string]; lede: string; children: ReactNode }) {
  const words = [...title[0].split(/\s+/), ...title[1].split(/\s+/)];
  const breakAfter = title[0].split(/\s+/).length;
  const after = words.length * 0.07;
  return (
    <section
      className="cs-hero"
      aria-labelledby="caso-titulo"
      onMouseMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--cs-x", `${event.clientX - box.left}px`);
        event.currentTarget.style.setProperty("--cs-y", `${event.clientY - box.top}px`);
      }}
    >
      <div className="wrap pt-[clamp(4rem,2rem+6vw,8rem)]">
        <h1 id="caso-titulo" className="cs-h1">
          {words.map((word, i) => (
            <span key={i}>
              <span className="cs-word" style={{ ["--i" as string]: i }}>
                {word}
              </span>
              {i === breakAfter - 1 ? <br /> : " "}
            </span>
          ))}
        </h1>
        <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="cs-rise cs-lede max-w-[30rem] text-muted-foreground" style={{ ["--d" as string]: `${after + 0.1}s` }}>
            {lede}
          </p>
          <div className="cs-rise" style={{ ["--d" as string]: `${after + 0.2}s` }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
