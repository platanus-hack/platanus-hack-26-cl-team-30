import "server-only";

// Acceso a Supabase SOLO desde el servidor, con la clave service_role.
//
// La clave service_role se salta RLS: nunca debe llegar al navegador. Por eso
// este módulo importa "server-only" (Next falla al compilar si un componente de
// cliente lo importa) y la clave se lee de SUPABASE_SERVICE_ROLE_KEY, una
// variable sin prefijo NEXT_PUBLIC_.
//
// Se habla con la API REST de Supabase (PostgREST) con fetch, sin el SDK: son dos
// operaciones (insertar y leer una fila) y así no hay una dependencia más.
//
// Todo degrada sin romper: si faltan las variables, si la tabla no existe o si
// Supabase no responde, las funciones devuelven un resultado "no disponible" y
// la ruta responde 503 STORAGE_UNAVAILABLE (o null, en una lectura).

const REQUEST_TIMEOUT_MS = 5000;

export type SupabaseConfig = { url: string; serviceKey: string };

/** Configuración desde el entorno, o null si falta algo. */
export function supabaseConfig(): SupabaseConfig | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { url, serviceKey };
}

export type StorageFailure = {
  ok: false;
  /** not_configured: faltan variables. missing_table: la tabla no existe todavía. error: cualquier otro problema. */
  reason: "not_configured" | "missing_table" | "rejected" | "error";
  /** Código de PostgREST o de Postgres, si vino. */
  code?: string;
};

function headers(config: SupabaseConfig, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json", ...extra };
}

async function failureFrom(res: Response): Promise<StorageFailure> {
  let code: string | undefined;
  try {
    code = ((await res.json()) as { code?: string }).code;
  } catch {
    // Respuesta sin JSON.
  }
  // PGRST205 (y 42P01 en versiones anteriores): la tabla no existe. PGRST204: falta una columna.
  if (code === "PGRST205" || code === "42P01" || code === "PGRST204") return { ok: false, reason: "missing_table", code };
  // 23514 (check) y 22P02 (formato): Postgres rechazó los datos.
  if (code === "23514" || code === "22P02" || code === "23502") return { ok: false, reason: "rejected", code };
  return { ok: false, reason: "error", ...(code ? { code } : {}) };
}

/**
 * Inserta una fila. Una fila repetida (violación de unicidad, 23505) cuenta como
 * éxito: así una ruta no revela si un correo ya estaba registrado.
 */
export async function insertRow(table: string, row: Record<string, unknown>): Promise<{ ok: true } | StorageFailure> {
  const config = supabaseConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  try {
    const res = await fetch(`${config.url}/rest/v1/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: headers(config, { Prefer: "return=minimal" }),
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    const failure = await failureFrom(res);
    return failure.code === "23505" ? { ok: true } : failure;
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Lee filas con una consulta de PostgREST ya armada ("select=...&order=..."). */
export async function selectRows<T>(table: string, query: string): Promise<{ ok: true; rows: T[] } | StorageFailure> {
  const config = supabaseConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  try {
    const res = await fetch(`${config.url}/rest/v1/${encodeURIComponent(table)}?${query}`, {
      headers: headers(config),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return failureFrom(res);
    const rows = (await res.json()) as unknown;
    return Array.isArray(rows) ? { ok: true, rows: rows as T[] } : { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}
