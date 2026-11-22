#!/usr/bin/env node
// Mide el rendimiento de carga con Lighthouse contra un servidor levantado
// (`next start` de un build de producción, no `next dev`).
//
// Páginas: la portada (/), un caso (/casos/hospitales), la pantalla grande (/demo,
// que abre una sala nueva y redirige a ella) y el celular de una sala (/room/CÓDIGO;
// la sala la crea este script con POST /api/rooms). Cada página se mide en móvil
// (perfil por defecto de Lighthouse: 4G lento y CPU 4x más lenta, simulados) y en
// escritorio (--preset=desktop). Se corre N veces y se informa la mediana de cada
// métrica, porque una sola corrida varía mucho.
//
// Lighthouse no es dependencia del repo: se baja con npx. Necesita Chrome instalado.
//
// Uso:
//   node scripts/lighthouse.mjs <url> <carpeta> [--corridas 3] [--etiqueta antes]
//
// Deja en la carpeta un JSON por corrida, `<etiqueta>.json` con las medianas y
// `<etiqueta>.md` con la tabla.

import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { parseArgs, request } from "./lib/client.mjs";

const run = promisify(execFile);
const { flags, positional } = parseArgs(process.argv.slice(2));
const baseUrl = (positional[0] ?? "").replace(/\/$/, "");
const outDir = positional[1] ? resolve(positional[1]) : "";
const RUNS = Number(flags.corridas ?? 3);
const LABEL = String(flags.etiqueta ?? "medicion");

if (!baseUrl || !outDir) {
  console.error("Uso: node scripts/lighthouse.mjs <url> <carpeta> [--corridas 3] [--etiqueta antes]");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const created = await request(baseUrl, "POST", "/api/rooms", { mode: "cross_org", scenario: "hospitales", demo: true });
if (!created.ok || typeof created.data?.roomId !== "string") {
  console.error(`No se pudo crear la sala para medir /room: ${created.status} ${created.text.slice(0, 200)}`);
  process.exit(2);
}

const PAGES = [
  { id: "portada", name: "/", path: "/" },
  { id: "caso", name: "/casos/hospitales", path: "/casos/hospitales" },
  { id: "demo", name: "/demo", path: "/demo" },
  { id: "room", name: "/room/CÓDIGO", path: `/room/${created.data.roomId}` },
];
const MODES = [
  { id: "movil", name: "Móvil", args: [] },
  { id: "escritorio", name: "Escritorio", args: ["--preset=desktop"] },
];

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function measure(page, mode, index) {
  const file = join(outDir, `${LABEL}-${page.id}-${mode.id}-${index}.json`);
  await run(
    "npx",
    [
      "-y",
      "lighthouse@12",
      baseUrl + page.path,
      ...mode.args,
      "--only-categories=performance",
      "--output=json",
      `--output-path=${file}`,
      "--quiet",
      // Las salas mantienen abierta una conexión SSE: sin tope, Lighthouse espera 45 s a que la red se calme.
      "--max-wait-for-load=20000",
      "--chrome-flags=--headless=new --no-first-run",
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const report = JSON.parse(readFileSync(file, "utf8"));
  const audit = (id) => report.audits[id]?.numericValue ?? 0;
  const requests = report.audits["network-requests"]?.details?.items ?? [];
  const bytes = (type) => requests.filter((item) => item.resourceType === type).reduce((sum, item) => sum + (item.transferSize ?? 0), 0);
  return {
    score: Math.round((report.categories.performance.score ?? 0) * 100),
    fcp: audit("first-contentful-paint"),
    lcp: audit("largest-contentful-paint"),
    tbt: audit("total-blocking-time"),
    cls: audit("cumulative-layout-shift"),
    si: audit("speed-index"),
    bytes: audit("total-byte-weight"),
    requests: requests.length,
    js: bytes("Script"),
    fonts: bytes("Font"),
    images: bytes("Image"),
  };
}

const results = [];
for (const page of PAGES) {
  for (const mode of MODES) {
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
      try {
        runs.push(await measure(page, mode, i));
      } catch (cause) {
        console.error(`  ${page.name} ${mode.name} corrida ${i}: falló (${String(cause.message).split("\n")[0]})`);
      }
    }
    if (runs.length === 0) continue;
    const row = { page: page.name, mode: mode.name, runs: runs.length };
    for (const key of Object.keys(runs[0])) row[key] = median(runs.map((item) => item[key]));
    results.push(row);
    console.log(
      `${page.name} · ${mode.name}: ${row.score} pts · LCP ${(row.lcp / 1000).toFixed(2)} s · TBT ${Math.round(row.tbt)} ms · CLS ${row.cls.toFixed(3)} · ${Math.round(row.bytes / 1024)} KB`,
    );
  }
}

const kb = (value) => `${Math.round(value / 1024)} KB`;
const seconds = (value) => `${(value / 1000).toFixed(2)} s`;
const table = [
  "| Página | Modo | Puntaje | FCP | LCP | TBT | CLS | Peso total | JS | Tipografías | Imágenes | Peticiones |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ...results.map(
    (row) =>
      `| ${row.page} | ${row.mode} | ${row.score} | ${seconds(row.fcp)} | ${seconds(row.lcp)} | ${Math.round(row.tbt)} ms | ${row.cls.toFixed(3)} | ${kb(row.bytes)} | ${kb(row.js)} | ${kb(row.fonts)} | ${kb(row.images)} | ${row.requests} |`,
  ),
].join("\n");

writeFileSync(join(outDir, `${LABEL}.json`), JSON.stringify(results, null, 2));
writeFileSync(join(outDir, `${LABEL}.md`), `${table}\n`);
console.log(`\n${table}\n\nGuardado en ${outDir}`);
