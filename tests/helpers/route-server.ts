// Sirve los Route Handlers de src/app/api por HTTP real, sin levantar Next.
//
// Los handlers de Next son funciones (Request) => Response, así que basta un
// servidor de Node que traduzca cada petición. Con esto las pruebas pueden
// recorrer la API de punta a punta, con conexiones SSE reales, dentro de
// "npm test" y sin chocar con el servidor de desarrollo de nadie.
//
// Límite conocido: no pasa por el enrutador ni el middleware de Next. Lo que se
// prueba es la lógica de las rutas, no la configuración del framework.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Response | Promise<Response>;
type RouteModule = Partial<Record<string, Handler>>;

const API_DIR = fileURLToPath(new URL("../../src/app/api/", import.meta.url));

/** Rutas del contrato. `file` es relativo a src/app/api. */
const ROUTES: { pattern: RegExp; file: string }[] = [
  { pattern: /^\/api\/ping$/, file: "ping/route.ts" },
  { pattern: /^\/api\/health$/, file: "health/route.ts" },
  { pattern: /^\/api\/rooms$/, file: "rooms/route.ts" },
  { pattern: /^\/api\/rooms\/([^/]+)$/, file: "rooms/[roomId]/route.ts" },
  { pattern: /^\/api\/rooms\/([^/]+)\/events$/, file: "rooms/[roomId]/events/route.ts" },
  { pattern: /^\/api\/rooms\/([^/]+)\/action$/, file: "rooms/[roomId]/action/route.ts" },
  { pattern: /^\/api\/rooms\/([^/]+)\/mutate$/, file: "rooms/[roomId]/mutate/route.ts" },
  { pattern: /^\/api\/rooms\/([^/]+)\/acta$/, file: "rooms/[roomId]/acta/route.ts" },
  { pattern: /^\/api\/rooms\/([^/]+)\/autopilot$/, file: "rooms/[roomId]/autopilot/route.ts" },
  { pattern: /^\/api\/rooms\/([^/]+)\/host$/, file: "rooms/[roomId]/host/route.ts" },
  { pattern: /^\/api\/rooms\/([^/]+)\/revoke$/, file: "rooms/[roomId]/revoke/route.ts" },
  { pattern: /^\/api\/access-requests$/, file: "access-requests/route.ts" },
  { pattern: /^\/api\/interviews$/, file: "interviews/route.ts" },
];

/** Rutas del contrato cuyo archivo todavía no existe. */
export function missingRoutes(): string[] {
  return ROUTES.filter((route) => !existsSync(API_DIR + route.file)).map((route) => route.file);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export type RouteServerOptions = {
  /**
   * Solo para contrapruebas: altera cada mensaje SSE antes de enviarlo, para
   * simular un servidor defectuoso y comprobar que las pruebas lo detectan.
   */
  tamperSse?: (message: string) => string;
};

async function handle(req: IncomingMessage, res: ServerResponse, origin: string, options: RouteServerOptions) {
  const url = new URL(req.url ?? "/", origin);
  const route = ROUTES.find((candidate) => candidate.pattern.test(url.pathname));
  if (!route || !existsSync(API_DIR + route.file)) {
    res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Ruta no encontrada", code: "NOT_FOUND" }));
    return;
  }
  const routeModule = (await import(/* @vite-ignore */ API_DIR + route.file)) as RouteModule;
  const handler = routeModule[req.method ?? "GET"];
  if (!handler) {
    res.writeHead(405).end();
    return;
  }

  // La señal se aborta cuando el cliente corta: así las rutas SSE limpian sus suscripciones.
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
  const request = new Request(url, { method: req.method, headers, body: hasBody ? await readBody(req) : undefined, signal: abort.signal });
  const roomId = url.pathname.match(route.pattern)?.[1];
  const params: Record<string, string> = roomId ? { roomId: decodeURIComponent(roomId) } : {};
  const response = await handler(request, { params: Promise.resolve(params) });

  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) {
    res.end();
    return;
  }
  const isSse = (response.headers.get("content-type") ?? "").includes("text/event-stream");
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  abort.signal.addEventListener("abort", () => void reader.cancel().catch(() => {}));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(isSse && options.tamperSse ? options.tamperSse(decoder.decode(value)) : value);
    }
  } catch {
    // El cliente cortó la conexión a mitad de un stream.
  }
  res.end();
}

export type RouteServer = { url: string; close: () => Promise<void> };

/** Levanta el servidor en un puerto libre de esta máquina. */
export async function startRouteServer(options: RouteServerOptions = {}): Promise<RouteServer> {
  let origin = "http://127.0.0.1";
  const server: Server = createServer((req, res) => {
    handle(req, res, origin, options).catch((error) => {
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(error?.message ?? error), code: "HANDLER_THREW" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url: origin,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
