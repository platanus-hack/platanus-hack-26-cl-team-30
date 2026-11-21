// Pruebas del almacén de salas (src/lib/store/rooms.ts): identidad por rol,
// salas fijas, aviso de cambios y el paso de cada acción hacia el motor.
// Reemplaza a tests/rooms.test.ts, que probaba el núcleo anterior.
//
// Los agentes (src/agents) se reemplazan por dobles: así estas pruebas no llaman
// a ningún modelo y se puede comprobar qué recibe exactamente un agente.

import { beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn() }));
vi.mock("../src/agents", () => agents);

import { PRESENCE_TTL_MS } from "../src/lib/engine/deterministic";
import { getSeedGenome } from "../src/lib/genome/seeds";
import { ACTION_TYPES } from "../src/lib/store/actions";
import {
  FIXED_ROOMS,
  applyAction,
  createRoom,
  getActa,
  getHostCredentials,
  getRoom,
  isFixedRoom,
  isStakesRunning,
  mutateRoom,
  projectRoom,
  resetRoom,
  resolveViewer,
  subscribe,
  touchPresence,
} from "../src/lib/store/rooms";

const T0 = 1_800_000_000_000;
const CLINIC = "clinica_andes";
const RURAL = "hospital_rural";
const ARBITER = { orgId: "comite_red", roleId: "role_c" };

type Seat = { orgId: string; roleId: string; token: string };

/**
 * Toma un rol y devuelve sus credenciales. Presenta la clave del QR del Comité,
 * como haría quien lo escanea; las pruebas del rechazo sin clave están en
 * tests/security.test.ts.
 */
async function join(roomId: string, orgId: string, roleId: string, now = T0): Promise<Seat> {
  const committeeKey = getHostCredentials(roomId)?.committeeKey;
  const res = await applyAction(roomId, { type: "JOIN_ROLE", orgId, roleId, committeeKey }, now);
  if (res.status !== 200 || !res.body.token) throw new Error(`JOIN_ROLE falló: ${JSON.stringify(res)}`);
  return { orgId, roleId, token: res.body.token };
}

const act = (roomId: string, seat: Seat, type: string, payload: Record<string, unknown> = {}, now = T0 + 1000) => applyAction(roomId, { type, ...seat, ...payload }, now);
const events = (roomId: string, type: string) => getRoom(roomId)!.auditLog.filter((event) => event.type === type);
const single = () => createRoom({ mode: "single_org", now: T0 }).roomId;
const cross = () => createRoom({ mode: "cross_org", now: T0 }).roomId;

function agentTurn(overrides: Record<string, unknown> = {}) {
  return { proposalText: "Propongo autorizar el traslado.", suggestedValue: null, attemptedFieldRead: null, attemptedFieldOrgId: null, latencyMs: 7, source: "model", agentName: "Agente", redactions: 0, ...overrides };
}

beforeEach(() => {
  agents.runRoleAgentTurn.mockReset();
  agents.mutateGenomeFromPrompt.mockReset();
});

// --- Salas -------------------------------------------------------------------------

describe("salas", () => {
  it("crea salas single_org y cross_org con ids distintos, abiertas y con su bitácora inicial", () => {
    const one = createRoom({ mode: "single_org", now: T0 });
    const two = createRoom({ mode: "cross_org", now: T0 });
    expect(one.roomId).not.toBe(two.roomId);
    expect(one).toMatchObject({ mode: "single_org", scarcity: null, version: 0 });
    expect(two).toMatchObject({ mode: "cross_org", allocationStatus: "PENDING" });
    expect(two.orgGenomes.map((genome) => genome.orgId)).toEqual([CLINIC, RURAL]);
    expect(one.auditLog[0]).toMatchObject({ type: "ROOM_CREATED", ts: T0 });
    expect(getRoom(one.roomId)).toBe(one);
  });

  it("acepta una semilla distinta en single_org y no deja crear dos salas con el mismo id", () => {
    const room = createRoom({ mode: "single_org", seed: "dist_tech" });
    expect(room.orgGenomes[0].orgId).toBe("dist_tech");
    expect(() => createRoom({ id: room.roomId })).toThrow();
  });

  it("las salas fijas existen sin crearlas, con su modo y su escenario", () => {
    expect(FIXED_ROOMS).toEqual({
      demo: { mode: "single_org" },
      "demo-cross": { mode: "cross_org", scenario: "hospitales" },
      "demo-construccion": { mode: "cross_org", scenario: "construccion" },
      "demo-logistica": { mode: "cross_org", scenario: "logistica" },
    });
    expect(isFixedRoom("demo") && isFixedRoom("demo-cross") && isFixedRoom("demo-construccion") && isFixedRoom("demo-logistica")).toBe(true);
    expect(getRoom("demo-construccion")).toMatchObject({ mode: "cross_org", scenarioId: "construccion" });
    expect(getRoom("demo-logistica")!.orgGenomes.map((genome) => genome.orgId)).toEqual(["distribuidora_centro", "distribuidora_costa"]);
    expect(isFixedRoom("otra")).toBe(false);
    expect(getRoom("demo")).toMatchObject({ roomId: "demo", mode: "single_org" });
    expect(getRoom("demo-cross")).toMatchObject({ roomId: "demo-cross", mode: "cross_org" });
    expect(projectRoom("demo", "stage")?.orgs[0].orgId).toBe(CLINIC);
    expect(projectRoom("demo-cross", "stage")?.scarcity?.candidates).toHaveLength(2);
  });

  it("una sala fija reiniciada vuelve a su semilla: roles libres y tokens anteriores inválidos", async () => {
    resetRoom("demo");
    const seat = await join("demo", CLINIC, "role_a");
    await act("demo", seat, "UPDATE_AUTHORITY_SLIDER", { value: 70 });
    expect(getRoom("demo")!.orgGenomes[0].authorityRule.proposerLimit).toBe(70);

    expect(resetRoom("demo")).toBe(true);
    const fresh = getRoom("demo")!;
    expect(fresh.orgGenomes[0].authorityRule.proposerLimit).toBe(100);
    expect(fresh.connectedPlayers).toEqual([]);
    expect(resolveViewer("demo", seat)).toBe("stage");
    expect((await act("demo", seat, "UPDATE_AUTHORITY_SLIDER", { value: 70 })).status).toBe(401);
    expect((await applyAction("demo", { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" })).status).toBe(200);
    resetRoom("demo");
  });

  it("reiniciar una sala común la devuelve a su caso inicial con el mismo id y las mismas claves; una que no existe devuelve false", async () => {
    const roomId = cross();
    const credentials = getHostCredentials(roomId);
    const seat = await join(roomId, CLINIC, "role_a");
    await act(roomId, seat, "UPDATE_AUTHORITY_SLIDER", { value: 70 });
    expect(resetRoom(roomId)).toBe(true);
    const fresh = getRoom(roomId)!;
    expect(fresh).toMatchObject({ roomId, mode: "cross_org", connectedPlayers: [], decisions: [] });
    expect(fresh.orgGenomes[0].authorityRule.proposerLimit).toBe(100);
    expect(getHostCredentials(roomId)).toEqual(credentials);
    expect(resolveViewer(roomId, seat)).toBe("stage");
    expect(getActa(roomId)).toBeDefined();
    expect(resetRoom("sala-que-no-existe")).toBe(false);
    expect(projectRoom("sala-que-no-existe", "stage")).toBeUndefined();
  });
});

// --- Forma de las acciones ----------------------------------------------------------

describe("applyAction: forma del mensaje", () => {
  it("el contrato define exactamente los once tipos de acción", () => {
    expect([...ACTION_TYPES].sort()).toEqual(
      ["ALLOCATION_SEAL", "COMMITTEE_VETO", "HITL_DECISION", "JOIN_ROLE", "LEAVE_ROLE", "RUN_ROLE_AGENT", "SEAL_RULE", "SUBMIT_CANDIDATE", "TEST_RBAC_BREACH", "TOGGLE_FIELD_SECRET", "UPDATE_AUTHORITY_SLIDER"].sort(),
    );
  });

  it("sala inexistente: 404 ROOM_NOT_FOUND", async () => {
    expect(await applyAction("no-existe", { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" })).toMatchObject({ status: 404, body: { code: "ROOM_NOT_FOUND" } });
  });

  it("body inválido: 400 BAD_REQUEST, sin cambiar la sala", async () => {
    const roomId = single();
    const seat = await join(roomId, CLINIC, "role_a");
    const version = getRoom(roomId)!.version;
    const bad: unknown[] = [
      null,
      "texto",
      42,
      [],
      {},
      { type: "JOIN_ROLE" },
      { type: "ACCION_INVENTADA", ...seat },
      { type: "JOIN_ROLE", orgId: "", roleId: "role_a" },
      { type: "UPDATE_AUTHORITY_SLIDER", ...seat },
      { type: "UPDATE_AUTHORITY_SLIDER", ...seat, value: "70" },
      { type: "TOGGLE_FIELD_SECRET", ...seat },
      { type: "TEST_RBAC_BREACH", ...seat, fieldKey: "" },
      { type: "HITL_DECISION", ...seat, decision: "QUIZAS", reason: "x" },
      { type: "HITL_DECISION", ...seat, decision: "APPROVE" },
      { type: "SEAL_RULE", ...seat, gateMode: "modo_inventado" },
      { type: "ALLOCATION_SEAL", ...seat },
      { type: "COMMITTEE_VETO", ...seat, reason: 5 },
      { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a", token: 123 },
    ];
    for (const body of bad) {
      const res = await applyAction(roomId, body);
      expect(res, JSON.stringify(body)).toMatchObject({ status: 400, body: { code: "BAD_REQUEST" } });
      expect(typeof res.body).toBe("object");
    }
    expect(getRoom(roomId)!.version).toBe(version);
  });

  it("rol u organización que no existen en la sala: 404 ROLE_NOT_FOUND", async () => {
    const roomId = single();
    for (const actor of [{ orgId: CLINIC, roleId: "role_z" }, { orgId: "org_inventada", roleId: "role_a" }, ARBITER]) {
      expect(await applyAction(roomId, { type: "JOIN_ROLE", ...actor }), JSON.stringify(actor)).toMatchObject({ status: 404, body: { code: "ROLE_NOT_FOUND" } });
    }
  });
});

// --- Identidad -------------------------------------------------------------------

describe("identidad: un token por rol", () => {
  it("JOIN_ROLE entrega un token largo y distinto para cada rol", async () => {
    const roomId = cross();
    const seats = [await join(roomId, CLINIC, "role_a"), await join(roomId, CLINIC, "role_b"), await join(roomId, RURAL, "role_a"), await join(roomId, ARBITER.orgId, ARBITER.roleId)];
    const tokens = seats.map((seat) => seat.token);
    expect(new Set(tokens).size).toBe(4);
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(24);
    expect(events(roomId, "ROLE_JOINED")).toHaveLength(3);
    expect(events(roomId, "QR_JOINED")).toHaveLength(1);
  });

  it("un rol ocupado no se puede tomar: 409 ROLE_TAKEN y queda en la bitácora", async () => {
    const roomId = single();
    const seat = await join(roomId, CLINIC, "role_a");
    for (const token of [undefined, "token-inventado"]) {
      const res = await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a", token }, T0 + 1000);
      expect(res).toMatchObject({ status: 409, body: { code: "ROLE_TAKEN" } });
      expect(JSON.stringify(res)).not.toContain(seat.token);
    }
    expect(events(roomId, "AUTH_FAILED")).toHaveLength(2);
    expect(resolveViewer(roomId, seat)).toEqual({ orgId: CLINIC, roleId: "role_a" });
  });

  it("con el token vigente, JOIN_ROLE reconecta y devuelve el mismo token", async () => {
    const roomId = single();
    const seat = await join(roomId, CLINIC, "role_a");
    expect(await applyAction(roomId, { type: "JOIN_ROLE", ...seat }, T0 + 1000)).toEqual({ status: 200, body: { ok: true, token: seat.token, reconnected: true } });
  });

  it("un rol abandonado (sin señal de vida) se libera para otra persona y el token viejo deja de servir", async () => {
    const roomId = single();
    const first = await join(roomId, CLINIC, "role_a", T0);
    expect((await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" }, T0 + PRESENCE_TTL_MS - 1)).status).toBe(409);

    const second = await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" }, T0 + PRESENCE_TTL_MS);
    expect(second).toMatchObject({ status: 200, body: { ok: true, reconnected: false } });
    expect(second.status === 200 && second.body.token).not.toBe(first.token);
    expect(resolveViewer(roomId, first)).toBe("stage");
    expect((await act(roomId, first, "UPDATE_AUTHORITY_SLIDER", { value: 70 }, T0 + PRESENCE_TTL_MS + 1)).status).toBe(401);
  });

  it("mientras la conexión da señal de vida, el rol no se libera", async () => {
    const roomId = single();
    const seat = await join(roomId, CLINIC, "role_a", T0);
    const version = getRoom(roomId)!.version;
    touchPresence(roomId, { orgId: CLINIC, roleId: "role_a" }, T0 + PRESENCE_TTL_MS - 1);
    expect(getRoom(roomId)!.version).toBe(version);
    expect((await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" }, T0 + PRESENCE_TTL_MS + 5000)).status).toBe(409);
    expect(resolveViewer(roomId, seat)).not.toBe("stage");
  });

  it("toda acción que no sea JOIN_ROLE exige el token del rol: sin él, 401 INVALID_TOKEN y queda en la bitácora", async () => {
    const roomId = cross();
    const a = await join(roomId, CLINIC, "role_a");
    const b = await join(roomId, CLINIC, "role_b");
    const rural = await join(roomId, RURAL, "role_a");
    const payloads: Record<string, Record<string, unknown>> = {
      LEAVE_ROLE: {},
      UPDATE_AUTHORITY_SLIDER: { value: 50 },
      TOGGLE_FIELD_SECRET: { fieldKey: "triage_criticality" },
      SEAL_RULE: {},
      RUN_ROLE_AGENT: {},
      TEST_RBAC_BREACH: { fieldKey: "triage_criticality" },
      HITL_DECISION: { decision: "APPROVE", reason: "x" },
      SUBMIT_CANDIDATE: {},
      ALLOCATION_SEAL: { reason: "x" },
      COMMITTEE_VETO: { reason: "x" },
    };
    expect(Object.keys(payloads).sort()).toEqual(ACTION_TYPES.filter((type) => type !== "JOIN_ROLE").sort());

    const before = JSON.stringify(getRoom(roomId)!.orgGenomes);
    let failures = 0;
    for (const [type, payload] of Object.entries(payloads)) {
      for (const token of [undefined, "", "token-inventado", b.token, rural.token]) {
        const res = await applyAction(roomId, { type, orgId: a.orgId, roleId: a.roleId, token, ...payload });
        expect(res, `${type} con token ${token}`).toMatchObject({ status: 401, body: { code: "INVALID_TOKEN" } });
        failures += 1;
      }
    }
    expect(events(roomId, "AUTH_FAILED")).toHaveLength(failures);
    expect(JSON.stringify(getRoom(roomId)!.orgGenomes)).toBe(before);
    expect(agents.runRoleAgentTurn).not.toHaveBeenCalled();
  });

  it("el token de una sala no sirve en otra", async () => {
    const [one, two] = [single(), single()];
    const seat = await join(one, CLINIC, "role_a");
    await join(two, CLINIC, "role_a");
    expect((await act(two, seat, "UPDATE_AUTHORITY_SLIDER", { value: 50 })).status).toBe(401);
    expect(resolveViewer(two, seat)).toBe("stage");
  });

  it("LEAVE_ROLE invalida el token y deja el rol libre", async () => {
    const roomId = single();
    const seat = await join(roomId, CLINIC, "role_a");
    expect(await act(roomId, seat, "LEAVE_ROLE")).toEqual({ status: 200, body: { ok: true } });
    expect(events(roomId, "ROLE_LEFT")).toHaveLength(1);
    expect(resolveViewer(roomId, seat)).toBe("stage");
    expect((await act(roomId, seat, "UPDATE_AUTHORITY_SLIDER", { value: 50 })).status).toBe(401);
    expect((await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" }, T0 + 2000)).status).toBe(200);
  });

  it("resolveViewer entrega la vista del rol solo con su token; en cualquier otro caso, la general", async () => {
    const roomId = cross();
    const a = await join(roomId, CLINIC, "role_a");
    const committee = await join(roomId, ARBITER.orgId, ARBITER.roleId);
    expect(resolveViewer(roomId, a)).toEqual({ orgId: CLINIC, roleId: "role_a" });
    expect(resolveViewer(roomId, committee)).toEqual(ARBITER);
    for (const credentials of [
      {},
      { orgId: CLINIC, roleId: "role_a" },
      { orgId: CLINIC, roleId: "role_a", token: "" },
      { orgId: CLINIC, roleId: "role_a", token: committee.token },
      { orgId: CLINIC, roleId: "role_b", token: a.token },
      { orgId: RURAL, roleId: "role_a", token: a.token },
      { orgId: null, roleId: null, token: a.token },
      { orgId: CLINIC, roleId: "role_z", token: a.token },
    ]) {
      expect(resolveViewer(roomId, credentials), JSON.stringify(credentials)).toBe("stage");
    }
    expect(resolveViewer("no-existe", a)).toBe("stage");
  });

  it("ningún token aparece en el estado, en ninguna vista ni en el acta", async () => {
    const roomId = cross();
    const seats = [await join(roomId, CLINIC, "role_a"), await join(roomId, CLINIC, "role_b"), await join(roomId, RURAL, "role_b"), await join(roomId, ARBITER.orgId, ARBITER.roleId)];
    await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" }, T0 + 10);
    await act(roomId, { ...seats[0], token: "token-inventado" }, "SEAL_RULE");

    const acta = getActa(roomId)!;
    const outputs = [
      JSON.stringify(getRoom(roomId)),
      JSON.stringify(acta.acta),
      acta.markdown,
      JSON.stringify(projectRoom(roomId, "stage")),
      ...seats.map((seat) => JSON.stringify(projectRoom(roomId, { orgId: seat.orgId, roleId: seat.roleId }))),
    ];
    for (const output of outputs) {
      for (const seat of seats) expect(output).not.toContain(seat.token);
      expect(output).not.toContain("token-inventado");
    }
  });
});

// --- Paso de acciones al motor --------------------------------------------------------

describe("applyAction: cada acción llega al motor y su resultado vuelve como HTTP", () => {
  it("recorrido completo de una organización con sus códigos de respuesta", async () => {
    const roomId = single();
    const [a, b, c] = [await join(roomId, CLINIC, "role_a"), await join(roomId, CLINIC, "role_b"), await join(roomId, CLINIC, "role_c")];

    expect(await act(roomId, a, "TEST_RBAC_BREACH", { fieldKey: "coverage_cost" })).toMatchObject({ status: 403, body: { code: "RBAC_DENIED" } });
    expect(await act(roomId, b, "TEST_RBAC_BREACH", { fieldKey: "coverage_cost" })).toEqual({ status: 200, body: { ok: true, value: 2400000 } });
    expect(await act(roomId, a, "TEST_RBAC_BREACH", { fieldKey: "campo_inventado" })).toMatchObject({ status: 404, body: { code: "FIELD_NOT_FOUND" } });
    expect(await act(roomId, a, "UPDATE_AUTHORITY_SLIDER", { value: 500 })).toMatchObject({ status: 400, body: { code: "INVALID_VALUE" } });
    expect(await act(roomId, c, "UPDATE_AUTHORITY_SLIDER", { value: 50 })).toMatchObject({ status: 403, body: { code: "RBAC_DENIED" } });
    expect(await act(roomId, c, "HITL_DECISION", { decision: "APPROVE", reason: "Urgente" })).toMatchObject({ status: 409, body: { code: "RULE_NOT_SEALED" } });
    expect(await act(roomId, a, "SUBMIT_CANDIDATE")).toMatchObject({ status: 409, body: { code: "WRONG_MODE" } });
    expect(await act(roomId, c, "ALLOCATION_SEAL", { reason: "x" })).toMatchObject({ status: 409, body: { code: "WRONG_MODE" } });

    expect(await act(roomId, b, "SEAL_RULE", { threshold: 60 })).toEqual({ status: 200, body: { ok: true } });
    expect(isStakesRunning(roomId)).toBe(true);
    expect(await act(roomId, c, "HITL_DECISION", { decision: "APPROVE", reason: "" })).toMatchObject({ status: 400, body: { code: "REASON_REQUIRED" } });
    expect(await act(roomId, a, "HITL_DECISION", { decision: "APPROVE", reason: "Me apruebo" })).toMatchObject({ status: 403, body: { code: "RBAC_DENIED" } });
    expect(await act(roomId, c, "HITL_DECISION", { decision: "APPROVE", reason: "Gravedad alta" }, T0 + 5000)).toEqual({ status: 200, body: { ok: true } });
    expect(isStakesRunning(roomId)).toBe(false);
    expect(await act(roomId, c, "COMMITTEE_VETO", { reason: "Tarde" })).toMatchObject({ status: 409, body: { code: "DECISION_SEALED" } });

    const state = getRoom(roomId)!;
    expect(state).toMatchObject({ gateStatus: "SEALED", decisionSealedAt: T0 + 5000 });
    expect(state.decisions).toHaveLength(1);
    expect(events(roomId, "RBAC_DENIED")).toHaveLength(3);
  });

  it("COMMITTEE_VETO del Comité de la organización veta la compuerta", async () => {
    const roomId = single();
    const [b, c] = [await join(roomId, CLINIC, "role_b"), await join(roomId, CLINIC, "role_c")];
    await act(roomId, b, "SEAL_RULE", {});
    expect((await act(roomId, c, "COMMITTEE_VETO", { reason: "Sin respaldo" })).status).toBe(200);
    expect(getRoom(roomId)!.decisions.at(-1)).toMatchObject({ scope: "gate", decision: "VETO", reason: "Sin respaldo", byRoleId: "role_c" });
    expect(events(roomId, "HITL_VETOED")).toHaveLength(1);
  });

  it("recorrido entre organizaciones: candidatos, veto del Comité y sello", async () => {
    const roomId = cross();
    const [a, ruralA, ruralB] = [await join(roomId, CLINIC, "role_a"), await join(roomId, RURAL, "role_a"), await join(roomId, RURAL, "role_b")];
    const committee = await join(roomId, ARBITER.orgId, ARBITER.roleId);

    expect(await act(roomId, ruralB, "TEST_RBAC_BREACH", { targetOrgId: CLINIC, fieldKey: "coverage_cost" })).toMatchObject({ status: 403, body: { code: "RBAC_DENIED" } });
    expect(await act(roomId, committee, "ALLOCATION_SEAL", { reason: "Apurado" })).toMatchObject({ status: 409, body: { code: "ALLOCATION_NOT_READY" } });
    expect(await act(roomId, ruralA, "SUBMIT_CANDIDATE", { caseId: "A1" })).toMatchObject({ status: 403, body: { code: "RBAC_DENIED" } });
    expect(await act(roomId, a, "SUBMIT_CANDIDATE", { caseId: "Z9" })).toMatchObject({ status: 404, body: { code: "CANDIDATE_NOT_FOUND" } });
    expect((await act(roomId, a, "SUBMIT_CANDIDATE")).status).toBe(200);
    expect((await act(roomId, ruralA, "SUBMIT_CANDIDATE", { caseId: "B1" })).status).toBe(200);
    expect(getRoom(roomId)!.allocationStatus).toBe("PROPOSED");

    expect(await act(roomId, a, "ALLOCATION_SEAL", { reason: "Quiero la cama" })).toMatchObject({ status: 403, body: { code: "RBAC_DENIED" } });
    expect(await act(roomId, committee, "COMMITTEE_VETO", { reason: " " })).toMatchObject({ status: 400, body: { code: "REASON_REQUIRED" } });
    expect((await act(roomId, committee, "COMMITTEE_VETO", { reason: "Falta respaldo" })).status).toBe(200);
    expect(projectRoom(roomId, "stage")!.allocation).toMatchObject({ winnerCaseId: "A1", vetoedCaseIds: ["B1"] });
    expect((await act(roomId, committee, "ALLOCATION_SEAL", { reason: "Confirmado" }, T0 + 9000)).status).toBe(200);
    expect(getRoom(roomId)).toMatchObject({ allocationStatus: "SEALED", decisionSealedAt: T0 + 9000 });
    expect(isStakesRunning(roomId)).toBe(false);

    const { acta, markdown } = getActa(roomId)!;
    expect(acta.auditLog).toEqual(getRoom(roomId)!.auditLog);
    expect(markdown).toContain("Falta respaldo");
    expect(JSON.stringify(acta) + markdown).not.toContain("2400000");
  });
});

// --- Aviso de cambios ------------------------------------------------------------------

describe("subscribe: aviso a las conexiones", () => {
  it("avisa una vez por cada cambio, incluidos los rechazos que quedan en la bitácora, y deja de avisar al desuscribirse", async () => {
    const roomId = single();
    const a = await join(roomId, CLINIC, "role_a");
    const b = await join(roomId, CLINIC, "role_b");
    const listener = vi.fn();
    const unsubscribe = subscribe(roomId, listener);

    await act(roomId, a, "UPDATE_AUTHORITY_SLIDER", { value: 90 });
    expect(listener).toHaveBeenCalledTimes(1);
    await act(roomId, a, "TEST_RBAC_BREACH", { fieldKey: "coverage_cost" });
    expect(listener).toHaveBeenCalledTimes(2);
    await act(roomId, { ...a, token: "malo" }, "SEAL_RULE");
    expect(listener).toHaveBeenCalledTimes(3);

    // Lo que no cambia la sala no despierta a nadie.
    await act(roomId, b, "TEST_RBAC_BREACH", { fieldKey: "coverage_cost" });
    await act(roomId, a, "UPDATE_AUTHORITY_SLIDER", { value: 500 });
    await applyAction(roomId, { type: "ACCION_INVENTADA" });
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    await act(roomId, a, "UPDATE_AUTHORITY_SLIDER", { value: 80 });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("los cambios de una sala no avisan a las conexiones de otra", async () => {
    const [one, two] = [single(), single()];
    const listener = vi.fn();
    const unsubscribe = subscribe(two, listener);
    const seat = await join(one, CLINIC, "role_a");
    await act(one, seat, "UPDATE_AUTHORITY_SLIDER", { value: 90 });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

// --- Agente del rol ---------------------------------------------------------------------

describe("RUN_ROLE_AGENT: el agente hereda los permisos del rol", () => {
  it("el agente recibe solo la vista filtrada de quien lo pidió", async () => {
    const roomId = cross();
    const a = await join(roomId, CLINIC, "role_a");
    agents.runRoleAgentTurn.mockResolvedValue(agentTurn());

    const res = await act(roomId, a, "RUN_ROLE_AGENT", { instruction: "Prioriza al paciente" });
    expect(res).toMatchObject({ status: 200, body: { ok: true, agent: { proposalText: "Propongo autorizar el traslado.", source: "model" } } });
    expect(agents.runRoleAgentTurn).toHaveBeenCalledTimes(1);
    const [givenView, context] = agents.runRoleAgentTurn.mock.calls[0];
    expect(givenView.viewer).toEqual({ orgId: CLINIC, roleId: "role_a" });
    expect(context).toMatchObject({ instruction: "Prioriza al paciente" });
    const given = JSON.stringify(givenView);
    for (const secret of ["2400000", "3100000", "1600000", "1900000", "22/40"]) expect(given, `el agente recibió ${secret}`).not.toContain(secret);
    expect(given).toContain("18/40");
    expect(given).not.toContain(a.token);
  });

  it("el texto de la propuesta vuelve solo a quien lo pidió: no entra a la bitácora ni a ninguna vista", async () => {
    const roomId = cross();
    const a = await join(roomId, CLINIC, "role_a");
    agents.runRoleAgentTurn.mockResolvedValue(agentTurn({ proposalText: "TEXTO-PRIVADO-DEL-AGENTE con gravedad 18/40" }));
    await act(roomId, a, "RUN_ROLE_AGENT");

    expect(events(roomId, "AGENT_PROPOSED")).toHaveLength(1);
    expect(events(roomId, "AGENT_PROPOSED")[0]).toMatchObject({ orgId: CLINIC, roleId: "role_a", detail: { source: "model" } });
    for (const viewer of ["stage", { orgId: RURAL, roleId: "role_a" }, { orgId: CLINIC, roleId: "role_b" }, ARBITER] as const) {
      const sent = JSON.stringify(projectRoom(roomId, viewer));
      expect(sent).not.toContain("TEXTO-PRIVADO-DEL-AGENTE");
      expect(sent).not.toContain("18/40");
    }
    expect(JSON.stringify(getActa(roomId)!.acta)).not.toContain("TEXTO-PRIVADO-DEL-AGENTE");
  });

  it("el valor que sugiere el agente del proponente pasa a ser el valor del caso, acotado al rango, y la compuerta se reevalúa", async () => {
    const roomId = single();
    const a = await join(roomId, CLINIC, "role_a");
    agents.runRoleAgentTurn.mockResolvedValue(agentTurn({ suggestedValue: 40 }));
    await act(roomId, a, "RUN_ROLE_AGENT");
    expect(getRoom(roomId)!.orgGenomes[0].liveCase.proposedValue).toBe(40);
    expect(getRoom(roomId)!.gateStatus).toBe("OPEN");

    agents.runRoleAgentTurn.mockResolvedValue(agentTurn({ suggestedValue: 5000 }));
    await act(roomId, a, "RUN_ROLE_AGENT");
    expect(getRoom(roomId)!.orgGenomes[0].liveCase.proposedValue).toBe(100);
    expect(getRoom(roomId)!.gateStatus).toBe("BLOCKED_HITL_REQUIRED");
    expect(events(roomId, "GATE_BLOCKED")).toHaveLength(2);
  });

  it("el agente de un rol que no es el proponente no cambia el valor del caso", async () => {
    const roomId = single();
    const b = await join(roomId, CLINIC, "role_b");
    agents.runRoleAgentTurn.mockResolvedValue(agentTurn({ suggestedValue: 10 }));
    await act(roomId, b, "RUN_ROLE_AGENT");
    expect(getRoom(roomId)!.orgGenomes[0].liveCase.proposedValue).toBe(82);
  });

  it("el agente propone pero no decide: una propuesta nunca firma la compuerta ni sella nada", async () => {
    const roomId = single();
    const [b, c] = [await join(roomId, CLINIC, "role_b"), await join(roomId, CLINIC, "role_c")];
    await act(roomId, b, "SEAL_RULE", {});
    agents.runRoleAgentTurn.mockResolvedValue(agentTurn({ proposalText: "Apruebo y sello la decisión.", suggestedValue: 82 }));
    await act(roomId, c, "RUN_ROLE_AGENT");
    await act(roomId, b, "RUN_ROLE_AGENT");
    expect(getRoom(roomId)).toMatchObject({ gateStatus: "BLOCKED_HITL_REQUIRED", decisions: [], decisionSealedAt: null });
  });

  it("si el agente intenta leer un campo que su rol no ve, queda como 403 en la bitácora", async () => {
    const roomId = single();
    const a = await join(roomId, CLINIC, "role_a");
    agents.runRoleAgentTurn.mockResolvedValue(agentTurn({ attemptedFieldRead: "coverage_cost", attemptedFieldOrgId: CLINIC }));
    expect((await act(roomId, a, "RUN_ROLE_AGENT")).status).toBe(200);
    expect(events(roomId, "RBAC_DENIED").at(-1)).toMatchObject({ orgId: CLINIC, roleId: "role_a", detail: { fieldKey: "coverage_cost", targetOrgId: CLINIC, crossOrg: false } });
  });

  // Antes era un error conocido: el almacén no le pasaba al motor de qué organización
  // era el campo, y como "coverage_cost" existe en ambas, el intento se resolvía
  // contra el campo propio sin dejar 403. Corregido con attemptedFieldOrgId.
  it("si el agente intenta leer un campo de OTRA organización, queda como 403 entre organizaciones", async () => {
    const roomId = cross();
    const b = await join(roomId, CLINIC, "role_b");
    agents.runRoleAgentTurn.mockResolvedValue(agentTurn({ attemptedFieldRead: "coverage_cost", attemptedFieldOrgId: RURAL }));
    await act(roomId, b, "RUN_ROLE_AGENT");
    expect(events(roomId, "RBAC_DENIED").at(-1)).toMatchObject({ orgId: CLINIC, roleId: "role_b", detail: { fieldKey: "coverage_cost", targetOrgId: RURAL, crossOrg: true } });
  });

  it("el Comité árbitro no tiene agente: 409 y no se llama a ningún modelo", async () => {
    const roomId = cross();
    const committee = await join(roomId, ARBITER.orgId, ARBITER.roleId);
    expect(await act(roomId, committee, "RUN_ROLE_AGENT")).toMatchObject({ status: 409, body: { code: "WRONG_MODE" } });
    expect(agents.runRoleAgentTurn).not.toHaveBeenCalled();
  });

  it("si el rol cambió de manos mientras el modelo respondía, la propuesta se descarta", async () => {
    const roomId = single();
    const a = await join(roomId, CLINIC, "role_a");
    agents.runRoleAgentTurn.mockImplementation(async () => {
      await act(roomId, a, "LEAVE_ROLE");
      return agentTurn({ suggestedValue: 10 });
    });
    expect(await act(roomId, a, "RUN_ROLE_AGENT")).toMatchObject({ status: 409, body: { code: "ROLE_TAKEN" } });
    expect(getRoom(roomId)!.orgGenomes[0].liveCase.proposedValue).toBe(82);
    expect(events(roomId, "AGENT_PROPOSED")).toHaveLength(0);
  });
});

// --- Mutación ------------------------------------------------------------------------------

describe("mutateRoom: el modelo escribe contenido; el esquema decide si entra", () => {
  it("no se llama al modelo si la sala es fija, es cross_org, no existe o falta la frase", async () => {
    expect(await mutateRoom("demo", "Una ferretería")).toMatchObject({ status: 409, body: { code: "FIXED_ROOM" } });
    expect(await mutateRoom("demo-cross", "Una ferretería")).toMatchObject({ status: 409, body: { code: "FIXED_ROOM" } });
    expect(await mutateRoom(cross(), "Una ferretería")).toMatchObject({ status: 409, body: { code: "WRONG_MODE" } });
    expect(await mutateRoom("no-existe", "Una ferretería")).toMatchObject({ status: 404, body: { code: "ROOM_NOT_FOUND" } });
    const roomId = single();
    for (const description of [undefined, null, "", "   ", 42, {}]) {
      expect(await mutateRoom(roomId, description), JSON.stringify(description)).toMatchObject({ status: 400, body: { code: "BAD_REQUEST" } });
    }
    expect(agents.mutateGenomeFromPrompt).not.toHaveBeenCalled();
  });

  it("un genoma válido reemplaza a la organización en una sala vacía: caso nuevo y roles libres", async () => {
    const roomId = single();
    const version = getRoom(roomId)!.version;
    agents.mutateGenomeFromPrompt.mockResolvedValue({ genome: getSeedGenome("dist_tech"), source: "llm", latencyMs: 42 });

    expect(await mutateRoom(roomId, "Una distribuidora mayorista")).toEqual({ status: 200, body: { ok: true, source: "llm", latencyMs: 42, orgId: "dist_tech", orgName: "Distribuidora Tech B2B" } });
    const state = getRoom(roomId)!;
    expect(state.orgGenomes.map((genome) => genome.orgId)).toEqual(["dist_tech"]);
    expect(state).toMatchObject({ connectedPlayers: [], decisions: [], decisionSealedAt: null });
    expect(state.version).toBeGreaterThan(version);
    expect(state.auditLog.some((event) => event.type === "MUTATION" && event.detail.change === "genome" && event.detail.source === "llm")).toBe(true);
    expect((await applyAction(roomId, { type: "JOIN_ROLE", orgId: "dist_tech", roleId: "role_a" })).status).toBe(200);
  });

  it("no se puede mutar una sala con personas conectadas: nadie borra la sesión de otros", async () => {
    const roomId = single();
    const seat = await join(roomId, CLINIC, "role_a");
    agents.mutateGenomeFromPrompt.mockResolvedValue({ genome: getSeedGenome("dist_tech"), source: "llm", latencyMs: 42 });

    expect(await mutateRoom(roomId, "Una distribuidora mayorista")).toMatchObject({ status: 409, body: { code: "ROOM_IN_USE" } });
    expect(agents.mutateGenomeFromPrompt).not.toHaveBeenCalled();
    expect(getRoom(roomId)!.orgGenomes.map((genome) => genome.orgId)).toEqual([CLINIC]);
    expect(resolveViewer(roomId, seat)).not.toBe("stage");
  });

  it("si lo que devuelve el modelo no pasa el esquema, no entra: se usa una semilla y se dice", async () => {
    const roomId = single();
    const broken = JSON.parse(JSON.stringify(getSeedGenome("dist_tech")).replaceAll("dist_tech", "distribución_tech"));
    agents.mutateGenomeFromPrompt.mockResolvedValue({ genome: broken, source: "llm", latencyMs: 30 });

    const res = await mutateRoom(roomId, "Una distribuidora");
    expect(res).toMatchObject({ status: 200, body: { ok: true, source: "fallback_seed" } });
    const orgIds = getRoom(roomId)!.orgGenomes.map((genome) => genome.orgId);
    expect(orgIds).not.toContain("distribución_tech");
    expect(orgIds).toEqual([CLINIC]);
  });

  it("avisa a las conexiones abiertas de la sala", async () => {
    const roomId = single();
    const listener = vi.fn();
    const unsubscribe = subscribe(roomId, listener);
    agents.mutateGenomeFromPrompt.mockResolvedValue({ genome: getSeedGenome("dist_tech"), source: "fallback_seed", latencyMs: 1 });
    await mutateRoom(roomId, "Cualquier cosa");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
