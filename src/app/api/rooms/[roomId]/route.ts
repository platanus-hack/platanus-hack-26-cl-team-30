import { requireHost } from "@/lib/store/host";
import { rateLimited } from "@/lib/store/rate-limit";
import { resetRoom } from "@/lib/store/rooms";

// DELETE /api/rooms/:roomId  (encabezado x-host-token, o x-admin-key)
// Reinicia la sala: vuelve al caso con que se abrió, detiene el ensayo
// automático y revoca los tokens de todos los puestos. Conserva el id, el token
// de anfitrión y la clave del Comité. Solo el anfitrión (403 HOST_ONLY si no).
export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  const denied = requireHost(request, roomId);
  if (denied) return denied;
  resetRoom(roomId);
  return Response.json({ ok: true });
}
