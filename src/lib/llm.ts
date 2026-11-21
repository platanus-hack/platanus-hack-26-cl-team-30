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
// Qué hace esta capa además de llamar al modelo:
//   - Cola: limita cuántas llamadas corren a la vez (LLM_MAX_CONCURRENT).
//   - Límite de tokens por llamada (opción maxTokens).
//   - Llamadas rápidas (opción thinking: false): reduce o apaga el razonamiento.
//   - chatJson: pide JSON, lo extrae, lo valida y reintenta una vez.
//   - Telemetría veraz (getTelemetry): dice si el modelo es local o de nube y
//     cuántos bytes salieron hacia la nube. Nunca es un "0" fijo.

import Anthropic from "@anthropic-ai/sdk";
import type { Telemetry } from "./genome/schema";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  signal?: AbortSignal;
  /** Tope de tokens de la respuesta. Sin valor, el proveedor usa su máximo. */
  maxTokens?: number;
  /**
   * false = llamada rápida (genoma, turno de agente): se apaga el razonamiento si el
   * servidor lo permite y, si no, se reduce. Sin valor, decide el servidor.
   */
  thinking?: boolean;
};

/** Topes del plan para las dos llamadas rápidas. */
export const GENOME_MAX_TOKENS = 900;
export const AGENT_MAX_TOKENS = 140;

type Provider = "openai" | "anthropic";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export function llmConfig() {
  const provider: Provider = process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "openai";
  if (provider === "anthropic") {
    return {
      provider,
      baseUrl: (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
      apiKey: "",
      model: process.env.LLM_MODEL || "claude-opus-5-5",
      effort: (process.env.LLM_EFFORT || "medium") as Effort,
    };
  }
  return {
    provider,
    baseUrl: (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, ""),
    apiKey: process.env.LLM_API_KEY || "ollama",
    model: process.env.LLM_MODEL || "gpt-oss:20b",
    effort: "medium" as Effort,
  };
}

// --- Local o nube ------------------------------------------------------------

/**
 * true si el nombre o la IP solo existen dentro de la máquina o de una red privada:
 * localhost, rangos privados (10.x, 172.16-31.x, 192.168.x), enlace local, el rango
 * 100.64/10 que usan las VPN tipo Tailscale, y nombres sin punto ("spark"), que
 * solo resuelven dentro de la red local o la VPN. Cualquier otro host es nube.
 */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || /\.(localhost|local|lan|internal)$/.test(host)) return true;
  if (host.includes(":")) return host === "::1" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  return host !== "" && !host.includes(".");
}

/** A qué host se le habla y si queda dentro de la red propia. Claude siempre es nube. */
export function llmEndpoint(): { host: string; locality: "local" | "cloud" } {
  const { provider, baseUrl } = llmConfig();
  try {
    const url = new URL(baseUrl);
    return {
      host: url.host,
      locality: provider === "openai" && isLocalHost(url.hostname) ? "local" : "cloud",
    };
  } catch {
    // URL mal escrita: no se puede afirmar que sea local.
    return { host: "desconocido", locality: "cloud" };
  }
}

// --- API pública -------------------------------------------------------------

/** Respuesta completa de una vez. Espera turno en la cola si el modelo está ocupado. */
export async function chat(messages: ChatMessage[], options?: ChatOptions | AbortSignal): Promise<string> {
  return (await complete(messages, normalizeOptions(options))).text;
}

/**
 * Respuesta en streaming como texto plano, lista para devolver desde una ruta.
 * El turno en la cola se ocupa hasta que el stream termina, falla o se cancela.
 */
export async function chatStream(
  messages: ChatMessage[],
  options?: ChatOptions | AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const opts = normalizeOptions(options);
  await acquireSlot(opts.signal);
  const startedAt = Date.now();
  let source: ProviderStream;
  try {
    source =
      llmConfig().provider === "anthropic"
        ? await anthropicChatStream(messages, opts)
        : await openaiChatStream(messages, opts);
  } catch (error) {
    finishCall(startedAt, null);
    throw error;
  }

  const reader = source.stream.getReader();
  let bytes = 0;
  let finished = false;
  const finish = (ok: boolean) => {
    if (finished) return;
    finished = true;
    // Texto en español: unos 4 bytes por token cuando el servidor no informa el uso.
    finishCall(startedAt, ok ? { outputTokens: source.outputTokens(), textLength: bytes } : null);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish(true);
          controller.close();
          return;
        }
        bytes += value.byteLength;
        controller.enqueue(value);
      } catch (error) {
        finish(false);
        controller.error(error);
      }
    },
    cancel(reason) {
      finish(true);
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
  options?: ChatOptions | AbortSignal,
): Promise<T> {
  const opts = normalizeOptions(options);
  const conversation = withJsonInstruction(messages);

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, truncated } = await complete(conversation, opts);
    try {
      return validate(extractJson(text));
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (truncated) lastError += " (la respuesta se cortó por el límite de tokens: usa textos más cortos)";
      conversation.push(
        { role: "assistant", content: text || "(respuesta vacía)" },
        {
          role: "user",
          content: `Tu respuesta no sirvió: ${lastError}. Responde de nuevo solo con el objeto JSON completo y corregido.`,
        },
      );
    }
  }
  throw new Error(`El modelo no devolvió un JSON válido tras reintentar: ${lastError}`);
}

const JSON_INSTRUCTION =
  "Responde únicamente con un objeto JSON válido. Sin texto antes ni después y sin bloques de código.";

// La instrucción va en el primer mensaje de sistema: algunos modelos locales
// ignoran un mensaje de sistema que llega después del turno del usuario.
function withJsonInstruction(messages: ChatMessage[]): ChatMessage[] {
  const index = messages.findIndex((message) => message.role === "system");
  if (index === -1) return [{ role: "system", content: JSON_INSTRUCTION }, ...messages];
  return messages.map((message, i) =>
    i === index ? { ...message, content: `${message.content}\n\n${JSON_INSTRUCTION}` } : message,
  );
}

/** Saca el primer objeto JSON de un texto, tolerando razonamiento, bloques de código o texto alrededor. */
export function extractJson(text: string): unknown {
  const trimmed = stripThinking(text).replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
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

/**
 * Quita el razonamiento que algunos modelos locales escriben dentro de la respuesta:
 * bloques <think>…</think>, un cierre suelto (la plantilla omitió la apertura) y un
 * bloque sin cerrar (la respuesta se cortó mientras razonaba).
 */
export function stripThinking(text: string): string {
  let out = text.replace(/<(think|thinking)>[\s\S]*?<\/\1>/gi, "");
  const strayClose = out.search(/<\/(think|thinking)>/i);
  if (strayClose !== -1) out = out.slice(strayClose).replace(/^<\/(think|thinking)>/i, "");
  const unclosed = out.search(/<(think|thinking)>/i);
  if (unclosed !== -1) out = out.slice(0, unclosed);
  return out.trim();
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

// --- Cola de concurrencia y telemetría ---------------------------------------
//
// Limita cuántas llamadas al modelo corren a la vez. Las demás esperan en orden de
// llegada. Por defecto 1 en el proveedor local (el Spark atiende una generación a
// la vez sin degradarse) y 2 en Claude. LLM_MAX_CONCURRENT lo cambia.

type Waiter = { resolve: () => void; reject: (reason: unknown) => void; signal?: AbortSignal; onAbort?: () => void };

type LlmState = {
  running: number;
  waiting: Waiter[];
  lastLatencyMs: number | null;
  tokensPerSec: number;
  /** true si la última velocidad se estimó por largo del texto porque el servidor no informó tokens. */
  tokensEstimated: boolean;
  /** Bytes de cuerpo de petición enviados a un host que no es local. */
  bytesSentToCloud: number;
  completed: number;
  failed: number;
  /** El servidor local devolvió razonamiento en su última respuesta. */
  reasoningSeen: boolean;
  /** Valor de LLM_NO_THINK_BODY que el servidor rechazó con un 400. */
  noThinkRejected: string | null;
};

// En globalThis para que la recarga en caliente de desarrollo no duplique el estado.
const globalState = globalThis as unknown as { __llmState?: LlmState };
const state: LlmState = (globalState.__llmState ??= {
  running: 0,
  waiting: [],
  lastLatencyMs: null,
  tokensPerSec: 0,
  tokensEstimated: false,
  bytesSentToCloud: 0,
  completed: 0,
  failed: 0,
  reasoningSeen: false,
  noThinkRejected: null,
});

function maxConcurrent(): number {
  const value = Number.parseInt(process.env.LLM_MAX_CONCURRENT ?? "", 10);
  if (Number.isFinite(value) && value > 0) return value;
  return llmConfig().provider === "anthropic" ? 2 : 1;
}

function acquireSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (state.running < maxConcurrent()) {
    state.running++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const waiter: Waiter = { resolve, reject, signal };
    if (signal) {
      // Si quien pidió se va mientras espera, sale de la cola sin ocupar turno.
      waiter.onAbort = () => {
        const index = state.waiting.indexOf(waiter);
        if (index !== -1) state.waiting.splice(index, 1);
        reject(signal.reason);
      };
      signal.addEventListener("abort", waiter.onAbort, { once: true });
    }
    state.waiting.push(waiter);
  });
}

/** Cierra una llamada: registra latencia y velocidad, y le da el turno a la siguiente. */
function finishCall(startedAt: number, result: { outputTokens: number | null; textLength: number } | null) {
  const elapsedMs = Date.now() - startedAt;
  state.lastLatencyMs = elapsedMs;
  if (result) {
    state.completed++;
    const tokens = result.outputTokens ?? result.textLength / 4;
    state.tokensEstimated = result.outputTokens === null;
    state.tokensPerSec = Math.round((tokens / Math.max(elapsedMs, 1)) * 10000) / 10;
  } else {
    state.failed++;
  }
  state.running--;
  while (state.running < maxConcurrent() && state.waiting.length > 0) {
    const next = state.waiting.shift()!;
    if (next.onAbort) next.signal?.removeEventListener("abort", next.onAbort);
    state.running++;
    next.resolve();
  }
}

/** Suma al contador solo lo que sale hacia un host que no es local. */
function countSentBytes(body: string) {
  if (llmEndpoint().locality === "cloud") state.bytesSentToCloud += Buffer.byteLength(body, "utf8");
}

/**
 * Telemetría del modelo con la forma de TelemetrySchema. Dice la verdad:
 *   - provider es "local" solo si el host es de la máquina o de una red privada.
 *   - bytesSentToCloud cuenta el cuerpo de cada petición enviada a un host de nube
 *     desde que arrancó el proceso (sin cabeceras ni reintentos internos del SDK).
 *     Queda en 0 únicamente cuando todo se habló con un host local.
 *   - tokensPerSec es de la última llamada; si el servidor no informa tokens se
 *     estima por largo del texto (llmStats().tokensEstimated lo indica).
 */
export function getTelemetry(): Telemetry {
  const { host, locality } = llmEndpoint();
  return {
    modelName: llmConfig().model,
    provider: locality,
    endpointHost: host,
    bytesSentToCloud: state.bytesSentToCloud,
    queueDepth: state.waiting.length,
    lastLatencyMs: state.lastLatencyMs ?? 0,
    tokensPerSec: state.tokensPerSec,
  };
}

/** Detalle interno de la cola, para diagnóstico. La interfaz usa getTelemetry(). */
export function llmStats() {
  const noThink = noThinkBody();
  return {
    running: state.running,
    queued: state.waiting.length,
    maxConcurrent: maxConcurrent(),
    lastLatencyMs: state.lastLatencyMs,
    tokensPerSec: state.tokensPerSec,
    tokensEstimated: state.tokensEstimated,
    bytesSentToCloud: state.bytesSentToCloud,
    completed: state.completed,
    failed: state.failed,
    reasoningSeen: state.reasoningSeen,
    noThink:
      llmConfig().provider === "anthropic"
        ? ("effort low" as const)
        : noThink === null
          ? ("sin configurar" as const)
          : noThink === "invalid"
            ? ("LLM_NO_THINK_BODY no es un objeto JSON" as const)
            : state.noThinkRejected === process.env.LLM_NO_THINK_BODY
              ? ("rechazado por el servidor" as const)
              : ("activo" as const),
  };
}

// --- Núcleo común --------------------------------------------------------------

type Completion = { text: string; outputTokens: number | null; truncated: boolean };
type ProviderStream = { stream: ReadableStream<Uint8Array>; outputTokens: () => number | null };

function normalizeOptions(options?: ChatOptions | AbortSignal): ChatOptions {
  if (!options) return {};
  return options instanceof AbortSignal ? { signal: options } : options;
}

async function complete(messages: ChatMessage[], options: ChatOptions): Promise<Completion> {
  await acquireSlot(options.signal);
  const startedAt = Date.now();
  let result: Completion | null = null;
  try {
    result =
      llmConfig().provider === "anthropic"
        ? await anthropicChat(messages, options)
        : await openaiChat(messages, options);
    return result;
  } finally {
    finishCall(startedAt, result && { outputTokens: result.outputTokens, textLength: Buffer.byteLength(result.text) });
  }
}

/**
 * Tokens extra para razonamiento. El razonamiento cuenta dentro del tope de tokens,
 * así que un tope chico (140) deja la respuesta vacía si el modelo razona. Se suma
 * este margen cuando se sabe que el modelo razona. LLM_REASONING_HEADROOM lo cambia.
 */
function reasoningHeadroom(): number {
  const value = Number.parseInt(process.env.LLM_REASONING_HEADROOM ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : 1024;
}

// --- Claude (SDK oficial) ---------------------------------------------------

let cachedClient: Anthropic | null = null;

// El SDK lee ANTHROPIC_API_KEY del entorno.
function anthropicClient() {
  return (cachedClient ??= new Anthropic());
}

// Si el modelo declina una petición, la API la reintenta sola en un modelo de respaldo.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function anthropicParams(messages: ChatMessage[], options: ChatOptions) {
  const { model, effort } = llmConfig();
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const params = {
    model,
    // En Claude Opus 5.5 el razonamiento no se puede apagar y cuenta dentro de
    // max_tokens: al tope pedido se le suma el margen de razonamiento.
    max_tokens: options.maxTokens !== undefined ? options.maxTokens + reasoningHeadroom() : 64000,
    betas: [FALLBACK_BETA],
    fallbacks: "default" as const,
    // Llamada rápida: el único control de razonamiento es bajar el esfuerzo.
    output_config: { effort: options.thinking === false ? ("low" as const) : effort },
    ...(system ? { system } : {}),
    messages: turns,
  };
  countSentBytes(JSON.stringify(params));
  return params;
}

async function anthropicChat(messages: ChatMessage[], options: ChatOptions): Promise<Completion> {
  const stream = anthropicClient().beta.messages.stream(anthropicParams(messages, options), { signal: options.signal });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("El modelo declinó responder esta petición.");
  }
  let text = "";
  for (const block of message.content) {
    if (block.type === "text") text += block.text;
  }
  return { text, outputTokens: message.usage.output_tokens, truncated: message.stop_reason === "max_tokens" };
}

async function anthropicChatStream(messages: ChatMessage[], options: ChatOptions): Promise<ProviderStream> {
  const stream = anthropicClient().beta.messages.stream(anthropicParams(messages, options), { signal: options.signal });
  const events = stream[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  let outputTokens: number | null = null;

  // Se espera el primer evento antes de devolver el stream: así un error de
  // credenciales o de modelo sale como excepción y la ruta puede responder 502.
  let pending: IteratorResult<Awaited<ReturnType<typeof events.next>>["value"]> | null =
    await events.next();

  const body = new ReadableStream<Uint8Array>({
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
          if (event.type === "message_delta") outputTokens = event.usage.output_tokens;
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
  return { stream: body, outputTokens: () => outputTokens };
}

// --- Compatible con OpenAI (Ollama en el Spark o en un notebook) -------------

/**
 * Campos extra que apagan el razonamiento en llamadas rápidas (thinking: false).
 *
 * SIN VERIFICAR: el nombre exacto del parámetro depende del servidor y del modelo,
 * y todavía no se probó contra el Spark. Por eso no se asume ninguno: se configura
 * en LLM_NO_THINK_BODY como un objeto JSON que se mezcla en el cuerpo de la petición.
 * Candidatos a probar: {"reasoning_effort":"none"}, {"think":false} o
 * {"chat_template_kwargs":{"enable_thinking":false}}.
 *
 * Si el servidor rechaza el campo con un 400, la llamada se repite sin él y no se
 * vuelve a enviar. Si el modelo razona igual, se suma margen de tokens (ver
 * reasoningHeadroom) y el razonamiento se descarta antes de leer la respuesta.
 */
function noThinkBody(): Record<string, unknown> | "invalid" | null {
  const raw = process.env.LLM_NO_THINK_BODY?.trim();
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // Cae abajo.
  }
  return "invalid";
}

async function openaiRequest(messages: ChatMessage[], stream: boolean, options: ChatOptions, extraTokens = 0) {
  const { baseUrl, apiKey, model } = llmConfig();
  const noThink = noThinkBody();
  const rawNoThink = process.env.LLM_NO_THINK_BODY ?? null;
  const useNoThink =
    options.thinking === false && noThink !== null && noThink !== "invalid" && state.noThinkRejected !== rawNoThink;

  const send = async (withNoThink: boolean) => {
    const body = JSON.stringify({
      ...(withNoThink ? (noThink as Record<string, unknown>) : {}),
      model,
      messages,
      stream,
      ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens + extraTokens } : {}),
    });
    countSentBytes(body);
    return fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
      signal: options.signal,
    }).catch((error) => {
      if (options.signal?.aborted) throw error;
      throw new Error(`No se pudo conectar al modelo en ${baseUrl}. Revisa LLM_BASE_URL y que el servidor esté arriba.`);
    });
  };

  let res = await send(useNoThink);
  if (res.status === 400 && useNoThink) {
    // Puede que el servidor no conozca el campo: se prueba sin él.
    const retry = await send(false);
    if (retry.ok) state.noThinkRejected = rawNoThink;
    res = retry;
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status} en ${baseUrl} (modelo ${model}): ${detail.slice(0, 300)}`);
  }
  return res;
}

async function openaiChat(messages: ChatMessage[], options: ChatOptions): Promise<Completion> {
  const limited = options.maxTokens !== undefined;
  const firstExtra = limited && state.reasoningSeen ? reasoningHeadroom() : 0;

  let result = readOpenaiMessage(await (await openaiRequest(messages, false, options, firstExtra)).json());
  if (limited && firstExtra === 0 && result.reasoned && result.truncated && result.text === "") {
    // El razonamiento consumió todo el tope: se repite una vez con margen.
    result = readOpenaiMessage(await (await openaiRequest(messages, false, options, reasoningHeadroom())).json());
  }
  state.reasoningSeen = result.reasoned;
  return { text: result.text, outputTokens: result.outputTokens, truncated: result.truncated };
}

function readOpenaiMessage(data: {
  choices?: { message?: { content?: string | null; reasoning?: string; reasoning_content?: string }; finish_reason?: string }[];
  usage?: { completion_tokens?: number };
}) {
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? "";
  return {
    text: stripThinking(content),
    // Algunos servidores entregan el razonamiento en un campo aparte; otros, dentro del texto.
    reasoned: Boolean(choice?.message?.reasoning || choice?.message?.reasoning_content) || /<\/?think/i.test(content),
    truncated: choice?.finish_reason === "length",
    outputTokens: typeof data.usage?.completion_tokens === "number" ? data.usage.completion_tokens : null,
  };
}

async function openaiChatStream(messages: ChatMessage[], options: ChatOptions): Promise<ProviderStream> {
  const res = await openaiRequest(messages, true, options);
  if (!res.body) throw new Error("El endpoint del modelo no devolvió un cuerpo en streaming");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const body = new ReadableStream<Uint8Array>({
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
  // En streaming no se pide el conteo de tokens al servidor: la velocidad se estima.
  return { stream: body, outputTokens: () => null };
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
