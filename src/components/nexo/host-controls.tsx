"use client";

import { useState } from "react";
import { Bot, ChevronDown, LoaderCircle, RotateCcw, Square } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { hostRequest, type HostCredentials } from "@/lib/client/use-room";
import { CommitteeNotify } from "./committee-notify";

/**
 * Controles del presentador, plegados para no distraer: avisar al Comité,
 * ensayo automático y reiniciar. Solo aparecen si esta pantalla tiene el token
 * de anfitrión; el servidor igual lo revisa en cada petición.
 */
export function HostControls({ room, credentials }: { room: ProjectedRoomState; credentials: HostCredentials }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const running = room.autopilot?.running ?? false;

  async function run(id: string, path: "" | "/autopilot", method: "POST" | "DELETE", body: Record<string, unknown> | undefined, okText: string) {
    setBusy(id);
    setMessage(null);
    const result = await hostRequest(room.roomId, credentials, path, method, body);
    setBusy(null);
    setMessage(result.ok ? { ok: true, text: okText } : { ok: false, text: result.error ?? "No se pudo." });
  }

  return (
    <details className="group panel">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-semibold text-muted-foreground">
        Controles del presentador
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-5 px-5 pb-5">
        {room.mode === "cross_org" && <CommitteeNotify room={room} credentials={credentials} />}
        <div>
          <p className="font-semibold">Ensayo automático</p>
          <p className="small text-muted-foreground">Bots toman los puestos libres y recorren la demo paso a paso. Queda marcado como ensayo en el acta.</p>
          {room.autopilot?.lastStep && <p className="small mt-1">Último paso: {room.autopilot.lastStep}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {running ? (
              <button type="button" className="btn btn-line" disabled={busy !== null} onClick={() => run("stop", "/autopilot", "POST", { action: "stop" }, "Ensayo detenido.")}>
                {busy === "stop" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Square className="size-4" aria-hidden />}
                Detener el ensayo
              </button>
            ) : (
              <button type="button" className="btn btn-line" disabled={busy !== null} onClick={() => run("start", "/autopilot", "POST", { action: "start" }, "Ensayo en marcha.")}>
                {busy === "start" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Bot className="size-4" aria-hidden />}
                Iniciar ensayo automático
              </button>
            )}
            <button
              type="button"
              className="btn btn-line"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm("¿Reiniciar la sala? Todos vuelven a empezar y deberán entrar de nuevo.")) void run("reset", "", "DELETE", undefined, "Sala reiniciada.");
              }}
            >
              {busy === "reset" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
              Reiniciar la sala
            </button>
          </div>
        </div>
        {message && (
          <p role="status" className={`small rounded-xl px-3 py-2 ${message.ok ? "bg-calm-soft text-calm" : "bg-bleed-soft text-bleed"}`}>
            {message.text}
          </p>
        )}
      </div>
    </details>
  );
}
