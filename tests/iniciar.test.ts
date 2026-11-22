// Pruebas de «Iniciar» (paso Unirse de la demo con negociación) y del contador de
// personas de la pantalla grande. Lo que se comprueba:
//   1. Iniciar llena con bots los asientos sin persona (con 3 personas, las dos
//      Administraciones), marcados como automáticos
//      (role.bot, postura automática y { bot: true } en la bitácora), y la
//      negociación arranca sin esperar a nadie más: posturas → debate.
//   2. Con los 5 asientos ocupados, Iniciar no agrega bots: solo arranca.
//   3. Funciona sin clave de anfitrión, pero solo en el paso Unirse: con una
//      postura puesta, en el debate o con el acta cerrada responde 409 y no cambia nada.
//   4. El contador «3/5 · 2 automáticos» no cuenta a los bots como personas.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn(), writeNegotiationLine: vi.fn() }));
vi.mock("../src/agents", () => agents);
vi.mock("server-only", () => ({}));

import { peopleCount } from "../src/components/stage/negotiation";
import { applyAction, createRoom, getRoom, isJoining, joinRandomSeat, projectRoom, startDemo } from "../src/lib/store/rooms";
import { POST as startRoute } from "../src/app/api/rooms/[roomId]/start/route";

const STEP = 1000;
type Seat = { orgId: string; roleId: string; token: string };
const id = (seat: { orgId: string; roleId: string }) => `${seat.orgId}/${seat.roleId}`;
/** Los 5 asientos en orden de llegada: Urgencias, Turno, Comité, Adm. Clínica, Adm. Rural. */
const ALL_SEATS = ["clinica_andes/role_a", "hospital_rural/role_a", "comite_red/role_c", "clinica_andes/role_b", "hospital_rural/role_b"];

const room = (extra: Record<string, unknown> = {}) => createRoom({ mode: "cross_org", demo: true, negotiationStepMs: STEP, turnTimeoutMs: 0, ...extra }).roomId;
const stage = (roomId: string) => projectRoom(roomId, "stage")!;
const nego = (roomId: string) => stage(roomId).negotiation!;
const start = (roomId: string) => startRoute(new Request(`http://x/api/rooms/${roomId}/start`, { method: "POST" }), { params: Promise.resolve({ roomId }) });

function draw(roomId: string): Seat {
  const res = joinRandomSeat(roomId, {});
  if (res.status !== 200 || !res.body.seat || !res.body.token) throw new Error(`El sorteo falló: ${JSON.stringify(res)}`);
  return { ...res.body.seat, token: res.body.token };
}

/** Asientos que la vista de la pantalla grande marca como bot. */
function botSeats(roomId: string): string[] {
  const view = stage(roomId);
  const roles = view.orgs.flatMap((org) => org.roles.filter((role) => (role as { bot?: boolean }).bot).map((role) => `${org.orgId}/${role.id}`));
  const arbiter = view.scarcity!.arbiter as { orgId: string; roleId: string; bot?: boolean };
  return arbiter.bot ? [...roles, id(arbiter)] : roles;
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-22T12:00:00Z") });
  agents.writeNegotiationLine.mockReset();
  agents.writeNegotiationLine.mockImplementation(async (input: { kind: string; seatLabel: string }) => ({ text: `Mensaje de prueba (${input.seatLabel}).` }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Iniciar", () => {
  it("con 3 personas (Urgencias, Turno, Comité), las 2 Administraciones las toma un bot marcado y la negociación arranca sin esperar", async () => {
    const roomId = room();
    const [clinic, rural, committee] = [draw(roomId), draw(roomId), draw(roomId)];
    expect([clinic, rural, committee].map(id)).toEqual(ALL_SEATS.slice(0, 3));
    const people = [clinic, rural];
    expect(isJoining(getRoom(roomId)!)).toBe(true);

    const res = await start(roomId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bots.map(id).sort()).toEqual(ALL_SEATS.slice(3).sort());

    // Marcados como automáticos: en la vista, en las posturas y en la bitácora.
    expect(botSeats(roomId).sort()).toEqual(ALL_SEATS.slice(3).sort());
    const positions = nego(roomId).positions;
    expect(positions.filter((entry) => entry.automatic).map(id)).toEqual(["clinica_andes/role_b", "hospital_rural/role_b"]);
    expect(positions.filter((entry) => !entry.automatic).every((entry) => entry.position === null)).toBe(true);
    const log = getRoom(roomId)!.auditLog;
    expect(log.some((event) => event.type === "AUTOPILOT" && event.detail?.via === "iniciar" && event.detail?.automatic === true)).toBe(true);
    expect(log.filter((event) => event.detail?.bot === true && event.detail?.via === "iniciar")).toHaveLength(2);
    // El Comité sigue siendo una persona: el bot no lo toma.
    expect(botSeats(roomId)).not.toContain(ALL_SEATS[2]);
    // Ya no es el paso Unirse: un segundo toque no hace nada.
    expect(isJoining(getRoom(roomId)!)).toBe(false);
    expect((await start(roomId)).status).toBe(409);

    // Las 2 personas eligen y la negociación pasa al debate sin esperar el plazo completo.
    for (const seat of people) {
      const option = projectRoom(roomId, seat)!.negotiation!.myOptions![0]!;
      expect((await applyAction(roomId, { type: "SET_POSITION", ...seat, optionId: option.id })).status).toBe(200);
    }
    await vi.advanceTimersByTimeAsync(STEP * 3);
    expect(nego(roomId).phase).toBe("debate");
  });

  it("sin nadie adentro, los 5 asientos quedan automáticos y la ronda llega sola hasta la decisión", async () => {
    const roomId = room();
    const { status, body } = startDemo(roomId);
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(botSeats(roomId).sort()).toEqual([...ALL_SEATS].sort());
    expect(nego(roomId).positions.every((entry) => entry.automatic && entry.position)).toBe(true);
    await vi.advanceTimersByTimeAsync(STEP * 3);
    expect(nego(roomId).phase).toBe("debate");
    await vi.advanceTimersByTimeAsync(STEP * 10);
    expect(nego(roomId).phase).toBe("decision");
  });

  it("con los 5 asientos ocupados no agrega bots: solo arranca", async () => {
    const roomId = room();
    for (let i = 0; i < 5; i++) draw(roomId);
    const res = await start(roomId);
    expect(res.status).toBe(200);
    expect((await res.json()).bots).toEqual([]);
    expect(botSeats(roomId)).toEqual([]);
    expect(nego(roomId).phase).toBe("positions");
    expect(nego(roomId).nextAt).not.toBeNull();
  });

  it("no se puede usar fuera del paso Unirse: con una postura puesta, en el debate ni con el acta cerrada", async () => {
    const roomId = room();
    const clinic = draw(roomId);
    expect((await applyAction(roomId, { type: "SET_POSITION", ...clinic, optionId: "now" })).status).toBe(200);
    await vi.advanceTimersByTimeAsync(10); // el consejo del agente llega aparte
    const before = getRoom(roomId)!;
    const res = await start(roomId);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ROUND_STARTED");
    // No cambió nada: ni bots ni bitácora.
    expect(getRoom(roomId)).toBe(before);
    expect(botSeats(roomId)).toEqual([]);

    // En el debate, tampoco.
    await vi.advanceTimersByTimeAsync(60_000 + 10);
    expect(nego(roomId).phase).toBe("debate");
    expect((await start(roomId)).status).toBe(409);

    // Con el acta cerrada, tampoco (no sirve para reiniciar una ronda).
    const sealed = { ...getRoom(roomId)!, decisionSealedAt: Date.now() };
    expect(isJoining(sealed)).toBe(false);
  });

  it("solo en salas de demo con negociación", async () => {
    const plain = createRoom({ mode: "cross_org" }).roomId;
    expect((await start(plain)).status).toBe(409);
    const scripted = createRoom({ mode: "cross_org", demo: true, negotiation: false }).roomId;
    expect((await start(scripted)).status).toBe(409);
    expect((await start("NOEXISTE")).status).toBe(404);
  });
});

describe("contador de personas", () => {
  it("sube con cada persona y no cuenta a los bots: «2/5 · 3 automáticos»", async () => {
    const roomId = room();
    expect(peopleCount(stage(roomId))).toEqual({ people: 0, bots: 0, total: 5 });
    draw(roomId);
    expect(peopleCount(stage(roomId))).toEqual({ people: 1, bots: 0, total: 5 });
    draw(roomId);
    expect(peopleCount(stage(roomId))).toEqual({ people: 2, bots: 0, total: 5 });
    startDemo(roomId);
    expect(peopleCount(stage(roomId))).toEqual({ people: 2, bots: 3, total: 5 });
  });

  it("una persona que llega tarde a un asiento automático suma como persona y resta un bot", async () => {
    const roomId = room();
    draw(roomId);
    startDemo(roomId);
    expect(peopleCount(stage(roomId))).toEqual({ people: 1, bots: 4, total: 5 });
    draw(roomId);
    expect(peopleCount(stage(roomId))).toEqual({ people: 2, bots: 3, total: 5 });
  });
});
