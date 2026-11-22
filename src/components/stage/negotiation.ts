// Lectura de la negociación entre agentes para la pantalla grande. El contrato lo
// define el servidor (docs/DECISIONES.md, «Negociación entre agentes: contrato de
// datos»): `roomCode` y `negotiation` viajan en el estado proyectado. Aquí solo se
// lee y se traduce a lo que se dibuja. No decide nada: la propuesta y los puntajes
// salen del motor (`allocation`) y los textos los publica el servidor ya revisados.

import type { ProjectedRoomState } from "@/lib/genome/schema";
import { SEAT_TONES, shortLabel, stageSeats, type Seat } from "./seats";

export type NegotiationPhase = "positions" | "debate" | "proposal" | "decision" | "done";
export type MessageKind = "advice" | "position" | "argument" | "proposal" | "system";

export type NegotiationMessage = { id: string; orgId: string; roleId: string; agentLabel: string; text: string; kind: MessageKind; ts: number; fallback?: boolean };
export type NegotiationPosition = { orgId: string; roleId: string; seatLabel: string; position: string | null; automatic: boolean };

export type Negotiation = {
  phase: NegotiationPhase;
  paused: boolean;
  /** Reloj del servidor (ms) del próximo paso; null si está en pausa o espera a una persona. */
  nextAt: number | null;
  /** Pausa entre mensajes (ms). */
  stepMs: number;
  typing: { orgId: string; roleId: string; agentLabel: string } | null;
  positions: NegotiationPosition[];
  messages: NegotiationMessage[];
};

/** Paso que muestra la pantalla: las fases del servidor, más «Unirse» mientras nadie ha dado su postura. */
export type StageStep = "join" | NegotiationPhase;

export const STAGE_STEPS: { id: StageStep; label: string }[] = [
  { id: "join", label: "Unirse" },
  { id: "positions", label: "Posturas" },
  { id: "debate", label: "Debate" },
  { id: "proposal", label: "Propuesta" },
  { id: "decision", label: "Comité" },
  { id: "done", label: "Acta" },
];

const PHASES = new Set<string>(["positions", "debate", "proposal", "decision", "done"]);

/** La negociación de la sala, si la hay; con valores por defecto para lo que falte. */
export function readNegotiation(room: ProjectedRoomState): Negotiation | null {
  // Lectura tolerante: un servidor viejo no manda el campo, y entonces la sala se muestra como antes.
  const raw = room.negotiation as Partial<Negotiation> | null | undefined;
  if (!raw || typeof raw.phase !== "string" || !PHASES.has(raw.phase)) return null;
  return {
    phase: raw.phase,
    paused: !!raw.paused,
    nextAt: typeof raw.nextAt === "number" ? raw.nextAt : null,
    stepMs: typeof raw.stepMs === "number" && raw.stepMs > 0 ? raw.stepMs : 7000,
    typing: raw.typing ?? null,
    positions: raw.positions ?? [],
    messages: raw.messages ?? [],
  };
}

/** Código de la sala (4 a 6 caracteres legibles); en las salas fijas, su id. */
export function roomCode(room: ProjectedRoomState): string {
  return (room.roomCode ?? room.roomId).toUpperCase();
}

/**
 * Paso que se dibuja. El servidor no tiene fase de ingreso: la gente entra durante
 * `positions`. La pantalla muestra «Unirse» (código gigante) hasta que alguien da
 * su postura o ya no queda ninguna silla de persona libre.
 */
export function stageStep(room: ProjectedRoomState, negotiation: Negotiation): StageStep {
  if (negotiation.phase !== "positions") return negotiation.phase;
  const anyPosition = negotiation.positions.some((entry) => entry.position);
  const freeSeat = stageSeats(room).some((seat) => seat.human && !seat.connected);
  return !anyPosition && freeSeat ? "join" : "positions";
}

/** Asiento de un mensaje o una postura, para darle su color. */
export function seatOf(room: ProjectedRoomState, orgId: string, roleId: string): Seat | undefined {
  return stageSeats(room).find((seat) => seat.id === `${orgId}/${roleId}`);
}

export function seatColor(seat: Seat | undefined, theme: "dark" | "light"): string {
  return SEAT_TONES[(seat?.tone ?? 5) % SEAT_TONES.length][theme];
}

/** «Clínica · Urgencias» → organización y rol por separado; «Comité» va solo. */
export function seatParts(label: string): { org: string; role: string } {
  const [org, ...rest] = label.split(" · ");
  return rest.length > 0 ? { org, role: rest.join(" · ") } : { org: "", role: org };
}

/** Lo que se lee en el debate: argumentos y avisos. El consejo privado nunca llega aquí; aun así se descarta. */
export function debateMessages(negotiation: Negotiation): NegotiationMessage[] {
  return negotiation.messages.filter((message) => message.kind === "argument" || message.kind === "system");
}

/** El mensaje con la propuesta, que arma el código con el resultado del motor. */
export function proposalMessage(negotiation: Negotiation): NegotiationMessage | undefined {
  return negotiation.messages.findLast((message) => message.kind === "proposal");
}

/**
 * Puntaje compuesto de la regla en la escala de la demo (1 a 50). El motor lo da de 0 a 1
 * (gravedad, urgencia y riesgo de esperar, ya ponderados). Es público: lo ven todos.
 * Nunca se muestra la gravedad sola: es un dato reservado de cada organización.
 */
export function scorePoints(score: number): number {
  return Math.min(50, Math.max(1, Math.round(score * 50)));
}

/** Nombres cortos de los datos reservados de una organización en esta vista: solo el nombre, nunca el valor. */
export function lockedFields(room: ProjectedRoomState, orgId: string): string[] {
  const org = room.orgs.find((entry) => entry.orgId === orgId);
  return [...new Set((org?.fields ?? []).filter((field) => field.redacted).map((field) => shortLabel(field.label)))].slice(0, 2);
}

/**
 * Tramo de la barra de progreso: desde cuándo y cuánto dura la espera hasta `nextAt`.
 * Un mensaje del debate dura `stepMs`; un plazo más largo (las posturas) se mide desde
 * que esta pantalla lo vio por primera vez.
 */
export function progressWindow(nextAt: number, firstSeenAt: number, stepMs: number): { start: number; total: number } {
  const total = Math.max(stepMs, nextAt - firstSeenAt);
  return { start: nextAt - total, total };
}
