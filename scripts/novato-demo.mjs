#!/usr/bin/env node
// Prueba de QA de la demo con negociación entre agentes (ronda 20), jugada en
// navegadores reales como la jugarían 5 personas que nunca la vieron.
//
// Cada persona tiene su propio contexto de navegador (sin cookies ni
// almacenamiento compartido) con un celular de 390 px; la pantalla grande va en
// otro contexto a 1440 px. La prueba:
//
//   1. Abre la pantalla grande en /stage/demo-cross, que crea una sala nueva con
//      código propio (y deja en ese navegador las credenciales del anfitrión).
//   2. Lee el código QR único de la pantalla grande (con BarcodeDetector si el
//      navegador lo trae; si no, arma el enlace con el código grande que se ve)
//      y hace entrar a las 5 personas, de a una, en el orden de los asientos.
//   3. Cada persona mira su celular y toca el botón que vea: su postura (el
//      primero de los que le ofrece su agente) y, el Comité, Aceptar o Rechazar.
//   4. Espera la negociación sin acelerarla, para medir el ritmo real. Con
//      --rapido aprieta «Siguiente» del narrador en la pantalla grande.
//
// Registra, por persona y por fase: el título que ve (el texto más grande de la
// pantalla), cuántas palabras tiene la pantalla, si hay que desplazarse, los
// botones a la vista, los toques que necesitó y cuánto duró cada fase. Guarda una
// captura por fase y por pantalla, más informe.md e informe.json, en la carpeta.
//
// Falla con un mensaje claro si:
//   - alguna pantalla queda igual (sin contar números de las cuentas regresivas)
//     más de 60 s antes del acta: alguien quedó trabado;
//   - en algún celular o en la pantalla grande se lee un dato reservado. Los
//     valores reservados salen de las semillas (src/lib/genome/seeds.ts): todo
//     campo que no es público y el costo de cobertura de cada candidato. Para
//     cada celular se buscan solo los que su organización y su rol no pueden ver;
//     para la pantalla grande y el Comité, todos.
//
// Selectores que dependen de la ronda 20 (si cambian las vistas, cambiar aquí):
// están juntos en SEL, marcados con [R20].
//
// Uso:
//   node scripts/novato-demo.mjs <url> <carpeta> [--rapido] [--comite aceptar|rechazar]
//        [--atasco 60] [--limite 900] [--pausa-entrada 1500] [--lectura 2000] [--headed]
//
//   --rapido         aprieta «Siguiente» del narrador en cuanto se puede.
//   --comite         qué hace el Comité (por defecto aceptar).
//   --atasco         segundos sin cambios en una pantalla para dar a alguien por trabado (60).
//   --limite         tope total de la prueba en segundos (900).
//   --pausa-entrada  ms entre que una persona se sienta y la siguiente escanea (1500).
//   --lectura        ms que una persona mira su botón antes de tocarlo (2000). Nadie toca
//                    antes de que se capture la pantalla de esa fase.
//   --headed         muestra los navegadores.
//
// Playwright no es dependencia del repo: se busca `playwright` instalado, luego
// PLAYWRIGHT_PATH (carpeta del paquete) y luego la caché de npx
// (~/.npm/_npx/*/node_modules/playwright). Si no hay ninguno:
//   npx -y playwright@1.63 install chromium && npm i --no-save playwright@1.63
//
// Sale con 0 si la demo se jugó entera sin fugas ni atascos, 1 si falló y 2 si no pudo empezar.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openStream, parseArgs, sleep } from "./lib/client.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const baseUrl = (positional[0] ?? "").replace(/\/$/, "");
const outDir = positional[1] ? resolve(positional[1]) : "";
const RAPIDO = Boolean(flags.rapido);
const COMITE = flags.comite === "rechazar" ? "rechazar" : "aceptar";
const STUCK_MS = Number(flags.atasco ?? 60) * 1000;
const LIMIT_MS = Number(flags.limite ?? 900) * 1000;
const JOIN_GAP_MS = Number(flags["pausa-entrada"] ?? 1500);
const READ_MS = Number(flags.lectura ?? 2000);
const HEADED = Boolean(flags.headed);

if (!baseUrl || !outDir || (flags.comite && !["aceptar", "rechazar"].includes(flags.comite))) {
  console.error("Uso: node scripts/novato-demo.mjs <url> <carpeta> [--rapido] [--comite aceptar|rechazar] [--atasco 60] [--limite 900] [--pausa-entrada 1500] [--lectura 2000] [--headed]");
  process.exit(2);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- Selectores ----------------------------------------------------------------
// [R20] = depende de las vistas de la ronda 20 (negotiation-view.tsx del celular y
// de la pantalla grande). Lo demás es de la sala de siempre.

const SEL = {
  /** [R20] Código de sala gigante de la pantalla grande (paso Unirse). */
  stageCode: ".nx-ng-code",
  /** Imagen del QR (alt fijo en src/components/nexo/qr-code.tsx). */
  qrImage: 'img[alt="Código para entrar a la sala"]',
  /** [R20] Paso actual de la pantalla grande. */
  stageStep: '.nx-steps li[aria-current="step"] .nx-step-label',
  /** [R20] Controles del narrador en la pantalla grande (solo el anfitrión ve los botones). */
  narrator: '.nx-narrator[aria-label="Controles del narrador"]',
  /** [R20] Grupo de botones de postura en el celular. */
  positionGroup: '[role="group"][aria-label="Tu postura"]',
  /** Botones del Comité (demo-view.tsx), por su texto. */
  approve: /^\s*Aceptar\s*$/,
  reject: /^\s*Rechazar\s*$/,
  /** Botón «Siguiente» del narrador, por su texto. [R20] */
  next: /^\s*Siguiente\s*$/,
  /** Pantallas de entrada genéricas: si aparecen, una persona las toca. */
  enterButtons: [/^\s*Entrar a mi silla\s*$/, /^\s*Entrar\s*$/],
};

/** Asientos esperados, en orden de llegada (docs/DECISIONES.md, ronda 20). Se comparan con lo que manda el servidor. */
const EXPECTED_SEATS = ["Clínica · Urgencias", "Clínica · Administración", "Hospital Rural · Turno", "Hospital Rural · Administración", "Comité"];

const PHASE_NAMES = { join: "Unirse", positions: "Posturas", debate: "Debate", proposal: "Propuesta", decision: "Comité", done: "Acta" };
const PHASE_ORDER = ["join", "positions", "debate", "proposal", "decision", "done"];

// --- Playwright ----------------------------------------------------------------

async function loadChromium() {
  const candidates = [];
  try {
    const mod = await import("playwright");
    candidates.push({ from: "playwright (instalado)", chromium: mod.chromium ?? mod.default?.chromium });
  } catch {
    // No está en node_modules: se buscan otras copias.
  }
  const dirs = [];
  if (process.env.PLAYWRIGHT_PATH) dirs.push(process.env.PLAYWRIGHT_PATH);
  const npx = join(homedir(), ".npm", "_npx");
  if (existsSync(npx)) {
    for (const entry of readdirSync(npx)) {
      const dir = join(npx, entry, "node_modules", "playwright");
      if (existsSync(join(dir, "package.json"))) dirs.push(dir);
    }
  }
  for (const dir of dirs) {
    try {
      const entry = existsSync(join(dir, "index.mjs")) ? join(dir, "index.mjs") : join(dir, "index.js");
      const mod = await import(pathToFileURL(entry).href);
      const version = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;
      candidates.push({ from: `${dir} (${version})`, chromium: mod.chromium ?? mod.default?.chromium });
    } catch {
      // Copia rota: se prueba la siguiente.
    }
  }
  const errors = [];
  for (const candidate of candidates) {
    if (!candidate.chromium) continue;
    try {
      const browser = await candidate.chromium.launch({ headless: !HEADED });
      return { browser, from: candidate.from };
    } catch (error) {
      errors.push(`${candidate.from}: ${String(error.message).split("\n")[0]}`);
    }
  }
  throw new Error(
    `No encontré un Playwright con Chromium instalado.${errors.length ? `\n  ${errors.join("\n  ")}` : ""}\n` +
      "  Instálalo sin tocar package.json: npm i --no-save playwright@1.63 && npx playwright install chromium",
  );
}

// --- Valores reservados (de las semillas) --------------------------------------

/**
 * Lee src/lib/genome/seeds.ts como texto (Node 20 no ejecuta TypeScript) y saca
 * cada campo no público con su dueño y quién puede verlo, y el costo de cobertura
 * de cada candidato. Si el formato de las semillas cambia y no se encuentra nada,
 * la prueba se detiene: mejor eso que dar por buena una búsqueda vacía.
 */
function loadReservedValues() {
  const source = readFileSync(join(ROOT, "src/lib/genome/seeds.ts"), "utf8");
  const fieldRe =
    /\{\s*key:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*value:\s*("(?:[^"\\]|\\.)*"|[\d_.]+),\s*unit:\s*"([^"]*)",\s*ownerOrgId:\s*"([^"]+)",\s*ownerRoleId:\s*"([^"]+)",\s*visibleToOrgIds:\s*\[([^\]]*)\],\s*visibleToRoleIds:\s*\[([^\]]*)\],\s*classification:\s*"(\w+)"/g;
  const list = (raw) => [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const fields = [];
  for (const m of source.matchAll(fieldRe)) {
    const value = m[3].startsWith('"') ? JSON.parse(m[3]) : Number(m[3].replaceAll("_", ""));
    fields.push({ key: m[1], label: m[2], value, unit: m[4], orgId: m[5], visibleToOrgIds: list(m[7]), visibleToRoleIds: list(m[8]), classification: m[9] });
  }
  if (fields.length === 0) throw new Error("No encontré campos en src/lib/genome/seeds.ts: cambió el formato de las semillas y hay que ajustar loadReservedValues.");
  const reserved = fields.filter((field) => field.classification !== "public");
  // Costo de cobertura de cada candidato: lo ve la organización dueña y, dentro de ella, quien ve su campo coverage_cost.
  const candidateRe = /orgId:\s*"([^"]+)",\s*caseId:\s*"([^"]+)",[\s\S]*?coverageCost:\s*([\d_]+),\s*coverageCostVisibleToOrgs:\s*\[([^\]]*)\]/g;
  for (const m of source.matchAll(candidateRe)) {
    const own = fields.find((field) => field.orgId === m[1] && field.key === "coverage_cost");
    reserved.push({
      key: `candidato ${m[2]}: costo de cobertura`,
      label: "Costo de cobertura del candidato",
      value: Number(m[3].replaceAll("_", "")),
      unit: "CLP",
      orgId: m[1],
      visibleToOrgIds: list(m[4]),
      visibleToRoleIds: own?.visibleToRoleIds ?? [],
      classification: "secret",
    });
  }
  return reserved;
}

/** Formas en que un valor puede aparecer escrito en pantalla. Los muy cortos (1, 140) se buscan con su unidad o se omiten. */
function spellings(entry) {
  const { value, unit } = entry;
  if (typeof value === "number") {
    if (value >= 1000) {
      const es = value.toLocaleString("es-CL");
      const en = value.toLocaleString("en-US");
      const millions = value >= 1_000_000 ? [`${(value / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 2 })} millones`, `${(value / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 2 })} M`, `${(value / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`] : [];
      return [...new Set([String(value), es, en, ...millions])];
    }
    if (String(value).length >= 3 && unit) return [`${value} ${unit}`, `${value}${unit}`];
    return [];
  }
  const text = String(value);
  if (text.length < 4) return [];
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return [text, `${fraction[1]} / ${fraction[2]}`, `${fraction[1]} de ${fraction[2]}`];
  return [text];
}

/** Lo que un espectador no debe leer: la pantalla grande y el Comité, nada; cada rol, lo que su organización y su rol no ven. */
function forbiddenFor(reserved, viewer) {
  return reserved
    .filter((entry) => !(viewer && entry.visibleToOrgIds.includes(viewer.orgId) && entry.visibleToRoleIds.includes(viewer.roleId)))
    .flatMap((entry) => spellings(entry).map((text) => ({ entry, text, re: new RegExp(`(?<![\\d.,])${escapeRe(text).replace(/\\ /g, "\\s*")}(?![\\d])`) })));
}

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\ ");

// --- Lectura de una pantalla -----------------------------------------------------

/** Corre dentro de la página: título (el texto visible más grande), palabras, botones y si hay que desplazarse. */
function readScreenInPage() {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
  };
  let best = null;
  let bestSize = 0;
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("[aria-hidden='true'], script, style, noscript")) continue;
    const own = [...el.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join("").trim();
    if (own.length < 2 || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize) || 0;
    if (size > bestSize) {
      bestSize = size;
      best = el;
    }
  }
  const text = document.body.innerText ?? "";
  const words = text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  const buttons = [...document.querySelectorAll("button, a.st-btn, [role='button']")]
    .filter((el) => visible(el) && !el.disabled)
    .map((el) => (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " "))
    .filter(Boolean);
  return {
    title: best ? (best.innerText || best.textContent || "").trim().replace(/\s+/g, " ").slice(0, 140) : "",
    titlePx: Math.round(bestSize),
    words,
    text,
    buttons: [...new Set(buttons)].slice(0, 12),
    scrolls: document.documentElement.scrollHeight > window.innerHeight + 4,
  };
}

/** Texto sin números ni espacios repetidos: así una cuenta regresiva no cuenta como «la pantalla cambió». */
const normalize = (text) => text.replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

// --- Estado de la prueba ---------------------------------------------------------

const t0 = Date.now();
const since = (ms = Date.now()) => ((ms - t0) / 1000).toFixed(1);
const log = (...parts) => console.log(`[${since().padStart(6)} s]`, ...parts);

let observed = null; // último estado de la sala, visto como pantalla grande (SSE)
let observedRaw = "";
const phaseMarks = []; // { phase, at }
const timeline = [];
const devices = []; // pantalla grande y 5 personas
const failures = []; // bloqueantes: cortan la prueba (atasco, sala que no abre)
const leaks = new Map(); // fugas: se anotan y la prueba sigue, para que el informe quede completo
const notes = [];
let finished = false;
const snapped = new Set(); // fases ya capturadas: nadie toca antes de que su pantalla quede registrada

class DemoFailure extends Error {}

function fail(message) {
  if (!failures.includes(message)) failures.push(message);
  throw new DemoFailure(message);
}

function mark(event) {
  timeline.push({ at: Date.now(), event });
  log(event);
}

/** Fase que la pantalla grande debería mostrar, según el servidor (igual que stageStep en src/components/stage/negotiation.ts). */
function serverStep(state) {
  const negotiation = state?.negotiation;
  if (!negotiation) return null;
  if (negotiation.phase !== "positions") return negotiation.phase;
  const anyPosition = negotiation.positions?.some((entry) => entry.position);
  const people = seatList(state);
  const connected = new Set((state.connectedPlayers ?? []).map((player) => `${player.orgId}/${player.roleId}`));
  const freeSeat = people.some((seat) => !connected.has(`${seat.orgId}/${seat.roleId}`));
  return !anyPosition && freeSeat ? "join" : "positions";
}

/** Asientos de persona que manda el servidor, en orden. */
function seatList(state) {
  const seats = [];
  for (const org of state?.orgs ?? []) {
    for (const role of org.roles ?? []) if (role.seatOrder && role.seatLabel) seats.push({ orgId: org.orgId, roleId: role.id, order: role.seatOrder, label: role.seatLabel });
  }
  const arbiter = state?.scarcity?.arbiter;
  if (arbiter?.seatOrder && arbiter.seatLabel) seats.push({ orgId: arbiter.orgId, roleId: arbiter.roleId, order: arbiter.seatOrder, label: arbiter.seatLabel });
  return seats.sort((a, b) => a.order - b.order);
}

const currentPhase = () => phaseMarks.at(-1)?.phase ?? "join";

// --- Dispositivos ----------------------------------------------------------------

function makeDevice({ id, label, page, viewer }) {
  return { id, label, page, viewer, taps: 0, lastNormalized: "", lastChange: Date.now(), screen: null, byPhase: {}, seat: null, done: false };
}

/** Lee la pantalla, revisa fugas y avance. Devuelve la lectura. */
async function look(device, forbidden) {
  let screen;
  try {
    screen = await device.page.evaluate(readScreenInPage);
  } catch (error) {
    // La página navegó en medio de la lectura (por ejemplo, el redireccionamiento de la sala nueva).
    if (/navigat|context|destroyed/i.test(String(error.message))) return device.screen;
    throw error;
  }
  device.screen = screen;
  const normalized = normalize(screen.text);
  if (normalized !== device.lastNormalized) {
    device.lastNormalized = normalized;
    device.lastChange = Date.now();
  }
  for (const item of forbidden(device)) {
    const key = `${device.id}|${item.entry.orgId}.${item.entry.key}`;
    if (leaks.has(key) || !item.re.test(screen.text)) continue;
    const line = screen.text.split("\n").find((row) => item.re.test(row))?.trim() ?? item.text;
    leaks.set(key, "");
    const shot = await capture(device, `fuga-${device.id}-${item.entry.orgId}-${item.entry.key}`.replace(/[^\w.-]+/g, "_"));
    const message =
      `FUGA en ${device.label}: se lee «${item.text}», que es ${item.entry.label} (${item.entry.orgId}.${item.entry.key}, ${item.entry.classification}). ` +
      `Línea: «${line.slice(0, 160)}». Fase ${PHASE_NAMES[currentPhase()]}. Captura: ${shot}`;
    leaks.set(key, message);
    mark(message);
  }
  if (!finished && Date.now() - device.lastChange > STUCK_MS) {
    const shot = await capture(device, `trabado-${device.id}`);
    fail(
      `TRABADO: ${device.label} lleva ${Math.round((Date.now() - device.lastChange) / 1000)} s con la misma pantalla («${screen.title}») en la fase ${PHASE_NAMES[currentPhase()]}. ` +
        `Botones a la vista: ${screen.buttons.join(" | ") || "ninguno"}. Captura: ${shot}`,
    );
  }
  return screen;
}

async function capture(device, name) {
  const file = join(outDir, `${name}.png`);
  try {
    await device.page.screenshot({ path: file, fullPage: false });
  } catch {
    return "(sin captura)";
  }
  return file;
}

/** Toca el primer botón visible y habilitado que calce con el texto (o el locator). */
async function tapButton(device, matcher, why) {
  const locator = typeof matcher === "string" ? device.page.locator(matcher) : device.page.getByRole("button", { name: matcher });
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const button = locator.nth(i);
    if (!(await button.isVisible().catch(() => false)) || !(await button.isEnabled().catch(() => false))) continue;
    const text = (await button.innerText().catch(() => "")).trim().replace(/\s+/g, " ");
    if (device.viewer === "stage") await button.click({ timeout: 3000 });
    else await button.tap({ timeout: 3000 });
    device.taps += 1;
    mark(`${device.label} toca «${text}» (${why})`);
    return text;
  }
  return null;
}

/**
 * Toca como una persona: solo cuando su pantalla de esta fase ya quedó capturada y
 * después de mirar el botón READ_MS. Devuelve el texto tocado o null si todavía no.
 */
async function tapWhenRead(device, matcher, why) {
  if (!snapped.has(currentPhase())) return null;
  const locator = typeof matcher === "string" ? device.page.locator(matcher) : device.page.getByRole("button", { name: matcher });
  const visible = await locator.first().isVisible().catch(() => false);
  if (!visible) {
    device.seenButtonAt = null;
    return null;
  }
  device.seenButtonAt ??= Date.now();
  if (Date.now() - device.seenButtonAt < READ_MS) return null;
  const tapped = await tapButton(device, matcher, why);
  if (tapped) device.seenButtonAt = null;
  return tapped;
}

/** Captura y anota lo que ve cada pantalla al entrar a una fase. */
async function snapshotPhase(phase, index) {
  await sleep(900); // que termine la animación de entrada
  const shown = await devices[0].page.locator(SEL.stageStep).first().innerText().catch(() => null);
  await Promise.all(
    devices.map(async (device) => {
      if (!device.seat && device.viewer !== "stage") return; // todavía no entró
      const screen = (await device.page.evaluate(readScreenInPage).catch(() => null)) ?? device.screen;
      const file = await capture(device, `${String(index).padStart(2, "0")}-${phase}-${device.id}`);
      device.byPhase[phase] ??= { title: screen?.title ?? "", titlePx: screen?.titlePx ?? 0, words: screen?.words ?? 0, scrolls: !!screen?.scrolls, buttons: screen?.buttons ?? [], tapsSoFar: device.taps, file, stageShows: shown };
    }),
  );
  snapped.add(phase);
}

// --- Recorrido ---------------------------------------------------------------------

async function main() {
  mkdirSync(outDir, { recursive: true });
  const reserved = loadReservedValues();

  let chromiumInfo;
  try {
    chromiumInfo = await loadChromium();
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const { browser, from } = chromiumInfo;
  log(`Playwright: ${from}`);
  log(`Servidor: ${baseUrl} · modo ${RAPIDO ? "rápido (Siguiente del narrador)" : "ritmo real"} · Comité: ${COMITE}`);

  const deadline = setTimeout(() => {
    failures.push(`TIEMPO: la prueba pasó los ${LIMIT_MS / 1000} s sin llegar al acta (fase ${PHASE_NAMES[currentPhase()]}).`);
    finished = true;
  }, LIMIT_MS);

  const abort = new AbortController();
  try {
    // 1. Pantalla grande: abre una sala nueva.
    const stageContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-CL" });
    const stagePage = await stageContext.newPage();
    const stage = makeDevice({ id: "pantalla", label: "Pantalla grande", page: stagePage, viewer: "stage" });
    devices.push(stage);
    const consoleErrors = [];
    stagePage.on("pageerror", (error) => consoleErrors.push(`pantalla: ${error.message}`));
    stagePage.on("console", (message) => message.type() === "error" && consoleErrors.push(`pantalla (consola): ${message.text().slice(0, 200)}`));

    await stagePage.goto(`${baseUrl}/stage/demo-cross`, { waitUntil: "domcontentloaded" });
    await stagePage.waitForURL((url) => !url.pathname.endsWith("/demo-cross"), { timeout: 20_000 }).catch(() =>
      fail(
        `La pantalla grande no abrió una sala nueva en 20 s (/stage/demo-cross no redirigió).` +
          (consoleErrors.length ? ` Errores en la página: ${consoleErrors.slice(0, 2).join(" · ")}. ¿Se rehízo el build con el servidor andando? Reinícialo.` : ""),
      ),
    );
    const roomId = decodeURIComponent(new URL(stagePage.url()).pathname.split("/").pop());
    mark(`Sala nueva: ${roomId}`);

    // Estado de la sala tal como lo ve la pantalla grande (sin identidad): da las fases.
    await openStream(
      `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/events`,
      (message, _at, raw) => {
        observed = message;
        observedRaw = raw;
        const step = serverStep(message);
        if (step && step !== currentPhase() && PHASE_ORDER.indexOf(step) > PHASE_ORDER.indexOf(currentPhase())) {
          phaseMarks.push({ phase: step, at: Date.now() });
          mark(`── Fase: ${PHASE_NAMES[step]}`);
        }
        if (phaseMarks.length === 0 && step) phaseMarks.push({ phase: step, at: t0 });
      },
      abort,
    ).catch((error) => fail(`No pude abrir el SSE de la sala: ${error.message}`));
    if (!observed?.negotiation) {
      fail("La sala nueva no trae «negotiation»: el servidor todavía no tiene la ronda 20, o /stage/demo-cross abrió una demo de 3 personas.");
    }
    if (phaseMarks.length === 0) phaseMarks.push({ phase: "join", at: t0 });

    const seats = seatList(observed);
    const seatLabels = seats.map((seat) => seat.label);
    if (seats.length !== 5) notes.push(`El servidor manda ${seats.length} asientos de persona, no 5: ${seatLabels.join(", ")}`);
    if (seatLabels.join("|") !== EXPECTED_SEATS.join("|")) notes.push(`Asientos distintos de los del contrato: servidor «${seatLabels.join(", ")}», contrato «${EXPECTED_SEATS.join(", ")}».`);
    const roomCodeServer = observed.roomCode ?? null;
    if (!roomCodeServer) notes.push("El estado de la sala no trae roomCode (contrato de la ronda 20).");

    // Código grande y QR en la pantalla grande.
    const shownCode = (await stagePage.locator(SEL.stageCode).first().innerText({ timeout: 15_000 }).catch(() => "")).trim();
    if (!shownCode) fail(`La pantalla grande no muestra el código de la sala (${SEL.stageCode}) en 15 s.`);
    if (shownCode.toUpperCase() !== String(roomCodeServer ?? roomId).toUpperCase()) notes.push(`El código grande («${shownCode}») no coincide con el de la sala («${roomCodeServer ?? roomId}»).`);
    await stagePage.locator(SEL.qrImage).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => fail("La pantalla grande no muestra el QR para entrar en 15 s."));
    const decoded = await stagePage
      .evaluate(async (selector) => {
        if (!("BarcodeDetector" in window)) return null;
        const img = document.querySelector(selector);
        const codes = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(img);
        return codes[0]?.rawValue ?? null;
      }, SEL.qrImage)
      .catch(() => null);
    let joinUrl = `${baseUrl}/room/${encodeURIComponent(roomId)}`;
    if (decoded) {
      const path = new URL(decoded).pathname;
      joinUrl = `${baseUrl}${path}`; // mismo camino que el QR, contra el servidor de la prueba
      mark(`QR leído: ${decoded}`);
      if (!path.endsWith(`/room/${encodeURIComponent(roomId)}`)) notes.push(`El QR apunta a ${decoded}, no a la sala ${roomId}.`);
    } else {
      notes.push("Este Chromium no trae BarcodeDetector: el enlace se armó con el código grande de la pantalla, no leyendo el QR.");
    }
    await snapshotPhase("join", 0);
    snapped.add("join");

    const stageForbidden = forbiddenFor(reserved, null);
    const forbiddenCache = new Map();
    const forbidden = (device) => {
      if (device.viewer === "stage") return stageForbidden;
      if (!device.seat) return stageForbidden; // sin silla todavía: no debe ver nada reservado
      const key = `${device.seat.orgId}/${device.seat.roleId}`;
      if (!forbiddenCache.has(key)) forbiddenCache.set(key, forbiddenFor(reserved, device.seat));
      return forbiddenCache.get(key);
    };

    // Vigilante: cada pantalla se mira cada 500 ms (fugas y atascos) y se capturan las fases.
    let snapshotIndex = 1;
    let lastSnapPhase = "join";
    const watcher = (async () => {
      while (!finished) {
        for (const device of devices) await look(device, forbidden);
        const phase = currentPhase();
        if (phase !== lastSnapPhase) {
          lastSnapPhase = phase;
          await snapshotPhase(phase, snapshotIndex++);
        }
        if (phase === "done" && !finished) {
          finished = true;
          await sleep(1500);
          await snapshotPhase("done-final", snapshotIndex++);
        }
        await sleep(500);
      }
    })();
    watcher.catch(() => {}); // la falla se lee en failures; esto evita un rechazo sin atender mientras entran las personas

    // 2. Las 5 personas entran por el QR, en orden.
    const people = [];
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        locale: "es-CL",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => consoleErrors.push(`persona ${i + 1}: ${error.message}`));
      const device = makeDevice({ id: `persona-${i + 1}`, label: `Persona ${i + 1}`, page, viewer: null });
      devices.push(device);
      people.push(device);
      const scanAt = Date.now();
      await page.goto(joinUrl, { waitUntil: "domcontentloaded" });
      // Sentada: el celular guardó su identidad para esta sala.
      const seatDeadline = Date.now() + 20_000;
      while (!device.seat) {
        if (failures.length) throw new DemoFailure(failures[0]);
        device.seat = await page.evaluate((key) => {
          try {
            const raw = sessionStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed?.orgId && parsed?.roleId ? { orgId: parsed.orgId, roleId: parsed.roleId } : null;
          } catch {
            return null;
          }
        }, `nexo:${roomId}:session`).catch(() => null);
        if (!device.seat) {
          // Si la persona ve un botón para entrar, lo toca (cuenta como toque).
          for (const name of SEL.enterButtons) if (await tapButton(device, name, "entrar")) break;
        }
        if (!device.seat && Date.now() > seatDeadline) {
          const shot = await capture(device, `sin-silla-${device.id}`);
          fail(`TRABADO: ${device.label} escaneó el QR y no recibió silla en 20 s. Ve: «${device.screen?.title ?? "?"}». Captura: ${shot}`);
        }
        if (!device.seat) await sleep(300);
      }
      const seat = seats.find((entry) => entry.orgId === device.seat.orgId && entry.roleId === device.seat.roleId);
      device.label = `Persona ${i + 1} (${seat?.label ?? `${device.seat.orgId}/${device.seat.roleId}`})`;
      device.seatLabel = seat?.label ?? null;
      device.joinMs = Date.now() - scanAt;
      if (seat && seats.indexOf(seat) !== i) notes.push(`${device.label} recibió el asiento ${seats.indexOf(seat) + 1}, no el ${i + 1}: el sorteo no siguió el orden de llegada.`);
      mark(`${device.label} entró en ${(device.joinMs / 1000).toFixed(1)} s`);
      await sleep(800);
      const screen = await page.evaluate(readScreenInPage).catch(() => null);
      device.byPhase.entrada = { title: screen?.title ?? "", titlePx: screen?.titlePx ?? 0, words: screen?.words ?? 0, scrolls: !!screen?.scrolls, buttons: screen?.buttons ?? [], tapsSoFar: device.taps, file: await capture(device, `entrada-${device.id}`) };
      await sleep(JOIN_GAP_MS);
    }
    mark("Las 5 personas entraron");

    // 3. Cada persona juega su celular; la pantalla grande, si --rapido, adelanta.
    const committee = people.find((device) => device.seat.orgId === observed.scarcity?.arbiter?.orgId);
    const playPerson = async (device) => {
      let positioned = false;
      let decided = false;
      while (!finished) {
        if (failures.length) return;
        const phase = observed?.negotiation?.phase;
        if (phase === "positions" && !positioned && device !== committee) {
          const tapped = await tapWhenRead(device, `${SEL.positionGroup} button`, "su postura");
          if (tapped) positioned = true;
        }
        if (device === committee && !decided && (await device.page.getByRole("button", { name: SEL.approve }).count()) > 0) {
          const tapped = await tapWhenRead(device, COMITE === "aceptar" ? SEL.approve : SEL.reject, "decisión del Comité");
          if (tapped) decided = true;
        }
        await sleep(400);
      }
    };
    const narrate = async () => {
      if (!RAPIDO) return;
      while (!finished) {
        if (failures.length) return;
        const negotiation = observed?.negotiation;
        const humansDone = negotiation?.positions?.filter((entry) => !entry.automatic).every((entry) => entry.position) ?? false;
        const canAdvance = negotiation && ((negotiation.phase === "positions" && humansDone) || negotiation.phase === "debate" || negotiation.phase === "proposal");
        if (canAdvance && !negotiation.paused && snapped.has(currentPhase())) {
          const tapped = await tapButton(stage, SEL.next, "narrador");
          if (!tapped && (await stagePage.locator(SEL.narrator).count()) > 0 && !stage.warnedNoNext) {
            stage.warnedNoNext = true;
            notes.push("La barra del narrador está, pero sin el botón «Siguiente»: este navegador no tiene las credenciales de anfitrión.");
          }
        }
        await sleep(1200);
      }
    };

    await Promise.race([Promise.all([...people.map(playPerson), narrate(), watcher]), failurePromise()]);
    if (failures.length) throw new DemoFailure(failures[0]);

    // 4. Resultado.
    const negotiation = observed?.negotiation;
    const messages = negotiation?.messages ?? [];
    const stats = {
      roomId,
      roomCode: roomCodeServer,
      messages: messages.length,
      byKind: messages.reduce((acc, message) => ((acc[message.kind] = (acc[message.kind] ?? 0) + 1), acc), {}),
      fallback: messages.filter((message) => message.fallback).length,
      automaticPositions: (negotiation?.positions ?? []).filter((entry) => entry.automatic).map((entry) => entry.seatLabel),
      stepMs: negotiation?.stepMs ?? null,
      decision: observed?.allocation?.committeeDecision ?? observed?.decisions?.findLast?.((entry) => entry.scope === "allocation") ?? null,
      winner: observed?.allocation?.winnerCaseId ?? null,
      consoleErrors,
    };
    // Aviso de red: la pantalla grande no debe recibir valores reservados ni en el SSE.
    for (const item of stageForbidden) if (item.re.test(observedRaw)) notes.push(`Red: el SSE de la pantalla grande trae «${item.text}» (${item.entry.orgId}.${item.entry.key}) aunque no se vea.`);
    return { stats };
  } finally {
    clearTimeout(deadline);
    finished = true;
    abort.abort();
    // Si algo falló, una captura de cada pantalla para ver dónde quedó cada quien.
    if (failures.length) await Promise.all(devices.map((device) => capture(device, `falla-${device.id}`)));
    await browser.close().catch(() => {});
  }
}

/** Promesa que se resuelve cuando aparece la primera falla (o el tope de tiempo). */
function failurePromise() {
  return new Promise((resolveFailure) => {
    const id = setInterval(() => {
      if (failures.length || (finished && currentPhase() !== "done")) {
        clearInterval(id);
        resolveFailure();
      }
    }, 250);
  });
}

// --- Informe ---------------------------------------------------------------------

function phaseDurations() {
  return phaseMarks.map((entry, i) => {
    const end = phaseMarks[i + 1]?.at ?? (entry.phase === "done" ? entry.at : Date.now());
    return { phase: entry.phase, name: PHASE_NAMES[entry.phase], startS: Number(since(entry.at)), seconds: Number(((end - entry.at) / 1000).toFixed(1)) };
  });
}

function writeReport(result) {
  const leakList = [...leaks.values()];
  const ok = failures.length === 0 && leakList.length === 0 && currentPhase() === "done";
  const durations = phaseDurations();
  const phasesSeen = ["entrada", ...PHASE_ORDER];
  const people = devices.filter((device) => device.viewer !== "stage");
  const report = {
    ok,
    url: baseUrl,
    mode: RAPIDO ? "rapido" : "ritmo-real",
    committee: COMITE,
    totalSeconds: Number(since()),
    failures,
    leaks: leakList,
    notes,
    phases: durations,
    devices: devices.map((device) => ({ id: device.id, label: device.label, seat: device.seatLabel ?? null, taps: device.taps, joinSeconds: device.joinMs ? Number((device.joinMs / 1000).toFixed(1)) : null, byPhase: device.byPhase })),
    stats: result?.stats ?? null,
    timeline: timeline.map((entry) => ({ s: Number(since(entry.at)), event: entry.event })),
  };
  writeFileSync(join(outDir, "informe.json"), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push(`# Demo de novatos: ${ok ? "PASÓ" : "FALLÓ"}`, "");
  lines.push(`- Servidor: ${baseUrl}`, `- Modo: ${RAPIDO ? "rápido (Siguiente del narrador)" : "ritmo real, sin adelantar"} · Comité: ${COMITE}`, `- Duración total: ${report.totalSeconds} s`);
  if (result?.stats) {
    const s = result.stats;
    lines.push(
      `- Sala: ${s.roomId}${s.roomCode ? ` (código ${s.roomCode})` : ""} · pausa entre mensajes: ${s.stepMs ?? "?"} ms`,
      `- Mensajes: ${s.messages} (${Object.entries(s.byKind).map(([kind, n]) => `${kind} ${n}`).join(", ")}) · de respaldo: ${s.fallback}`,
      `- Posturas automáticas: ${s.automaticPositions.length ? s.automaticPositions.join(", ") : "ninguna"}`,
      `- Decisión: ${s.decision ? `${s.decision.decision ?? "?"} «${s.decision.reason ?? ""}»${s.decision.automatic ? " (automática)" : ""}` : "sin decisión"}`,
    );
    if (s.consoleErrors.length) lines.push(`- Errores de JavaScript en los navegadores: ${s.consoleErrors.length} (primero: ${s.consoleErrors[0]})`);
  }
  if (failures.length) lines.push("", "## Fallas", "", ...failures.map((failure) => `- ${failure}`));
  if (leakList.length) lines.push("", "## Datos reservados a la vista", "", ...leakList.map((leak) => `- ${leak}`));
  if (notes.length) lines.push("", "## Observaciones", "", ...notes.map((note) => `- ${note}`));
  lines.push("", "## Duración de cada fase", "", "| Fase | Empieza (s) | Dura (s) |", "|---|---:|---:|", ...durations.map((d) => `| ${d.name} | ${d.startS} | ${d.phase === "done" ? "—" : d.seconds} |`));
  lines.push("", "## Toques por persona", "", "| Persona | Asiento | Entró en (s) | Toques |", "|---|---|---:|---:|");
  for (const device of devices) lines.push(`| ${device.id} | ${device.seatLabel ?? (device.viewer === "stage" ? "pantalla grande" : "?")} | ${device.joinMs ? (device.joinMs / 1000).toFixed(1) : "—"} | ${device.taps} |`);
  lines.push("", "## Qué ve cada pantalla en cada fase", "", "Título = el texto visible más grande. Palabras = todas las de la pantalla. ↕ = hay que desplazarse.", "");
  for (const device of [devices[0], ...people].filter(Boolean)) {
    lines.push(`### ${device.label}`, "", "| Fase | Título | px | Palabras | Botones |", "|---|---|---:|---:|---|");
    for (const phase of [...phasesSeen, "done-final"]) {
      const seen = device.byPhase[phase];
      if (!seen) continue;
      lines.push(`| ${PHASE_NAMES[phase] ?? phase} | ${seen.title.replace(/\|/g, "/")} | ${seen.titlePx} | ${seen.words}${seen.scrolls ? " ↕" : ""} | ${seen.buttons.join(" · ").replace(/\|/g, "/") || "—"} |`);
    }
    lines.push("");
  }
  lines.push("## Línea de tiempo", "", ...report.timeline.map((entry) => `- ${entry.s} s: ${entry.event}`), "");
  writeFileSync(join(outDir, "informe.md"), lines.join("\n"));

  console.log("");
  console.log(ok ? "✓ PASÓ: la demo se jugó entera, sin fugas ni atascos." : "✗ FALLÓ");
  for (const failure of failures) console.log(`  - ${failure}`);
  for (const leak of leakList) console.log(`  - ${leak}`);
  for (const note of notes) console.log(`  · ${note}`);
  console.log(`  Fases: ${durations.map((d) => `${d.name} ${d.phase === "done" ? "" : `${d.seconds} s`}`.trim()).join(" → ")}`);
  console.log(`  Toques: ${devices.map((device) => `${device.seatLabel ?? device.id} ${device.taps}`).join(", ")}`);
  console.log(`  Informe: ${join(outDir, "informe.md")}`);
  return ok;
}

let result = null;
try {
  result = await main();
} catch (error) {
  if (!(error instanceof DemoFailure)) failures.push(`ERROR de la prueba: ${error.stack ?? error.message}`);
}
if (!failures.length && currentPhase() !== "done") failures.push(`La demo no llegó al acta (quedó en ${PHASE_NAMES[currentPhase()]}).`);
const ok = writeReport(result);
process.exit(ok ? 0 : 1);
