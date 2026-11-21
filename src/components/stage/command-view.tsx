"use client";

import { ArrowRight, Ban, BellRing, Building2, CircleCheck, Hourglass, PenLine, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { formatClock, formatPct } from "@/components/organs/format";
import { cn } from "@/lib/utils";
import { Glass } from "./glass";
import { connectedSummary, deadlineWindow, deniedCount, pendingItems } from "./metrics";
import { RankingBars } from "./ranking-bars";

type Props = {
  room: ProjectedRoomState;
  onShowRanking: () => void;
  /** Abre el aviso al Comité. Solo existe si esta pantalla es del anfitrión y hay canales. */
  onNotifyCommittee?: () => void;
};

function Metric({ label, value, hint, icon: Icon, tone = "plain" }: { label: string; value: string; hint: string; icon: typeof Users; tone?: "plain" | "brand" | "blocked" | "done" }) {
  return (
    <Glass className={cn("flex flex-col p-5", tone === "brand" && "bg-brand text-white ring-brand/40")}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-base font-semibold", tone === "brand" ? "text-white" : "text-muted-foreground")}>{label}</p>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone === "brand" ? "bg-white/15" : tone === "blocked" ? "bg-bleed-soft text-bleed" : tone === "done" ? "bg-calm-soft text-calm" : "bg-muted")}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className={cn("mt-2 text-5xl font-semibold tracking-tight tabular-nums", tone === "blocked" && "text-bleed", tone === "done" && "text-calm")}>{value}</p>
      <p className={cn("mt-1 text-sm", tone === "brand" ? "text-white/85" : "text-muted-foreground")}>{hint}</p>
    </Glass>
  );
}

/** Vista principal de la pantalla grande: tarjetas tipo bento con los datos en vivo de la sala. */
export function CommandView({ room, onShowRanking, onNotifyCommittee }: Props) {
  const cross = room.mode === "cross_org" && !!room.scarcity && !!room.allocation;
  const stakes = room.stakes;
  const bleeding = stakes.status === "BLEEDING";
  const reliability = room.crossOrgReliability ?? room.orgs[0]?.reliability;
  const people = connectedSummary(room);
  const denied = deniedCount(room);
  const window = deadlineWindow(room);
  const pending = pendingItems(room);
  const scarcity = room.scarcity;
  const waiting = stakes.waitingCases;
  const resourceLine = cross ? scarcity!.resource : (room.orgs[0]?.liveCase.title ?? "Caso");
  const resourceDetail = cross
    ? `${scarcity!.rule.resourceQuantity} disponible · ${waiting} ${waiting === 1 ? "caso esperando" : "casos esperando"}`
    : (room.orgs[0]?.liveCase.stakesLabel ?? "");

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
      {/* Recurso en disputa, con el contador compartido. */}
      <Glass className="flex flex-col p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-lg font-semibold text-muted-foreground">{cross ? "Recurso en disputa" : "Caso en curso"}</p>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", bleeding ? "bg-bleed-soft text-bleed" : "bg-calm-soft text-calm")}>
            {bleeding ? <Hourglass className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
            {bleeding ? "Esperando una decisión" : "Decisión tomada"}
          </span>
        </div>
        <h2 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,3.1rem)] leading-tight font-semibold tracking-tight">{resourceLine}</h2>
        {resourceDetail && <p className="mt-1 text-xl font-medium text-muted-foreground">{resourceDetail}</p>}
        <p className={cn("mt-4 text-[clamp(4rem,3rem+4vw,6.5rem)] leading-none font-semibold tracking-tight tabular-nums", bleeding ? "text-bleed" : "text-calm")}>
          {formatClock(stakes.timeToDecisionMs ?? stakes.elapsedMs)}
        </p>
        <p className="mt-1 text-lg text-muted-foreground">{bleeding ? "sin decidir" : "hasta la decisión"}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {cross && (
            <button type="button" onClick={onShowRanking} className="btn btn-primary btn-lg">
              Ver ranking <ArrowRight className="size-5" aria-hidden />
            </button>
          )}
          {onNotifyCommittee && (
            <button type="button" onClick={onNotifyCommittee} className="btn btn-line btn-lg">
              <BellRing className="size-5" aria-hidden /> Avisar al Comité
            </button>
          )}
        </div>
        <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-border pt-5 text-sm sm:text-base">
          <div>
            <dt className="text-muted-foreground">Organizaciones</dt>
            <dd className="text-xl font-semibold">{room.orgs.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vidas en riesgo</dt>
            <dd className="text-xl font-semibold">{stakes.livesAtRisk}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{cross ? "Casos presentados" : "Estado"}</dt>
            <dd className="text-xl font-semibold">{cross ? `${scarcity!.candidates.filter((c) => c.submitted).length} de ${scarcity!.candidates.length}` : bleeding ? "Abierto" : "Cerrado"}</dd>
          </div>
        </dl>
      </Glass>

      {/* Cuatro métricas. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {reliability && (
          <Metric
            tone="brand"
            icon={ShieldCheck}
            label="Con control humano"
            value={formatPct(reliability.hybrid)}
            hint={`Sin control, agentes solos: ${formatPct(reliability.autonomous)}. Probabilidad de que los ${reliability.n} pasos terminen bien.`}
          />
        )}
        <Metric icon={Building2} label="Conectados" value={`${people.orgsWithPeople} de ${people.orgs}`} hint={`organizaciones con gente · ${people.people} ${people.people === 1 ? "persona" : "personas"}${people.committee ? " · Comité presente" : ""}`} />
        <Metric icon={Ban} tone={denied > 0 ? "blocked" : "plain"} label="Accesos rechazados" value={String(denied)} hint={denied === 1 ? "intento de ver un dato ajeno" : "intentos de ver datos ajenos"} />
        <Metric
          icon={Hourglass}
          tone={stakes.timeToDecisionMs !== null ? "done" : "plain"}
          label="Tiempo hasta decidir"
          value={stakes.timeToDecisionMs !== null ? formatClock(stakes.timeToDecisionMs) : "—"}
          hint={stakes.timeToDecisionMs !== null ? "desde que se abrió el caso" : "aparece cuando se sella la decisión"}
        />
      </div>

      {/* Ranking. */}
      {cross ? (
        <Glass className="p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Ranking</h2>
          <p className="text-muted-foreground">Una barra por caso. La regla es la misma para todos y el costo no entra.</p>
          <div className="mt-5">
            <RankingBars room={room} />
          </div>
        </Glass>
      ) : (
        <Glass className="p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">{room.orgs[0]?.authorityRule.metricLabel}</h2>
          <p className="mt-2 text-lg text-muted-foreground">{room.orgs[0]?.liveCase.summary}</p>
          <p className="mt-4 text-lg">{room.orgs[0]?.gate.message}</p>
        </Glass>
      )}

      <div className="grid content-start gap-5">
        {/* Ventana hasta el cierre. */}
        <Glass className="p-6">
          <h2 className="text-xl font-semibold">Ventana hasta el cierre</h2>
          {window.progress !== null ? (
            <>
              <div className="mt-4 h-4 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(window.progress * 100)} aria-label="Tiempo usado de la ventana">
                <div className={cn("h-full rounded-full", window.progress > 0.8 ? "bg-bleed" : window.progress > 0.5 ? "bg-clash" : "bg-brand")} style={{ width: `${Math.max(2, window.progress * 100)}%` }} />
              </div>
              <div className="mt-2 flex justify-between gap-3 text-base">
                <span className="font-semibold tabular-nums">Quedan {formatClock(window.remainingMs!)}</span>
                <span className="text-muted-foreground">{window.label}</span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-lg text-muted-foreground">{window.label}</p>
          )}
        </Glass>

        {/* Por firmar. */}
        <Glass className="p-6">
          <h2 className="text-xl font-semibold">Por firmar</h2>
          <p className="text-sm text-muted-foreground">Decisiones que necesitan a una persona.</p>
          <ul className="mt-4 space-y-2.5">
            {pending.map((item) => (
              <li key={item.id} className={cn("flex items-start gap-3 rounded-2xl p-3.5", item.tone === "done" ? "bg-calm-soft" : item.tone === "blocked" ? "bg-bleed-soft" : "bg-clash-soft")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-white", item.tone === "done" ? "text-calm" : item.tone === "blocked" ? "text-bleed" : "text-clash")}>
                  {item.tone === "done" ? <CircleCheck className="size-5" aria-hidden /> : item.tone === "blocked" ? <TriangleAlert className="size-5" aria-hidden /> : <PenLine className="size-5" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold">{item.title}</span>
                  <span className="block text-muted-foreground">{item.detail}</span>
                </span>
              </li>
            ))}
            {pending.length === 0 && <li className="text-muted-foreground">Nada pendiente por ahora.</li>}
          </ul>
        </Glass>
      </div>
    </div>
  );
}
