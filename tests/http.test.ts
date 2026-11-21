// Pruebas por HTTP real, sin Next y sin navegador.
//
// Levantan los Route Handlers de src/app/api en un puerto libre (ver
// tests/helpers/route-server.ts) y corren contra ellos los mismos scripts que se
// usan a mano contra un servidor de verdad:
//   - scripts/e2e.mjs: varios participantes independientes recorren las salas
//     single_org y cross_org de punta a punta, cada uno con su propio SSE.
//   - scripts/load-test.mjs: muchas conexiones SSE simultáneas.
//
// No llaman a ningún modelo (el e2e corre sin --llm).

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missingRoutes, startRouteServer, type RouteServer } from "./helpers/route-server";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function runScript(args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, args, { cwd: ROOT, timeout: 110_000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      resolve({ code, output: `${stdout}${stderr}` });
    });
  });
}

let server: RouteServer;

beforeAll(async () => {
  server = await startRouteServer();
});

afterAll(async () => {
  await server.close();
});

describe("API por HTTP", () => {
  it("existen todas las rutas del contrato", () => {
    expect(missingRoutes()).toEqual([]);
  });

  it("recorrido de punta a punta: single_org, cross_org y otra organización, sin ninguna falla", async () => {
    const { code, output } = await runScript(["scripts/e2e.mjs", server.url, "--verbose"]);
    const failed = output.split("\n").filter((line) => line.trimStart().startsWith("FALLA"));
    expect(failed, output).toEqual([]);
    expect(code, output).toBe(0);
    expect(output).toMatch(/Resultado: \d+ pasos OK, 0 con FALLA/);
  }, 120_000);

  it("el Comité también puede sellar la primera propuesta sin vetar", async () => {
    const { code, output } = await runScript(["scripts/e2e.mjs", server.url, "--only", "cross", "--committee", "approve"]);
    expect(code, output).toBe(0);
  }, 120_000);

  it("contraprueba: si el servidor filtrara un costo reservado por el SSE, el recorrido lo detecta y falla", async () => {
    // Servidor defectuoso a propósito: cuela el costo de cobertura de clinica_andes en la bitácora de cada mensaje.
    const leaky = await startRouteServer({ tamperSse: (message) => message.replace('"auditLog":[', '"auditLog":[{"ts":0,"type":"MUTATION","detail":{"costo":2400000}},') });
    try {
      const { code, output } = await runScript(["scripts/e2e.mjs", leaky.url, "--only", "cross", "--verbose"]);
      expect(code, output).toBe(1);
      expect(output).toContain("FALLA  ningún dato reservado viajó hacia quien no debe verlo");
      expect(output).toMatch(/hospital_rural\/\w+: .*2400000.* viajó en su SSE/);
      expect(output).toMatch(/pantalla general: .*2400000.* viajó en su SSE/);
    } finally {
      await leaky.close();
    }
  }, 120_000);

  it("carga: 60 conexiones SSE simultáneas reciben todos los cambios y solo su propia vista", async () => {
    const { code, output } = await runScript(["scripts/load-test.mjs", server.url, "60", "--actions", "5", "--interval", "50"]);
    expect(code, output).toBe(0);
    expect(output).toContain("5/5 cambios llegaron a las 60 conexiones abiertas");
    expect(output).toContain("cada conexión recibió solo la vista que pidió");
  }, 60_000);
});
