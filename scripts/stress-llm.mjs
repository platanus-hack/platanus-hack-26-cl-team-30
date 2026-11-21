#!/usr/bin/env node
// Prueba de carga de la capa de modelos, por HTTP, contra un servidor ya levantado.
//
// Lanza A LA VEZ las cuatro llamadas al modelo que puede provocar una demo:
//   - 1 mutación de genoma   POST /api/rooms/:id/mutate
//   - 3 turnos de agente     RUN_ROLE_AGENT de role_a, role_b y role_c
//
// y reporta por llamada: latencia, si la respuesta del modelo validó o se cayó al
// respaldo, y la profundidad de la cola que mostró la telemetría mientras corría.
//
// Usa dos salas nuevas: una para la mutación y otra para los agentes. La mutación
// reemplaza la organización de su sala y libera los roles, así que en una sola sala
// los turnos de agente terminarían en 409. La cola de modelos es una sola para todo
// el servidor, de modo que las cuatro llamadas compiten igual.
//
// La telemetría se lee de donde la lee la pantalla: del flujo SSE de cada sala, que
// envía un mensaje por segundo mientras el caso sigue abierto. La profundidad de
// cola es, por lo tanto, una muestra cada medio segundo aproximadamente: un pico más
// corto que eso puede no verse.
//
// CUESTA: cada corrida hace entre 4 y 8 llamadas reales al modelo (hay un reintento
// por llamada si la respuesta no valida). Contra un deploy en la nube, correrlo con
// moderación.
//
// Uso:
//   node scripts/stress-llm.mjs http://localhost:3000 [--description "frase"]
//                               [--timeout 120000] [--keep]
//
//   --description  frase para la mutación.
//   --timeout      milisegundos máximos por llamada (por defecto 120000).
//   --keep         no borra las dos salas al terminar.
//
// Sale con 0 si las cuatro llamadas respondieron 200 y la telemetría es coherente,
// 1 si algo de eso falló y 2 si no pudo empezar. Caer al respaldo no es un fallo:
// se informa.

import { openStream, parseArgs, sleep } from "./lib/client.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const baseUrl = (positional[0] ?? "").replace(/\/$/, "");
const TIMEOUT_MS = Number(flags.timeout ?? 120_000);
const KEEP = Boolean(flags.keep);
const DESCRIPTION =
  typeof flags.description === "string"
    ? flags.description
    : "Una cooperativa agrícola que reparte agua de riego entre parceleros";

if (!baseUrl) {
  console.error('Uso: node scripts/stress-llm.mjs <url> [--description "frase"] [--timeout 120000] [--keep]');
  process.exit(2);
}

// --- HTTP ----------------------------------------------------------------------

/** Petición con tiempo máximo. Nunca lanza: un error de red queda como status 0. */
async function call(method, path, body, timeoutMs = TIMEOUT_MS) {
  const startedAt = performance.now();
  try {
    const res = await fetch(baseUrl + path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Respuesta que no es JSON.
    }
    return { status: res.status, data, text, startedAt, endedAt: performance.now() };
  } catch (error) {
    return { status: 0, data: null, text: String(error?.message ?? error), startedAt, endedAt: performance.now() };
  }
}

function fail(message) {
  console.error(`No se pudo empezar: ${message}`);
  process.exit(2);
}

// --- Preparación ---------------------------------------------------------------

console.log(`Servidor: ${baseUrl}`);

// También despierta al servidor si la plataforma lo tenía dormido.
const health = await call("GET", "/api/health", undefined, 90_000);
if (health.status === 0) fail(`el servidor no responde (${health.text})`);
const llm = health.data?.llm ?? {};
console.log(`Estado:   HTTP ${health.status} · proveedor ${llm.provider ?? "?"} · modelo ${llm.model ?? "?"} · ${llm.detail ?? "sin detalle"}`);
if (health.status !== 200) console.log("          El modelo no está disponible: las llamadas deberían caer al respaldo.");

async function createRoom() {
  const res = await call("POST", "/api/rooms", { mode: "single_org" }, 30_000);
  if (res.status !== 200 || typeof res.data?.roomId !== "string") fail(`POST /api/rooms respondió ${res.status}: ${res.text.slice(0, 200)}`);
  return res.data.roomId;
}

const mutationRoom = await createRoom();
const agentRoom = await createRoom();
console.log(`Salas:    ${mutationRoom} (mutación) y ${agentRoom} (agentes)`);

// Muestras de telemetría, tal como llegan a la pantalla.
const samples = [];
const streams = new AbortController();
const record = (state, at) => {
  if (state?.telemetry) samples.push({ at, ...state.telemetry });
};
let firstState;
try {
  firstState = await openStream(`${baseUrl}/api/rooms/${agentRoom}/events`, record, streams);
  await openStream(`${baseUrl}/api/rooms/${mutationRoom}/events`, record, streams);
} catch (error) {
  fail(`no se pudo abrir el flujo de eventos (${error?.message ?? error})`);
}

const org = firstState.orgs?.[0];
if (!org) fail("la sala no trae ninguna organización");

const players = [];
for (const role of org.roles) {
  const res = await call("POST", `/api/rooms/${agentRoom}/action`, { type: "JOIN_ROLE", orgId: org.orgId, roleId: role.id }, 30_000);
  if (res.status !== 200 || typeof res.data?.token !== "string") fail(`JOIN_ROLE de ${role.id} respondió ${res.status}: ${res.text.slice(0, 200)}`);
  players.push({ orgId: org.orgId, roleId: role.id, title: role.title, token: res.data.token });
}

const before = samples.at(-1);

// --- Las cuatro llamadas, a la vez -----------------------------------------------

console.log(`\nLanzando 1 mutación y ${players.length} turnos de agente a la vez...`);
const launchedAt = performance.now();

const jobs = [
  {
    name: "Mutación de genoma",
    run: () => call("POST", `/api/rooms/${mutationRoom}/mutate`, { description: DESCRIPTION }),
    read: (data) => ({
      validated: data?.source === "llm",
      outcome: data?.source === "llm" ? "validó" : data?.source === "fallback_seed" ? "respaldo (semilla)" : "sin dato",
      serverMs: data?.latencyMs,
      detail: data?.orgName ? `organización: ${data.orgName}` : "",
    }),
  },
  ...players.map((player) => ({
    name: `Agente ${player.roleId} (${player.title})`,
    run: () => call("POST", `/api/rooms/${agentRoom}/action`, { type: "RUN_ROLE_AGENT", orgId: player.orgId, roleId: player.roleId, token: player.token }),
    read: (data) => {
      const agent = data?.agent;
      const words = typeof agent?.proposalText === "string" ? agent.proposalText.trim().split(/\s+/).length : 0;
      return {
        validated: agent?.source === "model",
        outcome: agent?.source === "model" ? "validó" : agent?.source === "fallback" ? "respaldo (determinista)" : "sin dato",
        serverMs: agent?.latencyMs,
        detail: agent ? `${words} palabras · valor sugerido ${agent.suggestedValue ?? "ninguno"} · campo pedido ${agent.attemptedFieldRead ?? "ninguno"}` : "",
      };
    },
  })),
];

const responses = await Promise.all(jobs.map((job) => job.run()));
const finishedAt = performance.now();

// Un par de mensajes más, para ver la cola vacía y los contadores finales.
await sleep(2200);
const after = samples.at(-1);
streams.abort();

// --- Informe ---------------------------------------------------------------------

const ms = (value) => (Number.isFinite(value) ? `${Math.round(value)} ms` : "-");
let failed = false;

console.log("\nPor llamada:");
const results = jobs.map((job, i) => {
  const res = responses[i];
  const inFlight = samples.filter((sample) => sample.at >= res.startedAt && sample.at <= res.endedAt);
  const maxQueue = inFlight.length ? Math.max(...inFlight.map((sample) => sample.queueDepth)) : null;
  const parsed = res.status === 200 ? job.read(res.data) : { validated: false, outcome: `ERROR HTTP ${res.status || "sin respuesta"}`, serverMs: undefined, detail: res.text.slice(0, 160) };
  if (res.status !== 200) failed = true;
  console.log(`  ${job.name}`);
  console.log(`    latencia: ${ms(res.endedAt - res.startedAt)} vista por el cliente · ${ms(parsed.serverMs)} medida en el servidor (incluye espera en cola)`);
  console.log(`    resultado: ${parsed.outcome}`);
  console.log(`    cola: ${maxQueue === null ? "sin muestras" : `máximo ${maxQueue} en espera`} (${inFlight.length} muestras durante la llamada)`);
  if (parsed.detail) console.log(`    ${parsed.detail}`);
  return { name: job.name, status: res.status, clientMs: Math.round(res.endedAt - res.startedAt), serverMs: parsed.serverMs ?? null, validated: parsed.validated, outcome: parsed.outcome, maxQueueDepth: maxQueue, samples: inFlight.length };
});

const during = samples.filter((sample) => sample.at >= launchedAt && sample.at <= finishedAt);
const maxQueueOverall = during.length ? Math.max(...during.map((sample) => sample.queueDepth)) : null;
const validated = results.filter((result) => result.validated).length;

console.log("\nEn conjunto:");
console.log(`  duración total: ${ms(finishedAt - launchedAt)}`);
console.log(`  validaron ${validated} de ${results.length}; al respaldo ${results.filter((result) => result.status === 200 && !result.validated).length}; con error ${results.filter((result) => result.status !== 200).length}`);
console.log(`  cola: máximo ${maxQueueOverall ?? "sin muestras"} en espera (${during.length} muestras de telemetría)`);

console.log("\nTelemetría que recibe la pantalla:");
if (!before || !after) {
  console.log("  no llegó telemetría por el flujo de eventos");
  failed = true;
} else {
  const sentBytes = after.bytesSentToCloud - before.bytesSentToCloud;
  console.log(`  dónde corre: ${after.provider === "local" ? "local" : "nube"} · servidor ${after.endpointHost} · modelo ${after.modelName}`);
  console.log(`  bytes a la nube: ${before.bytesSentToCloud} antes · ${after.bytesSentToCloud} después · ${sentBytes} en esta corrida`);
  console.log(`  última latencia: ${ms(after.lastLatencyMs)} · velocidad: ${after.tokensPerSec} tokens/s · en cola al terminar: ${after.queueDepth}`);

  // Coherencia: la telemetría tiene que decir la verdad sobre dónde corre el modelo.
  const problems = [];
  if (llm.provider === "anthropic" && after.provider !== "cloud") problems.push('el proveedor es Claude pero la telemetría no dice "cloud"');
  if (after.provider === "cloud" && sentBytes <= 0) problems.push("el modelo es de nube y el contador de bytes no subió con las llamadas");
  if (after.provider === "cloud" && after.bytesSentToCloud <= 0) problems.push("el modelo es de nube y la telemetría muestra 0 bytes a la nube después de llamarlo");
  if (after.provider === "local" && after.bytesSentToCloud !== 0) problems.push("el modelo es local y la telemetría cuenta bytes a la nube");
  if (after.queueDepth !== 0) problems.push(`quedaron ${after.queueDepth} llamadas en cola al terminar`);
  if (problems.length) {
    failed = true;
    for (const problem of problems) console.log(`  FALLA: ${problem}`);
  } else {
    console.log("  coherente: lo que dice la telemetría calza con el proveedor y con las llamadas hechas");
  }
}

if (!KEEP) {
  await Promise.all([mutationRoom, agentRoom].map((roomId) => call("DELETE", `/api/rooms/${roomId}`, undefined, 30_000)));
  console.log("\nSalas borradas.");
}

console.log(`\nJSON: ${JSON.stringify({ baseUrl, provider: llm.provider ?? null, model: llm.model ?? null, totalMs: Math.round(finishedAt - launchedAt), maxQueueDepth: maxQueueOverall, calls: results, telemetry: { before: before ?? null, after: after ?? null } })}`);
process.exit(failed ? 1 : 0);
