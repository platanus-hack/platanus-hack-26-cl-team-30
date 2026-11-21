// Canales externos del Comité árbitro: WhatsApp (Kapso) y voz (ElevenLabs).
//
// Ninguno de estos canales tiene reglas propias. Ambos actúan sobre la sala con
// las MISMAS acciones que usa la pantalla web (JOIN_ROLE con la clave del Comité,
// ALLOCATION_SEAL o COMMITTEE_VETO con razón obligatoria), así que los permisos,
// la bitácora y el acta funcionan igual sin importar por dónde decida el Comité.
//
// El resumen que se le lee o escribe al Comité se arma solo con la vista que el
// Comité puede ver (projectRoom con su propio rol): un canal externo nunca recibe
// datos reservados de una organización.

import { randomBytes } from "node:crypto";
import { applyAction, getHostCredentials, getRoom, projectRoom } from "@/lib/store/rooms";

export type ChannelKind = "whatsapp" | "voice";
export type CommitteeDecision = "approve" | "veto";

type Session = {
  id: string;
  roomId: string;
  channel: ChannelKind;
  orgId: string;
  roleId: string;
  token: string;
  createdAt: number;
  /** WhatsApp: decisión elegida con un botón, a la espera de la razón escrita. */
  pendingDecision: CommitteeDecision | null;
  /** WhatsApp: número del Comité (E.164 sin "+"), para asociar sus respuestas. */
  phone: string | null;
  /** WhatsApp: ya se envió la nota de voz con el caso (src/integrations/voice-notes.ts). */
  caseVoiceSent?: boolean;
};

const SESSION_TTL_MS = 30 * 60 * 1000;

// En memoria del proceso, como las salas (ver docs/DECISIONES.md).
const globalStore = globalThis as unknown as { __nexoCommitteeSessions?: Map<string, Session> };
const sessions: Map<string, Session> = (globalStore.__nexoCommitteeSessions ??= new Map());

function sweep(now = Date.now()) {
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export type OpenResult =
  | { ok: true; session: Session }
  | { ok: false; status: 404 | 409; code: string; message: string };

/**
 * Toma el puesto del Comité árbitro de una sala en nombre de un canal externo.
 * Usa la clave del Comité de la sala, igual que el código QR. Si una persona ya
 * tiene el puesto desde la web, responde 409: el Comité es uno solo.
 */
export async function openCommitteeSession(roomId: string, channel: ChannelKind, phone: string | null = null): Promise<OpenResult> {
  sweep();
  const state = getRoom(roomId);
  const credentials = getHostCredentials(roomId);
  const arbiter = state?.scarcity?.arbiter;
  if (!state || !credentials) return { ok: false, status: 404, code: "ROOM_NOT_FOUND", message: "La sala no existe" };
  if (!arbiter) return { ok: false, status: 409, code: "WRONG_MODE", message: "Esta sala no tiene un Comité árbitro (no es entre organizaciones)" };

  // Reusar la sesión vigente del mismo canal en esta sala.
  for (const session of sessions.values()) {
    if (session.roomId === roomId && session.channel === channel) return { ok: true, session };
  }

  const joined = await applyAction(roomId, {
    type: "JOIN_ROLE",
    orgId: arbiter.orgId,
    roleId: arbiter.roleId,
    committeeKey: credentials.committeeKey,
  });
  if (joined.status !== 200 || !("token" in joined.body) || typeof joined.body.token !== "string") {
    const body = joined.body as { error?: string; code?: string };
    return { ok: false, status: 409, code: body.code ?? "ROLE_TAKEN", message: body.error ?? "El puesto del Comité ya está ocupado" };
  }

  const session: Session = {
    id: randomBytes(12).toString("base64url"),
    roomId,
    channel,
    orgId: arbiter.orgId,
    roleId: arbiter.roleId,
    token: joined.body.token,
    createdAt: Date.now(),
    pendingDecision: null,
    phone,
  };
  sessions.set(session.id, session);
  return { ok: true, session };
}

export function getSession(id: string | null | undefined): Session | undefined {
  if (!id) return undefined;
  sweep();
  return sessions.get(id);
}

/** Sesión de WhatsApp asociada a un número, la más reciente. */
export function getSessionByPhone(phone: string): Session | undefined {
  sweep();
  const normalized = phone.replace(/\D/g, "");
  let found: Session | undefined;
  for (const session of sessions.values()) {
    if (session.channel === "whatsapp" && session.phone === normalized && (!found || session.createdAt > found.createdAt)) found = session;
  }
  return found;
}

/** Única sesión de voz abierta, si hay exactamente una (respaldo si la llamada no trae su id). */
export function getOnlyVoiceSession(): Session | undefined {
  sweep();
  const voice = [...sessions.values()].filter((session) => session.channel === "voice");
  return voice.length === 1 ? voice[0] : undefined;
}

export function setPendingDecision(session: Session, decision: CommitteeDecision | null) {
  session.pendingDecision = decision;
}

export function closeSession(session: Session) {
  sessions.delete(session.id);
}

const pct = (value: number) => `${Math.round(value * 100)} puntos`;

/**
 * Resumen del caso en lenguaje simple, armado SOLO con la vista del Comité.
 * Es lo que se escribe por WhatsApp y lo que el agente de voz lee en la llamada.
 */
export function buildCommitteeBrief(session: Session): string {
  const state = getRoom(session.roomId);
  const view = projectRoom(session.roomId, { orgId: session.orgId, roleId: session.roleId });
  if (!state?.scarcity || !view) return "La sala ya no existe.";

  const allocation = view.allocation;
  const resource = state.scarcity.resource;
  const orgName = (orgId: string) => view.orgs.find((org) => org.orgId === orgId)?.orgName ?? orgId;

  if (!allocation || allocation.ranking.length === 0) {
    return `Recurso en disputa: ${resource}. Las organizaciones todavía no presentan a sus candidatos.`;
  }
  if (allocation.committeeDecision) {
    return `Recurso: ${resource}. El Comité ya decidió este caso.`;
  }

  const lines = allocation.ranking.map(
    (candidate) => `${candidate.rank}. ${candidate.patientLabel} (${orgName(candidate.orgId)}): ${pct(candidate.score)}`,
  );
  const winner = allocation.ranking[0];
  return [
    `Recurso en disputa: ${resource}.`,
    `Orden que propone la regla: ${lines.join("; ")}.`,
    `Propuesta: asignarlo a ${winner.patientLabel} de ${orgName(winner.orgId)}.`,
    allocation.tieBreakApplied ? "Hubo empate técnico y se aplicó el desempate de equidad." : "",
    allocation.explanation,
    "El Comité puede aprobar o vetar, y en ambos casos debe dar una razón.",
  ]
    .filter(Boolean)
    .join(" ");
}

export type DecideResult = { ok: true } | { ok: false; status: number; code: string; message: string };

/** Aplica la decisión del Comité con las mismas acciones que la pantalla web. */
export async function decideAsCommittee(session: Session, decision: CommitteeDecision, reason: string, channelLabel: string): Promise<DecideResult> {
  const text = reason.trim();
  if (text.length < 3) return { ok: false, status: 400, code: "REASON_REQUIRED", message: "La razón es obligatoria" };
  const result = await applyAction(session.roomId, {
    type: decision === "approve" ? "ALLOCATION_SEAL" : "COMMITTEE_VETO",
    orgId: session.orgId,
    roleId: session.roleId,
    token: session.token,
    reason: `${text.slice(0, 450)} (vía ${channelLabel})`,
  });
  if (result.status === 200) return { ok: true };
  const body = result.body as { error?: string; code?: string };
  return { ok: false, status: result.status, code: body.code ?? "ERROR", message: body.error ?? "No se pudo registrar la decisión" };
}
