"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown, LogOut, MonitorPlay } from "lucide-react";
import { ConnectionBadge } from "@/components/nexo/connection-badge";
import { roomStep, seatTurn } from "@/components/nexo/guide";
import { RoleHeaderChip } from "@/components/nexo/role-chip";
import { RoleHeaderPlaceholder, RoomHeader } from "@/components/nexo/room-header";
import { RolePicker } from "@/components/nexo/role-picker";
import { Stepper } from "@/components/nexo/stepper";
import { TurnCard } from "@/components/nexo/turn-card";
import { VoiceAssistant, committeeKeyStorageKey } from "@/components/nexo/voice-assistant";
import { AllocationBoardOrgan } from "@/components/organs/allocation-board-organ";
import { AllocationConflictOrgan } from "@/components/organs/allocation-conflict-organ";
import { DynamicCaseCardOrgan } from "@/components/organs/dynamic-case-card-organ";
import { FogOfWarPanelOrgan } from "@/components/organs/fog-of-war-panel-organ";
import { findOrg, isArbiter, isRoleViewer, orgLabel, roleLabel } from "@/components/organs/format";
import { LivingGraphOrgan } from "@/components/organs/living-graph-organ";
import { RoleAgentPanelOrgan } from "@/components/organs/role-agent-panel-organ";
import { SharedStakesCounterOrgan } from "@/components/organs/shared-stakes-counter-organ";
import { actaUrl, useRoom } from "@/lib/client/use-room";
import type { HumanDecision, ProjectedOrg, ProjectedRoomState } from "@/lib/genome/schema";

/** Última decisión humana sobre la compuerta de una organización. */
function lastGateDecision(room: ProjectedRoomState, org: ProjectedOrg): HumanDecision | null {
  const own = room.decisions.filter((decision) => decision.scope === "gate" && (decision.targetOrgId ?? decision.byOrgId) === org.orgId);
  return own.at(-1) ?? null;
}

// Estación de un jugador, pensada para el teléfono. Arriba, lo único que le toca
// hacer ahora; el resto queda plegado en «Ver más». No muestra la bitácora: la
// bitácora es para el acta y para la consola de auditoría de la pantalla grande.
export default function RoomClient() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, status, unreachable, problem, session, notice, join, leave, act } = useRoom(roomId);

  // Entrada por código QR: el enlace trae la organización, el rol y, para el Comité, su clave.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const orgId = query.get("orgId");
    const roleId = query.get("roleId");
    const key = query.get("key") ?? undefined;
    if (key) {
      try {
        window.sessionStorage.setItem(committeeKeyStorageKey(roomId), key);
      } catch {
        // Sin almacenamiento la voz pedirá volver a escanear el código.
      }
    }
    if (orgId && roleId && !(session?.orgId === orgId && session.roleId === roleId)) void join(orgId, roleId, key);
    // Solo al cargar: después manda lo que la persona elija en pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!room) {
    return (
      <>
        <RoomHeader subtitle={`Sala ${roomId}`}>
          <ConnectionBadge status={status} />
        </RoomHeader>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 p-6">
          {unreachable ? (
            <>
              <h1 className="h-sub">No encontramos esta sala</h1>
              <p className="text-muted-foreground">Las salas viven en la memoria del servidor: si se reinició, la sala ya no existe. Pide un código nuevo o vuelve a la portada.</p>
              <Link className="btn btn-primary mt-2 self-start" href="/">
                Volver a la portada
              </Link>
            </>
          ) : (
            <p className="text-muted-foreground">Conectando con la sala…</p>
          )}
          {problem && (
            <p role="alert" className="small rounded-xl bg-clash-soft px-3 py-2 text-clash">
              {problem}
            </p>
          )}
        </main>
      </>
    );
  }

  const me = isRoleViewer(room.viewer) ? room.viewer : null;
  const myOrg = me ? findOrg(room, me.orgId) : undefined;
  const myRole = myOrg?.roles.find((role) => role.id === me?.roleId);
  const arbiter = isArbiter(room);
  const acta = { md: actaUrl(roomId, "md"), json: actaUrl(roomId, "json") };
  const turn = seatTurn(room);
  // El Comité: el árbitro entre organizaciones o, en una sola organización, el rol que entra por QR.
  const isCommitteeSeat = arbiter || myRole?.isQrOptional === true;
  const step = roomStep(room);
  const subtitle = room.mode === "cross_org" && room.scarcity ? room.scarcity.resource : (room.orgs[0]?.orgName ?? `Sala ${roomId}`);

  return (
    <>
      <RoomHeader subtitle={subtitle}>
        {me ? <RoleHeaderChip title={roleLabel(room, me.orgId, me.roleId)} org={arbiter ? undefined : myOrg?.orgName} /> : <RoleHeaderPlaceholder />}
        <ConnectionBadge status={status} />
      </RoomHeader>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        {(notice || problem) && (
          <p role="alert" className="small rounded-xl bg-clash-soft px-3 py-2 text-clash">
            {notice ?? problem}
          </p>
        )}

        <Stepper step={step} />
        <SharedStakesCounterOrgan stakes={room.stakes} />

        {!me && (
          <>
            <div>
              <h1 className="h-sub">{session ? "Entrando a tu rol…" : "¿Con qué rol entras?"}</h1>
              {!session && <p className="mt-1 text-muted-foreground">Elige tu organización y tu rol. Verás solo lo que ese rol puede ver.</p>}
            </div>
            {!session && <RolePicker room={room} onJoin={join} />}
          </>
        )}

        {me && turn && <TurnCard room={room} turn={turn} act={act} acta={acta} />}

        {me && isCommitteeSeat && turn?.kind !== "done" && <VoiceAssistant roomId={roomId} />}

        {me && (
          <details className="group panel">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-semibold">
              Ver más: el caso, los datos, el agente y el grafo
              <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-4 px-3 pb-4 sm:px-5">
              {myOrg && (
                <DynamicCaseCardOrgan
                  org={myOrg}
                  candidate={room.scarcity?.candidates.find((candidate) => candidate.orgId === myOrg.orgId) ?? null}
                  decision={lastGateDecision(room, myOrg)}
                  decisionRoleTitle={(() => {
                    const decision = lastGateDecision(room, myOrg);
                    return decision ? roleLabel(room, decision.byOrgId, decision.byRoleId) : undefined;
                  })()}
                />
              )}
              {arbiter &&
                room.orgs.map((org) => (
                  <DynamicCaseCardOrgan key={org.orgId} org={org} candidate={room.scarcity?.candidates.find((candidate) => candidate.orgId === org.orgId) ?? null} />
                ))}
              {room.scarcity && room.allocation && !arbiter && (
                <AllocationBoardOrgan allocation={room.allocation} scarcity={room.scarcity} orgName={(orgId) => orgLabel(room, orgId)} decisions={room.decisions} />
              )}
              <FogOfWarPanelOrgan
                orgs={room.orgs}
                viewer={room.viewer}
                onBreach={(targetOrgId, fieldKey) => act("TEST_RBAC_BREACH", { targetOrgId, fieldKey })}
                onToggleSecret={myOrg ? (fieldKey) => act("TOGGLE_FIELD_SECRET", { fieldKey }) : undefined}
              />
              {myOrg && (
                <AllocationConflictOrgan
                  org={myOrg}
                  viewerRoleId={me.roleId}
                  onSlider={(value) => act("UPDATE_AUTHORITY_SLIDER", { value })}
                  onSeal={(payload) => act("SEAL_RULE", payload)}
                />
              )}
              {myOrg && myRole && <RoleAgentPanelOrgan role={myRole} org={myOrg} telemetry={room.telemetry} onRun={() => act("RUN_ROLE_AGENT", {})} />}
              <LivingGraphOrgan room={room} />
            </div>
          </details>
        )}

        <p className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-sm">
          <Link className="inline-flex min-h-10 items-center gap-1.5 font-medium text-muted-foreground underline underline-offset-4" href={`/stage/${encodeURIComponent(roomId)}`}>
            <MonitorPlay className="size-4" aria-hidden />
            Ver la pantalla grande
          </Link>
          {me && (
            <button type="button" className="inline-flex min-h-10 items-center gap-1.5 font-medium text-muted-foreground underline underline-offset-4" onClick={() => void leave()}>
              <LogOut className="size-4" aria-hidden />
              Salir de este rol
            </button>
          )}
        </p>
      </main>
    </>
  );
}
