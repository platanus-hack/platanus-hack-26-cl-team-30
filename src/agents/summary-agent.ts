// Agente de ejemplo, neutro respecto de la idea final: resume lo que su rol ve en
// la sala y propone un siguiente paso. Sirve de plantilla para los agentes reales.
//
// Entrada: una pregunta opcional de la persona que tiene el rol.
// Salida: { resumen, siguientePaso, confianza }.

import { asRecord, requireOneOf, requireString, type RoleAgent } from "./base";
import type { Viewer } from "@/lib/rooms";

export type SummaryInput = { pregunta?: string };

export type SummaryOutput = {
  resumen: string;
  siguientePaso: string;
  confianza: "baja" | "media" | "alta";
};

const INSTRUCTION = `Eres el asistente de un rol dentro de una sala colaborativa.
Resumes en dos o tres frases lo que tu rol sabe y propones un único siguiente paso concreto.
Escribe en español, en tono directo. Si faltan datos para decidir, dilo y baja la confianza.`;

const OUTPUT_FORMAT = `{
  "resumen": "texto de dos o tres frases",
  "siguientePaso": "una acción concreta para este rol",
  "confianza": "baja" | "media" | "alta"
}`;

const CONFIDENCE = ["baja", "media", "alta"] as const;

export function summaryAgent(roleId: Viewer): RoleAgent<SummaryInput, SummaryOutput> {
  return {
    id: `summary:${roleId}`,
    roleId,
    instruction: INSTRUCTION,
    outputFormat: OUTPUT_FORMAT,
    task: ({ pregunta }) =>
      pregunta?.trim()
        ? `Responde esta pregunta de la persona del rol usando solo la vista: ${pregunta.trim()}`
        : "Resume la situación actual y propone el siguiente paso.",
    validate: (value) => {
      const record = asRecord(value);
      return {
        resumen: requireString(record, "resumen", 800),
        siguientePaso: requireString(record, "siguientePaso", 300),
        confianza: requireOneOf(record, "confianza", CONFIDENCE),
      };
    },
  };
}
