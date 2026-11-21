import { getActa } from "@/lib/store/rooms";

// GET /api/rooms/:roomId/acta?format=json|md
// Acta de la decisión con la bitácora completa. Se arma desde la vista de
// pantalla general, así que no contiene valores reservados de ningún rol.
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const result = getActa(roomId);
  if (!result) return Response.json({ error: "La sala no existe", code: "ROOM_NOT_FOUND" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format === "md") {
    return new Response(result.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="acta-${roomId}.md"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (format !== "json") return Response.json({ error: 'format debe ser "json" o "md"', code: "BAD_REQUEST" }, { status: 400 });
  return Response.json(result.acta, { headers: { "Cache-Control": "no-store" } });
}
