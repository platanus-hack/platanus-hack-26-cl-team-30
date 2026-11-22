import { fixedDemoRoom, notConfigured, remoteDemoBase } from "@/lib/presentacion/remote";
import { getRoom } from "@/lib/store/rooms";

// POST /api/presentacion/sala -> 200 { roomId, hostToken, committeeKey, base }
// Decide dónde vive la sala de la lámina en vivo:
// - PRESENTACION_DEMO_SALA: usa esa sala fija (en el deploy remoto o aquí) si todavía
//   existe; las salas viven en memoria y se pierden si el servidor se reinicia, y en
//   ese caso abre una nueva para que la demo no se caiga. No hay token de anfitrión.
// - PRESENTACION_DEMO_URL: abre una sala de demo nueva en ese deploy.
// - Ninguna de las dos: 404, y la presentación abre la sala en este servidor.
export async function POST() {
  const base = remoteDemoBase();
  const fixed = fixedDemoRoom();
  if (!base && !fixed) return notConfigured();

  if (fixed) {
    const exists = base ? await remoteRoomExists(base, fixed) : !!getRoom(fixed);
    if (exists) return Response.json({ roomId: fixed, hostToken: null, committeeKey: null, base });
  }
  if (!base) return notConfigured();
  try {
    const res = await fetch(`${base}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "cross_org", scenario: "hospitales", demo: true }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.roomId !== "string") {
      return Response.json({ error: data.error ?? "El deploy no abrió la sala", code: data.code ?? "REMOTE_ERROR" }, { status: 502 });
    }
    return Response.json({ roomId: data.roomId, hostToken: data.hostToken ?? null, committeeKey: data.committeeKey ?? null, base });
  } catch {
    return Response.json({ error: "No se pudo llegar al deploy", code: "REMOTE_UNREACHABLE" }, { status: 502 });
  }
}

/** ¿Existe la sala en el deploy remoto? Se abre su flujo de eventos y se corta al primer byte. */
async function remoteRoomExists(base: string, roomId: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base}/api/rooms/${encodeURIComponent(roomId)}/events`, { signal: controller.signal, cache: "no-store" });
    void res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
