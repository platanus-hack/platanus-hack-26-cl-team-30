import "server-only";

// Cifras de la landing de Sculptor calculadas en el servidor con las semillas y el
// motor de la sala. Así la landing no repite números a mano: si cambia una semilla
// o la fórmula, la landing cambia con ella. El costo de cobertura de cada hospital
// es secreto y no sale de aquí.

import { computeCrossOrgReliabilityPn, computeReliabilityPn, resolveAllocation } from "@/lib/engine/deterministic";
import { getSeedGenome, getSeedScarcity } from "@/lib/genome/seeds";

export type ChainNumbers = { p: number; n: number; autonomous: number; hybrid: number };

export type ExampleCandidate = {
  orgName: string;
  patientLabel: string;
  score: number;
  unmetNeed: number;
  rank: number;
};

export type SculptorData = {
  /** Una organización: la clínica de ejemplo. */
  single: ChainNumbers & { h: number };
  /** Dos organizaciones compitiendo por la cama, con la asignación sellada. */
  cross: ChainNumbers;
  example: {
    resource: string;
    candidates: ExampleCandidate[];
    scoreGap: number;
    epsilon: number;
    tieBreakApplied: boolean;
    weights: { severity: number; timeCriticality: number; delayRisk: number };
  };
};

export function sculptorData(): SculptorData {
  const andes = getSeedGenome("clinica_andes");
  const rural = getSeedGenome("hospital_rural");
  const single = computeReliabilityPn(andes);
  const committee = andes.roles.find((role) => role.isQrOptional);
  const scarcity = getSeedScarcity();
  const cross = computeCrossOrgReliabilityPn({ orgGenomes: [andes, rural], scarcity, allocationStatus: "SEALED" });
  const resolution = resolveAllocation(scarcity);
  const names: Record<string, string> = { [andes.orgId]: andes.orgName, [rural.orgId]: rural.orgName };

  return {
    single: { p: single.p, n: single.n, autonomous: single.autonomous, hybrid: single.hybrid, h: committee?.reliabilityP ?? 0.95 },
    cross: { p: cross.p, n: cross.n, autonomous: cross.autonomous, hybrid: cross.hybrid },
    example: {
      resource: scarcity.resource,
      candidates: resolution.ranking.map((c) => ({
        orgName: names[c.orgId] ?? c.orgId,
        patientLabel: c.patientLabel,
        score: c.score,
        unmetNeed: c.unmetNeedScore,
        rank: c.rank,
      })),
      scoreGap: resolution.scoreGap,
      epsilon: resolution.tieEpsilon,
      tieBreakApplied: resolution.tieBreakApplied,
      weights: scarcity.rule.weights,
    },
  };
}
