import { guideSignedUrl, guideStatus } from "@/integrations/guide-agent";
import { rateLimited } from "@/lib/store/rate-limit";

// POST /api/guide/voice  -> { ok, signedUrl }
// Abre una conversación con la guía de Sculptor desde el navegador, por voz o por
// texto. No toma ningún puesto ni recibe datos de la sala: la sala la conoce por la
// variable dinámica room_id que pone el navegador, y su estado lo pide la guía con
// su herramienta, que solo devuelve lo público.
export async function POST(request: Request) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  if (!guideStatus().configured) {
    return Response.json({ error: "La guía no está configurada en el servidor", code: "NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    const { signedUrl } = await guideSignedUrl();
    return Response.json({ ok: true, signedUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message.slice(0, 200) : "No se pudo abrir la conversación", code: "GUIDE_UNAVAILABLE" }, { status: 502 });
  }
}
