"use client";

// La galaxia de Sculptor (NGC 253 en píxeles, el logo) que se arma con la gente.
// Reemplaza a la esfera orbital de la pantalla grande.
//
// Los 125 píxeles del logo se reparten en cinco grupos, uno por asiento:
//   - los cuatro brazos (verde oscuro y eucalipto), uno por cada rol de hospital;
//   - el disco marfil, para el Comité;
//   - el núcleo lima, que solo se enciende cuando se decide.
//
// Dos modos:
//   - «armado»: la galaxia parte como polvo suelto; cada persona que entra trae
//     su parte, que vuela desde fuera y encaja píxel a píxel.
//   - «nemo»: parte en el Punto Nemo, el lugar del océano más alejado de cualquier
//     persona: un solo píxel encendido, solo, con un sonar. Cada persona que entra
//     trae su parte desde el borde de la pantalla hasta ese punto, y el píxel
//     solitario termina siendo el centro de la galaxia. Es la idea del producto:
//     cada organización decide sola, con sus datos, hasta que se juntan.
//
// Canvas 2D sin dependencias. El canvas es decorativo (aria-hidden); los textos van
// en el DOM. Con prefers-reduced-motion se dibuja el estado final, sin animar.

import { useEffect, useRef, type CSSProperties } from "react";
import { GALAXY_COLORS, GALAXY_PIXELS } from "./sculptor-logo";

export type PixelGalaxyMode = "armado" | "nemo";
export type PixelGalaxySeat = { id: string; connected: boolean; tone: number };
type Theme = "dark" | "light";
type RGB = readonly [number, number, number];

export interface PixelGalaxyProps {
  /** Asientos de la sala en orden: 4 de hospital y el Comité. Los que sobran se ignoran. */
  seats: PixelGalaxySeat[];
  /** La decisión quedó sellada: se enciende el núcleo. */
  sealed: boolean;
  /** Id del asiento cuyo agente acaba de hablar: sus píxeles brillan un instante. */
  speaking?: string | null;
  /** Cambia en cada mensaje nuevo, para repetir el brillo aunque hable el mismo asiento. */
  speakingKey?: string | number;
  mode?: PixelGalaxyMode;
  /** «hero»: protagonista. «backdrop»: fondo tenue detrás de la conversación. */
  variant?: "hero" | "backdrop";
  theme?: Theme;
  /** Colores de cada asiento (los de la pantalla grande), para el destello al llegar. */
  seatColors?: string[];
  className?: string;
  style?: CSSProperties;
}

const hex = (v: string): RGB => [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const CELL = 13;
const VIEW_W = 27 * 17 - 4;
const VIEW_H = 21 * 17 - 4;
const CX = 13 * 17 + CELL / 2;
const CY = 9.5 * 17 + CELL / 2;
const LIME = hex(GALAXY_COLORS.L);
const DEFAULT_SEAT_COLORS = ["#6faf9b", "#9fd2c1", "#c58f7b", "#e0b8a6", "#b9a7ff"];

// Eje mayor de la galaxia (va de arriba-izquierda a abajo-derecha).
const AXIS = (() => {
  const len = Math.hypot(1, 0.62);
  return { x: 1 / len, y: 0.62 / len };
})();

type Px = {
  hx: number; // posición final (en unidades del lienzo del logo)
  hy: number;
  tone: keyof typeof GALAXY_COLORS;
  group: number; // 0-3 brazos, 4 disco del Comité, 5 núcleo
  dist: number; // distancia al centro, en celdas
  seed: number;
  // Animación
  from: { x: number; y: number };
  ctrl: { x: number; y: number };
  start: number; // ms en que empieza a viajar (Infinity = no ha llegado)
  dur: number;
  shown: boolean;
  flash: number; // ms en que debe destellar
  lit: number; // ms en que se encendió (núcleo)
};

/** Reparte los píxeles en los cinco grupos. Determinista: igual en servidor y cliente. */
function buildPixels(): Px[] {
  return GALAXY_PIXELS.map((p, i) => {
    const px = p.x + CELL / 2;
    const py = p.y + CELL / 2;
    const dx = px - CX;
    const dy = py - CY;
    const along = dx * AXIS.x + dy * AXIS.y;
    const perp = dx * -AXIS.y + dy * AXIS.x;
    let group: number;
    if (p.tone === "L") group = 5;
    else if (p.tone === "W") group = 4;
    else group = (along < 0 ? 0 : 2) + (perp < 0 ? 0 : 1);
    return {
      hx: p.x,
      hy: p.y,
      tone: p.tone,
      group,
      dist: Math.hypot(dx, dy) / 17,
      seed: ((i * 9301 + 49297) % 233280) / 233280,
      from: { x: p.x, y: p.y },
      ctrl: { x: p.x, y: p.y },
      start: Infinity,
      dur: 900,
      shown: false,
      flash: -Infinity,
      lit: -Infinity,
    };
  });
}

// El píxel más central del núcleo: en el modo «nemo» es el que está solo al comienzo.
const NEMO_INDEX = (() => {
  const px = buildPixels();
  return px.reduce((best, p, i) => (p.group === 5 && (px[best].group !== 5 || p.dist < px[best].dist) ? i : best), 0);
})();

type Input = {
  connected: boolean[]; // por grupo 0-4
  sealed: boolean;
  speakingGroup: number | null;
  speakingKey: string;
  mode: PixelGalaxyMode;
  variant: "hero" | "backdrop";
  theme: Theme;
  seatColors: RGB[];
};

function createEngine(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pixels = buildPixels();
  let input: Input | null = null;
  let prev = { connected: [false, false, false, false, false], sealed: false, speakingKey: "", mode: "" as string };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let sealedAt = -Infinity;
  let nemoGone = -Infinity;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  /** Hace llegar los píxeles de un grupo. */
  const arrive = (group: number, now: number, mode: PixelGalaxyMode) => {
    const members = pixels.filter((p) => p.group === group);
    members.forEach((p) => {
      const ang = Math.atan2(p.hy + CELL / 2 - CY, p.hx + CELL / 2 - CX) + (p.seed - 0.5) * 0.9;
      if (mode === "nemo") {
        // Llegan desde fuera de la pantalla, por el lado de su brazo, en curva.
        const far = Math.max(VIEW_W, VIEW_H) * (1.3 + p.seed * 0.5);
        const side = group < 4 ? [Math.PI * 1.15, Math.PI * 0.75, -Math.PI * 0.2, Math.PI * 0.2][group] : ang;
        const a = side + (p.seed - 0.5) * 0.7;
        p.from = { x: CX + Math.cos(a) * far, y: CY + Math.sin(a) * far };
        const mid = { x: (p.from.x + p.hx) / 2, y: (p.from.y + p.hy) / 2 };
        p.ctrl = { x: mid.x + Math.cos(a + Math.PI / 2) * far * 0.35, y: mid.y + Math.sin(a + Math.PI / 2) * far * 0.35 };
        p.dur = 1500 + p.seed * 700;
        p.start = now + p.dist * 45 + p.seed * 260;
      } else {
        // Polvo cercano que se ordena.
        const r = 70 + p.seed * 120;
        p.from = { x: p.hx + Math.cos(ang) * r, y: p.hy + Math.sin(ang) * r };
        p.ctrl = { x: (p.from.x + p.hx) / 2, y: (p.from.y + p.hy) / 2 };
        p.dur = 850 + p.seed * 350;
        p.start = now + p.dist * 38 + (p.seed * 7) * 12;
      }
      p.shown = true;
      p.flash = p.start + p.dur * 0.85;
    });
  };

  const leave = (group: number) => {
    pixels.filter((p) => p.group === group).forEach((p) => {
      p.shown = false;
      p.start = Infinity;
    });
  };

  const sync = (next: Input) => {
    const now = performance.now();
    const modeChanged = next.mode !== prev.mode;
    if (modeChanged) {
      pixels.forEach((p) => {
        p.shown = false;
        p.start = Infinity;
        p.lit = -Infinity;
      });
      prev = { connected: [false, false, false, false, false], sealed: false, speakingKey: "", mode: next.mode };
      sealedAt = -Infinity;
      nemoGone = -Infinity;
    }
    next.connected.forEach((on, g) => {
      if (on && !prev.connected[g]) {
        if (reduced) pixels.filter((p) => p.group === g).forEach((p) => { p.shown = true; p.start = -Infinity; });
        else arrive(g, now, next.mode);
        if (nemoGone === -Infinity) nemoGone = now;
      }
      if (!on && prev.connected[g]) leave(g);
    });
    if (next.sealed && !prev.sealed) {
      sealedAt = now;
      pixels.filter((p) => p.group === 5).forEach((p) => {
        p.shown = true;
        p.start = -Infinity;
        p.lit = reduced ? -Infinity : now + p.dist * 160;
      });
    }
    if (!next.sealed && prev.sealed) {
      sealedAt = -Infinity;
      pixels.filter((p) => p.group === 5).forEach((p) => { p.shown = false; p.lit = -Infinity; });
    }
    if (next.speakingGroup !== null && next.speakingKey !== prev.speakingKey) {
      pixels.filter((p) => p.group === next.speakingGroup).forEach((p) => { p.flash = now + p.dist * 25; });
    }
    if (!next.connected.some(Boolean)) nemoGone = -Infinity;
    prev = { connected: [...next.connected], sealed: next.sealed, speakingKey: next.speakingKey, mode: next.mode };
    input = next;
  };

  const draw = (now: number) => {
    raf = requestAnimationFrame(draw);
    if (!input) return;
    const { theme, variant, mode, seatColors } = input;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const fit = variant === "hero" ? 0.62 : 0.9;
    const scale = Math.min((width * fit) / VIEW_W, (height * fit) / VIEW_H);
    const ox = width / 2 - CX * scale;
    const oy = height / 2 - CY * scale;
    const base = variant === "backdrop" ? 0.32 : 1;
    const dark = theme === "dark";
    const t = now / 1000;
    const anyone = input.connected.some(Boolean);

    // Polvo de fondo (estrellas lejanas), muy tenue.
    if (!reduced) {
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 97.3) % 100) / 100;
        const sy = ((i * 53.9 + 17) % 100) / 100;
        const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + (i % 5) * 0.2) + i);
        ctx.fillStyle = dark ? rgba([243, 240, 230], 0.05 + tw * 0.07) : rgba([36, 64, 58], 0.04 + tw * 0.05);
        const s = 1.5 + (i % 3);
        ctx.fillRect(sx * width, sy * height, s, s);
      }
    }

    // Modo Nemo, antes de que llegue alguien: el píxel solo y su sonar.
    if (mode === "nemo") {
      const p = pixels[NEMO_INDEX];
      const fade = nemoGone === -Infinity ? 1 : 1 - clamp01((now - nemoGone) / 1200);
      const x = ox + (p.hx + CELL / 2) * scale;
      const y = oy + (p.hy + CELL / 2) * scale;
      if (fade > 0 && !reduced) {
        for (let k = 0; k < 3; k++) {
          const ph = ((t * 0.45 + k / 3) % 1);
          ctx.beginPath();
          ctx.arc(x, y, 8 + ph * Math.min(width, height) * 0.42, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(dark ? LIME : hex("#4f7c6d"), (1 - ph) * (dark ? 0.35 : 0.45) * fade * base);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      if (!input.sealed) {
        const blink = reduced ? 1 : 0.65 + 0.35 * Math.sin(t * 2.4);
        const s = CELL * scale;
        ctx.shadowColor = rgba(LIME, 0.9);
        ctx.shadowBlur = (anyone ? 8 : 18) * blink;
        ctx.fillStyle = rgba(LIME, (anyone ? 0.85 : blink) * base);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        ctx.shadowBlur = 0;
        if (!dark) {
          ctx.strokeStyle = rgba([36, 64, 58], 0.55 * base);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - s / 2 + 0.75, y - s / 2 + 0.75, s - 1.5, s - 1.5);
        }
      }
    } else if (!anyone && !reduced) {
      // Modo armado sin nadie: unos pocos píxeles del halo flotando, sueltos.
      pixels.forEach((p, i) => {
        if (p.dist < 9 || i % 3) return;
        const drift = 6 * Math.sin(t * 0.7 + p.seed * 9);
        const a = (0.18 + 0.12 * Math.sin(t * 1.3 + i)) * base;
        ctx.fillStyle = rgba(hex(GALAXY_COLORS[p.tone]), a);
        const s = CELL * scale;
        ctx.fillRect(ox + (p.hx + drift) * scale, oy + (p.hy - drift * 0.6) * scale, s, s);
      });
    }

    // La galaxia: los píxeles que ya llegaron o vienen viajando.
    const s = CELL * scale;
    for (const p of pixels) {
      if (!p.shown) continue;
      const k = p.start === -Infinity ? 1 : clamp01((now - p.start) / p.dur);
      if (k <= 0) continue;
      let x: number;
      let y: number;
      let a: number;
      if (k >= 1) {
        // Respira apenas, para que no se vea congelada.
        const breathe = reduced ? 0 : 0.6 * Math.sin(t * 1.1 + p.seed * 6);
        x = p.hx;
        y = p.hy + breathe;
        a = 1;
      } else {
        const e = mode === "nemo" ? easeInOutCubic(k) : easeOutExpo(k);
        const u = 1 - e;
        x = u * u * p.from.x + 2 * u * e * p.ctrl.x + e * e * p.hx;
        y = u * u * p.from.y + 2 * u * e * p.ctrl.y + e * e * p.hy;
        a = Math.min(1, k * 2.2);
      }

      let color = hex(GALAXY_COLORS[p.tone]);
      if (!dark && p.tone === "W") color = hex("#e9e3d3");
      // Destello en el color del asiento al encajar o cuando su agente habla.
      const since = now - p.flash;
      if (since > -50 && since < 900 && p.group < 5) {
        const f = since < 0 ? 0 : 1 - since / 900;
        color = mix(color, seatColors[p.group] ?? color, f * 0.85);
        a = Math.min(1, a + f * 0.3);
      }
      // Núcleo: se enciende con un destello y queda latiendo.
      let glow = 0;
      if (p.group === 5) {
        const on = now - p.lit;
        if (p.lit !== -Infinity && on < 0) continue;
        glow = p.lit === -Infinity ? 0.5 : on < 700 ? 1 - on / 700 + 0.4 : 0.4 + 0.15 * Math.sin(t * 2 + p.seed * 4);
        if (reduced) glow = 0.4;
      }

      const px = ox + x * scale;
      const py = oy + y * scale;
      const pop = p.group === 5 && p.lit !== -Infinity && now - p.lit < 400 ? 1 + 0.6 * (1 - (now - p.lit) / 400) : 1;
      const ss = s * pop;
      if (glow > 0) {
        ctx.shadowColor = rgba(LIME, 0.9);
        ctx.shadowBlur = 14 * glow;
      }
      ctx.fillStyle = rgba(color, a * base);
      ctx.fillRect(px + (s - ss) / 2, py + (s - ss) / 2, ss, ss);
      ctx.shadowBlur = 0;
      if (!dark && (p.tone === "W" || p.tone === "L")) {
        ctx.strokeStyle = rgba([36, 64, 58], 0.35 * a * base);
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      }
    }

    // Onda al sellar: un anillo lima que sale del núcleo.
    if (sealedAt !== -Infinity && !reduced) {
      const k = (now - sealedAt) / 1600;
      if (k < 1) {
        ctx.beginPath();
        ctx.arc(ox + CX * scale, oy + CY * scale, 10 + easeOutExpo(k) * Math.max(width, height) * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(LIME, (1 - k) * 0.6 * base);
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.stroke();
      }
    }
  };
  raf = requestAnimationFrame(draw);

  return {
    sync,
    destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
    },
  };
}

export function PixelGalaxy({
  seats,
  sealed,
  speaking = null,
  speakingKey = "",
  mode = "armado",
  variant = "hero",
  theme = "dark",
  seatColors = DEFAULT_SEAT_COLORS,
  className,
  style,
}: PixelGalaxyProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof createEngine>>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const created = createEngine(canvas.current);
    engine.current = created;
    return () => {
      created?.destroy();
      engine.current = null;
    };
  }, []);

  const five = seats.slice(0, 5);
  const connected = [0, 1, 2, 3, 4].map((i) => Boolean(five[i]?.connected));
  const speakingGroup = speaking ? five.findIndex((seat) => seat.id === speaking) : -1;
  const key = connected.map(Number).join("");
  const colorsKey = seatColors.join(",");
  useEffect(() => {
    engine.current?.sync({
      connected,
      sealed,
      speakingGroup: speakingGroup >= 0 ? speakingGroup : null,
      speakingKey: `${speaking ?? ""}:${speakingKey}`,
      mode,
      variant,
      theme,
      seatColors: seatColors.map(hex),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- «key» y «colorsKey» resumen los arreglos.
  }, [key, sealed, speakingGroup, speaking, speakingKey, mode, variant, theme, colorsKey]);

  const count = connected.filter(Boolean).length;
  return (
    <div className={["relative", className].filter(Boolean).join(" ")} style={{ minHeight: 320, ...style }}>
      <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {mode === "nemo" && variant === "hero" && (
        <div
          aria-hidden={count > 0}
          className="pg-nemo"
          data-gone={count > 0}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "24%",
            textAlign: "center",
            pointerEvents: "none",
            color: theme === "dark" ? "#f3f0e6" : "#24403a",
            fontFamily: "'Manrope Variable', Manrope, system-ui, sans-serif",
          }}
        >
          <style>{`
            .pg-nemo { transition: opacity .9s ease, filter .9s ease, transform .9s ease; }
            .pg-nemo[data-gone="true"] { opacity: 0; filter: blur(8px); transform: translateY(12px); }
            .pg-nemo .pg-line { display: block; animation: pg-in 1s cubic-bezier(.16,1,.3,1) both; }
            .pg-nemo .pg-line:nth-child(2) { animation-delay: .25s; }
            .pg-nemo .pg-line:nth-child(3) { animation-delay: .5s; }
            @keyframes pg-in { from { opacity: 0; filter: blur(10px); transform: translateY(10px); } }
            @media (prefers-reduced-motion: reduce) { .pg-nemo, .pg-nemo .pg-line { animation: none; transition: none; } }
          `}</style>
          <span className="pg-line" style={{ fontSize: 13, letterSpacing: ".28em", textTransform: "uppercase", opacity: 0.7 }}>
            Punto Nemo · 48°52′ S · 123°23′ O
          </span>
          <span className="pg-line" style={{ fontSize: "clamp(22px, 2.6vw, 38px)", fontWeight: 800, letterSpacing: "-.03em", marginTop: 6 }}>
            El lugar más alejado de cualquier persona.
          </span>
          <span className="pg-line" style={{ fontSize: "clamp(14px, 1.3vw, 18px)", opacity: 0.75, marginTop: 6 }}>
            Así decide hoy cada organización: sola.
          </span>
        </div>
      )}
    </div>
  );
}

export default PixelGalaxy;
