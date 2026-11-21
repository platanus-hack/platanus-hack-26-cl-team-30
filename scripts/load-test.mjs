#!/usr/bin/env node
// Prueba de carga del tiempo real.
//
// Crea una sala, sienta al proponente y al aprobador de la primera organización
// y abre N conexiones SSE simultáneas repartidas entre tres vistas: proponente,
// aprobador y pantalla general. Después el proponente mueve su límite de
// autoridad varias veces y se mide, para cada cambio, cuántas conexiones lo
// recibieron y con qué latencia (desde que se envía la acción hasta que llega el
// mensaje). También comprueba que cada conexión recibió la vista que pidió.
//
// Uso:
//   node scripts/load-test.mjs http://localhost:3000 [N] [--mode single_org|cross_org]
//                              [--actions 10] [--interval 300] [--timeout 5000]
//
// Por defecto se niega a correr contra hosts que no sean locales: no usar contra
// el deploy público. --allow-remote lo permite (por ejemplo, otra máquina de la
// red local).

import { fmtMs, isLocalHost, openStream, parseArgs, percentile, request, sleep } from "./lib/client.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const baseUrl = (positional[0] ?? "").replace(/\/$/, "");
const N = Number(positional[1] ?? 50);
const MODE = flags.mode === "cross_org" ? "cross_org" : "single_org";
const ACTIONS = Number(flags.actions ?? 10);
const INTERVAL_MS = Number(flags.interval ?? 300);
const TIMEOUT_MS = Number(flags.timeout ?? 5000);

if (!baseUrl || !Number.isInteger(N) || N < 1) {
  console.error("Uso: node scripts/load-test.mjs <url> [N=50] [--mode single_org|cross_org] [--actions 10] [--interval 300]");
  process.exit(1);
}

const host = new URL(baseUrl).hostname;
if (!isLocalHost(host) && !flags["allow-remote"]) {
  console.error(`Host ${host} no es local. Esta prueba no debe correr contra el deploy público. Usa --allow-remote si es una máquina de tu red.`);
  process.exit(1);
}

const now = () => performance.now();

async function post(path, body) {
  const res = await request(baseUrl, "POST", path, body);
  if (!res.ok) throw new Error(`POST ${path} respondió ${res.status}: ${res.text.slice(0, 200)}`);
  return res.data;
}

/** Abre una conexión corta solo para leer el estado inicial de la sala. */
async function peek(roomId) {
  const abort = new AbortController();
  try {
    return await openStream(`${baseUrl}/api/rooms/${roomId}/events`, () => {}, abort);
  } finally {
    abort.abort();
  }
}

async function main() {
  console.log(`Servidor: ${baseUrl}  modo: ${MODE}  conexiones: ${N}  cambios: ${ACTIONS}  intervalo: ${INTERVAL_MS} ms`);

  const { roomId } = await post("/api/rooms", { mode: MODE });
  const initial = await peek(roomId);
  const org = initial.orgs[0];
  const rule = org.authorityRule;

  // Dos personas reales con token: quien cambia el límite y quien lo ve desde otro rol.
  const seats = [];
  for (const roleId of [rule.proposerRoleId, rule.approverRoleId]) {
    const joined = await post(`/api/rooms/${roomId}/action`, { type: "JOIN_ROLE", orgId: org.orgId, roleId });
    seats.push({ orgId: org.orgId, roleId, token: joined.token });
  }
  const proposer = seats[0];
  console.log(`Sala ${roomId} (${org.orgName}); ${rule.proposerRoleId} y ${rule.approverRoleId} tomados.`);

  const proposerLimitOf = (message) => message.orgs?.find((item) => item.orgId === org.orgId)?.authorityRule?.proposerLimit;
  const viewerOf = (message) => (message.viewer === "stage" ? "stage" : `${message.viewer?.orgId}/${message.viewer?.roleId}`);

  // pending: cambio en curso. seen[i] guarda, por conexión, cuándo llegó el cambio i.
  let pending = null;
  const seen = [];
  const wrongViews = [];
  const messageCounts = new Array(N).fill(0);
  const abort = new AbortController();

  const connections = Array.from({ length: N }, (_, index) => {
    const seat = [proposer, seats[1], null][index % 3];
    const query = seat ? `?orgId=${seat.orgId}&roleId=${seat.roleId}&token=${encodeURIComponent(seat.token)}` : "";
    return { index, expected: seat ? `${seat.orgId}/${seat.roleId}` : "stage", url: `${baseUrl}/api/rooms/${roomId}/events${query}` };
  });

  const t0 = now();
  const results = await Promise.allSettled(
    connections.map((conn) =>
      openStream(
        conn.url,
        (message, at) => {
          messageCounts[conn.index] += 1;
          if (viewerOf(message) !== conn.expected) wrongViews.push(`conexión ${conn.index} pidió ${conn.expected} y recibió ${viewerOf(message)}`);
          if (pending && proposerLimitOf(message) === pending.value && !pending.arrivals.has(conn.index)) pending.arrivals.set(conn.index, at);
        },
        abort,
      ),
    ),
  );
  const openMs = now() - t0;
  const opened = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.filter((result) => result.status === "rejected");
  console.log(`Conexiones abiertas: ${opened}/${N} en ${fmtMs(openMs)}`);
  if (failed.length) console.log(`  Primer error: ${failed[0].reason?.message ?? failed[0].reason}`);
  if (opened === 0) {
    abort.abort();
    process.exit(1);
  }

  // Valores enteros dentro del rango de la regla, cada uno distinto del anterior.
  const span = Math.max(1, Math.floor(rule.max - rule.min));
  const offset = Math.round(rule.proposerLimit - rule.min);
  const startedAt = now();
  for (let i = 0; i < ACTIONS; i++) {
    const value = rule.min + ((offset + 1 + i) % (span + 1));
    const change = { value, sentAt: now(), arrivals: new Map() };
    seen.push(change);
    pending = change;
    await post(`/api/rooms/${roomId}/action`, { type: "UPDATE_AUTHORITY_SLIDER", ...proposer, value });
    // Se espera a que llegue a todas las conexiones, hasta el plazo, antes del siguiente cambio.
    while (change.arrivals.size < opened && now() < change.sentAt + TIMEOUT_MS) await sleep(5);
    const rest = change.sentAt + INTERVAL_MS - now();
    if (rest > 0) await sleep(rest);
  }
  const elapsedS = (now() - startedAt) / 1000;
  pending = null;
  abort.abort();

  console.log("\nCambio  recibido por      p50        p95        máx");
  const all = [];
  let complete = 0;
  seen.forEach((change, i) => {
    const latencies = [...change.arrivals.values()].map((at) => at - change.sentAt).sort((a, b) => a - b);
    all.push(...latencies);
    if (change.arrivals.size === opened) complete += 1;
    console.log(
      `${String(i).padStart(6)}  ${`${change.arrivals.size}/${opened}`.padStart(12)}  ${fmtMs(percentile(latencies, 50)).padStart(9)}  ${fmtMs(percentile(latencies, 95)).padStart(9)}  ${fmtMs(latencies.at(-1)).padStart(9)}`,
    );
  });
  all.sort((a, b) => a - b);
  const totalMessages = messageCounts.reduce((sum, count) => sum + count, 0);

  console.log(`\nResumen: ${complete}/${ACTIONS} cambios llegaron a las ${opened} conexiones abiertas.`);
  console.log(`Latencia (envío de la acción → recepción por SSE): p50 ${fmtMs(percentile(all, 50))}, p95 ${fmtMs(percentile(all, 95))}, máx ${fmtMs(all.at(-1))}`);
  console.log(`Mensajes recibidos: ${totalMessages} en ${elapsedS.toFixed(1)} s (${(totalMessages / Math.max(elapsedS, 0.001)).toFixed(0)} por segundo, contando el pulso del contador).`);
  console.log(wrongViews.length ? `ALERTA: ${wrongViews.length} mensajes llegaron con una vista distinta a la pedida. ${wrongViews[0]}` : "Vista por rol: cada conexión recibió solo la vista que pidió.");

  process.exit(complete === ACTIONS && wrongViews.length === 0 && opened === N ? 0 : 2);
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
