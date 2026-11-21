"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { REASON_MAX_LENGTH } from "@/lib/store/actions";
import { cn } from "@/lib/utils";
import type { OrganResult } from "./format";

export type DecisionOption = {
  id: string;
  label: string;
  tone: "approve" | "veto" | "neutral";
  /** Pide además un valor numérico (contrapropuesta). */
  value?: { label: string; min: number; max: number; unit: string; initial: number };
};

type Props = {
  /** Qué se está decidiendo, en una frase. */
  prompt: string;
  options: DecisionOption[];
  onDecide: (optionId: string, reason: string, value?: number) => Promise<OrganResult>;
};

const TONE: Record<DecisionOption["tone"], string> = {
  approve: "bg-calm text-white hover:bg-calm/85",
  veto: "bg-bleed text-white hover:bg-bleed/85",
  neutral: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
};

/**
 * Formulario de una decisión humana. La razón es obligatoria: sin ella los
 * botones no se habilitan, y el servidor también la exige (400 REASON_REQUIRED).
 * Pensado para el teléfono del Comité: campo grande y botones de 44 px.
 */
export function DecisionForm({ prompt, options, onDecide }: Props) {
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasReason = reason.trim().length > 0;

  async function decide(option: DecisionOption) {
    setBusy(option.id);
    setError(null);
    const result = await onDecide(option.id, reason.trim(), option.value ? (values[option.id] ?? option.value.initial) : undefined);
    setBusy(null);
    if (result.ok) setReason("");
    else setError(`${result.status ? `${result.status} ` : ""}${result.code ?? ""}: ${result.error ?? "No se pudo registrar la decisión"}`);
  }

  return (
    <form className="space-y-3 rounded-md border border-role-violet/50 bg-violet-soft p-3" onSubmit={(event) => event.preventDefault()}>
      <p className="text-sm font-semibold">{prompt}</p>
      <label className="block space-y-1">
        <span className="text-sm">Razón de tu decisión (queda en el acta)</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          required
          maxLength={REASON_MAX_LENGTH}
          placeholder="Por qué apruebas o vetas"
          className="w-full rounded-md border border-input bg-card px-3 py-2 font-serif text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
        <span className={cn("block text-right text-xs tabular-nums", reason.length >= REASON_MAX_LENGTH ? "text-bleed" : "text-muted-foreground")}>
          {reason.length} de {REASON_MAX_LENGTH} caracteres
        </span>
      </label>

      {options
        .filter((option) => option.value)
        .map((option) => {
          const range = option.value!;
          const current = values[option.id] ?? range.initial;
          return (
            <label key={option.id} className="block space-y-1 text-sm">
              <span>
                {range.label}: <strong className="tabular-nums">{current}{range.unit}</strong>
              </span>
              <input
                type="range"
                min={range.min}
                max={range.max}
                value={current}
                onChange={(event) => setValues((prev) => ({ ...prev, [option.id]: Number(event.target.value) }))}
                className="block h-8 w-full accent-foreground"
              />
            </label>
          );
        })}

      <div className="flex flex-col gap-2 sm:flex-row">
        {options.map((option) => (
          <Button
            key={option.id}
            type="button"
            disabled={!hasReason || busy !== null}
            onClick={() => decide(option)}
            className={cn("min-h-11 w-full px-4 py-2 text-sm whitespace-normal sm:flex-1", TONE[option.tone])}
          >
            {busy === option.id ? "Registrando…" : option.label}
          </Button>
        ))}
      </div>
      {!hasReason && <p className="text-xs text-muted-foreground">Escribe la razón para habilitar la decisión.</p>}
      {error && (
        <p role="alert" className="text-sm text-bleed">
          {error}
        </p>
      )}
    </form>
  );
}
