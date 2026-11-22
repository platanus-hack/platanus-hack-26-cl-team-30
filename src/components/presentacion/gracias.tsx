"use client";

// Lámina final: «gracias» hecho de píxeles, como el logo. Los píxeles parten girando
// en una galaxia (dos brazos, núcleo lima) y vuelan a su lugar en la palabra, de
// izquierda a derecha. Después una onda de luz la recorre sin parar y el puntero
// empuja los píxeles, que vuelven a su lugar como resortes.
// Con movimiento reducido la palabra aparece armada y quieta.

import { useEffect, useRef } from "react";

const MARBLE = [243, 240, 232];
const EUCA = [111, 175, 155];
const PATINA = [46, 94, 81];
const LIME = [215, 255, 61];

type Px = { x: number; y: number; vx: number; vy: number; tx: number; ty: number; sx: number; sy: number; delay: number; color: number[]; seed: number };

export function Gracias() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let cancelled = false;
    const pointer = { x: -1e4, y: -1e4 };

    const start = async () => {
      await document.fonts.ready;
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = el.getBoundingClientRect();
      const w = box.width;
      const h = box.height;
      el.width = Math.floor(w * dpr);
      el.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 1. Rasterizar la palabra en una grilla chica: cada celda llena es un píxel.
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      // La misma letra de la palabra «sculptor» del logo.
      const font = '"Manrope Variable", Manrope, sans-serif';
      const rows = 30;
      octx.font = `800 ${rows}px ${font}`;
      const cols = Math.ceil(octx.measureText("gracias").width) + 4;
      off.width = cols;
      off.height = Math.ceil(rows * 1.3);
      octx.font = `800 ${rows}px ${font}`;
      octx.fillStyle = "#fff";
      octx.textBaseline = "alphabetic";
      octx.fillText("gracias", 2, rows);
      const data = octx.getImageData(0, 0, off.width, off.height).data;

      const cell = Math.min((w * 0.86) / cols, (h * 0.62) / off.height);
      const ox = (w - cols * cell) / 2;
      const oy = (h - off.height * cell) / 2 - h * 0.04;
      const cx = w / 2;
      const cy = h / 2;
      const pixels: Px[] = [];
      for (let y = 0; y < off.height; y++) {
        for (let x = 0; x < cols; x++) {
          if (data[(y * off.width + x) * 4 + 3] < 140) continue;
          const tx = ox + x * cell;
          const ty = oy + y * cell;
          // Punto de partida en una galaxia de dos brazos alrededor del centro.
          const r = Math.pow(Math.random(), 0.8) * Math.min(w, h) * 0.42;
          const arm = Math.random() < 0.5 ? 0 : Math.PI;
          const a = arm + (r / (Math.min(w, h) * 0.42)) * 3.2 + (Math.random() - 0.5) * 0.6;
          const sx = cx + Math.cos(a) * r;
          const sy = cy + Math.sin(a) * r * 0.45;
          const roll = Math.random();
          const color = roll < 0.06 ? LIME : roll < 0.22 ? EUCA : roll < 0.28 ? PATINA : MARBLE;
          pixels.push({ x: still ? tx : sx, y: still ? ty : sy, vx: 0, vy: 0, tx, ty, sx, sy, delay: (x / cols) * 1.1 + Math.random() * 0.25, color, seed: Math.random() });
        }
      }

      const t0 = performance.now();
      const size = cell * 0.82;
      const frame = (now: number) => {
        const t = still ? 10 : (now - t0) / 1000;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        for (const p of pixels) {
          const local = t - 0.3 - p.delay;
          if (local < 0) {
            // Todavía en la galaxia: gira alrededor del centro.
            const ang = t * 0.9 * (1 - Math.min(1, Math.hypot(p.sx - cx, p.sy - cy) / (w * 0.5)) * 0.5);
            const dx = p.sx - cx;
            const dy = (p.sy - cy) / 0.45;
            p.x = cx + dx * Math.cos(ang) - dy * Math.sin(ang);
            p.y = cy + (dx * Math.sin(ang) + dy * Math.cos(ang)) * 0.45;
          } else if (!still) {
            // Resorte hacia su lugar en la palabra, más el empujón del puntero.
            const k = Math.min(1, local * 0.9) * 0.08;
            p.vx += (p.tx - p.x) * k;
            p.vy += (p.ty - p.y) * k;
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            const radius = cell * 9;
            if (d2 < radius * radius) {
              const d = Math.sqrt(d2) || 1;
              const push = (1 - d / radius) * cell * 1.6;
              p.vx += (dx / d) * push;
              p.vy += (dy / d) * push;
            }
            p.vx *= 0.82;
            p.vy *= 0.82;
            p.x += p.vx;
            p.y += p.vy;
          }
          // Onda de luz que recorre la palabra de izquierda a derecha.
          const wave = still ? 0 : Math.max(0, 1 - Math.abs(((p.tx - ox) / (cols * cell)) * 3 - ((t * 0.55) % 4.5) + 0.75) * 1.4);
          const twinkle = still ? 1 : 0.8 + 0.2 * Math.sin(t * 2 + p.seed * 30);
          const c = wave > 0 ? p.color.map((v, i) => Math.round(v + (LIME[i] - v) * wave * 0.7)) : p.color;
          ctx.globalAlpha = Math.min(1, (0.85 + wave * 0.4) * twinkle);
          ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
          ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        if (!still) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    void start();

    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      pointer.x = e.clientX - box.left;
      pointer.y = e.clientY - box.top;
    };
    const onLeave = () => {
      pointer.x = -1e4;
      pointer.y = -1e4;
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="relative h-[78svh] w-full">
      <canvas ref={canvas} aria-label="Gracias" className="absolute inset-0 h-full w-full" />
      <p className="absolute inset-x-0 bottom-[6%] text-center font-mono text-[clamp(0.8rem,1.1vw,1.1rem)] tracking-[0.3em] text-(--piedra) uppercase">
        Equipo 30 · Platanus Hack 26 ft. Buk · <span className="text-(--cincel)">sculptor</span>
      </p>
    </div>
  );
}
