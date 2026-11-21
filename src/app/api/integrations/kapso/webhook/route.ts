import { buildCommitteeBrief, closeSession, decideAsCommittee, getSession, getSessionByPhone, setPendingDecision } from "@/integrations/committee-channel";
import { extractIncomingMessages, parseButtonId, sendText, verifyWebhook } from "@/integrations/kapso";
import { noteInbound, sendCommitteeVoiceNote, type VoiceNoteKind } from "@/integrations/voice-notes";

/**
 * Nota de voz informativa, en segundo plano: la respuesta al webhook no espera a
 * ElevenLabs ni a la subida del audio. Si no corresponde o falla, solo se anota.
 */
function voiceNoteInBackground(kind: VoiceNoteKind, roomId: string, phone: string, onSent?: () => void) {
  void sendCommitteeVoiceNote(kind, roomId, phone).then((result) => {
    if (result.sent) onSent?.();
    else if (result.reason === "error") console.error("[nota de voz]", result.message);
  });
}

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
    // El Comité escribió o tocó un botón: la conversación queda abierta 24 h.
    noteInbound(message.from);
    try {
      if (message.buttonId) {
        const parsed = parseButtonId(message.buttonId);
        const session = parsed ? getSession(parsed.sessionId) : undefined;
        if (!parsed || !session || session.phone !== message.from) continue;
        setPendingDecision(session, parsed.decision);
        // Con plantilla, el Comité solo vio un resumen corto: aquí va el caso completo.
        await sendText(
          message.from,
          `${buildCommitteeBrief(session)}\n\n` +
            (parsed.decision === "approve"
              ? "Eligió APROBAR. Escriba en un mensaje la razón de su decisión (es obligatoria)."
              : "Eligió VETAR. Escriba en un mensaje la razón del veto (es obligatoria)."),
        );
        // (a) El caso en audio, una vez por sesión, ahora que la conversación está abierta.
        if (!session.caseVoiceSent) {
          session.caseVoiceSent = true;
          voiceNoteInBackground("case", session.roomId, message.from);
        }
        continue;
      }

      if (message.text) {
        const session = getSessionByPhone(message.from);
        if (!session) continue;
        if (!session.pendingDecision) {
          await sendText(message.from, "Para decidir, toque primero Aprobar o Vetar en el mensaje del caso.");
          continue;
        }
        const decision = session.pendingDecision;
        const decided = await decideAsCommittee(session, decision, message.text, "WhatsApp");
        if (decided.ok) {
          closeSession(session);
          await sendText(message.from, "Decisión registrada con su razón. Ya aparece en todas las pantallas y en el acta.");
          // (b) Si quedó sellada, el acta en audio al Comité (acaba de escribir: ventana abierta).
          if (decision === "approve") voiceNoteInBackground("acta", session.roomId, message.from);
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
