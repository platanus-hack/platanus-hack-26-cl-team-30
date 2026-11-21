import { z } from "zod";
import { registerSummaryRecipient } from "@/integrations/committee-summary";
import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";
import { getRoom, resolveViewer } from "@/lib/store/rooms";

const BodySchema = z.object({
  orgId: z.string().min(1).max(64),
  roleId: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
  phone: z.string().min(6).max(24),
});

// POST /api/rooms/:roomId/committee/summary  body { orgId, roleId, token, phone }
//   -> 200 { ok: true, deliverable }  ·  400 BAD_REQUEST / INVALID_PHONE  ·  401 INVALID_TOKEN  ·  403 RBAC_DENIED  ·  404
// El Comité escribe su número en el celular para recibir el acta por WhatsApp al
// decidir (alternativa al botón wa.me). Solo el Comité árbitro de la sala, con su
// token. deliverable: si hoy se le puede escribir (plantilla configurada o ventana
// de 24 h abierta); si no, el celular le pide escribir «hola» al número de Sculptor.
// El número queda en memoria solo durante la ronda y nunca viaja a una pantalla.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "action");
  if (limited) return limited;
  const { roomId } = await params;
  const body = await readJsonBody(request);
  const parsed = body.ok ? BodySchema.safeParse(body.value) : null;
  if (!parsed?.success) return Response.json({ error: "Se espera { orgId, roleId, token, phone }", code: "BAD_REQUEST" }, { status: 400 });

  const arbiter = getRoom(roomId)?.scarcity?.arbiter;
  if (!arbiter) return Response.json({ error: "La sala no existe o no tiene Comité", code: "ROOM_NOT_FOUND" }, { status: 404 });
  const viewer = resolveViewer(roomId, parsed.data);
  if (viewer === "stage") return Response.json({ error: "Falta el token del rol o no es válido", code: "INVALID_TOKEN" }, { status: 401 });
  if (viewer.orgId !== arbiter.orgId || viewer.roleId !== arbiter.roleId) {
    return Response.json({ error: "Solo el Comité puede pedir el resumen por WhatsApp", code: "RBAC_DENIED" }, { status: 403 });
  }

  const registered = registerSummaryRecipient(roomId, parsed.data.phone, "manual");
  if (!registered.ok) {
    return registered.reason === "invalid_phone"
      ? Response.json({ error: "El número no parece válido. Escríbalo con código de país, por ejemplo +56 9 1234 5678.", code: "INVALID_PHONE" }, { status: 400 })
      : Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });
  }
  return Response.json({ ok: true, deliverable: registered.deliverable });
}
