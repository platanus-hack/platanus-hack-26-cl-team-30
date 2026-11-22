// Pruebas de la negociación entre agentes (ronda 20). El modelo se reemplaza por
// un doble (writeNegotiationLine); los tiempos, por relojes simulados. Lo que se
// comprueba:
//   1. Código de sala de 5 caracteres legibles (sin 0/O ni 1/I) que no se repite.
//   2. Escala de gravedad de 1 a 50 en las semillas.
//   3. 5 asientos por orden de llegada; los vacíos los juega un bot marcado.
//   4. El consejo es privado: solo llega al celular de su rol.
//   5. Ningún mensaje publicado contiene un dato reservado: si el modelo escribe
//      uno (de cualquier forma), se publica el respaldo.
//   6. Si el modelo falla o tarda más de 6 s, se publica el respaldo.
//   7. El recorrido completo: posturas → debate → propuesta (del motor) → decisión → acta.
//   8. Pausar, reanudar y adelantar, solo con el token de anfitrión.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn(), writeNegotiationLine: vi.fn() }));
vi.mock("../src/agents", () => agents);
vi.mock("server-only", () => ({}));

import { containsReserved, reservedValues } from "../src/lib/engine/negotiation";
import { getSeedGenome } from "../src/lib/genome/seeds";
import { NEGOTIATION_MODEL_TIMEOUT_MS, NEGOTIATION_POSITIONS_MS, NEGOTIATION_START_POSITIONS_MS, ROOM_CODE_ALPHABET, startDemo, applyAction, createRoom, getActa, getHostCredentials, getRoom, joinRandomSeat, projectRoom, resetRoom } from "../src/lib/store/rooms";
import { POST as createRoomRoute } from "../src/app/api/rooms/route";
import { POST as negotiationRoute } from "../src/app/api/rooms/[roomId]/negotiation/route";
import { GET as eventsRoute } from "../src/app/api/rooms/[roomId]/events/route";

const STEP = 1000;
const SECRETS = ["2400000", "2.400.000", "1600000", "1.600.000", "3100000", "23/50", "28/50"];
type Seat = { orgId: string; roleId: string; token: string };
const id = (seat: { orgId: string; roleId: string }) => `${seat.orgId}/${seat.roleId}`;

const room = (extra: Record<string, unknown> = {}) => createRoom({ mode: "cross_org", demo: true, negotiationStepMs: STEP, turnTimeoutMs: 0, ...extra }).roomId;
const stage = (roomId: string) => projectRoom(roomId, "stage")!;
const nego = (roomId: string) => stage(roomId).negotiation!;

function draw(roomId: string): Seat {
  const res = joinRandomSeat(roomId, {});
  if (res.status !== 200 || !res.body.seat || !res.body.token) throw new Error(`El sorteo falló: ${JSON.stringify(res)}`);
  return { ...res.body.seat, token: res.body.token };
}
/** Orden de los asientos por organización (como en el debate), no por llegada. */
const ORG_ORDER = ["clinica_andes/role_a", "clinica_andes/role_b", "hospital_rural/role_a", "hospital_rural/role_b", "comite_red/role_c"];
/** Las 5 personas entran (por orden de llegada) y se devuelven por organización: Urgencias, Adm. Clínica, Turno, Adm. Rural, Comité. */
function drawAll(roomId: string): Seat[] {
  const seats = [draw(roomId), draw(roomId), draw(roomId), draw(roomId), draw(roomId)];
  return ORG_ORDER.map((key) => seats.find((seat) => id(seat) === key)!);
}
const act = (roomId: string, seat: Seat, type: string, payload: Record<string, unknown> = {}) => applyAction(roomId, { type, ...seat, ...payload });
const optionsOf = (roomId: string, seat: Seat) => projectRoom(roomId, seat)!.negotiation!.myOptions ?? [];

/** Las 5 personas entran y las 4 de organización eligen su primera postura. */
async function fullRoom(roomId: string): Promise<Seat[]> {
  const seats = drawAll(roomId);
  await vi.advanceTimersByTimeAsync(10);
  for (const seat of seats.slice(0, 4)) expect((await act(roomId, seat, "SET_POSITION", { optionId: optionsOf(roomId, seat)[0]!.id })).status).toBe(200);
  return seats;
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-22T12:00:00Z") });
  agents.writeNegotiationLine.mockReset();
  agents.writeNegotiationLine.mockImplementation(async (input: { kind: string; seatLabel: string }) => ({
    text: input.kind === "advice" ? `Te conviene pedir con calma (${input.seatLabel}).` : `Defendemos a nuestro caso con la regla a la vista (${input.seatLabel}).`,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("código de sala", () => {
  it("5 caracteres legibles, sin 0/O ni 1/I, y nunca se repite", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const code = createRoom({ mode: "cross_org" }).roomId;
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
      for (const bad of ["0", "O", "1", "I"]) expect(code).not.toContain(bad);
      codes.add(code);
    }
    expect(codes.size).toBe(300);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OI]/);
  });

  it("POST /api/rooms devuelve el código, viaja como roomCode y el reinicio lo conserva", async () => {
    const res = await createRoomRoute(new Request("http://x/api/rooms", { method: "POST", body: JSON.stringify({ mode: "cross_org", demo: true }) }));
    const data = await res.json();
    expect(data.roomCode).toBe(data.roomId);
    expect(stage(data.roomId).roomCode).toBe(data.roomId);
    resetRoom(data.roomId);
    expect(stage(data.roomId).roomCode).toBe(data.roomId);
    // «Nueva demo» es otra sala con otro código.
    const again = await (await createRoomRoute(new Request("http://x/api/rooms", { method: "POST", body: JSON.stringify({ mode: "cross_org", demo: true }) }))).json();
    expect(again.roomCode).not.toBe(data.roomCode);
  });
});

describe("escala de 1 a 50", () => {
  it("la gravedad de las semillas va sobre 50, no sobre 40", () => {
    for (const orgId of ["clinica_andes", "hospital_rural"] as const) {
      const value = String(getSeedGenome(orgId).fields.find((field) => field.key === "triage_criticality")!.value);
      expect(value).toMatch(/^\d+\/50$/);
      expect(Number(value.split("/")[0])).toBeLessThanOrEqual(50);
    }
  });
});

describe("asientos y consejo privado", () => {
  it("5 asientos por orden de llegada (Urgencias, Turno, Comité, Adm. Clínica, Adm. Rural); el sexto, 409", () => {
    const roomId = room();
    const order = [1, 2, 3, 4, 5].map(() => id(draw(roomId)));
    expect(order).toEqual(["clinica_andes/role_a", "hospital_rural/role_a", "comite_red/role_c", "clinica_andes/role_b", "hospital_rural/role_b"]);
    expect(joinRandomSeat(roomId, {})).toMatchObject({ status: 409, body: { code: "NO_FREE_SEAT" } });
    const labels = stage(roomId).orgs.flatMap((org) => org.roles.filter((role) => role.seatLabel).map((role) => role.seatLabel));
    expect(labels).toEqual(["Clínica · Urgencias", "Clínica · Administración", "Hospital Rural · Turno", "Hospital Rural · Administración"]);
  });

  it("el consejo de cada agente llega solo al celular de su rol, nunca a otro ni a la pantalla grande", async () => {
    const roomId = room();
    const [clinic, rural] = [draw(roomId), draw(roomId)];
    await vi.advanceTimersByTimeAsync(10);
    const mine = projectRoom(roomId, clinic)!.negotiation!.messages.filter((message) => message.kind === "advice");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ orgId: clinic.orgId, roleId: clinic.roleId });
    expect(projectRoom(roomId, rural)!.negotiation!.messages.filter((message) => message.kind === "advice").map(id)).toEqual([id(rural)]);
    expect(nego(roomId).messages.filter((message) => message.kind === "advice")).toEqual([]);
    expect(optionsOf(roomId, clinic).length).toBeGreaterThanOrEqual(2);
    expect(nego(roomId).myOptions).toBeUndefined();
  });

  it("cada rol recibe su pregunta concreta y la postura que le recomienda su agente, calculada con lo que ve", async () => {
    const roomId = room();
    const [clinic, clinicAdmin, rural, ruralAdmin, committee] = drawAll(roomId);
    await vi.advanceTimersByTimeAsync(10);
    const prompt = (seat: Seat) => projectRoom(roomId, seat)!.negotiation!.myPrompt;
    // Casi empate (0,52 contra 0,53): desempata la necesidad sin cubrir, que es pública.
    expect(prompt(clinic)).toEqual({ question: "¿Cómo pides la cama?", recommendedId: "flex" });
    expect(prompt(rural)).toEqual({ question: "¿Cómo pides la cama?", recommendedId: "now" });
    // Administración: su costo cabe en su presupuesto (dos datos que solo ve ella).
    expect(prompt(clinicAdmin)).toEqual({ question: "¿Cuánto autorizas sin pedir firma?", recommendedId: "back" });
    expect(prompt(ruralAdmin)?.recommendedId).toBe("back");
    expect(prompt(committee)).toBeUndefined();
    expect(nego(roomId).myPrompt).toBeUndefined();
    // Cada administración ve sus propias cifras en sus respuestas; la otra organización no.
    const clinicValues = optionsOf(roomId, clinicAdmin).map((option) => option.value ?? "").join(" ");
    expect(clinicValues).toContain("$2.400.000");
    expect(containsReserved(clinicValues, ["1600000", "1900000"])).toBe(false);
    const ruralValues = optionsOf(roomId, ruralAdmin).map((option) => option.value ?? "").join(" ");
    expect(ruralValues).toContain("$1.600.000");
    expect(containsReserved(ruralValues, ["2400000", "3100000"])).toBe(false);
    // Las etiquetas públicas (las que se publican y lee la pantalla grande) nunca llevan cifras.
    for (const seat of [clinic, clinicAdmin, rural, ruralAdmin]) {
      for (const option of optionsOf(roomId, seat)) expect(containsReserved(option.label, SECRETS)).toBe(false);
    }
    // Quien presenta el caso no recibe costos por esta vía.
    expect(containsReserved(JSON.stringify(projectRoom(roomId, clinic)!.negotiation), ["2400000", "3100000"])).toBe(false);
  });

  it("el consejo de respaldo dice «Te recomiendo», sin datos que su rol no ve", async () => {
    agents.writeNegotiationLine.mockRejectedValue(new Error("sin modelo"));
    const roomId = room();
    const [clinic, clinicAdmin, rural, ruralAdmin] = drawAll(roomId);
    await vi.advanceTimersByTimeAsync(10);
    const advice = (seat: Seat) => projectRoom(roomId, seat)!.negotiation!.messages.find((message) => message.kind === "advice")!.text;
    expect(advice(clinic)).toMatch(/^Te recomiendo «Pedirla, pero aceptar otra salida», porque/);
    expect(advice(rural)).toMatch(/^Te recomiendo «Ahora, sin ceder», porque/);
    expect(advice(clinicAdmin)).toBe("Te recomiendo «Todo el costo», porque el costo cabe en tu presupuesto de $3.100.000 y así la cama no espera una firma.");
    expect(containsReserved(advice(ruralAdmin), ["2400000", "3100000"])).toBe(false);
    for (const seat of [clinic, rural]) expect(containsReserved(advice(seat), SECRETS)).toBe(false);
  });

  it("el Comité no fija postura", async () => {
    const roomId = room();
    const seats = drawAll(roomId);
    expect(await act(roomId, seats[4]!, "SET_POSITION", { optionId: "now" })).toMatchObject({ status: 403 });
    expect(await act(roomId, seats[0]!, "SET_POSITION", { optionId: "inventada" })).toMatchObject({ status: 400 });
  });
});

describe("ningún dato reservado en lo publicado", () => {
  it("el filtro reconoce los valores reservados escritos de varias formas", () => {
    const values = reservedValues(getRoom(room())!);
    for (const text of ["cuesta 2400000", "unos $2.400.000", "2,4 millones de pesos", "2.4 millones", "2400 mil", "gravedad 23/50", "23 de 50 puntos", "1.600.000 de traslado"]) {
      expect(containsReserved(text, values), text).toBe(true);
    }
    for (const text of ["pedimos la cama ahora", "puntaje 0,53 contra 0,52", "Paciente B espera hace 12 minutos"]) expect(containsReserved(text, values), text).toBe(false);
  });

  it("si el modelo escribe un costo, se publica el texto de respaldo, marcado", async () => {
    agents.writeNegotiationLine.mockImplementation(async () => ({ text: "Nuestro costo es de 2,4 millones, así que conviene." }));
    const roomId = room();
    await fullRoom(roomId);
    await vi.advanceTimersByTimeAsync(STEP * 8);
    const published = nego(roomId).messages.filter((message) => message.kind === "argument");
    expect(published).toHaveLength(4);
    expect(published.every((message) => message.fallback === true)).toBe(true);
    const everything = JSON.stringify(nego(roomId)) + getActa(roomId)!.markdown;
    for (const secret of SECRETS) expect(everything).not.toContain(secret);
    expect(everything).not.toMatch(/2,4 millones/);
  });

  it("ningún mensaje de ninguna vista contiene un valor reservado ajeno", async () => {
    const roomId = room();
    const seats = await fullRoom(roomId);
    await vi.advanceTimersByTimeAsync(STEP * 10);
    for (const viewer of ["stage" as const, ...seats.map(({ orgId, roleId }) => ({ orgId, roleId }))]) {
      const values = reservedValues(getRoom(roomId)!, viewer === "stage" ? undefined : viewer);
      for (const message of projectRoom(roomId, viewer)!.negotiation!.messages) expect(containsReserved(message.text, values), message.text).toBe(false);
    }
  });
});

describe("la gravedad reservada no viaja ni se puede deducir (fase de propuesta)", () => {
  /** Abre el SSE real de la sala para un visor y junta todo lo que llega por la red. */
  function openSse(roomId: string, seat?: Seat) {
    const abort = new AbortController();
    const query = seat ? `?orgId=${seat.orgId}&roleId=${seat.roleId}&token=${seat.token}` : "";
    const raw: string[] = [];
    const done = (async () => {
      const res = await eventsRoute(new Request(`http://x/api/rooms/${roomId}/events${query}`, { signal: abort.signal }), { params: Promise.resolve({ roomId }) });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          raw.push(decoder.decode(value));
        }
      } catch {
        // la conexión se cerró al abortar
      }
    })();
    return { raw, close: async () => { abort.abort(); await done; } };
  }

  it("ningún visor ajeno recibe triage_criticality por el SSE, y su valor no sale del puntaje público", async () => {
    const roomId = room();
    const seats = await fullRoom(roomId);
    const committee = seats[4]!;
    const clinic = seats.find((seat) => seat.orgId === "clinica_andes" && seat.roleId === "role_a")!;
    const rural = seats.find((seat) => seat.orgId === "hospital_rural" && seat.roleId === "role_a")!;
    const secretOf = (orgId: string) => String(getRoom(roomId)!.orgGenomes.find((genome) => genome.orgId === orgId)!.fields.find((field) => field.key === "triage_criticality")!.value);
    const secrets = { clinica_andes: secretOf("clinica_andes"), hospital_rural: secretOf("hospital_rural") } as Record<string, string>;

    // Visores ajenos a cada secreto: la pantalla grande, el Comité, la otra organización y la administración propia.
    const watchers = [
      { name: "pantalla grande", sse: openSse(roomId), foreign: ["clinica_andes", "hospital_rural"] },
      { name: "Comité", sse: openSse(roomId, committee), foreign: ["clinica_andes", "hospital_rural"] },
      ...seats.slice(0, 4).map((seat) => ({
        name: id(seat),
        sse: openSse(roomId, seat),
        foreign: ["clinica_andes", "hospital_rural"].filter((orgId) => !(orgId === seat.orgId && seat.roleId === "role_a")),
      })),
    ];
    // Hasta que la propuesta está a la vista (fase proposal, asignación propuesta).
    await vi.advanceTimersByTimeAsync(STEP * 6.5);
    expect(nego(roomId).phase).toBe("proposal");
    expect(stage(roomId).allocation!.status).toBe("PROPOSED");
    await vi.advanceTimersByTimeAsync(1100);
    for (const watcher of watchers) await watcher.sse.close();

    for (const watcher of watchers) {
      const wire = watcher.sse.raw.join("");
      expect(wire, watcher.name).toContain('"phase":"proposal"');
      for (const orgId of watcher.foreign) expect(wire.includes(secrets[orgId]!), `${watcher.name} recibió ${orgId}.triage_criticality`).toBe(false);
    }
    // El dueño sí lo recibe (es su dato): la prueba mira la red de verdad.
    expect(JSON.stringify(projectRoom(roomId, clinic))).toContain(secrets.clinica_andes);
    expect(JSON.stringify(projectRoom(roomId, rural))).toContain(secrets.hospital_rural);

    // Y no se deduce de lo público: ni la gravedad pública ni el puntaje de la regla, llevados a 50, dan el secreto.
    const view = stage(roomId);
    for (const candidate of view.scarcity!.candidates) {
      const numerator = Number(secrets[candidate.orgId]!.split("/")[0]);
      expect(Math.round(candidate.clinicalSeverityScore * 50), `${candidate.orgId}: gravedad pública × 50`).not.toBe(numerator);
      const ranked = view.allocation!.ranking.find((entry) => entry.orgId === candidate.orgId)!;
      expect(Math.round(ranked.score * 50), `${candidate.orgId}: puntaje de la regla × 50`).not.toBe(numerator);
    }
  });
});

describe("respaldo cuando el modelo falla o tarda", () => {
  it("si el modelo lanza un error, se publica el respaldo", async () => {
    agents.writeNegotiationLine.mockRejectedValue(new Error("sin red"));
    const roomId = room();
    await fullRoom(roomId);
    await vi.advanceTimersByTimeAsync(STEP * 8);
    const messages = nego(roomId).messages.filter((message) => message.kind === "argument");
    expect(messages).toHaveLength(4);
    expect(messages.every((message) => message.fallback && message.text.length > 10)).toBe(true);
  });

  it("si el modelo tarda más de 6 s, el debate no se traba: sale el respaldo", async () => {
    agents.writeNegotiationLine.mockImplementation(() => new Promise(() => {}));
    const roomId = room({ negotiationStepMs: NEGOTIATION_MODEL_TIMEOUT_MS + 1000 });
    await fullRoom(roomId);
    await vi.advanceTimersByTimeAsync((NEGOTIATION_MODEL_TIMEOUT_MS + 1000) * 7);
    expect(nego(roomId).phase).toBe("decision");
    expect(nego(roomId).messages.filter((message) => message.kind === "argument").every((message) => message.fallback)).toBe(true);
  });

  it("los argumentos caben en la pantalla: máximo 110 caracteres", async () => {
    agents.writeNegotiationLine.mockImplementation(async () => ({ text: "palabra ".repeat(60) }));
    const roomId = room();
    await fullRoom(roomId);
    await vi.advanceTimersByTimeAsync(STEP * 8);
    for (const message of nego(roomId).messages.filter((item) => item.kind === "argument")) expect(message.text.length).toBeLessThanOrEqual(110);
  });
});

describe("el recorrido completo", () => {
  it("posturas → debate (4 agentes) → propuesta del motor → decisión del Comité → acta", async () => {
    const roomId = room();
    const seats = await fullRoom(roomId);
    expect(nego(roomId).positions.every((position) => position.position && !position.automatic)).toBe(true);
    await vi.advanceTimersByTimeAsync(STEP * 3);
    expect(nego(roomId).phase).toBe("debate");
    expect(nego(roomId).typing).not.toBeNull();
    // La propuesta tiene su momento: el mensaje del código queda a la vista un paso, aún en «proposal».
    await vi.advanceTimersByTimeAsync(STEP * 3.5);
    expect(nego(roomId)).toMatchObject({ phase: "proposal", typing: null });
    expect(nego(roomId).nextAt).not.toBeNull();
    expect(nego(roomId).messages.some((message) => message.kind === "proposal")).toBe(true);
    expect(stage(roomId).allocation!.status).toBe("PROPOSED");
    expect(stage(roomId).turn).toBeNull();
    await vi.advanceTimersByTimeAsync(STEP * 2);
    const view = nego(roomId);
    expect(view.phase).toBe("decision");
    expect(view.messages.filter((message) => message.kind === "argument").map((message) => message.agentLabel)).toEqual([
      "Agente de Urgencias · Clínica",
      "Agente de Administración · Clínica",
      "Agente de Turno · Hospital Rural",
      "Agente de Administración · Hospital Rural",
    ]);
    // La propuesta la arma el código con el resultado del motor, no el modelo.
    const proposal = view.messages.find((message) => message.kind === "proposal")!;
    const winner = stage(roomId).allocation!.ranking[0]!;
    expect(proposal.text).toContain(winner.patientLabel);
    expect(proposal.text).toContain("0,53");
    expect(stage(roomId).allocation!.status).toBe("PROPOSED");
    expect(stage(roomId).turn).toMatchObject({ label: "Comité", action: "decide" });
    expect((await act(roomId, seats[4]!, "ALLOCATION_SEAL", { reason: "Se acepta la propuesta por equidad." })).status).toBe(200);
    expect(nego(roomId).phase).toBe("done");
    expect(nego(roomId).messages.at(-1)).toMatchObject({ kind: "system" });
    expect(getActa(roomId)!.markdown).toContain("## Negociación entre agentes");
  });

  it("con sillas libres no corre ningún plazo hasta «Iniciar»; después, a los 30 s un bot pone las posturas que falten", async () => {
    const roomId = room();
    const clinic = draw(roomId);
    await act(roomId, clinic, "SET_POSITION", { optionId: "now" });
    // Sin «Iniciar», nada avanza aunque pase el plazo de antes.
    await vi.advanceTimersByTimeAsync(NEGOTIATION_POSITIONS_MS * 2);
    expect(nego(roomId).phase).toBe("positions");
    expect(nego(roomId).nextAt).toBeNull();
    expect(startDemo(roomId).status).toBe(200);
    await vi.advanceTimersByTimeAsync(NEGOTIATION_START_POSITIONS_MS + 10);
    const view = nego(roomId);
    expect(view.phase).not.toBe("positions");
    expect(view.positions.filter((position) => position.automatic)).toHaveLength(3);
    expect(view.positions.find((position) => position.orgId === clinic.orgId && position.roleId === clinic.roleId)!.automatic).toBe(false);
    const rural = stage(roomId).orgs.find((org) => org.orgId === "hospital_rural")!.roles.find((role) => role.id === "role_a")!;
    expect(rural).toMatchObject({ bot: true, connected: true });
  });
});

describe("controles del narrador", () => {
  const control = (roomId: string, action: string, token?: string) =>
    negotiationRoute(new Request("http://x", { method: "POST", body: JSON.stringify({ action }), headers: token ? { "x-host-token": token } : {} }), { params: Promise.resolve({ roomId }) });

  it("sin token de anfitrión, 403; con él, pausa, reanuda y adelanta", async () => {
    const roomId = room();
    const token = getHostCredentials(roomId)!.hostToken;
    await fullRoom(roomId);
    expect((await control(roomId, "pause")).status).toBe(403);
    expect(await (await control(roomId, "pause", token)).json()).toMatchObject({ ok: true, paused: true });
    await vi.advanceTimersByTimeAsync(STEP * 20);
    expect(nego(roomId).phase).toBe("positions");
    expect(nego(roomId).nextAt).toBeNull();
    expect(await (await control(roomId, "resume", token)).json()).toMatchObject({ ok: true, paused: false });
    await vi.advanceTimersByTimeAsync(STEP * 3);
    expect(nego(roomId).phase).toBe("debate");
    // Adelantar publica ya el mensaje del agente que estaba escribiendo.
    const before = nego(roomId).messages.length;
    expect((await control(roomId, "advance", token)).status).toBe(200);
    expect(nego(roomId).messages.length).toBe(before + 1);
    expect((await control(roomId, "saltar", token)).status).toBe(400);
  });

  it("una sala sin negociación responde 409", async () => {
    const roomId = createRoom({ mode: "cross_org" }).roomId;
    expect((await control(roomId, "pause", getHostCredentials(roomId)!.hostToken)).status).toBe(409);
  });

  it("«Nueva ronda» deja la negociación limpia y sin temporizadores pendientes", async () => {
    const roomId = room();
    await fullRoom(roomId);
    resetRoom(roomId);
    await vi.advanceTimersByTimeAsync(STEP * 20);
    expect(nego(roomId)).toMatchObject({ phase: "positions", messages: [], nextAt: null });
  });
});
