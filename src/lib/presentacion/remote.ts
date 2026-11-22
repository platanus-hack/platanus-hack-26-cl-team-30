import "server-only";

// Puente de la presentación hacia un deploy público de la demo.
// Si PRESENTACION_DEMO_URL está definido (por ejemplo https://nexo-og8m.onrender.com),
// la lámina «En vivo» abre la sala en ese deploy: así el QR de la pantalla grande
// apunta a una dirección pública que los celulares pueden escanear, aunque la
// presentación corra en localhost. El navegador no puede leer los eventos de otro
// dominio (no hay CORS), así que pasan por estas rutas del servidor.
// Solo se habla con esa URL fija: nunca con una dirección que mande el cliente.

export function remoteDemoBase(): string | null {
  const raw = process.env.PRESENTACION_DEMO_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Ids de sala válidos: letras, números, guion y guion bajo. */
export const ROOM_ID = /^[A-Za-z0-9_-]{1,40}$/;

export const notConfigured = () =>
  Response.json({ error: "La presentación no tiene un deploy remoto configurado", code: "NOT_CONFIGURED" }, { status: 404 });
