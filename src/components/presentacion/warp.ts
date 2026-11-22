// Salto a velocidad luz para la presentación: estrellas que vienen hacia la cámara,
// se estiran en rayos y terminan en un destello. Dibuja en un canvas a pantalla
// completa y llama a onDone en el momento del destello (para cambiar de lámina
// detrás de la luz). Devuelve una función para cancelarlo.

const COLORS = ["243,240,232", "111,175,155", "215,255,61"];

type Star = { x: number; y: number; z: number; c: string };

export function runWarp(canvas: HTMLCanvasElement, onDone: () => void, durationMs = 1700): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    onDone();
    return () => {};
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const stars: Star[] = Array.from({ length: 1100 }, () => ({
    x: (Math.random() * 2 - 1) * 1.2,
    y: (Math.random() * 2 - 1) * 1.2,
    z: Math.random() * 0.95 + 0.05,
    c: COLORS[Math.random() < 0.7 ? 0 : Math.random() < 0.6 ? 1 : 2],
  }));

  const cx = w / 2;
  const cy = h / 2;
  const scale = Math.max(w, h) * 0.5;
  const start = performance.now();
  let last = start;
  let raf = 0;
  let done = false;

  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Acelera: casi quieto al principio, a fondo al final.
    const speed = 0.5 + Math.pow(t, 1.8) * 7;

    // Las estelas se borran de a poco sin tapar lo de atrás: el planeta que se acerca
    // sigue viéndose detrás de los rayos. El fondo oscurece recién al final.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    if (t > 0.45) {
      ctx.fillStyle = `rgba(5,7,6,${(t - 0.45) * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = "lighter";

    for (const s of stars) {
      const pz = s.z;
      s.z -= speed * dt;
      if (s.z <= 0.02) {
        s.x = (Math.random() * 2 - 1) * 1.2;
        s.y = (Math.random() * 2 - 1) * 1.2;
        s.z = 1;
        continue;
      }
      const x1 = cx + (s.x / pz) * scale;
      const y1 = cy + (s.y / pz) * scale;
      const x2 = cx + (s.x / s.z) * scale;
      const y2 = cy + (s.y / s.z) * scale;
      ctx.strokeStyle = `rgba(${s.c},${Math.min(1, 0.55 + t * 0.6) * (1 - s.z * 0.45)})`;
      ctx.lineWidth = Math.max(1, (1 - s.z) * 3.4);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Luz del centro: crece con la velocidad.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * (0.15 + t * 0.9));
    glow.addColorStop(0, `rgba(215,255,61,${0.15 + t * 0.55})`);
    glow.addColorStop(0.35, `rgba(111,175,155,${t * 0.25})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Destello final.
    if (t > 0.82) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(243,240,232,${Math.min(1, (t - 0.82) / 0.18)})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (t >= 1) {
      if (!done) {
        done = true;
        onDone();
      }
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
