// Pruebas de la pantalla grande (src/components/stage): los asientos que alimentan
// la galaxia y el paso «Unirse». Solo usan el estado proyectado para la vista
// general ("stage"), igual que la pantalla: sin red, sin reloj y sin modelo.

import { describe, expect, it } from "vitest";
import { markRoleJoined, openRoom, projectStateForOrgAndRole, sealAllocation, sealRule, submitCandidate, type ActorRef, type EngineResult } from "../src/lib/engine/deterministic";
import type { ProjectedRoomState, RoomState, Telemetry } from "../src/lib/genome/schema";
import { getInitialCrossOrgRoom, getInitialSingleOrgRoom } from "../src/lib/genome/seeds";
import { debateMessages, lockedFields, progressWindow, proposalMessage, readNegotiation, roomCode, seatParts, scorePoints, stageStep, type Negotiation } from "../src/components/stage/negotiation";
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

// La negociación entre agentes (ronda 20): la pantalla solo lee el contrato que
// publica el servidor (docs/DECISIONES.md). Aquí se arma ese estado a mano sobre
// una sala de demo proyectada, para probar la lectura sin motor ni modelo.
describe("negociación entre agentes en la pantalla grande", () => {
  const LABELS: Record<string, [number, string]> = {
    // Orden de llegada: los dos casos, el Comité (3) y las dos Administraciones.
    "clinica_andes/role_a": [1, "Clínica · Urgencias"],
    "hospital_rural/role_a": [2, "Hospital Rural · Turno"],
    "clinica_andes/role_b": [4, "Clínica · Administración"],
    "hospital_rural/role_b": [5, "Hospital Rural · Administración"],
  };
  const base = (state: RoomState): ProjectedRoomState => {
    const room = stage({ ...state, demo: true });
    return {
      ...room,
      roomCode: "k7qmp",
      orgs: room.orgs.map((org) => ({ ...org, roles: org.roles.map((role) => ({ ...role, seatOrder: LABELS[`${org.orgId}/${role.id}`]?.[0], seatLabel: LABELS[`${org.orgId}/${role.id}`]?.[1] })) })),
      scarcity: room.scarcity && { ...room.scarcity, arbiter: { ...room.scarcity.arbiter, seatOrder: 3, seatLabel: "Comité" } },
    };
  };
  const negotiation = (over: Partial<Negotiation> = {}): Negotiation => ({ phase: "positions", paused: false, nextAt: null, stepMs: 7000, typing: null, positions: [], messages: [], ...over });
  const withNegotiation = (room: ProjectedRoomState, over: Partial<Negotiation> = {}): ProjectedRoomState => ({ ...room, negotiation: negotiation(over) });
  const empty = openRoom(getInitialCrossOrgRoom("neg", { now: T0, telemetry: TELEMETRY }), T0);

  it("sin el campo, la sala se muestra como antes; con una fase desconocida, también", () => {
    expect(readNegotiation(base(empty))).toBeNull();
    expect(readNegotiation({ ...base(empty), negotiation: { phase: "otra" } } as unknown as ProjectedRoomState)).toBeNull();
    expect(readNegotiation(withNegotiation(base(empty)))?.phase).toBe("positions");
  });

  it("son 5 sillas de persona, en orden de llegada, con el nombre que manda el servidor", () => {
    const people = stageSeats(base(empty)).filter((seat) => seat.human).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(people.map((seat) => seat.short)).toEqual(["Clínica · Urgencias", "Hospital Rural · Turno", "Comité", "Clínica · Administración", "Hospital Rural · Administración"]);
    expect(seatParts("Clínica · Urgencias")).toEqual({ org: "Clínica", role: "Urgencias" });
    expect(seatParts("Comité")).toEqual({ org: "", role: "Comité" });
  });

  it("el código se muestra en mayúsculas; una sala fija muestra su id", () => {
    expect(roomCode(base(empty))).toBe("K7QMP");
    expect(roomCode(stage(empty))).toBe("NEG");
  });

  it("«Unirse» dura hasta la primera postura o hasta que no queden sillas libres", () => {
    const room = base(empty);
    expect(stageStep(room, negotiation())).toBe("join");
    const position = { orgId: "clinica_andes", roleId: "role_a", seatLabel: "Clínica · Urgencias", position: "Pedir la cama ahora", automatic: false };
    expect(stageStep(room, negotiation({ positions: [position] }))).toBe("positions");
    expect(stageStep(base(join(empty, ...CROSS_PLAYERS, ARBITER)), negotiation())).toBe("positions");
    expect(stageStep(room, negotiation({ phase: "debate" }))).toBe("debate");
  });

  it("el debate muestra argumentos y avisos; nunca el consejo privado ni la postura", () => {
    const message = (id: string, kind: Negotiation["messages"][number]["kind"]) => ({ id, orgId: "clinica_andes", roleId: "role_a", agentLabel: "Agente de Urgencias · Clínica", text: id, kind, ts: T0 });
    const all = negotiation({ messages: [message("a", "advice"), message("b", "position"), message("c", "argument"), message("d", "system"), message("e", "proposal")] });
    expect(debateMessages(all).map((entry) => entry.id)).toEqual(["c", "d"]);
    expect(proposalMessage(all)?.id).toBe("e");
  });

  it("el puntaje compuesto va de 1 a 50 y la barra mide el plazo real", () => {
    expect([0, 0.46, 0.5, 1].map(scorePoints)).toEqual([1, 23, 25, 50]);
    // Un mensaje del debate dura stepMs aunque la pantalla lo vea tarde.
    expect(progressWindow(10_000, 8_000, 7000)).toEqual({ start: 3_000, total: 7000 });
    // Un plazo más largo (las posturas) se mide desde que se vio.
    expect(progressWindow(40_000, 10_000, 7000)).toEqual({ start: 10_000, total: 30_000 });
  });

  it("la tarjeta de la propuesta no deja ver ningún dato reservado: solo su nombre, con candado", () => {
    let state = join(empty, ...CROSS_PLAYERS, ARBITER);
    for (const candidate of state.scarcity!.candidates) state = ok(submitCandidate(state, { orgId: candidate.orgId, roleId: candidate.proposerRoleId }, candidate.caseId, T0 + 700));
    const room = base(state);
    const shown = room.allocation!.ranking.flatMap((entry) => [String(scorePoints(entry.score)), ...lockedFields(room, entry.orgId)]).join(" ");
    // Los valores secretos de las semillas (por ejemplo «45/50» o el costo) nunca están en lo que se dibuja.
    for (const org of state.orgGenomes) for (const field of org.fields.filter((item) => item.classification === "secret")) expect(shown).not.toContain(String(field.value));
    expect(lockedFields(room, "clinica_andes").length).toBeGreaterThan(0);
    // 26 y 27: el puntaje compuesto sigue distinguiendo al primero del segundo.
    const [first, second] = room.allocation!.ranking.map((entry) => scorePoints(entry.score));
    expect(first).toBeGreaterThan(second);
  });

  it("al cerrar, la frase final nombra a la organización, no al cargo", () => {
    let state = join(empty, ...CROSS_PLAYERS, ARBITER);
    for (const org of state.orgGenomes) state = ok(sealRule(state, { orgId: org.orgId, roleId: org.authorityRule.approverRoleId }, { threshold: org.authorityRule.min, gateMode: "deterministic_hitl" }, T0 + 600));
    for (const candidate of state.scarcity!.candidates) state = ok(submitCandidate(state, { orgId: candidate.orgId, roleId: candidate.proposerRoleId }, candidate.caseId, T0 + 700));
    state = ok(sealAllocation(state, ARBITER, "Por equidad.", T0 + 900));
    expect(storyMissing(base(state)).text).toBe("Hospital Rural recibe el recurso");
  });
});
