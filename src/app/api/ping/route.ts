// GET /api/ping: responde 200 siempre que el servidor esté vivo.
// Es el chequeo de salud que usa la plataforma de deploy. No depende del modelo,
// para que una caída del proveedor de IA no saque el servicio de rotación.
export function GET() {
  return Response.json({ ok: true });
}
