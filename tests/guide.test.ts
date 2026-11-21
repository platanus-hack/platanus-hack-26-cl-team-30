// Pruebas de la herramienta estado_sala del agente guía
// (src/app/api/integrations/guide/tool/route.ts): exige el secreto compartido y
// devuelve solo lo público de una sala, nunca un dato reservado.

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/integrations/guide/tool/route";
import { getSeedGenome } from "../src/lib/genome/seeds";
import { applyAction, createRoom, getHostCredentials } from "../src/lib/store/rooms";

const SECRET = "secreto-guia";

function ask(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["x-nexo-secret"] = secret;
  return POST(new Request("http://localhost/api/integrations/guide/tool", { method: "POST", headers, body: JSON.stringify(body) }));
}

/** Todos los valores reservados de los dos hospitales, escritos como podrían aparecer. */
function secretValues(): string[] {
  const values: string[] = [];
  for (const id of ["clinica_andes", "hospital_rural"] as const) {
    for (const field of getSeedGenome(id).fields) {
      if (typeof field.value === "number" && field.value >= 1000) values.push(String(field.value), field.value.toLocaleString("es-CL"));
    }
  }
  return values;
}

afterEach(() => vi.unstubAllEnvs());

describe("herramienta estado_sala de la guía", () => {
  it("sin el secreto, o con otro, no responde nada de la sala", async () => {
    vi.stubEnv("NEXO_CHANNEL_SECRET", SECRET);
    const roomId = createRoom({ mode: "cross_org", demo: true }).roomId;
    expect((await ask({ action: "estado_sala", room_id: roomId }, null)).status).toBe(401);
    expect((await ask({ action: "estado_sala", room_id: roomId }, "otro-secreto")).status).toBe(401);
  });

  it("sin secreto configurado en el servidor, tampoco", async () => {
    vi.stubEnv("NEXO_CHANNEL_SECRET", "");
    expect((await ask({ action: "estado_sala", room_id: "demo-cross" })).status).toBe(401);
  });

  it("dice el paso y a quién le toca, sin ningún dato reservado", async () => {
    vi.stubEnv("NEXO_CHANNEL_SECRET", SECRET);
    const room = createRoom({ mode: "cross_org", demo: true });
    const empty = await (await ask({ action: "estado_sala", room_id: room.roomId })).json();
    expect(empty.result).toContain("Unirse");
    expect(empty.result).toContain("Clínica");

    // Entran los dos hospitales y presentan: le toca al Comité, que aún no entra.
    for (const seat of [{ orgId: "clinica_andes", roleId: "role_a" }, { orgId: "hospital_rural", roleId: "role_a" }]) {
      const joined = await applyAction(room.roomId, { type: "JOIN_ROLE", ...seat });
      expect(joined.status).toBe(200);
      const token = (joined.body as { token?: string }).token;
      const caseId = seat.orgId === "clinica_andes" ? "A1" : "B1";
      expect((await applyAction(room.roomId, { type: "SUBMIT_CANDIDATE", ...seat, token, caseId })).status).toBe(200);
    }
    const waiting = (await (await ask({ action: "estado_sala", room_id: room.roomId })).json()).result as string;
    expect(waiting).toContain("Comité");
    for (const value of secretValues()) expect(waiting).not.toContain(value);
    // Tampoco las claves de la sala.
    const credentials = getHostCredentials(room.roomId)!;
    expect(waiting).not.toContain(credentials.committeeKey);
    expect(waiting).not.toContain(credentials.hostToken);
  });

  it("sin sala, o con una que no existe, invita a abrir la demo", async () => {
    vi.stubEnv("NEXO_CHANNEL_SECRET", SECRET);
    expect((await (await ask({ action: "estado_sala", room_id: "" })).json()).result).toContain("Probar la demo");
    expect((await (await ask({ action: "estado_sala", room_id: "{{room_id}}" })).json()).result).toContain("Probar la demo");
    expect((await (await ask({ action: "estado_sala", room_id: "no-existe" })).json()).result).toContain("No encuentro");
  });

  it("rechaza otra acción", async () => {
    vi.stubEnv("NEXO_CHANNEL_SECRET", SECRET);
    expect((await ask({ action: "registrar_decision", room_id: "demo-cross" })).status).toBe(400);
  });
});
