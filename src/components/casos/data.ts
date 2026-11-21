import "server-only";

// Cifras de una página de caso de uso, calculadas en el servidor con las mismas
// semillas y el mismo motor que la sala. Al navegador llega lo que cada rol
// recibiría: el valor reservado nunca sale de aquí, solo su nombre.

import { formatScore, formatValue } from "@/components/organs/format";
import { shortLabel } from "@/components/stage/seats";
import { computeCrossOrgReliabilityPn, demoSeats, markRoleJoined, openRoom, projectStateForOrgAndRole, resolveAllocation, sealAllocation, submitCandidate, type EngineResult } from "@/lib/engine/deterministic";
import type { RoomState } from "@/lib/genome/schema";
import type { SharedScarcity, Viewer } from "@/lib/genome/schema";
import { CROSS_ORG_SCENARIOS, type CrossOrgScenarioId } from "@/lib/genome/scenarios";
import { getInitialCrossOrgRoom } from "@/lib/genome/seeds";

/** Una fila de «qué ve cada uno»: el valor si le corresponde; si no, null (candado). */
export type CaseRow = { label: string; value: string | null };
export type CaseViewer = { label: string; rows: CaseRow[] };

/** Una línea del acta de una ronda: qué pasó, en qué paso y, si la hay, la razón. */
export type ActaEntry = { kind: "join" | "submit" | "propose" | "seal"; title: string; detail?: string; step: string };

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
  /** El acta de una ronda de la demo, jugada por el motor con las mismas funciones que una persona. */
  acta: ActaEntry[];
};

/** Razón de ejemplo del Comité: la primera que propone el celular en la demo. */
const DEMO_REASON = "Por equidad: más necesidad sin cubrir.";

function ok(result: EngineResult): RoomState {
  if (!result.ok) throw new Error(`${result.status} ${result.code}`);
  return result.state;
}

/** Juega una ronda de la sala de demo (entran, presentan, el Comité acepta) y la cuenta como acta. */
function playedActa(start: RoomState, label: (orgId: string) => string): ActaEntry[] {
  const scarcity = start.scarcity!;
  const arbiter = { orgId: scarcity.arbiter.orgId, roleId: scarcity.arbiter.roleId };
  let state = start;
  let t = CLOCK;
  for (const candidate of scarcity.candidates) state = ok(markRoleJoined(state, { orgId: candidate.orgId, roleId: candidate.proposerRoleId }, (t += 1000)));
  state = ok(markRoleJoined(state, arbiter, (t += 1000)));
  for (const candidate of scarcity.candidates) state = ok(submitCandidate(state, { orgId: candidate.orgId, roleId: candidate.proposerRoleId }, candidate.caseId, (t += 1000)));
  state = ok(sealAllocation(state, arbiter, DEMO_REASON, (t += 1000)));

  const entries: ActaEntry[] = [];
  const joined = new Set<string>();
  for (const event of state.auditLog) {
    const who = event.orgId === arbiter.orgId ? "El Comité" : label(event.orgId ?? "");
    if (event.type === "ROLE_JOINED" || event.type === "QR_JOINED") {
      if (joined.has(who)) continue;
      joined.add(who);
      entries.push({ kind: "join", title: `${who} entró`, step: "Unirse" });
    } else if (event.type === "CANDIDATE_SUBMITTED") {
      entries.push({ kind: "submit", title: `${who} presentó su caso`, step: "Casos" });
    } else if (event.type === "ALLOCATION_PROPOSED") {
      const winner = resolveAllocation(state.scarcity!).ranking[0];
      if (winner && !entries.some((entry) => entry.kind === "propose")) entries.push({ kind: "propose", title: `La regla propuso a ${label(winner.orgId)}`, detail: "Sin ver costos: solo lo que entra en la regla.", step: "Comité" });
    } else if (event.type === "ALLOCATION_SEALED") {
      entries.push({ kind: "seal", title: "El Comité aceptó y firmó", detail: `«${DEMO_REASON}»`, step: "Acta" });
    }
  }
  return entries;
}

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
  const acta = playedActa(state, orgName);
  return {
    scarcity: { ...scarcity, candidates: scarcity.candidates.map((candidate) => ({ ...candidate, coverageCost: 0, coverageCostVisibleToOrgs: [candidate.orgId] })) },
    orgLabels: Object.fromEntries(scarcity.candidates.map((candidate) => [candidate.orgId, orgName(candidate.orgId)])),
    reliability: { autonomous: reliability.autonomous, hybrid: reliability.hybrid, steps: reliability.n },
    acta,
    resource: CROSS_ORG_SCENARIOS[scenario].resource,
    demoRoom: CROSS_ORG_SCENARIOS[scenario].fixedRoomId,
    ranking: resolution.ranking.map((entry) => ({ org: orgName(entry.orgId), score: formatScore(entry.score), winner: entry.caseId === resolution.winnerCaseId })),
    tieBreak: resolution.tieBreakApplied,
    viewers,
  };
}
