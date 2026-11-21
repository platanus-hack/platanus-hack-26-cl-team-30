import { getRoom, projectForRole, subscribe, type Viewer } from "@/lib/rooms";

// GET /api/rooms/:roomId/events?role=role_a
// Flujo de eventos (SSE). Cada conexión recibe la sala ya filtrada para su rol,
// y un mensaje nuevo cada vez que alguien cambia algo.
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) return Response.json({ error: "La sala no existe" }, { status: 404 });

  const requested = new URL(request.url).searchParams.get("role") ?? "stage";
  const viewer: Viewer = room.roles.some((role) => role.id === requested) ? requested : "stage";

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        const current = getRoom(roomId);
        if (!current) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(projectForRole(current, viewer))}\n\n`));
      };
      send();
      const unsubscribe = subscribe(roomId, send);
      // Comentario periódico para que proxies y navegadores no cierren la conexión.
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // La conexión ya estaba cerrada.
        }
      });
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
