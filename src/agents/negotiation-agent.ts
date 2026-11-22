// Agente de negociación (ronda 20). Redacta UNA frase por llamada: el consejo
// privado a la persona de su rol, o el argumento público de su organización.
//
// La IA escribe, el código decide. Este agente no decide nada: no elige ganador,
// no cambia puntajes ni posturas. Recibe solo la vista proyectada de su rol (la
// misma que ve la persona en su celular) y devuelve texto. Antes de publicarse,
// el almacén pasa ese texto por un filtro que busca los valores reservados de la
// sala (containsReserved en src/lib/engine/negotiation.ts); si aparece uno, o si
// esta llamada falla o tarda más de 6 s, se publica el texto de respaldo.
//
// Toda llamada al modelo pasa por src/lib/llm.ts.

import { z } from "zod";
import type { ProjectedRoomState } from "../lib/genome/schema";
import { AGENT_MAX_TOKENS, chatJson, type ChatMessage } from "../lib/llm";

export type NegotiationLineInput = {
  /** Vista proyectada del rol que habla: ya filtrada por el servidor. */
  view: ProjectedRoomState;
  /** advice: consejo privado a su persona. argument: frase pública en la negociación. */
  kind: "advice" | "argument";
  /** «Clínica · Urgencias». */
  seatLabel: string;
  /** Recurso en disputa, con artículo: «la cama». */
  resource: string;
  /** Qué hace el rol: presenta el caso, administra el presupuesto o decide. */
  role: "presenta" | "administra" | "decide";
  /** Postura que eligió la persona (argument) o null si todavía no elige (advice). */
  position: string | null;
  /** Posturas entre las que puede elegir (advice). */
  options: string[];
  /** Lo dicho hasta ahora en público, para no repetir. */
  transcript: { agentLabel: string; text: string }[];
  signal?: AbortSignal;
};

/** Formato de salida: un objeto JSON con una sola frase. */
const OUTPUT_FORMAT = `{"text": "una sola frase"}`;
const LineSchema = z.object({ text: z.string().trim().min(1).max(400) });

/** Un argumento cabe en dos líneas de la pantalla grande (unos 110 caracteres); un consejo puede ser algo más largo. */
const MAX_WORDS = { advice: 30, argument: 18 } as const;

function buildInstruction(input: NegotiationLineInput): string {
  const common = [
    `Eres el agente de «${input.seatLabel}» en una negociación entre organizaciones por ${input.resource}.`,
    "Escribes en español de Chile, claro y sin jerga.",
    `Escribe UNA sola frase de máximo ${MAX_WORDS[input.kind] - 2} palabras${input.kind === "argument" ? " y 110 caracteres" : ""}.`,
    "Nunca escribas cifras de costo, presupuesto ni topes, ni ningún dato marcado como (reservado): habla de eso solo en general.",
    "No inventes datos. No decides quién gana: eso lo calcula una regla fija y lo firma el Comité.",
    `Responde solo con este JSON: ${OUTPUT_FORMAT}`,
  ];
  if (input.kind === "advice") {
    return [
      ...common,
      "Le hablas en privado a la persona de tu rol, de tú. Dile qué postura le conviene y por qué, en una frase.",
      `Sus opciones: ${input.options.map((option) => `«${option}»`).join(", ")}.`,
    ].join("\n");
  }
  return [
    ...common,
    "Hablas en público, ante las otras organizaciones y el Comité, en primera persona del plural.",
    `Defiende a tu organización según su postura: «${input.position ?? "pedir el recurso"}».`,
    "No repitas lo que ya se dijo.",
  ].join("\n");
}

function buildUserMessage(input: NegotiationLineInput): string {
  const { view } = input;
  const me = view.viewer === "stage" ? null : view.viewer;
  const lines: string[] = [`Recurso en disputa: ${view.scarcity?.resource ?? input.resource}. ${view.scarcity?.deadlineLabel ?? ""}`.trim()];
  const names = new Map(view.orgs.map((org) => [org.orgId, org.orgName]));
  for (const candidate of view.scarcity?.candidates ?? []) {
    const mine = me?.orgId === candidate.orgId ? " (tu organización)" : "";
    lines.push(
      `- ${candidate.patientLabel} de ${names.get(candidate.orgId) ?? candidate.orgId}${mine}: gravedad ${candidate.clinicalSeverityScore}, urgencia ${candidate.timeCriticality}, riesgo por demora ${candidate.delayRiskScore}, necesidad sin cubrir ${candidate.unmetNeedScore}`,
    );
  }
  const own = view.orgs.find((org) => org.orgId === me?.orgId);
  if (own) {
    const visible = own.fields.filter((field) => !field.redacted);
    if (visible.length) {
      lines.push("", "Datos que ve tu rol (los marcados no se pueden citar):");
      for (const field of visible) {
        if (field.redacted) continue;
        const reserved = field.classification !== "public" ? " (reservado)" : "";
        lines.push(`- ${field.label}: ${field.value}${field.unit ? ` ${field.unit}` : ""}${reserved}`);
      }
    }
  }
  if (input.transcript.length) {
    lines.push("", "Ya se dijo:");
    for (const message of input.transcript.slice(-6)) lines.push(`- ${message.agentLabel}: ${message.text}`);
  }
  lines.push("", input.kind === "advice" ? "Escribe tu consejo." : "Escribe tu argumento.");
  return lines.join("\n");
}

function limitWords(text: string, max: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  return words.length <= max ? words.join(" ") : `${words.slice(0, max).join(" ").replace(/[,;:]$/, "")}…`;
}

/**
 * Pide una frase al modelo. Lanza si el modelo falla o no devuelve el JSON pedido:
 * quien llama (el almacén) usa entonces el texto de respaldo.
 */
export async function writeNegotiationLine(input: NegotiationLineInput): Promise<{ text: string }> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildInstruction(input) },
    { role: "user", content: buildUserMessage(input) },
  ];
  const raw = await chatJson(messages, (value) => LineSchema.parse(value), { maxTokens: AGENT_MAX_TOKENS, thinking: false, signal: input.signal });
  return { text: limitWords(raw.text, MAX_WORDS[input.kind]) };
}
