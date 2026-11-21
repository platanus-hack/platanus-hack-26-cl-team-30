"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, LoaderCircle, Mic, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIntegrations } from "./integrations";

type Phase = "idle" | "asking" | "connecting" | "listening" | "speaking" | "ended" | "error";

type Session = { endSession: () => Promise<void> };

/** Clave del QR del Comité, guardada al entrar por el código. La necesita la voz. */
export function committeeKeyStorageKey(roomId: string): string {
  return `nexo:${roomId}:committee-key`;
}

function loadCommitteeKey(roomId: string): string | null {
  try {
    return window.sessionStorage.getItem(committeeKeyStorageKey(roomId));
  } catch {
    return null;
  }
}

const PHASE_TEXT: Record<Phase, string> = {
  idle: "",
  asking: "Esperando el permiso del micrófono…",
  connecting: "Conectando con el asistente…",
  listening: "Te escucho. Habla cuando quieras.",
  speaking: "El asistente está hablando…",
  ended: "Llamada terminada.",
  error: "",
};

/**
 * «Hablar con el asistente de voz» para el Comité. El servidor entrega una URL
 * firmada (POST /api/rooms/:id/committee/voice) y la conversación corre con
 * ElevenLabs en el navegador. Si el Comité decide por voz, la decisión llega a
 * todas las pantallas por el flujo en vivo de siempre.
 */
export function VoiceAssistant({ roomId }: { roomId: string }) {
  const integrations = useIntegrations();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Session | null>(null);

  useEffect(() => () => void session.current?.endSession().catch(() => {}), []);

  if (!integrations?.voice) return null;
  const live = phase === "connecting" || phase === "listening" || phase === "speaking";

  async function start() {
    setError(null);
    const committeeKey = loadCommitteeKey(roomId);
    if (!committeeKey) {
      setPhase("error");
      setError("Para hablar con el asistente, entra escaneando el código QR del Comité en la pantalla grande.");
      return;
    }
    // Primero el micrófono, con el aviso a la vista: sin permiso no hay conversación.
    setPhase("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setPhase("error");
      setError("Sin permiso para el micrófono no podemos conversar. Actívalo en tu navegador y vuelve a intentarlo.");
      return;
    }
    setPhase("connecting");
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/committee/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ committeeKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.signedUrl !== "string") {
        throw new Error(typeof data.error === "string" ? data.error : "El asistente de voz no está disponible ahora.");
      }
      const { Conversation } = await import("@elevenlabs/client");
      session.current = await Conversation.startSession({
        signedUrl: data.signedUrl,
        dynamicVariables: { session_id: String(data.sessionId ?? "") },
        onModeChange: ({ mode }) => setPhase(mode === "speaking" ? "speaking" : "listening"),
        onStatusChange: ({ status }) => {
          if (status === "connected") setPhase((current) => (current === "connecting" ? "listening" : current));
          if (status === "disconnected") setPhase((current) => (current === "error" ? current : "ended"));
        },
        onError: (message) => {
          setPhase("error");
          setError(typeof message === "string" && message ? message : "Se cortó la conversación.");
        },
      });
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "No se pudo iniciar la conversación.");
    }
  }

  async function hangUp() {
    await session.current?.endSession().catch(() => {});
    session.current = null;
    setPhase("ended");
  }

  return (
    <section className="panel p-5" aria-labelledby="voz-titulo">
      <h2 id="voz-titulo" className="flex items-center gap-2 text-lg font-semibold">
        <AudioLines className="size-5 text-brand" aria-hidden /> Decidir hablando
      </h2>
      <p className="small mt-1 text-muted-foreground">
        Un asistente de voz te explica el caso y registra tu decisión con tu razón. Te pediremos permiso para usar el micrófono.
      </p>
      {live ? (
        <div className="mt-4 space-y-3">
          <p className={cn("flex items-center gap-2 font-semibold", phase === "speaking" ? "text-brand" : "text-calm")} role="status">
            {phase === "connecting" ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <span className="breathe size-3 rounded-full bg-current" aria-hidden />}
            {PHASE_TEXT[phase]}
          </p>
          <button type="button" className="btn btn-veto btn-lg w-full sm:w-auto" onClick={hangUp}>
            <PhoneOff className="size-5" aria-hidden />
            Colgar
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <button type="button" className="btn btn-primary btn-lg w-full sm:w-auto" disabled={phase === "asking"} onClick={start}>
            {phase === "asking" ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Mic className="size-5" aria-hidden />}
            {phase === "asking" ? "Esperando permiso…" : "Hablar con el asistente de voz"}
          </button>
          {phase === "ended" && <p className="small text-muted-foreground">{PHASE_TEXT.ended}</p>}
          {error && (
            <p role="alert" className="small rounded-xl bg-bleed-soft px-3 py-2 text-bleed">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
