"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FileDown, ScrollText, Smartphone, X } from "lucide-react";
import { AuditDrawer } from "@/components/nexo/audit-drawer";
import { CommitteeNotify } from "@/components/nexo/committee-notify";
import { ConnectionBadge } from "@/components/nexo/connection-badge";
import { Disclaimer } from "@/components/nexo/disclaimer";
import { EventToasts } from "@/components/nexo/event-toasts";
import { roomHeadline, roomStep } from "@/components/nexo/guide";
import { HostControls } from "@/components/nexo/host-controls";
import { useIntegrations } from "@/components/nexo/integrations";
import { JoinCodes } from "@/components/nexo/join-codes";
import { publicBaseUrl } from "@/components/nexo/public-url";
import { RoomHeader } from "@/components/nexo/room-header";
import { StageOrgCard } from "@/components/nexo/stage-org-card";
import { Stepper } from "@/components/nexo/stepper";
import { Mark } from "@/components/landing/mark";
import { AllocationBoardOrgan } from "@/components/organs/allocation-board-organ";
import { DynamicCaseCardOrgan } from "@/components/organs/dynamic-case-card-organ";
import { formatTime, orgLabel, roleLabel } from "@/components/organs/format";
import { LivingGraphOrgan } from "@/components/organs/living-graph-organ";
import { TelemetryReadout } from "@/components/organs/role-agent-panel-organ";
import { AskCase } from "@/components/stage/ask-case";
import { BottomNav, type StageTab } from "@/components/stage/bottom-nav";
import { CommandView } from "@/components/stage/command-view";
import { CommandBackdrop, Glass } from "@/components/stage/glass";
import { RankingBars } from "@/components/stage/ranking-bars";
import { ScenarioSwitch } from "@/components/stage/scenario-switch";
import { actaUrl, claimHostCredentials, createRoom, loadHostCredentials, useRoom, type HostCredentials } from "@/lib/client/use-room";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { CROSS_ORG_SCENARIOS } from "@/lib/genome/scenarios";

const noopSubscribe = () => () => {};
const FIXED_ROOMS = new Set(["demo", ...Object.values(CROSS_ORG_SCENARIOS).map((scenario) => scenario.fixedRoomId)]);

// Pantalla grande como «centro de mando»: paneles de vidrio en versión clara,
// tarjetas en grilla y navegación inferior. Mira la sala como "stage": recibe solo
// lo que todos pueden ver. El registro completo queda detrás de «Ver registro».
export default function StageClient() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { room, status, unreachable, problem } = useRoom(roomId, { spectator: true });
  const baseUrl = useSyncExternalStore(noopSubscribe, publicBaseUrl, () => null);
  const [host, setHost] = useState<HostCredentials | null | undefined>(undefined);
  const [tab, setTab] = useState<StageTab>("mando");
  const integrations = useIntegrations();
  const notifyDialog = useRef<HTMLDialogElement>(null);

  // Credenciales del anfitrión: las guardó este navegador al crear la sala, o
  // se piden para una sala fija (en desarrollo se entregan; en el deploy, no).
  useEffect(() => {
    let cancelled = false;
    const stored = loadHostCredentials(roomId);
    if (stored || !FIXED_ROOMS.has(roomId)) {
      queueMicrotask(() => !cancelled && setHost(stored));
      return () => {
        cancelled = true;
      };
    }
    void claimHostCredentials(roomId).then((claimed) => !cancelled && setHost(claimed));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

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
              <p className="text-muted-foreground">Las salas viven en la memoria del servidor: si se reinició, la sala ya no existe.</p>
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

  const cross = room.mode === "cross_org" && !!room.scarcity && !!room.allocation;
  const acta = { md: actaUrl(roomId, "md"), json: actaUrl(roomId, "json") };
  const step = roomStep(room);
  const headline = roomHeadline(room);
  const canNotify = !!host && cross && !!integrations && (integrations.whatsapp || (integrations.voice && integrations.canCall));

  // Abre una sala nueva del mismo caso, con sus propios controles y QR del Comité.
  async function openOwnRoom() {
    try {
      const created = cross
        ? await createRoom("cross_org", room!.scenarioId ? { scenario: room!.scenarioId } : {})
        : await createRoom("single_org", { seed: room!.orgs[0]?.orgId });
      router.push(`/stage/${encodeURIComponent(created.roomId)}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo abrir la sala.");
    }
  }

  return (
    <>
      <CommandBackdrop />
      <Disclaimer />
      <div className="mx-auto flex w-full max-w-[110rem] flex-1 flex-col gap-5 px-3 pt-4 pb-32 sm:px-6">
        {/* Barra superior de vidrio: marca, «Pregúntale al caso» y estado. */}
        <Glass as="header" className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-full px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Ir a la portada de Nexo">
            <Mark size={36} />
            <span className="leading-tight">
              <span className="block text-lg font-semibold">Nexo</span>
              <span className="block text-xs text-muted-foreground">Pantalla grande</span>
            </span>
          </Link>
          <div className="order-last flex w-full justify-center md:order-none md:w-auto md:flex-1">
            <AskCase room={room} />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <AuditDrawer room={room} acta={acta} />
            <Link href={`/room/${encodeURIComponent(roomId)}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground max-lg:hidden">
              <Smartphone className="size-4" aria-hidden />
              Entrar con un rol
            </Link>
            <ConnectionBadge status={status} />
          </div>
        </Glass>

        {problem && (
          <p role="alert" className="small rounded-xl bg-clash-soft px-3 py-2 text-clash">
            {problem}
          </p>
        )}

        {/* Título, qué está pasando y escenario. */}
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[clamp(2.2rem,1.4rem+2.6vw,3.75rem)] leading-none font-semibold tracking-tight">Centro de mando</h1>
              <p className="mt-2 text-[clamp(1.1rem,0.95rem+0.6vw,1.5rem)] font-medium text-balance">{headline.title}</p>
              <p className="text-lg text-muted-foreground">{headline.body}</p>
            </div>
            {cross && <ScenarioSwitch current={room.scenarioId ?? "hospitales"} />}
          </div>
          <Stepper step={step} size="stage" />
        </section>

        {tab === "mando" && <CommandView room={room} onShowRanking={() => setTab("ranking")} onNotifyCommittee={canNotify ? () => notifyDialog.current?.showModal() : undefined} />}

        {tab === "ranking" &&
          (cross ? (
            <div className="grid items-start gap-5 xl:grid-cols-[1.2fr_1fr]">
              <Glass className="p-6 sm:p-8">
                <h2 className="text-3xl font-semibold tracking-tight">Ranking</h2>
                <p className="text-lg text-muted-foreground">La misma fórmula para todos. Si quedan parejos, va primero quien tiene más necesidad sin cubrir.</p>
                <div className="mt-6">
                  <RankingBars room={room} tall />
                </div>
              </Glass>
              <AllocationBoardOrgan allocation={room.allocation!} scarcity={room.scarcity!} orgName={(orgId) => orgLabel(room, orgId)} decisions={room.decisions} size="stage" />
            </div>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-2">
              {room.orgs[0] && <SingleCase room={room} />}
              <LivingGraphOrgan room={room} size="stage" />
            </div>
          ))}

        {tab === "organizaciones" && (
          <div className="space-y-5">
            <div className={`grid items-start gap-5 ${room.orgs.length > 1 ? "xl:grid-cols-[1fr_1.4fr_1fr]" : "xl:grid-cols-[1fr_1.4fr]"}`}>
              <StageOrgCard org={room.orgs[0]} candidate={room.scarcity?.candidates.find((candidate) => candidate.orgId === room.orgs[0].orgId)} />
              <div className="max-xl:order-first">
                <LivingGraphOrgan room={room} size="stage" hideMeter />
              </div>
              {room.orgs[1] && <StageOrgCard org={room.orgs[1]} candidate={room.scarcity?.candidates.find((candidate) => candidate.orgId === room.orgs[1].orgId)} />}
            </div>
            <JoinCodes room={room} baseUrl={baseUrl} committeeKey={host?.committeeKey ?? null} onOpenOwnRoom={openOwnRoom} />
          </div>
        )}

        {tab === "acta" && <ActaView room={room} acta={acta} host={host ?? null} />}
      </div>

      <BottomNav tab={tab} onChange={setTab} single={!cross} />
      <EventToasts room={room} />

      {canNotify && host && (
        <dialog ref={notifyDialog} aria-label="Avisar al Comité" className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-[1.75rem] bg-white p-0 shadow-lift backdrop:bg-black/30">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-xl font-semibold">Avisar al Comité</h2>
            <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-muted" onClick={() => notifyDialog.current?.close()} aria-label="Cerrar">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="p-6">
            <CommitteeNotify room={room} credentials={host} />
          </div>
        </dialog>
      )}
    </>
  );
}

/** Caso de la organización en la sala de una sola organización: solo lectura. */
function SingleCase({ room }: { room: ProjectedRoomState }) {
  const org = room.orgs[0];
  const decision = room.decisions.filter((entry) => entry.scope === "gate" && (entry.targetOrgId ?? entry.byOrgId) === org.orgId).at(-1) ?? null;
  return <DynamicCaseCardOrgan org={org} decision={decision} decisionRoleTitle={decision ? roleLabel(room, decision.byOrgId, decision.byRoleId) : undefined} />;
}

/** Acta: las decisiones con su razón, la descarga y dónde corre el modelo. */
function ActaView({ room, acta, host }: { room: ProjectedRoomState; acta: { md: string; json: string }; host: HostCredentials | null }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Glass className="p-6 sm:p-8">
        <h2 className="text-3xl font-semibold tracking-tight">Acta de la decisión</h2>
        <p className="text-lg text-muted-foreground">Quién decidió qué, cuándo y por qué. Es la misma información que va en el archivo.</p>
        {room.decisions.length === 0 ? (
          <p className="mt-6 text-lg text-muted-foreground">Todavía nadie ha firmado. Cuando alguien apruebe o vete, su razón aparecerá aquí.</p>
        ) : (
          <ol className="mt-6 space-y-4">
            {room.decisions.map((decision) => (
              <li key={decision.ts} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                <p className="text-sm font-semibold text-muted-foreground">
                  {roleLabel(room, decision.byOrgId, decision.byRoleId)} · {decision.decision === "APPROVE" ? "aprobó" : decision.decision === "VETO" ? "vetó" : "propuso otro valor"}
                  {decision.scope === "allocation" ? " la asignación" : ` en ${orgLabel(room, decision.targetOrgId ?? decision.byOrgId)}`} · {formatTime(decision.ts)}
                </p>
                <blockquote className="mt-1 font-serif text-2xl leading-snug italic">«{decision.reason}»</blockquote>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href={acta.md} download className="btn btn-primary btn-lg">
            <FileDown className="size-5" aria-hidden /> Descargar el acta
          </a>
          <a href={acta.json} download className="btn btn-line btn-lg">
            <FileDown className="size-5" aria-hidden /> Acta en JSON
          </a>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ScrollText className="size-4" aria-hidden /> El registro completo, con cada código técnico, está en «Ver registro», arriba a la derecha.
        </p>
      </Glass>
      <div className="space-y-5">
        <Glass className="p-6">
          <h2 className="text-xl font-semibold">Dónde corre el modelo</h2>
          <TelemetryReadout telemetry={room.telemetry} className="mt-1 border-t-0 pt-0" />
        </Glass>
        {host && <HostControls room={room} credentials={host} />}
      </div>
    </div>
  );
}
