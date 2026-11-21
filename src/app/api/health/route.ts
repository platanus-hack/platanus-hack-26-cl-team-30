import { checkModel, llmConfig } from "@/lib/llm";

// GET /api/health: dice en un vistazo si el modelo configurado responde.
// Devuelve 503 si no responde. Para saber solo si el servidor está vivo (lo que
// necesita la plataforma de deploy) existe /api/ping.
export async function GET() {
  const { provider, baseUrl, model } = llmConfig();
  const llm = await checkModel();

  return Response.json(
    { llm: { provider, baseUrl, model, ...llm } },
    { status: llm.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
