import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";
import { applyAction } from "@/lib/store/rooms";
import { sendActaAfterWebSeal } from "@/integrations/voice-notes";

// POST /api/rooms/:roomId/action  body { type, orgId, roleId, token, ...datos }
// Única puerta para cambiar una sala. La forma del body está en ActionSchema
// (src/lib/store/actions.ts). La identidad (token) se comprueba en el almacén y
// los permisos los decide el motor determinista, todo en el servidor.
// Respuestas: 200 { ok: true, ... } o { error, code } con 400, 401, 403, 404, 409 o 429.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "action");
  if (limited) return limited;
  const { roomId } = await params;

  const body = await readJsonBody(request);
  if (!body.ok) return Response.json({ error: body.error, code: "BAD_REQUEST" }, { status: 400 });

  const { status, body: response } = await applyAction(roomId, body.value);
  // El Comité selló desde la web: el acta en audio por WhatsApp, si a esta sala se le
  // envió el caso por ese canal y la conversación está abierta. En segundo plano y sin
  // afectar la respuesta: el audio solo informa (src/integrations/voice-notes.ts).
  const type = (body.value as { type?: unknown } | null)?.type;
  if (status === 200 && type === "ALLOCATION_SEAL") {
    void sendActaAfterWebSeal(roomId).then((note) => {
      if (!note.sent && note.reason === "error") console.error("[nota de voz]", note.message);
    });
  }
  return Response.json(response, { status });
}
