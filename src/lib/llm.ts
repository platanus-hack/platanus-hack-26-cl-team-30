// Única puerta de entrada a los modelos. Todo el código llama a este módulo.
//
// Dos proveedores, elegidos con LLM_PROVIDER:
//   - "openai" (por defecto): protocolo "chat completions" compatible con OpenAI,
//     que es lo que expone Ollama en el Spark o en un notebook.
//   - "anthropic": Claude a través del SDK oficial. Es lo que usa el deploy público,
//     que no puede llegar al Spark porque el Spark vive en la red local.
//
// Pasar de uno a otro es cambiar variables de entorno, sin tocar código.

import Anthropic from "@anthropic-ai/sdk";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Provider = "openai" | "anthropic";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export function llmConfig() {
  const provider: Provider = process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "openai";
  if (provider === "anthropic") {
    return {
      provider,
      baseUrl: "https://api.anthropic.com",
      apiKey: "",
      model: process.env.LLM_MODEL ?? "claude-opus-5-5",
      effort: (process.env.LLM_EFFORT ?? "medium") as Effort,
    };
  }
  return {
    provider,
    baseUrl: (process.env.LLM_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, ""),
    apiKey: process.env.LLM_API_KEY ?? "ollama",
    model: process.env.LLM_MODEL ?? "gpt-oss:20b",
    effort: "medium" as Effort,
  };
}

/** Respuesta completa de una vez. */
export async function chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  return llmConfig().provider === "anthropic"
    ? anthropicChat(messages, signal)
    : openaiChat(messages, signal);
}

/** Respuesta en streaming como texto plano, lista para devolver desde una ruta. */
export async function chatStream(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  return llmConfig().provider === "anthropic"
    ? anthropicChatStream(messages, signal)
    : openaiChatStream(messages, signal);
}

/** Comprueba que el proveedor configurado responde y que el modelo existe. */
export async function checkModel(): Promise<{ ok: boolean; detail: string }> {
  const { provider, baseUrl, apiKey, model } = llmConfig();
  try {
    if (provider === "anthropic") {
      await anthropicClient().models.retrieve(model, {}, { timeout: 4000, maxRetries: 0 });
      return { ok: true, detail: "Claude disponible" };
    }
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const data = await res.json();
    const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id);
    return ids.includes(model)
      ? { ok: true, detail: `${ids.length} modelos disponibles` }
      : { ok: false, detail: `El modelo ${model} no está en el servidor. Hay: ${ids.join(", ") || "ninguno"}` };
  } catch (error) {
    return { ok: false, detail: describeError(error) };
  }
}

// --- Claude (SDK oficial) ---------------------------------------------------

let cachedClient: Anthropic | null = null;

// El SDK lee ANTHROPIC_API_KEY del entorno.
function anthropicClient() {
  return (cachedClient ??= new Anthropic());
}

// Si el modelo declina una petición, la API la reintenta sola en un modelo de respaldo.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function anthropicParams(messages: ChatMessage[], maxTokens: number) {
  const { model, effort } = llmConfig();
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  return {
    model,
    max_tokens: maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default" as const,
    output_config: { effort },
    ...(system ? { system } : {}),
    messages: turns,
  };
}

async function anthropicChat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const stream = anthropicClient().beta.messages.stream(anthropicParams(messages, 64000), { signal });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("El modelo declinó responder esta petición.");
  }
  let text = "";
  for (const block of message.content) {
    if (block.type === "text") text += block.text;
  }
  return text;
}

async function anthropicChatStream(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const stream = anthropicClient().beta.messages.stream(anthropicParams(messages, 64000), { signal });
  const events = stream[Symbol.asyncIterator]();
  const encoder = new TextEncoder();

  // Se espera el primer evento antes de devolver el stream: así un error de
  // credenciales o de modelo sale como excepción y la ruta puede responder 502.
  let pending: IteratorResult<Awaited<ReturnType<typeof events.next>>["value"]> | null =
    await events.next();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const current = pending ?? (await events.next());
          pending = null;
          if (current.done) {
            controller.close();
            return;
          }
          const event = current.value;
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      stream.abort();
    },
  });
}

// --- Compatible con OpenAI (Ollama en el Spark o en un notebook) -------------

async function openaiRequest(messages: ChatMessage[], stream: boolean, signal?: AbortSignal) {
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

async function openaiChat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const res = await openaiRequest(messages, false, signal);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function openaiChatStream(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await openaiRequest(messages, true, signal);
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

// --- Errores ----------------------------------------------------------------

/** Mensaje legible para mostrar al usuario o registrar, sin filtrar credenciales. */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Credencial de Anthropic inválida o ausente. Revisa ANTHROPIC_API_KEY.";
  }
  if (error instanceof Anthropic.NotFoundError) {
    return `El modelo ${llmConfig().model} no existe o no está disponible para esta cuenta.`;
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Límite de uso de Anthropic alcanzado. Reintenta en unos segundos.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "No se pudo conectar con la API de Anthropic.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Error de la API de Anthropic (${error.status ?? "sin código"}).`;
  }
  return error instanceof Error ? error.message : "Error desconocido";
}
