"use client";

// Un dato reservado que se ve cifrado y nunca se descifra: los signos cambian
// mientras está en pantalla, pero el valor real no existe en el navegador (el
// servidor no lo envía). Adaptado de Encrypted Text de 21st.dev (18575) sin
// motion. Con prefers-reduced-motion los signos quedan quietos.

import { useEffect, useRef, useState } from "react";

const GLYPHS = "▒░▓█#$%&@*+=<>/";
const scramble = (length: number) => Array.from({ length }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join("");

export function EncryptedText({ length = 8, label = "Reservado", className }: { length?: number; label?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(() => "▒".repeat(length));

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearInterval(timer);
      if (entry.isIntersecting) timer = window.setInterval(() => setText(scramble(length)), 110);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [length]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="font-mono tracking-[0.12em]" suppressHydrationWarning>
        {text}
      </span>
    </span>
  );
}
