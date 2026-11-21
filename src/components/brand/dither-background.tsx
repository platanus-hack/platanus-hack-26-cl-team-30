"use client";

// Fondo animado con tramado ordenado (dithering Bayer 4×4): la misma estética de
// un bit del logo en píxeles. Adaptado de Shader Dithering de 21st.dev (29928),
// pero sin @paper-design/shaders ni @editframe: un canvas 2D de baja resolución
// que se escala sin suavizado. Colores de la paleta: verde oscuro, eucalipto y lima.
// Con prefers-reduced-motion se dibuja un cuadro y queda quieto.

import { useEffect, useRef } from "react";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export type DitherBackgroundProps = {
  /** Lado de cada píxel del tramado, en px de pantalla. */
  cell?: number;
  /** Velocidad de la onda (1 = normal). */
  speed?: number;
  /** Fondo, tono medio y brillo. */
  colors?: [string, string, string];
  className?: string;
};

const hex = (value: string) => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];

export function DitherBackground({ cell = 5, speed = 1, colors = ["#0f2a22", "#70ae9b", "#d7fe3e"], className }: DitherBackgroundProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const [back, mid, lit] = colors.map(hex);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let image: ImageData | null = null;

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = Math.max(1, Math.ceil(box.width / cell));
      height = Math.max(1, Math.ceil(box.height / cell));
      canvas.width = width;
      canvas.height = height;
      image = ctx.createImageData(width, height);
    };

    const draw = (time: number) => {
      if (!image) return;
      const t = (time / 1000) * speed;
      const data = image.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Campo suave: dos ondas cruzadas, como la galaxia de canto.
          const u = x / width;
          const v = y / height;
          const field = 0.5 + 0.25 * Math.sin(u * 6 + t * 0.9 + Math.sin(v * 3 + t * 0.4)) + 0.25 * Math.sin((u - v) * 5 - t * 0.6);
          const threshold = BAYER[(y % 4) * 4 + (x % 4)];
          // El brillo (lima) aparece poco: solo en las crestas de la onda.
          const color = field > threshold + 0.58 ? lit : field > threshold + 0.08 ? mid : back;
          const i = (y * width + x) * 4;
          data[i] = color[0];
          data[i + 1] = color[1];
          data[i + 2] = color[2];
          data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduce) draw(0);
    });
    observer.observe(canvas);
    if (reduce) draw(0);
    else frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [cell, speed, colors]);

  return <canvas ref={ref} aria-hidden className={className} style={{ imageRendering: "pixelated", width: "100%", height: "100%", display: "block" }} />;
}
