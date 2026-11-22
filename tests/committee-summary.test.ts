// Pruebas del resumen por WhatsApp para el Comité (src/integrations/committee-summary.ts,
// ronda 18). Sin servicios externos: Kapso (su SDK) y ElevenLabs (fetch) son dobles.
//   1. El botón wa.me envía «Hola, soy el Comité de la sala <código>»: el webhook
//      asocia ese número a esa sala y responde. Sin código, o con una sala que no
//      existe, no asocia nada.
//   2. Al sellar, cada número asociado recibe el acta: plantilla si está
//      configurada; si no, texto y nota de voz con la ventana de 24 h abierta.
//   3. El número escrito a mano (ruta del Comité) exige el token del Comité.
//   4. El número no viaja a ninguna pantalla y se olvida al reiniciar la sala.

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn() }));
vi.mock("../src/agents", () => agents);

const kapso = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ id: "media-1" })),
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

import { joinText, roomCodeFromText, summaryRecipients } from "../src/integrations/committee-summary";
import { noteInbound } from "../src/integrations/voice-notes";
import { applyAction, createRoom, getHostCredentials, getRoom, projectRoom, resetRoom } from "../src/lib/store/rooms";
import { POST as kapsoWebhook } from "../src/app/api/integrations/kapso/webhook/route";
import { POST as summaryRoute } from "../src/app/api/rooms/[roomId]/committee/summary/route";

const SECRET = "secreto-webhook";
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0]);
let phoneCounter = 0;
/** Un número distinto por prueba: la ventana de 24 h es global al proceso. */
const newPhone = () => `5699000${String(++phoneCounter).padStart(4, "0")}`;
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

function postWebhook(payload: unknown) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", SECRET).update(body).digest("hex");
  return kapsoWebhook(new Request("http://x/api/integrations/kapso/webhook", { method: "POST", body, headers: { "x-webhook-signature": signature } }));
}
const textFrom = (from: string, body: string) => postWebhook({ message: { from, text: { body } } });

async function seat(roomId: string, orgId: string, roleId: string) {
  const res = await applyAction(roomId, { type: "JOIN_ROLE", orgId, roleId, committeeKey: getHostCredentials(roomId)?.committeeKey });
  if (res.status !== 200 || !("token" in res.body)) throw new Error(`JOIN_ROLE falló: ${JSON.stringify(res)}`);
  return { orgId, roleId, token: res.body.token as string };
}

/** Sala con los dos casos presentados y el Comité sentado (devuelve su asiento). */
async function proposedRoom() {
  const roomId = createRoom({ mode: "cross_org" }).roomId;
  for (const candidate of getRoom(roomId)!.scarcity!.candidates) {
    const s = await seat(roomId, candidate.orgId, candidate.proposerRoleId);
    await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...s, caseId: candidate.caseId });
  }
  const arbiter = getRoom(roomId)!.scarcity!.arbiter;
  return { roomId, committee: await seat(roomId, arbiter.orgId, arbiter.roleId) };
}

const seal = (roomId: string, committee: { orgId: string; roleId: string; token: string }) =>
  applyAction(roomId, { type: "ALLOCATION_SEAL", ...committee, reason: "Mayor necesidad sin cubrir" });

beforeEach(() => {
  vi.stubEnv("KAPSO_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("KAPSO_API_KEY", "clave-kapso");
  vi.stubEnv("KAPSO_PHONE_NUMBER_ID", "pn-1");
  vi.stubEnv("NEXO_COMMITTEE_PHONE", "+56911110000");
  vi.stubEnv("KAPSO_TEMPLATE_NAME", "");
  vi.stubEnv("NEXO_VOICE_NOTES", "1");
  vi.stubEnv("ELEVENLABS_API_KEY", "clave-eleven");
  Object.values(kapso).forEach((fn) => fn.mockClear());
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob([OGG as Uint8Array<ArrayBuffer>]), { status: 200 })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("el código de sala en el mensaje de wa.me", () => {
  it("se reconoce solo en la frase «Comité de la sala <código>»", () => {
    expect(roomCodeFromText(joinText("demo-cross"))).toBe("demo-cross");
    expect(roomCodeFromText("hola, soy el comite de la sala a1b2c3d4")).toBe("a1b2c3d4");
    expect(roomCodeFromText("hola")).toBeNull();
    // Una razón que menciona «sala» no es un código.
    expect(roomCodeFromText("Se asigna por equidad en esta sala de urgencias")).toBeNull();
  });

  it("el código de una sala nueva se reconoce aunque se escriba en minúsculas", () => {
    const code = createRoom({ mode: "cross_org", demo: true }).roomId;
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    expect(joinText(code)).toBe(`Hola, soy el Comité de la sala ${code}`);
    expect(roomCodeFromText(`hola, soy el comité de la sala ${code.toLowerCase()}`)).toBe(code);
  });
});

describe("el webhook asocia el número a la sala", () => {
  it("con el código de una sala que existe: asocia el número, abre la ventana y responde", async () => {
    const { roomId } = await proposedRoom();
    const phone = newPhone();
    expect((await textFrom(phone, joinText(roomId))).status).toBe(200);
    expect(summaryRecipients(roomId)).toEqual([phone]);
    expect(kapso.sendText).toHaveBeenCalledWith(expect.objectContaining({ to: phone, body: expect.stringContaining(`acta de la sala ${roomId}`) }));
  });

  it("sin código, o con el código de una sala que no existe, no asocia nada", async () => {
    const { roomId } = await proposedRoom();
    const phone = newPhone();
    await textFrom(phone, "hola");
    await textFrom(phone, joinText("sala-que-no-existe"));
    expect(summaryRecipients(roomId)).toEqual([]);
    expect(summaryRecipients("sala-que-no-existe")).toEqual([]);
    expect(kapso.sendText).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining("No encontré la sala sala-que-no-existe") }));
  });

  it("el código de otra sala asocia el número a esa sala, no a esta", async () => {
    const mine = await proposedRoom();
    const other = await proposedRoom();
    const phone = newPhone();
    await textFrom(phone, joinText(other.roomId));
    expect(summaryRecipients(other.roomId)).toEqual([phone]);
    expect(summaryRecipients(mine.roomId)).toEqual([]);
  });
});

describe("al sellar llega el acta", () => {
  it("con la ventana abierta: el acta en texto y la nota de voz, sin costos", async () => {
    const { roomId, committee } = await proposedRoom();
    const phone = newPhone();
    await textFrom(phone, joinText(roomId));
    kapso.sendText.mockClear();
    expect((await seal(roomId, committee)).status).toBe(200);
    await flush();
    const calls = kapso.sendText.mock.calls as unknown as [{ to: string; body: string }][];
    const acta = calls.map(([input]) => input).find((input) => input.to === phone)!;
    expect(acta.body).toContain("Acta de la decisión");
    for (const secret of ["2400000", "2.400.000", "1600000", "1.600.000"]) expect(acta.body).not.toContain(secret);
    expect(kapso.sendAudio).toHaveBeenCalledWith(expect.objectContaining({ to: phone, audio: { id: "media-1", voice: true } }));
  });

  it("con plantilla configurada se usa la plantilla, aunque la ventana esté cerrada", async () => {
    vi.stubEnv("KAPSO_TEMPLATE_NAME", "sculptor_comite_caso");
    const { roomId, committee } = await proposedRoom();
    const phone = newPhone();
    const res = await summaryRoute(new Request("http://x", { method: "POST", body: JSON.stringify({ ...committee, phone: `+${phone}` }) }), { params: Promise.resolve({ roomId }) });
    expect(await res.json()).toEqual({ ok: true, deliverable: true });
    await seal(roomId, committee);
    await flush();
    expect(kapso.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ to: phone, template: expect.objectContaining({ name: "sculptor_comite_caso" }) }));
    expect(kapso.sendText).not.toHaveBeenCalled();
  });

  it("sin plantilla y con la ventana cerrada no se envía nada, sin error", async () => {
    const { roomId, committee } = await proposedRoom();
    const phone = newPhone();
    await summaryRoute(new Request("http://x", { method: "POST", body: JSON.stringify({ ...committee, phone }) }), { params: Promise.resolve({ roomId }) });
    await seal(roomId, committee);
    await flush();
    expect(kapso.sendText).not.toHaveBeenCalled();
    expect(kapso.sendTemplate).not.toHaveBeenCalled();
  });

  it("un reinicio de la sala olvida el número: la ronda siguiente no se le envía", async () => {
    const { roomId } = await proposedRoom();
    const phone = newPhone();
    await textFrom(phone, joinText(roomId));
    resetRoom(roomId);
    for (const candidate of getRoom(roomId)!.scarcity!.candidates) {
      const s = await seat(roomId, candidate.orgId, candidate.proposerRoleId);
      await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...s, caseId: candidate.caseId });
    }
    const arbiter = getRoom(roomId)!.scarcity!.arbiter;
    kapso.sendText.mockClear();
    await seal(roomId, await seat(roomId, arbiter.orgId, arbiter.roleId));
    await flush();
    expect(summaryRecipients(roomId)).toEqual([]);
    expect(kapso.sendText).not.toHaveBeenCalled();
  });
});

describe("el número escrito a mano en el celular del Comité", () => {
  const call = (roomId: string, body: unknown) => summaryRoute(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ roomId }) });

  it("exige el token del Comité: sin token válido 401, otro rol 403, número inválido 400", async () => {
    const { roomId, committee } = await proposedRoom();
    expect((await call(roomId, { ...committee, token: "inventado", phone: "+56911112222" })).status).toBe(401);
    const candidate = getRoom(roomId)!.scarcity!.candidates[0]!;
    const other = await applyAction(roomId, { type: "LEAVE_ROLE", orgId: candidate.orgId, roleId: candidate.proposerRoleId, token: "x" });
    expect(other.status).toBe(401);
    const room2 = createRoom({ mode: "cross_org" }).roomId;
    const clinic = await seat(room2, "clinica_andes", "role_a");
    expect((await call(room2, { ...clinic, phone: "+56911112222" })).status).toBe(403);
    expect((await call(roomId, { ...committee, phone: "123" })).status).toBe(400);
  });

  it("sin plantilla ni ventana: deliverable false; tras escribir «hola», true", async () => {
    const { roomId, committee } = await proposedRoom();
    const phone = newPhone();
    expect(await (await call(roomId, { ...committee, phone })).json()).toEqual({ ok: true, deliverable: false });
    noteInbound(phone);
    expect(await (await call(roomId, { ...committee, phone })).json()).toEqual({ ok: true, deliverable: true });
  });

  it("el número nunca viaja a una pantalla", async () => {
    const { roomId, committee } = await proposedRoom();
    const phone = newPhone();
    await call(roomId, { ...committee, phone });
    const arbiter = getRoom(roomId)!.scarcity!.arbiter;
    for (const viewer of ["stage" as const, { orgId: arbiter.orgId, roleId: arbiter.roleId }]) {
      expect(JSON.stringify(projectRoom(roomId, viewer))).not.toContain(phone);
    }
    expect(JSON.stringify(getRoom(roomId))).not.toContain(phone);
  });
});
