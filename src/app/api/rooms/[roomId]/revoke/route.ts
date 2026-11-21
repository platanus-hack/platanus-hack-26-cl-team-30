import { z } from "zod";
import { requireHost } from "@/lib/store/host";
import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";
import { revokeSeat } from "@/lib/store/rooms";

const RevokeSchema = z.object({ orgId: z.string().min(1).max(64), roleId: z.string().min(1).max(64) });

// POST /api/rooms/:roomId/revoke  body { orgId, roleId }  (encabezado x-host-token)
//   -> { ok: true, revoked }
// Libera un puesto y revoca su token: quien lo tenía deja de poder actuar. Solo el anfitrión.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  const denied = requireHost(request, roomId);
  if (denied) return denied;
  const body = await readJsonBody(request);
  const seat = body.ok ? RevokeSchema.safeParse(body.value) : null;
  if (!seat?.success) return Response.json({ error: "Se espera { orgId, roleId }", code: "BAD_REQUEST" }, { status: 400 });
  const { status, body: response } = revokeSeat(roomId, seat.data);
  return Response.json(response, { status });
}
