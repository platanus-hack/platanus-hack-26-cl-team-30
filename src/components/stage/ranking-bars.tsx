import type { ProjectedRoomState } from "@/lib/genome/schema";
import { formatScore } from "@/components/organs/format";
import { cn } from "@/lib/utils";

/**
 * Ranking en barras: una por candidato, separada en lo que suma (gravedad y
 * urgencia) y lo que resta (riesgo por demora). Los aportes vienen del motor.
 */
export function RankingBars({ room, tall = false }: { room: ProjectedRoomState; tall?: boolean }) {
  const allocation = room.allocation;
  const scarcity = room.scarcity;
  if (!allocation || !scarcity) return null;
  const pending = scarcity.candidates.filter((candidate) => allocation.pendingCaseIds.includes(candidate.caseId));
  const max = Math.max(scarcity.rule.weights.severity + scarcity.rule.weights.timeCriticality, 0.01);
  const orgName = (orgId: string) => room.orgs.find((org) => org.orgId === orgId)?.orgName ?? orgId;

  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium" aria-label="Leyenda">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-brand" aria-hidden /> Gravedad (suma)
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-[#5eaaa2]" aria-hidden /> Urgencia (suma)
        </li>
        <li className="flex items-center gap-2">
          <span className="hatch-bleed size-3 rounded-sm bg-bleed-soft" aria-hidden /> Riesgo por demora (resta)
        </li>
      </ul>
      <div className={cn("mt-5 flex items-end gap-6 border-b border-border px-2 sm:gap-10", tall ? "h-80" : "h-56")}>
        {allocation.ranking.map((entry) => {
          const winner = entry.caseId === allocation.winnerCaseId;
          const sev = (entry.terms.severity / max) * 100;
          const time = (entry.terms.timeCriticality / max) * 100;
          const risk = (Math.abs(entry.terms.delayRisk) / max) * 100;
          return (
            <div key={entry.caseId} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span className={cn("text-2xl font-semibold tabular-nums", winner ? "text-calm" : "text-foreground")}>{formatScore(entry.score)}</span>
              <div className="relative flex w-full max-w-28 flex-col-reverse overflow-hidden rounded-t-2xl" style={{ height: `${sev + time}%` }} role="img" aria-label={`${entry.patientLabel}: puntaje ${formatScore(entry.score)}`}>
                <span className="block w-full bg-brand" style={{ height: `${(sev / (sev + time)) * 100}%` }} />
                <span className="block w-full bg-[#5eaaa2]" style={{ height: `${(time / (sev + time)) * 100}%` }} />
                <span className="hatch-bleed absolute inset-x-0 top-0 bg-bleed-soft/90" style={{ height: `${(risk / (sev + time)) * 100}%` }} />
              </div>
            </div>
          );
        })}
        {pending.map((candidate) => (
          <div key={candidate.caseId} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="text-sm font-medium text-muted-foreground">Sin presentar</span>
            <div className="h-1/3 w-full max-w-28 rounded-t-2xl border-2 border-dashed border-border" aria-hidden />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-6 px-2 sm:gap-10">
        {[...allocation.ranking.map((entry) => ({ id: entry.caseId, label: entry.patientLabel, org: entry.orgId, winner: entry.caseId === allocation.winnerCaseId })), ...pending.map((c) => ({ id: c.caseId, label: c.patientLabel, org: c.orgId, winner: false }))].map((item) => (
          <div key={item.id} className="min-w-0 flex-1 text-center">
            <p className={cn("font-semibold", item.winner && "text-calm")}>{item.label}</p>
            <p className="truncate text-sm text-muted-foreground">{orgName(item.org)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
