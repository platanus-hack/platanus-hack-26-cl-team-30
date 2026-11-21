// Pruebas de los canales externos del Comité (src/integrations): WhatsApp con
// Kapso y voz con ElevenLabs. No llaman a ningún servicio externo: prueban que
// ambos canales usan las mismas acciones y permisos que la web, que el resumen
// no filtra datos reservados y que el webhook y las herramientas rechazan
// peticiones sin firma o sin secreto.

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agents = vi.hoisted(() => ({ runRoleAgentTurn: vi.fn(), mutateGenomeFromPrompt: vi.fn() }));
vi.mock("../src/agents", () => agents);

import {
  buildCommitteeBrief,
  decideAsCommittee,
  getSession,
  openCommitteeSession,
} from "../src/integrations/committee-channel";
import { buttonId, extractIncomingMessages, parseButtonId, verifyWebhook } from "../src/integrations/kapso";
import { applyAction, createRoom, getHostCredentials, getRoom } from "../src/lib/store/rooms";
import { POST as kapsoWebhook } from "../src/app/api/integrations/kapso/webhook/route";
import { POST as voiceTool } from "../src/app/api/integrations/voice/tool/route";

const CLINIC = "clinica_andes";
const RURAL = "hospital_rural";

async function join(roomId: string, orgId: string, roleId: string) {
  const committeeKey = getHostCredentials(roomId)?.committeeKey;
  const res = await applyAction(roomId, { type: "JOIN_ROLE", orgId, roleId, committeeKey });
  if (res.status !== 200 || !("token" in res.body)) throw new Error(`JOIN_ROLE falló: ${JSON.stringify(res)}`);
  return { orgId, roleId, token: res.body.token as string };
}

/** Sala entre organizaciones con los dos candidatos presentados: la asignación queda propuesta. */
async function proposedRoom() {
  const roomId = createRoom({ mode: "cross_org" }).roomId;
  const clinic = await join(roomId, CLINIC, "role_a");
  const rural = await join(roomId, RURAL, "role_a");
  expect((await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...clinic, caseId: "A1" })).status).toBe(200);
  expect((await applyAction(roomId, { type: "SUBMIT_CANDIDATE", ...rural, caseId: "B1" })).status).toBe(200);
  return roomId;
}

describe("el canal externo actúa como el Comité, con las reglas de siempre", () => {
  it("toma el puesto del Comité con su clave y el resumen no trae datos reservados", async () => {
    const roomId = await proposedRoom();
    const opened = await openCommitteeSession(roomId, "voice");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const brief = buildCommitteeBrief(opened.session);
    expect(brief).toContain("Propuesta");
    // Costos de cobertura de cada hospital: reservados para su propia organización.
    for (const secret of ["2400000", "2.400.000", "1600000", "1.600.000"]) expect(brief).not.toContain(secret);
  });

  it("si una persona ya tiene el puesto desde la web, el canal no lo toma: 409", async () => {
    const roomId = await proposedRoom();
    const arbiter = getRoom(roomId)!.scarcity!.arbiter;
    await join(roomId, arbiter.orgId, arbiter.roleId);
    const opened = await openCommitteeSession(roomId, "whatsapp", "56900000000");
    expect(opened).toMatchObject({ ok: false, status: 409 });
  });

  it("la decisión exige razón y queda registrada con el canal", async () => {
    const roomId = await proposedRoom();
    const opened = await openCommitteeSession(roomId, "voice");
    if (!opened.ok) throw new Error("no abrió la sesión");

    expect(await decideAsCommittee(opened.session, "approve", "  ", "llamada de voz")).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    expect(await decideAsCommittee(opened.session, "approve", "Mayor gravedad y menor tiempo disponible", "llamada de voz")).toEqual({ ok: true });

    const state = getRoom(roomId)!;
    expect(state.allocationStatus).toBe("SEALED");
    expect(JSON.stringify(state.auditLog)).toContain("vía llamada de voz");
  });

  it("una sala de una sola organización no tiene Comité árbitro", async () => {
    const roomId = createRoom({ mode: "single_org" }).roomId;
    expect(await openCommitteeSession(roomId, "voice")).toMatchObject({ ok: false, code: "WRONG_MODE" });
  });
});

describe("WhatsApp (Kapso)", () => {
  const secret = "secreto-de-prueba";
  beforeEach(() => {
    vi.stubEnv("KAPSO_WEBHOOK_SECRET", secret);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("los botones llevan la sesión y la decisión, y no se aceptan ids ajenos", () => {
    expect(parseButtonId(buttonId("abcdefgh1234", "veto"))).toEqual({ decision: "veto", sessionId: "abcdefgh1234" });
    expect(parseButtonId("otra-cosa")).toBeNull();
    expect(parseButtonId("nexo:borrar:abcdefgh1234")).toBeNull();
  });

  it("lee mensajes de texto y respuestas de botón en formato Kapso y Meta", () => {
    const kapso = { message: { from: "+56 9 1111 2222", type: "interactive", interactive: { button_reply: { id: "nexo:approve:abcdefgh1234", title: "Aprobar" } } } };
    const meta = { entry: [{ changes: [{ value: { messages: [{ from: "56911112222", type: "text", text: { body: "Por gravedad" } }] } }] }] };
    expect(extractIncomingMessages(kapso)).toEqual([{ from: "56911112222", text: null, buttonId: "nexo:approve:abcdefgh1234" }]);
    expect(extractIncomingMessages(meta)).toEqual([{ from: "56911112222", text: "Por gravedad", buttonId: null }]);
  });

  it("verifica la firma HMAC del webhook", async () => {
    const body = JSON.stringify({ hola: 1 });
    const good = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhook(body, good)).toBe(true);
    expect(verifyWebhook(body, "00".repeat(32))).toBe(false);

    const rejected = await kapsoWebhook(new Request("http://x/api/integrations/kapso/webhook", { method: "POST", body, headers: { "x-webhook-signature": "malo" } }));
    expect(rejected.status).toBe(401);
  });
});

describe("herramientas del agente de voz (ElevenLabs)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sin el secreto compartido no responden", async () => {
    vi.stubEnv("NEXO_CHANNEL_SECRET", "secreto-voz");
    const res = await voiceTool(new Request("http://x/api/integrations/voice/tool", { method: "POST", body: JSON.stringify({ action: "brief" }) }));
    expect(res.status).toBe(401);
  });

  it("con el secreto, entregan el resumen y registran la decisión de la sesión", async () => {
    vi.stubEnv("NEXO_CHANNEL_SECRET", "secreto-voz");
    const roomId = await proposedRoom();
    const opened = await openCommitteeSession(roomId, "voice");
    if (!opened.ok) throw new Error("no abrió la sesión");
    const headers = { "x-nexo-secret": "secreto-voz", "x-nexo-session": opened.session.id, "Content-Type": "application/json" };

    const brief = await voiceTool(new Request("http://x", { method: "POST", headers, body: JSON.stringify({ action: "brief", session_id: opened.session.id }) }));
    expect((await brief.json()).result).toContain("Propuesta");

    const decided = await voiceTool(
      new Request("http://x", { method: "POST", headers, body: JSON.stringify({ action: "decide", session_id: opened.session.id, decision: "veto", reason: "Falta confirmar el traslado" }) }),
    );
    expect((await decided.json()).result).toContain("veto");
    expect(getSession(opened.session.id)).toBeUndefined();
  });
});
