// Pruebas del celular en la sala de demo (ronda 9, ajustes):
//   1. Tras «Nueva ronda» o el reinicio automático, un teléfono viejo no recupera
//      su silla: vuelve a la tarjeta de sorteo para que entre el siguiente grupo
//      (shouldRecoverSeat en src/lib/client/use-room.ts). Fuera de la demo, sí la
//      recupera, como antes (por ejemplo, tras reiniciarse el servidor).
//   2. La pestaña «Sala» de una sala de demo muestra los 4 pasos de la demo
//      (demoStep en src/components/seat/screen.ts), sin el límite ni la firma.
//
// Se usan vistas reales: las que el servidor proyecta para cada quien.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn() }));
vi.mock("../src/agents", () => agents);

import { DEMO_STEPS, demoStep } from "../src/components/seat/screen";
import { shouldRecoverSeat } from "../src/lib/client/use-room";
import { DEMO_BOT_STEP_MS, DEMO_RESET_IDLE_MS, applyAction, createRoom, getHostCredentials, joinRandomSeat, projectRoom, resetRoom, resolveViewer } from "../src/lib/store/rooms";

const ARBITER = { orgId: "comite_red", roleId: "role_c" };
const id = (seat: { orgId: string; roleId: string }) => `${seat.orgId}/${seat.roleId}`;
type Seat = { orgId: string; roleId: string; token: string };

const demo = () => createRoom({ mode: "cross_org", demo: true }).roomId;
/** Lo que recibe por el SSE quien presenta estas credenciales: su rol si el token vale; si no, la vista general. */
const viewOf = (roomId: string, seat: Seat) => projectRoom(roomId, resolveViewer(roomId, seat))!;
const stage = (roomId: string) => projectRoom(roomId, "stage")!;

function draw(roomId: string): Seat {
  const res = joinRandomSeat(roomId, { committeeKey: getHostCredentials(roomId)!.committeeKey });
  if (res.status !== 200 || !res.body.seat || !res.body.token) throw new Error(`El sorteo falló: ${JSON.stringify(res)}`);
  return { ...res.body.seat, token: res.body.token };
}

async function playRound(roomId: string): Promise<Seat[]> {
  const seats = [draw(roomId), draw(roomId), draw(roomId)];
  vi.advanceTimersByTime(DEMO_BOT_STEP_MS * 6);
  for (const seat of seats.filter((entry) => id(entry) !== id(ARBITER))) await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...seat });
  await applyAction(roomId, { type: "ALLOCATION_SEAL", ...seats.find((entry) => id(entry) === id(ARBITER))!, reason: "Equidad." });
  return seats;
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-22T12:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tras una ronda nueva, los teléfonos viejos no recuperan su silla en la demo", () => {
  it("tras «Nueva ronda», el teléfono viejo recibe la vista general de una sala de demo y no debe recuperar la silla", async () => {
    const roomId = demo();
    const [first] = await playRound(roomId);
    expect(viewOf(roomId, first).viewer).toEqual({ orgId: first.orgId, roleId: first.roleId });
    resetRoom(roomId);
    const after = viewOf(roomId, first);
    expect(after.viewer).toBe("stage");
    expect(shouldRecoverSeat(after)).toBe(false);
  });

  it("lo mismo tras el reinicio automático, y la silla queda libre para el siguiente grupo", async () => {
    const roomId = demo();
    const seats = await playRound(roomId);
    vi.advanceTimersByTime(DEMO_RESET_IDLE_MS + 1000);
    for (const seat of seats) {
      const view = viewOf(roomId, seat);
      expect(view.viewer, id(seat)).toBe("stage");
      expect(shouldRecoverSeat(view)).toBe(false);
    }
    // Las tres sillas se pueden volver a sortear: nadie quedó sentado.
    expect([draw(roomId), draw(roomId), draw(roomId)].map(id).sort()).toEqual(seats.map(id).sort());
  });

  it("fuera de la demo, el teléfono sí recupera su silla (por ejemplo, tras reiniciarse el servidor)", async () => {
    const roomId = createRoom({ mode: "cross_org" }).roomId;
    const res = await applyAction(roomId, { type: "JOIN_ROLE", orgId: "clinica_andes", roleId: "role_a" });
    if (res.status !== 200 || !res.body.token) throw new Error(`JOIN_ROLE falló: ${JSON.stringify(res)}`);
    const seat = { orgId: "clinica_andes", roleId: "role_a", token: res.body.token };
    resetRoom(roomId);
    const view = viewOf(roomId, seat);
    expect(view.viewer).toBe("stage");
    expect(shouldRecoverSeat(view)).toBe(true);
    expect(shouldRecoverSeat(stage(createRoom({ mode: "single_org" }).roomId))).toBe(true);
  });
});

describe("pestaña «Sala» en la demo: los 4 pasos de la demo", () => {
  it("son Unirse, Casos, Comité y Acta, sin «Acordar límites» ni «Firmar»", () => {
    expect(DEMO_STEPS).toEqual(["Unirse", "Casos", "Comité", "Acta"]);
    const step = demoStep(stage(demo()));
    expect(step.labels).toEqual(DEMO_STEPS);
    expect(step.labels.join(" ")).not.toMatch(/límite|Firmar/i);
  });

  it("avanza con la ronda: Unirse mientras falta gente, Casos, Comité y Acta", async () => {
    const roomId = demo();
    expect(demoStep(stage(roomId))).toMatchObject({ index: 0, total: 4, done: false });
    const seats = [draw(roomId), draw(roomId)];
    // Los bots ya están, pero faltan personas: sigue en Unirse.
    expect(demoStep(stage(roomId)).index).toBe(0);
    seats.push(draw(roomId));
    expect(demoStep(stage(roomId)).index).toBe(1);
    const presenters = seats.filter((seat) => id(seat) !== id(ARBITER));
    await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...presenters[0] });
    expect(demoStep(stage(roomId)).index).toBe(1);
    await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...presenters[1] });
    expect(demoStep(stage(roomId)).index).toBe(2);
    await applyAction(roomId, { type: "ALLOCATION_SEAL", ...seats.find((seat) => id(seat) === id(ARBITER))!, reason: "Equidad." });
    expect(demoStep(viewOf(roomId, presenters[0]))).toMatchObject({ index: 3, done: true });
  });

  it("si alguien presenta antes de que entren todos, ya está en Casos", async () => {
    const roomId = demo();
    const seat = draw(roomId);
    const presenter = id(seat) === id(ARBITER) ? draw(roomId) : seat;
    await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...presenter });
    expect(demoStep(stage(roomId)).index).toBe(1);
  });
});
