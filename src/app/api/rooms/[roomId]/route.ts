import { resetRoom } from "@/lib/store/rooms";

// DELETE /api/rooms/:roomId
// Reinicia una sala para volver a ensayar: "demo" y "demo-cross" vuelven a su
// semilla; cualquier otra sala se borra. Los roles quedan libres y los tokens
// anteriores dejan de servir. Sin autenticación (ver límites en docs/ARQUITECTURA.md).
export async function DELETE(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!resetRoom(roomId)) return Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
