import { getRoom, projectForRole, resolveRoom, resolveViewer, subscribe } from "@/lib/rooms";

// GET /api/rooms/:roomId/events?role=role_a&token=...
// Flujo de eventos (SSE). Cada conexión recibe la sala ya filtrada para su rol,
// y un mensaje nuevo cada vez que alguien cambia algo. Sin token válido para el
// rol pedido, la conexión recibe la vista "stage" (solo lo que todos pueden ver).
// La sala "demo" se recrea al vuelo si el servidor se reinició.
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = resolveRoom(roomId);
  if (!room) return Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });

  const search = new URL(request.url).searchParams;
  // El token se valida una vez al abrir la conexión. Si el rol se libera, el
  // cliente debe reconectar; ver pendientes en docs/ARQUITECTURA.md.
  const viewer = resolveViewer(room, search.get("role"), search.get("token"));

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
