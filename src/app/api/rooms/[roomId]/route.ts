import { timingSafeEqual } from "node:crypto";
import { resetRoom } from "@/lib/store/rooms";

function sameKey(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// DELETE /api/rooms/:roomId
// Reinicia una sala para volver a ensayar: "demo" y "demo-cross" vuelven a su
// semilla; cualquier otra sala se borra. Los roles quedan libres y los tokens
// anteriores dejan de servir.
//
// Protección opcional: si el servidor define NEXO_ADMIN_KEY, la petición debe
// traer esa clave en el encabezado "x-admin-key" (si no, 401). Sin la variable,
// cualquiera que conozca el id de la sala puede reiniciarla (ver límites en
// docs/ARQUITECTURA.md).
export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const adminKey = process.env.NEXO_ADMIN_KEY;
  if (adminKey && !sameKey(request.headers.get("x-admin-key"), adminKey)) {
    return Response.json({ error: "Falta la clave de administración o no es válida", code: "INVALID_TOKEN" }, { status: 401 });
  }
  const { roomId } = await params;
  if (!resetRoom(roomId)) return Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
