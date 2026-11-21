// Pruebas de la sala de demo (ronda 9): la demo entre organizaciones se juega con
// 3 personas y 3 toques. Lo que se comprueba:
//   1. El sorteo del QR único reparte solo 3 asientos: quien presenta en cada
//      organización y, con su clave, el Comité.
//   2. Al entrar la primera persona, el piloto automático toma los roles
//      administrativos, sella el límite y firma solo, y esos asientos se ven
//      como bots (role.bot en la vista que viaja por el SSE).
//   3. El reloj de espera cuenta desde que entra la primera persona.
//   4. Tras el acta, la sala se reinicia con «Nueva ronda» (reinicio del
//      anfitrión) o sola tras 2 minutos sin actividad.
//   5. Una sala que no es de demo sigue igual: 5 asientos y sin bots.
//
// Los bots corren con temporizadores: se usan relojes simulados de Vitest.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn() }));
vi.mock("../src/agents", () => agents);
vi.mock("server-only", () => ({}));

import { buildDemoBotScript, demoBotSeats } from "../src/lib/engine/autopilot";
import { clockStart } from "../src/lib/engine/deterministic";
import { DEMO_BOT_STEP_MS, DEMO_RESET_IDLE_MS, applyAction, canResetWithoutHost, createRoom, getActa, getHostCredentials, getRoom, joinRandomSeat, projectRoom, resetRoom } from "../src/lib/store/rooms";
import { POST as createRoomRoute } from "../src/app/api/rooms/route";
import { DELETE as resetRoute } from "../src/app/api/rooms/[roomId]/route";

const CLINIC = "clinica_andes";
const RURAL = "hospital_rural";
const ARBITER = { orgId: "comite_red", roleId: "role_c" };
const id = (seat: { orgId: string; roleId: string }) => `${seat.orgId}/${seat.roleId}`;

type Seat = { orgId: string; roleId: string; token: string };

const demo = () => createRoom({ mode: "cross_org", demo: true }).roomId;
const keyOf = (roomId: string) => getHostCredentials(roomId)!.committeeKey;
const stage = (roomId: string) => projectRoom(roomId, "stage")!;
const role = (roomId: string, orgId: string, roleId: string) => stage(roomId).orgs.find((org) => org.orgId === orgId)!.roles.find((entry) => entry.id === roleId)!;

function draw(roomId: string, body: Record<string, unknown> = {}): Seat {
  const res = joinRandomSeat(roomId, body);
  if (res.status !== 200 || !res.body.seat || !res.body.token) throw new Error(`El sorteo falló: ${JSON.stringify(res)}`);
  return { ...res.body.seat, token: res.body.token };
}

async function join(roomId: string, orgId: string, roleId: string, committeeKey?: string): Promise<Seat> {
  const res = await applyAction(roomId, { type: "JOIN_ROLE", orgId, roleId, committeeKey });
  if (res.status !== 200 || !res.body.token) throw new Error(`JOIN_ROLE falló: ${JSON.stringify(res)}`);
  return { orgId, roleId, token: res.body.token };
}

const act = (roomId: string, seat: Seat, type: string, payload: Record<string, unknown> = {}) => applyAction(roomId, { type, ...seat, ...payload });

/** Deja que los bots terminen su guion. */
const letBotsPlay = () => vi.advanceTimersByTime(DEMO_BOT_STEP_MS * 6);

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-22T12:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sala de demo: 3 asientos humanos", () => {
  it("la vista dice que es sala de demo; las salas entre organizaciones normales no", () => {
    expect(stage(demo()).demo).toBe(true);
    expect(stage(createRoom({ mode: "cross_org" }).roomId).demo).toBe(false);
    expect(stage(createRoom({ mode: "single_org" }).roomId).demo).toBe(false);
  });

  it("las salas fijas entre organizaciones son de demo; la de una clínica no", () => {
    for (const roomId of ["demo-cross", "demo-construccion", "demo-logistica"]) {
      resetRoom(roomId);
      expect(getRoom(roomId)!.demo, roomId).toBe(true);
    }
    expect(getRoom("demo")!.demo).toBeUndefined();
  });

  it("el sorteo reparte los 3 asientos humanos SIN clave, incluido el Comité; sin sillas, 409", () => {
    const roomId = demo();
    const drawn = [draw(roomId), draw(roomId), draw(roomId)].map(id).sort();
    expect(drawn).toEqual([`${CLINIC}/role_a`, id(ARBITER), `${RURAL}/role_a`].sort());
    expect(joinRandomSeat(roomId, {})).toMatchObject({ status: 409, body: { code: "NO_FREE_SEAT" } });
    expect(stage(roomId).scarcity!.arbiter).toMatchObject({ connected: true, bot: false });
  });

  it("por orden de llegada, no al azar: 1.º Clínica, 2.º Hospital Rural, 3.º Comité", () => {
    const roomId = demo();
    // Aunque el azar diga otra cosa, en la demo manda el orden de llegada.
    const order = [0.999, 0.5, 0].map((value) => {
      const res = joinRandomSeat(roomId, {}, Date.now(), () => value);
      if (res.status !== 200 || !res.body.seat) throw new Error(`El sorteo falló: ${JSON.stringify(res)}`);
      return id(res.body.seat);
    });
    expect(order).toEqual([`${CLINIC}/role_a`, `${RURAL}/role_a`, id(ARBITER)]);
  });

  it("con la clave del QR también: el resultado es el mismo", () => {
    const roomId = demo();
    const drawn = [1, 2, 3].map(() => id(draw(roomId, { committeeKey: keyOf(roomId) }))).sort();
    expect(drawn).toEqual([`${CLINIC}/role_a`, id(ARBITER), `${RURAL}/role_a`].sort());
    expect(joinRandomSeat(roomId, { committeeKey: keyOf(roomId) })).toMatchObject({ status: 409, body: { code: "NO_FREE_SEAT" } });
  });

  it("en una sala normal el Comité sigue exigiendo la clave: nunca sale en un sorteo sin ella", () => {
    const roomId = createRoom({ mode: "cross_org" }).roomId;
    const drawn: string[] = [];
    for (let i = 0; i < 10; i++) {
      const res = joinRandomSeat(roomId, {});
      if (res.status !== 200 || !res.body.seat) break;
      drawn.push(id(res.body.seat));
    }
    expect(drawn).toHaveLength(4);
    expect(drawn).not.toContain(id(ARBITER));
  });

  it("tomar el Comité a mano con JOIN_ROLE sigue pidiendo la clave, también en la demo", async () => {
    const roomId = demo();
    expect(await applyAction(roomId, { type: "JOIN_ROLE", ...ARBITER })).toMatchObject({ status: 403, body: { code: "COMMITTEE_KEY_REQUIRED" } });
  });

  it("POST /api/rooms con demo: true crea una sala de demo", async () => {
    const res = await createRoomRoute(new Request("http://nexo.test/api/rooms", { method: "POST", body: JSON.stringify({ mode: "cross_org", demo: true }) }));
    const data = await res.json();
    expect(data).toMatchObject({ mode: "cross_org", demo: true });
    expect(getRoom(data.roomId)!.demo).toBe(true);
  });
});

describe("sala de demo: los roles administrativos los juega el piloto automático", () => {
  it("el guion de demo solo usa a los aprobadores: sella el límite y firma", () => {
    const state = getRoom(demo())!;
    expect(demoBotSeats(state).map(id)).toEqual([`${CLINIC}/role_b`, `${RURAL}/role_b`]);
    expect(buildDemoBotScript(state).map((step) => id(step.seat))).toEqual([`${CLINIC}/role_b`, `${RURAL}/role_b`, `${CLINIC}/role_b`, `${RURAL}/role_b`]);
  });

  it("nadie adentro: no hay bots todavía", () => {
    const roomId = demo();
    expect(getRoom(roomId)!.botSeats ?? []).toEqual([]);
    expect(role(roomId, CLINIC, "role_b")).toMatchObject({ connected: false, bot: false });
  });

  it("al entrar la primera persona, los bots toman los asientos administrativos y se ven como bots", () => {
    const roomId = demo();
    draw(roomId);
    for (const orgId of [CLINIC, RURAL]) expect(role(roomId, orgId, "role_b"), orgId).toMatchObject({ connected: true, bot: true });
    expect(role(roomId, CLINIC, "role_a").bot).toBe(false);
    expect(stage(roomId).scarcity!.arbiter.bot).toBe(false);
    expect(stage(roomId).autopilot).toMatchObject({ running: true, botSeats: [{ orgId: CLINIC, roleId: "role_b" }, { orgId: RURAL, roleId: "role_b" }] });
    expect(getRoom(roomId)!.auditLog.filter((event) => event.type === "ROLE_JOINED" && event.detail.bot === true)).toHaveLength(2);
  });

  it("los bots sellan el límite y firman solos, sin que nadie más haga nada, y siguen visibles al terminar", () => {
    const roomId = demo();
    draw(roomId);
    letBotsPlay();
    const view = stage(roomId);
    for (const org of view.orgs) {
      expect(org.conflict.hasConflict, org.orgId).toBe(false);
      expect(org.gate.outcome, org.orgId).toBe("approved");
    }
    expect(view.autopilot).toMatchObject({ running: false });
    // Pasado el tiempo de presencia, un bot sigue conectado: no deja la silla vacía a mitad de ronda.
    vi.advanceTimersByTime(60_000);
    expect(role(roomId, RURAL, "role_b")).toMatchObject({ connected: true, bot: true });
    const signatures = getRoom(roomId)!.decisions.filter((decision) => decision.scope === "gate");
    expect(signatures.map((decision) => decision.byRoleId)).toEqual(["role_b", "role_b"]);
    expect(signatures.every((decision) => decision.reason.includes("bot"))).toBe(true);
  });

  it("los bots arrancan una sola vez por ronda", () => {
    const roomId = demo();
    draw(roomId);
    draw(roomId);
    letBotsPlay();
    expect(getRoom(roomId)!.auditLog.filter((event) => event.type === "AUTOPILOT" && event.detail.phase === "start")).toHaveLength(1);
  });

  it("si una persona toma un asiento administrativo a mano, ese no lo juega un bot", async () => {
    const roomId = demo();
    await join(roomId, CLINIC, "role_b");
    expect(role(roomId, CLINIC, "role_b").bot).toBe(false);
    expect(role(roomId, RURAL, "role_b").bot).toBe(true);
    letBotsPlay();
    expect(stage(roomId).orgs.find((org) => org.orgId === CLINIC)!.gate.outcome).toBeNull();
  });

  it("recorrido completo con 3 personas y 3 toques: dos casos presentados y el Comité decide", async () => {
    const roomId = demo();
    const key = keyOf(roomId);
    const seats = [draw(roomId, { committeeKey: key }), draw(roomId, { committeeKey: key }), draw(roomId, { committeeKey: key })];
    const committee = seats.find((seat) => id(seat) === id(ARBITER))!;
    const presenters = seats.filter((seat) => seat !== committee);
    // Quien presenta no espera a los bots: puede presentar de inmediato.
    for (const seat of presenters) expect((await act(roomId, seat, "SUBMIT_CANDIDATE")).status).toBe(200);
    expect(stage(roomId).allocation!.status).toBe("PROPOSED");
    expect((await act(roomId, committee, "ALLOCATION_SEAL", { reason: "Mayor necesidad sin cubrir." })).status).toBe(200);
    letBotsPlay();
    const view = stage(roomId);
    expect(view.allocation!.status).toBe("SEALED");
    expect(view.stakes.status).toBe("CONTAINED");
  });
});

describe("reloj de espera", () => {
  it("marca 0 hasta que entra la primera persona, aunque la sala lleve más de una hora creada", () => {
    const roomId = demo();
    // Menos de ROOM_IDLE_TTL_MS (2 h): pasado eso, la limpieza borra la sala vacía.
    vi.advanceTimersByTime(90 * 60 * 1000);
    expect(stage(roomId).stakes).toMatchObject({ status: "BLEEDING", elapsedMs: 0 });
    draw(roomId);
    vi.advanceTimersByTime(7000);
    expect(stage(roomId).stakes.elapsedMs).toBe(7000);
  });

  it("un bot no arranca el reloj; una persona sí, y el tiempo hasta la decisión cuenta desde ella", async () => {
    const roomId = demo();
    const created = getRoom(roomId)!;
    expect(created.clockStartedAt).toBeNull();
    vi.advanceTimersByTime(30_000);
    const first = draw(roomId, { committeeKey: keyOf(roomId) });
    expect(getRoom(roomId)!.clockStartedAt).toBe(created.caseOpenedAt + 30_000);
    expect(clockStart(getRoom(roomId)!)).toBe(created.caseOpenedAt + 30_000);
    const rest = [draw(roomId, { committeeKey: keyOf(roomId) }), draw(roomId, { committeeKey: keyOf(roomId) })];
    const all = [first, ...rest];
    for (const seat of all.filter((seat) => id(seat) !== id(ARBITER))) await act(roomId, seat, "SUBMIT_CANDIDATE");
    vi.advanceTimersByTime(5000);
    await act(roomId, all.find((seat) => id(seat) === id(ARBITER))!, "ALLOCATION_SEAL", { reason: "Equidad." });
    expect(stage(roomId).stakes.timeToDecisionMs).toBe(5000);
  });

  it("las salas que no son de demo también cuentan desde la primera persona", async () => {
    const roomId = createRoom({ mode: "single_org" }).roomId;
    vi.advanceTimersByTime(60_000);
    expect(stage(roomId).stakes.elapsedMs).toBe(0);
    await join(roomId, CLINIC, "role_a");
    vi.advanceTimersByTime(3000);
    expect(stage(roomId).stakes.elapsedMs).toBe(3000);
  });
});

describe("nueva ronda", () => {
  async function sealedDemo(): Promise<string> {
    const roomId = demo();
    const key = keyOf(roomId);
    const seats = [1, 2, 3].map(() => draw(roomId, { committeeKey: key }));
    letBotsPlay();
    for (const seat of seats.filter((seat) => id(seat) !== id(ARBITER))) await act(roomId, seat, "SUBMIT_CANDIDATE");
    await act(roomId, seats.find((seat) => id(seat) === id(ARBITER))!, "ALLOCATION_SEAL", { reason: "Equidad." });
    expect(getRoom(roomId)!.decisionSealedAt).not.toBeNull();
    return roomId;
  }

  it("el reinicio del anfitrión («Nueva ronda») deja la sala de demo limpia, sin bots y con el reloj en 0", async () => {
    const roomId = await sealedDemo();
    const { hostToken, committeeKey } = getHostCredentials(roomId)!;
    expect(resetRoom(roomId)).toBe(true);
    const state = getRoom(roomId)!;
    expect(state).toMatchObject({ demo: true, decisionSealedAt: null, clockStartedAt: null, allocationStatus: "PENDING" });
    expect(state.botSeats ?? []).toEqual([]);
    expect(stage(roomId).autopilot ?? null).toBeNull();
    expect(getHostCredentials(roomId)).toEqual({ hostToken, committeeKey });
    // La siguiente ronda vuelve a traer los bots con la primera persona.
    draw(roomId);
    expect(role(roomId, CLINIC, "role_b").bot).toBe(true);
  });

  it("«Nueva ronda» sin token de anfitrión: en la demo, solo con el acta cerrada", async () => {
    const del = (roomId: string, headers: Record<string, string> = {}) =>
      resetRoute(new Request(`http://nexo.test/api/rooms/${roomId}`, { method: "DELETE", headers }), { params: Promise.resolve({ roomId }) });
    // Antes del acta: solo el anfitrión. Nadie puede borrar una ronda en curso.
    const playing = demo();
    draw(playing);
    expect(await del(playing)).toHaveProperty("status", 403);
    expect(getRoom(playing)!.connectedPlayers.length).toBeGreaterThan(0);
    // Con el acta cerrada: cualquiera, sin token.
    const roomId = await sealedDemo();
    expect(canResetWithoutHost(roomId)).toBe(true);
    const res = await del(roomId);
    expect(res.status).toBe(200);
    expect(getRoom(roomId)).toMatchObject({ demo: true, decisionSealedAt: null, clockStartedAt: null });
    // Recién reiniciada (sin acta) vuelve a pedir el token.
    expect(canResetWithoutHost(roomId)).toBe(false);
    expect(await del(roomId)).toHaveProperty("status", 403);
  });

  it("en una sala normal con el acta cerrada, el reinicio sigue siendo solo del anfitrión", async () => {
    const roomId = createRoom({ mode: "cross_org" }).roomId;
    const key = keyOf(roomId);
    const a = await join(roomId, CLINIC, "role_a");
    const b = await join(roomId, RURAL, "role_a");
    const c = await join(roomId, ARBITER.orgId, ARBITER.roleId, key);
    await act(roomId, a, "SUBMIT_CANDIDATE");
    await act(roomId, b, "SUBMIT_CANDIDATE");
    await act(roomId, c, "ALLOCATION_SEAL", { reason: "Equidad." });
    expect(getRoom(roomId)!.decisionSealedAt).not.toBeNull();
    expect(canResetWithoutHost(roomId)).toBe(false);
    const res = await resetRoute(new Request(`http://nexo.test/api/rooms/${roomId}`, { method: "DELETE" }), { params: Promise.resolve({ roomId }) });
    expect(res.status).toBe(403);
    expect(getRoom(roomId)!.decisionSealedAt).not.toBeNull();
  });

  it("tras el acta, se reinicia sola a los 2 minutos sin actividad", async () => {
    const roomId = await sealedDemo();
    vi.advanceTimersByTime(DEMO_RESET_IDLE_MS - 1000);
    expect(getRoom(roomId)!.decisionSealedAt).not.toBeNull();
    vi.advanceTimersByTime(2000);
    expect(getRoom(roomId)).toMatchObject({ decisionSealedAt: null, clockStartedAt: null });
  });

  it("una acción después del acta vuelve a empezar la cuenta de 2 minutos", async () => {
    const roomId = await sealedDemo();
    vi.advanceTimersByTime(DEMO_RESET_IDLE_MS - 10_000);
    joinRandomSeat(roomId, {});
    vi.advanceTimersByTime(20_000);
    expect(getRoom(roomId)!.decisionSealedAt).not.toBeNull();
    vi.advanceTimersByTime(DEMO_RESET_IDLE_MS);
    expect(getRoom(roomId)!.decisionSealedAt).toBeNull();
  });

  it("una sala que no es de demo no se reinicia sola tras el acta", async () => {
    const roomId = createRoom({ mode: "cross_org" }).roomId;
    const key = keyOf(roomId);
    const people = {
      a: await join(roomId, CLINIC, "role_a"),
      b: await join(roomId, RURAL, "role_a"),
      c: await join(roomId, ARBITER.orgId, ARBITER.roleId, key),
    };
    await act(roomId, people.a, "SUBMIT_CANDIDATE");
    await act(roomId, people.b, "SUBMIT_CANDIDATE");
    await act(roomId, people.c, "ALLOCATION_SEAL", { reason: "Equidad." });
    vi.advanceTimersByTime(DEMO_RESET_IDLE_MS * 3);
    expect(getRoom(roomId)!.decisionSealedAt).not.toBeNull();
    expect(getRoom(roomId)!.botSeats ?? []).toEqual([]);
  });
});

describe("demo pauteada: orden de los asientos, turno y plan B", () => {
  const turnOf = (roomId: string) => stage(roomId).turn;
  const events = (roomId: string, type: string) => getRoom(roomId)!.auditLog.filter((event) => event.type === type);

  it("cada asiento humano trae su orden y su nombre corto; los bots y las salas normales no", () => {
    const view = stage(demo());
    const label = (orgId: string, roleId: string) => view.orgs.find((org) => org.orgId === orgId)!.roles.find((entry) => entry.id === roleId)!;
    expect(label(CLINIC, "role_a")).toMatchObject({ seatOrder: 1, seatLabel: "Clínica" });
    expect(label(RURAL, "role_a")).toMatchObject({ seatOrder: 2, seatLabel: "Hospital Rural" });
    expect(view.scarcity!.arbiter).toMatchObject({ seatOrder: 3, seatLabel: "Comité" });
    expect(label(CLINIC, "role_b").seatOrder).toBeUndefined();
    const normal = stage(createRoom({ mode: "cross_org" }).roomId);
    expect(normal.orgs[0]!.roles[0]!.seatOrder).toBeUndefined();
    expect(normal.turn).toBeUndefined();
  });

  it("el turno sigue el guion: Clínica presenta, Hospital Rural presenta, el Comité decide; nadie adentro o acta cerrada, null", async () => {
    const roomId = demo();
    expect(turnOf(roomId)).toBeNull();
    const [clinic, rural, committee] = [draw(roomId), draw(roomId), draw(roomId)];
    expect(turnOf(roomId)).toMatchObject({ orgId: CLINIC, roleId: "role_a", seatOrder: 1, label: "Clínica", action: "submit", totalMs: 20_000 });
    await act(roomId, clinic, "SUBMIT_CANDIDATE");
    expect(turnOf(roomId)).toMatchObject({ label: "Hospital Rural", action: "submit" });
    await act(roomId, rural, "SUBMIT_CANDIDATE");
    expect(turnOf(roomId)).toMatchObject({ label: "Comité", seatOrder: 3, action: "decide" });
    await act(roomId, committee, "ALLOCATION_SEAL", { reason: "Se acepta la propuesta por equidad." });
    expect(turnOf(roomId)).toBeNull();
  });

  it("la cuenta regresiva baja con el reloj del servidor y vuelve a 20 s en cada turno", async () => {
    const roomId = demo();
    const clinic = draw(roomId);
    vi.advanceTimersByTime(8000);
    expect(turnOf(roomId)!.remainingMs).toBe(12_000);
    await act(roomId, clinic, "SUBMIT_CANDIDATE");
    expect(turnOf(roomId)).toMatchObject({ label: "Hospital Rural", remainingMs: 20_000 });
  });

  it("plan B: si nadie actúa en 20 s, el piloto juega cada turno y queda como automático en el acta", () => {
    const roomId = demo();
    draw(roomId);
    vi.advanceTimersByTime(20_000);
    expect(stage(roomId).scarcity!.candidates.find((candidate) => candidate.orgId === CLINIC)!.submitted).toBe(true);
    expect(events(roomId, "CANDIDATE_SUBMITTED").at(-1)!.detail).toMatchObject({ modo: "automático", motivo: "Clínica no actuó en 20 s" });
    expect(turnOf(roomId)).toMatchObject({ label: "Hospital Rural", remainingMs: 20_000 });
    vi.advanceTimersByTime(20_000);
    expect(turnOf(roomId)).toMatchObject({ label: "Comité" });
    vi.advanceTimersByTime(20_000);
    const state = getRoom(roomId)!;
    expect(state.allocationStatus).toBe("SEALED");
    const sealed = events(roomId, "ALLOCATION_SEALED").at(-1)!;
    expect(sealed.detail).toMatchObject({ modo: "automático" });
    expect(String(sealed.detail.reason)).toMatch(/^Automático \(plan B\)/);
    expect(state.decisions.at(-1)!.reason).toMatch(/^Automático \(plan B\)/);
    expect(events(roomId, "AUTOPILOT").filter((event) => event.detail.phase === "turn" && event.detail.automatic === true)).toHaveLength(3);
    expect(getActa(roomId)!.markdown).toContain("automático");
  });

  it("si la persona actúa a tiempo, el plan B no juega por ella", async () => {
    const roomId = demo();
    const clinic = draw(roomId);
    vi.advanceTimersByTime(19_000);
    await act(roomId, clinic, "SUBMIT_CANDIDATE");
    vi.advanceTimersByTime(5000);
    const submitted = events(roomId, "CANDIDATE_SUBMITTED");
    expect(submitted).toHaveLength(1);
    expect(submitted[0]!.detail.modo).toBeUndefined();
  });

  it("si el Comité rechaza, vuelve a ser su turno con el otro caso y la cuenta empieza de nuevo", async () => {
    const roomId = demo();
    const [clinic, rural, committee] = [draw(roomId), draw(roomId), draw(roomId)];
    await act(roomId, clinic, "SUBMIT_CANDIDATE");
    await act(roomId, rural, "SUBMIT_CANDIDATE");
    vi.advanceTimersByTime(15_000);
    expect((await act(roomId, committee, "COMMITTEE_VETO", { reason: "Se rechaza la propuesta para revisar el caso." })).status).toBe(200);
    expect(turnOf(roomId)).toMatchObject({ label: "Comité", action: "decide", remainingMs: 20_000 });
  });

  it("con el plan B apagado (turnTimeoutMs 0) nadie juega por la persona", () => {
    const roomId = createRoom({ mode: "cross_org", demo: true, turnTimeoutMs: 0 }).roomId;
    draw(roomId);
    expect(turnOf(roomId)).toMatchObject({ label: "Clínica", remainingMs: 0, totalMs: 0 });
    vi.advanceTimersByTime(120_000);
    expect(events(roomId, "CANDIDATE_SUBMITTED")).toHaveLength(0);
  });

  it("POST /api/rooms acepta turnMs para la demo", async () => {
    const res = await createRoomRoute(new Request("http://nexo.test/api/rooms", { method: "POST", body: JSON.stringify({ mode: "cross_org", demo: true, turnMs: 5000 }) }));
    const { roomId } = await res.json();
    expect(getRoom(roomId)!.turnTimeoutMs).toBe(5000);
    const bad = await createRoomRoute(new Request("http://nexo.test/api/rooms", { method: "POST", body: JSON.stringify({ mode: "cross_org", demo: true, turnMs: 999_999 }) }));
    expect(bad.status).toBe(400);
  });

  it("«Nueva ronda» apaga el plan B pendiente y la nueva ronda empieza sin turno", () => {
    const roomId = demo();
    draw(roomId);
    resetRoom(roomId);
    vi.advanceTimersByTime(60_000);
    expect(events(roomId, "CANDIDATE_SUBMITTED")).toHaveLength(0);
    expect(turnOf(roomId)).toBeNull();
  });
});

describe("plan B mientras los bots todavía firman", () => {
  it("el turno del Comité no se pierde si un bot firma la compuerta al mismo tiempo", () => {
    // Plan B corto: los turnos llegan antes de que los bots terminen (0,9 s por paso).
    const roomId = createRoom({ mode: "cross_org", demo: true, turnTimeoutMs: 1500 }).roomId;
    draw(roomId);
    vi.advanceTimersByTime(10_000);
    const state = getRoom(roomId)!;
    expect(state.allocationStatus).toBe("SEALED");
    expect(state.auditLog.filter((event) => event.detail.modo === "automático")).toHaveLength(3);
  });
});
