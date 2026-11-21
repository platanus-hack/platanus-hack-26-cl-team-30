import { requireHost } from "@/lib/store/host";
import { readJsonBody } from "@/lib/store/http";
import { globallyLimited, rateLimited } from "@/lib/store/rate-limit";
import { mutateRoom } from "@/lib/store/rooms";

// POST /api/rooms/:roomId/mutate  body { description }  (encabezado x-host-token)
//   -> { ok, source, latencyMs }
// Muta una sala single_org que todavía no tiene a nadie adentro. El modelo solo
// escribe el contenido del genoma, que se valida antes de usarse; si falla, se usa
// una semilla (source: "fallback_seed") y la respuesta sigue siendo 200.
// Solo el anfitrión (403 HOST_ONLY). Una mutación a la vez por sala (409 BUSY).
// Para empezar de una frase sin chocar con nadie, mejor POST /api/rooms con
// { mode: "single_org", description }, que crea una sala nueva ya mutada.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "mutate");
  if (limited) return limited;
  const { roomId } = await params;
  const denied = requireHost(request, roomId);
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body.ok) return Response.json({ error: body.error, code: "BAD_REQUEST" }, { status: 400 });
  const description = (body.value as { description?: unknown } | null)?.description;

  const busy = globallyLimited("mutate");
  if (busy) return busy;
  const { status, body: response } = await mutateRoom(roomId, description);
  return Response.json(response, { status });
}
