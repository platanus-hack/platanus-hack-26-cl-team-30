// Controles de la pantalla grande (reiniciar, ensayo automático, liberar un
// puesto, mutar): solo para el anfitrión de la sala.
//
// Adaptado de Ramón (su src/app/api/rooms/host.ts, commit b22928c). El
// anfitrión presenta el token que recibió al crear la sala en el encabezado
// "x-host-token". La clave de administración (NEXO_ADMIN_KEY, encabezado
// "x-admin-key") también sirve, para operar las salas fijas en el deploy.

import { getRoom, isHost } from "./rooms";

export const HOST_TOKEN_HEADER = "x-host-token";
export const ADMIN_KEY_HEADER = "x-admin-key";

/** Respuesta de error si quien pide no es el anfitrión, o null si puede seguir. */
export function requireHost(request: Request, roomId: string): Response | null {
  if (!getRoom(roomId)) return Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });
  if (!isHost(roomId, request.headers.get(HOST_TOKEN_HEADER), request.headers.get(ADMIN_KEY_HEADER))) {
    return Response.json({ error: "Solo quien abrió la sala puede usar estos controles", code: "HOST_ONLY" }, { status: 403 });
  }
  return null;
}
