"use client";

// El logo en píxeles hecho partículas: cada píxel de la galaxia se dispersa al
// pasar el mouse cerca y vuelve a su lugar. Adaptado de Logo Particles de 21st.dev
// (4518), con los 125 píxeles reales del logo (GALAXY_PIXELS) en vez de un trazo
// SVG, y sin dependencias. Con prefers-reduced-motion queda armado y quieto.

import { useEffect, useRef } from "react";
import { GALAXY_COLORS, GALAXY_PIXELS } from "./sculptor-logo";

export type LogoParticlesProps = {
  /** Alto del logo en px. */
  size?: number;
  /** Radio de influencia del mouse en px. */
  radius?: number;
  className?: string;
};

// La grilla del logo mide 455 × 353 en sus coordenadas (27 × 21 celdas de 17).
const VIEW_W = 455;
const VIEW_H = 353;
const CELL = 13;

export function LogoParticles({ size = 320, radius = 70, className }: LogoParticlesProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = size / VIEW_H;
    const pad = radius;
    const w = VIEW_W * scale + pad * 2;
    const h = size + pad * 2;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const parts = GALAXY_PIXELS.map((p) => ({ bx: pad + p.x * scale, by: pad + p.y * scale, x: pad + p.x * scale, y: pad + p.y * scale, vx: 0, vy: 0, color: GALAXY_COLORS[p.tone] }));
    const side = CELL * scale;
    const mouse = { x: -9999, y: -9999 };
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, side, side);
      }
    };
    const step = () => {
      for (const p of parts) {
        const dx = p.x + side / 2 - mouse.x;
        const dy = p.y + side / 2 - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 0.01) {
          const force = (radius - dist) / radius;
          p.vx += (dx / dist) * force * 6;
          p.vy += (dy / dist) * force * 6;
        }
        // Resorte hacia su lugar y algo de roce.
        p.vx += (p.bx - p.x) * 0.06;
        p.vy += (p.by - p.y) * 0.06;
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x += p.vx;
        p.y += p.vy;
      }
      draw();
      frame = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      mouse.x = event.clientX - box.left;
      mouse.y = event.clientY - box.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    draw();
    if (!reduce) {
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
      frame = requestAnimationFrame(step);
    }
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [size, radius]);

  return <canvas ref={ref} role="img" aria-label="Logo de Sculptor: la galaxia en píxeles" className={className} />;
}
