// Núcleo multijugador: salas, roles, presencia y vista distinta por rol.
//
// El estado vive en memoria del proceso del servidor, por eso el deploy necesita
// un servidor siempre encendido (ver docs/DECISIONES.md).
//
// Regla central: lo que un rol no puede ver NO sale del servidor. La función
// projectForRole arma un paquete distinto para cada rol antes de enviarlo, así
// que el dato oculto nunca viaja por la red hacia quien no debe verlo.

import { EventEmitter } from "node:events";

export type RoleId = string;

/** Quien mira la sala: un rol, o "stage" para la pantalla grande de la demo. */
export type Viewer = RoleId | "stage";

export type Role = {
  id: RoleId;
  title: string;
};

export type Field = {
  key: string;
  label: string;
  value: string | number;
  ownerRoleId: RoleId;
  /** Roles que reciben el valor. Cualquier otro recibe el campo sin valor. */
  visibleToRoleIds: RoleId[];
};

export type AuditEvent = {
  at: string;
  type: "ROOM_CREATED" | "ROLE_JOINED" | "ROLE_LEFT" | "FIELD_UPDATED" | "ACCESS_DENIED";
  roleId: RoleId | null;
  detail: string;
};

export type RoomState = {
  id: string;
  roles: Role[];
  fields: Field[];
  /** Roles con una persona conectada ahora. */
  players: Record<RoleId, { joinedAt: string }>;
  audit: AuditEvent[];
  version: number;
};

export type ProjectedField =
  | (Field & { redacted: false })
  | { key: string; label: string; ownerRoleId: RoleId; redacted: true };

export type ProjectedRoom = {
  id: string;
  viewer: Viewer;
  roles: (Role & { connected: boolean })[];
  fields: ProjectedField[];
  audit: AuditEvent[];
  version: number;
};

export type Action =
  | { type: "JOIN_ROLE"; roleId: RoleId }
  | { type: "LEAVE_ROLE"; roleId: RoleId }
  | { type: "SET_FIELD"; roleId: RoleId; key: string; value: string | number }
  | { type: "READ_FIELD"; roleId: RoleId; key: string };

export type ActionResult =
  | { ok: true; value?: string | number }
  | { ok: false; status: 400 | 403 | 404; code: string; message: string };

// --- Almacén ----------------------------------------------------------------

type Store = { rooms: Map<string, RoomState>; bus: EventEmitter };

// Se guarda en globalThis para que la recarga en caliente de desarrollo no lo borre.
const globalStore = globalThis as unknown as { __roomStore?: Store };
const store: Store = (globalStore.__roomStore ??= { rooms: new Map(), bus: new EventEmitter() });
store.bus.setMaxListeners(0);

const MAX_AUDIT = 200;

function now() {
  return new Date().toISOString();
}

function log(room: RoomState, type: AuditEvent["type"], roleId: RoleId | null, detail: string) {
  room.audit.push({ at: now(), type, roleId, detail });
  if (room.audit.length > MAX_AUDIT) room.audit.splice(0, room.audit.length - MAX_AUDIT);
}

function changed(room: RoomState) {
  room.version += 1;
  store.bus.emit(room.id);
}

// Sala de ejemplo, neutra respecto de la idea final. Se reemplaza por el caso real.
function exampleSeed(): Pick<RoomState, "roles" | "fields"> {
  return {
    roles: [
      { id: "role_a", title: "Rol A" },
      { id: "role_b", title: "Rol B" },
      { id: "role_c", title: "Rol C" },
    ],
    fields: [
      { key: "estado", label: "Estado del caso", value: "abierto", ownerRoleId: "role_a", visibleToRoleIds: ["role_a", "role_b", "role_c"] },
      { key: "dato_a", label: "Dato reservado de A", value: 42, ownerRoleId: "role_a", visibleToRoleIds: ["role_a"] },
      { key: "dato_b", label: "Dato reservado de B", value: 7, ownerRoleId: "role_b", visibleToRoleIds: ["role_b"] },
      { key: "dato_ab", label: "Dato compartido entre A y B", value: "solo A y B", ownerRoleId: "role_b", visibleToRoleIds: ["role_a", "role_b"] },
    ],
  };
}

export function createRoom(seed?: Pick<RoomState, "roles" | "fields">): RoomState {
  const id = Math.random().toString(36).slice(2, 8);
  const base = seed ?? exampleSeed();
  const room: RoomState = { id, roles: base.roles, fields: base.fields, players: {}, audit: [], version: 0 };
  log(room, "ROOM_CREATED", null, `Sala ${id} creada con ${room.roles.length} roles`);
  store.rooms.set(id, room);
  return room;
}

export function getRoom(id: string): RoomState | undefined {
  return store.rooms.get(id);
}

/** Avisa cada vez que la sala cambia. Devuelve la función para dejar de escuchar. */
export function subscribe(id: string, listener: () => void): () => void {
  store.bus.on(id, listener);
  return () => store.bus.off(id, listener);
}

// --- Vista por rol ----------------------------------------------------------

function canSee(field: Field, viewer: Viewer, allRoleIds: RoleId[]): boolean {
  // La pantalla grande solo muestra lo que todos los roles pueden ver.
  if (viewer === "stage") return allRoleIds.every((id) => field.visibleToRoleIds.includes(id));
  return field.visibleToRoleIds.includes(viewer);
}

/** Arma el paquete que se le envía a un rol. Los valores ocultos se eliminan aquí. */
export function projectForRole(room: RoomState, viewer: Viewer): ProjectedRoom {
  const roleIds = room.roles.map((role) => role.id);
  return {
    id: room.id,
    viewer,
    roles: room.roles.map((role) => ({ ...role, connected: role.id in room.players })),
    fields: room.fields.map((field) =>
      canSee(field, viewer, roleIds)
        ? { ...field, redacted: false as const }
        : { key: field.key, label: field.label, ownerRoleId: field.ownerRoleId, redacted: true as const },
    ),
    audit: room.audit.slice(-30),
    version: room.version,
  };
}

// --- Acciones ---------------------------------------------------------------

/** Única puerta para cambiar una sala. Toda acción la dispara una persona con un rol. */
export function applyAction(room: RoomState, action: Action): ActionResult {
  const role = room.roles.find((candidate) => candidate.id === action.roleId);
  if (!role) return { ok: false, status: 404, code: "ROLE_NOT_FOUND", message: `El rol ${action.roleId} no existe en esta sala` };

  switch (action.type) {
    case "JOIN_ROLE": {
      room.players[role.id] = { joinedAt: now() };
      log(room, "ROLE_JOINED", role.id, `${role.title} entró a la sala`);
      changed(room);
      return { ok: true };
    }
    case "LEAVE_ROLE": {
      delete room.players[role.id];
      log(room, "ROLE_LEFT", role.id, `${role.title} salió de la sala`);
      changed(room);
      return { ok: true };
    }
    case "SET_FIELD": {
      const field = room.fields.find((candidate) => candidate.key === action.key);
      if (!field) return { ok: false, status: 404, code: "FIELD_NOT_FOUND", message: `El campo ${action.key} no existe` };
      if (field.ownerRoleId !== role.id) {
        log(room, "ACCESS_DENIED", role.id, `${role.title} intentó modificar "${field.label}", que pertenece a otro rol`);
        changed(room);
        return { ok: false, status: 403, code: "RBAC_DENIED", message: "Solo el rol dueño del campo puede modificarlo" };
      }
      field.value = action.value;
      log(room, "FIELD_UPDATED", role.id, `${role.title} actualizó "${field.label}"`);
      changed(room);
      return { ok: true };
    }
    case "READ_FIELD": {
      const field = room.fields.find((candidate) => candidate.key === action.key);
      if (!field) return { ok: false, status: 404, code: "FIELD_NOT_FOUND", message: `El campo ${action.key} no existe` };
      if (!field.visibleToRoleIds.includes(role.id)) {
        log(room, "ACCESS_DENIED", role.id, `${role.title} intentó leer "${field.label}" y fue rechazado`);
        changed(room);
        return { ok: false, status: 403, code: "RBAC_DENIED", message: "Este rol no tiene permiso para leer el campo" };
      }
      return { ok: true, value: field.value };
    }
  }
}
