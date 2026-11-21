import { mutateRoom } from "@/lib/store/rooms";

// POST /api/rooms/:roomId/mutate  body { description }  ->  { ok, source, latencyMs }
// Muta una sala single_org a partir de una frase. El modelo solo escribe el
// contenido del genoma, que se valida antes de usarse; si falla, se usa una
// semilla (source: "fallback_seed") y la respuesta sigue siendo 200.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  let description: unknown;
  try {
    description = ((await request.json()) as { description?: unknown } | null)?.description;
  } catch {
    return Response.json({ error: "El body no es JSON válido", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { status, body } = await mutateRoom(roomId, description);
  return Response.json(body, { status });
}
