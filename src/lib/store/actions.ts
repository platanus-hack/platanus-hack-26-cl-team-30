// Contrato de acciones de una sala: lo que acepta POST /api/rooms/:id/action.
//
// Toda acción la dispara una persona con un rol: lleva orgId, roleId y el token
// que entregó JOIN_ROLE. El token es opcional en el esquema solo para poder
// responder 401 (y no 400) cuando falta; salvo JOIN_ROLE, todas lo exigen.
//
// Quién puede hacer qué lo decide el motor (src/lib/engine/deterministic.ts),
// no este archivo: aquí solo se valida la forma del mensaje.

import { z } from "zod";
import type { EngineErrorCode } from "../engine/deterministic";
import { GateModeSchema } from "../genome/schema";
import { REASON_MAX_LENGTH } from "./limits";

export { REASON_MAX_LENGTH };

// Topes de largo: todo texto que llega de un cliente tiene un máximo, porque
// parte de él termina en la bitácora y viaja a todas las pantallas.
const id = z.string().min(1).max(64);
const reason = z.string().max(REASON_MAX_LENGTH);

const actor = {
  /** Organización de quien actúa. El Comité inter-org usa el orgId del árbitro. */
  orgId: id,
  roleId: id,
  token: z.string().max(128).optional(),
};

/**
 * Tomar un rol. Devuelve el token. Con el token vigente sirve para reconectarse.
 * El puesto del Comité exige además committeeKey: la clave que va dentro del QR
 * del Comité (sin ella, 403 COMMITTEE_KEY_REQUIRED).
 */
export const JoinRoleActionSchema = z.object({ type: z.literal("JOIN_ROLE"), ...actor, committeeKey: z.string().max(64).optional() });

/** Liberar el rol e invalidar su token. */
export const LeaveRoleActionSchema = z.object({ type: z.literal("LEAVE_ROLE"), ...actor });

/**
 * Mover el límite de autoridad propio. El rol decide cuál: el proponente mueve
 * proposerLimit y el aprobador mueve approverLimit. Cualquier otro rol: 403.
 */
export const UpdateAuthoritySliderActionSchema = z.object({
  type: z.literal("UPDATE_AUTHORITY_SLIDER"),
  ...actor,
  value: z.number(),
});

/**
 * Alternar un campo propio entre reservado (solo el rol dueño) y compartido
 * (todos los roles de la organización). Solo el rol dueño del campo.
 */
export const ToggleFieldSecretActionSchema = z.object({
  type: z.literal("TOGGLE_FIELD_SECRET"),
  ...actor,
  fieldKey: id,
});

/**
 * Sellar la regla de autoridad: fija el umbral acordado y el modo de compuerta.
 * Solo proponente o aprobador. Sin threshold se usa el límite más conservador
 * de los dos. Sin gateMode se conserva el actual.
 */
export const SealRuleActionSchema = z.object({
  type: z.literal("SEAL_RULE"),
  ...actor,
  threshold: z.number().optional(),
  gateMode: GateModeSchema.optional(),
});

/**
 * Pedirle una propuesta al agente del rol. El agente recibe solo la vista ya
 * filtrada de ese rol. La respuesta trae el texto de la propuesta solo para
 * quien la pidió.
 */
export const RunRoleAgentActionSchema = z.object({
  type: z.literal("RUN_ROLE_AGENT"),
  ...actor,
  instruction: z.string().max(500).optional(),
});

/**
 * Intentar leer un campo. Si el rol no tiene permiso responde 403 RBAC_DENIED y
 * queda en la bitácora. targetOrgId por defecto es la organización propia.
 */
export const TestRbacBreachActionSchema = z.object({
  type: z.literal("TEST_RBAC_BREACH"),
  ...actor,
  targetOrgId: id.optional(),
  fieldKey: id,
});

export const HitlDecisionKindSchema = z.enum(["APPROVE", "VETO", "COUNTER_PROPOSE"]);

/**
 * Decisión humana sobre la compuerta de la organización propia. Solo el rol
 * aprobador o el Comité de esa organización. La razón es obligatoria (vacía:
 * 400 REASON_REQUIRED). COUNTER_PROPOSE exige counterValue dentro del umbral.
 */
export const HitlDecisionActionSchema = z.object({
  type: z.literal("HITL_DECISION"),
  ...actor,
  decision: HitlDecisionKindSchema,
  reason,
  counterValue: z.number().optional(),
});

/**
 * Presentar el candidato de la organización al recurso escaso (solo cross_org).
 * Solo el rol proponente del candidato. caseId por defecto: el caso de la organización.
 */
export const SubmitCandidateActionSchema = z.object({
  type: z.literal("SUBMIT_CANDIDATE"),
  ...actor,
  caseId: id.optional(),
});

/**
 * Sellar la asignación propuesta por el algoritmo (solo cross_org). Solo el
 * Comité árbitro. La razón es obligatoria.
 */
export const AllocationSealActionSchema = z.object({
  type: z.literal("ALLOCATION_SEAL"),
  ...actor,
  reason,
});

/**
 * Veto del Comité, con razón obligatoria.
 * - Comité árbitro (cross_org): veta al ganador propuesto; el algoritmo vuelve a
 *   ordenar sin ese caso.
 * - Comité de una organización: veta la compuerta de su organización
 *   (equivale a HITL_DECISION con VETO).
 */
export const CommitteeVetoActionSchema = z.object({
  type: z.literal("COMMITTEE_VETO"),
  ...actor,
  reason,
});

/**
 * Sorteo de silla: lo que acepta POST /api/rooms/:id/seat. No es una acción de
 * un rol (todavía no hay rol): el servidor elige al azar una silla libre y
 * entrega su token, igual que JOIN_ROLE.
 * - committeeKey: la clave del QR del Comité. Solo con ella el puesto del Comité
 *   entra al sorteo; sin ella se sortea entre los demás roles.
 * - current: la silla que ya tiene quien pide «sortear otro rol». Con su token
 *   vigente se le asigna una silla distinta y la anterior queda libre.
 */
export const RandomSeatRequestSchema = z.object({
  committeeKey: z.string().max(64).optional(),
  current: z.object({ orgId: id, roleId: id, token: z.string().max(128) }).optional(),
});
export type RandomSeatRequest = z.infer<typeof RandomSeatRequestSchema>;

/**
 * Fijar la postura del asiento propio en la negociación entre agentes (salas de
 * demo). Un toque por persona, entre las 2 o 3 opciones de su rol, y solo en la
 * fase de posturas. El Comité no fija postura: decide al final.
 */
export const SetPositionActionSchema = z.object({
  type: z.literal("SET_POSITION"),
  ...actor,
  optionId: id,
});

/** Controles del narrador sobre la negociación (POST /api/rooms/:id/negotiation, solo anfitrión). */
export const NegotiationControlSchema = z.object({ action: z.enum(["pause", "resume", "advance"]) });

export const ActionSchema = z.discriminatedUnion("type", [
  JoinRoleActionSchema,
  LeaveRoleActionSchema,
  UpdateAuthoritySliderActionSchema,
  ToggleFieldSecretActionSchema,
  SealRuleActionSchema,
  RunRoleAgentActionSchema,
  TestRbacBreachActionSchema,
  HitlDecisionActionSchema,
  SubmitCandidateActionSchema,
  AllocationSealActionSchema,
  CommitteeVetoActionSchema,
  SetPositionActionSchema,
]);

export type Action = z.infer<typeof ActionSchema>;
export type ActionType = Action["type"];
export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>;

export type JoinRoleAction = ActionOf<"JOIN_ROLE">;
export type LeaveRoleAction = ActionOf<"LEAVE_ROLE">;
export type UpdateAuthoritySliderAction = ActionOf<"UPDATE_AUTHORITY_SLIDER">;
export type ToggleFieldSecretAction = ActionOf<"TOGGLE_FIELD_SECRET">;
export type SealRuleAction = ActionOf<"SEAL_RULE">;
export type RunRoleAgentAction = ActionOf<"RUN_ROLE_AGENT">;
export type TestRbacBreachAction = ActionOf<"TEST_RBAC_BREACH">;
export type HitlDecisionAction = ActionOf<"HITL_DECISION">;
export type SubmitCandidateAction = ActionOf<"SUBMIT_CANDIDATE">;
export type AllocationSealAction = ActionOf<"ALLOCATION_SEAL">;
export type CommitteeVetoAction = ActionOf<"COMMITTEE_VETO">;
export type SetPositionAction = ActionOf<"SET_POSITION">;

export const ACTION_TYPES = ActionSchema.options.map((option) => option.shape.type.value) as ActionType[];

// --- Respuestas ---------------------------------------------------------------

/**
 * Códigos de error de la API de salas.
 *   400 BAD_REQUEST (el body no cumple ActionSchema) · REASON_REQUIRED · INVALID_VALUE
 *   401 INVALID_TOKEN (falta el token o no es el vigente del rol)
 *   403 RBAC_DENIED (el rol no tiene permiso; queda en la bitácora) ·
 *       COMMITTEE_KEY_REQUIRED (Comité sin la clave del QR) · HOST_ONLY (control de anfitrión sin su token)
 *   404 ROOM_NOT_FOUND · ROLE_NOT_FOUND · FIELD_NOT_FOUND · CANDIDATE_NOT_FOUND
 *   409 ROLE_TAKEN · NO_FREE_SEAT (sorteo de silla sin sillas libres) · WRONG_MODE · RULE_NOT_SEALED · GATE_NOT_BLOCKED ·
 *       DECISION_SEALED · ALLOCATION_NOT_READY · FIXED_ROOM (las salas de demo no se mutan) ·
 *       BUSY (ya hay una llamada al modelo en curso para ese rol o esa sala)
 *   429 RATE_LIMITED (demasiadas solicitudes del mismo cliente; ver Retry-After)
 *   503 ROOM_LIMIT · TOO_MANY_CONNECTIONS (topes del servidor; reintentar más tarde) ·
 *       STORAGE_UNAVAILABLE (Supabase o su tabla no están)
 */
export type ActionErrorCode =
  | EngineErrorCode
  | "BAD_REQUEST"
  | "INVALID_TOKEN"
  | "ROOM_NOT_FOUND"
  | "ROLE_TAKEN"
  | "NO_FREE_SEAT" // 409: el sorteo de silla no encontró ninguna libre
  | "FIXED_ROOM"
  | "ROOM_IN_USE" // 409: mutar una sala que ya tiene personas conectadas
  | "BUSY" // 409: ya hay una llamada al modelo en curso para este rol o esta sala, o un ensayo automático corriendo
  | "COMMITTEE_KEY_REQUIRED" // 403: tomar el puesto del Comité sin la clave del QR
  | "HOST_ONLY" // 403: control de la pantalla grande sin el token de anfitrión
  | "ROUND_STARTED" // 409: «Iniciar» de la demo fuera del paso Unirse
  | "RATE_LIMITED" // 429: demasiadas solicitudes seguidas del mismo cliente
  | "STORAGE_UNAVAILABLE" // 503: Supabase o la tabla no están disponibles
  | "ROOM_LIMIT" // 503: el servidor llegó al tope de salas y ninguna se puede liberar
  | "TOO_MANY_CONNECTIONS"; // 503: tope de conexiones SSE

export type ActionError = { error: string; code: ActionErrorCode };

/** Cuerpo de las respuestas 200. Los campos extra dependen de la acción. */
export type ActionOk = {
  ok: true;
  /** JOIN_ROLE: token del rol. Guardarlo; no se vuelve a entregar sin presentarlo. */
  token?: string;
  /** JOIN_ROLE: true si fue una reconexión con el token vigente. */
  reconnected?: boolean;
  /** Sorteo de silla (POST /api/rooms/:id/seat): la silla que tocó. El token viene en `token`. */
  seat?: { orgId: string; roleId: string };
  /** TEST_RBAC_BREACH: valor leído, cuando el rol sí tenía permiso. */
  value?: string | number;
  /** RUN_ROLE_AGENT: propuesta del agente, solo para quien la pidió. */
  agent?: {
    proposalText: string;
    suggestedValue: number | null;
    /** Campo que el agente intentó leer sin permiso, si lo hubo (queda como 403 en la bitácora). */
    attemptedFieldRead: string | null;
    latencyMs: number;
    /** "model" si respondió el modelo; "fallback" si se usó la propuesta determinista de respaldo. */
    source: "model" | "fallback";
  };
};
