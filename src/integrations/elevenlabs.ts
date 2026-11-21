// Agente de voz del Comité, con ElevenLabs Agents.
//
// El agente conversa en español con quien preside el Comité, por teléfono
// (llamada saliente vía Twilio vinculado en ElevenLabs) o desde el navegador.
// No decide nada: tiene dos herramientas que llaman a nuestro servidor
// (src/app/api/integrations/voice/tool/route.ts):
//   - consultar_caso: devuelve el resumen que puede ver el Comité.
//   - registrar_decision: aplica aprobación o veto con la razón dicha por la persona.
// Las reglas siguen en el motor; el agente solo explica y transcribe.
//
// Variables de entorno:
//   ELEVENLABS_API_KEY            obligatoria
//   ELEVENLABS_AGENT_ID           opcional: si falta, el agente se crea la primera vez
//   ELEVENLABS_PHONE_NUMBER_ID    para llamadas: número de Twilio vinculado en ElevenLabs
//   NEXO_COMMITTEE_PHONE          número del Comité en formato E.164 (+569...)
//   NEXO_PUBLIC_BASE_URL          URL pública del deploy, para que ElevenLabs llame a las herramientas
//   NEXO_CHANNEL_SECRET           secreto compartido que ElevenLabs envía al llamar a las herramientas

const API = "https://api.elevenlabs.io/v1";

export const CHANNEL_SECRET_HEADER = "x-nexo-secret";
export const SESSION_HEADER = "x-nexo-session";

export function elevenLabsConfig() {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY ?? "",
    agentId: process.env.ELEVENLABS_AGENT_ID ?? "",
    phoneNumberId: process.env.ELEVENLABS_PHONE_NUMBER_ID ?? "",
    committeePhone: process.env.NEXO_COMMITTEE_PHONE ?? "",
    baseUrl: (process.env.NEXO_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
    secret: process.env.NEXO_CHANNEL_SECRET ?? "",
  };
}

export function voiceStatus() {
  const config = elevenLabsConfig();
  return {
    configured: Boolean(config.apiKey && config.baseUrl && config.secret),
    canCall: Boolean(config.apiKey && config.baseUrl && config.secret && config.phoneNumberId && config.committeePhone),
  };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey } = elevenLabsConfig();
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

const PROMPT = `Eres el asistente de voz del Comité de Sculptor, un sistema donde varias organizaciones deciden juntas sobre un recurso escaso sin mostrarse sus datos reservados.
Hablas en español de Chile, con frases cortas, tono calmado y respetuoso. Te diriges a quien preside el Comité.

Tu trabajo, en este orden:
1. Saluda en una frase y llama a la herramienta consultar_caso para conocer el caso. This step is important.
2. Explica el caso en no más de cuatro frases: qué recurso está en disputa, qué propone la regla y por qué.
3. Pregunta si aprueba la propuesta o la veta.
4. Pide la razón de su decisión. La razón es obligatoria: sin razón no se registra nada.
5. Repite en voz alta la decisión y la razón, y pide confirmación.
6. Solo cuando confirme, llama a registrar_decision. Luego informa el resultado y despídete.

Reglas que no se rompen:
- Nunca inventes datos, puntajes ni nombres: usa solo lo que devuelve consultar_caso.
- No tomas la decisión ni opinas sobre cuál es correcta. Si te piden tu opinión, explica que la decisión es del Comité y que la regla ya está a la vista.
- Si no tienes acceso a un dato, dilo: el Comité solo ve lo que su rol puede ver.
- Esta es una demostración simulada; no es una decisión clínica real.

Identificador de esta sesión: {{session_id}}. Envíalo exacto en cada herramienta.`;

function toolDefinitions(baseUrl: string, secret: string) {
  const url = `${baseUrl}/api/integrations/voice/tool`;
  const headers = { [CHANNEL_SECRET_HEADER]: secret, [SESSION_HEADER]: "{{session_id}}" };
  return [
    {
      type: "webhook",
      name: "consultar_caso",
      description: "Devuelve el resumen del caso que el Comité puede ver: recurso, orden propuesto por la regla y propuesta. Úsala al comenzar.",
      api_schema: {
        url,
        method: "POST",
        request_headers: headers,
        request_body_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["brief"], description: "Siempre 'brief'." },
            session_id: { type: "string", description: "Identificador de la sesión, exacto." },
          },
          required: ["action", "session_id"],
        },
      },
    },
    {
      type: "webhook",
      name: "registrar_decision",
      description: "Registra la decisión del Comité. Úsala solo después de que la persona confirmó la decisión y su razón.",
      api_schema: {
        url,
        method: "POST",
        request_headers: headers,
        request_body_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["decide"], description: "Siempre 'decide'." },
            session_id: { type: "string", description: "Identificador de la sesión, exacto." },
            decision: { type: "string", enum: ["approve", "veto"], description: "approve si aprueba la propuesta, veto si la rechaza." },
            reason: { type: "string", description: "La razón que dio la persona, con sus palabras." },
          },
          required: ["action", "session_id", "decision", "reason"],
        },
      },
    },
  ];
}

let cachedAgentId: string | null = null;

/** Devuelve el id del agente del Comité; lo crea si no existe. */
export async function ensureCommitteeAgent(): Promise<string> {
  const config = elevenLabsConfig();
  if (config.agentId) return config.agentId;
  if (cachedAgentId) return cachedAgentId;
  if (!config.baseUrl || !config.secret) throw new Error("Faltan NEXO_PUBLIC_BASE_URL o NEXO_CHANNEL_SECRET");

  const created = await call<{ agent_id: string }>("/convai/agents/create", {
    method: "POST",
    body: JSON.stringify({
      name: "Sculptor · Asistente del Comité",
      conversation_config: {
        agent: {
          language: "es",
          first_message: "Hola, le habla el asistente del Comité de Sculptor. Hay un caso que necesita su decisión. Deme un segundo y se lo explico.",
          prompt: {
            prompt: PROMPT,
            tools: toolDefinitions(config.baseUrl, config.secret),
          },
        },
        // Joaquín (voz chilena) con el modelo conversacional más expresivo. Fer, la voz de las
        // notas de voz, no se puede usar en agentes: tiene moderación en vivo activada.
        tts: { model_id: "eleven_v3_conversational", voice_id: "HqDjrw2JtdcxsDBOK5ZW" },
      },
    }),
  });
  cachedAgentId = created.agent_id;
  return created.agent_id;
}

/** Llamada telefónica saliente al Comité. */
export async function callCommittee(sessionId: string, brief: string): Promise<{ conversationId: string | null }> {
  const config = elevenLabsConfig();
  if (!config.phoneNumberId || !config.committeePhone) {
    throw new Error("Faltan ELEVENLABS_PHONE_NUMBER_ID o NEXO_COMMITTEE_PHONE para llamar");
  }
  const agentId = await ensureCommitteeAgent();
  const response = await call<{ success?: boolean; conversation_id?: string; message?: string }>("/convai/twilio/outbound-call", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: config.phoneNumberId,
      to_number: config.committeePhone,
      conversation_initiation_client_data: { dynamic_variables: { session_id: sessionId, caso: brief.slice(0, 1500) } },
    }),
  });
  if (response.success === false) throw new Error(response.message ?? "ElevenLabs no pudo iniciar la llamada");
  return { conversationId: response.conversation_id ?? null };
}

/** URL firmada para conversar con el agente desde el navegador (sin teléfono). */
export async function voiceSignedUrl(): Promise<{ signedUrl: string; agentId: string }> {
  const agentId = await ensureCommitteeAgent();
  const response = await call<{ signed_url: string }>(`/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`);
  return { signedUrl: response.signed_url, agentId };
}
