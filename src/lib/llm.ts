// Única puerta de entrada a los modelos. Todo el código llama a este módulo.
// Habla el protocolo "chat completions" compatible con OpenAI, que es lo que
// expone Ollama en el Spark (http://<spark>:11434/v1) y la mayoría de las nubes.
// Para cambiar de Spark a nube se cambian tres variables de entorno, nada más.

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function llmConfig() {
  return {
    baseUrl: (process.env.LLM_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, ""),
    apiKey: process.env.LLM_API_KEY ?? "ollama",
    model: process.env.LLM_MODEL ?? "gpt-oss:20b",
  };
}

async function request(messages: ChatMessage[], stream: boolean, signal?: AbortSignal) {
  const { baseUrl, apiKey, model } = llmConfig();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, stream }),
    signal,
  }).catch((error) => {
    if (signal?.aborted) throw error;
    throw new Error(`No se pudo conectar al modelo en ${baseUrl}. Revisa LLM_BASE_URL y que el servidor esté arriba.`);
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status} en ${baseUrl} (modelo ${model}): ${detail.slice(0, 300)}`);
  }
  return res;
}

/** Respuesta completa de una vez. */
export async function chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const res = await request(messages, false, signal);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Respuesta en streaming como texto plano, lista para devolver desde una ruta. */
export async function chatStream(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await request(messages, true, signal);
  if (!res.body) throw new Error("El endpoint del modelo no devolvió un cuerpo en streaming");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch {
          // Línea incompleta o keep-alive: se ignora.
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
