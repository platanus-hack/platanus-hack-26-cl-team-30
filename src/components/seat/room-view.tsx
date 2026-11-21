"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, ChevronDown, CircleCheck, CircleDashed, Cloud, FileDown, HardDrive, LoaderCircle, Lock, LogOut, MonitorPlay } from "lucide-react";
import { roomStep } from "@/components/nexo/guide";
import { VoiceAssistant } from "@/components/nexo/voice-assistant";
import { AllocationConflictOrgan } from "@/components/organs/allocation-conflict-organ";
import { findOrg, formatValue, type RoleViewer } from "@/components/organs/format";
import { LivingGraphOrgan } from "@/components/organs/living-graph-organ";
import { TelemetryReadout } from "@/components/organs/telemetry-readout";
import type { Act } from "@/lib/client/use-room";
import type { ProjectedOrg, ProjectedRole, ProjectedRoomState, Telemetry } from "@/lib/genome/schema";
import type { ActionOk } from "@/lib/store/actions";
import { Why } from "./parts";
import { seats } from "./screen";
import { SeatMain } from "./seat-shell";

type Props = {
  room: ProjectedRoomState;
  me: RoleViewer;
  roomId: string;
  act: Act;
  acta: { md: string; json: string };
  /** true si esta silla es la del Comité: ofrece decidir por voz si el canal está configurado. */
  committee: boolean;
  onLeave: () => void;
};

/**
 * Pestaña «Sala»: en qué paso va la decisión, quién está conectado y el agente
 * de este rol. Lo que antes ocupaba la pantalla (la regla completa y el mapa)
 * queda plegado al final.
 */
export function RoomView({ room, me, roomId, act, acta, committee, onLeave }: Props) {
  const step = roomStep(room);
  const groups = seats(room);
  const all = groups.flatMap((group) => group.seats);
  const myOrg = findOrg(room, me.orgId);
  const myRole = myOrg?.roles.find((role) => role.id === me.roleId);

  return (
    <SeatMain label="Sala">
      <section className="st-card">
        <h2 className="st-h2">
          <span>{step.done ? "Listo" : step.labels[step.index]}</span>
          <b>
            {step.index + 1} de {step.total}
          </b>
        </h2>
        <p className="st-steps" role="img" aria-label={`Paso ${step.index + 1} de ${step.total}`}>
          {step.labels.map((label, i) => (
            <i key={label} data-state={i < step.index || step.done ? "done" : i === step.index ? "now" : undefined} />
          ))}
        </p>
      </section>

      <section className="st-card">
        <h2 className="st-h2">
          <span>Conectados</span>
          <b>
            {all.filter((seat) => seat.connected).length} de {all.length}
          </b>
        </h2>
        {groups.map((group) => (
          <div key={group.orgName}>
            {groups.length > 1 && <p className="st-org-name">{group.orgName}</p>}
            <ul>
              {group.seats.map((seat) => {
                const mine = seat.orgId === me.orgId && seat.roleId === me.roleId;
                return (
                  <li key={seat.key} className="st-seat" data-accent={seat.accent}>
                    <span className="st-dot" aria-hidden />
                    <strong>{seat.title}</strong>
                    {mine ? (
                      <span className="st-badge">Tú</span>
                    ) : seat.connected ? (
                      <span className="st-badge">
                        <CircleCheck aria-hidden /> Conectado
                      </span>
                    ) : (
                      <span className="st-badge" data-tone="plain">
                        <CircleDashed aria-hidden /> Libre
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {myOrg && myRole && <SeatAgent role={myRole} org={myOrg} telemetry={room.telemetry} act={act} />}

      {committee && <VoiceAssistant roomId={roomId} />}

      <details className="st-card st-more">
        <summary>
          La regla y el mapa
          <ChevronDown aria-hidden />
        </summary>
        <div className="st-more-body">
          {myOrg && (
            <AllocationConflictOrgan org={myOrg} viewerRoleId={me.roleId} onSlider={(value) => act("UPDATE_AUTHORITY_SLIDER", { value })} onSeal={(payload) => act("SEAL_RULE", payload)} />
          )}
          <LivingGraphOrgan room={room} />
        </div>
      </details>

      <p className="st-links">
        <Link className="st-link" href={`/stage/${encodeURIComponent(roomId)}`}>
          <MonitorPlay aria-hidden /> Pantalla grande
        </Link>
        <a className="st-link" href={acta.json} download>
          <FileDown aria-hidden /> Acta en JSON
        </a>
        <button type="button" className="st-link" onClick={onLeave}>
          <LogOut aria-hidden /> Salir de mi silla
        </button>
      </p>
    </SeatMain>
  );
}

/**
 * El agente emparejado con el rol. Recibe la misma vista filtrada que la
 * persona y solo propone: nada cambia en la sala hasta que alguien decide.
 */
function SeatAgent({ role, org, telemetry, act }: { role: ProjectedRole; org: ProjectedOrg; telemetry: Telemetry; act: Act }) {
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<NonNullable<ActionOk["agent"]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const local = telemetry.provider === "local";
  // Si lo pide quien propone y todavía nadie firmó, el valor que sugiere el agente
  // pasa a ser la propuesta del caso (applyAgentProposal en el motor). Se avisa antes.
  const replaces = role.id === org.authorityRule.proposerRoleId && org.gate.outcome === null;
  const hiddenFromAgent = org.fields.filter((field) => field.redacted).length;

  async function run() {
    setBusy(true);
    setError(null);
    const result = await act("RUN_ROLE_AGENT", {});
    setBusy(false);
    if (result.ok && result.data.agent) setProposal(result.data.agent);
    else if (!result.ok) setError(result.error);
  }

  return (
    <section className="st-card" aria-label={`Agente de ${role.title}`}>
      <h2 className="st-h2">
        <span>
          <Bot aria-hidden style={{ display: "inline", width: 18, height: 18, marginInlineEnd: 6, verticalAlign: "-3px" }} />
          {role.agentName}
        </span>
        <span className="st-badge" data-tone="plain">
          {local ? <HardDrive aria-hidden /> : <Cloud aria-hidden />} {local ? "Modelo local" : "Modelo en la nube"}
        </span>
      </h2>
      <p className="st-support">{replaces ? "Ve lo mismo que tú. Su valor reemplaza tu propuesta." : "Ve lo mismo que tú. Solo propone."}</p>
      {proposal && <p className="st-agent-text">{proposal.proposalText}</p>}
      {proposal && proposal.suggestedValue !== null && (
        <p className="st-big" style={{ marginBlockStart: 10 }}>
          <b style={{ fontSize: 34 }}>{formatValue(proposal.suggestedValue, org.authorityRule.unit)}</b>
          <span>valor sugerido</span>
        </p>
      )}
      {proposal?.attemptedFieldRead && (
        <p role="status" className="st-denied" style={{ marginBlockStart: 8 }}>
          <Lock aria-hidden /> Pidió «{proposal.attemptedFieldRead}» y no lo recibió.
        </p>
      )}
      {error && (
        <p role="alert" className="st-denied" style={{ marginBlockStart: 8 }}>
          {error}
        </p>
      )}
      <button type="button" className="st-btn" data-kind="line" data-size="small" style={{ marginBlockStart: 12 }} disabled={busy} onClick={run}>
        {busy && <LoaderCircle className="animate-spin" aria-hidden />}
        {busy ? "Redactando…" : proposal ? "Pedir otra propuesta" : "Pedir una propuesta"}
      </button>
      <Why label="¿Qué recibe y dónde corre?">
        <p>
          {role.agentPersona} {hiddenFromAgent > 0 ? `No recibe ${hiddenFromAgent === 1 ? "el dato oculto" : `los ${hiddenFromAgent} datos ocultos`} de tu organización.` : "Recibe los mismos datos que tú."}
          {" "}La firma sigue siendo de una persona.
          {proposal && ` Esta respuesta ${proposal.source === "model" ? "la escribió el modelo" : "es de respaldo, sin modelo"} y tardó ${proposal.latencyMs} ms.`}
        </p>
        <TelemetryReadout telemetry={telemetry} className="mt-2" />
      </Why>
    </section>
  );
}
