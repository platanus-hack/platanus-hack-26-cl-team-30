"use client";

// Número que cuenta hasta su valor cuando entra en pantalla, y que anima el cambio
// si el valor se mueve (por ejemplo, al mover los pesos de la regla). Adaptado de
// Number Ticker de 21st.dev (20459) sin motion: requestAnimationFrame. Con
// prefers-reduced-motion el número aparece directo.

import { useEffect, useRef, useState } from "react";

export function Ticker({ value, decimals = 0, suffix = "", durationMs = 1200, className }: { value: number; decimals?: number; suffix?: string; durationMs?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  const seen = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const run = () => {
      if (reduce) {
        setShown(value);
        from.current = value;
        return;
      }
      const start = performance.now();
      const origin = from.current;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(origin + (value - origin) * eased);
        if (t < 1) frame = requestAnimationFrame(tick);
        else from.current = value;
      };
      frame = requestAnimationFrame(tick);
    };
    if (seen.current) {
      run();
      return () => cancelAnimationFrame(frame);
    }
    // La primera vez, cuenta desde 0 cuando el número entra en pantalla.
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      seen.current = true;
      observer.disconnect();
      run();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  const text = shown.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className={className}>
      {/* El valor final para lectores de pantalla; lo que cuenta es solo visual. */}
      <span className="sr-only">{value.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>
      <span aria-hidden className="tabular" suppressHydrationWarning>
        {text}
        {suffix}
      </span>
    </span>
  );
}
