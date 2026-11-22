// Negociación entre agentes de una sala de demo (ronda 20). Funciones puras: no
// llaman a ningún modelo ni usan relojes propios.
//
// Regla de arquitectura: la IA escribe, el código decide. Aquí vive todo lo que
// es código: quién se sienta dónde, qué posturas puede elegir cada rol, el texto
// de respaldo de cada rol y fase, el filtro que impide publicar un dato reservado,
// y la propuesta, que sale del motor de asignación. El almacén
// (src/lib/store/rooms.ts) pone los tiempos y pide los textos al agente
// (src/agents/negotiation-agent.ts).

import type { NegotiationMessage, NegotiationState, ProjectedNegotiation, RoomState, Viewer } from "../genome/schema";
import { canViewCoverageCost, canViewField, computeTriageScore, demoSeats, findGenome, resolveRoomAllocation, type ActorRef, type DemoSeat, type EngineResult } from "./deterministic";

/** Pausa por defecto entre mensajes del debate. */
export const NEGOTIATION_DEFAULT_STEP_MS = 7000;
/** Largo máximo de un mensaje publicado. */
export const NEGOTIATION_MAX_CHARS = 280;
/** Largo máximo de un argumento del debate: dos líneas en la pantalla grande. */
export const NEGOTIATION_ARGUMENT_MAX_CHARS = 110;

/** Corta en una palabra completa y cierra con «…» si el texto se pasa del largo. */
export function fitText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s,;:.]+$/, "")}…`;
}

const same = (a: ActorRef, b: ActorRef) => a.orgId === b.orgId && a.roleId === b.roleId;

/** Recurso en disputa, con artículo, según el escenario. */
export function resourceWord(state: Pick<RoomState, "scenarioId">): string {
  if (state.scenarioId === "hospitales") return "la cama";
  if (state.scenarioId === "construccion") return "la grúa";
  if (state.scenarioId === "logistica") return "el camión";
  return "el recurso";
}

/** Los asientos de organización (los que fijan postura y cuyos agentes debaten). El Comité no. */
export function negotiatingSeats(state: RoomState): DemoSeat[] {
  return demoSeats(state).filter((entry) => entry.action !== "decide");
}

/** «Clínica · Urgencias» → «Agente de Urgencias · Clínica». */
export function agentLabelOf(entry: DemoSeat): string {
  if (entry.action === "decide") return "Agente del Comité";
  const [org, role] = entry.label.split(" · ");
  return role ? `Agente de ${role} · ${org}` : `Agente de ${entry.label}`;
}

/**
 * Una postura. label es la versión pública (se publica en la sala y la lee el
 * modelo): nunca lleva cifras. answer y value son solo para el celular de su rol:
 * la respuesta en palabras simples y, si corresponde, la cifra que significa.
 */
export type PositionOption = { id: string; label: string; answer?: string; value?: string };

/**
 * Lo que la persona decide en concreto, la postura que le recomienda su agente y
 * por qué. La recomendación la calcula el código, solo con datos que ese rol ya
 * ve (los puntajes públicos de los casos, o su propio costo y presupuesto): el
 * modelo, si responde, solo la redacta.
 */
export type PositionPrompt = { question: string; recommendedId: string; recommended: string; because: string };

/** «la cama» → «Pedirla»; «el camión» → «Pedirlo». */
function askVerb(resource: string): string {
  return resource.startsWith("el ") ? "Pedirlo" : "Pedirla";
}

const clp = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;

/** Costo propio, presupuesto propio y porcentaje sin firma de un asiento de administración, si su rol los ve. */
function adminFigures(state: RoomState, seat: ActorRef): { cost: number | null; budget: number | null; pct: number | null } {
  const genome = findGenome(state, seat.orgId);
  const candidate = state.scarcity?.candidates.find((item) => item.orgId === seat.orgId);
  const cost = candidate && canViewCoverageCost(state, candidate, seat) ? candidate.coverageCost : null;
  // El presupuesto es el campo en pesos con nombre de tope o presupuesto que este rol puede ver.
  const budgetField = genome?.fields.find((field) => /cap|budget/.test(field.key) && field.unit === "CLP" && typeof field.value === "number" && canViewField(state, field, seat));
  const budget = budgetField ? (budgetField.value as number) : null;
  const pct = genome && genome.authorityRule.unit === "%" ? genome.authorityRule.approverLimit : null;
  return { cost, budget, pct };
}

/**
 * Posturas que puede elegir cada rol, con un toque. La postura orienta lo que
 * defiende su agente; no cambia el puntaje, que lo calcula la regla.
 */
export function positionOptions(state: RoomState, seat: ActorRef): PositionOption[] {
  const entry = demoSeats(state).find((item) => same(item.seat, seat));
  if (!entry || entry.action === "decide") return [];
  const resource = resourceWord(state);
  if (entry.action === "submit") {
    const verb = askVerb(resource);
    return [
      { id: "now", label: `Pedir ${resource} ahora`, answer: "Ahora, sin ceder", value: "Tu agente insiste hasta el final" },
      { id: "flex", label: "Pedir, pero aceptar otra salida", answer: `${verb}, pero aceptar otra salida`, value: "Tu agente pide sin trabar la decisión" },
      { id: "yield", label: "Ceder si el otro caso pesa más", answer: "Ceder si el otro está peor", value: "Tu agente cede si el otro caso suma más" },
    ];
  }
  const { cost, pct } = adminFigures(state, seat);
  return [
    { id: "back", label: "Autorizar todo el costo", answer: "Todo el costo", ...(cost !== null ? { value: `${clp(cost)} sin pedir firma` } : {}) },
    {
      id: "cap",
      label: "Autorizar solo una parte sin firma",
      answer: pct !== null ? `Hasta el ${pct} %` : "Solo una parte",
      ...(cost !== null && pct !== null ? { value: `${clp((cost * pct) / 100)}; sobre eso, firma el Comité` } : { value: "Sobre eso, firma el Comité" }),
    },
    { id: "hold", label: "Nada sin la firma del Comité", answer: "Nada sin firma", value: "$0 hasta que firme el Comité" },
  ];
}

/**
 * La pregunta concreta de cada rol y la postura que le recomienda su agente.
 * Quien presenta el caso: compara los puntajes públicos de la regla (y, si casi
 * empatan, el desempate de equidad cuando usa datos públicos). Administración:
 * compara su costo con su presupuesto, dos datos que solo ve ella. null para el Comité.
 */
export function positionPrompt(state: RoomState, seat: ActorRef): PositionPrompt | null {
  const entry = demoSeats(state).find((item) => same(item.seat, seat));
  if (!entry || entry.action === "decide") return null;
  const resource = resourceWord(state);
  const options = positionOptions(state, seat);
  const pick = (id: string, because: string): PositionPrompt => {
    const option = options.find((item) => item.id === id) ?? options[0];
    return { question: "", recommendedId: option.id, recommended: option.answer ?? option.label, because };
  };

  if (entry.action === "submit") {
    const question = `¿Cómo pides ${resource}?`;
    const scarcity = state.scarcity;
    const mine = scarcity?.candidates.find((item) => item.orgId === seat.orgId);
    const others = scarcity?.candidates.filter((item) => item.orgId !== seat.orgId) ?? [];
    if (!scarcity || !mine || others.length === 0) return { ...pick("now", `${resource} no puede esperar`), question };
    const weights = scarcity.rule.weights;
    const myScore = computeTriageScore(mine, weights);
    const rival = others.reduce((best, item) => (computeTriageScore(item, weights) > computeTriageScore(best, weights) ? item : best));
    const gap = myScore - computeTriageScore(rival, weights);
    if (Math.abs(gap) < scarcity.rule.tieEpsilon) {
      // El desempate por costo usa un dato reservado: ahí no se dice hacia dónde cae.
      if (scarcity.rule.equityTieBreak === "coverage_gap") return { ...pick("flex", "los dos casos están casi empatados"), question };
      return mine.unmetNeedScore > rival.unmetNeedScore
        ? { ...pick("now", "casi empatan y el desempate favorece a tu paciente, que tiene menos cobertura"), question }
        : { ...pick("flex", "casi empatan y el desempate favorece al otro paciente, que tiene menos cobertura"), question };
    }
    return gap > 0
      ? { ...pick("now", "tu caso suma más en la regla de gravedad y urgencia"), question }
      : { ...pick("yield", "el otro caso suma más en la regla, y así no trabas la decisión"), question };
  }

  const question = "¿Cuánto autorizas sin pedir firma?";
  const { cost, budget } = adminFigures(state, seat);
  if (cost !== null && budget !== null) {
    return cost <= budget
      ? { ...pick("back", `el costo cabe en tu presupuesto de ${clp(budget)} y así ${resource} no espera una firma`), question }
      : { ...pick("cap", `el costo pasa tu presupuesto de ${clp(budget)}: lo que sobra lo firma el Comité`), question };
  }
  return { ...pick("cap", "así el gasto grande lo revisa el Comité"), question };
}

export function initialNegotiation(state: RoomState, stepMs: number): NegotiationState {
  // Los asientos se calculan como si la negociación ya existiera (son 5).
  const seats = negotiatingSeats({ ...state, negotiation: emptyNegotiation(stepMs) });
  return { ...emptyNegotiation(stepMs), positions: seats.map((entry) => ({ ...entry.seat, optionId: null, automatic: false })) };
}

function emptyNegotiation(stepMs: number): NegotiationState {
  return { phase: "positions", paused: false, nextAt: null, stepMs, typing: null, positions: [], messages: [], debateIndex: 0 };
}

const bump = (state: RoomState, negotiation: NegotiationState): RoomState => ({ ...state, negotiation, version: state.version + 1 });

/** Agrega un mensaje a la negociación. El id es correlativo dentro de la sala. */
export function addNegotiationMessage(state: RoomState, message: Omit<NegotiationMessage, "id" | "ts">, nowTs: number): RoomState {
  const negotiation = state.negotiation;
  if (!negotiation) return state;
  const full: NegotiationMessage = { ...message, text: message.text.slice(0, NEGOTIATION_MAX_CHARS), id: `m${negotiation.messages.length + 1}`, ts: nowTs };
  return bump(state, { ...negotiation, messages: [...negotiation.messages, full] });
}

export function patchNegotiation(state: RoomState, patch: Partial<NegotiationState>): RoomState {
  return state.negotiation ? bump(state, { ...state.negotiation, ...patch }) : state;
}

/**
 * Una persona (o un bot, automatic) fija la postura de su asiento. Solo en la fase
 * de posturas, solo un asiento de organización y solo una de sus opciones. La
 * postura se publica como mensaje, armado por el código.
 */
export function setPosition(state: RoomState, actor: ActorRef, optionId: string, nowTs: number, automatic = false): EngineResult {
  const negotiation = state.negotiation;
  if (!negotiation) return { ok: false, status: 409, code: "WRONG_MODE", message: "Esta sala no tiene negociación entre agentes" };
  const entry = negotiatingSeats(state).find((item) => same(item.seat, actor));
  if (!entry) return { ok: false, status: 403, code: "RBAC_DENIED", message: "Este rol no fija postura: el Comité decide al final" };
  if (negotiation.phase !== "positions") return { ok: false, status: 409, code: "DECISION_SEALED", message: "Las posturas ya se cerraron: los agentes están negociando" };
  const option = positionOptions(state, actor).find((item) => item.id === optionId);
  if (!option) return { ok: false, status: 400, code: "INVALID_VALUE", message: "Esa postura no existe para este rol" };
  const positions = negotiation.positions.map((item) => (same(item, actor) ? { ...item, optionId, automatic } : item));
  const next = bump(state, { ...negotiation, positions });
  return {
    ok: true,
    state: addNegotiationMessage(next, { ...actor, agentLabel: entry.label, text: `${option.label}.${automatic ? " (automático)" : ""}`, kind: "position" }, nowTs),
  };
}

export function allPositionsSet(state: RoomState): boolean {
  return !!state.negotiation && state.negotiation.positions.every((item) => item.optionId !== null);
}

function positionLabel(state: RoomState, seat: ActorRef): string | null {
  const optionId = state.negotiation?.positions.find((item) => same(item, seat))?.optionId;
  return positionOptions(state, seat).find((item) => item.id === optionId)?.label ?? null;
}

// --- Datos reservados: nada de esto puede aparecer en un mensaje ------------------

/**
 * Valores reservados de la sala: campos no públicos y el costo de cada candidato.
 * Con `visibleTo`, se excluyen los que ese rol sí puede ver (para su consejo
 * privado). Sin él, todos: es la lista para los mensajes públicos.
 */
export function reservedValues(state: RoomState, visibleTo?: ActorRef): string[] {
  const viewer: Viewer | undefined = visibleTo;
  const values: string[] = [];
  for (const genome of state.orgGenomes) {
    for (const field of genome.fields) {
      if (field.classification === "public") continue;
      if (viewer && canViewField(state, field, viewer)) continue;
      values.push(String(field.value));
    }
  }
  for (const candidate of state.scarcity?.candidates ?? []) {
    if (viewer && canViewCoverageCost(state, candidate, viewer)) continue;
    values.push(String(candidate.coverageCost));
  }
  return values;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * true si el texto contiene alguno de los valores, escrito de cualquier forma
 * razonable: con o sin separador de miles («2400000», «2.400.000», «2 400 000»),
 * en millones o en miles («2,4 millones», «2.400 mil») o como fracción («23/50»,
 * «23 de 50»). Los valores de menos de tres dígitos no se vigilan: un «1» tacharía
 * texto legítimo.
 */
export function containsReserved(text: string, values: string[]): boolean {
  const lower = text.toLowerCase();
  const compact = lower.replace(/[\s.,'’·]/g, "");
  for (const raw of values) {
    const value = raw.trim().toLowerCase();
    if (/^\d+([.,]\d+)?$/.test(value)) {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 3) continue;
      if (new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(compact)) return true;
      const amount = Number(value.replace(",", "."));
      for (const [unit, words] of [[1e6, "(millones|millón|millon|mill\\b|mm\\b|m\\b)"], [1e3, "(mil\\b|k\\b)"]] as const) {
        if (!Number.isFinite(amount) || amount < unit) continue;
        const scaled = String(Math.round((amount / unit) * 100) / 100);
        for (const form of new Set([scaled, scaled.replace(".", ",")])) {
          if (new RegExp(`(?<![\\d.,])${escape(form)}\\s*${words}`).test(lower)) return true;
        }
      }
      continue;
    }
    const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(value);
    if (fraction) {
      if (new RegExp(`(?<!\\d)${fraction[1]}\\s*(/|de|sobre)\\s*${fraction[2]}(?!\\d)`).test(lower)) return true;
      continue;
    }
    if (value.replace(/\D/g, "").length >= 3 && compact.includes(value.replace(/[\s.,'’·]/g, ""))) return true;
  }
  return false;
}

// --- Textos de respaldo: deterministas, por rol y fase ------------------------------

const score = (value: number) => value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Texto de respaldo de un agente: se usa si el modelo falla, tarda más de la
 * cuenta o escribe un dato reservado. Solo usa datos públicos del caso (las
 * etiquetas y los puntajes clínicos que ya ven todos) y la postura elegida.
 */
export function fallbackLine(state: RoomState, seat: ActorRef, kind: "advice" | "argument"): string {
  const entry = demoSeats(state).find((item) => same(item.seat, seat));
  const resource = resourceWord(state);
  if (!entry || entry.action === "decide") return "Escucho a los dos lados por ti y al final te resumo para que decidas.";
  const org = entry.label.split(" · ")[0];
  const candidate = state.scarcity?.candidates.find((item) => item.orgId === seat.orgId);
  const caseLabel = candidate?.patientLabel ?? "nuestro caso";
  const optionId = state.negotiation?.positions.find((item) => same(item, seat))?.optionId ?? null;

  if (kind === "advice") {
    const prompt = positionPrompt(state, seat);
    return prompt ? `Te recomiendo «${prompt.recommended}», porque ${prompt.because}.` : `Te recomiendo pedir ${resource}.`;
  }

  if (entry.action === "submit") {
    if (optionId === "flex") return `${org}: pedimos ${resource} para ${caseLabel}, y aceptamos otra salida si la regla lo decide.`;
    if (optionId === "yield") return `${org}: si el otro caso pesa más, cedemos. Pedimos que se mire la necesidad sin cubrir.`;
    return `${org}: pedimos ${resource} ahora. ${caseLabel} no puede esperar.`;
  }
  if (optionId === "cap") return `Administración de ${org}: autorizamos una parte sin firma; el resto lo firma el Comité.`;
  if (optionId === "hold") return `Administración de ${org}: no autorizamos gasto sin la firma del Comité.`;
  return `Administración de ${org}: autorizamos todo el costo. La cifra sigue reservada.`;
}

/** La propuesta, en una frase. La arma el código con el resultado del motor: no pasa por el modelo. */
export function proposalLine(state: RoomState): string {
  const resolution = resolveRoomAllocation(state);
  const orgName = (orgId: string) => findGenome(state, orgId)?.orgName ?? orgId;
  const [first, second] = resolution?.ranking ?? [];
  if (!resolution || !first) return "La regla todavía no tiene casos que ordenar.";
  return [
    `Propuesta de la regla: ${resourceWord(state)} para ${first.patientLabel} (${orgName(first.orgId)}), con puntaje ${score(first.score)}.`,
    second ? `Le sigue ${second.patientLabel} (${orgName(second.orgId)}) con ${score(second.score)}.` : "",
    resolution.tieBreakApplied ? "Quedaron casi empatados: decide la mayor necesidad sin cubrir." : "",
    "El Comité acepta o rechaza.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Lo que el agente necesita saber de su asiento para escribir. */
export function seatBrief(
  state: RoomState,
  seat: ActorRef,
): { seatLabel: string; agentLabel: string; position: string | null; options: string[]; resource: string; role: "presenta" | "administra" | "decide"; recommended: { option: string; because: string } | null } | null {
  const entry = demoSeats(state).find((item) => same(item.seat, seat));
  if (!entry) return null;
  return {
    seatLabel: entry.label,
    agentLabel: agentLabelOf(entry),
    position: positionLabel(state, seat),
    options: positionOptions(state, seat).map((item) => item.label),
    resource: resourceWord(state),
    role: entry.action === "submit" ? "presenta" : entry.action === "position" ? "administra" : "decide",
    recommended: (() => {
      const prompt = positionPrompt(state, seat);
      return prompt ? { option: prompt.recommended, because: prompt.because } : null;
    })(),
  };
}

// --- Proyección: qué parte de la negociación recibe cada quien ----------------------

/**
 * La negociación tal como viaja a un cliente. Los consejos (advice) solo llegan
 * al celular de su rol; lo demás es público. Las opciones y la postura propia solo
 * van a su rol.
 */
export function projectNegotiation(state: RoomState, viewer: Viewer): ProjectedNegotiation | null {
  const negotiation = state.negotiation;
  if (!negotiation) return null;
  const me = viewer === "stage" ? null : viewer;
  const seats = demoSeats(state);
  const mine = me ? seats.find((entry) => same(entry.seat, me)) : undefined;
  const projected: ProjectedNegotiation = {
    phase: negotiation.phase,
    paused: negotiation.paused,
    nextAt: negotiation.nextAt,
    stepMs: negotiation.stepMs,
    typing: negotiation.typing,
    positions: negotiation.positions.map((item) => ({
      orgId: item.orgId,
      roleId: item.roleId,
      seatLabel: seats.find((entry) => same(entry.seat, item))?.label ?? item.roleId,
      position: positionLabel(state, item),
      automatic: item.automatic,
    })),
    messages: negotiation.messages.filter((message) => message.kind !== "advice" || (me !== null && same(message, me))),
  };
  if (me && mine && mine.action !== "decide") {
    projected.myPosition = positionLabel(state, me);
    if (negotiation.phase === "positions") {
      projected.myOptions = positionOptions(state, me);
      const prompt = positionPrompt(state, me);
      if (prompt) projected.myPrompt = { question: prompt.question, recommendedId: prompt.recommendedId };
    }
  }
  return projected;
}

/** Mensajes públicos, para el acta. */
export function publicTranscript(state: RoomState): NegotiationMessage[] {
  return (state.negotiation?.messages ?? []).filter((message) => message.kind !== "advice");
}
