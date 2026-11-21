"use client";

import { useState } from "react";
import { BellRing, LoaderCircle, MessageCircle, Phone } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import type { HostCredentials } from "@/lib/client/use-room";
import { useIntegrations } from "./integrations";

type Channel = "whatsapp" | "call";
type ChannelResult = { ok: boolean; detail?: string; code?: string; error?: string };

const OK_TEXT: Record<Channel, string> = { whatsapp: "WhatsApp enviado al Comité", call: "Llamando al Comité" };
const LABEL: Record<Channel, string> = { whatsapp: "WhatsApp", call: "Llamada" };

/**
 * «Avisar al Comité»: le manda un WhatsApp o lo llama para que entre a decidir.
 * POST /api/rooms/:id/committee con el token de anfitrión. Solo muestra los
 * canales que el servidor tiene configurados, y sirve cuando ya hay una
 * asignación propuesta.
 */
export function CommitteeNotify({ room, credentials }: { room: ProjectedRoomState; credentials: HostCredentials }) {
  const integrations = useIntegrations();
  const [selected, setSelected] = useState<Record<Channel, boolean>>({ whatsapp: true, call: false });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Partial<Record<Channel, ChannelResult>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!integrations) return null;
  const available: Channel[] = [...(integrations.whatsapp ? (["whatsapp"] as const) : []), ...(integrations.voice && integrations.canCall ? (["call"] as const) : [])];
  if (available.length === 0) return null;

  const ready = room.allocation?.status === "PROPOSED";
  const channels = available.filter((channel) => selected[channel]);

  async function notify() {
    setBusy(true);
    setResults(null);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(room.roomId)}/committee`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-host-token": credentials.hostToken },
        body: JSON.stringify({ channels }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.results) setResults(data.results);
      else setError(typeof data?.error === "string" ? data.error : "No se pudo avisar al Comité.");
    } catch {
      setError("No se pudo llegar al servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="flex items-center gap-2 font-semibold">
        <BellRing className="size-4 text-brand" aria-hidden /> Avisar al Comité
      </p>
      <p className="small text-muted-foreground">
        {ready ? "La asignación ya está propuesta: avísale al Comité para que entre a decidir." : "Se habilita cuando la regla ya propuso una asignación."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Canales">
        {available.map((channel) => (
          <label key={channel} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-card px-4 shadow-[inset_0_0_0_1.5px_var(--input)] has-checked:shadow-[inset_0_0_0_2px_var(--brand)]">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={selected[channel]} onChange={(event) => setSelected((prev) => ({ ...prev, [channel]: event.target.checked }))} />
            {channel === "whatsapp" ? <MessageCircle className="size-4" aria-hidden /> : <Phone className="size-4" aria-hidden />}
            {LABEL[channel]}
          </label>
        ))}
        <button type="button" className="btn btn-primary" disabled={!ready || busy || channels.length === 0} onClick={notify}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />}
          {busy ? "Avisando…" : "Avisar ahora"}
        </button>
      </div>
      {results && (
        <ul className="mt-3 space-y-1.5">
          {(Object.keys(results) as Channel[]).map((channel) => {
            const result = results[channel]!;
            return (
              <li key={channel} className={`small rounded-xl px-3 py-2 ${result.ok ? "bg-calm-soft text-calm" : "bg-bleed-soft text-bleed"}`}>
                <strong className="font-semibold">{LABEL[channel]}:</strong> {result.ok ? OK_TEXT[channel] : (result.error ?? "No se pudo.")}
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="small mt-3 rounded-xl bg-bleed-soft px-3 py-2 text-bleed">
          {error}
        </p>
      )}
    </div>
  );
}
