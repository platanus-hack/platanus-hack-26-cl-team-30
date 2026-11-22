"use client";

// Variante «relevo» de la galaxia (copia de galaxy.tsx; el original no se toca).
// Idea: la gente se conecta A TRAVÉS de Sculptor. En el centro de la esfera está
// Sculptor; cada persona tiene un solo rayo hacia ese centro y nunca una línea
// directa con otra. Cuando alguien entra o su agente habla, sale un pulso de luz de
// su nodo al centro, el centro destella y desde ahí parten pulsos hacia los demás.
//
// Galaxia de la pantalla grande: una esfera que se arma a medida que entra la
// gente. Cada asiento conectado enciende un nodo, una órbita de su color y su
// región de la esfera; con todos conectados la esfera queda completa, y al sellar
// la decisión se calma y se vuelve verde.
//
// Es un port a React del prototipo de Nahum (docs/diseno/nahum/resultado_orbital_live.html),
// con canvas 2D y sin dependencias. Se quitó lo que el prototipo simulaba con
// teclas: aquí los nodos salen solo de los asientos que llegan por el SSE.
// El canvas es decorativo (aria-hidden): el contador y los nombres van en el DOM.

import { useEffect, useRef } from "react";
import { SEAT_TONES, type Seat } from "./seats";

type Theme = "dark" | "light";
type Variant = "hero" | "backdrop";
type RGB = readonly [number, number, number];

const hex = (value: string): RGB => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
const blend = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, alpha = 1) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${alpha.toFixed(3)})`;

// Paleta oficial (docs/DISENO.md). «calm» es el verde de resuelto de la pantalla grande.
const PALETTE: Record<Theme, { calm: RGB; ink: RGB; accent: RGB; deep: RGB }> = {
  dark: { calm: hex("#86efac"), ink: hex("#fffdf8"), accent: hex("#6faf9b"), deep: hex("#151515") },
  light: { calm: hex("#15803d"), ink: hex("#24403a"), accent: hex("#6faf9b"), deep: hex("#eaf5f1") },
};

// Inclinación y velocidad de la órbita de cada asiento (del prototipo).
const ORBITS = [
  { tiltX: 0.35, tiltZ: 0.3, speed: 0.6 },
  { tiltX: -0.45, tiltZ: -0.35, speed: -0.56 },
  { tiltX: 0.76, tiltZ: -0.52, speed: 0.52 },
  { tiltX: -0.72, tiltZ: 0.56, speed: -0.48 },
  { tiltX: 0.14, tiltZ: 0.88, speed: 0.68 },
  { tiltX: -0.25, tiltZ: -0.82, speed: -0.64 },
];
const TONES: Record<Theme, RGB[]> = { dark: SEAT_TONES.map((tone) => hex(tone.dark)), light: SEAT_TONES.map((tone) => hex(tone.light)) };
const IVORY = hex("#fffdf8");
const TILT = 0.2;
const POOL = 140;
const LIME = hex("#d7fe3e");
const SAGE = hex("#4f7c6d");
/** Duraciones del relevo: del nodo al centro, destello, y del centro a los demás. */
const RELAY_IN = 0.7;
const RELAY_OUT = 0.85;

type Node = {
  id: string;
  x: number;
  y: number;
  z: number;
  tone: number;
  /** 1 si el asiento está conectado. */
  target: number;
  /** Presencia animada, de 0 a 1. */
  p: number;
  pulse: number;
  burst: boolean;
  spark: number;
};

type Input = { seats: Seat[]; sealed: boolean; theme: Theme; variant: Variant; speaking: string | null; speakingKey: string };

function createGalaxy(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let hero = true;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let W = 0;
  let H = 0;
  let theme: Theme = "dark";
  let sealed = false;
  let nodes: Node[] = [];
  let signature = "";
  let raf = 0;
  let prev = 0;
  let visible = true;
  let started = false;

  // Estado animado.
  let rotY = 0.2;
  let fill = 0; // fracción de asientos conectados
  let calm = 0; // 0 esperando, 1 sellado
  let spring = 0;
  let springVel = 0;
  let wave = 0;
  let wave2 = 0;
  let calmWave = 0;
  let wasFull = false;
  // Relevos en curso: un pulso que va de un nodo a Sculptor y de Sculptor a los demás.
  let relays: { from: number; t: number; fanout: boolean }[] = [];
  let hubFlash = 0;
  let lastSpeak = "";

  // Superficie: puntos repartidos en la esfera; cada uno pertenece al asiento más cercano.
  const N = 420;
  const sx = new Float32Array(N);
  const sy = new Float32Array(N);
  const sz = new Float32Array(N);
  const owner = new Uint8Array(N);
  const reveal = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = -1 + (2 * i) / (N - 1);
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    sx[i] = Math.cos(golden * i) * rad;
    sy[i] = y;
    sz[i] = Math.sin(golden * i) * rad;
  }
  // Por asiento, dos cubetas de puntos (lejos y cerca) para pintarlos de una vez.
  let buckets: Float32Array[] = [];
  let counts: number[] = [];

  const stars = Array.from({ length: 110 }, (_, i) => ({
    x: ((i * 67.31 + 11) % 100) / 100,
    y: ((i * 39.17 + 7) % 100) / 100,
    r: 0.6 + ((i * 13) % 10) * 0.12,
    ph: (i * 1.19) % (Math.PI * 2),
  }));

  const pool = Array.from({ length: POOL }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, tone: 0 }));
  let alive = 0;

  function spawnBurst(x: number, y: number, tone: number, count: number, speed: number) {
    if (motion.matches) return;
    for (let i = 0; i < count && alive < POOL; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const sp = speed * (0.35 + Math.random() * 0.85);
      const p = pool[alive++];
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = 0;
      p.max = 0.55 + Math.random() * 0.7;
      p.size = 1.6 + Math.random() * 2.2;
      p.tone = tone;
    }
  }

  function rebuild(seats: Seat[]) {
    const old = new Map(nodes.map((node) => [node.id, node]));
    const n = seats.length;
    nodes = seats.map((seat, i) => {
      // De sur a norte, girando: el último asiento (el Comité) queda arriba.
      const lat = n === 1 ? 0 : -0.62 + (i / (n - 1)) * 1.42;
      const lon = -1.1 + i * 2.28;
      const cl = Math.cos(lat);
      const before = old.get(seat.id);
      return { id: seat.id, x: cl * Math.sin(lon), y: Math.sin(lat), z: cl * Math.cos(lon), tone: seat.tone, target: seat.connected ? 1 : 0, p: before?.p ?? 0, pulse: 0, burst: false, spark: (i * 0.37) % 1 };
    });
    const far = new Float32Array(Math.max(1, n));
    for (let i = 0; i < N; i++) {
      let best = 0;
      let bestDot = -2;
      for (let k = 0; k < n; k++) {
        const dot = sx[i] * nodes[k].x + sy[i] * nodes[k].y + sz[i] * nodes[k].z;
        if (dot > bestDot) {
          bestDot = dot;
          best = k;
        }
      }
      owner[i] = best;
      reveal[i] = Math.acos(Math.max(-1, Math.min(1, bestDot)));
      if (reveal[i] > far[best]) far[best] = reveal[i];
    }
    for (let i = 0; i < N; i++) reveal[i] = far[owner[i]] > 0 ? reveal[i] / far[owner[i]] : 0;
    buckets = Array.from({ length: Math.max(1, n) * 2 }, () => new Float32Array(N * 2));
    counts = new Array(Math.max(1, n) * 2).fill(0);
  }

  function sync(input: Input) {
    theme = input.theme;
    sealed = input.sealed;
    if (hero !== (input.variant === "hero")) {
      hero = input.variant === "hero";
      resize();
    }
    const next = input.seats.map((seat) => `${seat.id}:${seat.tone}`).join("|");
    if (next !== signature) {
      signature = next;
      rebuild(input.seats);
    }
    input.seats.forEach((seat, i) => {
      const node = nodes[i];
      const target = seat.connected ? 1 : 0;
      if (target === 1 && node.target === 0 && started) {
        node.pulse = 1;
        node.burst = true;
        springVel += 0.26;
        // Al entrar, su primer pulso llega a Sculptor (sin repartir: todavía no habla).
        if (!motion.matches) relays.push({ from: i, t: 0, fanout: false });
      }
      node.target = target;
    });
    // Cuando un agente habla, su mensaje pasa por Sculptor y llega a todos los demás.
    const speakSig = `${input.speaking ?? ""}:${input.speakingKey}`;
    if (input.speaking && speakSig !== lastSpeak && started && !motion.matches) {
      const from = input.seats.findIndex((seat) => seat.id === input.speaking);
      if (from >= 0 && input.seats[from].connected) relays.push({ from, t: 0, fanout: true });
    }
    lastSpeak = speakSig;
    // Al abrir la pantalla con la sala ya en marcha, parte en su estado: sin repetir las entradas.
    if (!started || motion.matches) renderStill();
    started = true;
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    W = Math.max(1, box.width);
    H = Math.max(1, box.height);
    // El fondo ocupa toda la pantalla: con menos resolución no se nota y cuesta menos.
    const dpr = Math.min(window.devicePixelRatio || 1, hero ? 2 : 1.25);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (motion.matches || !visible) renderStill(false);
  }

  function step(dt: number) {
    let connected = 0;
    for (const node of nodes) {
      node.p += (node.target - node.p) * Math.min(1, dt * 2.4);
      if (node.pulse > 0) node.pulse = Math.max(0, node.pulse - dt * 1.7);
      node.spark = (node.spark + dt * 0.42) % 1;
      connected += node.target;
    }
    const full = nodes.length > 0 && connected === nodes.length;
    if (full && !wasFull) {
      wave = 0.01;
      wave2 = -0.2;
      springVel += 0.6;
    }
    wasFull = full;
    fill += ((nodes.length ? connected / nodes.length : 0) - fill) * Math.min(1, dt * 2.2);
    const before = calm;
    calm += ((sealed ? 1 : 0) - calm) * Math.min(1, dt * 1.6);
    if (sealed && before < 0.02 && calm >= 0.02) calmWave = 0.01;
    springVel += (-68 * spring - 8.5 * springVel) * dt;
    spring += springVel * dt;
    if (wave > 0) wave = wave > 1.5 ? 0 : wave + dt * 1.05;
    if (wave2 !== 0) wave2 = wave2 > 1.5 ? 0 : wave2 + dt * 0.9;
    if (calmWave > 0) calmWave = calmWave > 1.5 ? 0 : calmWave + dt * 0.7;
    for (const relay of relays) {
      const before = relay.t;
      relay.t += dt;
      if (before < RELAY_IN && relay.t >= RELAY_IN) hubFlash = 1;
    }
    relays = relays.filter((relay) => relay.t < RELAY_IN + (relay.fanout ? RELAY_OUT : 0.05));
    if (relays.length > 6) relays = relays.slice(-6);
    hubFlash = Math.max(0, hubFlash - dt * 1.6);
    // Gira despacio mientras espera gente, más vivo con la sala armada, y casi quieto al sellar.
    rotY += dt * (0.07 + 0.15 * fill) * (1 - 0.72 * calm);
  }

  // Proyección con perspectiva suave: escribe en «out» para no crear objetos por punto.
  const out = { x: 0, y: 0, z: 0, s: 1 };
  const tones: RGB[] = [];
  let cosY = 1;
  let sinY = 0;
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);
  let cx = 0;
  let cy = 0;
  let R = 1;
  function project(px: number, py: number, pz: number) {
    const x1 = px * cosY - pz * sinY;
    const z1 = px * sinY + pz * cosY;
    const y2 = py * cosT - z1 * sinT;
    const z2 = py * sinT + z1 * cosT;
    const s = 3.2 / (3.2 - z2 * 0.55);
    out.x = cx + x1 * R * s;
    out.y = cy - y2 * R * s;
    out.z = z2;
    out.s = s;
  }

  function draw(t: number) {
    const c = ctx!;
    const pal = PALETTE[theme];
    const dark = theme === "dark";
    const still = motion.matches;
    const glow = hero && dark;
    c.clearRect(0, 0, W, H);
    cx = W * 0.5;
    // Al unirse, la esfera baja un poco: arriba van el título y los pasos.
    cy = H * (hero && W > H ? 0.57 : 0.5);
    R = Math.min(W, H * (hero ? 0.86 : 1)) * (hero ? 0.3 : 0.34) * (1 + spring * 0.07);
    const k = Math.max(0.6, Math.min(1.8, R / 190));
    cosY = Math.cos(rotY);
    sinY = Math.sin(rotY);
    for (let i = 0; i < TONES[theme].length; i++) tones[i] = blend(TONES[theme][i], pal.calm, calm * 0.82);
    const tone = (index: number) => tones[index % tones.length];

    // 1. Estrellas (solo en oscuro: sobre el fondo claro parecen suciedad).
    if (dark) {
      c.fillStyle = css(pal.ink);
      for (const star of stars) {
        c.globalAlpha = 0.1 + 0.26 * (still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.15 + star.ph));
        c.fillRect(star.x * W, star.y * H, star.r * 1.4, star.r * 1.4);
      }
      c.globalAlpha = 1;
    }

    // 2. Cuerpo de la esfera: aparece con la gente y se vuelve verde al sellar.
    const core = blend(pal.accent, pal.calm, calm);
    if (fill > 0.02) {
      const haloR = R * (1.3 + calm * 0.3);
      const halo = c.createRadialGradient(cx, cy, R * 0.4, cx, cy, haloR);
      halo.addColorStop(0, css(core, (dark ? 0.2 : 0.16) * fill + 0.18 * calm));
      halo.addColorStop(1, css(core, 0));
      c.fillStyle = halo;
      c.beginPath();
      c.arc(cx, cy, haloR, 0, Math.PI * 2);
      c.fill();
      const body = c.createRadialGradient(cx - R * 0.28, cy - R * 0.28, R * 0.08, cx, cy, R);
      body.addColorStop(0, css(core, (dark ? 0.2 : 0.3) * fill + 0.16 * calm));
      body.addColorStop(1, css(pal.deep, (dark ? 0.55 : 0.35) * fill));
      c.fillStyle = body;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.strokeStyle = css(blend(pal.ink, pal.calm, calm), 0.14 + 0.3 * fill + 0.25 * calm);
    c.lineWidth = 1 + fill * 0.6;
    if (fill < 0.98) c.setLineDash([3, 7]);
    c.stroke();
    c.setLineDash([]);

    // 3. Superficie: cada asiento enciende su región, desde su nodo hacia afuera.
    counts.fill(0);
    for (let i = 0; i < N; i++) {
      const o = owner[i];
      const node = nodes[o];
      if (!node || reveal[i] > node.p * 1.04) continue;
      project(sx[i], sy[i], sz[i]);
      if (out.z < -0.12) continue;
      const b = o * 2 + (out.z > 0.4 ? 1 : 0);
      const at = counts[b]++ * 2;
      buckets[b][at] = out.x;
      buckets[b][at + 1] = out.y;
    }
    for (let b = 0; b < counts.length; b++) {
      if (!counts[b]) continue;
      const near = b % 2 === 1;
      const r = (near ? 1.9 : 1.4) * k;
      c.fillStyle = css(tone(nodes[b >> 1].tone));
      c.globalAlpha = near ? 0.85 : 0.42;
      c.beginPath();
      for (let j = 0; j < counts[b]; j++) {
        const x = buckets[b][j * 2];
        const y = buckets[b][j * 2 + 1];
        c.moveTo(x + r, y);
        c.arc(x, y, r, 0, Math.PI * 2);
      }
      c.fill();
    }
    c.globalAlpha = 1;

    // 4. Rayos: cada asiento conectado se une SOLO con Sculptor, en el centro.
    //    Nunca hay una línea directa entre dos personas.
    const hubColor = dark ? blend(LIME, pal.calm, calm * 0.6) : blend(SAGE, pal.calm, calm * 0.6);
    c.lineCap = "round";
    for (const node of nodes) {
      if (node.p < 0.02) continue;
      project(node.x * 1.03, node.y * 1.03, node.z * 1.03);
      const nx = out.x;
      const ny = out.y;
      const back = out.z < 0;
      const grow = Math.min(1, node.p);
      const grad = c.createLinearGradient(cx, cy, nx, ny);
      grad.addColorStop(0, css(hubColor, (back ? 0.18 : 0.42) * grow));
      grad.addColorStop(1, css(tone(node.tone), (back ? 0.25 : 0.75) * grow));
      c.strokeStyle = grad;
      c.lineWidth = (back ? 1 : 1.6) * k;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + (nx - cx) * grow, cy + (ny - cy) * grow);
      c.stroke();
    }

    // 5. Órbitas: una por asiento. La de un asiento vacío queda como una guía tenue.
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const orbit = ORBITS[i % ORBITS.length];
      const scale = 1.15 + (i % ORBITS.length) * 0.028;
      const cX = Math.cos(orbit.tiltX);
      const sX = Math.sin(orbit.tiltX);
      const cZ = Math.cos(orbit.tiltZ);
      const sZ = Math.sin(orbit.tiltZ);
      const spin = rotY * 0.7;
      const keepCos = cosY;
      const keepSin = sinY;
      cosY = Math.cos(spin);
      sinY = Math.sin(spin);
      const point = (a: number) => {
        const ux = Math.cos(a);
        const uz = Math.sin(a);
        const y1 = -uz * sX;
        project((ux * cZ - y1 * sZ) * scale, (ux * sZ + y1 * cZ) * scale, uz * cX * scale);
      };
      c.beginPath();
      for (let s = 0; s <= 64; s++) {
        point((s / 64) * Math.PI * 2);
        if (s === 0) c.moveTo(out.x, out.y);
        else c.lineTo(out.x, out.y);
      }
      c.strokeStyle = css(blend(pal.ink, tone(node.tone), node.p), 0.1 + 0.45 * node.p);
      c.lineWidth = (1 + 0.5 * node.p) * Math.min(1.4, k);
      c.stroke();
      if (node.p > 0.5 && !still) {
        point(t * orbit.speed * (1 - 0.7 * calm));
        if (out.z > -0.78) {
          c.beginPath();
          c.arc(out.x, out.y, 3 * k, 0, Math.PI * 2);
          c.fillStyle = css(tone(node.tone));
          c.fill();
        }
      }
      cosY = keepCos;
      sinY = keepSin;
    }

    // 6. Sculptor: el centro por donde pasa todo. Late esperando a la primera
    //    persona y destella cada vez que le llega un pulso.
    if (fill < 0.12 && !still) {
      for (let ringN = 0; ringN < 3; ringN++) {
        const ph = (t * 0.55 + ringN * 0.33) % 1;
        c.beginPath();
        c.arc(cx, cy, (10 + ph * 60) * k, 0, Math.PI * 2);
        c.strokeStyle = css(hubColor, 0.5 * (1 - ph) * (1 - fill / 0.12));
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
    const hubR = (7 + (still ? 0 : Math.sin(t * 3) * 0.8) + hubFlash * 5) * k;
    if (dark) {
      c.shadowColor = css(hubColor);
      c.shadowBlur = 18 + hubFlash * 30;
    }
    c.beginPath();
    c.arc(cx, cy, hubR, 0, Math.PI * 2);
    c.fillStyle = css(hubColor);
    c.fill();
    c.shadowBlur = 0;
    if (hubFlash > 0.02) {
      c.beginPath();
      c.arc(cx, cy, hubR + (1 - hubFlash) * 46 * k, 0, Math.PI * 2);
      c.strokeStyle = css(hubColor, hubFlash * 0.7);
      c.lineWidth = 2;
      c.stroke();
    }
    c.font = `600 ${Math.round(11 * Math.max(1, k))}px "Manrope Variable", Manrope, system-ui, sans-serif`;
    c.textAlign = "center";
    c.lineWidth = 4;
    c.strokeStyle = css(pal.deep, 0.85);
    c.strokeText("sculptor", cx, cy + hubR + 16 * k);
    c.fillStyle = css(pal.ink, 0.85);
    c.fillText("sculptor", cx, cy + hubR + 16 * k);

    // Pulsos del relevo: un cometa del nodo al centro y, si el agente habló,
    // un cometa del centro hacia cada uno de los demás.
    const comet = (ax: number, ay: number, bx: number, by: number, u: number, color: RGB) => {
      if (u <= 0 || u >= 1) return;
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      for (let s = 0; s < 6; s++) {
        const back = Math.max(0, e - s * 0.035);
        const x = ax + (bx - ax) * back;
        const y = ay + (by - ay) * back;
        c.beginPath();
        c.arc(x, y, (5 - s * 0.7) * k, 0, Math.PI * 2);
        c.fillStyle = css(color, (1 - s / 6) * 0.95);
        c.fill();
      }
    };
    for (const relay of relays) {
      const src = nodes[relay.from];
      if (!src) continue;
      project(src.x * 1.03, src.y * 1.03, src.z * 1.03);
      const sxp = out.x;
      const syp = out.y;
      if (glow) {
        c.shadowColor = css(tone(src.tone));
        c.shadowBlur = 12;
      }
      comet(sxp, syp, cx, cy, relay.t / RELAY_IN, tone(src.tone));
      if (relay.fanout) {
        const u = (relay.t - RELAY_IN) / RELAY_OUT;
        nodes.forEach((dst, d) => {
          if (d === relay.from || dst.p < 0.5) return;
          project(dst.x * 1.03, dst.y * 1.03, dst.z * 1.03);
          comet(cx, cy, out.x, out.y, u, tone(src.tone));
        });
      }
      c.shadowBlur = 0;
    }

    // 7. Nodos: uno por asiento conectado, con el pulso de la entrada.
    for (const node of nodes) {
      if (node.p < 0.02) continue;
      project(node.x * 1.03, node.y * 1.03, node.z * 1.03);
      if (node.burst) {
        node.burst = false;
        spawnBurst(out.x, out.y, node.tone, 16, 140 * k);
      }
      const color = tone(node.tone);
      const r = (6 * out.s + node.pulse * 5) * k * (0.4 + 0.6 * node.p);
      c.globalAlpha = (out.z < 0 ? 0.38 : 1) * node.p;
      if (glow) {
        c.shadowColor = css(color);
        c.shadowBlur = 14;
      }
      c.beginPath();
      c.arc(out.x, out.y, r, 0, Math.PI * 2);
      c.fillStyle = css(color);
      c.fill();
      c.shadowBlur = 0;
      c.beginPath();
      c.arc(out.x, out.y, r * 0.4, 0, Math.PI * 2);
      c.fillStyle = css(dark ? pal.deep : IVORY);
      c.fill();
      if (node.pulse > 0.02) {
        c.beginPath();
        c.arc(out.x, out.y, r + (1 - node.pulse) * 26 * k, 0, Math.PI * 2);
        c.strokeStyle = css(color, node.pulse * 0.8);
        c.lineWidth = 2;
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    // 8. Ondas: sala completa (dos) y decisión sellada (una, verde).
    const ring = (progress: number, color: RGB, width: number) => {
      if (progress <= 0) return;
      const alpha = Math.max(0, 1 - progress / 1.5);
      c.beginPath();
      c.arc(cx, cy, R * (0.4 + progress * 1.5), 0, Math.PI * 2);
      c.strokeStyle = css(color, alpha * 0.8);
      c.lineWidth = width * alpha + 1;
      c.stroke();
    };
    ring(wave, pal.accent, 4);
    ring(wave2, pal.ink, 3);
    ring(calmWave, pal.calm, 4);

    // 9. Chispas de cada entrada.
    for (let i = alive - 1; i >= 0; i--) {
      const p = pool[i];
      const u = p.life / p.max;
      c.globalAlpha = Math.max(0, 1 - u);
      c.fillStyle = css(tone(p.tone));
      c.beginPath();
      c.arc(p.x, p.y, p.size * (1 - u * 0.4), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function stepParticles(dt: number) {
    for (let i = alive - 1; i >= 0; i--) {
      const p = pool[i];
      p.life += dt;
      if (p.life >= p.max) {
        pool[i] = pool[--alive];
        pool[alive] = p;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
    }
  }

  /** Un solo cuadro con el estado final: sin giro ni transiciones (movimiento reducido). */
  function renderStill(snap = true) {
    if (snap) {
      let connected = 0;
      for (const node of nodes) {
        node.p = node.target;
        node.pulse = 0;
        node.burst = false;
        connected += node.target;
      }
      fill = nodes.length ? connected / nodes.length : 0;
      wasFull = nodes.length > 0 && connected === nodes.length;
      calm = sealed ? 1 : 0;
      wave = wave2 = calmWave = spring = springVel = 0;
      alive = 0;
    }
    draw(0);
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - prev) / 1000, 0.08);
    prev = now;
    step(dt);
    stepParticles(dt);
    draw(now / 1000);
  }

  function run() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (motion.matches) {
      renderStill();
      return;
    }
    if (!visible || document.hidden) return;
    prev = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // No se dibuja lo que no se ve: pestaña oculta o canvas fuera de la pantalla.
  const sizes = new ResizeObserver(resize);
  sizes.observe(canvas);
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    run();
  });
  seen.observe(canvas);
  document.addEventListener("visibilitychange", run);
  motion.addEventListener("change", run);
  resize();
  run();

  return {
    sync,
    destroy() {
      cancelAnimationFrame(raf);
      sizes.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", run);
      motion.removeEventListener("change", run);
    },
  };
}

type Props = {
  /** Asientos reales de la sala (src/components/stage/seats.ts). */
  seats: Seat[];
  /** La decisión quedó sellada: la galaxia se calma y se vuelve verde. */
  sealed: boolean;
  /** «hero»: protagonista del paso Unirse. «backdrop»: fondo sutil detrás de la Historia. */
  variant: Variant;
  theme: Theme;
  /** Id del asiento cuyo agente acaba de hablar: su mensaje viaja por Sculptor hacia los demás. */
  speaking?: string | null;
  /** Cambia con cada mensaje, para repetir el relevo aunque hable el mismo asiento. */
  speakingKey?: string | number;
};

export function GalaxyRelay({ seats, sealed, variant, theme, speaking = null, speakingKey = "" }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof createGalaxy>>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const created = createGalaxy(canvas.current);
    engine.current = created;
    return () => {
      created?.destroy();
      engine.current = null;
    };
  }, []);

  // Cada mensaje del SSE trae un arreglo nuevo: solo se avisa al motor si algo cambió.
  const state = seats.map((seat) => `${seat.id}:${seat.tone}:${seat.connected ? 1 : 0}`).join("|");
  useEffect(() => {
    engine.current?.sync({ seats, sealed, theme, variant, speaking, speakingKey: String(speakingKey) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- «state» resume a «seats».
  }, [state, sealed, theme, variant, speaking, speakingKey]);

  return <canvas ref={canvas} className="nx-galaxy" data-variant={variant} aria-hidden="true" />;
}
