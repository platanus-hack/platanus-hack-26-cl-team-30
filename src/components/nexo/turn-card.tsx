"use client";

import { useState } from "react";
import { CircleCheck, FileDown, Hourglass, LoaderCircle, Lock, Send } from "lucide-react";
import { DecisionForm } from "@/components/organs/decision-form";
import { formatValue } from "@/components/organs/format";
import type { Act } from "@/lib/client/use-room";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import type { Turn } from "./guide";

type Props = {
  room: ProjectedRoomState;
  turn: Turn;
  act: Act;
  acta: { md: string; json: string };
};

/**
 * «Tu turno»: lo único que esta persona tiene que hacer ahora, con un botón
 * grande, o lo que está esperando. Idea tomada de la estación de Ramón.
 */
export function TurnCard({ room, turn, act, acta }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (turn.kind !== "action") return;
    setBusy(true);
    setError(null);
    const result =
      turn.action.type === "SEAL_RULE" ? await act("SEAL_RULE", { threshold: turn.action.threshold }) : await act("SUBMIT_CANDIDATE", { caseId: turn.action.caseId });
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  const tone =
    turn.kind === "done" ? "ring-2 ring-calm" : turn.kind === "wait" ? "" : turn.kind === "action" ? "ring-2 ring-brand" : "ring-2 ring-clash";
  const label = turn.kind === "done" ? "Terminado" : turn.kind === "wait" ? "Esperando" : "Tu turno";
  const labelTone = turn.kind === "done" ? "text-calm" : turn.kind === "wait" ? "text-muted-foreground" : turn.kind === "action" ? "text-brand" : "text-clash";

  return (
    <section className={cn("panel p-5 sm:p-7", tone)} aria-live="polite" aria-labelledby="turn-title">
      <p className={cn("flex items-center gap-1.5 text-sm font-semibold", labelTone)}>
        {turn.kind === "done" ? <CircleCheck className="size-4" aria-hidden /> : turn.kind === "wait" ? <Hourglass className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {label}
      </p>
      <h1 id="turn-title" className="mt-2 text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] leading-tight font-semibold tracking-tight">
        {turn.title}
      </h1>
      <p className="lede mt-2 text-muted-foreground">{turn.body}</p>

      {turn.kind === "wait" && (
        <p className="mt-5 flex items-center gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="breathe size-2.5 rounded-full bg-brand" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </p>
      )}

      {turn.kind === "action" && (
        <>
          <button type="button" className="btn btn-primary btn-lg mt-6 w-full sm:w-auto sm:px-10" disabled={busy} onClick={run}>
            {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : turn.action.type === "SEAL_RULE" ? <Lock className="size-5" aria-hidden /> : <Send className="size-5" aria-hidden />}
            {busy ? "Un momento…" : turn.actionLabel}
          </button>
          {error && (
            <p role="alert" className="small mt-3 rounded-xl bg-bleed-soft px-3 py-2 text-bleed">
              {error}
            </p>
          )}
        </>
      )}

      {turn.kind === "sign-gate" && (
        <div className="mt-5">
          <DecisionForm
            prompt={`Propuesta: ${formatValue(turn.org.gate.proposedValue, turn.org.authorityRule.unit)}. Límite: ${formatValue(turn.org.gate.effectiveThreshold, turn.org.authorityRule.unit)}.`}
            options={[
              { id: "APPROVE", label: "Aprobar", tone: "approve" },
              { id: "VETO", label: "Vetar", tone: "veto" },
              {
                id: "COUNTER_PROPOSE",
                label: "Proponer otro valor",
                tone: "neutral",
                value: {
                  label: "Si propones otro valor, el que aceptarías",
                  min: turn.org.authorityRule.min,
                  max: turn.org.gate.effectiveThreshold,
                  unit: turn.org.authorityRule.unit,
                  initial: turn.org.gate.effectiveThreshold,
                },
              },
            ]}
            onDecide={(id, reason, value) => act("HITL_DECISION", { decision: id as "APPROVE" | "VETO" | "COUNTER_PROPOSE", reason, counterValue: value })}
          />
        </div>
      )}

      {turn.kind === "sign-allocation" && room.allocation && room.scarcity && <AllocationDecision room={room} act={act} />}

      {turn.kind === "done" && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href={acta.md} download className="btn btn-primary">
            <FileDown className="size-5" aria-hidden />
            Descargar el acta
          </a>
          <a href={acta.json} download className="btn btn-line">
            <FileDown className="size-5" aria-hidden />
            Acta en JSON
          </a>
        </div>
      )}
    </section>
  );
}

/** Decisión del Comité sobre la asignación: el caso propuesto, por qué quedó primero y la firma con razón. */
function AllocationDecision({ room, act }: { room: ProjectedRoomState; act: Act }) {
  const allocation = room.allocation!;
  const winner = allocation.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
  const orgName = (orgId: string) => room.orgs.find((org) => org.orgId === orgId)?.orgName ?? orgId;
  if (!winner) return null;
  return (
    <div className="mt-5 space-y-4">
      <ol className="space-y-2">
        {allocation.ranking.map((entry) => {
          const first = entry.caseId === winner.caseId;
          return (
            <li key={entry.caseId} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3", first ? "bg-calm-soft ring-1 ring-calm/40" : "bg-muted")}>
              <span className={cn("text-2xl font-semibold tabular-nums", first ? "text-calm" : "text-muted-foreground")}>{entry.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{entry.patientLabel}</span>
                <span className="small block truncate text-muted-foreground">{orgName(entry.orgId)}</span>
              </span>
              <span className="text-right">
                <span className="block text-lg font-semibold tabular-nums">{entry.score.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xs text-muted-foreground">puntaje</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="small rounded-xl bg-clash-soft px-3 py-2 text-clash">
        {allocation.tieBreakApplied ? "Quedaron casi empatados: la regla dio prioridad a quien tiene más necesidad sin cubrir." : "La regla los ordenó por puntaje."} El costo de
        cada organización no entra en la cuenta.
      </p>
      <DecisionForm
        prompt={`¿${winner.patientLabel} (${orgName(winner.orgId)}) recibe el recurso?`}
        options={[
          { id: "seal", label: "Aprobar y sellar", tone: "approve" },
          { id: "veto", label: `Vetar a ${winner.patientLabel}`, tone: "veto" },
        ]}
        onDecide={(id, reason) => (id === "seal" ? act("ALLOCATION_SEAL", { reason }) : act("COMMITTEE_VETO", { reason }))}
      />
    </div>
  );
}
