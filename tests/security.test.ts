// Pruebas de los controles de seguridad traídos de la versión de Ramón y
// adaptados a nuestro almacén:
//   1. Clave del QR del Comité: sin ella nadie toma ese puesto.
//   2. Controles de anfitrión (reiniciar, ensayo automático, liberar un puesto,
//      mutar): solo con el token de quien creó la sala.
//   3. Revocación de tokens.
//   4. Límite de peticiones por cliente, con TRUST_PROXY para leer la IP.
//   5. Ensayo automático: recorre el guion completo con las mismas reglas.
//   6. Sala nueva desde una frase y escenarios entre organizaciones por HTTP.
//
// Los handlers de las rutas se llaman directo (son funciones Request -> Response).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn() }));
vi.mock("../src/agents", () => agents);
vi.mock("server-only", () => ({}));

import { buildAutopilotScript, playAutopilot } from "../src/lib/engine/autopilot";
import { getSeedGenome } from "../src/lib/genome/seeds";
import { CROSS_ORG_SCENARIO_IDS } from "../src/lib/genome/scenarios";
import { allow, clientKey, resetRateLimits, RATE_LIMITS } from "../src/lib/store/rate-limit";
import {
  NEW_ROOM_MUTATION_TIMEOUT_MS,
  applyAction,
  claimHost,
  createMutatedRoom,
  createRoom,
  getActa,
  getHostCredentials,
  getRoom,
  isHost,
  projectRoom,
  resetRoom,
  resolveViewer,
  revokeSeat,
  startAutopilot,
  stopAutopilot,
} from "../src/lib/store/rooms";
import { POST as createRoomRoute } from "../src/app/api/rooms/route";
import { DELETE as resetRoute } from "../src/app/api/rooms/[roomId]/route";
import { POST as autopilotRoute } from "../src/app/api/rooms/[roomId]/autopilot/route";
import { POST as hostRoute } from "../src/app/api/rooms/[roomId]/host/route";
import { POST as revokeRoute } from "../src/app/api/rooms/[roomId]/revoke/route";
import { POST as mutateRoute } from "../src/app/api/rooms/[roomId]/mutate/route";
import { POST as actionRoute } from "../src/app/api/rooms/[roomId]/action/route";

const T0 = 1_800_000_000_000;
const CLINIC = "clinica_andes";

const ctx = (roomId: string) => ({ params: Promise.resolve({ roomId }) });
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://nexo.test/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const del = (headers: Record<string, string> = {}) => new Request("http://nexo.test/api", { method: "DELETE", headers });

async function join(roomId: string, orgId: string, roleId: string, committeeKey?: string) {
  const res = await applyAction(roomId, { type: "JOIN_ROLE", orgId, roleId, committeeKey }, T0);
  return { res, seat: { orgId, roleId, token: res.status === 200 ? res.body.token! : "" } };
}

beforeEach(() => {
  agents.runRoleAgentTurn.mockReset();
  agents.mutateGenomeFromPrompt.mockReset();
  resetRateLimits();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// --- 1. Clave del QR del Comité ----------------------------------------------------------

describe("clave del QR del Comité", () => {
  it("sin la clave, o con una equivocada, nadie toma el puesto del árbitro: 403 y queda en la bitácora", async () => {
    const { roomId, scarcity } = createRoom({ mode: "cross_org", now: T0 });
    const arbiter = scarcity!.arbiter;
    for (const key of [undefined, "", "clave-inventada", getHostCredentials("demo")!.committeeKey]) {
      const { res } = await join(roomId, arbiter.orgId, arbiter.roleId, key);
      expect(res, String(key)).toMatchObject({ status: 403, body: { code: "COMMITTEE_KEY_REQUIRED" } });
    }
    expect(getRoom(roomId)!.auditLog.filter((event) => event.type === "AUTH_FAILED")).toHaveLength(4);
    expect(getRoom(roomId)!.connectedPlayers).toEqual([]);
  });

  it("con la clave del QR entra, y después se reconecta con su token sin volver a presentarla", async () => {
    const { roomId, scarcity } = createRoom({ mode: "cross_org", now: T0 });
    const arbiter = scarcity!.arbiter;
    const { res, seat } = await join(roomId, arbiter.orgId, arbiter.roleId, getHostCredentials(roomId)!.committeeKey);
    expect(res.status).toBe(200);
    expect(resolveViewer(roomId, seat)).toEqual({ orgId: arbiter.orgId, roleId: arbiter.roleId });
    expect(await applyAction(roomId, { type: "JOIN_ROLE", ...seat })).toMatchObject({ status: 200, body: { reconnected: true } });
  });

  it("en una sala de una organización el Comité también exige la clave; los otros roles no", async () => {
    const roomId = createRoom({ mode: "single_org", now: T0 }).roomId;
    expect((await join(roomId, CLINIC, "role_c")).res).toMatchObject({ status: 403, body: { code: "COMMITTEE_KEY_REQUIRED" } });
    expect((await join(roomId, CLINIC, "role_c", getHostCredentials(roomId)!.committeeKey)).res.status).toBe(200);
    expect((await join(roomId, CLINIC, "role_a")).res.status).toBe(200);
  });

  it("entre organizaciones, la dirección interna de cada organización no necesita la clave: solo el árbitro", async () => {
    const roomId = createRoom({ mode: "cross_org", now: T0 }).roomId;
    expect((await join(roomId, "hospital_rural", "role_c")).res.status).toBe(200);
  });

  it("las claves y el token de anfitrión no aparecen en ninguna vista ni en el acta", async () => {
    const { roomId, scarcity } = createRoom({ mode: "cross_org", now: T0 });
    const { hostToken, committeeKey } = getHostCredentials(roomId)!;
    await join(roomId, scarcity!.arbiter.orgId, scarcity!.arbiter.roleId, committeeKey);
    const outputs = [projectRoom(roomId, "stage"), projectRoom(roomId, { orgId: CLINIC, roleId: "role_b" }), projectRoom(roomId, scarcity!.arbiter), getActa(roomId), getRoom(roomId)];
    for (const output of outputs) {
      const json = JSON.stringify(output);
      expect(json).not.toContain(hostToken);
      expect(json).not.toContain(committeeKey);
    }
  });
});

// --- 2. Controles de anfitrión -----------------------------------------------------------

describe("controles de anfitrión", () => {
  it("isHost solo acepta el token de esa sala, o la clave de administración si existe", () => {
    const one = createRoom().roomId;
    const two = createRoom().roomId;
    expect(isHost(one, getHostCredentials(one)!.hostToken)).toBe(true);
    expect(isHost(one, getHostCredentials(two)!.hostToken)).toBe(false);
    expect(isHost(one, undefined)).toBe(false);
    expect(isHost(one, null, "cualquier-cosa")).toBe(false);
    vi.stubEnv("NEXO_ADMIN_KEY", "clave-admin-larga");
    expect(isHost(one, null, "clave-admin-larga")).toBe(true);
  });

  it("reiniciar por HTTP exige el token: sin él 403 HOST_ONLY y la sala sigue igual", async () => {
    const roomId = createRoom({ mode: "single_org", now: T0 }).roomId;
    const { seat } = await join(roomId, CLINIC, "role_a");
    await applyAction(roomId, { type: "UPDATE_AUTHORITY_SLIDER", ...seat, value: 70 });
    const attempts: Record<string, string>[] = [{}, { "x-host-token": "inventado" }, { "x-host-token": getHostCredentials("demo")!.hostToken }];
    for (const headers of attempts) {
      const res = await resetRoute(del(headers), ctx(roomId));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "HOST_ONLY" });
    }
    expect(getRoom(roomId)!.orgGenomes[0].authorityRule.proposerLimit).toBe(70);
    const ok = await resetRoute(del({ "x-host-token": getHostCredentials(roomId)!.hostToken }), ctx(roomId));
    expect(ok.status).toBe(200);
    expect(getRoom(roomId)!.orgGenomes[0].authorityRule.proposerLimit).toBe(100);
    expect(resolveViewer(roomId, seat)).toBe("stage");
    expect((await resetRoute(del({ "x-host-token": "x" }), ctx("sala-que-no-existe"))).status).toBe(404);
  });

  it("mutar por HTTP exige el token de anfitrión", async () => {
    const roomId = createRoom().roomId;
    const res = await mutateRoute(post({ description: "Una ferretería" }), ctx(roomId));
    expect(res.status).toBe(403);
    expect(agents.mutateGenomeFromPrompt).not.toHaveBeenCalled();
  });

  it("los controles de una sala fija: abiertos en desarrollo, con clave de administración si existe, cerrados en producción sin ella", async () => {
    expect(claimHost("demo-cross", null)).toMatchObject({ ok: true });
    vi.stubEnv("NODE_ENV", "production");
    expect(claimHost("demo-cross", null)).toMatchObject({ ok: false, status: 403, code: "HOST_ONLY" });
    vi.stubEnv("NEXO_ADMIN_KEY", "clave-admin-larga");
    expect(claimHost("demo-cross", "otra")).toMatchObject({ ok: false, status: 403 });
    const claimed = claimHost("demo-cross", "clave-admin-larga");
    expect(claimed).toMatchObject({ ok: true, credentials: getHostCredentials("demo-cross") });
    const res = await hostRoute(post({}, { "x-admin-key": "clave-admin-larga" }), ctx("demo-cross"));
    expect(await res.json()).toEqual(getHostCredentials("demo-cross"));
  });

  it("una sala creada con POST no entrega sus controles a quien los pide después", async () => {
    const roomId = createRoom().roomId;
    expect(claimHost(roomId, null)).toMatchObject({ ok: false, status: 403, code: "HOST_ONLY" });
    expect((await hostRoute(post({}), ctx(roomId))).status).toBe(403);
    expect((await hostRoute(post({}), ctx("sala-que-no-existe"))).status).toBe(404);
  });
});

// --- 3. Revocación de tokens ----------------------------------------------------------------

describe("revocación de tokens", () => {
  it("el anfitrión libera un puesto: el token deja de servir y otra persona puede tomarlo", async () => {
    const roomId = createRoom({ mode: "single_org", now: T0 }).roomId;
    const { seat } = await join(roomId, CLINIC, "role_a");
    expect(revokeSeat(roomId, { orgId: CLINIC, roleId: "role_a" })).toMatchObject({ status: 200, body: { ok: true, revoked: true } });
    expect(resolveViewer(roomId, seat)).toBe("stage");
    expect(await applyAction(roomId, { type: "SEAL_RULE", ...seat })).toMatchObject({ status: 401, body: { code: "INVALID_TOKEN" } });
    expect(getRoom(roomId)!.auditLog.at(-2)).toMatchObject({ type: "ROLE_LEFT", detail: { revokedByHost: true } });
    expect((await join(roomId, CLINIC, "role_a")).res.status).toBe(200);
  });

  it("por HTTP exige el token de anfitrión y un puesto que exista", async () => {
    const roomId = createRoom().roomId;
    const host = { "x-host-token": getHostCredentials(roomId)!.hostToken };
    expect((await revokeRoute(post({ orgId: CLINIC, roleId: "role_a" }), ctx(roomId))).status).toBe(403);
    expect((await revokeRoute(post({ orgId: CLINIC }, host), ctx(roomId))).status).toBe(400);
    expect((await revokeRoute(post({ orgId: CLINIC, roleId: "role_z" }, host), ctx(roomId))).status).toBe(404);
    expect((await revokeRoute(post({ orgId: CLINIC, roleId: "role_a" }, host), ctx(roomId))).status).toBe(200);
  });

  it("al volver a tomar un puesto abandonado, el token anterior queda revocado", async () => {
    const roomId = createRoom({ mode: "single_org", now: T0 }).roomId;
    const first = await join(roomId, CLINIC, "role_a");
    // Nadie dio señal de vida por más del tiempo de presencia: el puesto quedó libre.
    const later = await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" }, T0 + 10 * 60_000);
    expect(later.status).toBe(200);
    expect(resolveViewer(roomId, first.seat)).toBe("stage");
  });
});

// --- 4. Límite de peticiones ----------------------------------------------------------------

describe("límite de peticiones por cliente", () => {
  it("cuenta por ventana y vuelve a abrir cuando pasa el minuto", () => {
    const rule = { limit: 3, windowMs: 60_000 };
    expect([1, 2, 3, 4].map(() => allow("k", rule, T0))).toEqual([true, true, true, false]);
    expect(allow("otra", rule, T0)).toBe(true);
    expect(allow("k", rule, T0 + 60_000)).toBe(true);
  });

  it("solo lee la IP reenviada con TRUST_PROXY=1, y entonces el último salto", () => {
    const headers = new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.9", "x-real-ip": "2.2.2.2" });
    expect(clientKey(headers)).toBe("direct");
    vi.stubEnv("TRUST_PROXY", "1");
    expect(clientKey(headers)).toBe("10.0.0.9");
    expect(clientKey(new Headers({ "x-real-ip": "2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientKey(new Headers())).toBe("direct");
  });

  it("crear salas: al pasar el límite responde 429 RATE_LIMITED con Retry-After, por cliente", async () => {
    vi.stubEnv("TRUST_PROXY", "1");
    const from = (ip: string) => post({ mode: "single_org" }, { "x-forwarded-for": ip });
    for (let i = 0; i < RATE_LIMITS.createRoom.limit; i++) expect((await createRoomRoute(from("9.9.9.9"))).status).toBe(200);
    const blocked = await createRoomRoute(from("9.9.9.9"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await blocked.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect((await createRoomRoute(from("8.8.8.8"))).status).toBe(200);
  });

  it("acciones: el límite también corta antes de tocar la sala", async () => {
    const roomId = createRoom().roomId;
    const body = { type: "SEAL_RULE", orgId: CLINIC, roleId: "role_a", token: "x" };
    for (let i = 0; i < RATE_LIMITS.action.limit; i++) await actionRoute(post(body), ctx(roomId));
    expect((await actionRoute(post(body), ctx(roomId))).status).toBe(429);
  });

  it("NEXO_RATE_LIMITS=off apaga los límites", () => {
    vi.stubEnv("NEXO_RATE_LIMITS", "off");
    const rule = { limit: 1, windowMs: 60_000 };
    expect([1, 2, 3].map(() => allow("apagado", rule, T0))).toEqual([true, true, true]);
  });
});

// --- 5. Ensayo automático ---------------------------------------------------------------------

describe("ensayo automático", () => {
  it.each(CROSS_ORG_SCENARIO_IDS)("el guion llega al final en el escenario %s, con las mismas reglas que una persona", (scenario) => {
    const room = createRoom({ mode: "cross_org", scenario, now: T0 });
    const { state, outcomes } = playAutopilot(room, { withCommittee: true }, T0);
    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([]);
    expect(state).toMatchObject({ allocationStatus: "SEALED", gateStatus: "SEALED" });
    expect(state.decisionSealedAt).not.toBeNull();
    // El intento de leer el costo ajeno queda como 403 entre organizaciones.
    expect(state.auditLog.some((event) => event.type === "RBAC_DENIED" && event.detail.crossOrg === true)).toBe(true);
  });

  it("sin Comité el guion se detiene antes de la firma: la asignación queda propuesta para una persona", () => {
    const room = createRoom({ mode: "cross_org", now: T0 });
    const { state } = playAutopilot(room, { withCommittee: false }, T0);
    expect(state.allocationStatus).toBe("PROPOSED");
    expect(state.decisionSealedAt).toBeNull();
  });

  it("en una sala de una organización también llega a la firma", () => {
    const { state, outcomes } = playAutopilot(createRoom({ mode: "single_org", now: T0 }), { withCommittee: true }, T0);
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect(state.gateStatus).toBe("SEALED");
  });

  it("corre paso a paso en la sala: bots en los puestos libres, todo marcado como ensayo, y termina", async () => {
    vi.useFakeTimers({ now: T0 });
    const roomId = createRoom({ mode: "cross_org", scenario: "construccion" }).roomId;
    const total = buildAutopilotScript(getRoom(roomId)!, { withCommittee: true }).length;
    const started = startAutopilot(roomId, { stepMs: 500 });
    expect(started).toMatchObject({ status: 200, body: { running: true, steps: total, stepMs: 500 } });
    expect(projectRoom(roomId, "stage")!.autopilot).toMatchObject({ running: true, step: 0, total });
    expect(getRoom(roomId)!.auditLog.some((event) => event.type === "ROLE_JOINED" && event.detail.bot === true)).toBe(true);
    expect(startAutopilot(roomId)).toMatchObject({ status: 409, body: { code: "BUSY" } });

    await vi.advanceTimersByTimeAsync(500 * 3);
    expect(projectRoom(roomId, "stage")!.autopilot).toMatchObject({ running: true, step: 3 });
    await vi.advanceTimersByTimeAsync(500 * (total + 1));
    const view = projectRoom(roomId, "stage")!;
    expect(view.autopilot).toMatchObject({ running: false, step: total });
    expect(view.allocation).toMatchObject({ status: "SEALED" });
    const phases = getRoom(roomId)!.auditLog.filter((event) => event.type === "AUTOPILOT").map((event) => event.detail.phase);
    expect(phases[0]).toBe("start");
    expect(phases.at(-1)).toBe("end");
    expect(getRoom(roomId)!.auditLog.filter((event) => event.type === "AUTOPILOT" && event.detail.outcome === "failed")).toEqual([]);
    expect(startAutopilot(roomId)).toMatchObject({ status: 409, body: { code: "DECISION_SEALED" } });
  });

  it("si una persona tiene un puesto, el bot no lo toma y su paso se salta", async () => {
    vi.useFakeTimers({ now: T0 });
    const roomId = createRoom({ mode: "cross_org" }).roomId;
    const person = await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_b" });
    expect(person.status).toBe(200);
    const started = startAutopilot(roomId, { stepMs: 300, withCommittee: false });
    expect(started.status).toBe(200);
    if (started.status !== 200) return;
    expect(started.body.botSeats).not.toContainEqual({ orgId: CLINIC, roleId: "role_b" });
    await vi.advanceTimersByTimeAsync(300 * 20);
    const skipped = getRoom(roomId)!.auditLog.filter((event) => event.type === "AUTOPILOT" && event.detail.outcome === "skipped");
    expect(skipped.length).toBeGreaterThan(0);
    // La regla de la clínica la sella su aprobador, que es una persona: el bot no la tocó.
    expect(getRoom(roomId)!.orgGenomes[0].authorityRule.sealedThreshold).toBeNull();
  });

  it("detener y reiniciar cortan el ensayo", async () => {
    vi.useFakeTimers({ now: T0 });
    const roomId = createRoom({ mode: "single_org" }).roomId;
    startAutopilot(roomId, { stepMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(stopAutopilot(roomId)).toMatchObject({ status: 200, body: { running: false } });
    const version = getRoom(roomId)!.version;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getRoom(roomId)!.version).toBe(version);

    startAutopilot(roomId, { stepMs: 1000 });
    resetRoom(roomId);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(projectRoom(roomId, "stage")!.autopilot).toBeNull();
    expect(getRoom(roomId)!.auditLog.map((event) => event.type)).not.toContain("AUTOPILOT");
  });

  it("por HTTP: solo el anfitrión, y valida el intervalo", async () => {
    vi.useFakeTimers({ now: T0 });
    const roomId = createRoom().roomId;
    const host = { "x-host-token": getHostCredentials(roomId)!.hostToken };
    expect((await autopilotRoute(post({}), ctx(roomId))).status).toBe(403);
    expect((await autopilotRoute(post({ stepMs: 10 }, host), ctx(roomId))).status).toBe(400);
    const res = await autopilotRoute(post({ stepMs: 300 }, host), ctx(roomId));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, running: true });
    expect(await (await autopilotRoute(post({ action: "stop" }, host), ctx(roomId))).json()).toMatchObject({ ok: true, running: false });
  });
});

// --- 6. Sala nueva desde una frase y escenarios por HTTP ------------------------------------------

describe("creación de salas por HTTP", () => {
  it("cross_org acepta el escenario y entrega las claves solo a quien crea la sala", async () => {
    for (const scenario of CROSS_ORG_SCENARIO_IDS) {
      const res = await createRoomRoute(post({ mode: "cross_org", scenario }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ mode: "cross_org", scenario });
      expect(body.hostToken.length).toBeGreaterThanOrEqual(24);
      expect(body.committeeKey.length).toBeGreaterThanOrEqual(12);
      expect(getHostCredentials(body.roomId)).toEqual({ hostToken: body.hostToken, committeeKey: body.committeeKey });
      expect(getRoom(body.roomId)!.scenarioId).toBe(scenario);
    }
    const byDefault = await (await createRoomRoute(post({ mode: "cross_org" }))).json();
    expect(getRoom(byDefault.roomId)!.orgGenomes.map((genome) => genome.orgId)).toEqual([CLINIC, "hospital_rural"]);
    expect((await createRoomRoute(post({ mode: "cross_org", scenario: "aeropuertos" }))).status).toBe(400);
  });

  it("single_org con description crea una sala NUEVA ya mutada, con 15 s de plazo para el modelo", async () => {
    agents.mutateGenomeFromPrompt.mockResolvedValue({ genome: getSeedGenome("dist_tech"), source: "llm", latencyMs: 1234 });
    const res = await createRoomRoute(post({ mode: "single_org", description: "Una distribuidora mayorista" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ source: "llm", latencyMs: 1234, orgId: "dist_tech", orgName: "Distribuidora Tech B2B", mode: "single_org" });
    expect(body.hostToken).toBeTruthy();
    expect(agents.mutateGenomeFromPrompt).toHaveBeenCalledWith("Una distribuidora mayorista", { timeoutMs: NEW_ROOM_MUTATION_TIMEOUT_MS });
    expect(NEW_ROOM_MUTATION_TIMEOUT_MS).toBe(15_000);
    const state = getRoom(body.roomId)!;
    expect(state.orgGenomes[0].orgId).toBe("dist_tech");
    expect(state.auditLog.some((event) => event.type === "MUTATION" && event.detail.source === "llm")).toBe(true);
  });

  it("si el modelo no responde a tiempo se usa la semilla más parecida y source lo dice", async () => {
    agents.mutateGenomeFromPrompt.mockResolvedValue({ genome: getSeedGenome("constructora_norte"), source: "fallback_seed", seedId: "constructora_norte", latencyMs: 15_000, error: "timeout" });
    const room = await createMutatedRoom("Una constructora con una sola grúa");
    expect(room).toMatchObject({ source: "fallback_seed", seedId: "constructora_norte", orgId: "constructora_norte" });
  });

  it("un genoma que no pasa el esquema nunca entra: se usa la semilla por defecto", async () => {
    agents.mutateGenomeFromPrompt.mockResolvedValue({ genome: { orgId: "Mal Escrito" }, source: "llm", latencyMs: 5 });
    const room = await createMutatedRoom("algo");
    expect(room).toMatchObject({ source: "fallback_seed", orgId: CLINIC });
    expect(room).not.toHaveProperty("seedId");
  });

  it("mutar con frase tiene un límite propio más estricto", async () => {
    agents.mutateGenomeFromPrompt.mockResolvedValue({ genome: getSeedGenome("dist_tech"), source: "llm", latencyMs: 1 });
    for (let i = 0; i < RATE_LIMITS.mutate.limit; i++) expect((await createRoomRoute(post({ mode: "single_org", description: `frase ${i}` }))).status).toBe(200);
    expect((await createRoomRoute(post({ mode: "single_org", description: "una más" }))).status).toBe(429);
    expect((await createRoomRoute(post({ mode: "single_org" }))).status).toBe(200);
  });
});
