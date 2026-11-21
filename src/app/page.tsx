"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = { role: "user" | "assistant"; content: string };
type Health = {
  llm: { baseUrl: string; model: string; ok: boolean; detail: string };
  supabase: { configured: boolean };
};

// Pantalla de prueba: confirma que la app habla con el modelo de punta a punta.
// El viernes se reemplaza por el producto real.
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const history: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
    } catch (err) {
      setMessages(history);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Platanus Hack 26</h1>
        <p className="text-sm text-muted-foreground">
          {health === null
            ? "Revisando el modelo…"
            : health.llm.ok
              ? `Modelo ${health.llm.model} en ${health.llm.baseUrl}`
              : `Modelo sin conexión en ${health.llm.baseUrl}: ${health.llm.detail}`}
          {health && !health.supabase.configured ? " · Supabase sin configurar" : ""}
        </p>
      </header>

      <section className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Escribe algo para probar el modelo.</p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user"
                ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                : "w-fit max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm"
            }
          >
            {message.content || "…"}
          </div>
        ))}
        <div ref={endRef} />
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Mensaje"
          rows={2}
          className="flex-1"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? "Enviando…" : "Enviar"}
        </Button>
      </form>
    </main>
  );
}
