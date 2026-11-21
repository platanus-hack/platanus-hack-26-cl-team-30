import { chatStream, describeError, type ChatMessage } from "@/lib/llm";

export async function POST(request: Request) {
  let messages: ChatMessage[];
  try {
    const body = await request.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return Response.json({ error: "Se espera { messages: [{ role, content }] }" }, { status: 400 });
  }

  try {
    const stream = await chatStream(messages, request.signal);
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
