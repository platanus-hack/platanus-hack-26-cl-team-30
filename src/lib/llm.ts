// Única puerta de entrada a los modelos. Todo el código llama a este módulo.
//
// Dos proveedores, elegidos con LLM_PROVIDER:
//   - "openai" (por defecto): protocolo "chat completions" compatible con OpenAI,
//     que es lo que expone Ollama en el Spark o en un notebook.
//   - "anthropic": Claude a través del SDK oficial. Es lo que usa el deploy público,
//     que no puede llegar al Spark porque el Spark vive en la red local.
//
// Pasar de uno a otro es cambiar variables de entorno, sin tocar código.
//
// Toda llamada pasa por una cola que limita cuántas corren a la vez
// (LLM_MAX_CONCURRENT). chatJson pide JSON y lo valida antes de devolverlo.

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

/** Respuesta completa de una vez. Espera turno en la cola si el modelo está ocupado. */
export async function chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  await acquireSlot(signal);
  const startedAt = Date.now();
  let failed = false;
  try {
    return llmConfig().provider === "anthropic"
      ? await anthropicChat(messages, signal)
      : await openaiChat(messages, signal);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    releaseSlot(startedAt, failed);
  }
}

/**
 * Respuesta en streaming como texto plano, lista para devolver desde una ruta.
 * El turno en la cola se ocupa hasta que el stream termina, falla o se cancela.
 */
export async function chatStream(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  await acquireSlot(signal);
  const startedAt = Date.now();
  let inner: ReadableStream<Uint8Array>;
  try {
    inner =
      llmConfig().provider === "anthropic"
        ? await anthropicChatStream(messages, signal)
        : await openaiChatStream(messages, signal);
  } catch (error) {
    releaseSlot(startedAt, true);
    throw error;
  }

  const reader = inner.getReader();
  let released = false;
  const finish = (failed: boolean) => {
    if (released) return;
    released = true;
    releaseSlot(startedAt, failed);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish(false);
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        finish(true);
        controller.error(error);
      }
    },
    cancel(reason) {
      finish(false);
      return reader.cancel(reason);
    },
  });
}

/**
 * Respuesta en JSON validado. Pide un objeto JSON, lo extrae del texto, lo pasa por
 * `validate` (que debe lanzar un Error si la forma no sirve) y, si falla, reintenta
 * una sola vez mostrándole al modelo el error. Funciona igual con ambos proveedores.
 */
export async function chatJson<T>(
  messages: ChatMessage[],
  validate: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T> {
  const conversation: ChatMessage[] = [
    ...messages,
    {
      role: "system",
      content: "Responde únicamente con un objeto JSON válido. Sin texto antes ni después y sin bloques de código.",
    },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(conversation, signal);
    try {
      return validate(extractJson(text));
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      conversation.push(
        { role: "assistant", content: text || "(respuesta vacía)" },
        {
          role: "user",
          content: `Tu respuesta no sirvió: ${lastError}. Responde de nuevo solo con el objeto JSON corregido.`,
        },
      );
    }
  }
  throw new Error(`El modelo no devolvió un JSON válido tras reintentar: ${lastError}`);
}

/** Saca el primer objeto JSON de un texto, tolerando bloques de código o texto alrededor. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Sigue abajo: busca el objeto dentro del texto.
  }
  const start = trimmed.indexOf("{");
  if (start === -1) throw new Error("la respuesta no contiene un objeto JSON");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      try {
        return JSON.parse(trimmed.slice(start, i + 1));
      } catch {
        throw new Error("el objeto JSON de la respuesta está mal formado");
      }
    }
  }
  throw new Error("el objeto JSON de la respuesta está incompleto");
}

// --- Cola de concurrencia ---------------------------------------------------
//
// Limita cuántas llamadas al modelo corren a la vez (LLM_MAX_CONCURRENT, por
// defecto 2). Las demás esperan en orden de llegada. Protege el límite de uso de
// Anthropic y evita saturar el Spark cuando varios agentes piden a la vez.

type Waiter = { resolve: () => void; reject: (reason: unknown) => void; signal?: AbortSignal; onAbort?: () => void };

type QueueState = {
  running: number;
  waiting: Waiter[];
  lastLatencyMs: number | null;
  completed: number;
  failed: number;
};

// En globalThis para que la recarga en caliente de desarrollo no duplique la cola.
const globalQueue = globalThis as unknown as { __llmQueue?: QueueState };
const queue: QueueState = (globalQueue.__llmQueue ??= {
  running: 0,
  waiting: [],
  lastLatencyMs: null,
  completed: 0,
  failed: 0,
});

function maxConcurrent(): number {
  const value = Number.parseInt(process.env.LLM_MAX_CONCURRENT ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : 2;
}

function acquireSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (queue.running < maxConcurrent()) {
    queue.running++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const waiter: Waiter = { resolve, reject, signal };
    if (signal) {
      // Si quien pidió se va mientras espera, sale de la cola sin ocupar turno.
      waiter.onAbort = () => {
        const index = queue.waiting.indexOf(waiter);
        if (index !== -1) queue.waiting.splice(index, 1);
        reject(signal.reason);
      };
      signal.addEventListener("abort", waiter.onAbort, { once: true });
    }
    queue.waiting.push(waiter);
  });
}

function releaseSlot(startedAt: number, failed: boolean) {
  queue.lastLatencyMs = Date.now() - startedAt;
  if (failed) queue.failed++;
  else queue.completed++;
  queue.running--;
  while (queue.running < maxConcurrent() && queue.waiting.length > 0) {
    const next = queue.waiting.shift()!;
    if (next.onAbort) next.signal?.removeEventListener("abort", next.onAbort);
    queue.running++;
    next.resolve();
  }
}

/** Telemetría de la cola: llamadas en curso, en espera y latencia de la última. */
export function llmStats() {
  return {
    running: queue.running,
    queued: queue.waiting.length,
    maxConcurrent: maxConcurrent(),
    lastLatencyMs: queue.lastLatencyMs,
    completed: queue.completed,
    failed: queue.failed,
  };
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
