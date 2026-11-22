"use client";

// Galaxia de la lámina «En vivo», sin textos: solo la conexión de las personas con
// la sala, en el estilo del logo (píxeles cuadrados y núcleo lima).
//
//   Entrar      cada persona que entra aparece como un punto con un destello y se une
//               al núcleo con una línea. Un punto por silla: 2 de la Clínica (eucalipto),
//               2 del Hospital Rural (mármol) y el Comité (lima).
//   Debate      por las líneas viajan pulsos: los agentes conversan.
//   Propuesta   el núcleo lima se enciende.
//   Acta        los puntos se funden en el núcleo y las partículas forman la galaxia NGC 253.
//
// Todo sale de los datos de la sala (props). Nada se mueve con clics ni por su cuenta:
// si nadie entra, no aparece ningún punto.

import { useEffect, useRef } from "react";

const SEAT_COLORS = ["#6FAF9B", "#6FAF9B", "#F3F0E8", "#F3F0E8", "#D7FF3D"];
const TONES = ["#2E5E51", "#6FAF9B", "#F3F0E8", "#D7FF3D"];
const LIME = "#D7FF3D";
const PARTICLES = 2400;

type Props = { people: number; phase: string | null; proposed: boolean; sealed: boolean };

type Star = { sx: number; sy: number; r: number; theta: number; tone: number; size: number; seed: number };

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function makeStars(): Star[] {
  return Array.from({ length: PARTICLES }, (_, i) => {
    const r = Math.pow(Math.random(), 1.7) + 0.01;
    const arm = i % 2;
    const theta = arm * Math.PI + r * 3.4 + gauss() * 0.42 * (0.3 + r * 0.5);
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * 1.15;
    return {
      sx: Math.cos(a) * d,
      sy: Math.sin(a) * d,
      r,
      theta,
      tone: r < 0.1 ? 3 : r < 0.35 ? 2 : r < 0.65 ? 1 : 0,
      size: r < 0.1 ? 3 : 1.6 + Math.random() * 1.4,
      seed: Math.random(),
    };
  });
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x: number) => Math.max(0, Math.min(1, x));

export function LiveGalaxy({ people, phase, proposed, sealed }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Objetivos que fija la sala; el dibujo se acerca a ellos cuadro a cuadro.
  const target = useRef({ people: 0, talk: 0, glow: 0, fused: 0 });
  const joinedAt = useRef<number[]>([]);

  useEffect(() => {
    const t = target.current;
    const now = performance.now();
    const n = Math.max(0, Math.min(5, people));
    for (let i = t.people; i < n; i++) joinedAt.current[i] = now + (i - t.people) * 120;
    t.people = n;
    const debating = !!phase && phase !== "positions";
    t.talk = debating || proposed || sealed ? 1 : 0;
    t.glow = sealed ? 1 : proposed || phase === "proposal" || phase === "decision" ? 0.75 : debating ? 0.35 : n > 0 ? 0.15 : 0.05;
    t.fused = sealed ? 1 : 0;
    if (n === 0 && !sealed) joinedAt.current = [];
  }, [people, phase, proposed, sealed]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stars = makeStars();
    const shown = [0, 0, 0, 0, 0];
    const cur = { talk: 0, glow: 0, fused: 0, form: 0 };
    let fusedSince = 0;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const box = el.getBoundingClientRect();
      w = box.width;
      h = box.height;
      el.width = Math.floor(w * dpr);
      el.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const frame = (now: number) => {
      const t = target.current;
      const k = still ? 1 : 0.06;
      for (let i = 0; i < 5; i++) shown[i] += ((i < t.people ? 1 : 0) - shown[i]) * (still ? 1 : 0.08);
      cur.talk += (t.talk - cur.talk) * k;
      cur.glow += (t.glow - cur.glow) * k;
      cur.fused += (t.fused - cur.fused) * (still ? 1 : 0.035);
      if (t.fused && !fusedSince) fusedSince = now;
      if (!t.fused) fusedSince = 0;
      // La galaxia se forma después de que los puntos llegan al núcleo.
      const formTarget = t.fused && (still || now - fusedSince > 900) ? 1 : 0;
      cur.form += (formTarget - cur.form) * (still ? 1 : formTarget ? 0.012 : 0.05);

      const time = still ? 0 : now / 1000;
      const cx = w / 2;
      const cy = h / 2;
      const unit = Math.min(w, h);
      const ring = unit * 0.32;
      const fuse = ease(clamp(cur.fused));
      const form = clamp(cur.form);

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#050706";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // Partículas: polvo disperso que, con el acta, se ordena en la galaxia.
      const spin = time * 0.18;
      const tilt = -0.6;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      for (const s of stars) {
        const local = ease(clamp(form * 1.5 - s.r * 0.5));
        const th = s.theta + spin / (0.35 + s.r);
        const gx = Math.cos(th) * s.r;
        const gy = Math.sin(th) * s.r * 0.42;
        const rx = (gx * ct - gy * st) * unit * 0.5;
        const ry = (gx * st + gy * ct) * unit * 0.5;
        const drift = still ? 0 : Math.sin(time * 0.3 + s.seed * 20) * 0.01;
        const dx = (s.sx + drift) * unit * 0.55;
        const dy = (s.sy - drift) * unit * 0.55;
        const x = cx + dx + (rx - dx) * local;
        const y = cy + dy + (ry - dy) * local;
        const twinkle = still ? 1 : 0.65 + 0.35 * Math.sin(time * (1 + s.seed * 2) + s.seed * 40);
        ctx.globalAlpha = (0.12 + local * (s.tone >= 2 ? 0.75 : 0.5)) * twinkle;
        ctx.fillStyle = local > 0.2 ? TONES[s.tone] : "#A3A69D";
        const size = s.size * (0.6 + local * 0.6);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }

      // Puntos de las personas, en un anillo alrededor del núcleo.
      const nodes = SEAT_COLORS.map((color, i) => {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 + (still ? 0 : Math.sin(time * 0.2) * 0.04);
        const rr = ring * (1 - fuse);
        return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, color, s: shown[i] * (1 - fuse * 0.9) };
      });

      // Líneas al núcleo y pulsos que viajan por ellas mientras los agentes conversan.
      for (const [i, n] of nodes.entries()) {
        if (n.s < 0.02) continue;
        const mx = (n.x + cx) / 2 + (cy - n.y) * 0.18;
        const my = (n.y + cy) / 2 + (n.x - cx) * 0.18;
        ctx.globalAlpha = 0.35 * n.s;
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.quadraticCurveTo(mx, my, cx, cy);
        ctx.stroke();
        if (cur.talk > 0.05) {
          for (let p = 0; p < 2; p++) {
            const u = (time * 0.55 + i * 0.21 + p * 0.5) % 1;
            const back = p === 1;
            const q = back ? 1 - u : u;
            const px = (1 - q) * (1 - q) * n.x + 2 * (1 - q) * q * mx + q * q * cx;
            const py = (1 - q) * (1 - q) * n.y + 2 * (1 - q) * q * my + q * q * cy;
            ctx.globalAlpha = cur.talk * n.s * 0.9;
            ctx.fillStyle = back ? LIME : n.color;
            ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
          }
        }
      }

      // Cada punto: halo, cuadrado y una onda al entrar.
      for (const [i, n] of nodes.entries()) {
        if (n.s < 0.02) continue;
        const since = (now - (joinedAt.current[i] ?? -1e9)) / 1000;
        if (since > 0 && since < 1.4) {
          ctx.globalAlpha = (1 - since / 1.4) * 0.8;
          ctx.strokeStyle = n.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 8 + since * unit * 0.09, 0, Math.PI * 2);
          ctx.stroke();
        }
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, unit * 0.06);
        halo.addColorStop(0, n.color);
        halo.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.35 * n.s;
        ctx.fillStyle = halo;
        ctx.fillRect(n.x - unit * 0.06, n.y - unit * 0.06, unit * 0.12, unit * 0.12);
        const size = 12 * n.s * (1 + (still ? 0 : Math.sin(time * 2 + i) * 0.08));
        ctx.globalAlpha = n.s;
        ctx.fillStyle = n.color;
        ctx.fillRect(n.x - size / 2, n.y - size / 2, size, size);
      }

      // Núcleo lima: se enciende con la propuesta y recibe a todos con el acta.
      const glow = cur.glow + fuse * 0.6;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * (0.12 + glow * 0.12));
      core.addColorStop(0, "rgba(215,255,61,0.9)");
      core.addColorStop(0.4, "rgba(215,255,61,0.25)");
      core.addColorStop(1, "transparent");
      ctx.globalAlpha = Math.min(1, 0.25 + glow * 0.6);
      ctx.fillStyle = core;
      ctx.fillRect(cx - unit * 0.3, cy - unit * 0.3, unit * 0.6, unit * 0.6);
      const cell = 6 + glow * 3;
      ctx.globalAlpha = Math.min(1, 0.5 + glow * 0.5);
      ctx.fillStyle = LIME;
      for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 0; gy++) ctx.fillRect(cx + gx * (cell + 2) - cell / 2, cy + gy * (cell + 2), cell, cell);

      // Destello cuando los puntos llegan al núcleo.
      if (fusedSince && !still) {
        const f = (now - fusedSince) / 1000;
        const peak = Math.max(0, 1 - Math.abs(f - 0.9) / 0.5);
        if (peak > 0) {
          ctx.globalAlpha = peak * 0.7;
          ctx.fillStyle = "#F3F0E8";
          ctx.beginPath();
          ctx.arc(cx, cy, unit * 0.04 + peak * unit * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvas} aria-label="Galaxia: un punto por cada persona que entra a la sala" className="h-full w-full" />;
}
