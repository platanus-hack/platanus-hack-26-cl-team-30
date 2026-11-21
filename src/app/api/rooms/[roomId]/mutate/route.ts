import { readJsonBody } from "@/lib/store/http";
import { mutateRoom } from "@/lib/store/rooms";

// POST /api/rooms/:roomId/mutate  body { description }  ->  { ok, source, latencyMs }
// Muta una sala single_org a partir de una frase. El modelo solo escribe el
// contenido del genoma, que se valida antes de usarse; si falla, se usa una
// semilla (source: "fallback_seed") y la respuesta sigue siendo 200.
// Una mutación a la vez por sala (409 BUSY si ya hay una en curso).
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  const body = await readJsonBody(request);
  if (!body.ok) return Response.json({ error: body.error, code: "BAD_REQUEST" }, { status: 400 });
  const description = (body.value as { description?: unknown } | null)?.description;

  const { status, body: response } = await mutateRoom(roomId, description);
  return Response.json(response, { status });
}
