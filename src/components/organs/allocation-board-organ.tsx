"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AllocationView, EquityTieBreak, HumanDecision, ProjectedCandidate, ProjectedScarcity } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { DecisionForm } from "./decision-form";
import { formatScore, formatTime, type OrganResult } from "./format";
import { OrganFrame } from "./organ-frame";

type Props = {
  allocation: AllocationView;
  scarcity: ProjectedScarcity;
  /** Nombre legible de una organización. */
  orgName: (orgId: string) => string;
  /** Candidato que quien mira puede presentar (es su proponente y aún no lo presentó). */
  submittable?: ProjectedCandidate | null;
  onSubmitCandidate?: (caseId: string) => Promise<OrganResult>;
  /** true si quien mira es el Comité árbitro. */
  isArbiter?: boolean;
  onSeal?: (reason: string) => Promise<OrganResult>;
  onVeto?: (reason: string) => Promise<OrganResult>;
  /** Decisiones del Comité sobre la asignación, en orden. Si faltan, se muestra solo la última. */
  decisions?: HumanDecision[];
  /** Enlaces de descarga del acta. */
  acta?: { md: string; json: string };
  /** "stage": cifras grandes para proyectar. */
  size?: "stage" | "default";
};

const TIE_BREAK: Record<EquityTieBreak, string> = {
  worst_unmet_need: "gana quien tiene la mayor necesidad sin cubrir",
  coverage_gap: "gana quien tiene la mayor brecha de cobertura",
  geographic: "gana quien está más lejos de una alternativa",
};

/**
 * Órgano 7. Tablero de asignación del recurso escaso. El orden, el desempate y
 * el ganador los calcula el servidor con una fórmula fija (sin modelo); el
 * Comité aprueba o veta con una razón que queda en el acta.
 */
export function AllocationBoardOrgan({ allocation, scarcity, orgName, submittable, onSubmitCandidate, isArbiter = false, onSeal, onVeto, decisions, acta, size = "default" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stage = size === "stage";
  const { rule } = scarcity;
  const { weights } = rule;
  const waiting = scarcity.candidates.filter((candidate) => allocation.pendingCaseIds.includes(candidate.caseId));
  const vetoed = scarcity.candidates.filter((candidate) => allocation.vetoedCaseIds.includes(candidate.caseId));
  const winner = allocation.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
  const sealed = allocation.status === "SEALED";
  const committeeDecisions = decisions?.filter((entry) => entry.scope === "allocation") ?? (allocation.committeeDecision ? [allocation.committeeDecision] : []);
  const patientOf = (caseId: string | undefined) => scarcity.candidates.find((candidate) => candidate.caseId === caseId)?.patientLabel;
  // Escala común de las barras: el mayor aporte positivo posible es la suma de los pesos positivos.
  const scale = weights.severity + weights.timeCriticality || 1;

  async function submit(caseId: string) {
    if (!onSubmitCandidate) return;
    setBusy(true);
    setError(null);
    const result = await onSubmitCandidate(caseId);
    setBusy(false);
    if (!result.ok) setError(`${result.status} ${result.code ?? ""}: ${result.error ?? "No se pudo presentar"}`);
  }

  return (
    <OrganFrame
      title={`Asignación: ${rule.resourceLabel}`}
      aside={sealed ? "sellada por el Comité" : allocation.status === "PROPOSED" ? "propuesta por el algoritmo, falta el Comité" : "esperando candidatos"}
    >
      <div className="space-y-4">
        <p className={cn("text-muted-foreground", stage ? "text-base" : "text-sm")}>
          {scarcity.resource}: hay {rule.resourceQuantity} y la piden {scarcity.candidates.length} organizaciones. {scarcity.deadlineLabel}.
        </p>

        {allocation.ranking.length > 0 && (
          <ol className="space-y-2">
            {allocation.ranking.map((entry) => {
              const isWinner = entry.caseId === allocation.winnerCaseId;
              return (
                <li
                  key={entry.caseId}
                  className={cn(
                    "grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 rounded-md border px-3 py-2.5",
                    isWinner ? (sealed ? "border-calm bg-calm-soft" : "border-foreground bg-card") : "border-border bg-muted/40",
                  )}
                >
                  <span className={cn("leading-none font-bold tabular-nums font-stretch-condensed", stage ? "text-5xl" : "text-3xl", !isWinner && "text-muted-foreground")}>
                    {entry.rank}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("font-semibold", stage ? "text-xl" : "text-base")}>
                      {entry.patientLabel}
                      {isWinner && <span className={cn("ml-2 text-sm font-semibold", sealed ? "text-calm" : "text-foreground")}>{sealed ? "recibe el recurso" : "ganador propuesto"}</span>}
                    </p>
                    <p className={cn("truncate text-muted-foreground", stage ? "text-base" : "text-sm")}>{orgName(entry.orgId)}</p>
                  </div>
                  <p className={cn("text-right leading-none font-bold tabular-nums font-stretch-condensed", stage ? "text-4xl" : "text-2xl")}>
                    {formatScore(entry.score)}
                    <span className="block pt-1 text-xs font-normal text-muted-foreground font-stretch-normal">puntaje</span>
                  </p>

                  {/* Aporte de cada término al puntaje, ya multiplicado por su peso. */}
                  <dl className="col-span-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <Term label="Gravedad" value={entry.terms.severity} scale={scale} sign="+" />
                    <Term label="Urgencia de tiempo" value={entry.terms.timeCriticality} scale={scale} sign="+" />
                    <Term label="Riesgo por demora" value={entry.terms.delayRisk} scale={scale} sign="−" />
                    <Term label="Necesidad sin cubrir" value={entry.unmetNeedScore} scale={1} sign="" emphasis={allocation.tieBreakApplied} />
                  </dl>
                </li>
              );
            })}
          </ol>
        )}

        {(waiting.length > 0 || vetoed.length > 0) && (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {waiting.map((candidate) => (
              <li key={candidate.caseId}>
                {candidate.patientLabel} de {orgName(candidate.orgId)}: su organización aún no lo presenta.
              </li>
            ))}
            {vetoed.map((candidate) => (
              <li key={candidate.caseId} className="text-bleed">
                {candidate.patientLabel} de {orgName(candidate.orgId)}: vetado por el Comité, queda fuera del orden.
              </li>
            ))}
          </ul>
        )}

        {submittable && onSubmitCandidate && !sealed && (
          <Button className="min-h-11 w-full px-4" disabled={busy} onClick={() => submit(submittable.caseId)}>
            Presentar a {submittable.patientLabel} como candidato
          </Button>
        )}

        {allocation.ranking.length > 1 && (
          <div className={cn("rounded-md border px-3 py-2", allocation.tieBreakApplied ? "border-clash/50 bg-clash-soft" : "border-border bg-muted/40", stage ? "text-base" : "text-sm")}>
            <p className={cn("font-semibold", allocation.tieBreakApplied && "text-clash")}>
              {allocation.tieBreakApplied ? `Empate técnico: decide la equidad, ${TIE_BREAK[allocation.tieBreakRule]}.` : "Sin empate: decide el puntaje."}
            </p>
            <p className="mt-0.5">{allocation.explanation}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Puntaje = {formatScore(weights.severity)} × gravedad + {formatScore(weights.timeCriticality)} × urgencia − {formatScore(weights.delayRisk)} × riesgo por demora. Es código
          fijo: ningún modelo interviene y el costo de cada organización no entra en la cuenta.
        </p>

        {committeeDecisions.map((decision) => (
          <figure key={decision.ts} className="border-l-2 border-role-violet pl-3">
            <figcaption className="text-xs text-muted-foreground">
              {scarcity.arbiter.title} {decision.decision === "VETO" ? "vetó" : "aprobó"}
              {patientOf(decision.targetCaseId) ? ` a ${patientOf(decision.targetCaseId)}` : ""} a las {formatTime(decision.ts)}
            </figcaption>
            <blockquote className={cn("mt-1 font-serif leading-relaxed italic", stage ? "text-2xl" : "text-base")}>«{decision.reason}»</blockquote>
          </figure>
        ))}

        {isArbiter && !sealed && winner && onSeal && onVeto && (
          <DecisionForm
            prompt={`Como Comité decides si ${winner.patientLabel} (${orgName(winner.orgId)}) recibe el recurso.`}
            options={[
              { id: "seal", label: "Aprobar y sellar", tone: "approve" },
              { id: "veto", label: `Vetar a ${winner.patientLabel}`, tone: "veto" },
            ]}
            onDecide={(id, reason) => (id === "seal" ? onSeal(reason) : onVeto(reason))}
          />
        )}
        {isArbiter && !sealed && !winner && <p className="text-sm text-muted-foreground">Podrás decidir cuando las organizaciones presenten a sus candidatos.</p>}

        {error && (
          <p role="alert" className="text-sm text-bleed">
            {error}
          </p>
        )}

        {acta && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Acta de la decisión, con la bitácora completa:</span>
            <a className="font-semibold underline underline-offset-4" href={acta.md} download>
              Descargar en Markdown
            </a>
            <a className="font-semibold underline underline-offset-4" href={acta.json} download>
              Descargar en JSON
            </a>
          </p>
        )}
      </div>
    </OrganFrame>
  );
}

function Term({ label, value, scale, sign, emphasis }: { label: string; value: number; scale: number; sign: string; emphasis?: boolean }) {
  const magnitude = Math.abs(value);
  return (
    <div className={cn(emphasis && "font-semibold text-clash")}>
      <dt className={cn(!emphasis && "text-muted-foreground")}>{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="h-1.5 flex-1 rounded-sm bg-muted">
          <span
            className={cn("block h-full rounded-sm", sign === "−" ? "bg-bleed" : emphasis ? "bg-clash" : "bg-foreground")}
            style={{ width: `${Math.min(100, (magnitude / scale) * 100)}%` }}
          />
        </span>
        <span className="tabular-nums">
          {sign}
          {formatScore(magnitude)}
        </span>
      </dd>
    </div>
  );
}
