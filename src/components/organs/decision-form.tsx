"use client";

import { useState } from "react";
import { CircleCheck, CircleX, LoaderCircle, Repeat } from "lucide-react";
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

const TONE: Record<DecisionOption["tone"], { className: string; Icon: typeof CircleCheck }> = {
  approve: { className: "btn-approve", Icon: CircleCheck },
  veto: { className: "btn-veto", Icon: CircleX },
  neutral: { className: "btn-line", Icon: Repeat },
};

/**
 * Formulario de una decisión humana. La razón es obligatoria: sin ella los
 * botones no se habilitan, y el servidor también la exige (400 REASON_REQUIRED).
 * Pensado para el teléfono del Comité: campo grande y botones grandes con icono.
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
    else setError(result.error ?? "No se pudo registrar la decisión. Intenta de nuevo.");
  }

  return (
    <form className="space-y-4 rounded-2xl bg-muted/70 p-4 sm:p-5" onSubmit={(event) => event.preventDefault()}>
      <p className="font-semibold">{prompt}</p>
      <label className="block">
        <span className="font-medium">¿Por qué? Queda escrito en el acta</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          required
          maxLength={REASON_MAX_LENGTH}
          placeholder="Escribe la razón de tu decisión"
          className="field mt-1.5 resize-y font-serif text-lg leading-relaxed"
        />
        <span className={cn("mt-1 block text-right text-xs tabular-nums", reason.length >= REASON_MAX_LENGTH ? "text-bleed" : "text-muted-foreground")}>
          {reason.length} de {REASON_MAX_LENGTH} caracteres
        </span>
      </label>

      {options
        .filter((option) => option.value)
        .map((option) => {
          const range = option.value!;
          const current = values[option.id] ?? range.initial;
          return (
            <label key={option.id} className="block">
              <span className="small">
                {range.label}:{" "}
                <strong className="tabular-nums">
                  {current}
                  {range.unit}
                </strong>
              </span>
              <input
                type="range"
                min={range.min}
                max={range.max}
                value={current}
                onChange={(event) => setValues((prev) => ({ ...prev, [option.id]: Number(event.target.value) }))}
                className="slider"
              />
            </label>
          );
        })}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        {options.map((option) => {
          const { className, Icon } = TONE[option.tone];
          return (
            <button key={option.id} type="button" disabled={!hasReason || busy !== null} onClick={() => decide(option)} className={cn("btn btn-lg w-full sm:w-auto sm:flex-1", className)}>
              {busy === option.id ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden />}
              {busy === option.id ? "Registrando…" : option.label}
            </button>
          );
        })}
      </div>
      {!hasReason && <p className="small text-muted-foreground">Escribe la razón para poder decidir.</p>}
      {error && (
        <p role="alert" className="small rounded-xl bg-bleed-soft px-3 py-2 text-bleed">
          {error}
        </p>
      )}
    </form>
  );
}
