import { checkModel, llmConfig } from "@/lib/llm";

// GET /api/health: dice en un vistazo qué pieza está arriba y cuál no.
// Devuelve 503 si el modelo no responde. Para saber solo si el servidor está
// vivo (lo que necesita la plataforma de deploy) existe /api/ping.
export async function GET() {
  const { provider, baseUrl, model } = llmConfig();
  const llm = await checkModel();

  const supabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return Response.json(
    {
      llm: { provider, baseUrl, model, ...llm },
      supabase: { configured: supabase },
    },
    { status: llm.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
