import { notConfigured, remoteDemoBase } from "@/lib/presentacion/remote";

// POST /api/presentacion/sala -> 200 { roomId, hostToken, committeeKey }
// Abre una sala de demo (dos hospitales) en el deploy de PRESENTACION_DEMO_URL y
// devuelve sus credenciales de anfitrión a la presentación. 404 si no está configurado.
export async function POST() {
  const base = remoteDemoBase();
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
