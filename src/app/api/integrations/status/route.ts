import { voiceStatus } from "@/integrations/elevenlabs";
import { whatsappStatus } from "@/integrations/kapso";

// GET /api/integrations/status -> { whatsapp: { configured }, voice: { configured, canCall } }
// Qué canales externos del Comité están disponibles en este servidor, para que
// la interfaz muestre solo los botones que funcionan. No expone ninguna clave.
export function GET() {
  return Response.json({ whatsapp: whatsappStatus(), voice: voiceStatus() }, { headers: { "Cache-Control": "no-store" } });
}
