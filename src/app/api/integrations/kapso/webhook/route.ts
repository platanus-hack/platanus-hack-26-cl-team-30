import { buildCommitteeBrief, closeSession, decideAsCommittee, getSession, getSessionByPhone, setPendingDecision } from "@/integrations/committee-channel";
import { extractIncomingMessages, parseButtonId, sendText, verifyWebhook } from "@/integrations/kapso";
import { noteInbound, sendCommitteeVoiceNote, type VoiceNoteKind } from "@/integrations/voice-notes";
import { registerSummaryRecipient, roomCodeFromText, summaryRecipients } from "@/integrations/committee-summary";

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
        const pending = getSessionByPhone(message.from)?.pendingDecision;
        // «Hola, soy el Comité de la sala <código>» (botón wa.me del celular): este
        // número recibirá el acta de esa sala. Si tiene una decisión a medias, el
        // texto es su razón y no un código.
        const code = pending ? null : roomCodeFromText(message.text);
        if (code) {
          const registered = registerSummaryRecipient(code, message.from, "wame");
          await sendText(
            message.from,
            registered.ok
              ? `Listo: cuando el Comité decida, le llegará aquí el acta de la sala ${code}. (Demostración simulada de Sculptor.)`
              : `No encontré la sala ${code}. Revise el código en la pantalla grande y vuelva a escribir.`,
          );
          continue;
        }
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
          // Si este número pidió el resumen (wa.me o a mano), el acta ya le llega por ahí.
          if (decision === "approve" && !summaryRecipients(session.roomId).includes(message.from)) voiceNoteInBackground("acta", session.roomId, message.from);
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
