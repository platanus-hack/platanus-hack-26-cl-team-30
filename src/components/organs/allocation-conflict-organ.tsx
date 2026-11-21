"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GateMode, ProjectedOrg } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { ACCENT, formatPct, formatValue, type OrganResult } from "./format";
import { OrganFrame } from "./organ-frame";

type Props = {
  org: ProjectedOrg;
  /** Rol de quien mira dentro de esta organización; null si solo observa. */
  viewerRoleId: string | null;
  /** Mueve el límite del rol propio (el servidor decide cuál según el rol). */
  onSlider?: (value: number) => Promise<OrganResult>;
  /** Sella la regla: umbral acordado y modo de compuerta. */
  onSeal?: (payload: { threshold?: number; gateMode?: GateMode }) => Promise<OrganResult>;
};

/**
 * Órgano 4. Choque de autoridad: hasta dónde cree el proponente que decide solo
 * y hasta dónde lo deja el aprobador. El choque, el umbral vigente y la
 * confiabilidad los calcula el servidor; aquí se mueven los límites y se sella.
 */
export function AllocationConflictOrgan({ org, viewerRoleId, onSlider, onSeal }: Props) {
  const { authorityRule: rule, conflict, reliability } = org;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const proposer = org.roles.find((role) => role.id === rule.proposerRoleId);
  const approver = org.roles.find((role) => role.id === rule.approverRoleId);
  const canSeal = !!onSeal && (viewerRoleId === rule.proposerRoleId || viewerRoleId === rule.approverRoleId);
  const sealed = rule.sealedThreshold !== null;
  const agreed = Math.min(rule.proposerLimit, rule.approverLimit);

  async function run(action: () => Promise<OrganResult>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(`${result.status} ${result.code ?? ""}: ${result.error ?? "No se pudo aplicar"}`);
  }

  const commit = (value: number) => {
    if (!onSlider) return;
    void onSlider(value).then((result) => setError(result.ok ? null : `${result.status} ${result.code ?? ""}: ${result.error ?? ""}`));
  };

  return (
    <OrganFrame title="Quién puede decidir hasta dónde" aside={rule.metricLabel}>
      <div className="space-y-4">
        <LimitRow
          label={proposer?.title ?? rule.proposerRoleId}
          hint="cree que puede decidir sin firma hasta"
          value={rule.proposerLimit}
          rule={rule}
          accent={proposer ? ACCENT[proposer.accentColor].stroke : "var(--foreground)"}
          editable={!!onSlider && viewerRoleId === rule.proposerRoleId}
          onCommit={commit}
        />
        <LimitRow
          label={approver?.title ?? rule.approverRoleId}
          hint="lo deja decidir sin firma hasta"
          value={rule.approverLimit}
          rule={rule}
          accent={approver ? ACCENT[approver.accentColor].stroke : "var(--foreground)"}
          editable={!!onSlider && viewerRoleId === rule.approverRoleId}
          onCommit={commit}
        />

        {conflict.hasConflict ? (
          <div className="rounded-md border border-clash/50 bg-clash-soft px-3 py-2 text-sm">
            <p className="font-semibold text-clash">Choque de {formatValue(Math.abs(conflict.delta), rule.unit)}</p>
            <p className="mt-0.5">{conflict.message}</p>
          </div>
        ) : (
          <p className={cn("rounded-md border px-3 py-2 text-sm", sealed ? "border-calm/50 bg-calm-soft" : "border-border bg-muted/50")}>
            {sealed ? <strong className="font-semibold text-calm">{conflict.message}</strong> : conflict.message}
          </p>
        )}

        {canSeal && !sealed && (
          <Button className="min-h-11 w-full px-4" disabled={busy} onClick={() => run(() => onSeal!({ threshold: agreed }))}>
            Sellar la regla en {formatValue(agreed, rule.unit)}
          </Button>
        )}

        {/* Modo de compuerta: con firma humana o agentes solos. Cambia la confiabilidad al instante. */}
        <div className="border-t border-border pt-3">
          <p className="text-sm">Cuando una propuesta cruza el umbral</p>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="group" aria-label="Modo de compuerta">
            {(
              [
                ["deterministic_hitl", "Frena y pide una firma"],
                ["agent_autonomous", "El agente sigue solo"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={rule.gateMode === mode}
                disabled={!canSeal || busy || rule.gateMode === mode}
                onClick={() => run(() => onSeal!({ gateMode: mode, threshold: rule.sealedThreshold ?? agreed }))}
                className={cn(
                  "min-h-10 rounded-sm px-2 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  rule.gateMode === mode ? "bg-card font-semibold shadow-xs" : "text-muted-foreground enabled:hover:text-foreground",
                  !canSeal && rule.gateMode !== mode && "opacity-60",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Probabilidad de que la cadena de {reliability.n} pasos termine bien:{" "}
            <strong className={cn("font-bold tabular-nums", reliability.currentMode === "hybrid" ? "text-calm" : "text-bleed")}>{formatPct(reliability.current)}</strong>
          </p>
          {!canSeal && viewerRoleId && <p className="mt-1 text-xs text-muted-foreground">Solo {proposer?.title} y {approver?.title} pueden sellar o cambiar el modo.</p>}
        </div>

        {error && (
          <p role="alert" className="text-sm text-bleed">
            {error}
          </p>
        )}
      </div>
    </OrganFrame>
  );
}

type LimitRowProps = {
  label: string;
  hint: string;
  value: number;
  rule: ProjectedOrg["authorityRule"];
  accent: string;
  editable: boolean;
  onCommit: (value: number) => void;
};

// Deslizador de un límite. Mientras se arrastra muestra el valor local y envía
// al servidor como máximo cada 120 ms, para que las otras pantallas lo vean moverse.
function LimitRow({ label, hint, value, rule, accent, editable, onCommit }: LimitRowProps) {
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(sendTimer.current);
      clearTimeout(releaseTimer.current);
    },
    [],
  );

  function change(next: number) {
    setDraft(next);
    pending.current = next;
    clearTimeout(releaseTimer.current);
    // Al soltar se vuelve al valor del servidor, que ya debería ser el mismo.
    releaseTimer.current = setTimeout(() => setDraft(null), 900);
    if (sendTimer.current) return;
    sendTimer.current = setTimeout(() => {
      sendTimer.current = undefined;
      if (pending.current !== null) onCommit(pending.current);
      pending.current = null;
    }, 120);
  }

  const shown = draft ?? value;
  return (
    <label className="block">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span>
          <span className="mr-1.5 inline-block size-2.5 rounded-full align-baseline" style={{ background: accent }} aria-hidden />
          <span className="font-semibold">{label}</span> <span className="text-muted-foreground">{hint}</span>
        </span>
        <span className="text-lg leading-none font-bold tabular-nums font-stretch-condensed">{formatValue(shown, rule.unit)}</span>
      </span>
      <input
        type="range"
        min={rule.min}
        max={rule.max}
        step={1}
        value={shown}
        disabled={!editable}
        onChange={(event) => change(Number(event.target.value))}
        style={{ accentColor: accent }}
        className={cn("mt-1 block h-8 w-full", !editable && "opacity-70")}
      />
      {editable && <span className="text-xs text-muted-foreground">Este es tu límite: muévelo.</span>}
    </label>
  );
}
