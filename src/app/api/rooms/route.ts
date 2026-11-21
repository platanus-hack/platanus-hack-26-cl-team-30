import { RoomModeSchema } from "@/lib/genome/schema";
import { isSeedGenomeId, SEED_GENOME_IDS } from "@/lib/genome/seeds";
import { readJsonBody } from "@/lib/store/http";
import { createRoom, RoomLimitError } from "@/lib/store/rooms";

// POST /api/rooms  body { mode: "single_org" | "cross_org", seed?: string }  ->  { roomId }
// Crea una sala desde una semilla. Sin body crea una sala single_org con la clínica.
// "seed" elige la organización en single_org; cross_org siempre usa los dos hospitales.
// Hay un tope de salas en memoria: al llegar a él sale la sala inactiva más
// antigua; si todas tienen gente conectada, responde 503 ROOM_LIMIT.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return Response.json({ error: body.error, code: "BAD_REQUEST" }, { status: 400 });
  const { mode: rawMode, seed } = (typeof body.value === "object" && body.value !== null ? body.value : {}) as { mode?: unknown; seed?: unknown };

  const mode = RoomModeSchema.safeParse(rawMode ?? "single_org");
  if (!mode.success) {
    return Response.json({ error: 'mode debe ser "single_org" o "cross_org"', code: "BAD_REQUEST" }, { status: 400 });
  }
  if (seed !== undefined && !isSeedGenomeId(seed)) {
    return Response.json({ error: `seed debe ser una de: ${SEED_GENOME_IDS.join(", ")}`, code: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const room = createRoom({ mode: mode.data, seed: mode.data === "single_org" ? seed : undefined });
    return Response.json({ roomId: room.roomId });
  } catch (error) {
    if (error instanceof RoomLimitError) {
      return Response.json({ error: error.message, code: "ROOM_LIMIT" }, { status: 503, headers: { "Retry-After": "60" } });
    }
    throw error;
  }
}
