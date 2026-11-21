import { ADMIN_KEY_HEADER } from "@/lib/store/host";
import { rateLimited } from "@/lib/store/rate-limit";
import { claimHost } from "@/lib/store/rooms";

// POST /api/rooms/:roomId/host  (encabezado x-admin-key si el servidor define NEXO_ADMIN_KEY)
//   -> { hostToken, committeeKey }
// Entrega los controles de una sala FIJA ("demo", "demo-cross", ...), que nadie
// creó. Con NEXO_ADMIN_KEY hay que presentarla; sin ella, solo fuera de
// producción. Las salas creadas con POST /api/rooms ya entregaron sus controles a
// quien las creó: aquí responden 403 HOST_ONLY.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  const result = claimHost(roomId, request.headers.get(ADMIN_KEY_HEADER));
  if (!result.ok) return Response.json({ error: result.error, code: result.code }, { status: result.status });
  return Response.json(result.credentials, { headers: { "Cache-Control": "no-store" } });
}
