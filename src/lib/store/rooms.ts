// Almacén de salas de Sculptor: estado en memoria del servidor, identidad por rol y
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
import { mutateGenomeFromPrompt, runRoleAgentTurn, writeNegotiationLine } from "../../agents";
import { AUTOPILOT_DEFAULT_STEP_MS, buildAutopilotScript, buildDemoBotScript, demoBotSeats, scriptSeats, stepOutcome, type AutopilotStep } from "../engine/autopilot";
import * as engine from "../engine/deterministic";
import * as negotiation from "../engine/negotiation";
import { OrgGenomeSchema, type AutopilotView, type NegotiationMessage, type OrgGenome, type ProjectedRoomState, type RoomMode, type RoomState, type Viewer } from "../genome/schema";
import { CROSS_ORG_SCENARIOS, DEFAULT_CROSS_ORG_SCENARIO, type CrossOrgScenarioId } from "../genome/scenarios";
import { getInitialCrossOrgRoom, getInitialSingleOrgRoom, getSeedGenome, initialTelemetry, type SeedGenomeId } from "../genome/seeds";
import { getTelemetry } from "../llm";
import { ActionSchema, RandomSeatRequestSchema, type ActionError, type ActionErrorCode, type ActionOk } from "./actions";

// --- Almacén ----------------------------------------------------------------

/** Con qué se abrió la sala: sirve para reiniciarla exactamente donde empezó. */
/** Con qué se abrió la sala. demo: sala de demo de 3 personas (solo entre organizaciones). */
type RoomOrigin = { mode: RoomMode; seed?: SeedGenomeId; genome?: OrgGenome; scenario?: CrossOrgScenarioId; demo?: boolean; turnTimeoutMs?: number; negotiation?: boolean; negotiationStepMs?: number };

/** Lo que el almacén lleva de una negociación en curso: temporizador, paso pendiente y texto en redacción. */
type NegotiationRun = {
  timer: ReturnType<typeof setTimeout> | null;
  /** Qué pasa cuando venza el temporizador. */
  tick: "positions" | "debate" | "proposal" | "decide" | null;
  /** En pausa: cuánto faltaba para el paso. */
  remainingMs: number | null;
  /** Mensaje que un agente está redactando para el debate. line queda null hasta que el modelo responde. */
  pending: { index: number; line: { text: string; fallback: boolean } | null } | null;
  /** Asientos que ya recibieron (o tienen en camino) su consejo. */
  advised: Set<string>;
};

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
  /** Sala de demo con el acta cerrada: reinicio automático tras DEMO_RESET_IDLE_MS sin actividad. */
  resetTimer?: ReturnType<typeof setTimeout> | null;
  /** Ronda de la sala: sube con cada reinicio. Lo usan los canales para olvidar datos de la ronda anterior. */
  round?: number;
  /** Negociación entre agentes en curso (salas de demo). */
  negotiationRun?: NegotiationRun;
  /** Sala de demo: turno actual (demoTurn().key) y su plan B. */
  turnKey?: string | null;
  turnTimer?: ReturnType<typeof setTimeout> | null;
};

type Store = {
  rooms: Map<string, RoomRecord>;
  bus: EventEmitter;
  /** Conexiones SSE abiertas por sala. Se llevan por id: sobreviven al reinicio de la sala. */
  connections: Map<string, number>;
  lastSweepAt: number;
  /** Códigos de sala ya entregados: no se reutilizan nunca mientras viva el proceso. */
  usedCodes?: Set<string>;
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
  // Las salas fijas entre organizaciones son salas de demo: 3 personas y bots en los roles administrativos.
  ...Object.fromEntries(Object.values(CROSS_ORG_SCENARIOS).map((info) => [info.fixedRoomId, { mode: "cross_org", scenario: info.id, demo: true } satisfies RoomOrigin])),
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
/** Sala de demo con el acta cerrada: se reinicia sola tras este tiempo sin actividad. */
export const DEMO_RESET_IDLE_MS = 2 * 60 * 1000;
/**
 * Plan B de la sala de demo: si la persona a la que le toca no actúa en este tiempo,
 * el piloto juega su turno. NEXO_DEMO_TURN_MS lo cambia; 0 lo apaga. En las salas
 * normales no existe.
 */
export const DEMO_TURN_TIMEOUT_MS = 20_000;
export const MAX_DEMO_TURN_TIMEOUT_MS = 120_000;

/** Negociación entre agentes: si el modelo tarda más que esto, se publica el texto de respaldo. */
export const NEGOTIATION_MODEL_TIMEOUT_MS = 6000;
/** Plazo para fijar posturas desde que entra la primera persona; después, un bot pone las que falten. */
export const NEGOTIATION_POSITIONS_MS = 60_000;
/** Con todas las posturas puestas, el debate empieza tras esta pausa corta. */
export const NEGOTIATION_POSITIONS_GRACE_MS = 2500;
function envMs(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, max) : fallback;
}
/** Pausa entre mensajes del debate: NEXO_NEGOTIATION_STEP_MS (por defecto 7 s, máximo 20 s). */
const negotiationStepMs = () => envMs("NEXO_NEGOTIATION_STEP_MS", negotiation.NEGOTIATION_DEFAULT_STEP_MS, 20_000);
const negotiationPositionsMs = () => envMs("NEXO_NEGOTIATION_POSITIONS_MS", NEGOTIATION_POSITIONS_MS, 300_000);
function demoTurnTimeoutMs(): number {
  const raw = process.env.NEXO_DEMO_TURN_MS;
  if (raw === undefined || raw.trim() === "") return DEMO_TURN_TIMEOUT_MS;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, MAX_DEMO_TURN_TIMEOUT_MS) : DEMO_TURN_TIMEOUT_MS;
}

/** Intervalo entre los pasos de los bots de una sala de demo. Cortos: no deben hacer esperar a nadie. */
export const DEMO_BOT_STEP_MS = 900;
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
      clearResetTimer(record);
      clearTurnTimer(record);
      clearNegotiation(record);
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

/** Letras y números que no se confunden al leerlos o dictarlos: sin 0/O ni 1/I. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

/**
 * Código de una sala nueva, que es también su id: 5 caracteres legibles. No se
 * reutiliza nunca: cada «Nueva demo» recibe un código que nadie usó antes.
 */
function newRoomId(): string {
  const used = (store.usedCodes ??= new Set());
  let id: string;
  do {
    const bytes = randomBytes(ROOM_CODE_LENGTH);
    id = Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
  } while (used.has(id) || store.rooms.has(id) || isFixedRoom(id));
  used.add(id);
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
  /** Sala de demo: 3 asientos humanos y bots en los roles administrativos. Solo en cross_org. */
  demo?: boolean;
  /** Plan B de la demo (ms). Por defecto NEXO_DEMO_TURN_MS o 20 s; 0 lo apaga. */
  turnTimeoutMs?: number;
  /** Sala de demo: negociación entre agentes con 5 asientos. Por defecto true; false deja la demo pauteada de 3. */
  negotiation?: boolean;
  /** Pausa entre mensajes de la negociación (ms). Por defecto NEXO_NEGOTIATION_STEP_MS o 7 s. */
  negotiationStepMs?: number;
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
  const opened = engine.openRoom(initial, now);
  // El reloj de espera arranca con la primera persona que entra (markRoleJoined).
  const demo = origin.mode === "cross_org" && origin.demo === true;
  const state: RoomState = { ...opened, clockStartedAt: null, ...(demo ? { demo: true, turnStartedAt: null, turnTimeoutMs: origin.turnTimeoutMs ?? demoTurnTimeoutMs() } : {}) };
  // Sala de demo: negociación entre agentes, salvo que se pida la demo pauteada simple.
  if (!demo || origin.negotiation === false) return state;
  return { ...state, negotiation: negotiation.initialNegotiation(state, origin.negotiationStepMs ?? negotiationStepMs()) };
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
    mode === "cross_org"
      ? { mode, scenario: input.scenario ?? DEFAULT_CROSS_ORG_SCENARIO, ...(input.demo
          ? {
              demo: true,
              ...(input.turnTimeoutMs !== undefined ? { turnTimeoutMs: input.turnTimeoutMs } : {}),
              ...(input.negotiation !== undefined ? { negotiation: input.negotiation } : {}),
              ...(input.negotiationStepMs !== undefined ? { negotiationStepMs: input.negotiationStepMs } : {}),
            }
          : {}),
      }
      : { mode, ...(input.genome ? { genome: structuredClone(input.genome) } : { seed: input.seed }) };
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
  createRoom({ id: roomId, mode: origin.mode, scenario: origin.scenario, demo: origin.demo });
  return store.rooms.get(roomId);
}

/**
 * Identificador de la ronda actual de una sala: cambia con cada reinicio (aunque
 * ocurra en el mismo milisegundo) y si la sala se borra y renace. undefined si no existe.
 */
export function roomRound(roomId: string): string | undefined {
  const record = store.rooms.get(roomId);
  return record ? `${record.round ?? 0}:${record.state.caseOpenedAt}` : undefined;
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
  clearResetTimer(record);
  clearTurnTimer(record);
  clearNegotiation(record);
  record.autopilot = null;
  record.tokens.clear();
  record.busy.clear();
  record.round = (record.round ?? 0) + 1;
  record.state = initialState(roomId, record.origin, now);
  touch(record);
  emit(roomId);
  return true;
}

/**
 * «Nueva ronda» sin anfitrión: en una sala de demo con el acta cerrada, cualquiera
 * puede reiniciarla, para que el siguiente grupo juegue aunque la pantalla grande
 * no tenga el token (sala fija en el deploy sin NEXO_ADMIN_KEY). Antes del acta,
 * o en una sala normal, sigue siendo solo del anfitrión.
 */
export function canResetWithoutHost(roomId: string): boolean {
  const state = lookup(roomId)?.state;
  return !!state && state.demo === true && state.decisionSealedAt !== null;
}

/** Borra una sala de la memoria. Una sala fija renace limpia la próxima vez que alguien entre. */
export function discardRoom(roomId: string): boolean {
  const record = store.rooms.get(roomId);
  if (!record) return false;
  stopTimer(record);
  clearResetTimer(record);
  clearTurnTimer(record);
  clearNegotiation(record);
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
  // La negociación se proyecta para quien mira: los consejos solo llegan a su rol.
  return { ...projected, roomCode: roomId, negotiation: negotiation.projectNegotiation(record.state, projected.viewer), autopilot: autopilotView(record) };
}

/** true mientras el contador de lo que está en juego sigue corriendo. */
export function isStakesRunning(roomId: string): boolean {
  const state = store.rooms.get(roomId)?.state;
  return !!state && state.decisionSealedAt === null;
}

/** Acta de la sala con la bitácora completa, en JSON y en Markdown. No contiene valores reservados. */
export function getActa(roomId: string, now: number = Date.now()): { acta: engine.AuditActa & { negotiation?: NegotiationMessage[] }; markdown: string } | undefined {
  const record = lookup(roomId);
  if (!record) return undefined;
  const acta = engine.buildAuditActa({ ...record.state, telemetry: liveTelemetry() }, now);
  const markdown = engine.renderActaMarkdown(acta);
  if (!record.state.negotiation) return { acta, markdown };
  // La negociación entre agentes va completa al acta (sin los consejos privados).
  const transcript = negotiation.publicTranscript(record.state);
  const lines = transcript.map((message) => `- ${new Date(message.ts).toISOString()} · ${message.agentLabel}${message.fallback ? " (texto de respaldo)" : ""}: ${message.text.replace(/\s+/g, " ")}`);
  const section = ["", "## Negociación entre agentes", "", "Los textos los redacta el modelo (o el respaldo); la propuesta y los puntajes los calcula el código.", "", ...(lines.length ? lines : ["Sin mensajes todavía."]), ""].join("\n");
  return { acta: { ...acta, negotiation: transcript }, markdown: markdown + section };
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
    syncNegotiationEnd(record);
    syncDemoTurn(roomId, record);
    emit(roomId);
  }
  scheduleDemoReset(roomId, record);
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
  const response = settle(roomId, record, engine.markRoleJoined(record.state, actor, now), { token: fresh, reconnected: false });
  if (response.status === 200) {
    startDemoBots(roomId, record, now);
    onNegotiationJoin(roomId, record, actor, now);
  }
  return response;
}

// --- Sorteo de silla ---------------------------------------------------------

/**
 * Sillas que entran al sorteo. El puesto del Comité (el árbitro entre
 * organizaciones, o el rol que entra por QR en una sola organización) solo
 * participa si quien pide presentó la clave de su QR: el sorteo no es un atajo
 * para tomarlo. Los directivos internos de cada organización en una sala entre
 * organizaciones no se sortean: no tienen turno en ese recorrido.
 */
function drawableSeats(state: RoomState, withCommittee: boolean): engine.ActorRef[] {
  const arbiter = state.scarcity?.arbiter;
  // Sala de demo: quien presenta cada caso y el Comité, este último SIN clave: en
  // el deploy la pantalla grande de una sala fija no tiene la clave del QR del
  // Comité (exige NEXO_ADMIN_KEY), y sin esto la demo quedaba trabada esperando
  // al Comité. Lo demás lo juegan bots. Riesgo y alternativa en docs/DECISIONES.md.
  // Son 3 asientos en la demo pauteada y 5 en la negociación entre agentes (engine.demoSeats).
  if (state.demo && state.scarcity && arbiter) return engine.demoSeats(state).map((entry) => entry.seat);
  const seats: engine.ActorRef[] = [];
  for (const genome of state.orgGenomes) {
    for (const role of genome.roles) {
      const actor = { orgId: genome.orgId, roleId: role.id };
      if (isCommitteeSeat(state, actor) ? withCommittee : !role.isQrOptional) seats.push(actor);
    }
  }
  if (arbiter && withCommittee && !seats.some((seat) => seat.orgId === arbiter.orgId && seat.roleId === arbiter.roleId)) {
    seats.push({ orgId: arbiter.orgId, roleId: arbiter.roleId });
  }
  return seats;
}

/** Una silla está libre si nadie tiene su token, o si quien lo tenía lleva un rato sin conexión (igual que en JOIN_ROLE). */
function isSeatFree(record: RoomRecord, seat: engine.ActorRef, now: number): boolean {
  if (!record.tokens.has(tokenKey(seat))) return true;
  const player = record.state.connectedPlayers.find((entry) => entry.orgId === seat.orgId && entry.roleId === seat.roleId);
  return !player || now - player.heartbeatMs >= engine.PRESENCE_TTL_MS;
}

/**
 * Sorteo de silla (POST /api/rooms/:id/seat): asigna al recién llegado una silla
 * libre al azar y le entrega su token, como JOIN_ROLE. Una silla, una persona:
 * nunca entrega una ocupada (sin sillas libres: 409 NO_FREE_SEAT). Con `current`
 * y su token vigente es «sortear otro rol»: toca una silla distinta y la
 * anterior queda libre. Lo que ve después cada quien lo sigue filtrando el motor
 * por organización y rol. `random` se inyecta en las pruebas.
 */
export function joinRandomSeat(roomId: string, rawBody: unknown, now: number = Date.now(), random: () => number = Math.random): ActionResponse {
  const record = lookup(roomId);
  if (!record) return reject(404, "ROOM_NOT_FOUND", "La sala no existe");
  touch(record);

  const parsed = RandomSeatRequestSchema.safeParse(rawBody ?? {});
  if (!parsed.success) return reject(400, "BAD_REQUEST", "Sorteo inválido: se espera { committeeKey?, current?: { orgId, roleId, token } }");
  const { committeeKey, current } = parsed.data;
  const holding = current && engine.isKnownActor(record.state, current) && tokenMatches(record, current, current.token) ? { orgId: current.orgId, roleId: current.roleId } : null;

  const pool = drawableSeats(record.state, sameSecret(committeeKey, record.committeeKey)).filter(
    (seat) => isSeatFree(record, seat, now) && !(holding && holding.orgId === seat.orgId && holding.roleId === seat.roleId),
  );
  if (pool.length === 0) return reject(409, "NO_FREE_SEAT", holding ? "No queda otra silla libre en esta sala" : "No quedan sillas libres en esta sala");

  // Sala de demo: por orden de llegada (primer caso, segundo caso, Comité), para que el
  // narrador sepa quién es quién. En las demás salas, al azar.
  const seat = record.state.demo ? pool[0] : pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  const joined = engine.markRoleJoined(record.state, seat, now, { assigned: "random" });
  if (!joined.ok) return settle(roomId, record, joined);
  const fresh = newToken();
  record.tokens.set(tokenKey(seat), fresh);
  let next = joined.state;
  if (holding) {
    record.tokens.delete(tokenKey(holding));
    const left = engine.markRoleLeft(next, holding, now, { rerolled: true });
    if (left.ok) next = left.state;
  }
  record.state = next;
  syncDemoTurn(roomId, record);
  emit(roomId);
  startDemoBots(roomId, record, now);
  onNegotiationJoin(roomId, record, seat, now);
  scheduleDemoReset(roomId, record);
  return { status: 200, body: { ok: true, token: fresh, reconnected: false, seat } };
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
    case "SET_POSITION": {
      const response = settle(roomId, record, negotiation.setPosition(record.state, actor, action.optionId, now));
      if (response.status === 200) onPositionSet(roomId, record, now);
      return response;
    }
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
  syncDemoTurn(roomId, record, now);
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

// --- Sala de demo ---------------------------------------------------------------------------

/**
 * Bots de una sala de demo. Al entrar la primera persona, el piloto automático
 * toma el asiento del aprobador (rol administrativo) de cada organización, sella
 * el límite y firma: las personas solo presentan sus casos y el Comité decide.
 * Los bots quedan marcados en el estado (botSeats, que se proyecta como role.bot)
 * y en la bitácora con { bot: true }. Corre una vez por ronda: tras un reinicio
 * vuelve a empezar con la próxima persona.
 */
function startDemoBots(roomId: string, record: RoomRecord, now: number) {
  if (!record.state.demo || record.autopilot || record.state.decisionSealedAt !== null) return;
  // En la negociación entre agentes las administraciones son asientos de personas (o de un bot de postura).
  if (record.state.negotiation) return;
  const botSeats = demoBotSeats(record.state).filter((seat) => !record.tokens.has(tokenKey(seat)));
  if (botSeats.length === 0) return;
  const script = buildDemoBotScript(record.state).filter((step) => botSeats.some((seat) => seat.orgId === step.seat.orgId && seat.roleId === step.seat.roleId));
  let state = engine.recordAutopilotEvent(record.state, { phase: "start", demo: true, steps: script.length, stepMs: DEMO_BOT_STEP_MS, botSeats: botSeats.map(tokenKey), simulated: true }, now);
  for (const seat of botSeats) {
    const joined = engine.markRoleJoined(state, seat, now, { bot: true });
    if (joined.ok) state = joined.state;
  }
  record.state = state;
  record.autopilot = { running: true, script, step: 0, lastStep: null, botSeats, timer: null };
  emit(roomId);
  scheduleNextStep(roomId, record, DEMO_BOT_STEP_MS);
}

function clearTurnTimer(record: RoomRecord) {
  if (record.turnTimer) clearTimeout(record.turnTimer);
  record.turnTimer = null;
  record.turnKey = null;
}

/**
 * Turno de la sala de demo. Cuando cambia (alguien presentó, el Comité vetó, entró
 * la primera persona), anota cuándo empezó y programa el plan B: si a los
 * turnTimeoutMs la misma persona no actuó, el piloto juega por ella. Se llama
 * después de cada cambio de estado, antes de avisar a las pantallas.
 */
function syncDemoTurn(roomId: string, record: RoomRecord, now: number = Date.now()) {
  if (!record.state.demo) return;
  // Con la negociación en pausa, el plan B también espera.
  if (record.state.negotiation?.paused) return;
  const turn = engine.demoTurn(record.state);
  const key = turn?.key ?? null;
  if (key === (record.turnKey ?? null)) return;
  if (record.turnTimer) clearTimeout(record.turnTimer);
  record.turnTimer = null;
  record.turnKey = key;
  record.state = { ...record.state, turnStartedAt: turn ? now : null };
  const timeout = record.state.turnTimeoutMs ?? 0;
  if (!turn || timeout <= 0) return;
  record.turnTimer = setTimeout(() => playTurnAutomatically(roomId, record, key!), timeout);
  record.turnTimer.unref?.();
}

/** Plan B: el piloto juega el turno de quien no actuó a tiempo. Queda en el acta con modo «automático». */
function playTurnAutomatically(roomId: string, record: RoomRecord, key: string) {
  record.turnTimer = null;
  if (store.rooms.get(roomId) !== record || record.turnKey !== key) return;
  const turn = engine.demoTurn(record.state);
  if (!turn || turn.key !== key) return;
  const now = Date.now();
  const seconds = Math.round((record.state.turnTimeoutMs ?? 0) / 1000);
  const detail = { modo: "automático", motivo: `${turn.label} no actuó en ${seconds} s` };
  const result =
    turn.action === "submit"
      ? engine.submitCandidate(record.state, turn.seat, turn.caseId ?? undefined, now, detail)
      : engine.sealAllocation(record.state, turn.seat, `Automático (plan B): el Comité no respondió en ${seconds} s; se acepta la propuesta de la regla.`, now, detail, true);
  let state = result.state ?? record.state;
  state = engine.recordAutopilotEvent(state, { phase: "turn", automatic: true, seat: tokenKey(turn.seat), action: turn.action, outcome: result.ok ? "ok" : "failed", ...(result.ok ? {} : { code: result.code }) }, now);
  record.state = state;
  touch(record);
  record.turnKey = key;
  syncNegotiationEnd(record, now);
  syncDemoTurn(roomId, record, now);
  emit(roomId);
  scheduleDemoReset(roomId, record);
}

// --- Negociación entre agentes ---------------------------------------------------------
//
// El almacén pone los tiempos y pide los textos; las reglas están en
// src/lib/engine/negotiation.ts y el texto lo redacta src/agents/negotiation-agent.ts.
// Fases: posturas (cada persona fija la suya con un toque; al vencer el plazo un
// bot pone las que falten) → debate (un mensaje por agente, cada stepMs) →
// propuesta (la calcula el motor) → decisión del Comité → acta.

function clearNegotiation(record: RoomRecord) {
  if (record.negotiationRun?.timer) clearTimeout(record.negotiationRun.timer);
  record.negotiationRun = undefined;
}

function negotiationRunOf(record: RoomRecord): NegotiationRun {
  return (record.negotiationRun ??= { timer: null, tick: null, remainingMs: null, pending: null, advised: new Set() });
}

/**
 * Pide una frase al agente de un asiento y la deja lista para publicar. Nunca
 * lanza ni tarda más de NEGOTIATION_MODEL_TIMEOUT_MS: si el modelo falla, tarda o
 * escribe un dato reservado, devuelve el texto de respaldo de ese rol y fase.
 * El filtro corre aquí, sobre lo que haya devuelto el agente: los mensajes
 * públicos no pueden traer ningún valor reservado de la sala; el consejo privado,
 * ninguno que su rol no vea.
 */
async function writeNegotiationText(roomId: string, record: RoomRecord, seat: engine.ActorRef, kind: "advice" | "argument"): Promise<{ text: string; fallback: boolean }> {
  const fallback = { text: negotiation.fallbackLine(record.state, seat, kind), fallback: true };
  const brief = negotiation.seatBrief(record.state, seat);
  const view = projectRoom(roomId, seat);
  if (!brief || !view) return fallback;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), NEGOTIATION_MODEL_TIMEOUT_MS);
      timer.unref?.();
    });
    const transcript = negotiation.publicTranscript(record.state).map((message) => ({ agentLabel: message.agentLabel, text: message.text }));
    const written = await Promise.race([
      Promise.resolve().then(() => writeNegotiationLine({ view, kind, seatLabel: brief.seatLabel, resource: brief.resource, role: brief.role, position: brief.position, options: brief.options, transcript, signal: controller.signal })),
      timeout,
    ]);
    if (!written || typeof written.text !== "string") {
      controller.abort();
      return fallback;
    }
    const text = negotiation.fitText(written.text, kind === "argument" ? negotiation.NEGOTIATION_ARGUMENT_MAX_CHARS : negotiation.NEGOTIATION_MAX_CHARS);
    const reserved = negotiation.reservedValues(record.state, kind === "advice" ? seat : undefined);
    if (!text || negotiation.containsReserved(text, reserved)) return fallback;
    return { text, fallback: false };
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function scheduleNegotiation(roomId: string, record: RoomRecord, tick: NonNullable<NegotiationRun["tick"]>, delayMs: number, now: number) {
  const run = negotiationRunOf(record);
  if (run.timer) clearTimeout(run.timer);
  run.tick = tick;
  run.remainingMs = null;
  record.state = negotiation.patchNegotiation(record.state, { nextAt: now + delayMs });
  run.timer = setTimeout(() => runNegotiationTick(roomId, record), delayMs);
  run.timer.unref?.();
}

function runNegotiationTick(roomId: string, record: RoomRecord, now: number = Date.now()) {
  const run = record.negotiationRun;
  if (!run || store.rooms.get(roomId) !== record || !record.state.negotiation) return;
  if (run.timer) clearTimeout(run.timer);
  run.timer = null;
  const tick = run.tick;
  run.tick = null;
  if (tick === "positions") endPositions(roomId, record, now);
  else if (tick === "debate") debateTick(roomId, record, now);
  else if (tick === "proposal") proposalTick(roomId, record, now);
  else if (tick === "decide") decideTick(roomId, record, now);
  touch(record);
  emit(roomId);
}

/** Alguien tomó un asiento: su agente le escribe el consejo, y con la primera persona empieza el plazo de posturas. */
function onNegotiationJoin(roomId: string, record: RoomRecord, seat: engine.ActorRef, now: number) {
  const current = record.state.negotiation;
  if (!current || current.phase !== "positions") return;
  const run = negotiationRunOf(record);
  const key = tokenKey(seat);
  const entry = engine.demoSeats(record.state).find((item) => tokenKey(item.seat) === key);
  if (entry && !run.advised.has(key)) {
    run.advised.add(key);
    const publish = (line: { text: string; fallback: boolean }) => {
      // La sala pudo reiniciarse mientras el agente escribía.
      if (store.rooms.get(roomId) !== record || record.negotiationRun !== run || !record.state.negotiation) return;
      record.state = negotiation.addNegotiationMessage(record.state, { ...seat, agentLabel: negotiation.agentLabelOf(entry), text: line.text, kind: "advice", ...(line.fallback ? { fallback: true } : {}) }, Date.now());
      emit(roomId);
    };
    // El Comité no negocia: su consejo es fijo. Los demás lo redacta su agente.
    if (entry.action === "decide") publish({ text: negotiation.fallbackLine(record.state, seat, "advice"), fallback: false });
    else void writeNegotiationText(roomId, record, seat, "advice").then(publish);
  }
  if (!run.tick && !current.paused) {
    scheduleNegotiation(roomId, record, "positions", negotiationPositionsMs(), now);
    emit(roomId);
  }
}

/** Con todas las posturas puestas no hace falta esperar el plazo: el debate empieza tras una pausa corta. */
function onPositionSet(roomId: string, record: RoomRecord, now: number) {
  const current = record.state.negotiation;
  if (!current || current.phase !== "positions" || current.paused || !negotiation.allPositionsSet(record.state)) return;
  scheduleNegotiation(roomId, record, "positions", Math.min(NEGOTIATION_POSITIONS_GRACE_MS, current.stepMs), now);
  emit(roomId);
}

/** Cierra las posturas: un bot pone las que falten (marcadas como automáticas) y empieza el debate. */
function endPositions(roomId: string, record: RoomRecord, now: number) {
  let state = record.state;
  for (const position of state.negotiation?.positions ?? []) {
    if (position.optionId !== null) continue;
    const seat = { orgId: position.orgId, roleId: position.roleId };
    // Asiento sin persona: lo ocupa un bot, a la vista.
    if (!record.tokens.has(tokenKey(seat))) {
      const joined = engine.markRoleJoined(state, seat, now, { bot: true });
      if (joined.ok) state = joined.state;
    }
    const option = negotiation.positionOptions(state, seat)[0];
    const result = option ? negotiation.setPosition(state, seat, option.id, now, true) : null;
    if (result?.ok) state = result.state;
  }
  record.state = negotiation.patchNegotiation(state, { phase: "debate", debateIndex: 0 });
  startSpeaker(roomId, record, 0, now);
}

/** El agente del asiento `index` empieza a escribir; su mensaje se publica en el próximo paso. */
function startSpeaker(roomId: string, record: RoomRecord, index: number, now: number) {
  const entry = negotiation.negotiatingSeats(record.state)[index];
  const run = negotiationRunOf(record);
  if (!entry) return;
  const pending: NonNullable<NegotiationRun["pending"]> = { index, line: null };
  run.pending = pending;
  record.state = negotiation.patchNegotiation(record.state, { typing: { ...entry.seat, agentLabel: negotiation.agentLabelOf(entry) } });
  void writeNegotiationText(roomId, record, entry.seat, "argument").then((line) => {
    pending.line = line;
  });
  scheduleNegotiation(roomId, record, "debate", record.state.negotiation?.stepMs ?? 0, now);
}

/** Publica el mensaje del agente que estaba escribiendo (o su respaldo, si no llegó a tiempo) y pasa al siguiente. */
function debateTick(roomId: string, record: RoomRecord, now: number) {
  const current = record.state.negotiation;
  const run = negotiationRunOf(record);
  if (!current) return;
  const seats = negotiation.negotiatingSeats(record.state);
  const index = current.debateIndex;
  const entry = seats[index];
  if (entry) {
    const line = run.pending?.index === index && run.pending.line ? run.pending.line : { text: negotiation.fallbackLine(record.state, entry.seat, "argument"), fallback: true };
    record.state = negotiation.addNegotiationMessage(record.state, { ...entry.seat, agentLabel: negotiation.agentLabelOf(entry), text: line.text, kind: "argument", ...(line.fallback ? { fallback: true } : {}) }, now);
  }
  run.pending = null;
  record.state = negotiation.patchNegotiation(record.state, { debateIndex: index + 1 });
  if (index + 1 < seats.length) {
    startSpeaker(roomId, record, index + 1, now);
    return;
  }
  record.state = negotiation.patchNegotiation(record.state, { phase: "proposal", typing: { orgId: RULE_SPEAKER, roleId: RULE_SPEAKER, agentLabel: RULE_LABEL } });
  scheduleNegotiation(roomId, record, "proposal", current.stepMs, now);
}

/** Quien «habla» cuando el mensaje lo arma el código y no un agente. */
const RULE_SPEAKER = "regla";
const RULE_LABEL = "Regla de asignación (código)";

/**
 * La propuesta, en dos momentos. Primero «la regla está calculando» (typing con
 * la regla, sin mensaje). Aquí, el segundo: los casos entran a la regla, el
 * motor los ordena y el código arma el texto con ese resultado (ningún modelo
 * participa). La fase sigue en «proposal» un paso más, para que la pantalla
 * muestre la propuesta; después decide el Comité.
 */
function proposalTick(roomId: string, record: RoomRecord, now: number) {
  let state = record.state;
  for (const candidate of state.scarcity?.candidates ?? []) {
    if (candidate.submitted === true) continue;
    const seat = { orgId: candidate.orgId, roleId: candidate.proposerRoleId };
    const automatic = state.negotiation?.positions.find((item) => item.orgId === seat.orgId && item.roleId === seat.roleId)?.automatic === true;
    const result = engine.submitCandidate(state, seat, candidate.caseId, now, automatic ? { modo: "automático", motivo: "asiento sin persona" } : { via: "negociación" });
    if (result.state) state = result.state;
  }
  state = negotiation.addNegotiationMessage(state, { orgId: RULE_SPEAKER, roleId: RULE_SPEAKER, agentLabel: RULE_LABEL, text: negotiation.proposalLine(state), kind: "proposal" }, now);
  record.state = negotiation.patchNegotiation(state, { typing: null });
  scheduleNegotiation(roomId, record, "decide", state.negotiation?.stepMs ?? 0, now);
}

/** Le toca al Comité: aceptar o rechazar la propuesta (con el plan B, si está encendido). */
function decideTick(roomId: string, record: RoomRecord, now: number) {
  record.state = negotiation.patchNegotiation(record.state, { phase: "decision", typing: null, nextAt: null });
  syncDemoTurn(roomId, record, now);
}

/** La decisión quedó sellada: la negociación termina y lo dice en un mensaje. */
function syncNegotiationEnd(record: RoomRecord, now: number = Date.now()) {
  const current = record.state.negotiation;
  if (!current || current.phase === "done" || record.state.decisionSealedAt === null) return;
  if (record.negotiationRun?.timer) clearTimeout(record.negotiationRun.timer);
  if (record.negotiationRun) {
    record.negotiationRun.timer = null;
    record.negotiationRun.tick = null;
  }
  const resolution = engine.resolveRoomAllocation(record.state);
  const winner = resolution?.ranking.find((entry) => entry.caseId === resolution.winnerCaseId);
  const decision = record.state.decisions.findLast((entry) => entry.scope === "allocation");
  const who = decision?.automatic ? "Decisión automática (plan B)" : decision?.decision === "VETO" ? "El Comité rechazó la propuesta" : "El Comité aceptó la propuesta";
  const text = winner ? `${who}: ${negotiation.resourceWord(record.state)} es para ${winner.patientLabel} (${engine.findGenome(record.state, winner.orgId)?.orgName ?? winner.orgId}).` : `${who}.`;
  const state = negotiation.addNegotiationMessage(record.state, { orgId: RULE_SPEAKER, roleId: RULE_SPEAKER, agentLabel: "Acta", text, kind: "system" }, now);
  record.state = negotiation.patchNegotiation(state, { phase: "done", typing: null, nextAt: null, paused: false });
}

/**
 * Controles del narrador (anfitrión): pausar, reanudar o adelantar la negociación.
 * Adelantar ejecuta ya el paso que estaba esperando; si el agente todavía no
 * terminó de escribir, se publica su texto de respaldo.
 */
export function controlNegotiation(roomId: string, action: "pause" | "resume" | "advance", now: number = Date.now()): HostResponse<{ phase: string; paused: boolean }> {
  const record = lookup(roomId);
  if (!record) return { status: 404, body: { error: "La sala no existe", code: "ROOM_NOT_FOUND" } };
  const current = record.state.negotiation;
  if (!current) return { status: 409, body: { error: "Esta sala no tiene negociación entre agentes", code: "WRONG_MODE" } };
  const run = negotiationRunOf(record);
  touch(record);

  if (action === "pause" && !current.paused && current.phase !== "done") {
    run.remainingMs = current.nextAt !== null ? Math.max(0, current.nextAt - now) : null;
    if (run.timer) clearTimeout(run.timer);
    run.timer = null;
    record.state = negotiation.patchNegotiation(record.state, { paused: true, nextAt: null });
    clearTurnTimer(record);
  } else if (action === "resume" && current.paused) {
    record.state = negotiation.patchNegotiation(record.state, { paused: false });
    if (run.tick) scheduleNegotiation(roomId, record, run.tick, run.remainingMs ?? current.stepMs, now);
    syncDemoTurn(roomId, record, now);
  } else if (action === "advance" && (current.phase === "positions" || current.phase === "debate" || current.phase === "proposal")) {
    if (current.paused) record.state = negotiation.patchNegotiation(record.state, { paused: false });
    // Sin nadie adentro todavía no hay paso programado: adelantar cierra las posturas.
    if (!run.tick) run.tick = "positions";
    runNegotiationTick(roomId, record, now);
  }
  emit(roomId);
  const after = record.state.negotiation!;
  return { status: 200, body: { ok: true, phase: after.phase, paused: after.paused } };
}

/**
 * true mientras la sala de demo está en el paso «Unirse»: negociación en
 * posturas, nadie dio la suya todavía y el acta abierta. Es la única ventana en
 * que «Iniciar» se acepta sin clave de anfitrión.
 */
export function isJoining(state: RoomState): boolean {
  const current = state.negotiation;
  return state.demo === true && !!current && current.phase === "positions" && state.decisionSealedAt === null && current.positions.every((entry) => entry.optionId === null);
}

export type StartDemoResponse = { status: 200; body: { ok: true; phase: string; bots: engine.ActorRef[] } } | { status: 404 | 409; body: ActionError };

/**
 * «Iniciar» del narrador (POST /api/rooms/:id/start): los asientos de la demo que
 * no tienen persona los toma un bot del piloto automático, que fija su postura al
 * tiro (marcada como automática), y la negociación arranca sin esperar a nadie
 * más. Con los 5 asientos ocupados solo arranca el plazo de posturas. Solo vale
 * en el paso «Unirse» (isJoining): no puede adelantar ni reiniciar una ronda en curso.
 * Los bots quedan en botSeats (role.bot en la proyección) y en la bitácora con
 * { bot: true } y un AUTOPILOT { via: "iniciar", automatic: true }.
 */
export function startDemo(roomId: string, now: number = Date.now()): StartDemoResponse {
  const record = lookup(roomId);
  if (!record) return { status: 404, body: { error: "La sala no existe", code: "ROOM_NOT_FOUND" } };
  if (!record.state.demo || !record.state.negotiation) return { status: 409, body: { error: "«Iniciar» es solo para la demo con negociación entre agentes", code: "WRONG_MODE" } };
  if (!isJoining(record.state)) return { status: 409, body: { error: "La ronda ya empezó: «Iniciar» solo sirve mientras la gente se une", code: "ROUND_STARTED" } };
  touch(record);

  const bots = engine.demoSeats(record.state).map((entry) => entry.seat).filter((seat) => !record.tokens.has(tokenKey(seat)));
  let state = engine.recordAutopilotEvent(record.state, { phase: "start", via: "iniciar", demo: true, automatic: true, simulated: true, botSeats: bots.map(tokenKey) }, now);
  for (const seat of bots) {
    const joined = engine.markRoleJoined(state, seat, now, { bot: true, via: "iniciar" });
    if (joined.ok) state = joined.state;
    // El bot fija su postura al tiro: la primera opción, marcada como automática. El Comité no fija postura.
    const option = negotiation.positionOptions(state, seat)[0];
    const positioned = option ? negotiation.setPosition(state, seat, option.id, now, true) : null;
    if (positioned?.ok) state = positioned.state;
  }
  if (state.negotiation?.paused) state = negotiation.patchNegotiation(state, { paused: false });
  record.state = state;

  const run = negotiationRunOf(record);
  if (negotiation.allPositionsSet(record.state)) {
    // Todas las posturas puestas (solo bots): el debate empieza tras la pausa corta.
    scheduleNegotiation(roomId, record, "positions", Math.min(NEGOTIATION_POSITIONS_GRACE_MS, record.state.negotiation!.stepMs), now);
  } else if (!run.timer) {
    // Personas que aún eligen y ningún plazo corriendo (nadie había entrado, o estaba en pausa): corre el plazo de posturas.
    scheduleNegotiation(roomId, record, "positions", run.remainingMs ?? negotiationPositionsMs(), now);
  }
  syncDemoTurn(roomId, record, now);
  emit(roomId);
  return { status: 200, body: { ok: true, phase: record.state.negotiation!.phase, bots } };
}

function clearResetTimer(record: RoomRecord) {
  if (record.resetTimer) clearTimeout(record.resetTimer);
  record.resetTimer = null;
}

/**
 * Sala de demo con el acta cerrada: se reinicia sola tras DEMO_RESET_IDLE_MS sin
 * actividad, para que la próxima ronda empiece limpia aunque nadie apriete
 * «Nueva ronda». Cada acción vuelve a empezar la cuenta. Las conexiones abiertas
 * (pantalla grande, teléfonos) no cuentan como actividad.
 */
function scheduleDemoReset(roomId: string, record: RoomRecord, delayMs = DEMO_RESET_IDLE_MS) {
  clearResetTimer(record);
  if (!record.state.demo || record.state.decisionSealedAt === null) return;
  record.resetTimer = setTimeout(() => {
    record.resetTimer = null;
    if (store.rooms.get(roomId) !== record || !record.state.demo || record.state.decisionSealedAt === null) return;
    const idle = Date.now() - record.lastActiveAt;
    if (idle >= DEMO_RESET_IDLE_MS) resetRoom(roomId);
    else scheduleDemoReset(roomId, record, DEMO_RESET_IDLE_MS - idle);
  }, delayMs);
  record.resetTimer.unref?.();
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
