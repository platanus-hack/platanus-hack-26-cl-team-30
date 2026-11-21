import { z } from "zod";
import { AUTOPILOT_MAX_STEP_MS, AUTOPILOT_MIN_STEP_MS } from "@/lib/engine/autopilot";
import { requireHost } from "@/lib/store/host";
import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";
import { startAutopilot, stopAutopilot } from "@/lib/store/rooms";

const AutopilotSchema = z.object({
  action: z.enum(["start", "stop"]).default("start"),
  /** Milisegundos entre pasos. */
  stepMs: z.number().int().min(AUTOPILOT_MIN_STEP_MS).max(AUTOPILOT_MAX_STEP_MS).optional(),
  /** true: un bot también firma como Comité. Por defecto, si nadie tiene ese puesto. */
  withCommittee: z.boolean().optional(),
});

// POST /api/rooms/:roomId/autopilot  body { action?: "start" | "stop", stepMs?, withCommittee? }
// (encabezado x-host-token)
//   start -> { ok, running: true, steps, stepMs, botSeats }   stop -> { ok, running: false }
// Ensayo sin gente: bots toman los puestos libres y recorren el guion de la demo
// paso a paso, con las mismas reglas que una persona. Queda marcado como ensayo en
// la bitácora. Solo el anfitrión. 409 BUSY si ya corre; 409 DECISION_SEALED si el caso ya se decidió.
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const limited = rateLimited(request, "host");
  if (limited) return limited;
  const { roomId } = await params;
  const denied = requireHost(request, roomId);
  if (denied) return denied;
  const body = await readJsonBody(request);
  const parsed = body.ok ? AutopilotSchema.safeParse(body.value) : null;
  if (!parsed?.success) {
    return Response.json({ error: `Se espera { action?: "start" | "stop", stepMs? (${AUTOPILOT_MIN_STEP_MS} a ${AUTOPILOT_MAX_STEP_MS}), withCommittee? }`, code: "BAD_REQUEST" }, { status: 400 });
  }
  const { action, stepMs, withCommittee } = parsed.data;
  const { status, body: response } = action === "stop" ? stopAutopilot(roomId) : startAutopilot(roomId, { stepMs, withCommittee });
  return Response.json(response, { status });
}
