import "server-only";

// Cifras de una página de caso de uso, calculadas en el servidor con las mismas
// semillas y el mismo motor que la sala. Al navegador llega lo que cada rol
// recibiría: el valor reservado nunca sale de aquí, solo su nombre.

import { formatScore, formatValue } from "@/components/organs/format";
import { shortLabel } from "@/components/stage/seats";
import { computeCrossOrgReliabilityPn, demoSeats, openRoom, projectStateForOrgAndRole, resolveAllocation } from "@/lib/engine/deterministic";
import type { SharedScarcity, Viewer } from "@/lib/genome/schema";
import { CROSS_ORG_SCENARIOS, type CrossOrgScenarioId } from "@/lib/genome/scenarios";
import { getInitialCrossOrgRoom } from "@/lib/genome/seeds";

/** Una fila de «qué ve cada uno»: el valor si le corresponde; si no, null (candado). */
export type CaseRow = { label: string; value: string | null };
export type CaseViewer = { label: string; rows: CaseRow[] };

export type CaseView = {
  resource: string;
  demoRoom: string;
  /** Puntaje de cada candidato, en el orden de la regla. */
  ranking: { org: string; score: string; winner: boolean }[];
  tieBreak: boolean;
  viewers: CaseViewer[];
  /**
   * La regla del escenario para moverla en el navegador. Los costos van en 0: no
   * entran en la cuenta y su valor real nunca sale del servidor.
   */
  scarcity: SharedScarcity;
  /** Nombre corto de cada organización, por orgId (el mismo de la demo). */
  orgLabels: Record<string, string>;
  /** Modelo ilustrativo p^n del escenario: agentes solos contra una persona que firma. */
  reliability: { autonomous: number; hybrid: number; steps: number };
};

// Reloj fijo: la página se prerenderiza y lo que ve cada rol no depende de la hora.
const CLOCK = Date.UTC(2026, 10, 21, 12, 0, 0);
// Por organización se muestran dos datos: el costo (la idea central: nadie ve el del otro)
// y el primero que no sea costo. En otro rubro sirve igual: si no hay costo, los dos primeros.
const ROWS_PER_ORG = 2;
const FIRST_KEY = "coverage_cost";

export function caseView(scenario: CrossOrgScenarioId, arbiterLabel: string): CaseView {
  // Sala de demo del escenario: así los nombres son los mismos que ve la gente en la demo.
  const state = openRoom({ ...getInitialCrossOrgRoom(`caso-${scenario}`, { now: CLOCK, scenario }), demo: true }, CLOCK);
  const scarcity = state.scarcity!;
  const seatLabels = new Map(demoSeats(state).map((seat) => [seat.seat.orgId, seat.label]));
  const orgName = (orgId: string) => seatLabels.get(orgId) ?? shortLabel(state.orgGenomes.find((genome) => genome.orgId === orgId)?.orgName ?? orgId);
  const resolution = resolveAllocation(scarcity);

  // Las tres personas de la demo: quien presenta en cada organización y el Comité.
  const people: { label: string; viewer: Viewer }[] = [
    ...scarcity.candidates.map((candidate) => ({ label: orgName(candidate.orgId), viewer: { orgId: candidate.orgId, roleId: candidate.proposerRoleId } as Viewer })),
    { label: arbiterLabel, viewer: { orgId: scarcity.arbiter.orgId, roleId: scarcity.arbiter.roleId } as Viewer },
  ];

  const viewers = people.map(({ label, viewer }) => {
    const projected = projectStateForOrgAndRole(state, viewer, CLOCK);
    const rows = projected.orgs.flatMap((org) =>
      [...org.fields].sort((a, b) => Number(b.key === FIRST_KEY) - Number(a.key === FIRST_KEY)).slice(0, ROWS_PER_ORG).map((field) => ({
        label: `${shortLabel(field.label)} · ${orgName(org.orgId)}`,
        value: field.redacted ? null : formatValue(field.value, field.unit),
      })),
    );
    return { label, rows };
  });

  const reliability = computeCrossOrgReliabilityPn(state);
  return {
    scarcity: { ...scarcity, candidates: scarcity.candidates.map((candidate) => ({ ...candidate, coverageCost: 0, coverageCostVisibleToOrgs: [candidate.orgId] })) },
    orgLabels: Object.fromEntries(scarcity.candidates.map((candidate) => [candidate.orgId, orgName(candidate.orgId)])),
    reliability: { autonomous: reliability.autonomous, hybrid: reliability.hybrid, steps: reliability.n },
    resource: CROSS_ORG_SCENARIOS[scenario].resource,
    demoRoom: CROSS_ORG_SCENARIOS[scenario].fixedRoomId,
    ranking: resolution.ranking.map((entry) => ({ org: orgName(entry.orgId), score: formatScore(entry.score), winner: entry.caseId === resolution.winnerCaseId })),
    tieBreak: resolution.tieBreakApplied,
    viewers,
  };
}
