"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuditConsole } from "@/components/nexo/audit-console";
import { ConnectionBadge } from "@/components/nexo/connection-badge";
import { JoinCodes } from "@/components/nexo/join-codes";
import { MutateForm, describeMutation } from "@/components/nexo/mutate-form";
import { publicBaseUrl } from "@/components/nexo/public-url";
import { AllocationBoardOrgan } from "@/components/organs/allocation-board-organ";
import { AllocationConflictOrgan } from "@/components/organs/allocation-conflict-organ";
import { DynamicCaseCardOrgan } from "@/components/organs/dynamic-case-card-organ";
import { FogOfWarPanelOrgan } from "@/components/organs/fog-of-war-panel-organ";
import { orgLabel, roleLabel } from "@/components/organs/format";
import { LivingGraphOrgan } from "@/components/organs/living-graph-organ";
import { OrganFrame } from "@/components/organs/organ-frame";
import { ReliabilityMeter } from "@/components/organs/reliability-meter";
import { TelemetryReadout } from "@/components/organs/role-agent-panel-organ";
import { SharedStakesCounterOrgan } from "@/components/organs/shared-stakes-counter-organ";
import { actaUrl, mutateRoom, useRoom } from "@/lib/client/use-room";
import type { ProjectedOrg, ProjectedRoomState } from "@/lib/genome/schema";

const FIXED_ROOMS = ["demo", "demo-cross"];
const noopSubscribe = () => () => {};

// Pantalla para proyectar. Mira la sala como "stage": recibe solo lo que todos
// los roles pueden ver, así que los datos reservados aparecen tachados también
// aquí. No tiene rol y no puede ejecutar acciones; solo muestra y entrega los
// códigos QR para que las personas entren desde su teléfono.
export default function StageClient() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, status, unreachable } = useRoom(roomId, { spectator: true });
  // La dirección pública solo existe en el navegador; en el servidor es null.
  const baseUrl = useSyncExternalStore(noopSubscribe, publicBaseUrl, () => null);

  if (!room) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 p-6">
        {unreachable ? (
          <>
            <h1 className="text-xl font-semibold">No encontramos la sala «{roomId}»</h1>
            <p className="text-sm text-muted-foreground">Las salas viven en la memoria del servidor: si se reinició, la sala ya no existe.</p>
            <Link className="text-sm font-semibold underline underline-offset-4" href="/">
              Volver al inicio
            </Link>
          </>
        ) : (
          <p className="flex items-center gap-3 text-sm text-muted-foreground">
            Conectando con la sala <ConnectionBadge status={status} />
          </p>
        )}
      </main>
    );
  }

  const cross = room.mode === "cross_org" && !!room.scarcity && !!room.allocation;
  const acta = { md: actaUrl(roomId, "md"), json: actaUrl(roomId, "json") };

  return (
    <main className="flex w-full flex-1 flex-col gap-4 p-3 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="font-semibold text-foreground font-stretch-[112%]">
              Nexo
            </Link>{" "}
            sala {room.roomId}, pantalla general
          </p>
          <h1 className="text-3xl leading-tight font-semibold font-stretch-[110%] sm:text-4xl">{cross ? room.scarcity!.resource : room.orgs[0]?.orgName}</h1>
          {cross && (
            <p className="text-lg text-muted-foreground">
              Hay {room.scarcity!.rule.resourceQuantity} y la necesitan {room.orgs.length} organizaciones. Ninguna ve el costo de la otra.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="font-semibold underline underline-offset-4" href={`/room/${encodeURIComponent(roomId)}`}>
            Entrar con un rol
          </Link>
          <ConnectionBadge status={status} />
        </div>
      </header>

      <SharedStakesCounterOrgan stakes={room.stakes} size="stage" />

      {cross ? (
        <>
          <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.3fr_1fr]">
            <OrgColumn room={room} org={room.orgs[0]} />
            <div className="space-y-4 max-xl:order-first">
              <LivingGraphOrgan room={room} size="stage" hideMeter />
              {room.crossOrgReliability && (
                <OrganFrame title="Por qué no decide un agente solo" aside="modelo ilustrativo, calculado en código">
                  <ReliabilityMeter reliability={room.crossOrgReliability} scope="entre las organizaciones" size="stage" />
                </OrganFrame>
              )}
            </div>
            {room.orgs[1] && <OrgColumn room={room} org={room.orgs[1]} />}
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
            <AllocationBoardOrgan allocation={room.allocation!} scarcity={room.scarcity!} orgName={(orgId) => orgLabel(room, orgId)} decisions={room.decisions} acta={acta} size="stage" />
            <JoinCodes room={room} baseUrl={baseUrl} />
          </div>
        </>
      ) : (
        room.orgs[0] && (
          <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.3fr_1fr]">
            <div className="space-y-4">
              <CaseCard room={room} org={room.orgs[0]} />
              <AllocationConflictOrgan org={room.orgs[0]} viewerRoleId={null} />
            </div>
            <div className="space-y-4 max-xl:order-first">
              <LivingGraphOrgan room={room} size="stage" />
            </div>
            <div className="space-y-4">
              <JoinCodes room={room} baseUrl={baseUrl} />
              <FogOfWarPanelOrgan orgs={room.orgs} viewer={room.viewer} dense />
            </div>
          </div>
        )
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        <AuditConsole room={room} acta={cross ? undefined : acta} />
        <div className="space-y-4">
          <OrganFrame title="Dónde corre el modelo" aside="informado por el servidor">
            <TelemetryReadout telemetry={room.telemetry} className="border-t-0 pt-0" />
          </OrganFrame>
          {!cross && !FIXED_ROOMS.includes(roomId) && (
            <OrganFrame title="Cambiar de organización" aside="la estructura sigue siendo código">
              <MutateForm action="Generar y reemplazar esta organización" onSubmit={async (description) => describeMutation(await mutateRoom(roomId, description))} />
            </OrganFrame>
          )}
        </div>
      </div>
    </main>
  );
}

function CaseCard({ room, org }: { room: ProjectedRoomState; org: ProjectedOrg }) {
  const decision = room.decisions.filter((entry) => entry.scope === "gate" && (entry.targetOrgId ?? entry.byOrgId) === org.orgId).at(-1) ?? null;
  return (
    <DynamicCaseCardOrgan
      org={org}
      candidate={room.scarcity?.candidates.find((candidate) => candidate.orgId === org.orgId) ?? null}
      decision={decision}
      decisionRoleTitle={decision ? roleLabel(room, decision.byOrgId, decision.byRoleId) : undefined}
    />
  );
}

/** Columna de una organización en la vista inter-org: su caso y lo que la pantalla general puede ver de ella. */
function OrgColumn({ room, org }: { room: ProjectedRoomState; org: ProjectedOrg }) {
  return (
    <div className="space-y-4">
      <CaseCard room={room} org={org} />
      <FogOfWarPanelOrgan orgs={[org]} viewer={room.viewer} dense />
    </div>
  );
}
