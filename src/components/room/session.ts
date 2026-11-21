// Rol y token guardados por sala en sessionStorage, para recuperarlos al recargar.
// sessionStorage es por pestaña: dos pestañas pueden ocupar dos roles distintos.
export type StoredSession = { role: string; token: string };

const key = (roomId: string) => `room:${roomId}:session`;

export function loadSession(roomId: string): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(key(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return typeof parsed.role === "string" && typeof parsed.token === "string"
      ? { role: parsed.role, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(roomId: string, session: StoredSession): void {
  try {
    window.sessionStorage.setItem(key(roomId), JSON.stringify(session));
  } catch {
    // Almacenamiento bloqueado (modo privado): la sala funciona igual, sin recuperar el rol.
  }
}

export function clearSession(roomId: string): void {
  try {
    window.sessionStorage.removeItem(key(roomId));
  } catch {
    // Igual que arriba.
  }
}
