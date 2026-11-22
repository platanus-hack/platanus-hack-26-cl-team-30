import { z } from "zod";
import { readJsonBody } from "@/lib/store/http";
import { notConfigured, remoteDemoBase, ROOM_ID } from "@/lib/presentacion/remote";

const Body = z.object({ action: z.enum(["pause", "resume", "advance"]), hostToken: z.string().min(1).max(200) });

// POST /api/presentacion/sala/:roomId/negotiation  body { action, hostToken }
// Pausar, reanudar o adelantar la negociación de la sala remota desde el teclado de
// la presentación. El token de anfitrión es el que entregó el deploy al abrir la sala.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const base = remoteDemoBase();
  if (!base) return notConfigured();
  const { roomId } = await params;
  const body = await readJsonBody(request);
  const parsed = body.ok ? Body.safeParse(body.value) : null;
  if (!ROOM_ID.test(roomId) || !parsed?.success) return Response.json({ error: "Pedido inválido", code: "BAD_REQUEST" }, { status: 400 });
  try {
    const res = await fetch(`${base}/api/rooms/${encodeURIComponent(roomId)}/negotiation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-host-token": parsed.data.hostToken },
      body: JSON.stringify({ action: parsed.data.action }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "No se pudo llegar al deploy", code: "REMOTE_UNREACHABLE" }, { status: 502 });
  }
}
