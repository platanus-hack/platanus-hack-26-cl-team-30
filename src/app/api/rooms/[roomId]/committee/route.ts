import { getRoom } from "@/lib/store/rooms";
import { z } from "zod";
import { buildCommitteeBrief, closeSession, openCommitteeSession } from "@/integrations/committee-channel";
import { callCommittee, voiceStatus } from "@/integrations/elevenlabs";
import { sendCommitteeCase, whatsappStatus } from "@/integrations/kapso";
import { sendCommitteeVoiceNote } from "@/integrations/voice-notes";
import { requireHost } from "@/lib/store/host";
import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";

const NotifySchema = z.object({
  channels: z.array(z.enum(["whatsapp", "call"])).min(1).max(2).default(["whatsapp", "call"]),
});

type ChannelResult = { ok: true; detail: string } | { ok: false; code: string; error: string };

// POST /api/rooms/:roomId/committee  body { channels?: ("whatsapp" | "call")[] }  (encabezado x-host-token)
//   -> { ok, results: { whatsapp?: ChannelResult, call?: ChannelResult } }
// Avisa al Comité árbitro fuera de la web: le escribe por WhatsApp (Kapso) con
// botones para aprobar o vetar, y/o lo llama el agente de voz (ElevenLabs).
// El canal toma el puesto del Comité con la misma clave que el código QR; si una
// persona ya lo tiene desde la web, ese canal responde ROLE_TAKEN. Solo el anfitrión.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  const denied = requireHost(request, roomId);
  if (denied) return denied;

  const body = await readJsonBody(request);
  const parsed = NotifySchema.safeParse(body.ok ? (body.value ?? {}) : {});
  if (!parsed.success) {
    return Response.json({ error: 'Se espera { channels?: ("whatsapp" | "call")[] }', code: "BAD_REQUEST" }, { status: 400 });
  }

  const results: Record<string, ChannelResult> = {};

  if (parsed.data.channels.includes("whatsapp")) {
    if (!whatsappStatus().configured) {
      results.whatsapp = { ok: false, code: "NOT_CONFIGURED", error: "WhatsApp no está configurado en el servidor" };
    } else {
      const opened = await openCommitteeSession(roomId, "whatsapp", process.env.NEXO_COMMITTEE_PHONE?.replace(/\D/g, "") ?? null);
      if (!opened.ok) {
        results.whatsapp = { ok: false, code: opened.code, error: opened.message };
      } else {
        try {
          const resource = getRoom(roomId)?.scarcity?.resource ?? "recurso en disputa";
          await sendCommitteeCase(opened.session.id, buildCommitteeBrief(opened.session), {
            room: roomId.slice(0, 6).toUpperCase(),
            resource,
          });
          results.whatsapp = { ok: true, detail: "Caso enviado por WhatsApp" };
          // (a) Además de los botones, el caso en audio si la conversación está abierta
          // (el Comité escribió en las últimas 24 h). Si no, se omite: se enviará al tocar un botón.
          const session = opened.session;
          if (session.phone && !session.caseVoiceSent) {
            void sendCommitteeVoiceNote("case", roomId, session.phone).then((note) => {
              if (note.sent) session.caseVoiceSent = true;
              else if (note.reason === "error") console.error("[nota de voz]", note.message);
            });
          }
        } catch (error) {
          closeSession(opened.session);
          results.whatsapp = { ok: false, code: "SEND_FAILED", error: error instanceof Error ? error.message.slice(0, 200) : "No se pudo enviar" };
        }
      }
    }
  }

  if (parsed.data.channels.includes("call")) {
    if (!voiceStatus().canCall) {
      results.call = { ok: false, code: "NOT_CONFIGURED", error: "La llamada de voz no está configurada en el servidor" };
    } else {
      const opened = await openCommitteeSession(roomId, "voice");
      if (!opened.ok) {
        results.call = { ok: false, code: opened.code, error: opened.message };
      } else {
        try {
          await callCommittee(opened.session.id, buildCommitteeBrief(opened.session));
          results.call = { ok: true, detail: "Llamando al Comité" };
        } catch (error) {
          closeSession(opened.session);
          results.call = { ok: false, code: "CALL_FAILED", error: error instanceof Error ? error.message.slice(0, 200) : "No se pudo llamar" };
        }
      }
    }
  }

  return Response.json({ ok: Object.values(results).some((result) => result.ok), results });
}
