"use client";

// Héroe de un caso con tipografía cinética: la frase aparece palabra por palabra y
// un foco suave sigue al mouse. Adaptado de 21st.dev (45143) con CSS, sin
// framer-motion; con prefers-reduced-motion el texto aparece entero y quieto (casos.css).

import type { ReactNode } from "react";

export function KineticHero({ kicker, title, lede, children }: { kicker: ReactNode; title: [string, string]; lede: string; children: ReactNode }) {
  const first = title[0].split(/\s+/);
  const second = title[1].split(/\s+/);
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
      <div className="wrap flex flex-col items-center py-16 text-center lg:py-28">
        <div className="cs-rise" style={{ ["--d" as string]: "0s" }}>
          {kicker}
        </div>
        <h1 id="caso-titulo" className="h-hero mt-6 max-w-[16ch]">
          {first.map((word, i) => (
            <span key={`a${i}`} className="cs-word" style={{ ["--i" as string]: i }}>
              {word}
            </span>
          ))}{" "}
          {second.map((word, i) => (
            <span key={`b${i}`} className="cs-word serif text-brand" style={{ ["--i" as string]: first.length + i }}>
              {word}
            </span>
          ))}
        </h1>
        <p className="cs-rise lede mt-6 max-w-[32rem] text-muted-foreground" style={{ ["--d" as string]: `${(first.length + second.length) * 0.07 + 0.1}s` }}>
          {lede}
        </p>
        <div className="cs-rise mt-9 flex flex-col items-center gap-6" style={{ ["--d" as string]: `${(first.length + second.length) * 0.07 + 0.2}s` }}>
          {children}
        </div>
      </div>
    </section>
  );
}
