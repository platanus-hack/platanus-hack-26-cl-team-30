import { notConfigured, remoteDemoBase, ROOM_ID } from "@/lib/presentacion/remote";

// GET /api/presentacion/sala/:roomId/events
// Reenvía el flujo SSE de la sala del deploy remoto en la vista «stage» (sin
// credenciales: solo lo que todos pueden ver). Así la galaxia de la presentación
// se mueve con la sala real aunque el navegador no pueda leer otro dominio.
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const base = remoteDemoBase();
  if (!base) return notConfigured();
  const { roomId } = await params;
  if (!ROOM_ID.test(roomId)) return Response.json({ error: "Sala inválida", code: "BAD_REQUEST" }, { status: 400 });
  try {
    const upstream = await fetch(`${base}/api/rooms/${encodeURIComponent(roomId)}/events`, {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) return new Response(null, { status: upstream.status || 502 });
    return new Response(upstream.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
