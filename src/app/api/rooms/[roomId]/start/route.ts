import { rateLimited } from "@/lib/store/rate-limit";
import { startDemo } from "@/lib/store/rooms";

// POST /api/rooms/:roomId/start  (sin cuerpo, sin clave de anfitrión)
//   -> 200 { ok: true, phase, bots: [{ orgId, roleId }] }
// «Iniciar» del narrador en la demo con negociación: los asientos sin persona
// los toma un bot del piloto automático (marcado como automático) y la
// negociación arranca sin esperar a nadie más. No pide el token de anfitrión
// porque solo se acepta en el paso «Unirse» (nadie dio su postura): no puede
// adelantar ni reiniciar una ronda en curso. Ver startDemo en src/lib/store/rooms.ts.
// 404 ROOM_NOT_FOUND · 409 WRONG_MODE (no es sala de demo con negociación) ·
// 409 ROUND_STARTED (la ronda ya pasó el paso Unirse) · 429 RATE_LIMITED.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  const { status, body } = startDemo(roomId);
  return Response.json(body, { status });
}
