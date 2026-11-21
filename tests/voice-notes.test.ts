// Pruebas de las notas de voz informativas por WhatsApp
// (src/integrations/voice-notes.ts). No llaman a ningún servicio: ElevenLabs
// (fetch) y Kapso (su SDK) se reemplazan por dobles. Lo que se comprueba:
//   1. Apagadas por defecto: solo con NEXO_VOICE_NOTES=1.
//   2. Ventana de 24 h: sin un mensaje reciente del Comité no se envía nada.
//   3. El texto sale de la vista filtrada del Comité: nunca un costo reservado, y
//      no está escrito para hospitales (sirve para obras y cargas).
//   4. Opus en OGG va como nota de voz; si no, se pide MP3 y va como audio normal.
//   5. Un error de un servicio no rompe nada: se informa y el canal sigue.
//   6. El webhook envía el caso al tocar un botón y el acta al sellar.

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn() }));
vi.mock("../src/agents", () => agents);

const kapso = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ id: "media-123" })),
  sendAudio: vi.fn(async () => ({})),
  sendText: vi.fn(async () => ({})),
  sendInteractiveButtons: vi.fn(async () => ({})),
  sendTemplate: vi.fn(async () => ({})),
}));
vi.mock("@kapso/whatsapp-cloud-api", () => ({
  WhatsAppClient: class {
    media = { upload: kapso.upload };
    messages = { sendAudio: kapso.sendAudio, sendText: kapso.sendText, sendInteractiveButtons: kapso.sendInteractiveButtons, sendTemplate: kapso.sendTemplate };
  },
}));

import { openCommitteeSession } from "../src/integrations/committee-channel";
import { actaVoiceText, caseVoiceText, noteInbound, sendCommitteeVoiceNote, synthesizeSpeech, windowOpen, WHATSAPP_WINDOW_MS } from "../src/integrations/voice-notes";
import { applyAction, createRoom, getHostCredentials, getRoom, projectRoom } from "../src/lib/store/rooms";
import { POST as kapsoWebhook } from "../src/app/api/integrations/kapso/webhook/route";
import { POST as actionRoute } from "../src/app/api/rooms/[roomId]/action/route";

const PHONE = "56911112222";
const SECRETS = ["2400000", "2.400.000", "1600000", "1.600.000"];
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0, 1, 2, 3]);
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0]);

let fetchMock: ReturnType<typeof vi.fn>;
/** Respuesta de ElevenLabs según el formato pedido. */
function elevenLabs(opusBytes: Uint8Array = OGG) {
  fetchMock = vi.fn(async (url: string) => {
    const bytes = String(url).includes("opus_") ? opusBytes : MP3;
    return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]), { status: 200, headers: { "Content-Type": "application/octet-stream" } });
  });
  vi.stubGlobal("fetch", fetchMock);
}

async function join(roomId: string, orgId: string, roleId: string) {
  const res = await applyAction(roomId, { type: "JOIN_ROLE", orgId, roleId, committeeKey: getHostCredentials(roomId)?.committeeKey });
  if (res.status !== 200 || !("token" in res.body)) throw new Error(`JOIN_ROLE falló: ${JSON.stringify(res)}`);
  return { orgId, roleId, token: res.body.token as string };
}

/** Sala entre organizaciones con la asignación propuesta (los dos casos presentados). */
async function proposedRoom(scenario: "hospitales" | "construccion" = "hospitales") {
  const roomId = createRoom({ mode: "cross_org", scenario }).roomId;
  const state = getRoom(roomId)!;
  for (const candidate of state.scarcity!.candidates) {
    const seat = await join(roomId, candidate.orgId, candidate.proposerRoleId);
    expect((await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...seat, caseId: candidate.caseId })).status).toBe(200);
  }
  return roomId;
}

const committeeView = (roomId: string) => {
  const arbiter = getRoom(roomId)!.scarcity!.arbiter;
  return projectRoom(roomId, { orgId: arbiter.orgId, roleId: arbiter.roleId })!;
};

beforeEach(() => {
  vi.stubEnv("NEXO_VOICE_NOTES", "1");
  vi.stubEnv("ELEVENLABS_API_KEY", "clave-eleven");
  vi.stubEnv("KAPSO_API_KEY", "clave-kapso");
  vi.stubEnv("KAPSO_PHONE_NUMBER_ID", "pn-1");
  vi.stubEnv("NEXO_COMMITTEE_PHONE", `+${PHONE}`);
  Object.values(kapso).forEach((fn) => fn.mockClear());
  elevenLabs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cuándo se envía", () => {
  it("apagadas por defecto: sin NEXO_VOICE_NOTES=1 no se llama a nadie", async () => {
    vi.stubEnv("NEXO_VOICE_NOTES", "");
    const roomId = await proposedRoom();
    noteInbound(PHONE);
    expect(await sendCommitteeVoiceNote("case", roomId, PHONE)).toEqual({ sent: false, reason: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(kapso.sendAudio).not.toHaveBeenCalled();
  });

  it("ventana de 24 h: sin un mensaje reciente del Comité se omite, sin error", async () => {
    const roomId = await proposedRoom();
    const phone = "56900000001";
    expect(await sendCommitteeVoiceNote("case", roomId, phone)).toEqual({ sent: false, reason: "window_closed" });
    const t0 = Date.now();
    noteInbound(phone, t0);
    expect(windowOpen(phone, t0 + WHATSAPP_WINDOW_MS - 1)).toBe(true);
    expect(windowOpen(phone, t0 + WHATSAPP_WINDOW_MS)).toBe(false);
    expect(await sendCommitteeVoiceNote("case", roomId, phone, t0 + WHATSAPP_WINDOW_MS + 1)).toMatchObject({ sent: false, reason: "window_closed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin caso todavía (nadie presentó) no hay nada que decir", async () => {
    const roomId = createRoom({ mode: "cross_org" }).roomId;
    noteInbound(PHONE);
    expect(await sendCommitteeVoiceNote("case", roomId, PHONE)).toEqual({ sent: false, reason: "nothing_to_say" });
  });
});

describe("el texto: solo lo que ve el Comité, y para cualquier escenario", () => {
  it("el caso nombra recurso, propuesta y organizaciones, sin ningún costo reservado", async () => {
    const roomId = await proposedRoom();
    const text = caseVoiceText(committeeView(roomId))!;
    expect(text).toContain("Cama UCI de referencia");
    expect(text).toContain("La regla propone a Paciente B");
    expect(text).toContain("Hospital Rural Valle Sur");
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    // Unos 20 s: a lo más 55 palabras.
    expect(text.split(" ").length).toBeLessThanOrEqual(55);
  });

  it("en construcción habla de obras y de la grúa, no de pacientes ni camas", async () => {
    const roomId = await proposedRoom("construccion");
    const text = caseVoiceText(committeeView(roomId))!;
    expect(text).toMatch(/Grúa torre compartida/);
    expect(text).toMatch(/Obra [AB]/);
    expect(text).not.toMatch(/paciente|cama/i);
  });

  it("el acta dice quién recibe el recurso, quién firmó y la razón (sin la marca del canal)", async () => {
    const roomId = await proposedRoom();
    const arbiter = getRoom(roomId)!.scarcity!.arbiter;
    const committee = await join(roomId, arbiter.orgId, arbiter.roleId);
    await applyAction(roomId, { type: "ALLOCATION_SEAL", ...committee, reason: "Mayor necesidad sin cubrir (vía WhatsApp)" });
    const text = actaVoiceText(committeeView(roomId))!;
    expect(text).toContain("se asigna a Paciente B");
    expect(text).toContain("Razón: Mayor necesidad sin cubrir.");
    expect(text).not.toContain("vía WhatsApp");
    for (const secret of SECRETS) expect(text).not.toContain(secret);
  });
});

describe("audio y envío", () => {
  it("pide Opus a ElevenLabs y, si llega en OGG, lo envía como nota de voz", async () => {
    const roomId = await proposedRoom();
    noteInbound(PHONE);
    expect(await sendCommitteeVoiceNote("case", roomId, PHONE)).toMatchObject({ sent: true, voice: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/[^/?]+\?output_format=opus_48000_64$/);
    expect(init.method).toBe("POST");
    expect(init.headers["xi-api-key"]).toBe("clave-eleven");
    expect(JSON.parse(init.body)).toMatchObject({ model_id: "eleven_multilingual_v2" });
    expect(kapso.upload).toHaveBeenCalledWith(expect.objectContaining({ phoneNumberId: "pn-1", type: "audio/ogg", fileName: "sculptor.ogg" }));
    expect(kapso.sendAudio).toHaveBeenCalledWith({ phoneNumberId: "pn-1", to: PHONE, audio: { id: "media-123", voice: true } });
  });

  it("si el Opus no viene en OGG, pide MP3 y lo envía como audio normal", async () => {
    elevenLabs(new Uint8Array([1, 2, 3, 4, 5]));
    const audio = await synthesizeSpeech("Hola");
    expect(audio).toMatchObject({ mimeType: "audio/mpeg", voice: false });
    expect(String(fetchMock.mock.calls[1]![0])).toContain("output_format=mp3_44100_64");
  });

  it("si ElevenLabs falla, no lanza: informa el error y no se sube nada", async () => {
    fetchMock = vi.fn(async () => new Response("sin créditos", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const roomId = await proposedRoom();
    noteInbound(PHONE);
    const result = await sendCommitteeVoiceNote("case", roomId, PHONE);
    expect(result).toMatchObject({ sent: false, reason: "error" });
    expect(kapso.upload).not.toHaveBeenCalled();
  });
});

describe("el webhook de WhatsApp", () => {
  const secret = "secreto-webhook";
  const post = (payload: unknown) => {
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    return kapsoWebhook(new Request("http://x/api/integrations/kapso/webhook", { method: "POST", body, headers: { "x-webhook-signature": signature } }));
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

  it("al tocar Aprobar llega el caso en audio (una vez); al escribir la razón, el acta en audio", async () => {
    vi.stubEnv("KAPSO_WEBHOOK_SECRET", secret);
    const roomId = await proposedRoom();
    const opened = await openCommitteeSession(roomId, "whatsapp", PHONE);
    if (!opened.ok) throw new Error("no abrió la sesión");
    const buttonId = `nexo:approve:${opened.session.id}`;

    expect((await post({ message: { from: PHONE, interactive: { button_reply: { id: buttonId } } } })).status).toBe(200);
    await flush();
    expect(kapso.sendAudio).toHaveBeenCalledTimes(1);
    // Un segundo toque no repite el audio del caso.
    await post({ message: { from: PHONE, interactive: { button_reply: { id: buttonId } } } });
    await flush();
    expect(kapso.sendAudio).toHaveBeenCalledTimes(1);

    expect((await post({ message: { from: PHONE, text: { body: "Mayor necesidad sin cubrir" } } })).status).toBe(200);
    await flush();
    expect(getRoom(roomId)!.allocationStatus).toBe("SEALED");
    expect(kapso.sendAudio).toHaveBeenCalledTimes(2);
    // Decidir sigue siendo con botón y razón escrita: el audio no decide nada.
    expect(getRoom(roomId)!.decisions.at(-1)!.reason).toContain("Mayor necesidad sin cubrir");
  });

  it("con las notas de voz apagadas, el canal de WhatsApp funciona igual y no envía audio", async () => {
    vi.stubEnv("KAPSO_WEBHOOK_SECRET", secret);
    vi.stubEnv("NEXO_VOICE_NOTES", "0");
    const roomId = await proposedRoom();
    const opened = await openCommitteeSession(roomId, "whatsapp", PHONE);
    if (!opened.ok) throw new Error("no abrió la sesión");
    await post({ message: { from: PHONE, interactive: { button_reply: { id: `nexo:approve:${opened.session.id}` } } } });
    await post({ message: { from: PHONE, text: { body: "Equidad" } } });
    await flush();
    expect(getRoom(roomId)!.allocationStatus).toBe("SEALED");
    expect(kapso.sendAudio).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("si el Comité sella desde la web", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
  const sealFromWeb = async (roomId: string) => {
    const arbiter = getRoom(roomId)!.scarcity!.arbiter;
    // El canal de WhatsApp tenía el puesto; la persona lo toma desde la web cuando el canal deja de dar señales.
    const seat = await applyAction(roomId, { type: "JOIN_ROLE", orgId: arbiter.orgId, roleId: arbiter.roleId, committeeKey: getHostCredentials(roomId)?.committeeKey }, Date.now() + 60_000);
    if (seat.status !== 200 || !("token" in seat.body)) throw new Error(`JOIN_ROLE falló: ${JSON.stringify(seat)}`);
    const body = JSON.stringify({ type: "ALLOCATION_SEAL", orgId: arbiter.orgId, roleId: arbiter.roleId, token: seat.body.token, reason: "Equidad entre organizaciones" });
    const res = await actionRoute(new Request(`http://x/api/rooms/${roomId}/action`, { method: "POST", body, headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ roomId }) });
    expect(res.status).toBe(200);
    await flush();
  };

  it("también le llega el acta en audio por WhatsApp, si la conversación está abierta", async () => {
    const roomId = await proposedRoom();
    const opened = await openCommitteeSession(roomId, "whatsapp", PHONE);
    if (!opened.ok) throw new Error("no abrió la sesión");
    noteInbound(PHONE);
    await sealFromWeb(roomId);
    expect(getRoom(roomId)!.allocationStatus).toBe("SEALED");
    expect(kapso.sendAudio).toHaveBeenCalledTimes(1);
    expect(kapso.upload).toHaveBeenCalledWith(expect.objectContaining({ type: "audio/ogg" }));
    // El texto del acta pasó por ElevenLabs y no trae costos.
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body).text as string;
    expect(sent).toContain("Acta de la decisión");
    for (const secret of SECRETS) expect(sent).not.toContain(secret);
  });

  it("sin conversación abierta, o si el caso nunca se envió por WhatsApp, no se envía nada", async () => {
    const quiet = "56900000009";
    const roomId = await proposedRoom();
    const opened = await openCommitteeSession(roomId, "whatsapp", quiet);
    if (!opened.ok) throw new Error("no abrió la sesión");
    await sealFromWeb(roomId);
    const noWhatsApp = await proposedRoom();
    await sealFromWeb(noWhatsApp);
    expect(kapso.sendAudio).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

