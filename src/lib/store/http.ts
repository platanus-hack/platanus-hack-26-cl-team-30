// Lectura acotada del body de una petición. Las rutas de salas no necesitan más
// que unos cientos de caracteres: un body gigante se rechaza sin interpretarlo.

/** Tamaño máximo, en caracteres, del body JSON de las rutas de salas. */
export const MAX_BODY_CHARS = 8_000;

export type JsonBody = { ok: true; value: unknown } | { ok: false; error: string };

/** Lee el body como JSON. Vacío cuenta como {}. Rechaza lo que no es JSON o excede el tope. */
export async function readJsonBody(request: Request): Promise<JsonBody> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_CHARS * 4) return { ok: false, error: "El body es demasiado grande" };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, error: "No se pudo leer el body" };
  }
  if (text.length > MAX_BODY_CHARS) return { ok: false, error: "El body es demasiado grande" };
  if (!text.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: "El body no es JSON válido" };
  }
}
