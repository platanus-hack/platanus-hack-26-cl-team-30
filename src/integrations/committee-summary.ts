// Resumen por WhatsApp para quien hace de Comité en el celular (ronda 18).
//
// Para que el acta llegue aunque Meta no haya aprobado la plantilla, el celular
// del Comité ofrece un botón que abre WhatsApp (wa.me) con el texto prellenado
// «Hola, soy el Comité de la sala <código>». Cuando ese mensaje llega al webhook
// de Kapso, se asocia ese número a la sala y, como la persona acaba de escribir,
// la ventana de 24 h queda abierta. Alternativa: escribir el número a mano en el
// celular (ruta /api/rooms/:id/committee/summary, solo con el token del Comité).
//
// Al sellarse la decisión (por la web, por WhatsApp o por el plan B), cada número
// asociado recibe el acta: primero por la plantilla si KAPSO_TEMPLATE_NAME está
// configurada; si no, en texto y nota de voz si la ventana de 24 h está abierta.
//
// El número vive solo aquí, en memoria y mientras dure la ronda de la sala: un
// reinicio de la sala lo olvida. Nunca entra al estado de la sala, así que no
// viaja a ninguna pantalla. El texto sale de la vista filtrada del Comité.

import { getRoom, projectRoom, roomRound, subscribe } from "@/lib/store/rooms";
import { kapsoConfig, sendSummaryTemplate, sendText, templateConfigured } from "./kapso";
import { actaVoiceText, sendCommitteeVoiceNote, windowOpen } from "./voice-notes";

/** Número de WhatsApp de Sculptor al que se escribe (el conectado en Kapso). Se puede cambiar con NEXT_PUBLIC_WHATSAPP_NUMBER. */
export const DEFAULT_WHATSAPP_NUMBER = "12084850157";

type Recipient = { phone: string; source: "wame" | "manual"; sent: boolean };
type RoomRecipients = { round: string; recipients: Map<string, Recipient>; unsubscribe: () => void };

const globalStore = globalThis as unknown as { __sculptorSummaryRecipients?: Map<string, RoomRecipients> };
const rooms: Map<string, RoomRecipients> = (globalStore.__sculptorSummaryRecipients ??= new Map());

export const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

/** Un número razonable: entre 8 y 15 dígitos (formato E.164 sin el «+»). */
export function validPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * «Hola, soy el Comité de la sala demo-cross» → «demo-cross». Exige la frase
 * «Comité de la sala» para no confundir una razón escrita con un código. null si no la trae.
 */
export function roomCodeFromText(text: string): string | null {
  const match = /comit[eé]\s+de\s+la\s+sala\s+([A-Za-z0-9_-]{3,64})/i.exec(text);
  if (!match) return null;
  // Los códigos de sala nuevos van en mayúsculas (5 caracteres legibles); si la
  // persona lo escribió en minúsculas, se reconoce igual. Las salas fijas
  // («demo-cross») conservan su id tal cual.
  const code = match[1];
  return getRoom(code) || !getRoom(code.toUpperCase()) ? code : code.toUpperCase();
}

/** Texto prellenado del botón de WhatsApp del celular. */
export function joinText(roomId: string): string {
  return `Hola, soy el Comité de la sala ${roomId}`;
}

function cleanup(roomId: string) {
  rooms.get(roomId)?.unsubscribe();
  rooms.delete(roomId);
}

export type RegisterResult = { ok: true; deliverable: boolean } | { ok: false; reason: "room_not_found" | "invalid_phone" };

/**
 * Asocia un número a la sala para recibir el acta al decidir. deliverable dice si
 * hoy se le puede escribir: con plantilla configurada, siempre; si no, solo si la
 * ventana de 24 h está abierta (escribió hace poco).
 */
export function registerSummaryRecipient(roomId: string, phone: string, source: Recipient["source"], now: number = Date.now()): RegisterResult {
  const state = getRoom(roomId);
  if (!state?.scarcity) return { ok: false, reason: "room_not_found" };
  if (!validPhone(phone)) return { ok: false, reason: "invalid_phone" };
  const digits = normalizePhone(phone);
  const round = roomRound(roomId)!;
  let entry = rooms.get(roomId);
  if (entry && entry.round !== round) {
    cleanup(roomId);
    entry = undefined;
  }
  if (!entry) {
    const fresh: RoomRecipients = { round, recipients: new Map(), unsubscribe: () => {} };
    fresh.unsubscribe = subscribe(roomId, () => onRoomChange(roomId));
    rooms.set(roomId, fresh);
    entry = fresh;
  }
  const previous = entry.recipients.get(digits);
  entry.recipients.set(digits, { phone: digits, source, sent: previous?.sent ?? false });
  // Si la decisión ya estaba sellada, el acta sale ahora.
  if (state.allocationStatus === "SEALED") onRoomChange(roomId);
  return { ok: true, deliverable: templateConfigured() || windowOpen(digits, now) };
}

/** Números asociados a la sala en esta ronda. Solo para el servidor y las pruebas: nunca se envía a una pantalla. */
export function summaryRecipients(roomId: string): string[] {
  return [...(rooms.get(roomId)?.recipients.keys() ?? [])];
}

function onRoomChange(roomId: string) {
  const entry = rooms.get(roomId);
  const state = getRoom(roomId);
  if (!entry) return;
  // Sala borrada o reiniciada (otra ronda): el número no se guarda más allá de la ronda.
  if (!state || roomRound(roomId) !== entry.round) {
    cleanup(roomId);
    return;
  }
  if (state.allocationStatus !== "SEALED") return;
  for (const recipient of entry.recipients.values()) {
    if (recipient.sent) continue;
    recipient.sent = true;
    void deliverActa(roomId, recipient.phone).then((result) => {
      if (!result.sent && result.reason === "error") console.error("[resumen por WhatsApp]", result.message);
    });
  }
}

export type DeliveryResult = { sent: true; via: "template" | "text" } | { sent: false; reason: "not_configured" | "window_closed" | "nothing_to_say" | "error"; message?: string };

/** El acta, con la vista filtrada del Comité. Plantilla si hay; si no, texto y nota de voz dentro de la ventana de 24 h. */
export async function deliverActa(roomId: string, phone: string, now: number = Date.now()): Promise<DeliveryResult> {
  const kapso = kapsoConfig();
  if (!kapso.apiKey || !kapso.phoneNumberId) return { sent: false, reason: "not_configured" };
  const arbiter = getRoom(roomId)?.scarcity?.arbiter;
  const view = arbiter ? projectRoom(roomId, { orgId: arbiter.orgId, roleId: arbiter.roleId }, now) : undefined;
  const text = view ? actaVoiceText(view) : null;
  if (!text) return { sent: false, reason: "nothing_to_say" };
  try {
    if (templateConfigured()) {
      try {
        await sendSummaryTemplate(phone, roomId, text);
        if (windowOpen(phone, now)) await sendCommitteeVoiceNote("acta", roomId, phone, now);
        return { sent: true, via: "template" };
      } catch (error) {
        // Si la plantilla falla y la conversación está abierta, va en texto.
        if (!windowOpen(phone, now)) throw error;
      }
    }
    if (!windowOpen(phone, now)) return { sent: false, reason: "window_closed" };
    await sendText(phone, `${text}\n\nDemostración simulada de Sculptor.`);
    await sendCommitteeVoiceNote("acta", roomId, phone, now);
    return { sent: true, via: "text" };
  } catch (error) {
    return { sent: false, reason: "error", message: error instanceof Error ? error.message.slice(0, 200) : String(error) };
  }
}
