import { z } from "zod";
import { CROSS_ORG_SCENARIO_IDS } from "@/lib/genome/scenarios";
import { SEED_GENOME_IDS, type SeedGenomeId } from "@/lib/genome/seeds";
import { readJsonBody } from "@/lib/store/http";
import { globallyLimited, rateLimited } from "@/lib/store/rate-limit";
import { createMutatedRoom, createRoom, getHostCredentials, RoomLimitError } from "@/lib/store/rooms";

const CreateSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single_org"),
    /** Organización semilla. Se ignora si viene description. */
    seed: z.enum(SEED_GENOME_IDS as [SeedGenomeId, ...SeedGenomeId[]]).optional(),
    /** Frase que describe la organización: la sala nueva nace ya mutada. */
    description: z.string().trim().min(1).max(600).optional(),
  }),
  z.object({
    mode: z.literal("cross_org"),
    scenario: z.enum(CROSS_ORG_SCENARIO_IDS).optional(),
    /** Sala de demo: 3 asientos humanos y bots en los roles administrativos. */
    demo: z.boolean().optional(),
    /** Sala de demo: plan B en ms (si nadie actúa, juega el piloto). 0 lo apaga. Por defecto 20 s. */
    turnMs: z.number().int().min(0).max(120_000).optional(),
  }),
]);

// POST /api/rooms
//   { mode: "single_org", seed? }                      -> sala de una organización desde una semilla
//   { mode: "single_org", description }                -> sala NUEVA ya mutada desde una frase (modelo,
//                                                          máx. 15 s; si no, la semilla más parecida)
//   { mode: "cross_org", scenario? }                   -> dos organizaciones y un recurso escaso:
//                                                          "hospitales" (por defecto), "construccion", "logistica".
//                                                          Con demo: true, sala de demo (3 personas, bots en los
//                                                          roles administrativos); turnMs: plan B en ms (0 lo apaga)
// Responde { roomId, hostToken, committeeKey, mode, scenario?, source?, latencyMs?, orgName? }.
// hostToken habilita los controles de la pantalla grande (encabezado x-host-token);
// committeeKey va dentro del QR del Comité. Se entregan solo aquí: guardarlos.
// Sin body crea una sala single_org con la clínica.
// 400 BAD_REQUEST · 429 RATE_LIMITED · 503 ROOM_LIMIT (tope de salas con todas en uso).
export async function POST(request: Request) {
  const limited = rateLimited(request, "createRoom");
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (!body.ok) return Response.json({ error: body.error, code: "BAD_REQUEST" }, { status: 400 });
  const raw = typeof body.value === "object" && body.value !== null ? body.value : {};
  const parsed = CreateSchema.safeParse({ mode: "single_org", ...raw });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return Response.json(
      { error: `Datos inválidos${where}. mode: "single_org" | "cross_org"; seed: ${SEED_GENOME_IDS.join(", ")}; scenario: ${CROSS_ORG_SCENARIO_IDS.join(", ")}`, code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    if (input.mode === "single_org" && input.description) {
      // Mutar llama al modelo: límite por cliente más estricto y tope global.
      const mutateLimited = rateLimited(request, "mutate") ?? globallyLimited("mutate");
      if (mutateLimited) return mutateLimited;
      const room = await createMutatedRoom(input.description);
      return Response.json({ ...room, ...getHostCredentials(room.roomId), mode: "single_org" });
    }
    const room =
      input.mode === "cross_org" ? createRoom({ mode: "cross_org", scenario: input.scenario, demo: input.demo, turnTimeoutMs: input.turnMs }) : createRoom({ mode: "single_org", seed: input.seed });
    return Response.json({
      roomId: room.roomId,
      ...getHostCredentials(room.roomId),
      mode: room.mode,
      ...(room.scenarioId ? { scenario: room.scenarioId } : {}),
      ...(room.demo ? { demo: true } : {}),
    });
  } catch (error) {
    if (error instanceof RoomLimitError) {
      return Response.json({ error: error.message, code: "ROOM_LIMIT" }, { status: 503, headers: { "Retry-After": "60" } });
    }
    throw error;
  }
}
