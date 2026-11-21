import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";
import { joinRandomSeat } from "@/lib/store/rooms";

// POST /api/rooms/:roomId/seat  body { committeeKey?, current?: { orgId, roleId, token } }
//   -> 200 { ok: true, seat: { orgId, roleId }, token }
// Sorteo de silla: para entrar con un solo código QR, sin elegir rol. El
// servidor asigna al azar una silla libre y entrega su token, igual que
// JOIN_ROLE; desde ahí todo sigue por /action con ese token.
// - Sin committeeKey el puesto del Comité no entra al sorteo.
// - Con `current` (la silla que ya se tiene y su token) es «sortear otro rol».
// Respuestas de error: { error, code } con 400, 404, 409 NO_FREE_SEAT o 429.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "action");
  if (limited) return limited;
  const { roomId } = await params;

  const body = await readJsonBody(request);
  if (!body.ok) return Response.json({ error: body.error, code: "BAD_REQUEST" }, { status: 400 });

  const { status, body: response } = joinRandomSeat(roomId, body.value);
  return Response.json(response, { status });
}
