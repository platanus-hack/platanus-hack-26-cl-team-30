import { timingSafeEqual } from "node:crypto";
import { openCommitteeSession } from "@/integrations/committee-channel";
import { voiceSignedUrl, voiceStatus } from "@/integrations/elevenlabs";
import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";
import { getHostCredentials } from "@/lib/store/rooms";

function sameKey(given: unknown, expected: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/rooms/:roomId/committee/voice  body { committeeKey }
//   -> { ok, signedUrl, sessionId }
// Conversación de voz con el asistente del Comité desde el navegador, sin
// teléfono. Exige la clave del Comité (la del código QR) y toma ese puesto.
// El navegador abre la conversación con signedUrl y pasa sessionId como la
// variable dinámica session_id.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  const credentials = getHostCredentials(roomId);
  if (!credentials) return Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });
  if (!voiceStatus().configured) {
    return Response.json({ error: "El asistente de voz no está configurado en el servidor", code: "NOT_CONFIGURED" }, { status: 503 });
  }

  const body = await readJsonBody(request);
  const committeeKey = body.ok ? (body.value as { committeeKey?: unknown } | null)?.committeeKey : undefined;
  if (!sameKey(committeeKey, credentials.committeeKey)) {
    return Response.json({ error: "Falta la clave del Comité o no es válida", code: "COMMITTEE_KEY_REQUIRED" }, { status: 403 });
  }

  const opened = await openCommitteeSession(roomId, "voice");
  if (!opened.ok) return Response.json({ error: opened.message, code: opened.code }, { status: opened.status });

  try {
    const { signedUrl } = await voiceSignedUrl();
    return Response.json({ ok: true, signedUrl, sessionId: opened.session.id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message.slice(0, 200) : "No se pudo abrir la conversación", code: "VOICE_UNAVAILABLE" },
      { status: 502 },
    );
  }
}
