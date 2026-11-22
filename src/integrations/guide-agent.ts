// Agente guía de Sculptor, con ElevenLabs Agents. Es un segundo agente, separado
// del asistente del Comité (src/integrations/elevenlabs.ts): conversa con quien
// visita la portada, una página de caso o la pantalla grande, le explica qué es
// Sculptor y le dice qué hacer en la demo.
//
// No decide nada ni toca ninguna sala. Tiene una sola herramienta, estado_sala
// (src/app/api/integrations/guide/tool/route.ts), que devuelve solo lo público de
// una sala: el paso, a quién le toca y si ya hay decisión. Nunca un dato reservado.
//
// Variables de entorno (las mismas del asistente del Comité, más una):
//   ELEVENLABS_API_KEY           obligatoria
//   ELEVENLABS_GUIDE_AGENT_ID    opcional: si falta, se busca por nombre y, si no existe, se crea
//   NEXO_PUBLIC_BASE_URL         URL pública del deploy, para que ElevenLabs llame a la herramienta
//   NEXO_CHANNEL_SECRET          secreto compartido que ElevenLabs envía al llamar a la herramienta

import { CHANNEL_SECRET_HEADER, elevenLabsConfig } from "./elevenlabs";

const API = "https://api.elevenlabs.io/v1";
export const GUIDE_AGENT_NAME = "Sculptor · Guía";
/** Joaquín, voz chilena, la misma del asistente del Comité. */
export const GUIDE_VOICE_ID = "HqDjrw2JtdcxsDBOK5ZW";
export const GUIDE_TTS_MODEL = "eleven_v3_conversational";

export function guideConfig() {
  const base = elevenLabsConfig();
  return { apiKey: base.apiKey, baseUrl: base.baseUrl, secret: base.secret, agentId: process.env.ELEVENLABS_GUIDE_AGENT_ID ?? "" };
}

/** Listo para conversar: hay clave, URL pública y secreto para la herramienta. */
export function guideStatus() {
  const config = guideConfig();
  return { configured: Boolean(config.apiKey && config.baseUrl && config.secret) };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey } = guideConfig();
  if (!apiKey) throw new Error("Falta ELEVENLABS_API_KEY");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export const GUIDE_PROMPT = `Eres la guía de Sculptor. Hablas en español, con trato de usted, tono formal y cálido. Respondes en una o dos frases, nunca más.

Qué es Sculptor: un lugar donde varias organizaciones deciden juntas sobre un recurso escaso sin mostrarse sus datos reservados. Cada una ve solo lo suyo, una regla conocida ordena los casos y una persona firma con su razón. Todo queda en un acta. Los hospitales son un ejemplo (dos hospitales y una cama UCI); el mismo sistema sirve para construcción (dos obras y una grúa), logística (dos distribuidoras y un camión refrigerado) y presupuestos.

La demo es de cinco personas, cada una con su celular y con su propio agente, y dura unos dos minutos. Se abre en /demo; la portada de Sculptor está en / y el ejemplo de los hospitales en /casos/hospitales.
1. Escanean el código de la pantalla grande. Los asientos se reparten por orden de llegada: Clínica Urgencias, Clínica Administración, Hospital Rural Turno, Hospital Rural Administración y Comité. Si faltan personas, cualquiera puede tocar Iniciar en la pantalla grande y los asientos libres los toma un bot, marcado como automático.
2. El agente de cada persona le aconseja en su celular con los datos que solo ese rol ve, y la persona elige su postura con un toque. Decide la persona, no el agente.
3. Los agentes negocian a la vista en la pantalla grande: cada uno publica su argumento sin revelar cifras reservadas. Ahí no hay que hacer nada, solo leer.
4. La propuesta sale de una regla visible, calculada por código, no por el debate ni por un modelo: ordena los casos según la regla y desempata por equidad.
5. El Comité acepta o rechaza la propuesta con una razón, que elige con un toque. Si no actúa en veinte segundos, el sistema acepta solo y lo marca como automático.
6. Aparece el acta con quién decidió, cuándo y por qué.

La página donde está la persona: {{pagina}}. La sala de la pantalla grande, si hay una: {{room_id}}.
Si te preguntan en qué va la demo o qué hay que hacer ahora, llama a la herramienta estado_sala con ese room_id y responde con lo que devuelva, por ejemplo: «Ahora le toca al Comité: acepte o rechace». Si no hay sala, invite a abrir la demo en /demo o con el botón Probar la demo.

Reglas: no inventes cifras ni nombres. No conoces ningún dato reservado de las organizaciones y nunca lo pides. No tomas decisiones por nadie. Es una demostración simulada, no una herramienta clínica.`;

function toolDefinitions(baseUrl: string, secret: string) {
  return [
    {
      type: "webhook",
      name: "estado_sala",
      description: "Devuelve lo público de una sala de Sculptor: en qué paso va, a quién le toca y si ya hay decisión. Úsala cuando pregunten qué hay que hacer ahora.",
      api_schema: {
        url: `${baseUrl}/api/integrations/guide/tool`,
        method: "POST",
        request_headers: { [CHANNEL_SECRET_HEADER]: secret },
        request_body_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["estado_sala"], description: "Siempre 'estado_sala'." },
            room_id: { type: "string", description: "Identificador de la sala, el de {{room_id}}." },
          },
          required: ["action", "room_id"],
        },
      },
    },
  ];
}

let cachedAgentId: string | null = null;

/**
 * Id del agente guía. Idempotente: usa ELEVENLABS_GUIDE_AGENT_ID si está; si no,
 * busca un agente con el mismo nombre en la cuenta y, solo si no existe, lo crea.
 * Al crearlo, deja el id en el registro para guardarlo en ELEVENLABS_GUIDE_AGENT_ID.
 */
export async function ensureGuideAgent(): Promise<string> {
  const config = guideConfig();
  if (config.agentId) return config.agentId;
  if (cachedAgentId) return cachedAgentId;
  if (!config.baseUrl || !config.secret) throw new Error("Faltan NEXO_PUBLIC_BASE_URL o NEXO_CHANNEL_SECRET");

  const found = await call<{ agents?: { agent_id: string; name: string }[] }>(`/convai/agents?search=${encodeURIComponent(GUIDE_AGENT_NAME)}&page_size=30`);
  const existing = found.agents?.find((agent) => agent.name === GUIDE_AGENT_NAME);
  if (existing) {
    cachedAgentId = existing.agent_id;
    return existing.agent_id;
  }

  const created = await call<{ agent_id: string }>("/convai/agents/create", {
    method: "POST",
    body: JSON.stringify({
      name: GUIDE_AGENT_NAME,
      conversation_config: {
        agent: {
          language: "es",
          first_message: "Hola, soy la guía de Sculptor. ¿Le explico qué es o le ayudo con la demo?",
          prompt: { prompt: GUIDE_PROMPT, tools: toolDefinitions(config.baseUrl, config.secret) },
          dynamic_variables: { dynamic_variable_placeholders: { pagina: "la portada", room_id: "" } },
        },
        tts: { model_id: GUIDE_TTS_MODEL, voice_id: GUIDE_VOICE_ID },
      },
      // Se permite abrir la conversación solo por texto desde el navegador.
      platform_settings: { overrides: { conversation_config_override: { conversation: { text_only: true } } } },
    }),
  });
  cachedAgentId = created.agent_id;
  console.info(`[guía] Agente creado: ${created.agent_id}. Guárdalo en ELEVENLABS_GUIDE_AGENT_ID.`);
  return created.agent_id;
}

/** URL firmada para conversar con la guía desde el navegador, por voz o por texto. */
export async function guideSignedUrl(): Promise<{ signedUrl: string; agentId: string }> {
  const agentId = await ensureGuideAgent();
  const response = await call<{ signed_url: string }>(`/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`);
  return { signedUrl: response.signed_url, agentId };
}
