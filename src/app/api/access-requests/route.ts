import { AccessRequestSchema, saveAccessRequest } from "@/lib/supabase/access-requests";
import { readJsonBody } from "@/lib/store/http";
import { rateLimited } from "@/lib/store/rate-limit";

// POST /api/access-requests  body { name, email, organization, message? }
//   -> { ok: true }
//   -> { error, code } con 400 BAD_REQUEST (el mensaje dice qué corregir),
//      429 RATE_LIMITED, o 503 STORAGE_UNAVAILABLE si Supabase o la tabla no están.
// Un correo ya registrado también responde { ok: true }: no se revela quién se inscribió.
export async function POST(request: Request) {
  const limited = rateLimited(request, "accessRequest");
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (!body.ok) return Response.json({ error: body.error, code: "BAD_REQUEST" }, { status: 400 });
  const parsed = AccessRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const saved = await saveAccessRequest(parsed.data);
  if (!saved.ok) {
    return Response.json(
      { error: "Por ahora no podemos guardar tu solicitud. Intenta más tarde o escríbenos directamente.", code: "STORAGE_UNAVAILABLE" },
      { status: 503 },
    );
  }
  return Response.json({ ok: true });
}
