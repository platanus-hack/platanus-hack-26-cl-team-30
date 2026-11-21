import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { buildCommitteeBrief, closeSession, decideAsCommittee, getOnlyVoiceSession, getSession } from "@/integrations/committee-channel";
import { CHANNEL_SECRET_HEADER, SESSION_HEADER, elevenLabsConfig } from "@/integrations/elevenlabs";

const ToolSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("brief"), session_id: z.string().optional() }),
  z.object({
    action: z.literal("decide"),
    session_id: z.string().optional(),
    decision: z.enum(["approve", "veto"]),
    reason: z.string().min(1).max(600),
  }),
]);

function authorized(request: Request): boolean {
  const { secret } = elevenLabsConfig();
  const given = request.headers.get(CHANNEL_SECRET_HEADER);
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/integrations/voice/tool  (encabezado x-nexo-secret)
// Herramientas del agente de voz del Comité, llamadas por ElevenLabs durante la
// conversación. "brief" devuelve el resumen que ve el Comité; "decide" aplica
// la aprobación o el veto con la razón que dijo la persona. Las respuestas son
// texto simple porque el agente las lee en voz alta.
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ result: "No autorizado." }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ result: "Petición inválida." }, { status: 400 });
  }
  const parsed = ToolSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ result: "Faltan datos para usar la herramienta." }, { status: 400 });

  const headerSession = request.headers.get(SESSION_HEADER);
  const session =
    getSession(headerSession && !headerSession.includes("{{") ? headerSession : undefined) ??
    getSession(parsed.data.session_id) ??
    getOnlyVoiceSession();
  if (!session) return Response.json({ result: "No encuentro el caso de esta llamada. Pida al anfitrión que vuelva a avisar al Comité." });

  if (parsed.data.action === "brief") {
    return Response.json({ result: buildCommitteeBrief(session) });
  }

  const decided = await decideAsCommittee(session, parsed.data.decision, parsed.data.reason, "llamada de voz");
  if (!decided.ok) return Response.json({ result: `No se pudo registrar: ${decided.message}.` });
  closeSession(session);
  return Response.json({
    result:
      parsed.data.decision === "approve"
        ? "Listo. La aprobación quedó registrada con su razón y ya aparece en todas las pantallas."
        : "Listo. El veto quedó registrado con su razón; la regla vuelve a ordenar a los candidatos.",
  });
}
