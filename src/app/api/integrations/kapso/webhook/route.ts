import { closeSession, decideAsCommittee, getSession, getSessionByPhone, setPendingDecision } from "@/integrations/committee-channel";
import { extractIncomingMessages, parseButtonId, sendText, verifyWebhook } from "@/integrations/kapso";

// POST /api/integrations/kapso/webhook
// Respuestas del Comité por WhatsApp, enviadas por Kapso. La firma
// X-Webhook-Signature se verifica sobre el cuerpo crudo antes de leerlo.
// Flujo: el Comité toca "Aprobar" o "Vetar" -> se le pide la razón -> su
// siguiente mensaje de texto es la razón -> se registra la decisión con las
// mismas acciones que la web. Solo se aceptan mensajes del número asociado a la
// sesión, que es el del Comité.
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWebhook(rawBody, request.headers.get("x-webhook-signature"))) {
    return Response.json({ error: "Firma inválida", code: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: true });
  }

  for (const message of extractIncomingMessages(payload)) {
    try {
      if (message.buttonId) {
        const parsed = parseButtonId(message.buttonId);
        const session = parsed ? getSession(parsed.sessionId) : undefined;
        if (!parsed || !session || session.phone !== message.from) continue;
        setPendingDecision(session, parsed.decision);
        await sendText(
          message.from,
          parsed.decision === "approve"
            ? "Eligió APROBAR. Escriba en un mensaje la razón de su decisión (es obligatoria)."
            : "Eligió VETAR. Escriba en un mensaje la razón del veto (es obligatoria).",
        );
        continue;
      }

      if (message.text) {
        const session = getSessionByPhone(message.from);
        if (!session) continue;
        if (!session.pendingDecision) {
          await sendText(message.from, "Para decidir, toque primero Aprobar o Vetar en el mensaje del caso.");
          continue;
        }
        const decided = await decideAsCommittee(session, session.pendingDecision, message.text, "WhatsApp");
        if (decided.ok) {
          closeSession(session);
          await sendText(message.from, "Decisión registrada con su razón. Ya aparece en todas las pantallas y en el acta.");
        } else {
          await sendText(message.from, `No se pudo registrar: ${decided.message}.`);
        }
      }
    } catch (error) {
      console.error("[kapso webhook]", error instanceof Error ? error.message : error);
    }
  }

  // Siempre 200 para que Kapso no reintente mensajes ya procesados.
  return Response.json({ ok: true });
}
