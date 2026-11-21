import { applyAction, getRoom, type Action } from "@/lib/rooms";

const TYPES = new Set(["JOIN_ROLE", "LEAVE_ROLE", "SET_FIELD", "READ_FIELD"]);

// POST /api/rooms/:roomId/action
// Única puerta para cambiar una sala. Los permisos se revisan aquí, en el servidor.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) return Response.json({ error: "La sala no existe" }, { status: 404 });

  let action: Action;
  try {
    const body = await request.json();
    if (!TYPES.has(body?.type) || typeof body?.roleId !== "string") throw new Error();
    action = body;
  } catch {
    return Response.json({ error: "Se espera { type, roleId, ... }" }, { status: 400 });
  }

  const result = applyAction(room, action);
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code }, { status: result.status });
  }
  return Response.json(result);
}
