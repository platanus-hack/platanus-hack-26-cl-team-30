// Almacén de salas de Nexo: estado en memoria del servidor, identidad por rol y
// aviso de cambios en tiempo real.
//
// Este archivo NO decide reglas: valida la forma de la acción (ActionSchema),
// comprueba la identidad (token del rol) y delega en el motor determinista
// (src/lib/engine/deterministic.ts), que es quien decide permisos y cambios.
//
// Identidad: JOIN_ROLE entrega un token secreto por rol. Los tokens viven aquí,
// fuera de RoomState, así que ninguna proyección ni el acta pueden contenerlos.
//
// El estado vive en memoria del proceso (ver docs/DECISIONES.md). Las salas
// "demo" y "demo-cross" se recrean solas desde la semilla si el servidor se reinicia.

import { EventEmitter } from "node:events";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mutateGenomeFromPrompt, runRoleAgentTurn } from "../../agents";
import * as engine from "../engine/deterministic";
import { OrgGenomeSchema, type OrgGenome, type ProjectedRoomState, type RoomMode, type RoomState, type Viewer } from "../genome/schema";
import { getInitialCrossOrgRoom, getInitialSingleOrgRoom, getSeedGenome, initialTelemetry, type SeedGenomeId } from "../genome/seeds";
import { getTelemetry } from "../llm";
import { ActionSchema, type ActionError, type ActionErrorCode, type ActionOk } from "./actions";

// --- Almacén ----------------------------------------------------------------

type RoomRecord = {
  state: RoomState;
  /** Token vigente por rol, con clave "orgId:roleId". Secreto: nunca sale del servidor. */
  tokens: Map<string, string>;
};

type Store = { rooms: Map<string, RoomRecord>; bus: EventEmitter };

// Se guarda en globalThis para que la recarga en caliente de desarrollo no lo borre.
const globalStore = globalThis as unknown as { __nexoRoomStore?: Store };
const store: Store = (globalStore.__nexoRoomStore ??= { rooms: new Map(), bus: new EventEmitter() });
store.bus.setMaxListeners(0);

/** Salas de id fijo que se recrean solas: el suelo de la demo y la capa inter-org. */
export const FIXED_ROOMS: Readonly<Record<string, RoomMode>> = { demo: "single_org", "demo-cross": "cross_org" };

export function isFixedRoom(roomId: string): boolean {
  return Object.hasOwn(FIXED_ROOMS, roomId);
}

function emit(roomId: string) {
  store.bus.emit(roomId);
}

function newRoomId(): string {
  let id: string;
  do id = randomBytes(4).toString("hex").slice(0, 6);
  while (store.rooms.has(id) || isFixedRoom(id));
  return id;
}

/** Telemetría real de la capa de modelos. Si no se puede leer, lo que dice la configuración. */
function liveTelemetry() {
  try {
    return getTelemetry();
  } catch {
    return initialTelemetry();
  }
}

export type CreateRoomInput = {
  /** Id de la sala. Si falta, se genera uno. Falla si ya existe. */
  id?: string;
  mode?: RoomMode;
  /** Semilla de la organización. Solo en single_org. */
  seed?: SeedGenomeId;
  /** Genoma ya validado, en vez de una semilla. Solo en single_org. */
  genome?: OrgGenome;
  /** Reloj del servidor. Por defecto, ahora. */
  now?: number;
};

/** Crea una sala desde una semilla (o un genoma validado) y la deja lista para recibir jugadores. */
export function createRoom(input: CreateRoomInput = {}): RoomState {
  const id = input.id ?? newRoomId();
  if (store.rooms.has(id)) throw new Error(`La sala ${id} ya existe`);
  const now = input.now ?? Date.now();
  const options = { now, telemetry: liveTelemetry() };
  const initial =
    (input.mode ?? "single_org") === "cross_org"
      ? getInitialCrossOrgRoom(id, options)
      : getInitialSingleOrgRoom(id, input.genome ?? input.seed, options);
  const state = engine.openRoom(initial, now);
  store.rooms.set(id, { state, tokens: new Map() });
  return state;
}

/** Busca una sala. Las de id fijo se crean al vuelo si no existen. */
function lookup(roomId: string): RoomRecord | undefined {
  const existing = store.rooms.get(roomId);
  if (existing) return existing;
  if (!isFixedRoom(roomId)) return undefined;
  createRoom({ id: roomId, mode: FIXED_ROOMS[roomId] });
  return store.rooms.get(roomId);
}

/** Estado completo de una sala (con secretos). Solo para código del servidor; nunca se envía a un cliente. */
export function getRoom(roomId: string): RoomState | undefined {
  return lookup(roomId)?.state;
}

/**
 * Reinicia una sala. Las de id fijo vuelven a su semilla; las demás se borran.
 * Invalida todos los tokens. Devuelve false si la sala no existía.
 */
export function resetRoom(roomId: string): boolean {
  const existed = store.rooms.delete(roomId);
  if (isFixedRoom(roomId)) {
    lookup(roomId);
    emit(roomId);
    return true;
  }
  if (existed) emit(roomId);
  return existed;
}

/** Avisa cada vez que la sala cambia. Devuelve la función para dejar de escuchar. */
export function subscribe(roomId: string, listener: () => void): () => void {
  store.bus.on(roomId, listener);
  return () => store.bus.off(roomId, listener);
}

// --- Identidad ---------------------------------------------------------------

const tokenKey = (actor: engine.ActorRef) => `${actor.orgId}:${actor.roleId}`;

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Compara en tiempo constante el token presentado con el vigente del rol. */
function tokenMatches(record: RoomRecord, actor: engine.ActorRef, token: string | null | undefined): boolean {
  const expected = record.tokens.get(tokenKey(actor));
  if (!expected || typeof token !== "string") return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type Credentials = { orgId?: string | null; roleId?: string | null; token?: string | null };

/** Qué vista le corresponde a quien presenta estas credenciales: su rol si el token es válido; si no, "stage". */
export function resolveViewer(roomId: string, credentials: Credentials): Viewer {
  const record = lookup(roomId);
  const { orgId, roleId, token } = credentials;
  if (!record || !orgId || !roleId) return "stage";
  const actor = { orgId, roleId };
  return engine.isKnownActor(record.state, actor) && tokenMatches(record, actor, token) ? actor : "stage";
}

/** Señal de vida de un rol con conexión abierta. No cambia la versión ni avisa a nadie. */
export function touchPresence(roomId: string, viewer: Viewer, now: number = Date.now()): void {
  const record = store.rooms.get(roomId);
  if (!record || viewer === "stage") return;
  record.state = {
    ...record.state,
    connectedPlayers: record.state.connectedPlayers.map((player) =>
      player.orgId === viewer.orgId && player.roleId === viewer.roleId ? { ...player, heartbeatMs: now } : player,
    ),
  };
}

// --- Salida hacia clientes -----------------------------------------------------

/**
 * Lo que se le envía a un viewer. Única salida de estado de una sala hacia
 * clientes: siempre pasa por projectStateForOrgAndRole del motor.
 */
export function projectRoom(roomId: string, viewer: Viewer, now: number = Date.now()): ProjectedRoomState | undefined {
  const record = lookup(roomId);
  if (!record) return undefined;
  return engine.projectStateForOrgAndRole({ ...record.state, telemetry: liveTelemetry() }, viewer, now);
}

/** true mientras el contador de lo que está en juego sigue corriendo. */
export function isStakesRunning(roomId: string): boolean {
  const state = store.rooms.get(roomId)?.state;
  return !!state && state.decisionSealedAt === null;
}

/** Acta de la sala con la bitácora completa, en JSON y en Markdown. No contiene valores reservados. */
export function getActa(roomId: string, now: number = Date.now()): { acta: engine.AuditActa; markdown: string } | undefined {
  const record = lookup(roomId);
  if (!record) return undefined;
  const acta = engine.buildAuditActa({ ...record.state, telemetry: liveTelemetry() }, now);
  return { acta, markdown: engine.renderActaMarkdown(acta) };
}

// --- Acciones ---------------------------------------------------------------

export type ActionResponse =
  | { status: 200; body: ActionOk }
  | { status: 400 | 401 | 403 | 404 | 409; body: ActionError };

function reject(status: 400 | 401 | 403 | 404 | 409, code: ActionErrorCode, error: string): ActionResponse {
  return { status, body: { error, code } };
}

/** Guarda el estado que devuelve el motor y avisa a las conexiones si cambió. */
function settle(roomId: string, record: RoomRecord, result: engine.EngineResult, extra: Omit<ActionOk, "ok"> = {}): ActionResponse {
  const nextState = result.state;
  if (nextState && nextState !== record.state) {
    record.state = nextState;
    emit(roomId);
  }
  if (!result.ok) return reject(result.status, result.code, result.message);
  return { status: 200, body: { ok: true, ...extra } };
}

function join(roomId: string, record: RoomRecord, actor: engine.ActorRef, token: string | undefined, now: number): ActionResponse {
  const key = tokenKey(actor);
  const current = record.tokens.get(key);
  if (current) {
    if (tokenMatches(record, actor, token)) {
      // Reconexión de la misma persona (por ejemplo, recargó la página).
      touchPresence(roomId, actor, now);
      return { status: 200, body: { ok: true, token: current, reconnected: true } };
    }
    // El rol se libera solo si quien lo tenía lleva un rato sin conexión abierta.
    const player = record.state.connectedPlayers.find((entry) => entry.orgId === actor.orgId && entry.roleId === actor.roleId);
    const abandoned = !player || now - player.heartbeatMs >= engine.PRESENCE_TTL_MS;
    if (!abandoned) {
      record.state = engine.recordAuthFailure(record.state, actor, "JOIN_ROLE sobre un rol ocupado", now);
      emit(roomId);
      return reject(409, "ROLE_TAKEN", "Ese rol ya lo tomó otra persona");
    }
  }
  const fresh = newToken();
  record.tokens.set(key, fresh);
  return settle(roomId, record, engine.markRoleJoined(record.state, actor, now), { token: fresh, reconnected: false });
}

/**
 * Única puerta para cambiar una sala. Recibe el body tal como llegó: valida la
 * forma con ActionSchema, comprueba el token del rol y delega en el motor.
 * Devuelve el status HTTP y el cuerpo de la respuesta.
 */
export async function applyAction(roomId: string, rawBody: unknown, now: number = Date.now()): Promise<ActionResponse> {
  const record = lookup(roomId);
  if (!record) return reject(404, "ROOM_NOT_FOUND", "La sala no existe");

  const parsed = ActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return reject(400, "BAD_REQUEST", `Acción inválida${where}: se espera { type, orgId, roleId, token, ...datos }`);
  }
  const action = parsed.data;
  const actor: engine.ActorRef = { orgId: action.orgId, roleId: action.roleId };
  if (!engine.isKnownActor(record.state, actor)) return reject(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);

  if (action.type === "JOIN_ROLE") return join(roomId, record, actor, action.token, now);

  // Desde aquí toda acción exige el token vigente del rol.
  if (!tokenMatches(record, actor, action.token)) {
    record.state = engine.recordAuthFailure(record.state, actor, `${action.type} sin token válido`, now);
    emit(roomId);
    return reject(401, "INVALID_TOKEN", "Falta el token del rol o no es válido");
  }

  switch (action.type) {
    case "LEAVE_ROLE":
      record.tokens.delete(tokenKey(actor));
      return settle(roomId, record, engine.markRoleLeft(record.state, actor, now));
    case "UPDATE_AUTHORITY_SLIDER":
      return settle(roomId, record, engine.updateAuthoritySlider(record.state, actor, action.value, now));
    case "TOGGLE_FIELD_SECRET":
      return settle(roomId, record, engine.toggleFieldSecret(record.state, actor, action.fieldKey, now));
    case "SEAL_RULE":
      return settle(roomId, record, engine.sealRule(record.state, actor, { threshold: action.threshold, gateMode: action.gateMode }, now));
    case "TEST_RBAC_BREACH": {
      const result = engine.attemptProtectedRead(record.state, actor, { orgId: action.targetOrgId, fieldKey: action.fieldKey }, now);
      return settle(roomId, record, result, result.ok ? { value: result.value } : {});
    }
    case "HITL_DECISION":
      return settle(roomId, record, engine.recordGateDecision(record.state, actor, { decision: action.decision, reason: action.reason, counterValue: action.counterValue }, now));
    case "SUBMIT_CANDIDATE":
      return settle(roomId, record, engine.submitCandidate(record.state, actor, action.caseId, now));
    case "ALLOCATION_SEAL":
      return settle(roomId, record, engine.sealAllocation(record.state, actor, action.reason, now));
    case "COMMITTEE_VETO":
      return settle(roomId, record, engine.recordCommitteeDecision(record.state, actor, { decision: "VETO", reason: action.reason }, now));
    case "RUN_ROLE_AGENT":
      return runAgent(roomId, record, actor, action.instruction);
  }
}

/**
 * Turno del agente de un rol, pedido por la persona que tiene ese rol. El agente
 * recibe solo la vista ya filtrada de ese rol: hereda sus permisos. El modelo
 * propone; lo que cambia en la sala lo decide el motor (applyAgentProposal).
 */
async function runAgent(roomId: string, record: RoomRecord, actor: engine.ActorRef, instruction: string | undefined): Promise<ActionResponse> {
  // Solo los roles de una organización tienen agente; el Comité árbitro decide en persona.
  if (engine.isArbiter(record.state, actor)) return reject(409, "WRONG_MODE", "El Comité árbitro no tiene agente: decide en persona");

  const view = projectRoom(roomId, actor);
  if (!view) return reject(404, "ROOM_NOT_FOUND", "La sala no existe");
  const turn = await runRoleAgentTurn(view, { instruction });

  // La llamada al modelo tarda: la sala pudo reiniciarse o el rol pudo cambiar de manos.
  if (store.rooms.get(roomId) !== record || !record.tokens.has(tokenKey(actor))) {
    return reject(409, "ROLE_TAKEN", "La sala o el rol cambiaron mientras el agente respondía");
  }
  const result = engine.applyAgentProposal(
    record.state,
    actor,
    { suggestedValue: turn.suggestedValue, attemptedFieldRead: turn.attemptedFieldRead, source: turn.source },
    Date.now(),
  );
  return settle(roomId, record, result, {
    agent: {
      proposalText: turn.proposalText,
      suggestedValue: turn.suggestedValue,
      attemptedFieldRead: turn.attemptedFieldRead,
      latencyMs: turn.latencyMs,
      source: turn.source,
    },
  });
}

// --- Mutación ------------------------------------------------------------------

export type MutateResponse =
  | { status: 200; body: { ok: true; source: "llm" | "fallback_seed"; latencyMs: number; orgId: string; orgName: string } }
  | { status: 400 | 404 | 409; body: ActionError };

/**
 * Muta una sala single_org: a partir de una frase, el modelo escribe un genoma
 * que se valida con OrgGenomeSchema antes de usarse. Si el modelo falla o el
 * genoma no valida, se usa una semilla. Es un caso nuevo: los roles quedan libres
 * y los tokens anteriores dejan de servir.
 */
export async function mutateRoom(roomId: string, description: unknown): Promise<MutateResponse> {
  const record = lookup(roomId);
  if (!record) return { status: 404, body: { error: "La sala no existe", code: "ROOM_NOT_FOUND" } };
  if (isFixedRoom(roomId)) return { status: 409, body: { error: "Las salas de demo no se pueden mutar: crea una sala nueva", code: "FIXED_ROOM" } };
  if (record.state.mode !== "single_org") return { status: 409, body: { error: "Solo se puede mutar una sala de una sola organización", code: "WRONG_MODE" } };
  if (typeof description !== "string" || !description.trim()) return { status: 400, body: { error: "Se espera { description } con una frase que describa la organización", code: "BAD_REQUEST" } };

  const mutation = await mutateGenomeFromPrompt(description);
  // Segunda validación aquí: nada entra a una sala sin pasar el esquema, venga de donde venga.
  const checked = OrgGenomeSchema.safeParse(mutation.genome);
  const genome = checked.success ? checked.data : getSeedGenome();
  const source = checked.success ? mutation.source : "fallback_seed";

  if (store.rooms.get(roomId) !== record) return { status: 404, body: { error: "La sala se reinició mientras el modelo respondía", code: "ROOM_NOT_FOUND" } };
  const result = engine.replaceRoomGenome(record.state, genome, source, Date.now());
  if (!result.ok) return { status: 409, body: { error: result.message, code: result.code } };
  record.state = result.state;
  record.tokens.clear();
  emit(roomId);
  return { status: 200, body: { ok: true, source, latencyMs: mutation.latencyMs, orgId: genome.orgId, orgName: genome.orgName } };
}
