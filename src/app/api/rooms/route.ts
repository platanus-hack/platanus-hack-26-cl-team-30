import { createRoom } from "@/lib/rooms";

// POST /api/rooms: crea una sala nueva y devuelve su identificador.
export async function POST() {
  const room = createRoom();
  return Response.json({ id: room.id, roles: room.roles });
}
