import { requireHost } from "@/lib/store/host";
import { rateLimited } from "@/lib/store/rate-limit";
import { canResetWithoutHost, resetRoom } from "@/lib/store/rooms";

// DELETE /api/rooms/:roomId  (encabezado x-host-token, o x-admin-key)
// Reinicia la sala: vuelve al caso con que se abrió, detiene el ensayo
// automático y revoca los tokens de todos los puestos. Conserva el id, el token
// de anfitrión y la clave del Comité. Solo el anfitrión (403 HOST_ONLY si no),
// salvo «Nueva ronda» en una sala de demo con el acta ya cerrada, que no pide
// token (canResetWithoutHost): así el siguiente grupo puede jugar en el deploy.
export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  if (!canResetWithoutHost(roomId)) {
    const denied = requireHost(request, roomId);
    if (denied) return denied;
  }
  resetRoom(roomId);
  return Response.json({ ok: true });
}
