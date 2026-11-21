// Pruebas de la pantalla grande (src/components/stage): los asientos que alimentan
// la galaxia y el paso «Unirse». Solo usan el estado proyectado para la vista
// general ("stage"), igual que la pantalla: sin red, sin reloj y sin modelo.

import { describe, expect, it } from "vitest";
import { markRoleJoined, openRoom, projectStateForOrgAndRole, sealRule, type ActorRef, type EngineResult } from "../src/lib/engine/deterministic";
import type { RoomState, Telemetry } from "../src/lib/genome/schema";
import { getInitialCrossOrgRoom, getInitialSingleOrgRoom } from "../src/lib/genome/seeds";
import { shortLabel, stageSeats } from "../src/components/stage/seats";
import { roomStarted, storyCards, storyMissing, storyProgress } from "../src/components/stage/story";

const T0 = 1_800_000_000_000;
const TELEMETRY: Telemetry = { modelName: "prueba", provider: "local", endpointHost: "localhost:11434", bytesSentToCloud: 0, queueDepth: 0, lastLatencyMs: 0, tokensPerSec: 0 };
const stage = (state: RoomState) => projectStateForOrgAndRole(state, "stage", T0 + 1000);
const ok = (result: EngineResult): RoomState => {
  if (!result.ok) throw new Error(`${result.status} ${result.code}`);
  return result.state;
};
const join = (state: RoomState, ...actors: ActorRef[]) => actors.reduce((current, actor) => ok(markRoleJoined(current, actor, T0 + 500)), state);

const CROSS_PLAYERS: ActorRef[] = [
  { orgId: "clinica_andes", roleId: "role_a" },
  { orgId: "clinica_andes", roleId: "role_b" },
  { orgId: "hospital_rural", roleId: "role_a" },
  { orgId: "hospital_rural", roleId: "role_b" },
];
const ARBITER: ActorRef = { orgId: "comite_red", roleId: "role_c" };

describe("asientos de la pantalla grande", () => {
  it("entre organizaciones: dos por organización y el Comité de la red al final", () => {
    const seats = stageSeats(stage(openRoom(getInitialCrossOrgRoom("s1", { now: T0, telemetry: TELEMETRY }), T0)));
    expect(seats.map((seat) => seat.id)).toEqual(["clinica_andes/role_a", "clinica_andes/role_b", "hospital_rural/role_a", "hospital_rural/role_b", "comite_red/role_c"]);
    expect(seats.map((seat) => seat.kind)).toEqual(["proposer", "approver", "proposer", "approver", "arbiter"]);
    expect(new Set(seats.map((seat) => seat.tone)).size).toBe(5);
    expect(seats.every((seat) => !seat.connected)).toBe(true);
  });

  it("una organización: quien propone, quien aprueba y su Comité", () => {
    const seats = stageSeats(stage(openRoom(getInitialSingleOrgRoom("s2", "clinica_andes", { now: T0, telemetry: TELEMETRY }), T0)));
    expect(seats.map((seat) => seat.kind)).toEqual(["proposer", "approver", "arbiter"]);
  });

  it("un asiento solo aparece conectado cuando esa persona entró", () => {
    const state = join(openRoom(getInitialCrossOrgRoom("s3", { now: T0, telemetry: TELEMETRY }), T0), CROSS_PLAYERS[0], ARBITER);
    const connected = stageSeats(stage(state)).filter((seat) => seat.connected).map((seat) => seat.id);
    expect(connected).toEqual(["clinica_andes/role_a", "comite_red/role_c"]);
  });
});

describe("paso «Unirse»", () => {
  const empty = openRoom(getInitialCrossOrgRoom("s4", { now: T0, telemetry: TELEMETRY }), T0);

  it("dura mientras falta alguien que trabaja el caso", () => {
    expect(storyProgress(stage(empty)).index).toBe(0);
    const three = stage(join(empty, ...CROSS_PLAYERS.slice(0, 3)));
    expect(roomStarted(three)).toBe(false);
    expect(storyProgress(three).index).toBe(0);
    expect(storyMissing(three).who).toBe("3/5 conectados");
  });

  it("termina cuando entran todos, sin esperar al Comité", () => {
    const all = stage(join(empty, ...CROSS_PLAYERS));
    expect(roomStarted(all)).toBe(true);
    expect(storyProgress(all).index).toBe(1);
  });

  it("termina si alguien ya trabajó el caso aunque falte gente", () => {
    const sealed = ok(sealRule(join(empty, CROSS_PLAYERS[1]), CROSS_PLAYERS[1], { threshold: 60 }, T0 + 800));
    expect(roomStarted(stage(sealed))).toBe(true);
  });
});

describe("textos cortos", () => {
  it("los candados dicen una o dos palabras y nunca un valor", () => {
    const cards = storyCards(stage(openRoom(getInitialCrossOrgRoom("s5", { now: T0, telemetry: TELEMETRY }), T0)));
    for (const card of cards) {
      expect(card.locked.length).toBeGreaterThan(0);
      for (const label of card.locked) expect(label.split(/\s+/).length).toBeLessThanOrEqual(2);
    }
  });

  it("shortLabel corta antes del primer conector", () => {
    expect(shortLabel("Costo de cobertura UCI")).toBe("Costo");
    expect(shortLabel("Camas UCI disponibles")).toBe("Camas UCI");
    expect(shortLabel("Gravedad clínica")).toBe("Gravedad clínica");
  });
});
