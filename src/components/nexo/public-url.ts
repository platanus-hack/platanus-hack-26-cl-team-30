// Dirección pública con la que se arman los enlaces y códigos QR de una sala.
// NEXT_PUBLIC_BASE_URL permite fijarla (la IP de la red local o el deploy)
// cuando la pantalla se abre desde localhost.
export function publicBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return window.location.origin;
}

// Un teléfono no puede abrir localhost: esa dirección apunta a sí mismo.
export function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"].includes(hostname) || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

/**
 * Enlace que abre la estación de un rol. Es lo que codifica el QR. El del Comité
 * lleva además su clave (key): sin ella el servidor no deja tomar ese puesto.
 */
export function roleJoinUrl(baseUrl: string, roomId: string, orgId: string, roleId: string, committeeKey?: string): string {
  const query = new URLSearchParams({ orgId, roleId });
  if (committeeKey) query.set("key", committeeKey);
  return `${baseUrl}/room/${encodeURIComponent(roomId)}?${query}`;
}
