// WhatsApp del Comité, con Kapso.
//
// Envía al Comité el caso con dos botones (Aprobar / Vetar) y recibe su
// respuesta por un webhook (src/app/api/integrations/kapso/webhook/route.ts).
// Después del botón se le pide la razón por escrito: sin razón no se registra
// nada, igual que en la web.
//
// Variables de entorno:
//   KAPSO_API_KEY            obligatoria
//   KAPSO_PHONE_NUMBER_ID    id del número de WhatsApp conectado en Kapso
//   KAPSO_WEBHOOK_SECRET     secreto con que Kapso firma el webhook (X-Webhook-Signature)
//   NEXO_COMMITTEE_PHONE     número del Comité en formato E.164 (+569...)
//   KAPSO_TEMPLATE_NAME      opcional: plantilla aprobada por Meta (p. ej. sculptor_comite_caso).
//                            Con un número de producción, WhatsApp solo deja iniciar la
//                            conversación con una plantilla; sin ella se envían botones
//                            interactivos, que sirven en la Sandbox o dentro de las 24 h.
//   KAPSO_TEMPLATE_LANG      idioma de la plantilla, por defecto "es"

import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { verifyKapsoWebhookSignature } from "@kapso/whatsapp-cloud-api/server";

export function kapsoConfig() {
  return {
    apiKey: process.env.KAPSO_API_KEY ?? "",
    phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID ?? "",
    webhookSecret: process.env.KAPSO_WEBHOOK_SECRET ?? "",
    committeePhone: (process.env.NEXO_COMMITTEE_PHONE ?? "").replace(/\D/g, ""),
    templateName: process.env.KAPSO_TEMPLATE_NAME ?? "",
    templateLang: process.env.KAPSO_TEMPLATE_LANG || "es",
  };
}

export function whatsappStatus() {
  const config = kapsoConfig();
  return { configured: Boolean(config.apiKey && config.phoneNumberId && config.committeePhone) };
}

let client: WhatsAppClient | null = null;
function whatsapp(): WhatsAppClient {
  const { apiKey } = kapsoConfig();
  if (!apiKey) throw new Error("Falta KAPSO_API_KEY");
  return (client ??= new WhatsAppClient({ baseUrl: "https://api.kapso.ai/meta/whatsapp", kapsoApiKey: apiKey }));
}

/** Id de los botones: el webhook sabe a qué sesión y decisión corresponden. */
export const buttonId = (sessionId: string, decision: "approve" | "veto") => `nexo:${decision}:${sessionId}`;

export function parseButtonId(id: string): { decision: "approve" | "veto"; sessionId: string } | null {
  const match = /^nexo:(approve|veto):([A-Za-z0-9_-]{8,64})$/.exec(id);
  return match ? { decision: match[1] as "approve" | "veto", sessionId: match[2] } : null;
}

/** Texto apto para una variable de plantilla: Meta no acepta saltos de línea ni tabs. */
const templateParam = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max) || "-";

/**
 * Componentes de la plantilla sculptor_comite_caso: {{1}} = sala, {{2}} = recurso, y
 * los dos botones de respuesta rápida con el mismo id que los interactivos, así
 * el webhook los trata igual.
 */
export function committeeTemplateComponents(sessionId: string, room: string, resource: string) {
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: templateParam(room, 40) },
        { type: "text", text: templateParam(resource, 200) },
      ],
    },
    { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: buttonId(sessionId, "approve") }] },
    { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: buttonId(sessionId, "veto") }] },
  ];
}

/** Envía el caso con los botones Aprobar y Vetar (por plantilla si hay una configurada). */
export async function sendCommitteeCase(
  sessionId: string,
  brief: string,
  context: { room: string; resource: string } = { room: "Sculptor", resource: "recurso en disputa" },
): Promise<void> {
  const config = kapsoConfig();
  if (!config.phoneNumberId || !config.committeePhone) throw new Error("Faltan KAPSO_PHONE_NUMBER_ID o NEXO_COMMITTEE_PHONE");
  if (config.templateName) {
    await whatsapp().messages.sendTemplate({
      phoneNumberId: config.phoneNumberId,
      to: config.committeePhone,
      template: {
        name: config.templateName,
        language: { code: config.templateLang },
        components: committeeTemplateComponents(sessionId, context.room, context.resource),
      },
    });
    return;
  }
  await whatsapp().messages.sendInteractiveButtons({
    phoneNumberId: config.phoneNumberId,
    to: config.committeePhone,
    header: { type: "text", text: "Sculptor · Decisión del Comité" },
    bodyText: brief.slice(0, 1000),
    footerText: "Demostración simulada. Responder con un botón.",
    buttons: [
      { id: buttonId(sessionId, "approve"), title: "Aprobar" },
      { id: buttonId(sessionId, "veto"), title: "Vetar" },
    ],
  });
}

export async function sendText(to: string, body: string): Promise<void> {
  const config = kapsoConfig();
  if (!config.phoneNumberId) throw new Error("Falta KAPSO_PHONE_NUMBER_ID");
  await whatsapp().messages.sendText({ phoneNumberId: config.phoneNumberId, to: to.replace(/\D/g, ""), body: body.slice(0, 1500) });
}

export function verifyWebhook(rawBody: string, signatureHeader: string | null): boolean {
  const { webhookSecret } = kapsoConfig();
  if (!webhookSecret) return false;
  return verifyKapsoWebhookSignature({ secret: webhookSecret, rawBody, signatureHeader: signatureHeader ?? undefined });
}

export type IncomingMessage = { from: string; text: string | null; buttonId: string | null };

/**
 * Extrae los mensajes entrantes de un webhook. Acepta el formato de eventos de
 * Kapso (payload v2, con o sin buffering) y el formato de Meta reenviado, porque
 * ambos traen objetos de mensaje con `from` y `text` o `interactive`.
 */
export function extractIncomingMessages(payload: unknown): IncomingMessage[] {
  const found: IncomingMessage[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 8 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    const record = node as Record<string, unknown>;
    const from = typeof record.from === "string" ? record.from : null;
    const text = (record.text as { body?: unknown } | undefined)?.body;
    const interactive = record.interactive as { button_reply?: { id?: unknown }; buttonReply?: { id?: unknown } } | undefined;
    const button = (record.button as { payload?: unknown } | undefined)?.payload;
    const replyId = interactive?.button_reply?.id ?? interactive?.buttonReply?.id ?? button;
    if (from && (typeof text === "string" || typeof replyId === "string")) {
      found.push({ from: from.replace(/\D/g, ""), text: typeof text === "string" ? text : null, buttonId: typeof replyId === "string" ? replyId : null });
      return;
    }
    Object.values(record).forEach((value) => visit(value, depth + 1));
  };
  visit(payload, 0);
  return found;
}
