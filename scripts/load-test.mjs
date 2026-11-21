#!/usr/bin/env node
// Prueba de carga del núcleo multijugador.
//
// Crea una sala, toma un rol para poder escribir, abre N conexiones SSE
// simultáneas (mitad como ese rol con su token, mitad como pantalla "stage"),
// dispara cambios sobre un campo visible para todos y mide cuántas conexiones
// recibieron cada cambio y con qué latencia.
//
// Uso:
//   node scripts/load-test.mjs http://localhost:3000 [N] [--actions 10] [--interval 300]
//                              [--role role_a] [--field estado] [--timeout 5000]
//
// Por defecto se niega a correr contra hosts que no sean locales: no usar
// contra el deploy público. --allow-remote lo permite (por ejemplo, otra máquina
// de la red local).

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else flags[key] = args[++i];
  } else positional.push(args[i]);
}

const baseUrl = (positional[0] ?? "").replace(/\/$/, "");
const N = Number(positional[1] ?? 50);
const ACTIONS = Number(flags.actions ?? 10);
const INTERVAL_MS = Number(flags.interval ?? 300);
const TIMEOUT_MS = Number(flags.timeout ?? 5000);
const ROLE = String(flags.role ?? "role_a");
const FIELD = String(flags.field ?? "estado");

if (!baseUrl || !Number.isInteger(N) || N < 1) {
  console.error("Uso: node scripts/load-test.mjs <url> [N=50] [--actions 10] [--interval 300]");
  process.exit(1);
}

const host = new URL(baseUrl).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host) || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
if (!isLocal && !flags["allow-remote"]) {
  console.error(`Host ${host} no es local. Esta prueba no debe correr contra el deploy público. Usa --allow-remote si es una máquina de tu red.`);
  process.exit(1);
}

const now = () => performance.now();

async function postJson(path, body) {
  const res = await fetch(baseUrl + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} respondió ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// --- Conexión SSE ------------------------------------------------------------

/**
 * Abre una conexión SSE y llama a onMessage(objeto, instante) por cada evento.
 * Devuelve una promesa que se resuelve con el primer mensaje (la sala inicial).
 */
function openStream(url, onMessage, abort) {
  return new Promise((resolve, reject) => {
    let first = true;
    fetch(url, { signal: abort.signal, headers: { Accept: "text/event-stream" } })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`SSE respondió ${res.status}`);
        const decoder = new TextDecoder();
        let buffer = "";
        for await (const chunk of res.body) {
          buffer += decoder.decode(chunk, { stream: true });
          let sep;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const data = raw
              .split("\n")
              .filter((line) => line.startsWith("data: "))
              .map((line) => line.slice(6))
              .join("\n");
            if (!data) continue; // comentario de latido (": ping")
            const at = now();
            const message = JSON.parse(data);
            if (first) {
              first = false;
              resolve(message);
            }
            onMessage(message, at);
          }
        }
      })
      .catch((error) => {
        if (first) reject(error);
      });
  });
}

// --- Estadística -------------------------------------------------------------

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

const fmt = (ms) => (Number.isFinite(ms) ? `${ms.toFixed(1)} ms` : "-");

// --- Prueba ------------------------------------------------------------------

async function main() {
  console.log(`Servidor: ${baseUrl}  conexiones: ${N}  cambios: ${ACTIONS}  intervalo: ${INTERVAL_MS} ms`);

  const room = await postJson("/api/rooms");
  const roomId = room.id;
  const join = await postJson(`/api/rooms/${roomId}/action`, { type: "JOIN_ROLE", roleId: ROLE });
  const token = join.token;
  console.log(`Sala ${roomId} creada; rol ${ROLE} tomado.`);

  // sent[valor] = instante en que se envió; seen[valor][conexión] = instante en que llegó.
  const sent = new Map();
  const seen = new Map();
  const leaks = [];
  const abort = new AbortController();

  const connections = Array.from({ length: N }, (_, index) => {
    const asRole = index % 2 === 0;
    const query = asRole ? `role=${ROLE}&token=${encodeURIComponent(token)}` : "role=stage";
    return { index, viewer: asRole ? ROLE : "stage", url: `${baseUrl}/api/rooms/${roomId}/events?${query}` };
  });

  const t0 = now();
  const results = await Promise.allSettled(
    connections.map((conn) =>
      openStream(
        conn.url,
        (message, at) => {
          if (message.viewer !== conn.viewer) leaks.push(`conexión ${conn.index} pidió ${conn.viewer} y recibió ${message.viewer}`);
          const field = message.fields?.find((candidate) => candidate.key === FIELD);
          if (!field || field.redacted) return;
          const value = String(field.value);
          if (!sent.has(value)) return;
          const bucket = seen.get(value);
          if (!bucket.has(conn.index)) bucket.set(conn.index, at);
        },
        abort,
      ),
    ),
  );
  const openMs = now() - t0;
  const opened = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.filter((result) => result.status === "rejected");
  console.log(`Conexiones abiertas: ${opened}/${N} en ${fmt(openMs)}`);
  if (failed.length) console.log(`  Primer error: ${failed[0].reason?.message ?? failed[0].reason}`);
  if (opened === 0) {
    abort.abort();
    process.exit(1);
  }

  for (let i = 0; i < ACTIONS; i++) {
    const value = `carga-${i}-${Date.now()}`;
    seen.set(value, new Map());
    sent.set(value, now());
    await postJson(`/api/rooms/${roomId}/action`, { type: "SET_FIELD", roleId: ROLE, token, key: FIELD, value });
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  // Espera a que lleguen los rezagados o se cumpla el plazo.
  const deadline = now() + TIMEOUT_MS;
  while (now() < deadline && [...seen.values()].some((bucket) => bucket.size < opened)) {
    await new Promise((r) => setTimeout(r, 50));
  }
  abort.abort();

  console.log("\nCambio  recibido por      p50        p95        máx");
  const all = [];
  let complete = 0;
  let i = 0;
  for (const [value, bucket] of seen) {
    const start = sent.get(value);
    const latencies = [...bucket.values()].map((at) => at - start).sort((a, b) => a - b);
    all.push(...latencies);
    if (bucket.size === opened) complete++;
    console.log(
      `${String(i++).padStart(6)}  ${`${bucket.size}/${opened}`.padStart(12)}  ${fmt(percentile(latencies, 50)).padStart(9)}  ${fmt(percentile(latencies, 95)).padStart(9)}  ${fmt(latencies.at(-1)).padStart(9)}`,
    );
  }
  all.sort((a, b) => a - b);
  console.log(`\nResumen: ${complete}/${ACTIONS} cambios llegaron a todas las conexiones abiertas.`);
  console.log(`Latencia global (envío de la acción → recepción): p50 ${fmt(percentile(all, 50))}, p95 ${fmt(percentile(all, 95))}, máx ${fmt(all.at(-1))}`);
  console.log(leaks.length ? `ALERTA: ${leaks.length} conexiones recibieron una vista distinta a la pedida. ${leaks[0]}` : "Vista por rol: cada conexión recibió solo la vista que pidió.");

  process.exit(complete === ACTIONS && leaks.length === 0 ? 0 : 2);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
