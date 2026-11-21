import { rateLimited } from "@/lib/store/rate-limit";
import { getPublishedInterview } from "@/lib/supabase/interviews";

// GET /api/interviews
//   -> { interview: { name, role, organization, answers: [{ key, question, answer }], publishedAt } | null,
//        available: boolean }
// La última entrevista publicada. interview es null si no hay ninguna publicada,
// si la tabla no existe o si Supabase no responde (available: false en los dos
// últimos casos). Nunca responde error por falta de Supabase: la portada sigue.
export async function GET(request: Request) {
  const limited = rateLimited(request, "interviews");
  if (limited) return limited;
  const result = await getPublishedInterview();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
