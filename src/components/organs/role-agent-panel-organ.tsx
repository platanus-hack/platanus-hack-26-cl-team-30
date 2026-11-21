"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ProjectedOrg, ProjectedRole, Telemetry } from "@/lib/genome/schema";
import type { ActionOk } from "@/lib/store/actions";
import { cn } from "@/lib/utils";
import { ACCENT, formatBytes, formatValue, type OrganResult } from "./format";
import { OrganFrame } from "./organ-frame";

type Props = {
  role: ProjectedRole;
  org: ProjectedOrg;
  telemetry: Telemetry;
  /** Pide una propuesta al agente del rol. Sin esto el panel es de solo lectura. */
  onRun?: () => Promise<OrganResult>;
};

/**
 * Órgano 5. El agente emparejado con el rol. Hereda los permisos del rol: el
 * servidor le entrega la misma vista filtrada que a la persona. El agente solo
 * propone; nunca cambia el estado por su cuenta.
 */
export function RoleAgentPanelOrgan({ role, org, telemetry, onRun }: Props) {
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<NonNullable<ActionOk["agent"]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = org.fields.filter((field) => !field.redacted).length;
  const hiddenLabels = org.fields.filter((field) => field.redacted).map((field) => field.label);

  async function run() {
    if (!onRun) return;
    setBusy(true);
    setError(null);
    const result = await onRun();
    setBusy(false);
    if (result.ok && result.data?.agent) setProposal(result.data.agent);
    else if (!result.ok) setError(`${result.status} ${result.code ?? ""}: ${result.error ?? "El agente no respondió"}`);
  }

  return (
    <OrganFrame title={role.agentName} aside={`agente de ${role.title}`}>
      <div className="space-y-4">
        <div className={cn("border-l-2 pl-3", ACCENT[role.accentColor].border)}>
          <p className="text-sm leading-relaxed">{role.agentPersona}</p>
          <p className="mt-1 text-sm text-muted-foreground">Objetivo del rol: {role.objective}</p>
        </div>

        <p className="text-sm">
          Recibe lo mismo que tú: <strong className="font-semibold tabular-nums">{visible} de {org.fields.length}</strong> campos.
          {hiddenLabels.length > 0 && <span className="text-muted-foreground"> No se le envía: {hiddenLabels.join(", ")}.</span>}
        </p>

        {onRun && (
          <Button className="min-h-11 w-full px-4" disabled={busy} onClick={run}>
            {busy ? "El agente está redactando…" : "Pedir una propuesta al agente"}
          </Button>
        )}

        {proposal && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.proposalText}</p>
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {proposal.suggestedValue !== null && (
                <div>
                  <dt className="inline">Valor sugerido: </dt>
                  <dd className="inline font-semibold text-foreground tabular-nums">{formatValue(proposal.suggestedValue, org.authorityRule.unit)}</dd>
                </div>
              )}
              <div>
                <dt className="inline">Origen: </dt>
                <dd className="inline">{proposal.source === "model" ? "respondió el modelo" : "propuesta de respaldo, sin modelo"}</dd>
              </div>
              <div>
                <dt className="inline">Demora: </dt>
                <dd className="inline tabular-nums">{proposal.latencyMs} ms</dd>
              </div>
            </dl>
            {proposal.attemptedFieldRead && (
              <p className="text-sm text-bleed">
                El agente intentó leer «{proposal.attemptedFieldRead}» y el servidor lo negó con un 403. Quedó en la bitácora.
              </p>
            )}
            <p className="text-xs text-muted-foreground">Es una propuesta: nada cambia hasta que una persona decide.</p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-bleed">
            {error}
          </p>
        )}

        <TelemetryReadout telemetry={telemetry} />
      </div>
    </OrganFrame>
  );
}

/**
 * Telemetría del modelo tal como la informa el servidor. Dice dónde corre de
 * verdad: local (ningún dato sale de la red) o nube (cuántos bytes salieron).
 */
export function TelemetryReadout({ telemetry, className }: { telemetry: Telemetry; className?: string }) {
  const local = telemetry.provider === "local";
  return (
    <div className={cn("border-t border-border pt-3 text-sm", className)}>
      <p>
        <span className={cn("mr-1.5 inline-block size-2 rounded-full", local ? "bg-calm" : "bg-clash")} aria-hidden />
        {local ? (
          <>
            <strong className="font-semibold">Modelo local.</strong> Ningún dato sale de la red.
          </>
        ) : (
          <>
            <strong className="font-semibold">Modelo en la nube.</strong> Se han enviado {formatBytes(telemetry.bytesSentToCloud)} fuera de la red.
          </>
        )}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <Datum label="Modelo" value={telemetry.modelName} />
        <Datum label="Servidor" value={telemetry.endpointHost} />
        <Datum label="A la nube" value={formatBytes(telemetry.bytesSentToCloud)} />
        <Datum label="Última respuesta" value={telemetry.lastLatencyMs ? `${Math.round(telemetry.lastLatencyMs)} ms` : "sin llamadas"} />
        <Datum label="Velocidad" value={telemetry.tokensPerSec ? `${Math.round(telemetry.tokensPerSec)} tokens/s` : "sin llamadas"} />
        <Datum label="En cola" value={String(telemetry.queueDepth)} />
      </dl>
    </div>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}
