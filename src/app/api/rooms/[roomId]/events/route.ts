import { getRoom, isStakesRunning, projectRoom, resolveViewer, subscribe, touchPresence, type Credentials } from "@/lib/store/rooms";

/** Cada cuántos segundos se envía la sala aunque nada haya cambiado. Mantiene viva la conexión. */
const KEEPALIVE_SECONDS = 15;

// GET /api/rooms/:roomId/events?orgId=&roleId=&token=
// Flujo de eventos (SSE). Cada mensaje "data:" es un ProjectedRoomState ya
// filtrado en el servidor para quien mira. Sin token válido, o sin orgId o
// roleId, la conexión recibe la vista "stage" (solo lo que todos pueden ver).
// Se envía un mensaje cada vez que la sala cambia y, mientras el contador de lo
// que está en juego sigue corriendo, al menos uno por segundo.
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!getRoom(roomId)) return Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });

  const search = new URL(request.url).searchParams;
  const credentials: Credentials = { orgId: search.get("orgId"), roleId: search.get("roleId"), token: search.get("token") };

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // La conexión ya estaba cerrada.
        }
      };

      const send = () => {
        if (closed) return;
        // La identidad se comprueba en cada envío: si el rol se liberó o la sala se
        // reinició, esta conexión pasa a la vista general sin tener que reconectar.
        const viewer = resolveViewer(roomId, credentials);
        touchPresence(roomId, viewer);
        const projected = projectRoom(roomId, viewer);
        if (!projected) return close(); // La sala se borró.
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(projected)}\n\n`));
        } catch {
          close();
        }
      };

      send();
      const unsubscribe = subscribe(roomId, send);
      let seconds = 0;
      const tick = setInterval(() => {
        seconds += 1;
        if (isStakesRunning(roomId) || seconds % KEEPALIVE_SECONDS === 0) send();
        else touchPresence(roomId, resolveViewer(roomId, credentials));
      }, 1000);

      cleanup = () => {
        clearInterval(tick);
        unsubscribe();
      };
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
