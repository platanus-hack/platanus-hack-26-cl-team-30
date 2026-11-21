// Límite de peticiones por cliente, en memoria (un solo proceso, igual que las salas).
//
// Adaptado de la versión de Ramón (su src/lib/store/rate-limit.ts, commits
// b22928c y fbe8a4f). Ventana fija por clave: "crear sala" de una IP, "mutar" de
// una IP, etc. Además hay topes globales (sin importar quién pide) para lo que
// llama al modelo, que es lo caro.
//
// Identidad del cliente: los encabezados X-Forwarded-For los puede escribir
// cualquiera, así que solo se leen con TRUST_PROXY=1 (detrás del proxy de
// Render), y entonces se toma el último salto, que es el que agregó nuestro
// proxy. Sin TRUST_PROXY todos comparten un mismo balde: los límites siguen
// protegiendo, solo que más gruesos.

const windows = new Map<string, { start: number; count: number }>();
const MAX_KEYS = 10_000;

export type RateLimitRule = { limit: number; windowMs: number };

/**
 * Límites por cliente y por minuto. Generosos para una persona (o una sala de
 * demo detrás de una misma red); cortan a un script que abusa.
 */
export const RATE_LIMITS = {
  createRoom: { limit: 30, windowMs: 60_000 },
  /** Mutar llama al modelo: el límite más estricto. */
  mutate: { limit: 6, windowMs: 60_000 },
  action: { limit: 600, windowMs: 60_000 },
  events: { limit: 300, windowMs: 60_000 },
  acta: { limit: 60, windowMs: 60_000 },
  host: { limit: 60, windowMs: 60_000 },
  accessRequest: { limit: 5, windowMs: 60_000 },
  interviews: { limit: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/** Topes globales por minuto, sin importar quién pide. El modelo es uno solo para todos. */
export const GLOBAL_LIMITS = {
  mutate: { limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/** NEXO_RATE_LIMITS=off apaga los límites (pruebas de carga locales). Nunca en el deploy. */
function disabled(): boolean {
  return process.env.NEXO_RATE_LIMITS === "off";
}

/** Cuenta una petición. true si cabe en la ventana; false si se pasó del límite. */
export function allow(key: string, rule: RateLimitRule, now: number = Date.now()): boolean {
  if (disabled()) return true;
  const current = windows.get(key);
  if (!current || now - current.start >= rule.windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > MAX_KEYS) {
      for (const [k, w] of windows) if (now - w.start >= 60_000) windows.delete(k);
    }
    return true;
  }
  if (current.count >= rule.limit) return false;
  current.count += 1;
  return true;
}

/** Segundos que faltan para que se abra la ventana de una clave. */
export function retryAfterSeconds(key: string, rule: RateLimitRule, now: number = Date.now()): number {
  const current = windows.get(key);
  return current ? Math.max(1, Math.ceil((current.start + rule.windowMs - now) / 1000)) : 1;
}

/**
 * Clave del cliente para los límites. Solo con TRUST_PROXY=1 se leen los
 * encabezados reenviados, y entonces el último salto de X-Forwarded-For (el que
 * agregó nuestro proxy) o X-Real-IP.
 */
export function clientKey(headers: Headers): string {
  if (process.env.TRUST_PROXY !== "1") return "direct";
  const hops = headers.get("x-forwarded-for")?.split(",").map((hop) => hop.trim()).filter(Boolean) ?? [];
  return hops.at(-1) || headers.get("x-real-ip")?.trim() || "direct";
}

/**
 * Revisa el límite de un tipo de petición para un cliente. Devuelve la
 * respuesta 429 lista para devolver, o null si la petición puede seguir.
 */
export function rateLimited(request: Request, kind: keyof typeof RATE_LIMITS): Response | null {
  const rule = RATE_LIMITS[kind];
  const key = `${kind}:${clientKey(request.headers)}`;
  if (allow(key, rule)) return null;
  return tooMany(retryAfterSeconds(key, rule));
}

/** Tope global (sin importar quién pide). Respuesta 429 o null. */
export function globallyLimited(kind: keyof typeof GLOBAL_LIMITS): Response | null {
  const rule = GLOBAL_LIMITS[kind];
  const key = `global:${kind}`;
  if (allow(key, rule)) return null;
  return tooMany(retryAfterSeconds(key, rule));
}

function tooMany(seconds: number): Response {
  return Response.json(
    { error: "Demasiadas solicitudes seguidas. Espera un momento y vuelve a intentar.", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(seconds) } },
  );
}

/** Solo para pruebas: vacía todas las ventanas. */
export function resetRateLimits(): void {
  windows.clear();
}
