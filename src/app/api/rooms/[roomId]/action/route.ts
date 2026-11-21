import { applyAction } from "@/lib/store/rooms";

// POST /api/rooms/:roomId/action  body { type, orgId, roleId, token, ...datos }
// Única puerta para cambiar una sala. La forma del body está en ActionSchema
// (src/lib/store/actions.ts). La identidad (token) se comprueba en el almacén y
// los permisos los decide el motor determinista, todo en el servidor.
// Respuestas: 200 { ok: true, ... } o { error, code } con 400, 401, 403, 404 o 409.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El body no es JSON válido", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { status, body: response } = await applyAction(roomId, body);
  return Response.json(response, { status });
}
