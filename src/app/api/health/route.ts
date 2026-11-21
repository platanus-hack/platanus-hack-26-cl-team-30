import { llmConfig } from "@/lib/llm";

// GET /api/health: dice en un vistazo qué pieza está arriba y cuál no.
export async function GET() {
  const { baseUrl, apiKey, model } = llmConfig();

  let llm: { ok: boolean; detail: string };
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      llm = { ok: false, detail: `HTTP ${res.status}` };
    } else {
      const data = await res.json();
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id);
      llm = ids.includes(model)
        ? { ok: true, detail: `${ids.length} modelos disponibles` }
        : { ok: false, detail: `El modelo ${model} no está en el servidor. Hay: ${ids.join(", ") || "ninguno"}` };
    }
  } catch (error) {
    llm = { ok: false, detail: error instanceof Error ? error.message : "sin conexión" };
  }

  const supabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return Response.json(
    {
      llm: { baseUrl, model, ...llm },
      supabase: { configured: supabase },
    },
    { status: llm.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
