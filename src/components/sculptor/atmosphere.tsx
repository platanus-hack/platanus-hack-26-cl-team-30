"use client";

// Fondo vivo de la landing: la Galaxia del Escultor (NGC 253) en partículas.
// WebGL2 sin librerías: unas miles de estrellas en dos brazos espirales, muy
// inclinadas como la galaxia real y giradas en diagonal como el logo. Las internas
// giran más rápido que las externas. Al bajar por la página la cámara entra en
// la galaxia; el puntero la inclina apenas. Encima, una luz que sigue al cursor
// y una capa de grano.
//
// Con movimiento reducido se dibuja un solo cuadro quieto. Sin WebGL2 no hay
// fondo y la página sigue igual. Con la pestaña oculta no dibuja.

import { useEffect, useRef } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";

const VERT = `#version 300 es
in vec3 aPos;
in vec4 aCol;
in vec2 aSeed;
uniform float uTime;
uniform float uScroll;
uniform float uAspect;
uniform float uDpr;
uniform vec2 uPointer;
out vec4 vCol;
void main() {
  vec3 p = aPos;
  float r = length(p.xz);
  float ang = uTime * 0.045 / (0.3 + r);
  float c = cos(ang), s = sin(ang);
  p.xz = mat2(c, -s, s, c) * p.xz;
  float tilt = 1.2 + uPointer.y * 0.06 - uScroll * 0.35;
  float ct = cos(tilt), st = sin(tilt);
  p.yz = mat2(ct, -st, st, ct) * p.yz;
  float roll = -0.6 + uPointer.x * 0.05 + uScroll * 0.5;
  float cr = cos(roll), sr = sin(roll);
  p.xy = mat2(cr, -sr, sr, cr) * p.xy;
  float wide = step(1.0, uAspect);
  p += vec3(mix(0.0, mix(0.5, -0.05, uScroll), wide), mix(0.35, 0.02, uScroll) * (1.0 - wide), 0.0);
  float z = mix(2.5, 1.15, uScroll) - p.z;
  if (z < 0.08) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // En pantallas angostas la galaxia es más chica y más tenue para no tapar el texto.
  float k = mix(1.5, 2.5, wide);
  gl_Position = vec4(p.x * k / z / uAspect, p.y * k / z, 0.0, 1.0);
  float tw = 0.6 + 0.4 * sin(uTime * (0.5 + aSeed.x * 2.2) + aSeed.x * 37.0);
  gl_PointSize = aSeed.y * uDpr * (3.2 / z);
  // Más tenue mientras se lee la mitad de la página; plena al principio y al final.
  float dim = 1.0 - 0.5 * smoothstep(0.03, 0.12, uScroll) * (1.0 - smoothstep(0.86, 0.97, uScroll));
  vCol = vec4(aCol.rgb, aCol.a * tw * dim * mix(0.5, 1.0, wide));
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec4 vCol;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  o = vec4(vCol.rgb * vCol.a * a, vCol.a * a);
}`;

// Paleta del manual de marca, en 0..1.
const LIME = [0.843, 1, 0.239];
const MARBLE = [0.953, 0.941, 0.91];
const EUCA = [0.435, 0.686, 0.608];
const PATINA = [0.18, 0.369, 0.318];

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

/** Estrellas de la galaxia (dos brazos) más un campo de fondo. */
function buildStars(count: number) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 4);
  const seed = new Float32Array(count * 2);
  const galaxy = Math.floor(count * 0.78);
  for (let i = 0; i < count; i++) {
    let x: number, y: number, z: number, rgb: number[], alpha: number, size: number;
    if (i < galaxy) {
      const r = Math.pow(Math.random(), 1.7) * 1.45 + 0.01;
      const arm = i % 2;
      const theta = arm * Math.PI + r * 3.4 + gauss() * 0.42 * (0.35 + r * 0.5);
      x = Math.cos(theta) * r + gauss() * 0.03;
      z = Math.sin(theta) * r + gauss() * 0.03;
      y = gauss() * 0.06 * (1.3 - r / 1.6);
      if (r < 0.12) rgb = mix(LIME, MARBLE, Math.random() * 0.6);
      else if (r < 0.45) rgb = mix(MARBLE, EUCA, Math.random());
      else rgb = mix(EUCA, PATINA, Math.random());
      alpha = r < 0.12 ? 0.95 : 0.35 + Math.random() * 0.5;
      size = r < 0.12 ? 3 + Math.random() * 3 : 1.4 + Math.random() * 2.4;
    } else {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const rr = 1.8 + Math.random() * 2.6;
      const k = Math.sqrt(1 - u * u);
      x = Math.cos(phi) * k * rr;
      y = u * rr;
      z = Math.sin(phi) * k * rr;
      rgb = Math.random() < 0.85 ? MARBLE : LIME;
      alpha = 0.15 + Math.random() * 0.45;
      size = 1 + Math.random() * 1.6;
    }
    pos.set([x, y, z], i * 3);
    col.set([rgb[0], rgb[1], rgb[2], alpha], i * 4);
    seed.set([Math.random(), size], i * 2);
  }
  return { pos, col, seed };
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
  return sh;
}

function GalaxyField() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const gl = el?.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!el || !gl) return;

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    } catch {
      return;
    }
    gl.useProgram(program);

    const small = window.matchMedia("(max-width: 768px)").matches;
    const { pos, col, seed } = buildStars(small ? 2600 : 5200);
    const count = pos.length / 3;
    const attrs: [string, Float32Array, number][] = [
      ["aPos", pos, 3],
      ["aCol", col, 4],
      ["aSeed", seed, 2],
    ];
    const buffers = attrs.map(([name, data, size]) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return buf;
    });

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uTime = u("uTime");
    const uScroll = u("uScroll");
    const uAspect = u("uAspect");
    const uDpr = u("uDpr");
    const uPointer = u("uPointer");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const resize = () => {
      el.width = Math.floor(window.innerWidth * dpr);
      el.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, el.width, el.height);
      gl.uniform1f(uAspect, window.innerWidth / window.innerHeight);
      gl.uniform1f(uDpr, dpr);
    };
    resize();

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    // El alto recorrible se guarda y se recalcula solo cuando cambia el tamaño de la
    // página: leer scrollHeight en cada cuadro obliga al navegador a recalcular el
    // diseño en cada cuadro mientras GSAP anima la intro.
    let scroll = 0;
    let max = 0;
    const measure = () => {
      max = document.documentElement.scrollHeight - window.innerHeight;
    };
    measure();
    const sizes = new ResizeObserver(measure);
    sizes.observe(document.body);
    const readScroll = () => (max > 0 ? Math.min(window.scrollY / max, 1) : 0);

    const draw = (t: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      scroll += (readScroll() - scroll) * 0.08;
      gl.uniform1f(uTime, t / 1000 + 40);
      gl.uniform1f(uScroll, scroll);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, count);
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !still) raf = requestAnimationFrame(loop);
    };
    const onResize = () => {
      resize();
      measure();
      if (still) draw(0);
    };

    window.addEventListener("resize", onResize);
    if (still) {
      draw(0);
    } else {
      window.addEventListener("pointermove", onPointer);
      document.addEventListener("visibilitychange", onVisibility);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      sizes.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 h-full w-full" />;
}

/** Luz suave que sigue al cursor, solo con mouse. */
function CursorLight() {
  const light = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(`${MOTION_OK} and (pointer: fine)`, () => {
      const el = light.current;
      if (!el) return;
      gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 0 });
      const x = gsap.quickTo(el, "x", { duration: 0.8, ease: "power3.out" });
      const y = gsap.quickTo(el, "y", { duration: 0.8, ease: "power3.out" });
      const onMove = (e: PointerEvent) => {
        x(e.clientX);
        y(e.clientY);
        gsap.to(el, { opacity: 1, duration: 0.6, overwrite: "auto" });
      };
      window.addEventListener("pointermove", onMove);
      return () => window.removeEventListener("pointermove", onMove);
    });
  });

  return (
    <div
      ref={light}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[1] hidden size-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(215,255,61,0.09),rgba(111,175,155,0.07)_45%,transparent)] mix-blend-screen md:block"
    />
  );
}

// Grano fino para que los degradados no se vean planos.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>\")";

export function Atmosphere() {
  return (
    <>
      <GalaxyField />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(12,14,13,0.75)_100%)]"
      />
      <CursorLight />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] opacity-[0.06] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
    </>
  );
}
