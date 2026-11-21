// Pruebas de Supabase (src/lib/supabase/ y las rutas /api/access-requests e
// /api/interviews), sin llamar a Supabase: fetch se reemplaza por un doble.
//
// Qué se garantiza:
//   1. Sin configuración o sin tabla, nada se rompe: 503 STORAGE_UNAVAILABLE en el
//      formulario e interview: null en la entrevista.
//   2. El formulario se valida antes de tocar la base.
//   3. Un correo repetido responde ok (no se revela quién se inscribió).
//   4. La clave service_role solo viaja hacia la URL de Supabase.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as accessRoute } from "../src/app/api/access-requests/route";
import { GET as interviewsRoute } from "../src/app/api/interviews/route";
import { resetRateLimits } from "../src/lib/store/rate-limit";
import { resetInterviewCache } from "../src/lib/supabase/interviews";
import { supabaseConfig } from "../src/lib/supabase/server";

const URL_BASE = "https://proyecto-de-prueba.supabase.co";
const SERVICE_KEY = "clave-service-role-de-prueba";

const post = (body: unknown) => new Request("http://nexo.test/api/access-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const valid = { name: "Ana Pérez", email: "Ana@Ejemplo.CL", organization: "Hospital de prueba", message: "Quiero ver la demo" };

function configure() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_BASE);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
}

function fakeFetch(response: { status: number; body: unknown }) {
  const fn = vi.fn(async () => new Response(JSON.stringify(response.body), { status: response.status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  resetRateLimits();
  resetInterviewCache();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("configuración", () => {
  it("sin URL o sin clave service_role no hay configuración", () => {
    expect(supabaseConfig()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_BASE);
    expect(supabaseConfig()).toBeNull();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
    expect(supabaseConfig()).toEqual({ url: URL_BASE, serviceKey: SERVICE_KEY });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "no es una url");
    expect(supabaseConfig()).toBeNull();
  });
});

describe("POST /api/access-requests", () => {
  it("sin Supabase configurado responde 503 STORAGE_UNAVAILABLE con un mensaje claro, sin llamar a nadie", async () => {
    const fetchSpy = fakeFetch({ status: 201, body: {} });
    const res = await accessRoute(post(valid));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "STORAGE_UNAVAILABLE", error: expect.stringMatching(/no podemos guardar/) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("si la tabla no existe todavía responde 503, no 500", async () => {
    configure();
    fakeFetch({ status: 404, body: { code: "PGRST205", message: "Could not find the table" } });
    expect((await accessRoute(post(valid))).status).toBe(503);
  });

  it("si Supabase no responde (error de red) responde 503", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect((await accessRoute(post(valid))).status).toBe(503);
  });

  it("guarda la solicitud: correo en minúsculas, rol 'other', y la clave solo va a Supabase", async () => {
    configure();
    const fetchSpy = fakeFetch({ status: 201, body: null });
    const res = await accessRoute(post(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL_BASE}/rest/v1/access_requests`);
    expect(JSON.parse(String(init.body))).toEqual({ name: "Ana Pérez", email: "ana@ejemplo.cl", organization: "Hospital de prueba", role: "other", source: "landing", message: "Quiero ver la demo" });
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SERVICE_KEY}`);
  });

  it("un correo ya registrado responde ok igual: no se revela quién se inscribió", async () => {
    configure();
    fakeFetch({ status: 409, body: { code: "23505", message: "duplicate key" } });
    expect(await (await accessRoute(post(valid))).json()).toEqual({ ok: true });
  });

  it("valida el formulario antes de tocar la base: 400 con un mensaje para la persona", async () => {
    configure();
    const fetchSpy = fakeFetch({ status: 201, body: null });
    for (const body of [{ ...valid, email: "sin-arroba" }, { ...valid, name: "A" }, { ...valid, message: "x".repeat(1001) }, { email: "a@b.cl" }, "texto"]) {
      const res = await accessRoute(post(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toMatchObject({ code: "BAD_REQUEST", error: expect.any(String) });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("el campo trampa para bots responde ok sin guardar nada", async () => {
    configure();
    const fetchSpy = fakeFetch({ status: 201, body: null });
    expect((await accessRoute(post({ ...valid, website: "http://spam" }))).status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("tiene límite de peticiones propio", async () => {
    for (let i = 0; i < 5; i++) await accessRoute(post(valid));
    expect((await accessRoute(post(valid))).status).toBe(429);
  });
});

describe("GET /api/interviews", () => {
  it("sin Supabase responde interview: null y available: false, nunca un error", async () => {
    const res = await interviewsRoute(new Request("http://nexo.test/api/interviews"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ interview: null, available: false });
  });

  it("si la tabla no existe responde interview: null", async () => {
    configure();
    fakeFetch({ status: 404, body: { code: "PGRST205" } });
    expect(await (await interviewsRoute(new Request("http://nexo.test/api/interviews"))).json()).toEqual({ interview: null, available: false });
  });

  it("entrega la última entrevista publicada con las preguntas respondidas, en orden", async () => {
    configure();
    const fetchSpy = fakeFetch({
      status: 200,
      body: [{ name: "Dra. Soto", role: "Jefa de UCI", clinic: "Clínica de prueba", answers: { q_trust: "Que la regla sea pública", q_today: "Por teléfono", q_vacia: "x", q_missing: "  " }, published_at: "2026-11-21T12:00:00Z" }],
    });
    const body = await (await interviewsRoute(new Request("http://nexo.test/api/interviews"))).json();
    expect(body).toEqual({
      available: true,
      interview: {
        name: "Dra. Soto",
        role: "Jefa de UCI",
        organization: "Clínica de prueba",
        publishedAt: "2026-11-21T12:00:00Z",
        answers: [
          { key: "q_today", question: expect.any(String), answer: "Por teléfono" },
          { key: "q_trust", question: expect.any(String), answer: "Que la regla sea pública" },
        ],
      },
    });
    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(url).toContain("published_at=not.is.null");
    expect(url).toContain("order=published_at.desc");
  });

  it("sin entrevistas publicadas responde interview: null con available: true", async () => {
    configure();
    fakeFetch({ status: 200, body: [] });
    expect(await (await interviewsRoute(new Request("http://nexo.test/api/interviews"))).json()).toEqual({ interview: null, available: true });
  });
});
