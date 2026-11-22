import { NegotiationControlSchema } from "@/lib/store/actions";
import { requireHost } from "@/lib/store/host";
import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";
import { controlNegotiation } from "@/lib/store/rooms";

// POST /api/rooms/:roomId/negotiation  (encabezado x-host-token)  body { action: "pause" | "resume" | "advance" }
//   -> 200 { ok: true, phase, paused }
// Controles del narrador sobre la negociación entre agentes: pausar, reanudar o
// adelantar el paso que está esperando. Solo el anfitrión (403 HOST_ONLY si no).
// 400 BAD_REQUEST · 404 ROOM_NOT_FOUND · 409 WRONG_MODE (la sala no tiene negociación).
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  const denied = requireHost(request, roomId);
  if (denied) return denied;

  const body = await readJsonBody(request);
  const parsed = body.ok ? NegotiationControlSchema.safeParse(body.value) : null;
  if (!parsed?.success) return Response.json({ error: 'Se espera { action: "pause" | "resume" | "advance" }', code: "BAD_REQUEST" }, { status: 400 });

  const { status, body: response } = controlNegotiation(roomId, parsed.data.action);
  return Response.json(response, { status });
}
