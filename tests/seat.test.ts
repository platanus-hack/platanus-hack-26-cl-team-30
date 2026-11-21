// Pruebas del sorteo de silla (joinRandomSeat en src/lib/store/rooms.ts y la ruta
// POST /api/rooms/:id/seat): quien llega con el QR único de la sala recibe una
// silla libre al azar. Lo que se comprueba:
//   1. Una silla, una persona: nunca se entrega una ocupada y, cuando no quedan,
//      responde 409 NO_FREE_SEAT.
//   2. El puesto del Comité solo entra al sorteo con la clave de su QR.
//   3. La silla sorteada ve lo mismo que ese rol tomado a mano: el dato oculto no viaja.
//   4. «Sortear otro rol» entrega una silla distinta y libera la anterior.
//
// El azar se inyecta (cuarto argumento) para que cada caso sea repetible.

import { describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn() }));
vi.mock("../src/agents", () => agents);
vi.mock("server-only", () => ({}));

import { PRESENCE_TTL_MS } from "../src/lib/engine/deterministic";
import { ACTION_TYPES } from "../src/lib/store/actions";
import { applyAction, createRoom, getHostCredentials, getRoom, joinRandomSeat, projectRoom, resolveViewer } from "../src/lib/store/rooms";
import { POST as seatRoute } from "../src/app/api/rooms/[roomId]/seat/route";

const T0 = 1_800_000_000_000;
const CLINIC = "clinica_andes";
const RURAL = "hospital_rural";
const ARBITER = { orgId: "comite_red", roleId: "role_c" };

const single = () => createRoom({ mode: "single_org", now: T0 }).roomId;
const cross = () => createRoom({ mode: "cross_org", now: T0 }).roomId;
const keyOf = (roomId: string) => getHostCredentials(roomId)!.committeeKey;
const events = (roomId: string, type: string) => getRoom(roomId)!.auditLog.filter((event) => event.type === type);
const id = (seat: { orgId: string; roleId: string }) => `${seat.orgId}/${seat.roleId}`;

type Drawn = { orgId: string; roleId: string; token: string };

/** Sortea una silla y exige que salga bien. */
function draw(roomId: string, body: Record<string, unknown> = {}, now = T0, random: () => number = Math.random): Drawn {
  const res = joinRandomSeat(roomId, body, now, random);
  if (res.status !== 200 || !res.body.seat || !res.body.token) throw new Error(`El sorteo falló: ${JSON.stringify(res)}`);
  return { ...res.body.seat, token: res.body.token };
}

/** Sortea hasta que el servidor diga que no quedan sillas. Devuelve las que tocaron, en orden. */
function drawAll(roomId: string, body: Record<string, unknown> = {}): Drawn[] {
  const drawn: Drawn[] = [];
  for (let i = 0; i < 20; i++) {
    const res = joinRandomSeat(roomId, body, T0 + i);
    if (res.status !== 200) {
      expect(res).toMatchObject({ status: 409, body: { code: "NO_FREE_SEAT" } });
      return drawn;
    }
    drawn.push({ ...res.body.seat!, token: res.body.token! });
  }
  throw new Error("El sorteo nunca se quedó sin sillas");
}

describe("sorteo de silla: una silla libre al azar", () => {
  it("entrega una silla de la sala con su token, y ese token identifica al rol", () => {
    const roomId = cross();
    const seat = draw(roomId);
    expect(seat.token.length).toBeGreaterThanOrEqual(24);
    expect(resolveViewer(roomId, seat)).toEqual({ orgId: seat.orgId, roleId: seat.roleId });
    // Queda presente para las demás pantallas, igual que con JOIN_ROLE.
    expect(getRoom(roomId)!.connectedPlayers.map(id)).toEqual([id(seat)]);
  });

  it("el azar elige entre las sillas libres: el mismo número da la misma silla", () => {
    expect(id(draw(cross(), {}, T0, () => 0))).toBe(`${CLINIC}/role_a`);
    expect(id(draw(cross(), {}, T0, () => 0.999))).toBe(`${RURAL}/role_b`);
    // Un generador defectuoso (1, o negativo) no se sale de la lista.
    expect(id(draw(cross(), {}, T0, () => 1))).toBe(`${RURAL}/role_b`);
    expect(id(draw(cross(), {}, T0, () => -3))).toBe(`${CLINIC}/role_a`);
  });

  it("queda en la bitácora como silla asignada por sorteo", () => {
    const roomId = cross();
    const seat = draw(roomId);
    expect(events(roomId, "ROLE_JOINED").at(-1)).toMatchObject({ orgId: seat.orgId, roleId: seat.roleId, detail: { assigned: "random" } });
  });

  it("sala inexistente: 404; body con forma inválida: 400", () => {
    expect(joinRandomSeat("no-existe", {})).toMatchObject({ status: 404, body: { code: "ROOM_NOT_FOUND" } });
    const roomId = cross();
    for (const body of [{ committeeKey: 5 }, { current: { orgId: CLINIC } }, { current: "role_a" }, { committeeKey: "x".repeat(65) }]) {
      expect(joinRandomSeat(roomId, body), JSON.stringify(body)).toMatchObject({ status: 400, body: { code: "BAD_REQUEST" } });
    }
    // Un body vacío (o ausente) es el caso normal: recién llegado sin nada que presentar.
    expect(joinRandomSeat(roomId, undefined).status).toBe(200);
  });

  it("no agrega una acción nueva al contrato de /action", () => {
    expect(ACTION_TYPES).not.toContain("JOIN_RANDOM");
    expect(ACTION_TYPES).toHaveLength(11);
  });
});

describe("sorteo de silla: límite de asientos", () => {
  it("cada silla toca una sola vez y después responde 409 NO_FREE_SEAT", () => {
    const roomId = cross();
    const drawn = drawAll(roomId);
    expect(drawn.map(id).sort()).toEqual([`${CLINIC}/role_a`, `${CLINIC}/role_b`, `${RURAL}/role_a`, `${RURAL}/role_b`]);
    expect(new Set(drawn.map((seat) => seat.token)).size).toBe(4);
    expect(joinRandomSeat(roomId, {})).toMatchObject({ status: 409, body: { code: "NO_FREE_SEAT" } });
  });

  it("no entrega una silla que alguien ya tomó a mano", async () => {
    const roomId = single();
    expect((await applyAction(roomId, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" }, T0)).status).toBe(200);
    for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const other = createRoom({ mode: "single_org", now: T0 }).roomId;
      await applyAction(other, { type: "JOIN_ROLE", orgId: CLINIC, roleId: "role_a" }, T0);
      expect(id(draw(other, {}, T0 + 1, random))).toBe(`${CLINIC}/role_b`);
    }
    expect(id(draw(roomId, {}, T0 + 1))).toBe(`${CLINIC}/role_b`);
    expect(joinRandomSeat(roomId, {}, T0 + 2)).toMatchObject({ status: 409, body: { code: "NO_FREE_SEAT" } });
  });

  it("la silla sorteada queda ocupada también para JOIN_ROLE", async () => {
    const roomId = single();
    const seat = draw(roomId, {}, T0, () => 0);
    expect(await applyAction(roomId, { type: "JOIN_ROLE", orgId: seat.orgId, roleId: seat.roleId }, T0 + 1000)).toMatchObject({ status: 409, body: { code: "ROLE_TAKEN" } });
  });

  it("una silla abandonada (sin señal de vida) vuelve al sorteo y el token viejo deja de servir", async () => {
    const roomId = single();
    const first = draw(roomId, {}, T0, () => 0);
    const second = draw(roomId, {}, T0, () => 0);
    expect(joinRandomSeat(roomId, {}, T0 + PRESENCE_TTL_MS - 1).status).toBe(409);
    const third = draw(roomId, {}, T0 + PRESENCE_TTL_MS, () => 0);
    expect(id(third)).toBe(id(first));
    expect(third.token).not.toBe(first.token);
    expect(resolveViewer(roomId, first)).toBe("stage");
    expect(await applyAction(roomId, { type: "SEAL_RULE", ...first }, T0 + PRESENCE_TTL_MS + 1)).toMatchObject({ status: 401, body: { code: "INVALID_TOKEN" } });
    expect(id(second)).toBe(`${CLINIC}/role_b`);
  });
});

describe("sorteo de silla: el Comité solo con la clave de su QR", () => {
  it("sin la clave, el Comité nunca toca (una organización)", () => {
    const roomId = single();
    expect(drawAll(roomId).map(id).sort()).toEqual([`${CLINIC}/role_a`, `${CLINIC}/role_b`]);
  });

  it("sin la clave, el Comité árbitro nunca toca, ni los directivos internos (entre organizaciones)", () => {
    const roomId = cross();
    const drawn = drawAll(roomId).map(id);
    expect(drawn).not.toContain(id(ARBITER));
    expect(drawn.filter((seat) => seat.endsWith("/role_c"))).toEqual([]);
  });

  it("una clave equivocada vale lo mismo que no traer clave", () => {
    const roomId = cross();
    expect(drawAll(roomId, { committeeKey: "clave-inventada" }).map(id)).not.toContain(id(ARBITER));
    const one = single();
    expect(drawAll(one, { committeeKey: `${keyOf(one)}x` }).map(id)).not.toContain(`${CLINIC}/role_c`);
  });

  it("con la clave, el Comité entra al sorteo y queda registrado como entrada por QR", () => {
    const roomId = cross();
    const drawn = drawAll(roomId, { committeeKey: keyOf(roomId) });
    expect(drawn.map(id).sort()).toEqual([`${CLINIC}/role_a`, `${CLINIC}/role_b`, id(ARBITER), `${RURAL}/role_a`, `${RURAL}/role_b`].sort());
    expect(events(roomId, "QR_JOINED").at(-1)).toMatchObject({ ...ARBITER, detail: { assigned: "random" } });

    const one = single();
    expect(drawAll(one, { committeeKey: keyOf(one) }).map(id).sort()).toEqual([`${CLINIC}/role_a`, `${CLINIC}/role_b`, `${CLINIC}/role_c`]);
  });

  it("tomar el Comité a mano sin la clave sigue respondiendo 403", async () => {
    const roomId = cross();
    draw(roomId);
    expect(await applyAction(roomId, { type: "JOIN_ROLE", ...ARBITER }, T0 + 1)).toMatchObject({ status: 403, body: { code: "COMMITTEE_KEY_REQUIRED" } });
  });
});

describe("sorteo de silla: los permisos son los del rol que tocó", () => {
  it("quien recibe Urgencias por sorteo no recibe los costos, ni propios ni ajenos", () => {
    const roomId = cross();
    const seat = draw(roomId, {}, T0, () => 0);
    expect(id(seat)).toBe(`${CLINIC}/role_a`);
    const view = projectRoom(roomId, resolveViewer(roomId, seat), T0)!;
    const field = (orgId: string, key: string) => view.orgs.find((org) => org.orgId === orgId)!.fields.find((entry) => entry.key === key)!;
    expect(field(CLINIC, "triage_criticality").redacted).toBe(false);
    expect(field(CLINIC, "coverage_cost")).toMatchObject({ redacted: true });
    expect(field(CLINIC, "coverage_cost")).not.toHaveProperty("value");
    expect(field(RURAL, "coverage_cost")).not.toHaveProperty("value");
    expect(view.scarcity!.candidates.find((candidate) => candidate.orgId === RURAL)!.coverageCost).toEqual({ redacted: true, reason: "RBAC_SERVER_FILTERED" });
  });

  it("un intento de lectura ajena desde una silla sorteada responde 403 y queda en la bitácora", async () => {
    const roomId = cross();
    const seat = draw(roomId, {}, T0, () => 0);
    const res = await applyAction(roomId, { type: "TEST_RBAC_BREACH", ...seat, targetOrgId: RURAL, fieldKey: "coverage_cost" }, T0 + 1);
    expect(res).toMatchObject({ status: 403, body: { code: "RBAC_DENIED" } });
    expect(events(roomId, "RBAC_DENIED")).toHaveLength(1);
  });

  it("la silla sorteada actúa con las reglas de su rol: Urgencias no puede firmar la asignación", async () => {
    const roomId = cross();
    const seat = draw(roomId, {}, T0, () => 0);
    expect((await applyAction(roomId, { type: "SEAL_RULE", ...seat, threshold: 60 }, T0 + 1)).status).toBe(200);
    expect((await applyAction(roomId, { type: "ALLOCATION_SEAL", ...seat, reason: "Quiero la cama" }, T0 + 2)).status).not.toBe(200);
    expect(getRoom(roomId)!.decisionSealedAt).toBeNull();
  });
});

describe("sortear otro rol", () => {
  it("entrega una silla distinta, libera la anterior e invalida su token", async () => {
    const roomId = cross();
    const first = draw(roomId, {}, T0, () => 0);
    const second = draw(roomId, { current: first }, T0 + 1, () => 0);
    expect(id(second)).not.toBe(id(first));
    expect(resolveViewer(roomId, first)).toBe("stage");
    expect(resolveViewer(roomId, second)).toEqual({ orgId: second.orgId, roleId: second.roleId });
    expect(getRoom(roomId)!.connectedPlayers.map(id)).toEqual([id(second)]);
    expect(events(roomId, "ROLE_LEFT").at(-1)).toMatchObject({ orgId: first.orgId, roleId: first.roleId, detail: { rerolled: true } });
    // La silla que dejó vuelve a estar libre para otra persona.
    expect((await applyAction(roomId, { type: "JOIN_ROLE", orgId: first.orgId, roleId: first.roleId }, T0 + 2)).status).toBe(200);
  });

  it("nunca devuelve la misma silla, salga el número que salga", () => {
    for (const random of [() => 0, () => 0.3, () => 0.6, () => 0.999]) {
      const roomId = cross();
      const first = draw(roomId, {}, T0, random);
      expect(id(draw(roomId, { current: first }, T0 + 1, random))).not.toBe(id(first));
    }
  });

  it("si no queda otra libre responde 409 y la persona conserva su silla", () => {
    const roomId = single();
    const mine = draw(roomId, {}, T0, () => 0);
    draw(roomId, {}, T0);
    expect(joinRandomSeat(roomId, { current: mine }, T0 + 1)).toMatchObject({ status: 409, body: { code: "NO_FREE_SEAT" } });
    expect(resolveViewer(roomId, mine)).toEqual({ orgId: mine.orgId, roleId: mine.roleId });
  });

  it("con un token que no es el vigente no libera la silla de otra persona", () => {
    const roomId = cross();
    const victim = draw(roomId, {}, T0, () => 0);
    const intruder = draw(roomId, { current: { orgId: victim.orgId, roleId: victim.roleId, token: "token-inventado" } }, T0 + 1, () => 0);
    expect(id(intruder)).not.toBe(id(victim));
    // La víctima sigue sentada con su token; el intruso entró como un recién llegado más.
    expect(resolveViewer(roomId, victim)).toEqual({ orgId: victim.orgId, roleId: victim.roleId });
    expect(events(roomId, "ROLE_LEFT")).toEqual([]);
  });
});

describe("POST /api/rooms/:id/seat", () => {
  const post = (roomId: string, body?: unknown) =>
    seatRoute(new Request(`http://nexo.test/api/rooms/${roomId}/seat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), {
      params: Promise.resolve({ roomId }),
    });

  it("sin body entrega una silla y su token; ese token sirve en /action", async () => {
    const roomId = cross();
    const res = await post(roomId);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; seat: { orgId: string; roleId: string }; token: string };
    expect(data).toMatchObject({ ok: true, reconnected: false });
    expect([CLINIC, RURAL]).toContain(data.seat.orgId);
    expect((await applyAction(roomId, { type: "LEAVE_ROLE", ...data.seat, token: data.token })).status).toBe(200);
  });

  it("la respuesta no trae la clave del Comité ni tokens de otras sillas", async () => {
    const roomId = cross();
    const first = await (await post(roomId)).json();
    const text = JSON.stringify(await (await post(roomId)).json());
    expect(text).not.toContain(keyOf(roomId));
    expect(text).not.toContain(first.token);
  });

  it("errores con su código: 404, 400 por JSON inválido y 409 sin sillas libres", async () => {
    expect((await post("no-existe")).status).toBe(404);
    const roomId = single();
    const broken = await seatRoute(new Request(`http://nexo.test/api/rooms/${roomId}/seat`, { method: "POST", body: "{no es json" }), { params: Promise.resolve({ roomId }) });
    expect(broken.status).toBe(400);
    expect((await post(roomId)).status).toBe(200);
    expect((await post(roomId)).status).toBe(200);
    const full = await post(roomId);
    expect(full.status).toBe(409);
    expect(await full.json()).toMatchObject({ code: "NO_FREE_SEAT" });
  });
});
