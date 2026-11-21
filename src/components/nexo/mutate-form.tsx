"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Texto del botón: dice exactamente lo que pasa. */
  action: string;
  /** Recibe la frase. Devuelve un mensaje para mostrar y si salió bien. */
  onSubmit: (description: string) => Promise<{ ok: boolean; message: string }>;
};

/**
 * Una frase que describe una organización. El servidor le pide a un modelo un
 * genoma (roles, campos, regla y caso), lo valida y, si no sirve, carga una
 * organización de respaldo. El modelo nunca genera interfaz.
 */
export function MutateForm({ action, onSubmit }: Props) {
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const ready = description.trim().length >= 8;

  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        setResult(null);
        setResult(await onSubmit(description.trim()));
        setBusy(false);
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Describe una organización en una frase</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={300}
          placeholder="Una distribuidora que debe aprobar descuentos sin regalar margen"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
      </label>
      <Button type="submit" variant="outline" className="min-h-11 px-4" disabled={!ready || busy}>
        {busy ? "Generando: puede tardar unos segundos…" : action}
      </Button>
      {result && (
        <p role="status" className={result.ok ? "text-sm text-muted-foreground" : "text-sm text-bleed"}>
          {result.message}
        </p>
      )}
    </form>
  );
}

/** Mensaje honesto sobre de dónde salió la organización generada. */
export function describeMutation(result: { ok: boolean; source?: string; latencyMs?: number; error?: string }): { ok: boolean; message: string } {
  if (!result.ok) return { ok: false, message: result.error ?? "No se pudo generar la organización." };
  const seconds = typeof result.latencyMs === "number" ? ` en ${(result.latencyMs / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} s` : "";
  const fallback = !result.source || /fallback|seed|semilla/i.test(result.source);
  return {
    ok: true,
    message: fallback
      ? `El modelo no entregó una organización válida${seconds}: se cargó una de respaldo.`
      : `Organización generada por el modelo${seconds} y validada antes de usarse.`,
  };
}
