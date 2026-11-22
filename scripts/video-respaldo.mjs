#!/usr/bin/env node
// Video de respaldo de la demo (plan B si falla el wifi en el escenario).
//
// 1. Graba la demo completa contra un servidor con scripts/novato-demo.mjs
//    --grabar: la pantalla grande a 1920x1080 y 5 celulares a 390x844 que entran
//    por el QR, dan su postura con el botón que les recomienda su agente, el
//    debate, la propuesta, el Comité acepta y el acta. Todo en modo oscuro.
// 2. Une los videos con ffmpeg en un solo MP4 de 1920x1080: la pantalla grande a
//    la izquierda y una columna con 3 celulares (Urgencias y Administración de la
//    Clínica, y el Comité), cada uno con su rótulo.
//
// Va a ritmo real. Solo se acelera la espera mientras la gente entra por el QR
// (fase Unirse): si dura más de 20 s, se acelera lo justo para que dure 20 s (hasta
// ×3), y mientras va acelerado se ve la velocidad («▶▶ ×1,4») bajo la pantalla grande. Los rótulos dicen que es una grabación con datos simulados.
//
// Uso:
//   node scripts/video-respaldo.mjs <url> <salida.mp4> [--carpeta <dir>] [--union 20] [--final 10]
//   node scripts/video-respaldo.mjs --solo-unir <dir-de-grabacion> <salida.mp4> [--union 20] [--final 10]
//
//   --carpeta     dónde dejar la grabación cruda y el informe (por defecto, una carpeta temporal).
//   --solo-unir   no graba: une una grabación ya hecha (la carpeta con grabacion.json).
//   --union       segundos que dura como máximo la fase Unirse en el video (20). 0 = todo a ritmo real.
//   --final       segundos que el video se queda en el acta (10).
//
// Necesita ffmpeg (variable FFMPEG o `ffmpeg` en el PATH; si no hay:
// `npm i --no-save ffmpeg-static` y FFMPEG=node_modules/ffmpeg-static/ffmpeg) y
// el mismo Playwright que scripts/novato-demo.mjs. Los videos pesan: la salida
// va fuera del repo (por ejemplo ~/Desktop/Sculptor_demo_respaldo.mp4).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "./lib/client.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const SOLO = typeof flags["solo-unir"] === "string" ? resolve(flags["solo-unir"]) : "";
const baseUrl = SOLO ? "" : (positional[0] ?? "").replace(/\/$/, "");
const output = resolve(SOLO ? (positional[0] ?? "") : (positional[1] ?? ""));
/** Cuántos segundos dura como máximo la fase Unirse en el video (0 = sin acelerar). */
const UNION_S = Number(flags.union ?? 20);
const MAX_SPEED = 3;
const FINAL_S = Number(flags.final ?? 10);
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if ((!SOLO && !baseUrl) || !(SOLO ? positional[0] : positional[1]) || !(UNION_S >= 0)) {
  console.error("Uso: node scripts/video-respaldo.mjs <url> <salida.mp4> [--carpeta <dir>] [--union 20] [--final 10]\n     node scripts/video-respaldo.mjs --solo-unir <dir-de-grabacion> <salida.mp4>");
  process.exit(2);
}
if (spawnSync(FFMPEG, ["-version"]).status !== 0) {
  console.error(`No encontré ffmpeg («${FFMPEG}»). Instálalo o usa FFMPEG=<ruta> (npm i --no-save ffmpeg-static).`);
  process.exit(2);
}

// --- 1. Grabar --------------------------------------------------------------------

let recDir = SOLO;
if (!SOLO) {
  const work = flags.carpeta ? resolve(flags.carpeta) : mkdtempSync(join(tmpdir(), "sculptor-video-"));
  recDir = join(work, "video");
  console.log(`Grabando la demo contra ${baseUrl} (≈2 min)…`);
  const run = spawnSync(process.execPath, [join(ROOT, "scripts/novato-demo.mjs"), baseUrl, join(work, "informe"), "--grabar", recDir, "--final", String(FINAL_S + 3)], { stdio: "inherit" });
  if (run.status !== 0) {
    console.error(`La demo grabada no llegó limpia al acta (salida ${run.status}). Revisa ${join(work, "informe", "informe.md")} y vuelve a correr.`);
    process.exit(1);
  }
}
const meta = JSON.parse(readFileSync(join(recDir, "grabacion.json"), "utf8"));
if (!meta.ok) console.warn("Aviso: grabacion.json dice que la corrida no terminó limpia.");

// --- 2. Sincronía ------------------------------------------------------------------
// Playwright empieza cada video en el primer pintado de la página, así que la hora
// anotada al crear el contexto puede estar corrida 1 a 3 s. Cada página grabada
// lleva una baliza (SYNC_BEACON en scripts/novato-demo.mjs): un cuadrado de 8 px
// abajo a la derecha cuyo gris dice el segundo del reloj % 8. Aquí se lee la
// baliza cuadro a cuadro y cada cambio de nivel da un instante exacto del reloj;
// la mediana de esos instantes fija dónde empieza cada video.

/** Gris medio del centro de la baliza en cada cuadro: [{ t, gray }]. */
function beaconSamples(video) {
  const { width, height } = video.size;
  const run = spawnSync(FFMPEG, ["-hide_banner", "-i", join(recDir, video.file), "-vf", `crop=4:4:${width - 6}:${height - 6},scale=1:1:flags=area,showinfo`, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 26 });
  const times = [...run.stderr.toString().matchAll(/pts_time:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
  const grays = [...run.stdout];
  return times.slice(0, grays.length).map((t, i) => ({ t, gray: grays[i] }));
}

/** Instante real (ms desde t0) en que empieza el video, según la baliza; null si no se pudo leer. */
function syncedStartMs(video) {
  if (!meta.t0) return null;
  const level = (gray) => (gray < 66 ? null : Math.min(7, Math.max(0, Math.round((gray - 80) / 25))));
  const samples = beaconSamples(video).map((sample) => ({ ...sample, level: level(sample.gray) }));
  const guess = meta.t0 + video.startMs; // hora absoluta aproximada del cuadro 0
  const starts = [];
  for (let i = 2; i < samples.length - 1; i++) {
    const [a0, a, b, b1] = [samples[i - 2], samples[i - 1], samples[i], samples[i + 1]];
    if (a.level === null || b.level === null || a0.level !== a.level || b1.level !== b.level || b.level !== (a.level + 1) % 8) continue;
    // El cambio ocurrió entre los cuadros a y b: en un segundo exacto S con S % 8 = b.level.
    const tv = ((a.t + b.t) / 2) * 1000;
    const approx = guess + tv;
    const second = Math.round((approx / 1000 - b.level) / 8) * 8 + b.level;
    const start = second * 1000 - tv;
    if (Math.abs(start - guess) < 3500) starts.push(start);
  }
  if (starts.length < 3) return null;
  starts.sort((x, y) => x - y);
  return starts[Math.floor(starts.length / 2)] - meta.t0;
}

for (const video of meta.videos) {
  const synced = syncedStartMs(video);
  if (synced === null) {
    console.warn(`Aviso: no pude leer la baliza de ${video.id}; uso la hora anotada al crear el contexto (puede quedar corrido 1 a 3 s).`);
    continue;
  }
  console.log(`Sincronía ${video.id}: el video empieza ${((synced - video.startMs) / 1000).toFixed(2)} s después de lo anotado.`);
  video.startMs = synced;
}

// --- 3. Qué se muestra y cuándo -----------------------------------------------------

const stage = meta.videos.find((video) => video.id === "pantalla");
const people = meta.videos.filter((video) => video.id !== "pantalla");
// Los 3 celulares: los dos de la Clínica (Urgencias y Administración) y el Comité.
const clinic = people.filter((video) => /cl[ií]nica/i.test(video.seat ?? ""));
const phones = [clinic.find((video) => /urgencia/i.test(video.seat)), clinic.find((video) => /administra/i.test(video.seat)), people.find((video) => /comit/i.test(video.seat ?? ""))];
if (!stage || phones.some((video) => !video)) {
  console.error(`Faltan videos en ${recDir}: se necesitan la pantalla grande, Clínica · Urgencias, Clínica · Administración y Comité.`);
  process.exit(1);
}

const phaseAt = (phase) => meta.phases.find((entry) => entry.phase === phase)?.atMs;
const roomOpened = meta.timeline.find((entry) => /^Sala nueva/.test(entry.event))?.atMs ?? stage.startMs;
// Empieza cuando la pantalla grande ya muestra el código y el QR; termina FINAL_S después del acta.
const startS = Math.max(stage.startMs, roomOpened + 2500) / 1000;
const doneS = (phaseAt("done") ?? stage.endMs) / 1000;
const endS = Math.min(doneS + FINAL_S, ...[stage, ...phones].map((video) => video.endMs / 1000 - 0.5));
const fastEndS = Math.min((phaseAt("positions") ?? startS * 1000) / 1000 - 1, endS); // Unirse, hasta 1 s antes de Posturas
const segments = [];
const unionS = fastEndS - startS;
// Unirse es la única espera larga: si dura más de UNION_S, se acelera justo lo necesario (hasta ×3).
// Menos de ×1,25 no se nota y solo agrega el rótulo: en ese caso va a ritmo real.
const neededSpeed = UNION_S > 0 ? Math.min(MAX_SPEED, Math.round((unionS / UNION_S) * 10) / 10) : 1;
const SPEED = neededSpeed >= 1.25 ? neededSpeed : 1;
if (SPEED > 1) segments.push({ from: 0, to: unionS, speed: SPEED });
segments.push({ from: segments.at(-1)?.to ?? 0, to: endS - startS, speed: 1 });
const fastOut = segments[0].speed > 1 ? segments[0].to / segments[0].speed : 0;
const totalOut = segments.reduce((sum, segment) => sum + (segment.to - segment.from) / segment.speed, 0);

// --- 4. Diseño del cuadro (1920x1080) ---------------------------------------------

const W = 1920;
const H = 1080;
const BG = "#121212";
// Pantalla grande: se recorta el margen vacío a los lados (la interfaz ocupa el centro).
const CROP = { x: 140, y: 0, w: 1760, h: 1080 };
const STAGE_BOX = { x: 26, y: 117, w: 1380, h: 846 };
const PHONE = { w: 224, h: 484 };
const COL_X = 1430;
const PHONE_BOXES = [
  { x: COL_X, y: 54, ...PHONE },
  { x: COL_X + PHONE.w + 18, y: 54, ...PHONE },
  { x: COL_X + Math.round((466 - PHONE.w) / 2), y: 580, ...PHONE },
];
const recordedDate = new Date(meta.recordedAt).toLocaleString("es-CL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
const host = meta.url.replace(/^https?:\/\//, "");
const phoneLabel = (video) => (video.seat ?? video.label).replace(/^Comité$/, "Comité Ético");

/** Capas del cuadro como SVG: fondo con rótulos (debajo de los videos) y marco con esquinas redondeadas (encima). */
function layers() {
  const font = `font-family="Avenir Next, Helvetica Neue, Arial, sans-serif"`;
  const text = (x, y, size, color, body, extra = "") => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${font} ${extra}>${body}</text>`;
  const labels = [
    text(STAGE_BOX.x + 4, STAGE_BOX.y - 24, 26, "#fffdf8", "Sculptor", `font-weight="700"`),
    text(STAGE_BOX.x + 130, STAGE_BOX.y - 24, 20, "#b4b4ac", `Pantalla grande · demo grabada el ${recordedDate} contra el deploy público (${host})`),
    text(STAGE_BOX.x + 4, STAGE_BOX.y + STAGE_BOX.h + 40, 18, "#b4b4ac", "Grabación de respaldo: 5 celulares entraron por el QR y cada uno tocó lo que le recomendó su agente. Datos del caso simulados."),
    ...PHONE_BOXES.map((box, i) => text(box.x + 2, box.y - 12, 15, "#e1ff00", phoneLabel(phones[i]).toUpperCase(), `font-weight="600" letter-spacing="1"`)),
  ];
  const placeholders = PHONE_BOXES.map(
    (box) => `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="22" fill="#1c1c1a"/>` + text(box.x + box.w / 2, box.y + box.h / 2, 15, "#b4b4ac", "Escaneando el QR…", `text-anchor="middle"`),
  );
  const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${BG}"/>${placeholders.join("")}</svg>`;
  const holes = [
    `<rect x="${STAGE_BOX.x}" y="${STAGE_BOX.y}" width="${STAGE_BOX.w}" height="${STAGE_BOX.h}" rx="16" fill="black"/>`,
    ...PHONE_BOXES.map((box) => `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="22" fill="black"/>`),
  ];
  const outlines = [
    `<rect x="${STAGE_BOX.x}" y="${STAGE_BOX.y}" width="${STAGE_BOX.w}" height="${STAGE_BOX.h}" rx="16" fill="none" stroke="#3a3a36" stroke-width="2"/>`,
    ...PHONE_BOXES.map((box) => `<rect x="${box.x - 1}" y="${box.y - 1}" width="${box.w + 2}" height="${box.h + 2}" rx="23" fill="none" stroke="#4a4a44" stroke-width="3"/>`),
  ];
  // El marco va encima de los videos: el fondo con huecos de esquinas redondeadas, un borde fino y los rótulos.
  const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><mask id="m"><rect width="${W}" height="${H}" fill="white"/>${holes.join("")}</mask></defs><rect width="${W}" height="${H}" fill="${BG}" mask="url(#m)"/>${outlines.join("")}${labels.join("")}</svg>`;
  const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="56"><rect x="1" y="1" width="148" height="54" rx="27" fill="rgba(18,18,18,0.82)" stroke="#e1ff00" stroke-width="2"/>${text(75, 37, 24, "#e1ff00", `▶▶ ×${String(SPEED).replace(".", ",")}`, `text-anchor="middle" font-weight="700"`)}</svg>`;
  return { base, frame, badge };
}

/** Pasa los SVG a PNG con el Chromium de Playwright (ffmpeg no lee SVG ni trae drawtext en todas las instalaciones). */
async function renderLayers(dir) {
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const files = {};
  for (const [name, svg] of Object.entries(layers())) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    const file = join(dir, `capa-${name}.png`);
    await page.locator("svg").screenshot({ path: file, omitBackground: true });
    files[name] = file;
  }
  await browser.close();
  return files;
}

/** Abre Chromium con la primera copia de Playwright que funcione (instalada, PLAYWRIGHT_PATH o caché de npx), igual que scripts/novato-demo.mjs. */
async function launchChromium() {
  const mods = [await import("playwright").catch(() => null)];
  const npx = join(homedir(), ".npm", "_npx");
  const dirs = [process.env.PLAYWRIGHT_PATH, ...(existsSync(npx) ? readdirSync(npx).map((entry) => join(npx, entry, "node_modules", "playwright")) : [])].filter(Boolean);
  for (const dir of dirs) {
    if (!existsSync(join(dir, "package.json"))) continue;
    const entry = existsSync(join(dir, "index.mjs")) ? join(dir, "index.mjs") : join(dir, "index.js");
    mods.push(await import(pathToFileURL(entry).href).catch(() => null));
  }
  for (const mod of mods) {
    const chromium = mod?.chromium ?? mod?.default?.chromium;
    if (!chromium) continue;
    const browser = await chromium.launch().catch(() => null);
    if (browser) return browser;
  }
  throw new Error("No encontré un Playwright con Chromium: npm i --no-save playwright@1.63 && npx playwright install chromium");
}

// --- 5. ffmpeg ---------------------------------------------------------------------

const work = join(recDir, "composicion");
mkdirSync(work, { recursive: true });
const layerFiles = await renderLayers(work);

const inputs = [];
const graph = [];
const input = (file, opts = []) => inputs.push(...opts, "-i", file) && inputs.filter((arg) => arg === "-i").length - 1;
const iBase = input(layerFiles.base, ["-loop", "1", "-framerate", "25"]);
const iFrame = input(layerFiles.frame, ["-loop", "1", "-framerate", "25"]);
const iBadge = input(layerFiles.badge, ["-loop", "1", "-framerate", "25"]);
const iStage = input(join(recDir, stage.file));
const iPhones = phones.map((video) => input(join(recDir, video.file)));

const fmt = (n) => n.toFixed(3);
/** Pone cada video en el tiempo común: 0 = startS. Lo que empezó antes se recorta; lo que empezó después espera. */
const place = (index, video, filters, label) => {
  const offset = video.startMs / 1000 - startS;
  graph.push(`[${index}:v]setpts=PTS-STARTPTS+${fmt(offset)}/TB,trim=start=0,${filters}[${label}]`);
};
place(iStage, stage, `crop=${CROP.w}:${CROP.h}:${CROP.x}:${CROP.y},scale=${STAGE_BOX.w}:${STAGE_BOX.h}:flags=lanczos`, "st");
phones.forEach((video, i) => place(iPhones[i], video, `scale=${PHONE.w}:${PHONE.h}:flags=lanczos`, `ph${i}`));
const realDur = endS - startS;
graph.push(`[${iBase}:v]trim=duration=${fmt(realDur)},setpts=PTS-STARTPTS[bg]`);
graph.push(`[bg][st]overlay=${STAGE_BOX.x}:${STAGE_BOX.y}:eof_action=repeat[c0]`);
phones.forEach((_, i) => graph.push(`[c${i}][ph${i}]overlay=${PHONE_BOXES[i].x}:${PHONE_BOXES[i].y}:eof_action=repeat[c${i + 1}]`));
graph.push(`[c${phones.length}][${iFrame}:v]overlay=0:0:shortest=1[comp]`);
// Tramos: los de espera, acelerados; el resto, a ritmo real.
graph.push(`[comp]split=${segments.length}${segments.map((_, i) => `[s${i}]`).join("")}`);
segments.forEach((segment, i) => graph.push(`[s${i}]trim=start=${fmt(segment.from)}:end=${fmt(segment.to)},setpts=(PTS-STARTPTS)/${segment.speed}[t${i}]`));
graph.push(`${segments.map((_, i) => `[t${i}]`).join("")}concat=n=${segments.length}:v=1:a=0,fps=25[joined]`);
// El «×2» va bajo la pantalla grande, a la derecha del rótulo, para no tapar nada de la interfaz.
const badgeX = STAGE_BOX.x + STAGE_BOX.w - 150;
graph.push(fastOut > 0 ? `[joined][${iBadge}:v]overlay=${badgeX}:${STAGE_BOX.y + STAGE_BOX.h + 12}:enable='lt(t,${fmt(fastOut)})':shortest=1,format=yuv420p[out]` : `[joined]format=yuv420p[out]`);

mkdirSync(dirname(output), { recursive: true });
const args = ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", graph.join(";\n"), "-map", "[out]", "-t", fmt(totalOut), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", "25", "-movflags", "+faststart", output];
writeFileSync(join(work, "ffmpeg-args.json"), JSON.stringify(args, null, 2));
console.log(`Uniendo: ${fmt(startS)}–${fmt(endS)} s de la grabación → ${totalOut.toFixed(1)} s de video${fastOut ? ` (Unirse ×${SPEED}: primeros ${fastOut.toFixed(1)} s)` : ""}`);
const ff = spawnSync(FFMPEG, args, { stdio: "inherit" });
if (ff.status !== 0) {
  console.error(`ffmpeg falló (salida ${ff.status}). Argumentos en ${join(work, "ffmpeg-args.json")}`);
  process.exit(1);
}

// Momentos clave en el video final, para revisarlo con ffmpeg -ss … -frames:v 1.
const toOut = (atMs) => {
  const t = atMs / 1000 - startS;
  return t <= (segments[0].speed > 1 ? segments[0].to : 0) ? t / segments[0].speed : fastOut + (t - (segments[0].speed > 1 ? segments[0].to : 0));
};
const marks = meta.phases.map((entry) => ({ fase: entry.name, segundo: Number(Math.max(0, toOut(entry.atMs)).toFixed(1)) }));
writeFileSync(join(work, "momentos.json"), JSON.stringify({ salida: output, duracion: Number(totalOut.toFixed(1)), marks }, null, 2));
console.log(`Listo: ${output} (${totalOut.toFixed(1)} s)`);
console.log(`Fases en el video: ${marks.map((mark) => `${mark.fase} ${mark.segundo} s`).join(" · ")}`);
