"use client";

// «Pregúntale a Sculptor»: botón flotante que abre una conversación con la guía
// de Sculptor (src/integrations/guide-agent.ts), por voz o por texto. Usa el SDK
// de ElevenLabs que ya trae el proyecto (@elevenlabs/client, el mismo del
// asistente del Comité) con una URL firmada que entrega /api/guide/voice. Sabe en
// qué página está y, en la pantalla grande, qué sala es (variables dinámicas). La
// guía no toca la sala: su estado lo pide con una herramienta que solo devuelve lo público.

import { useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { LoaderCircle, MessageSquareText, Mic, Send, X } from "lucide-react";
import { Mark } from "@/components/landing/mark";

type Line = { role: "user" | "agent"; text: string };
type Session = { endSession: () => Promise<void>; sendUserMessage?: (text: string) => void };
type Mode = "voice" | "text";

export function GuideAssistant({ page, roomId }: { page: string; roomId?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "live">("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Session | null>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => () => void session.current?.endSession().catch(() => {}), []);
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [lines]);

  // El SDK de ElevenLabs (unos 640 KB) no viaja con la página: se pide recién al abrir
  // el panel, junto con la conexión a su servidor, para que al elegir voz o texto ya esté.
  function warm() {
    preconnect("https://api.elevenlabs.io");
    void import("@elevenlabs/client").catch(() => {});
  }

  async function start(next: Mode) {
    setMode(next);
    setState("connecting");
    setError(null);
    setLines([]);
    try {
      const res = await fetch("/api/guide/voice", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.signedUrl !== "string") throw new Error(typeof data.error === "string" ? data.error : "La guía no está disponible ahora.");
      const { Conversation } = await import("@elevenlabs/client");
      session.current = (await Conversation.startSession({
        signedUrl: data.signedUrl,
        textOnly: next === "text",
        dynamicVariables: { pagina: page, room_id: roomId ?? "" },
        onMessage: ({ message, role }) => setLines((prev) => [...prev, { role, text: message }]),
        onDisconnect: () => setState("idle"),
        onError: (message: string) => setError(message || "Se cortó la conversación."),
      })) as Session;
      setState("live");
    } catch (cause) {
      setState("idle");
      setError(cause instanceof Error ? cause.message : "No se pudo abrir la conversación.");
    }
  }

  async function stop() {
    await session.current?.endSession().catch(() => {});
    session.current = null;
    setState("idle");
    setMode(null);
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !session.current?.sendUserMessage) return;
    session.current.sendUserMessage(text);
    setLines((prev) => [...prev, { role: "user", text }]);
    setDraft("");
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open && (
        <section role="dialog" aria-label="Pregúntale a Sculptor" className="flex max-h-[min(34rem,calc(100svh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-lift">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <span className="flex items-center gap-3 text-lg font-bold tracking-tight">
              <Mark size={26} /> Pregúntale a Sculptor
            </span>
            <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-muted" aria-label="Cerrar" onClick={() => setOpen(false)}>
              <X className="size-5" aria-hidden />
            </button>
          </header>

          <ol ref={list} className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4" aria-live="polite">
            {lines.length === 0 && state !== "connecting" && <li className="text-base text-muted-foreground">Le explico qué es Sculptor o le digo qué hacer en la demo.</li>}
            {state === "connecting" && (
              <li className="flex items-center gap-2 text-base text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden /> Conectando…
              </li>
            )}
            {lines.map((line, i) => (
              <li key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-snug ${line.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted"}`}>
                {line.text}
              </li>
            ))}
          </ol>

          {error && (
            <p role="alert" className="mx-5 mb-3 rounded-xl bg-bleed-soft px-3 py-2 text-base text-bleed">
              {error}
            </p>
          )}

          <footer className="border-t border-border p-4">
            {state === "live" && mode === "text" ? (
              <form onSubmit={send} className="flex gap-2">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} className="field min-h-11 flex-1" placeholder="Escriba su pregunta" aria-label="Su pregunta" />
                <button type="submit" className="btn btn-primary min-h-11 px-4" aria-label="Enviar">
                  <Send className="size-4" aria-hidden />
                </button>
              </form>
            ) : state === "idle" ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-primary min-h-11" onClick={() => start("voice")}>
                  <Mic className="size-4" aria-hidden /> Hablar
                </button>
                <button type="button" className="btn btn-line min-h-11" onClick={() => start("text")}>
                  <MessageSquareText className="size-4" aria-hidden /> Escribir
                </button>
              </div>
            ) : null}
            {state === "live" && (
              <button type="button" className="btn btn-line mt-2 min-h-11 w-full" onClick={stop}>
                Terminar la conversación
              </button>
            )}
          </footer>
        </section>
      )}
      <button
        type="button"
        onClick={() => {
          if (!open) warm();
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        className="inline-flex min-h-12 items-center gap-2.5 rounded-full border border-border bg-card py-2 pr-5 pl-3 text-base font-bold text-foreground shadow-lift transition-colors hover:bg-muted"
      >
        <Mark size={28} />
        Pregúntale a Sculptor
      </button>
    </div>
  );
}
