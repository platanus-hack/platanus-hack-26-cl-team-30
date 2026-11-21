// Pruebas del núcleo multijugador (src/lib/rooms.ts).
//
// Qué se garantiza aquí: lo que un rol no puede ver no sale del servidor, y los
// intentos de leer o modificar un campo ajeno se rechazan y quedan en la bitácora.
//
// Identidad: cada rol obtiene un token secreto al hacer JOIN_ROLE y debe
// presentarlo en toda acción posterior. El helper `act` agrega el token vigente
// del rol para que las pruebas de permisos de campo no dependan de ese detalle;
// las pruebas de identidad lo pasan explícitamente.

import { describe, expect, it } from "vitest";
import {
  applyAction,
  createRoom,
  projectForRole,
  resolveViewer,
  type Action,
  type RoomState,
} from "../src/lib/rooms";

// Acción sin token: el helper `act` la completa con el token vigente del rol.
type UntokenedAction = Action extends infer A ? (A extends Action ? Omit<A, "token"> : never) : never;

// Valores únicos para buscarlos como texto en el JSON serializado.
const SECRET_A = "secreto-solo-A-91f3";
const SECRET_B = "secreto-solo-B-77c2";
const SHARED_AB = "compartido-A-B-5d10";
const PUBLIC = "publico-para-todos-0aa1";

function seededRoom(): RoomState {
  const room = createRoom({
    seed: {
    roles: [
      { id: "role_a", title: "Rol A" },
      { id: "role_b", title: "Rol B" },
      { id: "role_c", title: "Rol C" },
    ],
    fields: [
      { key: "publico", label: "Público", value: PUBLIC, ownerRoleId: "role_a", visibleToRoleIds: ["role_a", "role_b", "role_c"] },
      { key: "secreto_a", label: "Secreto de A", value: SECRET_A, ownerRoleId: "role_a", visibleToRoleIds: ["role_a"] },
      { key: "secreto_b", label: "Secreto de B", value: SECRET_B, ownerRoleId: "role_b", visibleToRoleIds: ["role_b"] },
      { key: "compartido_ab", label: "Compartido A y B", value: SHARED_AB, ownerRoleId: "role_b", visibleToRoleIds: ["role_a", "role_b"] },
    ],
    },
  });
  for (const role of room.roles) applyAction(room, { type: "JOIN_ROLE", roleId: role.id });
  return room;
}

/** Ejecuta una acción presentando el token vigente del rol (vacío si no tiene). */
function act(room: RoomState, action: UntokenedAction) {
  return applyAction(room, { ...action, token: room.tokens[action.roleId] ?? "" } as Action);
}

describe("projectForRole: los valores ocultos no salen del servidor", () => {
  it("el rol A no recibe el secreto de B, ni como valor ni en ninguna parte del JSON", () => {
    const room = seededRoom();
    const json = JSON.stringify(projectForRole(room, "role_a"));
    expect(json).not.toContain(SECRET_B);
    expect(json).toContain(SECRET_A);
    expect(json).toContain(SHARED_AB);
    expect(json).toContain(PUBLIC);
  });

  it("el rol C no recibe ningún dato reservado", () => {
    const room = seededRoom();
    const json = JSON.stringify(projectForRole(room, "role_c"));
    for (const secret of [SECRET_A, SECRET_B, SHARED_AB]) expect(json).not.toContain(secret);
    expect(json).toContain(PUBLIC);
  });

  it("los campos ocultos van marcados como redacted y sin la propiedad value", () => {
    const room = seededRoom();
    const projected = projectForRole(room, "role_c");
    const hidden = projected.fields.filter((field) => field.key !== "publico");
    expect(hidden).toHaveLength(3);
    for (const field of hidden) {
      expect(field.redacted).toBe(true);
      expect(field).not.toHaveProperty("value");
      expect(field).not.toHaveProperty("visibleToRoleIds");
    }
  });

  it("el rol que puede ver un campo recibe su valor", () => {
    const room = seededRoom();
    const projected = projectForRole(room, "role_a");
    const visible = projected.fields.find((field) => field.key === "secreto_a");
    expect(visible && !visible.redacted && visible.value).toBe(SECRET_A);
  });
});

describe("vista stage: solo lo que todos los roles pueden ver", () => {
  it("trae el campo público y oculta los reservados y los compartidos parciales", () => {
    const room = seededRoom();
    const projected = projectForRole(room, "stage");
    const json = JSON.stringify(projected);
    expect(json).toContain(PUBLIC);
    for (const secret of [SECRET_A, SECRET_B, SHARED_AB]) expect(json).not.toContain(secret);

    const visibleKeys = projected.fields.filter((field) => !field.redacted).map((field) => field.key);
    expect(visibleKeys).toEqual(["publico"]);
  });
});

describe("applyAction: permisos aplicados en el servidor", () => {
  it("READ_FIELD sobre un campo que el rol no ve devuelve 403 RBAC_DENIED y deja ACCESS_DENIED", () => {
    const room = seededRoom();
    const versionBefore = room.version;
    const result = act(room, { type: "READ_FIELD", roleId: "role_a", key: "secreto_b" });

    expect(result).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });
    expect(JSON.stringify(result)).not.toContain(SECRET_B);
    const last = room.audit.at(-1);
    expect(last).toMatchObject({ type: "ACCESS_DENIED", roleId: "role_a" });
    expect(room.version).toBe(versionBefore + 1);
  });

  it("READ_FIELD sobre un campo visible devuelve el valor", () => {
    const room = seededRoom();
    expect(act(room, { type: "READ_FIELD", roleId: "role_a", key: "compartido_ab" })).toEqual({ ok: true, value: SHARED_AB });
  });

  it("SET_FIELD sobre un campo ajeno devuelve 403 RBAC_DENIED, deja ACCESS_DENIED y no cambia el valor", () => {
    const room = seededRoom();
    // A puede VER compartido_ab, pero su dueño es B: ver no da derecho a modificar.
    const result = act(room, { type: "SET_FIELD", roleId: "role_a", key: "compartido_ab", value: "alterado" });

    expect(result).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });
    expect(room.fields.find((field) => field.key === "compartido_ab")?.value).toBe(SHARED_AB);
    expect(room.audit.at(-1)).toMatchObject({ type: "ACCESS_DENIED", roleId: "role_a" });
  });

  it("SET_FIELD del dueño cambia el valor, sube la versión y deja FIELD_UPDATED", () => {
    const room = seededRoom();
    const versionBefore = room.version;
    expect(act(room, { type: "SET_FIELD", roleId: "role_b", key: "secreto_b", value: "nuevo" })).toEqual({ ok: true });
    expect(room.fields.find((field) => field.key === "secreto_b")?.value).toBe("nuevo");
    expect(room.version).toBe(versionBefore + 1);
    expect(room.audit.at(-1)).toMatchObject({ type: "FIELD_UPDATED", roleId: "role_b" });
    // El cambio tampoco se filtra a quien no debe verlo.
    expect(JSON.stringify(projectForRole(room, "role_a"))).not.toContain("nuevo");
  });

  it("un rol inexistente devuelve 404 ROLE_NOT_FOUND en cualquier acción", () => {
    const room = seededRoom();
    const actions: UntokenedAction[] = [
      { type: "JOIN_ROLE", roleId: "intruso" },
      { type: "LEAVE_ROLE", roleId: "intruso" },
      { type: "READ_FIELD", roleId: "intruso", key: "publico" },
      { type: "SET_FIELD", roleId: "intruso", key: "publico", value: "x" },
    ];
    for (const action of actions) {
      expect(act(room, action)).toMatchObject({ ok: false, status: 404, code: "ROLE_NOT_FOUND" });
    }
  });

  it("un campo inexistente devuelve 404 FIELD_NOT_FOUND", () => {
    const room = seededRoom();
    expect(act(room, { type: "READ_FIELD", roleId: "role_a", key: "no_existe" })).toMatchObject({ ok: false, status: 404, code: "FIELD_NOT_FOUND" });
  });
});

describe("identidad: token por rol", () => {
  it("JOIN_ROLE entrega un token y un segundo JOIN sin token recibe 409 ROLE_TAKEN", () => {
    const room = createRoom();
    const first = applyAction(room, { type: "JOIN_ROLE", roleId: "role_a" });
    expect(first).toMatchObject({ ok: true, reconnected: false });
    expect(first.ok && typeof first.token === "string" && first.token.length > 20).toBe(true);

    const second = applyAction(room, { type: "JOIN_ROLE", roleId: "role_a" });
    expect(second).toMatchObject({ ok: false, status: 409, code: "ROLE_TAKEN" });
    expect(room.audit.at(-1)).toMatchObject({ type: "AUTH_FAILED", roleId: "role_a" });
  });

  it("JOIN_ROLE con el token vigente reconecta y devuelve el mismo token", () => {
    const room = createRoom();
    const first = applyAction(room, { type: "JOIN_ROLE", roleId: "role_a" });
    const token = first.ok ? first.token : undefined;
    expect(applyAction(room, { type: "JOIN_ROLE", roleId: "role_a", token })).toEqual({ ok: true, token, reconnected: true });
  });

  it("una acción sin token, con token inválido o con el token de otro rol devuelve 401 INVALID_TOKEN", () => {
    const room = seededRoom();
    const tokenB = room.tokens.role_b;
    for (const token of ["", "inventado", tokenB]) {
      const result = applyAction(room, { type: "READ_FIELD", roleId: "role_a", token, key: "publico" });
      expect(result).toMatchObject({ ok: false, status: 401, code: "INVALID_TOKEN" });
      expect(room.audit.at(-1)).toMatchObject({ type: "AUTH_FAILED", roleId: "role_a" });
    }
  });

  it("suplantar al dueño sin su token no permite modificar su campo", () => {
    const room = seededRoom();
    const result = applyAction(room, { type: "SET_FIELD", roleId: "role_b", token: room.tokens.role_a, key: "secreto_b", value: "x" });
    expect(result).toMatchObject({ ok: false, status: 401, code: "INVALID_TOKEN" });
    expect(room.fields.find((field) => field.key === "secreto_b")?.value).toBe(SECRET_B);
  });

  it("LEAVE_ROLE invalida el token y libera el rol", () => {
    const room = seededRoom();
    const token = room.tokens.role_a;
    expect(act(room, { type: "LEAVE_ROLE", roleId: "role_a" })).toEqual({ ok: true });
    expect(applyAction(room, { type: "READ_FIELD", roleId: "role_a", token, key: "publico" })).toMatchObject({ status: 401 });
    expect(applyAction(room, { type: "JOIN_ROLE", roleId: "role_a" })).toMatchObject({ ok: true, reconnected: false });
  });

  it("ningún token aparece en la proyección de ningún rol ni de stage", () => {
    const room = seededRoom();
    const tokens = Object.values(room.tokens);
    expect(tokens).toHaveLength(3);
    for (const viewer of ["role_a", "role_b", "role_c", "stage"]) {
      const json = JSON.stringify(projectForRole(room, viewer));
      for (const token of tokens) expect(json).not.toContain(token);
      expect(json).not.toContain('"tokens"');
    }
  });

  it("resolveViewer da el rol solo con su token; si no, la vista stage", () => {
    const room = seededRoom();
    expect(resolveViewer(room, "role_a", room.tokens.role_a)).toBe("role_a");
    expect(resolveViewer(room, "role_a", room.tokens.role_b)).toBe("stage");
    expect(resolveViewer(room, "role_a", null)).toBe("stage");
    expect(resolveViewer(room, "intruso", "x")).toBe("stage");
  });
});
