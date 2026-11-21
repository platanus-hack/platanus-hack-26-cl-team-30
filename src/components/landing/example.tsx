"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BedDouble, CircleCheck, MonitorPlay, RotateCcw, Scale } from "lucide-react";
import { resolveAllocation } from "@/lib/engine/deterministic";
import type { SharedScarcity } from "@/lib/genome/schema";
import type { LandingExample } from "./data";
import { Heading } from "./motion";
import { Why } from "./why";

const d2 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WEIGHTS = [
  { key: "severity", label: "Gravedad", sign: "suma" },
  { key: "timeCriticality", label: "Urgencia", sign: "suma" },
  { key: "delayRisk", label: "Riesgo de espera", sign: "resta" },
] as const;

type Weights = SharedScarcity["rule"]["weights"];

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
      <span className="small text-muted-foreground">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="small tabular text-right font-medium">{d2.format(value)}</span>
    </div>
  );
}

/**
 * El ejemplo principal: dos hospitales y una cama. El orden lo calcula el mismo
 * motor que usa la sala (resolveAllocation). Al navegador solo llegaron los
 * puntajes clínicos; el costo de cada hospital no viajó, así que va en 0 y no
 * cambia nada: la regla no lo usa.
 */
export function Example({ example }: { example: LandingExample }) {
  const [weights, setWeights] = useState<Weights>(example.rule.weights);
  const changed = WEIGHTS.some(({ key }) => weights[key] !== example.rule.weights[key]);

  const result = useMemo(() => {
    const scarcity: SharedScarcity = {
      resource: example.resource,
      rule: { ...example.rule, weights },
      candidates: example.candidates.map((candidate) => ({ ...candidate, coverageCost: 0, coverageCostVisibleToOrgs: [candidate.orgId] })),
      arbiter: example.arbiter,
      deadlineLabel: example.deadlineLabel,
      stakesLabel: example.stakesLabel,
    };
    return resolveAllocation(scarcity);
  }, [example, weights]);

  return (
    <section id="ejemplo" className="band bg-brand-soft/60" aria-labelledby="ejemplo-titulo">
      <div className="wrap">
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand-ink shadow-soft">
          <BedDouble className="size-4" aria-hidden /> Un ejemplo
        </p>
        <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-20">
          <Heading id="ejemplo-titulo" className="max-w-[16ch]">
            Dos hospitales, <span className="serif text-brand">una cama UCI.</span>
          </Heading>
          <p className="lede max-w-[34rem] text-muted-foreground">Decide una fórmula, no quien más puede pagar.</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="panel p-6 md:p-8">
            <p className="h-sub flex items-center gap-2">
              <Scale className="size-5 text-brand" aria-hidden /> La regla acordada
            </p>
            <p className="small mt-2 text-muted-foreground">Mueve los pesos: cambia el orden.</p>
            <div className="mt-6 space-y-3">
              {WEIGHTS.map(({ key, label, sign }) => (
                <label key={key} className="block">
                  <span className="flex justify-between font-medium">
                    <span>
                      {label} <span className="font-normal text-muted-foreground">({sign})</span>
                    </span>
                    <span className="tabular">{d2.format(weights[key])}</span>
                  </span>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights[key]}
                    onChange={(event) => setWeights((prev) => ({ ...prev, [key]: Number(event.target.value) }))}
                  />
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-line mt-4" disabled={!changed} onClick={() => setWeights(example.rule.weights)}>
              <RotateCcw className="size-4" aria-hidden />
              Restablecer
            </button>
          </div>

          <div className="space-y-4">
            {example.candidates.map((candidate) => {
              const ranked = result.ranking.find((entry) => entry.caseId === candidate.caseId);
              const winner = result.winnerCaseId === candidate.caseId;
              return (
                <div
                  key={candidate.caseId}
                  className={`rounded-[1.25rem] p-6 transition-[background-color,box-shadow] duration-500 md:p-7 ${
                    winner ? "bg-white shadow-[inset_0_0_0_2px_var(--calm),var(--shadow-lift)]" : "bg-white/60"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="h-sub">{candidate.patientLabel}</p>
                      <p className="small text-muted-foreground">{example.orgNames[candidate.orgId] ?? candidate.orgId}</p>
                      {winner && (
                        <p className="small mt-3 inline-flex items-center gap-1.5 rounded-full bg-calm-soft px-3 py-1 font-semibold text-calm">
                          <CircleCheck className="size-4" aria-hidden /> {result.tieBreakApplied ? "Va primero por equidad" : "Va primero por puntaje"}
                        </p>
                      )}
                    </div>
                    <p className="text-right">
                      <span className="serif tabular block" style={{ fontSize: "clamp(2.5rem, 2rem + 2vw, 3.5rem)", lineHeight: 0.9 }}>
                        {d2.format(ranked?.score ?? 0)}
                      </span>
                      <span className="small text-muted-foreground">puntaje</span>
                    </p>
                  </div>
                  <div className="mt-5 space-y-2">
                    <Meter label="Gravedad" value={candidate.clinicalSeverityScore} />
                    <Meter label="Urgencia" value={candidate.timeCriticality} />
                    <Meter label="Riesgo de espera" value={candidate.delayRiskScore} />
                    <Meter label="Sin cubrir" value={candidate.unmetNeedScore} />
                  </div>
                </div>
              );
            })}
            <Why>
              <p aria-live="polite">
                {result.tieBreakApplied
                  ? `Diferencia de ${d2.format(result.scoreGap)}: menos que el margen de ${d2.format(example.rule.tieEpsilon)}. Es un empate, así que decide la equidad: va primero quien tiene más necesidad sin cubrir.`
                  : `Diferencia de ${d2.format(result.scoreGap)}: supera el margen de ${d2.format(example.rule.tieEpsilon)}, así que decide el puntaje.`}{" "}
                El costo de cada hospital no entra en la cuenta: no llegó a este navegador.
              </p>
            </Why>
            <Link href="/stage/demo-cross" className="btn btn-primary btn-lg w-full sm:w-auto">
              <MonitorPlay className="size-5" aria-hidden />
              Verlo en vivo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
