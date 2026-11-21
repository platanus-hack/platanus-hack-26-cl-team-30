import "server-only";

// Datos de la landing, calculados en el servidor con NUESTRAS semillas y NUESTRO
// motor. Al navegador solo llega lo público: el costo de cobertura de cada
// hospital nunca sale de aquí, igual que en la sala.

import { computeReliabilityPn, openRoom, projectStateForOrgAndRole, resolveAllocation } from "@/lib/engine/deterministic";
import type { AllocationRule, ProjectedField } from "@/lib/genome/schema";
import { getInitialSingleOrgRoom, getSeedGenome, getSeedScarcity } from "@/lib/genome/seeds";

/** Candidato del ejemplo sin el costo de cobertura, que es secreto de cada hospital. */
export type PublicCandidate = {
  orgId: string;
  caseId: string;
  patientLabel: string;
  clinicalSeverityScore: number;
  timeCriticality: number;
  delayRiskScore: number;
  unmetNeedScore: number;
  proposerRoleId: string;
};

export type LandingExample = {
  resource: string;
  deadlineLabel: string;
  stakesLabel: string;
  arbiter: { orgId: string; roleId: "role_a" | "role_b" | "role_c"; title: string; shortTag: string };
  orgNames: Record<string, string>;
  rule: AllocationRule;
  candidates: PublicCandidate[];
  /** Quién va primero con la regla acordada, según el motor. */
  sealedWinnerCaseId: string | null;
  sealedTieBreak: boolean;
};

export type RoleProjection = {
  roleId: string;
  title: string;
  /** Nombre corto para la pestaña ("Urgencias", "Gestión", "Comité"). */
  tab: string;
  objective: string;
  agentName: string;
  /** Campos tal como el servidor se los enviaría a ese rol: lo ajeno llega sin valor. */
  fields: ProjectedField[];
};

export type ReliabilityTable = {
  defaultP: number;
  defaultN: number;
  /** Confiabilidad del freno humano (h) que usa el motor. */
  h: number;
  /** Clave `${p*100}:${n}` → [autónomo, con freno humano]. */
  values: Record<string, [number, number]>;
};

export function landingExample(): LandingExample {
  const scarcity = getSeedScarcity();
  const resolution = resolveAllocation(scarcity);
  const orgNames: Record<string, string> = {};
  for (const id of ["clinica_andes", "hospital_rural"] as const) orgNames[id] = getSeedGenome(id).orgName;
  return {
    resource: scarcity.resource,
    deadlineLabel: scarcity.deadlineLabel,
    stakesLabel: scarcity.stakesLabel,
    arbiter: scarcity.arbiter,
    orgNames,
    rule: scarcity.rule,
    candidates: scarcity.candidates.map((candidate) => ({
      orgId: candidate.orgId,
      caseId: candidate.caseId,
      patientLabel: candidate.patientLabel,
      clinicalSeverityScore: candidate.clinicalSeverityScore,
      timeCriticality: candidate.timeCriticality,
      delayRiskScore: candidate.delayRiskScore,
      unmetNeedScore: candidate.unmetNeedScore,
      proposerRoleId: candidate.proposerRoleId,
    })),
    sealedWinnerCaseId: resolution.winnerCaseId,
    sealedTieBreak: resolution.tieBreakApplied,
  };
}

/** Hora fija para proyectar la clínica de ejemplo en la portada (prerenderizada). */
const LANDING_CLOCK = Date.UTC(2026, 10, 21, 12, 0, 0);

/** Las semillas guardan el nombre corto en mayúsculas y sin tilde; aquí se escribe como se lee. */
const SHORT_NAMES: Record<string, string> = { URGENCIAS: "Urgencias", GESTION: "Gestión", ETICO: "Comité" };
function shortName(tag: string): string {
  return SHORT_NAMES[tag] ?? tag.charAt(0) + tag.slice(1).toLowerCase();
}

/** Lo que recibe cada rol de la clínica, proyectado por el mismo motor que usa la sala. */
export function clinicProjections(): RoleProjection[] {
  // Reloj fijo: la portada se prerenderiza y los campos no dependen de la hora.
  const now = LANDING_CLOCK;
  const state = openRoom(getInitialSingleOrgRoom("landing", "clinica_andes", { now }), now);
  return state.orgGenomes[0].roles.map((role) => {
    const projected = projectStateForOrgAndRole(state, { orgId: "clinica_andes", roleId: role.id }, now);
    return {
      roleId: role.id,
      title: role.title,
      tab: shortName(role.shortTag),
      objective: role.objective,
      agentName: role.agentName,
      fields: projected.orgs[0]?.fields ?? [],
    };
  });
}

/**
 * Tabla de confiabilidad para los controles de la sección "por qué no un bot".
 * Cada valor sale de computeReliabilityPn sobre la clínica de ejemplo con otro p y otro n.
 */
export function reliabilityTable(): ReliabilityTable {
  const base = getSeedGenome("clinica_andes");
  const committee = base.roles.find((role) => role.isQrOptional);
  const values: ReliabilityTable["values"] = {};
  for (let pct = 80; pct <= 99; pct++) {
    for (let n = 3; n <= 15; n++) {
      const genome = structuredClone(base);
      genome.roles = genome.roles.map((role) => (role.isQrOptional ? role : { ...role, reliabilityP: pct / 100 }));
      genome.liveCase = { ...genome.liveCase, stepCountN: n };
      const view = computeReliabilityPn(genome);
      values[`${pct}:${n}`] = [view.autonomous, view.hybrid];
    }
  }
  const seedView = computeReliabilityPn(base);
  return { defaultP: Math.round(seedView.p * 100) / 100, defaultN: seedView.n, h: committee?.reliabilityP ?? 0.95, values };
}
