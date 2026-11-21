import { RoomModeSchema } from "@/lib/genome/schema";
import { isSeedGenomeId, SEED_GENOME_IDS } from "@/lib/genome/seeds";
import { createRoom } from "@/lib/store/rooms";

// POST /api/rooms  body { mode: "single_org" | "cross_org", seed?: string }  ->  { roomId }
// Crea una sala desde una semilla. Sin body crea una sala single_org con la clínica.
// "seed" elige la organización en single_org; cross_org siempre usa los dos hospitales.
export async function POST(request: Request) {
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return Response.json({ error: "El body no es JSON válido", code: "BAD_REQUEST" }, { status: 400 });
  }
  const { mode: rawMode, seed } = (typeof body === "object" && body !== null ? body : {}) as { mode?: unknown; seed?: unknown };

  const mode = RoomModeSchema.safeParse(rawMode ?? "single_org");
  if (!mode.success) {
    return Response.json({ error: 'mode debe ser "single_org" o "cross_org"', code: "BAD_REQUEST" }, { status: 400 });
  }
  if (seed !== undefined && !isSeedGenomeId(seed)) {
    return Response.json({ error: `seed debe ser una de: ${SEED_GENOME_IDS.join(", ")}`, code: "BAD_REQUEST" }, { status: 400 });
  }

  const room = createRoom({ mode: mode.data, seed: mode.data === "single_org" ? seed : undefined });
  return Response.json({ roomId: room.roomId });
}
