// Notas de voz informativas por WhatsApp para el Comité (texto a voz de ElevenLabs
// + Kapso).
//
// Flujo: evento de la sala → resumen corto armado SOLO con la vista que el Comité
// puede ver (projectRoom con su propio rol: nunca un dato reservado) → ElevenLabs
// lo convierte a audio en español → se sube a los medios de WhatsApp vía Kapso y
// se envía como mensaje de audio.
//
// El audio es SOLO informativo: decidir sigue siendo con los botones y la razón
// escrita, que pasan por las mismas acciones que la web.
//
// Eventos:
//   (a) "case": el caso llegó al Comité (unos 20 s con el caso y la propuesta).
//   (b) "acta": la decisión quedó sellada (el acta en audio).
//
// Ventana de 24 h de WhatsApp: fuera de una conversación abierta solo se pueden
// enviar plantillas, así que el audio se envía únicamente si el Comité escribió
// o tocó un botón en las últimas 24 h (noteInbound). Si no, se omite sin error.
//
// Variables de entorno:
//   NEXO_VOICE_NOTES=1     activa las notas de voz (apagadas por defecto)
//   ELEVENLABS_API_KEY     obligatoria para sintetizar
//   ELEVENLABS_VOICE_ID    opcional: voz a usar (por defecto, Ignacio, voz chilena de la biblioteca)
//   KAPSO_*                las mismas del canal de WhatsApp (ver kapso.ts)

import type { ProjectedRoomState } from "@/lib/genome/schema";
import { getRoom, projectRoom } from "@/lib/store/rooms";
import { closeSession, getWhatsAppSessionForRoom } from "./committee-channel";
import { sendAudioMessage, uploadAudio, whatsappStatus } from "./kapso";

const TTS_API = "https://api.elevenlabs.io/v1/text-to-speech";
/** Ignacio: voz chilena, cálida y conversacional, de la biblioteca de voces de ElevenLabs. */
const DEFAULT_VOICE_ID = "mfeDHx0s0qg3oU90BXRF";
/**
 * Eleven v3: el modelo más expresivo. Entiende etiquetas de actuación entre corchetes
 * ([warmly], [breathes], [short pause]) que no se leen en voz alta: así respira, hace
 * pausas y suena como una persona y no como un lector de texto.
 */
const TTS_MODEL = "eleven_v3";
/** Estabilidad media: natural sin volverse impredecible. */
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.85 };
/** Unos 30 s de voz pausada. Cuentan solo las palabras habladas, no las etiquetas. */
export const MAX_VOICE_WORDS = 75;

/** Palabras que se dicen en voz alta: las etiquetas entre corchetes no se leen. */
export const spokenWords = (text: string) => text.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean).length;
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function voiceNotesEnabled(): boolean {
  return process.env.NEXO_VOICE_NOTES === "1" && Boolean(process.env.ELEVENLABS_API_KEY) && whatsappStatus().configured;
}

// --- Ventana de 24 h ------------------------------------------------------------

const globalStore = globalThis as unknown as { __nexoWhatsAppInbound?: Map<string, number> };
const lastInbound: Map<string, number> = (globalStore.__nexoWhatsAppInbound ??= new Map());

/** El número escribió o tocó un botón: se abre (o renueva) la ventana de 24 h. */
export function noteInbound(phone: string, now: number = Date.now()): void {
  lastInbound.set(phone.replace(/\D/g, ""), now);
}

export function windowOpen(phone: string, now: number = Date.now()): boolean {
  const at = lastInbound.get(phone.replace(/\D/g, ""));
  return at !== undefined && now - at < WHATSAPP_WINDOW_MS;
}

// --- Texto del resumen ----------------------------------------------------------

/** Recorta a un máximo de palabras habladas (las etiquetas no cuentan), cerrando con punto. */
function limitWords(text: string, max = MAX_VOICE_WORDS): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  let spoken = 0;
  const kept: string[] = [];
  for (const word of words) {
    const isTag = /^\[.*\]$/.test(word) || /^\[/.test(word) || /\]$/.test(word);
    if (!isTag) spoken += 1;
    if (spoken > max) return `${kept.join(" ").replace(/[,;:.]*$/, "")}.`;
    kept.push(word);
  }
  return kept.join(" ");
}

const score = (value: number) => value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Recurso sin el detalle entre paréntesis: «Cama UCI de referencia (derivación)» → «Cama UCI de referencia». */
const resourceName = (view: ProjectedRoomState) => (view.scarcity?.resource ?? "el recurso").replace(/\s*\([^)]*\)\s*/g, " ").trim();

/**
 * Resumen hablado del caso para el Comité. Sale de la vista proyectada del Comité,
 * así que no puede contener un costo ni otro dato reservado. No está escrito para
 * hospitales: usa el recurso, las organizaciones y las etiquetas de cada caso del
 * escenario (pacientes, obras o cargas).
 */
export function caseVoiceText(view: ProjectedRoomState): string | null {
  const allocation = view.allocation;
  if (!view.scarcity || !allocation || allocation.ranking.length === 0) return null;
  const orgName = (orgId: string) => view.orgs.find((org) => org.orgId === orgId)?.orgName ?? orgId;
  const [first, second] = allocation.ranking;
  const parts = [
    "[warmly] Hola, te hablo de Sculptor. [breathes]",
    `Mira... hay un caso para el Comité: ${resourceName(view)}.`,
    `La regla propone a ${first.patientLabel}, de ${orgName(first.orgId)}, con ${score(first.score)}... [short pause]`,
    second ? `Le sigue ${second.patientLabel}, de ${orgName(second.orgId)}.` : "",
    allocation.tieBreakApplied ? "Están casi empatados: gana quien tiene más necesidad sin cubrir." : "",
    "Los costos de cada uno no se comparten. [breathes]",
    "Toca Aprobar o Vetar... y escríbeme tu razón. [softly] Gracias.",
  ];
  return limitWords(parts.filter(Boolean).join(" "));
}

/** El acta en audio: quién recibe el recurso, quién firmó y su razón. Misma vista filtrada del Comité. */
export function actaVoiceText(view: ProjectedRoomState): string | null {
  const allocation = view.allocation;
  const decision = allocation?.committeeDecision;
  const winner = allocation?.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
  if (!view.scarcity || allocation?.status !== "SEALED" || !winner || !decision) return null;
  const orgName = view.orgs.find((org) => org.orgId === winner.orgId)?.orgName ?? winner.orgId;
  const seconds = view.stakes.timeToDecisionMs === null ? null : Math.round(view.stakes.timeToDecisionMs / 1000);
  const reason = decision.reason.replace(/\s*\(vía [^)]*\)\s*$/, "");
  return limitWords(
    [
      "[warmly] Listo, ya hay decisión. [short pause]",
      `Acta de la decisión: ${resourceName(view)} se asigna a ${winner.patientLabel}, de ${orgName}.`,
      `Firmó el ${view.scarcity.arbiter.title}. Razón: ${reason}`.replace(/\.?$/, "."),
      seconds !== null ? `[breathes] Se decidió en ${seconds} segundos.` : "",
      "El acta completa queda en la sala... [softly] Gracias por decidir.",
    ]
      .filter(Boolean)
      .join(" "),
    95,
  );
}

// --- Texto a voz -----------------------------------------------------------------

export type SpeechAudio = { bytes: Uint8Array; mimeType: string; fileName: string; voice: boolean };

const isOgg = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53; // «OggS»

async function tts(text: string, outputFormat: string): Promise<Uint8Array> {
  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey) throw new Error("Falta ELEVENLABS_API_KEY");
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const res = await fetch(`${TTS_API}/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/*" },
    body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings: VOICE_SETTINGS }),
    // v3 tarda más que los modelos rápidos; es un audio informativo, no una conversación.
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Convierte el texto a audio. Pide Opus (opus_48000_64): si llega en contenedor OGG
 * (empieza con «OggS») va como nota de voz, que es lo que WhatsApp muestra así. La
 * referencia de la API no dice el contenedor; si no es OGG, se pide MP3 y se envía
 * como audio normal.
 */
export async function synthesizeSpeech(text: string): Promise<SpeechAudio> {
  const opus = await tts(text, "opus_48000_64");
  if (isOgg(opus)) return { bytes: opus, mimeType: "audio/ogg", fileName: "sculptor.ogg", voice: true };
  const mp3 = await tts(text, "mp3_44100_64");
  return { bytes: mp3, mimeType: "audio/mpeg", fileName: "sculptor.mp3", voice: false };
}

// --- Envío ---------------------------------------------------------------------------

export type VoiceNoteKind = "case" | "acta";
export type VoiceNoteResult =
  | { sent: true; voice: boolean; words: number }
  | { sent: false; reason: "disabled" | "no_phone" | "window_closed" | "nothing_to_say" | "error"; message?: string };

/**
 * Envía una nota de voz informativa al Comité de una sala, si corresponde. Nunca
 * lanza: si está apagado, si la ventana de 24 h está cerrada o si falla un servicio,
 * devuelve por qué no se envió y el canal de WhatsApp sigue como siempre.
 */
export async function sendCommitteeVoiceNote(kind: VoiceNoteKind, roomId: string, phone: string | null, now: number = Date.now()): Promise<VoiceNoteResult> {
  if (!voiceNotesEnabled()) return { sent: false, reason: "disabled" };
  if (!phone) return { sent: false, reason: "no_phone" };
  if (!windowOpen(phone, now)) return { sent: false, reason: "window_closed" };
  const arbiter = getRoom(roomId)?.scarcity?.arbiter;
  // La vista del Comité, filtrada por el servidor como la de cualquier pantalla.
  const view = arbiter ? projectRoom(roomId, { orgId: arbiter.orgId, roleId: arbiter.roleId }, now) : undefined;
  const text = view ? (kind === "case" ? caseVoiceText(view) : actaVoiceText(view)) : null;
  if (!text) return { sent: false, reason: "nothing_to_say" };
  try {
    const audio = await synthesizeSpeech(text);
    const mediaId = await uploadAudio(audio.bytes, audio.mimeType, audio.fileName);
    await sendAudioMessage(phone, mediaId, audio.voice);
    return { sent: true, voice: audio.voice, words: text.split(" ").length };
  } catch (error) {
    return { sent: false, reason: "error", message: error instanceof Error ? error.message.slice(0, 200) : String(error) };
  }
}

/**
 * El Comité selló desde la web: si a esa sala se le envió el caso por WhatsApp,
 * también le llega el acta en audio por WhatsApp (siempre que la ventana de 24 h
 * esté abierta). La sesión de WhatsApp de esa sala se cierra: el caso ya se decidió.
 * Si el Comité decidió por WhatsApp, el webhook ya envió el acta y cerró la sesión,
 * así que aquí no se repite.
 */
export async function sendActaAfterWebSeal(roomId: string, now: number = Date.now()): Promise<VoiceNoteResult> {
  const session = getWhatsAppSessionForRoom(roomId);
  if (!session?.phone) return { sent: false, reason: "no_phone" };
  closeSession(session);
  return sendCommitteeVoiceNote("acta", roomId, session.phone, now);
}
