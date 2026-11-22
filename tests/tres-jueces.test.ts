// Tres jueces escanean el QR al mismo tiempo (pitch del domingo). Lo que se comprueba:
//   1. Tres POST /api/rooms/:id/seat disparados en paralelo reciben tres asientos
//      distintos, con tokens distintos: Clínica · Urgencias, Hospital Rural · Turno y
//      Comité. Ninguno queda sin silla ni con la misma.
//   2. Con seis en paralelo, los 5 asientos se reparten sin repetir y el sexto
//      recibe 409 NO_FREE_SEAT.
//   3. Con esas 3 personas, «Iniciar» deja las dos Administraciones a un bot marcado
//      como automático y el Comité sigue siendo una persona.
//   4. La pantalla grande refleja el orden nuevo (seatOrder 1 a 5).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn(), writeNegotiationLine: vi.fn() }));
vi.mock("../src/agents", () => agents);
vi.mock("server-only", () => ({}));

import { createRoom, projectRoom, startDemo } from "../src/lib/store/rooms";
import { POST as seatRoute } from "../src/app/api/rooms/[roomId]/seat/route";

type Seat = { orgId: string; roleId: string; token: string };
const id = (seat: { orgId: string; roleId: string }) => `${seat.orgId}/${seat.roleId}`;
const URGENCIAS = "clinica_andes/role_a";
const TURNO = "hospital_rural/role_a";
const COMITE = "comite_red/role_c";
const ADMINS = ["clinica_andes/role_b", "hospital_rural/role_b"];

const room = () => createRoom({ mode: "cross_org", demo: true, negotiationStepMs: 1000, turnTimeoutMs: 0 }).roomId;
const stage = (roomId: string) => projectRoom(roomId, "stage")!;

/** Una unión por HTTP, como la hace el celular al escanear el QR (sin clave del Comité). */
async function scan(roomId: string): Promise<{ status: number; body: { seat?: { orgId: string; roleId: string }; token?: string; code?: string } }> {
  const res = await seatRoute(new Request(`http://x/api/rooms/${roomId}/seat`, { method: "POST", body: "{}" }), { params: Promise.resolve({ roomId }) });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  agents.writeNegotiationLine.mockReset();
  agents.writeNegotiationLine.mockImplementation(async (input: { seatLabel: string }) => ({ text: `Mensaje de prueba (${input.seatLabel}).` }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tres jueces escanean al mismo tiempo", () => {
  it("3 uniones en paralelo: 3 asientos distintos (Urgencias, Turno, Comité) y 3 tokens distintos", async () => {
    const roomId = room();
    const results = await Promise.all([scan(roomId), scan(roomId), scan(roomId)]);
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    const seats = results.map((result) => ({ ...result.body.seat!, token: result.body.token! })) as Seat[];
    expect(new Set(seats.map(id)).size).toBe(3);
    expect(seats.map(id).sort()).toEqual([URGENCIAS, TURNO, COMITE].sort());
    expect(new Set(seats.map((seat) => seat.token)).size).toBe(3);
    // Cada token abre la vista de su asiento, y solo esa.
    for (const seat of seats) expect(projectRoom(roomId, seat)).not.toBeNull();
  });

  it("6 uniones en paralelo: 5 asientos sin repetir y el sexto recibe 409", async () => {
    const roomId = room();
    const results = await Promise.all(Array.from({ length: 6 }, () => scan(roomId)));
    const ok = results.filter((result) => result.status === 200);
    expect(ok).toHaveLength(5);
    expect(new Set(ok.map((result) => id(result.body.seat!))).size).toBe(5);
    const rejected = results.filter((result) => result.status !== 200);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ status: 409, body: { code: "NO_FREE_SEAT" } });
  });

  it("con esas 3 personas, Iniciar deja las 2 Administraciones a un bot y el Comité sigue siendo persona", async () => {
    const roomId = room();
    await Promise.all([scan(roomId), scan(roomId), scan(roomId)]);
    const { status, body } = startDemo(roomId);
    expect(status).toBe(200);
    expect((body as { bots: Array<{ orgId: string; roleId: string }> }).bots.map(id).sort()).toEqual(ADMINS);
    const view = stage(roomId);
    const bots = view.orgs.flatMap((org) => org.roles.filter((role) => (role as { bot?: boolean }).bot).map((role) => `${org.orgId}/${role.id}`));
    expect(bots.sort()).toEqual(ADMINS);
    expect((view.scarcity!.arbiter as { bot?: boolean }).bot).toBeFalsy();
    expect(view.negotiation!.positions.filter((entry) => entry.automatic).map(id).sort()).toEqual(ADMINS);
  });

  it("la pantalla grande recibe el orden nuevo: 1 Urgencias, 2 Turno, 3 Comité, 4 y 5 las Administraciones", () => {
    const view = stage(room());
    const orders = Object.fromEntries([
      ...view.orgs.flatMap((org) => org.roles.filter((role) => role.seatOrder).map((role) => [`${org.orgId}/${role.id}`, `${role.seatOrder}:${role.seatLabel}`])),
      [COMITE, `${view.scarcity!.arbiter.seatOrder}:${view.scarcity!.arbiter.seatLabel}`],
    ]);
    expect(orders).toEqual({
      [URGENCIAS]: "1:Clínica · Urgencias",
      [TURNO]: "2:Hospital Rural · Turno",
      [COMITE]: "3:Comité",
      [ADMINS[0]!]: "4:Clínica · Administración",
      [ADMINS[1]!]: "5:Hospital Rural · Administración",
    });
  });
});
