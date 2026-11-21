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
// fijas ("demo", "demo-cross", "demo-construccion", "demo-logistica") se recrean
// solas desde la semilla si el servidor se reinicia.
//
// Anfitrión y Comité: al crear una sala se emiten dos secretos que tampoco salen
// en ninguna proyección. El token de anfitrión habilita los controles de la
// pantalla grande (reiniciar, ensayo automático, liberar un puesto, mutar). La
// clave del Comité viaja dentro del QR del Comité: sin ella nadie toma ese puesto.
//
// Topes, para que un deploy público no se llene: cantidad de salas, salas
// inactivas que se borran solas, conexiones SSE por sala y en total, y una sola
// llamada al modelo a la vez por rol (agente) y por sala (mutación).

import { EventEmitter } from "node:events";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mutateGenomeFromPrompt, runRoleAgentTurn } from "../../agents";
import { AUTOPILOT_DEFAULT_STEP_MS, buildAutopilotScript, scriptSeats, stepOutcome, type AutopilotStep } from "../engine/autopilot";
import * as engine from "../engine/deterministic";
import { OrgGenomeSchema, type AutopilotView, type OrgGenome, type ProjectedRoomState, type RoomMode, type RoomState, type Viewer } from "../genome/schema";
import { CROSS_ORG_SCENARIOS, DEFAULT_CROSS_ORG_SCENARIO, type CrossOrgScenarioId } from "../genome/scenarios";
import { getInitialCrossOrgRoom, getInitialSingleOrgRoom, getSeedGenome, initialTelemetry, type SeedGenomeId } from "../genome/seeds";
import { getTelemetry } from "../llm";
import { ActionSchema, type ActionError, type ActionErrorCode, type ActionOk } from "./actions";

// --- Almacén ----------------------------------------------------------------

/** Con qué se abrió la sala: sirve para reiniciarla exactamente donde empezó. */
type RoomOrigin = { mode: RoomMode; seed?: SeedGenomeId; genome?: OrgGenome; scenario?: CrossOrgScenarioId };

type AutopilotRun = {
  running: boolean;
  script: AutopilotStep[];
  step: number;
  lastStep: string | null;
  botSeats: engine.ActorRef[];
  timer: ReturnType<typeof setTimeout> | null;
};

type RoomRecord = {
  state: RoomState;
  origin: RoomOrigin;
  /** Token vigente por rol, con clave "orgId:roleId". Secreto: nunca sale del servidor. */
  tokens: Map<string, string>;
  /** Controles de la pantalla grande. Se entrega a quien crea la sala. Secreto. */
  hostToken: string;
  /** Va dentro del QR del Comité: la única forma de tomar ese puesto. Secreto. */
  committeeKey: string;
  /** Ensayo automático de la sala, si se usó. */
  autopilot: AutopilotRun | null;
  /** Última actividad (acción, conexión o mutación), en reloj real. Solo para la limpieza. */
  lastActiveAt: number;
  /** Llamadas al modelo en curso: "mutate" o "agent:orgId:roleId". */
  busy: Set<string>;
};

type Store = {
  rooms: Map<string, RoomRecord>;
  bus: EventEmitter;
  /** Conexiones SSE abiertas por sala. Se llevan por id: sobreviven al reinicio de la sala. */
  connections: Map<string, number>;
  lastSweepAt: number;
};

// Se guarda en globalThis para que la recarga en caliente de desarrollo no lo borre.
const globalStore = globalThis as unknown as { __nexoRoomStoreV2?: Store };
const store: Store = (globalStore.__nexoRoomStoreV2 ??= { rooms: new Map(), bus: new EventEmitter(), connections: new Map(), lastSweepAt: 0 });
store.bus.setMaxListeners(0);

/**
 * Salas de id fijo que se recrean solas: el suelo de la demo (una clínica) y un
 * escenario entre organizaciones por cada ejemplo del catálogo.
 */
export const FIXED_ROOMS: Readonly<Record<string, RoomOrigin>> = {
  demo: { mode: "single_org" },
  ...Object.fromEntries(Object.values(CROSS_ORG_SCENARIOS).map((info) => [info.fixedRoomId, { mode: "cross_org", scenario: info.id } satisfies RoomOrigin])),
};

export function isFixedRoom(roomId: string): boolean {
  return Object.hasOwn(FIXED_ROOMS, roomId);
}

// --- Topes --------------------------------------------------------------------

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Máximo de salas creadas por POST /api/rooms que viven a la vez. Las fijas no cuentan. */
export const maxRooms = () => envInt("NEXO_MAX_ROOMS", 200);
/** Una sala sin conexiones ni actividad durante este tiempo se borra. */
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
/** Una sala fija usada que queda sin conexiones ni actividad este tiempo vuelve a su semilla. */
export const FIXED_ROOM_IDLE_RESET_MS = 15 * 60 * 1000;
export const MAX_CONNECTIONS_PER_ROOM = 200;
export const MAX_CONNECTIONS_TOTAL = 1000;
const SWEEP_INTERVAL_MS = 30_000;

/** No se pueden crear más salas: todas las existentes tienen gente conectada. */
export class RoomLimitError extends Error {
  constructor() {
    super("El servidor llegó al tope de salas. Intenta de nuevo en unos minutos.");
    this.name = "RoomLimitError";
  }
}

// El nombre del evento lleva prefijo: un EventEmitter trata distinto a "error".
const channel = (roomId: string) => `room:${roomId}`;

function emit(roomId: string) {
  store.bus.emit(channel(roomId));
}

function connectionsOf(roomId: string): number {
  return store.connections.get(roomId) ?? 0;
}

function touch(record: RoomRecord) {
  record.lastActiveAt = Date.now();
}

/**
 * Limpieza de salas inactivas. Nunca toca una sala con conexiones abiertas.
 *   - Sala creada por un usuario: se borra tras ROOM_IDLE_TTL_MS sin actividad.
 *   - Sala fija ("demo", "demo-cross"): si alguien la usó y lleva
 *     FIXED_ROOM_IDLE_RESET_MS sin actividad, se borra y renace desde la semilla
 *     la próxima vez que alguien entre, para que el siguiente visitante no
 *     encuentre un caso ya decidido.
 * Devuelve cuántas salas quitó.
 */
export function sweepRooms(now: number = Date.now()): number {
  store.lastSweepAt = now;
  let removed = 0;
  for (const [roomId, record] of store.rooms) {
    if (connectionsOf(roomId) > 0 || record.busy.size > 0 || record.autopilot?.running) continue;
    const idle = now - record.lastActiveAt;
    const expired = isFixedRoom(roomId) ? record.state.version > 0 && idle >= FIXED_ROOM_IDLE_RESET_MS : idle >= ROOM_IDLE_TTL_MS;
    if (expired) {
      stopTimer(record);
      store.rooms.delete(roomId);
      removed += 1;
    }
  }
  return removed;
}

/** Hace lugar para una sala nueva. Lanza RoomLimitError si no se puede. */
function makeRoomFor(roomId: string) {
  if (isFixedRoom(roomId)) return;
  const userRooms = () => [...store.rooms.keys()].filter((id) => !isFixedRoom(id));
  if (userRooms().length < maxRooms()) return;
  sweepRooms();
  // Sigue llena: sale la sala sin conexiones que lleva más tiempo sin actividad.
  while (userRooms().length >= maxRooms()) {
    const victim = userRooms()
      .filter((id) => connectionsOf(id) === 0 && store.rooms.get(id)!.busy.size === 0 && !store.rooms.get(id)!.autopilot?.running)
      .sort((a, b) => store.rooms.get(a)!.lastActiveAt - store.rooms.get(b)!.lastActiveAt)[0];
    if (!victim) throw new RoomLimitError();
    store.rooms.delete(victim);
  }
}

function newRoomId(): string {
  let id: string;
  do id = randomBytes(4).toString("hex");
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
  /** Escenario entre organizaciones. Solo en cross_org. Por defecto, los hospitales. */
  scenario?: CrossOrgScenarioId;
  /** Reloj del servidor. Por defecto, ahora. */
  now?: number;
};

function newSecret(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function initialState(id: string, origin: RoomOrigin, now: number): RoomState {
  const options = { now, telemetry: liveTelemetry() };
  const initial =
    origin.mode === "cross_org"
      ? getInitialCrossOrgRoom(id, { ...options, scenario: origin.scenario ?? DEFAULT_CROSS_ORG_SCENARIO })
      : getInitialSingleOrgRoom(id, origin.genome ? structuredClone(origin.genome) : origin.seed, options);
  return engine.openRoom(initial, now);
}

/**
 * Crea una sala desde una semilla (o un genoma validado) y la deja lista para
 * recibir jugadores. Lanza RoomLimitError si el servidor está en su tope de salas
 * y todas tienen gente conectada.
 */
export function createRoom(input: CreateRoomInput = {}): RoomState {
  const id = input.id ?? newRoomId();
  if (store.rooms.has(id)) throw new Error(`La sala ${id} ya existe`);
  makeRoomFor(id);
  const mode = input.mode ?? "single_org";
  const origin: RoomOrigin =
    mode === "cross_org" ? { mode, scenario: input.scenario ?? DEFAULT_CROSS_ORG_SCENARIO } : { mode, ...(input.genome ? { genome: structuredClone(input.genome) } : { seed: input.seed }) };
  const state = initialState(id, origin, input.now ?? Date.now());
  store.rooms.set(id, {
    state,
    origin,
    tokens: new Map(),
    hostToken: newSecret(24),
    committeeKey: newSecret(9),
    autopilot: null,
    lastActiveAt: Date.now(),
    busy: new Set(),
  });
  return state;
}

/** Busca una sala. Las de id fijo se crean al vuelo si no existen. */
function lookup(roomId: string): RoomRecord | undefined {
  if (Date.now() - store.lastSweepAt >= SWEEP_INTERVAL_MS) sweepRooms();
  const existing = store.rooms.get(roomId);
  if (existing) return existing;
  if (!isFixedRoom(roomId)) return undefined;
  const origin = FIXED_ROOMS[roomId];
  createRoom({ id: roomId, mode: origin.mode, scenario: origin.scenario });
  return store.rooms.get(roomId);
}

/** Estado completo de una sala (con secretos). Solo para código del servidor; nunca se envía a un cliente. */
export function getRoom(roomId: string): RoomState | undefined {
  return lookup(roomId)?.state;
}

/**
 * Reinicia una sala: vuelve al caso con que se abrió (semilla, escenario o
 * genoma mutado), detiene el ensayo automático y revoca todos los tokens de los
 * puestos. Conserva el id, el token de anfitrión y la clave del Comité, así que
 * la pantalla grande sigue teniendo sus controles y el QR impreso sigue sirviendo.
 * Devuelve false si la sala no existe.
 */
export function resetRoom(roomId: string, now: number = Date.now()): boolean {
  const record = lookup(roomId);
  if (!record) return false;
  stopTimer(record);
  record.autopilot = null;
  record.tokens.clear();
  record.busy.clear();
  record.state = initialState(roomId, record.origin, now);
  touch(record);
  emit(roomId);
  return true;
}

/** Borra una sala de la memoria. Una sala fija renace limpia la próxima vez que alguien entre. */
export function discardRoom(roomId: string): boolean {
  const record = store.rooms.get(roomId);
  if (!record) return false;
  stopTimer(record);
  store.rooms.delete(roomId);
  emit(roomId);
  return true;
}

// --- Anfitrión y Comité -----------------------------------------------------------

export type HostCredentials = { hostToken: string; committeeKey: string };

/**
 * Secretos de la sala para quien la creó. Solo para código del servidor: la ruta
 * que crea la sala los entrega una vez a quien la pidió.
 */
export function getHostCredentials(roomId: string): HostCredentials | undefined {
  const record = lookup(roomId);
  return record ? { hostToken: record.hostToken, committeeKey: record.committeeKey } : undefined;
}

function sameSecret(given: string | null | undefined, expected: string | undefined): boolean {
  if (typeof given !== "string" || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** true si la clave coincide con NEXO_ADMIN_KEY (cuando está definida). */
export function isAdminKey(key: string | null | undefined): boolean {
  return sameSecret(key, process.env.NEXO_ADMIN_KEY || undefined);
}

/** true si quien presenta este token (o la clave de administración) puede usar los controles de la pantalla grande. */
export function isHost(roomId: string, hostToken: string | null | undefined, adminKey?: string | null): boolean {
  const record = lookup(roomId);
  if (!record) return false;
  return sameSecret(hostToken, record.hostToken) || isAdminKey(adminKey);
}

export type ClaimResult = { ok: true; credentials: HostCredentials } | { ok: false; status: 403 | 404; code: "HOST_ONLY" | "ROOM_NOT_FOUND"; error: string };

/**
 * Pedir los controles de una sala fija ("demo", "demo-cross", ...), que nadie
 * creó. Con NEXO_ADMIN_KEY definida hay que presentarla. Sin ella solo se
 * permite fuera de producción (desarrollo y pruebas): en el deploy público una
 * sala fija no entrega sus controles a cualquiera; para presentar se crea una
 * sala nueva, y quien la crea recibe sus propios controles.
 * Las salas creadas con POST /api/rooms no se pueden reclamar.
 */
export function claimHost(roomId: string, adminKey: string | null | undefined): ClaimResult {
  const record = lookup(roomId);
  if (!record) return { ok: false, status: 404, code: "ROOM_NOT_FOUND", error: "La sala no existe" };
  if (!isFixedRoom(roomId)) return { ok: false, status: 403, code: "HOST_ONLY", error: "Los controles de esta sala los tiene quien la creó" };
  const allowed = process.env.NEXO_ADMIN_KEY ? isAdminKey(adminKey) : process.env.NODE_ENV !== "production";
  if (!allowed) return { ok: false, status: 403, code: "HOST_ONLY", error: "Para controlar una sala de demo hace falta la clave de administración. Crea una sala nueva para presentar." };
  return { ok: true, credentials: { hostToken: record.hostToken, committeeKey: record.committeeKey } };
}

/**
 * Puesto del Comité de la sala, el que se toma escaneando el QR: el árbitro en
 * una sala entre organizaciones; el rol que entra por QR en una sala de una
 * organización. Los directivos internos de cada organización en una sala entre
 * organizaciones no lo necesitan.
 */
export function isCommitteeSeat(state: RoomState, actor: engine.ActorRef): boolean {
  if (state.scarcity) return engine.isArbiter(state, actor);
  const genome = engine.findGenome(state, actor.orgId);
  return !!genome && engine.committeeRoleOf(genome)?.id === actor.roleId;
}

/** Avisa cada vez que la sala cambia. Devuelve la función para dejar de escuchar. */
export function subscribe(roomId: string, listener: () => void): () => void {
  store.bus.on(channel(roomId), listener);
  return () => store.bus.off(channel(roomId), listener);
}

/**
 * Registra una conexión SSE abierta. Devuelve la función para cerrarla, o null
 * si la sala o el servidor ya están en su tope de conexiones. Una sala con
 * conexiones abiertas no se borra por inactividad.
 */
export function openConnection(roomId: string): (() => void) | null {
  const total = [...store.connections.values()].reduce((sum, count) => sum + count, 0);
  if (connectionsOf(roomId) >= MAX_CONNECTIONS_PER_ROOM || total >= MAX_CONNECTIONS_TOTAL) return null;
  store.connections.set(roomId, connectionsOf(roomId) + 1);
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    const left = connectionsOf(roomId) - 1;
    if (left > 0) store.connections.set(roomId, left);
    else store.connections.delete(roomId);
    // La inactividad se cuenta desde que se fue la última conexión.
    const record = store.rooms.get(roomId);
    if (record) touch(record);
  };
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
  const projected = engine.projectStateForOrgAndRole({ ...record.state, telemetry: liveTelemetry() }, viewer, now);
  return { ...projected, autopilot: autopilotView(record) };
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

type RejectStatus = 400 | 401 | 403 | 404 | 409;

function reject(status: RejectStatus, code: ActionErrorCode, error: string): ActionResponse {
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

function join(roomId: string, record: RoomRecord, actor: engine.ActorRef, token: string | undefined, committeeKey: string | undefined, now: number): ActionResponse {
  const key = tokenKey(actor);
  const current = record.tokens.get(key);
  if (current && tokenMatches(record, actor, token)) {
    // Reconexión de la misma persona (por ejemplo, recargó la página). El token ya prueba quién es.
    touchPresence(roomId, actor, now);
    return { status: 200, body: { ok: true, token: current, reconnected: true } };
  }
  // Al Comité solo se entra con la clave que va dentro de su QR.
  if (isCommitteeSeat(record.state, actor) && !sameSecret(committeeKey, record.committeeKey)) {
    record.state = engine.recordAuthFailure(record.state, actor, "JOIN_ROLE al Comité sin la clave del QR", now);
    emit(roomId);
    return reject(403, "COMMITTEE_KEY_REQUIRED", "Al Comité se entra escaneando el QR de la pantalla grande");
  }
  if (current) {
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
  touch(record);

  const parsed = ActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return reject(400, "BAD_REQUEST", `Acción inválida${where}: se espera { type, orgId, roleId, token, ...datos }`);
  }
  const action = parsed.data;
  const actor: engine.ActorRef = { orgId: action.orgId, roleId: action.roleId };
  if (!engine.isKnownActor(record.state, actor)) return reject(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);

  if (action.type === "JOIN_ROLE") return join(roomId, record, actor, action.token, action.committeeKey, now);

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

  // Una sola llamada al modelo a la vez por rol: repetir el botón no encola más trabajo.
  // Token vigente al pedir el turno: si al volver el modelo es otro, el rol cambió de manos.
  const tokenAtStart = record.tokens.get(tokenKey(actor));
  const busyKey = `agent:${tokenKey(actor)}`;
  if (record.busy.has(busyKey)) return reject(409, "BUSY", "El agente de este rol todavía está respondiendo");
  record.busy.add(busyKey);
  let turn: Awaited<ReturnType<typeof runRoleAgentTurn>>;
  try {
    turn = await runRoleAgentTurn(view, { instruction });
  } finally {
    record.busy.delete(busyKey);
  }

  // La llamada al modelo tarda: la sala pudo reiniciarse o el rol pudo cambiar de manos.
  if (store.rooms.get(roomId) !== record || record.tokens.get(tokenKey(actor)) !== tokenAtStart) {
    return reject(409, "ROLE_TAKEN", "La sala o el rol cambiaron mientras el agente respondía");
  }
  const result = engine.applyAgentProposal(
    record.state,
    actor,
    { suggestedValue: turn.suggestedValue, attemptedFieldRead: turn.attemptedFieldRead, attemptedFieldOrgId: turn.attemptedFieldOrgId, source: turn.source },
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

  // Mutar reinicia el caso y libera todos los roles: solo se permite antes de que
  // alguien entre, para que nadie pueda borrar una sesión en curso de otras personas.
  if (record.tokens.size > 0) return { status: 409, body: { error: "La sala ya tiene personas conectadas: crea una sala nueva para mutar", code: "ROOM_IN_USE" } };

  // Una sola mutación a la vez por sala.
  if (record.busy.has("mutate")) return { status: 409, body: { error: "Esta sala ya se está mutando", code: "BUSY" } };
  record.busy.add("mutate");
  touch(record);
  let mutation: Awaited<ReturnType<typeof mutateGenomeFromPrompt>>;
  try {
    mutation = await mutateGenomeFromPrompt(description);
  } finally {
    record.busy.delete("mutate");
  }
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

// --- Controles de anfitrión ----------------------------------------------------------

export type HostResponse<Extra = object> = { status: 200; body: { ok: true } & Extra } | { status: 400 | 403 | 404 | 409; body: ActionError };

/**
 * Libera un puesto y revoca su token: quien lo tenía deja de poder actuar y su
 * SSE pasa a la vista general en el siguiente mensaje. Sirve si alguien dejó el
 * teléfono con la sesión abierta o tomó un puesto que no era suyo.
 */
export function revokeSeat(roomId: string, seat: engine.ActorRef, now: number = Date.now()): HostResponse<{ revoked: boolean }> {
  const record = lookup(roomId);
  if (!record) return { status: 404, body: { error: "La sala no existe", code: "ROOM_NOT_FOUND" } };
  if (!engine.isKnownActor(record.state, seat)) return { status: 404, body: { error: `El rol ${seat.roleId} no existe en ${seat.orgId}`, code: "ROLE_NOT_FOUND" } };
  const revoked = record.tokens.delete(tokenKey(seat));
  const result = engine.markRoleLeft(record.state, seat, now, { revokedByHost: true });
  if (result.ok) record.state = result.state;
  touch(record);
  emit(roomId);
  return { status: 200, body: { ok: true, revoked } };
}

// --- Ensayo automático ------------------------------------------------------------------

function stopTimer(record: RoomRecord) {
  if (record.autopilot?.timer) clearTimeout(record.autopilot.timer);
  if (record.autopilot) {
    record.autopilot.timer = null;
    record.autopilot.running = false;
  }
}

function autopilotView(record: RoomRecord): AutopilotView | null {
  const run = record.autopilot;
  if (!run) return null;
  return { running: run.running, step: run.step, total: run.script.length, lastStep: run.lastStep, botSeats: run.botSeats.map(({ orgId, roleId }) => ({ orgId, roleId })) };
}

export type AutopilotRequest = { stepMs?: number; withCommittee?: boolean };

/**
 * Empieza el ensayo automático: un bot toma cada puesto del guion que no tenga
 * a una persona y los pasos corren uno tras otro, cada stepMs. Todas las
 * pantallas lo ven en vivo. Si una persona toma un puesto a mitad del ensayo, su
 * paso se salta. withCommittee por defecto es true si nadie tiene el puesto del Comité.
 */
export function startAutopilot(roomId: string, request: AutopilotRequest = {}): HostResponse<{ running: true; steps: number; stepMs: number; botSeats: engine.ActorRef[] }> {
  const record = lookup(roomId);
  if (!record) return { status: 404, body: { error: "La sala no existe", code: "ROOM_NOT_FOUND" } };
  if (record.autopilot?.running) return { status: 409, body: { error: "El ensayo automático ya está corriendo", code: "BUSY" } };
  if (record.state.decisionSealedAt !== null) return { status: 409, body: { error: "El caso ya se decidió: reinicia la sala para ensayar de nuevo", code: "DECISION_SEALED" } };

  const stepMs = request.stepMs ?? AUTOPILOT_DEFAULT_STEP_MS;
  const committeeSeat = record.state.scarcity
    ? { orgId: record.state.scarcity.arbiter.orgId, roleId: record.state.scarcity.arbiter.roleId }
    : (() => {
        const genome = record.state.orgGenomes[0];
        const role = genome ? engine.committeeRoleOf(genome) : undefined;
        return genome && role ? { orgId: genome.orgId, roleId: role.id } : null;
      })();
  const withCommittee = request.withCommittee ?? !(committeeSeat && record.tokens.has(tokenKey(committeeSeat)));
  const script = buildAutopilotScript(record.state, { withCommittee });
  if (script.length === 0) return { status: 409, body: { error: "Esta sala no tiene un guion que ensayar", code: "WRONG_MODE" } };

  const now = Date.now();
  const botSeats = scriptSeats(script).filter((seat) => !record.tokens.has(tokenKey(seat)));
  let state = engine.recordAutopilotEvent(record.state, { phase: "start", steps: script.length, stepMs, botSeats: botSeats.map(tokenKey), simulated: true }, now);
  for (const seat of botSeats) {
    const joined = engine.markRoleJoined(state, seat, now, { bot: true });
    if (joined.ok) state = joined.state;
  }
  record.state = state;
  record.autopilot = { running: true, script, step: 0, lastStep: null, botSeats, timer: null };
  touch(record);
  emit(roomId);
  scheduleNextStep(roomId, record, stepMs);
  return { status: 200, body: { ok: true, running: true, steps: script.length, stepMs, botSeats } };
}

function scheduleNextStep(roomId: string, record: RoomRecord, stepMs: number) {
  const run = record.autopilot;
  if (!run) return;
  run.timer = setTimeout(() => runNextStep(roomId, record, stepMs), stepMs);
  // El ensayo no debe impedir que el proceso termine (pruebas, apagado).
  run.timer.unref?.();
}

function runNextStep(roomId: string, record: RoomRecord, stepMs: number) {
  const run = record.autopilot;
  // La sala pudo reiniciarse o borrarse mientras esperaba.
  if (!run || !run.running || store.rooms.get(roomId) !== record) return;
  const step = run.script[run.step];
  const now = Date.now();
  if (!step) {
    run.running = false;
    run.timer = null;
    record.state = engine.recordAutopilotEvent(record.state, { phase: "end", steps: run.script.length }, now);
    emit(roomId);
    return;
  }
  run.step += 1;
  run.lastStep = step.description;
  let state = engine.refreshPresence(record.state, run.botSeats, now);
  const personHolds = record.tokens.has(tokenKey(step.seat));
  if (personHolds) {
    state = engine.recordAutopilotEvent(state, { phase: "step", step: run.step, description: step.description, outcome: "skipped", why: "lo hace la persona que tomó el puesto" }, now);
  } else {
    const result = step.run(state, now);
    if (result.state) state = result.state;
    const outcome = stepOutcome(step, result);
    state = engine.recordAutopilotEvent(state, { phase: "step", step: run.step, description: step.description, outcome: outcome.ok ? "ok" : "failed", ...(outcome.code ? { code: outcome.code } : {}) }, now);
  }
  record.state = state;
  touch(record);
  emit(roomId);
  scheduleNextStep(roomId, record, stepMs);
}

/** Detiene el ensayo automático. Lo ya hecho queda hecho; para volver a empezar, reiniciar la sala. */
export function stopAutopilot(roomId: string, now: number = Date.now()): HostResponse<{ running: false }> {
  const record = lookup(roomId);
  if (!record) return { status: 404, body: { error: "La sala no existe", code: "ROOM_NOT_FOUND" } };
  if (record.autopilot?.running) {
    stopTimer(record);
    record.state = engine.recordAutopilotEvent(record.state, { phase: "stopped", step: record.autopilot.step }, now);
    emit(roomId);
  }
  return { status: 200, body: { ok: true, running: false } };
}

// --- Sala nueva desde una frase -----------------------------------------------------------

/** Tiempo máximo para que el modelo escriba el genoma de una sala nueva. Después, semilla. */
export const NEW_ROOM_MUTATION_TIMEOUT_MS = 15_000;

export type MutatedRoom = {
  roomId: string;
  source: "llm" | "fallback_seed";
  latencyMs: number;
  orgId: string;
  orgName: string;
  /** Semilla usada cuando source es "fallback_seed". */
  seedId?: string;
};

/**
 * Crea una sala NUEVA de una organización a partir de una frase. El modelo
 * escribe el genoma y se valida con OrgGenomeSchema; si tarda más de 15 s, falla
 * o el genoma no valida, se usa la semilla más parecida y source lo dice. Como la
 * sala es nueva, nunca choca con una sesión en curso (ROOM_IN_USE).
 * Lanza RoomLimitError si no hay lugar para otra sala.
 */
export async function createMutatedRoom(description: string): Promise<MutatedRoom> {
  const mutation = await mutateGenomeFromPrompt(description, { timeoutMs: NEW_ROOM_MUTATION_TIMEOUT_MS });
  const checked = OrgGenomeSchema.safeParse(mutation.genome);
  const genome = checked.success ? checked.data : getSeedGenome();
  const source = checked.success ? mutation.source : "fallback_seed";
  const room = createRoom({ mode: "single_org", genome });
  const record = store.rooms.get(room.roomId)!;
  // Deja en la bitácora de dónde salió el genoma (modelo o semilla).
  const logged = engine.replaceRoomGenome(record.state, genome, source, Date.now());
  if (logged.ok) record.state = logged.state;
  return {
    roomId: room.roomId,
    source,
    latencyMs: mutation.latencyMs,
    orgId: genome.orgId,
    orgName: genome.orgName,
    ...(checked.success && source === "fallback_seed" && mutation.seedId ? { seedId: mutation.seedId } : {}),
  };
}
