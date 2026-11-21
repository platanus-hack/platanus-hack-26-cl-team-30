import "server-only";
import { z } from "zod";
import { insertRow } from "./server";

// Solicitudes de acceso a la demo, desde el formulario de la portada.
// Tabla: public.access_requests (supabase/migrations/). La escribe solo el
// servidor; RLS activado y sin políticas.

/** Validación del formulario. Los mensajes los lee la persona que lo llena. */
export const AccessRequestSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(120, "El nombre es demasiado largo."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "El correo es demasiado largo.")
    .pipe(z.email("Ese correo no parece válido. Revisa que tenga @ y dominio.")),
  organization: z.string().trim().max(160, "El nombre de la organización es demasiado largo."),
  message: z.string().trim().max(1000, "El mensaje puede tener hasta 1.000 caracteres.").optional(),
  /** Trampa para bots: las personas no ven este campo y lo dejan vacío. */
  website: z.string().max(200).optional(),
});

export type AccessRequest = z.infer<typeof AccessRequestSchema>;

export type SaveResult = { ok: true } | { ok: false; reason: "unavailable" };

/** Guarda la solicitud. Un correo repetido cuenta como éxito; el bot que llena la trampa también, sin guardar nada. */
export async function saveAccessRequest(request: AccessRequest): Promise<SaveResult> {
  if (request.website) return { ok: true };
  const result = await insertRow("access_requests", {
    name: request.name,
    email: request.email,
    organization: request.organization,
    role: "other",
    source: "landing",
    ...(request.message ? { message: request.message } : {}),
  });
  return result.ok ? { ok: true } : { ok: false, reason: "unavailable" };
}
