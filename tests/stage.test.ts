// Pruebas de la pantalla grande (src/components/stage): los asientos que alimentan
// la galaxia y el paso «Unirse». Solo usan el estado proyectado para la vista
// general ("stage"), igual que la pantalla: sin red, sin reloj y sin modelo.

import { describe, expect, it } from "vitest";
import { markRoleJoined, openRoom, projectStateForOrgAndRole, sealRule, submitCandidate, type ActorRef, type EngineResult } from "../src/lib/engine/deterministic";
import type { RoomState, Telemetry } from "../src/lib/genome/schema";
import { getInitialCrossOrgRoom, getInitialSingleOrgRoom } from "../src/lib/genome/seeds";
import { isDemoRoom, shortLabel, stageSeats } from "../src/components/stage/seats";
import { demoTurn, freeHumanSeat, roomStarted, storyCards, storyMissing, storyProgress } from "../src/components/stage/story";

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
    expect(shortLabel("Riesgo si la obra se detiene")).toBe("Riesgo");
  });
});

describe("sala de demo: 3 personas", () => {
  // El almacén marca `demo` en las salas fijas entre organizaciones; el motor lo proyecta tal cual.
  const demo = openRoom({ ...getInitialCrossOrgRoom("demo-cross", { now: T0, telemetry: TELEMETRY }), demo: true }, T0);
  const PROPOSERS = [CROSS_PLAYERS[0], CROSS_PLAYERS[2]];

  it("se reconoce por la marca del servidor", () => {
    expect(isDemoRoom(stage(demo))).toBe(true);
    expect(isDemoRoom({ ...stage(demo), demo: false })).toBe(false);
    expect(isDemoRoom(stage(openRoom(getInitialCrossOrgRoom("s6", { now: T0, telemetry: TELEMETRY }), T0)))).toBe(false);
  });

  it("muestra 3 asientos de personas y los aprobadores como automáticos", () => {
    const seats = stageSeats(stage(demo));
    expect(seats.filter((seat) => seat.human).map((seat) => seat.short)).toEqual(["Clínica", "Hospital Rural", "Comité"]);
    expect(seats.filter((seat) => !seat.human).every((seat) => seat.bot && seat.kind === "approver")).toBe(true);
  });

  it("tiene 4 pasos, sin «Límites»", () => {
    expect(storyProgress(stage(demo)).steps.map((step) => step.label)).toEqual(["Unirse", "Casos", "Comité", "Acta"]);
  });

  it("sale de «Unirse» cuando entran los dos que presentan, sin esperar a los automáticos", () => {
    const one = stage(join(demo, PROPOSERS[0]));
    expect(storyProgress(one).index).toBe(0);
    expect(storyMissing(one).who).toBe("1/3 conectados");
    const both = stage(join(demo, ...PROPOSERS));
    expect(storyProgress(both).index).toBe(1);
    // No pide acordar límites ni firmas internas: eso lo hace el piloto automático.
    expect(storyMissing(both).text).toBe("cada organización presenta su caso");
  });

  it("mientras quede una silla de persona libre, la pantalla sigue mostrando el código para entrar", () => {
    expect(freeHumanSeat(stage(demo))).toBe(true);
    expect(freeHumanSeat(stage(join(demo, ...PROPOSERS)))).toBe(true);
    expect(freeHumanSeat(stage(join(demo, ...PROPOSERS, ARBITER)))).toBe(false);
    // Fuera de la demo no se muestra: allí cada rol entra con su propio código.
    expect(freeHumanSeat(stage(openRoom(getInitialCrossOrgRoom("s7", { now: T0, telemetry: TELEMETRY }), T0)))).toBe(false);
  });

  it("con la propuesta lista y sin Comité, pide escanear el QR", () => {
    let state = join(demo, ...PROPOSERS);
    for (const [actor, caseId] of [[PROPOSERS[0], "A1"], [PROPOSERS[1], "B1"]] as const) state = ok(submitCandidate(state, actor, caseId, T0 + 700));
    const waiting = storyMissing(stage(state));
    expect(waiting).toMatchObject({ lead: "Falta", who: "Comité", text: "escanea el QR", scan: true });
    expect(storyMissing(stage(join(state, ARBITER))).scan).toBeFalsy();
  });

  it("la pantalla le habla a una persona por su rol, en orden, sin números de jurado", () => {
    const says = (state: RoomState) => {
      const turn = demoTurn(stage(state));
      return turn ? `${turn.who}: ${turn.text}` : null;
    };
    expect(says(demo)).toBe("Clínica: escanea el QR");
    expect(says(join(demo, PROPOSERS[0]))).toBe("Hospital Rural: escanea el QR");
    let state = join(demo, ...PROPOSERS);
    expect(says(state)).toBe("Clínica: presenta a tu paciente");
    state = ok(submitCandidate(state, PROPOSERS[0], "A1", T0 + 700));
    expect(says(state)).toBe("Hospital Rural: presenta a tu paciente");
    state = ok(submitCandidate(state, PROPOSERS[1], "B1", T0 + 800));
    expect(says(state)).toBe("Comité: escanea el QR");
    expect(says(join(state, ARBITER))).toBe("Comité: ¿aceptas o rechazas?");
    // Sin plan B del servidor no hay cuenta regresiva inventada.
    expect(demoTurn(stage(join(state, ARBITER)))?.totalMs).toBe(0);
  });
});
