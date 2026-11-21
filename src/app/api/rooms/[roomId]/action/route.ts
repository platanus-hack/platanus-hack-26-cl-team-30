import { applyAction, resolveRoom, type Action } from "@/lib/rooms";

const TYPES = new Set(["JOIN_ROLE", "LEAVE_ROLE", "SET_FIELD", "READ_FIELD"]);

/** Valida la forma del body. Los permisos y el token los revisa applyAction. */
function parseAction(body: unknown): Action | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.type !== "string" || !TYPES.has(b.type) || typeof b.roleId !== "string") return null;
  if (b.token !== undefined && typeof b.token !== "string") return null;
  const token = (b.token as string | undefined) ?? "";

  switch (b.type) {
    case "JOIN_ROLE":
      return { type: "JOIN_ROLE", roleId: b.roleId, token: b.token as string | undefined };
    case "LEAVE_ROLE":
      return { type: "LEAVE_ROLE", roleId: b.roleId, token };
    case "SET_FIELD":
      if (typeof b.key !== "string" || (typeof b.value !== "string" && typeof b.value !== "number")) return null;
      return { type: "SET_FIELD", roleId: b.roleId, token, key: b.key, value: b.value };
    case "READ_FIELD":
      if (typeof b.key !== "string") return null;
      return { type: "READ_FIELD", roleId: b.roleId, token, key: b.key };
  }
  return null;
}

// POST /api/rooms/:roomId/action
// Única puerta para cambiar una sala. Identidad (token) y permisos se revisan aquí,
// en el servidor. La sala "demo" se recrea al vuelo si el servidor se reinició.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = resolveRoom(roomId);
  if (!room) return Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });

  let action: Action | null = null;
  try {
    action = parseAction(await request.json());
  } catch {
    // Body que no es JSON: se responde 400 abajo.
  }
  if (!action) {
    return Response.json(
      { error: "Se espera { type, roleId, token?, key?, value? }", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const result = applyAction(room, action);
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code }, { status: result.status });
  }
  return Response.json(result);
}
