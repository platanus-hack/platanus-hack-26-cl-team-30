import "server-only";
import { selectRows } from "./server";

// Entrevistas publicadas, para la portada. Tabla public.clinic_interviews
// (supabase/migrations/). Se publica una a mano, poniendo published_at en el
// panel de Supabase después de revisarla. La lee solo el servidor.

/** Preguntas de la entrevista. Las claves se guardan en la base: no renombrarlas. */
export const INTERVIEW_QUESTIONS = [
  { key: "q_today", question: "Cuando hay un solo recurso y dos casos que lo necesitan, ¿cómo se decide hoy quién lo recibe?" },
  { key: "q_channel", question: "¿Por dónde pasa esa conversación: teléfono, WhatsApp, planillas, correo?" },
  { key: "q_missing", question: "¿Qué dato de la otra organización necesitas para decidir y casi nunca llega a tiempo?" },
  { key: "q_private", question: "¿Qué dato tuyo no podrías compartir con otra organización, aunque ayudara a decidir?" },
  { key: "q_trust", question: "Si decidiera una regla conocida y un comité que firma con su razón, ¿qué te daría confianza y qué te preocuparía?" },
] as const;

export type PublishedInterview = {
  name: string;
  role: string;
  /** Organización de quien respondió (columna clinic de la tabla). */
  organization: string;
  /** Solo las preguntas respondidas, en el orden de la entrevista. */
  answers: { key: string; question: string; answer: string }[];
  publishedAt: string;
};

type Row = { name: string; role: string; clinic: string; answers: Record<string, unknown> | null; published_at: string };

const CACHE_MS = 5 * 60 * 1000;
const CACHE_EMPTY_MS = 60 * 1000;
let cache: { at: number; value: PublishedInterview | null; available: boolean } | null = null;

/**
 * La última entrevista publicada, o null si no hay, si la tabla no existe o si
 * Supabase no responde. available dice si se pudo consultar. Se guarda en
 * memoria unos minutos para no consultar en cada visita.
 */
export async function getPublishedInterview(now: number = Date.now()): Promise<{ interview: PublishedInterview | null; available: boolean }> {
  if (cache && now - cache.at < (cache.value ? CACHE_MS : CACHE_EMPTY_MS)) return { interview: cache.value, available: cache.available };
  const result = await selectRows<Row>(
    "clinic_interviews",
    "select=name,role,clinic,answers,published_at&published_at=not.is.null&order=published_at.desc&limit=1",
  );
  const row = result.ok ? result.rows[0] : undefined;
  const value: PublishedInterview | null = row
    ? {
        name: row.name,
        role: row.role,
        organization: row.clinic,
        answers: INTERVIEW_QUESTIONS.flatMap(({ key, question }) => {
          const answer = row.answers?.[key];
          return typeof answer === "string" && answer.trim() ? [{ key, question, answer }] : [];
        }),
        publishedAt: row.published_at,
      }
    : null;
  cache = { at: now, value, available: result.ok };
  return { interview: value, available: result.ok };
}

/** Solo para pruebas: olvida la entrevista guardada en memoria. */
export function resetInterviewCache(): void {
  cache = null;
}
