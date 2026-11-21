"use client";

// «Decide una fórmula, no una opinión»: los tres pesos de la regla del caso, para
// moverlos y ver cómo cambia el orden. La cuenta es la misma de la sala
// (resolveAllocation, src/lib/engine/deterministic.ts). Al navegador solo llegó
// lo que entra en la regla: los costos van en 0 y no la afectan.

import { useMemo, useState } from "react";
import { RotateCcw, Star } from "lucide-react";
import { resolveAllocation } from "@/lib/engine/deterministic";
import type { SharedScarcity } from "@/lib/genome/schema";
import { Ticker } from "./ticker";

const d2 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KEYS = ["severity", "timeCriticality", "delayRisk"] as const;
type Weights = SharedScarcity["rule"]["weights"];

export function RuleLab({ scarcity, labels, orgLabels }: { scarcity: SharedScarcity; labels: [string, string, string]; orgLabels: Record<string, string> }) {
  const initial = scarcity.rule.weights;
  const [weights, setWeights] = useState<Weights>(initial);
  const changed = KEYS.some((key) => weights[key] !== initial[key]);
  const result = useMemo(() => resolveAllocation({ ...scarcity, rule: { ...scarcity.rule, weights } }), [scarcity, weights]);
  const top = Math.max(...result.ranking.map((entry) => entry.score), 0.01);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="panel p-6 md:p-8">
        {KEYS.map((key, i) => (
          <label key={key} className="mt-4 block first:mt-0">
            <span className="flex justify-between font-medium">
              <span>
                {labels[i]} <span className="text-muted-foreground">{key === "delayRisk" ? "−" : "+"}</span>
              </span>
              <span className="tabular">{d2.format(weights[key])}</span>
            </span>
            <input type="range" className="slider" min={0} max={1} step={0.05} value={weights[key]} onChange={(event) => setWeights((prev) => ({ ...prev, [key]: Number(event.target.value) }))} />
          </label>
        ))}
        <button type="button" className="btn btn-line mt-4" disabled={!changed} onClick={() => setWeights(initial)}>
          <RotateCcw className="size-4" aria-hidden /> Restablecer
        </button>
      </div>
      <div className="grid content-center gap-4" aria-live="polite">
        {result.ranking.map((entry) => {
          const winner = entry.caseId === result.winnerCaseId;
          return (
            <div key={entry.caseId} className={`rounded-[1.25rem] p-5 transition-colors duration-500 md:p-6 ${winner ? "bg-card shadow-[inset_0_0_0_2px_var(--calm)]" : "bg-card/60"}`}>
              <div className="flex items-end justify-between gap-4">
                <span className="h-sub flex items-center gap-2">
                  {orgLabels[entry.orgId] ?? entry.orgId}
                  {winner && <Star className="size-5 fill-current text-calm" aria-label="Va primero" />}
                </span>
                <span className={`tabular font-extrabold tracking-tight ${winner ? "text-calm" : ""}`} style={{ fontSize: "clamp(2.4rem, 2rem + 1.6vw, 3.4rem)", lineHeight: 0.9, letterSpacing: "-0.05em" }}>
                  <Ticker value={entry.score} decimals={2} durationMs={700} />
                </span>
              </div>
              <span className="mt-4 block h-2 overflow-hidden rounded-full bg-muted">
                <span className={`block h-full rounded-full transition-[width] duration-500 ${winner ? "bg-calm" : "bg-brand"}`} style={{ width: `${Math.max(0, (entry.score / top) * 100)}%` }} />
              </span>
            </div>
          );
        })}
        <p className="text-base text-muted-foreground">{result.tieBreakApplied ? "Casi empate: gana quien más necesita." : "Gana el puntaje más alto."} El costo no entra.</p>
      </div>
    </div>
  );
}
