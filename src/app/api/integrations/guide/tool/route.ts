import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CHANNEL_SECRET_HEADER, elevenLabsConfig } from "@/integrations/elevenlabs";
import { guideRoomStatus } from "@/integrations/guide-status";
import { projectRoom } from "@/lib/store/rooms";

const ToolSchema = z.object({ action: z.literal("estado_sala"), room_id: z.string().trim().max(80).optional() });

function authorized(request: Request): boolean {
  const { secret } = elevenLabsConfig();
  const given = request.headers.get(CHANNEL_SECRET_HEADER);
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/integrations/guide/tool  (encabezado x-nexo-secret, el mismo NEXO_CHANNEL_SECRET del Comité)
// Herramienta estado_sala del agente guía. Devuelve, en una frase para leer en voz
// alta, lo público de una sala: el paso, a quién le toca y si ya hay decisión. Se
// arma con la vista general de la sala ("stage"): nunca lleva un dato reservado.
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

  const roomId = parsed.data.room_id;
  if (!roomId || roomId.includes("{{")) {
    return Response.json({ result: "No hay una sala abierta en esta página. Puede abrir la demo con el botón Probar la demo." });
  }
  const room = projectRoom(roomId, "stage");
  if (!room) return Response.json({ result: "No encuentro esa sala. Puede abrir la demo con el botón Probar la demo." });
  return Response.json({ result: guideRoomStatus(room) });
}
