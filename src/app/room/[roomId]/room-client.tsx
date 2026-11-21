"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuditConsole } from "@/components/nexo/audit-console";
import { ConnectionBadge } from "@/components/nexo/connection-badge";
import { RolePicker } from "@/components/nexo/role-picker";
import { AllocationBoardOrgan } from "@/components/organs/allocation-board-organ";
import { AllocationConflictOrgan } from "@/components/organs/allocation-conflict-organ";
import { DynamicCaseCardOrgan } from "@/components/organs/dynamic-case-card-organ";
import { FogOfWarPanelOrgan } from "@/components/organs/fog-of-war-panel-organ";
import { findOrg, isArbiter, isRoleViewer, orgLabel, roleLabel } from "@/components/organs/format";
import { LivingGraphOrgan } from "@/components/organs/living-graph-organ";
import { RoleAgentPanelOrgan } from "@/components/organs/role-agent-panel-organ";
import { SharedStakesCounterOrgan } from "@/components/organs/shared-stakes-counter-organ";
import { Button } from "@/components/ui/button";
import { actaUrl, useRoom } from "@/lib/client/use-room";
import type { HumanDecision, ProjectedOrg, ProjectedRoomState } from "@/lib/genome/schema";

/** Última decisión humana sobre la compuerta de una organización. */
function lastGateDecision(room: ProjectedRoomState, org: ProjectedOrg): HumanDecision | null {
  const own = room.decisions.filter((decision) => decision.scope === "gate" && (decision.targetOrgId ?? decision.byOrgId) === org.orgId);
  return own.at(-1) ?? null;
}

// Estación de un jugador: entra con una organización y un rol (por botón o por
// el enlace del código QR, ?orgId=&roleId=) y ve solo lo que el servidor le
// envía a ese rol. Cada acción pasa por useRoom().act y la valida el servidor.
export default function RoomClient() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, status, unreachable, problem, session, notice, join, leave, act } = useRoom(roomId);

  // Entrada por código QR: el enlace trae la organización y el rol.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const orgId = query.get("orgId");
    const roleId = query.get("roleId");
    if (orgId && roleId && !(session?.orgId === orgId && session.roleId === roleId)) void join(orgId, roleId);
    // Solo al cargar: después manda lo que la persona elija en pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!room) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 p-6">
        {unreachable ? (
          <>
            <h1 className="text-xl font-semibold">No encontramos la sala «{roomId}»</h1>
            <p className="text-sm text-muted-foreground">Las salas viven en la memoria del servidor: si se reinició, la sala ya no existe. Crea una nueva o usa una de las salas fijas.</p>
            <Link className="text-sm font-semibold underline underline-offset-4" href="/">
              Volver al inicio
            </Link>
          </>
        ) : (
          <p className="flex items-center gap-3 text-sm text-muted-foreground">
            Conectando con la sala <ConnectionBadge status={status} />
          </p>
        )}
        {problem && (
          <p role="alert" className="rounded-md border border-clash/50 bg-clash-soft px-3 py-2 text-sm">
            {problem}
          </p>
        )}
      </main>
    );
  }

  const me = isRoleViewer(room.viewer) ? room.viewer : null;
  const myOrg = me ? findOrg(room, me.orgId) : undefined;
  const myRole = myOrg?.roles.find((role) => role.id === me?.roleId);
  const arbiter = isArbiter(room);
  const acta = { md: actaUrl(roomId, "md"), json: actaUrl(roomId, "json") };
  const myCandidate = me ? (room.scarcity?.candidates.find((candidate) => candidate.orgId === me.orgId) ?? null) : null;
  const canSubmit = !!me && !!myCandidate && myCandidate.proposerRoleId === me.roleId && !myCandidate.submitted;

  const board = room.scarcity && room.allocation && (
    <AllocationBoardOrgan
      allocation={room.allocation}
      scarcity={room.scarcity}
      orgName={(orgId) => orgLabel(room, orgId)}
      submittable={canSubmit ? myCandidate : null}
      onSubmitCandidate={(caseId) => act("SUBMIT_CANDIDATE", { caseId })}
      isArbiter={arbiter}
      onSeal={(reason) => act("ALLOCATION_SEAL", { reason })}
      onVeto={(reason) => act("COMMITTEE_VETO", { reason })}
      decisions={room.decisions}
      acta={acta}
    />
  );

  const fog = (
    <FogOfWarPanelOrgan
      orgs={room.orgs}
      viewer={room.viewer}
      onBreach={me ? (targetOrgId, fieldKey) => act("TEST_RBAC_BREACH", { targetOrgId, fieldKey }) : undefined}
      onToggleSecret={myOrg ? (fieldKey) => act("TOGGLE_FIELD_SECRET", { fieldKey }) : undefined}
    />
  );

  const caseCard = (org: ProjectedOrg) => {
    const decision = lastGateDecision(room, org);
    return (
      <DynamicCaseCardOrgan
        key={org.orgId}
        org={org}
        candidate={room.scarcity?.candidates.find((candidate) => candidate.orgId === org.orgId) ?? null}
        decision={decision}
        decisionRoleTitle={decision ? roleLabel(room, decision.byOrgId, decision.byRoleId) : undefined}
        canDecide={!!me && me.orgId === org.orgId && org.gate.deciderRoleIds.includes(me.roleId)}
        onDecision={(kind, reason, counterValue) => act("HITL_DECISION", { decision: kind, reason, counterValue })}
      />
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-3 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="font-semibold text-foreground font-stretch-[112%]">
              Nexo
            </Link>{" "}
            sala {room.roomId}
          </p>
          <h1 className="text-2xl leading-tight font-semibold font-stretch-[108%]">
            {me ? roleLabel(room, me.orgId, me.roleId) : session ? "Entrando a tu rol…" : "Elige tu organización y tu rol"}
          </h1>
          {me && myOrg && <p className="text-sm text-muted-foreground">{myOrg.orgName}</p>}
          {arbiter && <p className="text-sm text-muted-foreground">No perteneces a ninguna de las organizaciones: arbitras entre ellas.</p>}
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge status={status} />
          {me && (
            <Button variant="outline" className="min-h-9 px-3" onClick={() => void leave()}>
              Dejar el rol
            </Button>
          )}
        </div>
      </header>

      {problem && (
        <p role="alert" className="rounded-md border border-clash/50 bg-clash-soft px-3 py-2 text-sm">
          {problem}
        </p>
      )}

      {notice && (
        <p role="alert" className="rounded-md border border-bleed/50 bg-bleed-soft px-3 py-2 text-sm text-bleed">
          {notice}
        </p>
      )}

      <SharedStakesCounterOrgan stakes={room.stakes} />

      {!me && (
        <>
          {!session && <RolePicker room={room} onJoin={join} />}
          <p className="text-sm text-muted-foreground">
            ¿Solo quieres mirar?{" "}
            <Link className="font-semibold text-foreground underline underline-offset-4" href={`/stage/${encodeURIComponent(roomId)}`}>
              Abre la pantalla general
            </Link>
            .
          </p>
        </>
      )}

      {/* Comité árbitro: primero su decisión, después el contexto. */}
      {me && arbiter && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {board}
            {room.orgs.map(caseCard)}
          </div>
          <div className="space-y-4">
            {fog}
            <LivingGraphOrgan room={room} />
            <AuditConsole room={room} acta={acta} />
          </div>
        </div>
      )}

      {/* Rol de una organización. */}
      {me && myOrg && myRole && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {caseCard(myOrg)}
            <AllocationConflictOrgan
              org={myOrg}
              viewerRoleId={me.roleId}
              onSlider={(value) => act("UPDATE_AUTHORITY_SLIDER", { value })}
              onSeal={(payload) => act("SEAL_RULE", payload)}
            />
            {board}
          </div>
          <div className="space-y-4">
            {fog}
            <RoleAgentPanelOrgan role={myRole} org={myOrg} telemetry={room.telemetry} onRun={() => act("RUN_ROLE_AGENT", {})} />
            <LivingGraphOrgan room={room} />
            <AuditConsole room={room} acta={acta} />
          </div>
        </div>
      )}
    </main>
  );
}
