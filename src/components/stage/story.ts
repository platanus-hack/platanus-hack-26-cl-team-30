// «Historia de la decisión»: la pantalla grande cuenta en qué va la sala con
// pocas palabras grandes. Este módulo solo traduce el estado que envió el
// servidor (ProjectedRoomState) a esa historia; no decide nada.

import type { ProjectedOrg, ProjectedRoomState } from "@/lib/genome/schema";
import { formatScore, formatValue } from "@/components/organs/format";

export type StoryStep = { id: string; label: string };
export type StoryProgress = { steps: StoryStep[]; index: number; done: boolean };

const CROSS_STEPS: StoryStep[] = [
  { id: "join", label: "Unirse" },
  { id: "limits", label: "Límites" },
  { id: "cases", label: "Casos" },
  { id: "committee", label: "Comité" },
  { id: "acta", label: "Acta" },
];
const SINGLE_STEPS: StoryStep[] = [
  { id: "join", label: "Unirse" },
  { id: "limits", label: "Límites" },
  { id: "sign", label: "Firma" },
  { id: "acta", label: "Acta" },
];

const roleTitle = (org: ProjectedOrg, roleId: string | null | undefined) => org.roles.find((role) => role.id === roleId)?.title ?? "una persona";

/** Paso en que va la sala. Unirse mientras nadie entró; Acta cuando la decisión quedó sellada. */
export function storyProgress(room: ProjectedRoomState): StoryProgress {
  const cross = room.mode === "cross_org" && !!room.allocation;
  const steps = cross ? CROSS_STEPS : SINGLE_STEPS;
  const anyone = room.connectedPlayers.length > 0;
  const conflict = room.orgs.some((org) => org.conflict.hasConflict);
  let index: number;
  if (cross) {
    const status = room.allocation!.status;
    if (status === "SEALED") index = 4;
    else if (status === "PROPOSED") index = 3;
    else if (!anyone) index = 0;
    // Entre organizaciones, una firma pendiente no impide presentar el caso: el
    // paso «Límites» depende solo de los límites en disputa, igual que la frase de abajo.
    else if (conflict) index = 1;
    else index = 2;
  } else {
    const sealed = room.orgs[0]?.gate.status === "SEALED";
    index = sealed ? 3 : !anyone ? 0 : conflict ? 1 : 2;
  }
  return { steps, index, done: index === steps.length - 1 };
}

/** Franja del recurso: la cantidad y el nombre en grande, el plazo y si sigue esperando. */
export function storyResource(room: ProjectedRoomState): { quantity: string; name: string; detail: string } {
  if (room.mode === "cross_org" && room.scarcity) {
    const name = room.scarcity.resource.replace(/\s*\(.*\)\s*$/, "");
    return { quantity: String(room.scarcity.rule.resourceQuantity), name, detail: room.scarcity.stakesLabel };
  }
  const org = room.orgs[0];
  return { quantity: "1", name: org?.liveCase.title ?? "Caso", detail: org?.liveCase.stakesLabel ?? "" };
}

/** Tarjeta de un candidato (o de la organización, en una sala de una sola). */
export type StoryCard = {
  id: string;
  org: string;
  title: string;
  score: string | null;
  /** Propuesto por la regla (estrella). */
  proposed: boolean;
  /** Recibe el recurso: el Comité ya selló. */
  winner: boolean;
  state: { tone: "calm" | "sign" | "block" | "plain"; text: string };
  /** Datos que no viajan a esta pantalla: solo su nombre, nunca el valor. */
  locked: string[];
  note?: string;
};

export function storyCards(room: ProjectedRoomState): StoryCard[] {
  const allocation = room.allocation;
  const scarcity = room.scarcity;
  if (allocation && scarcity) {
    return scarcity.candidates.map((candidate) => {
      const org = room.orgs.find((entry) => entry.orgId === candidate.orgId);
      const ranked = allocation.ranking.find((entry) => entry.caseId === candidate.caseId);
      const vetoed = allocation.vetoedCaseIds.includes(candidate.caseId);
      const proposed = allocation.winnerCaseId === candidate.caseId;
      const winner = proposed && allocation.status === "SEALED";
      const locked = [
        ...(typeof candidate.coverageCost === "number" ? [] : ["Costo de cobertura"]),
        ...(org?.fields.filter((field) => field.redacted && field.key !== "coverage_cost").map((field) => field.label) ?? []),
      ].slice(0, 3);
      const state: StoryCard["state"] = vetoed
        ? { tone: "block", text: "Vetado por el Comité" }
        : winner
          ? { tone: "calm", text: "Recibe el recurso" }
          : proposed
            ? { tone: "sign", text: "Propuesto por la regla" }
            : candidate.submitted
              ? { tone: "plain", text: "Caso presentado" }
              : { tone: "plain", text: "Sin presentar" };
      return {
        id: candidate.caseId,
        org: org?.orgName ?? candidate.orgId,
        title: candidate.patientLabel,
        score: ranked ? formatScore(ranked.score) : null,
        proposed,
        winner,
        state,
        locked,
        note: proposed && allocation.tieBreakApplied ? "Casi empatados: va primero quien tiene más necesidad sin cubrir." : undefined,
      };
    });
  }
  return room.orgs.map((org) => {
    const gate = org.gate;
    const rule = org.authorityRule;
    const state: StoryCard["state"] =
      gate.status === "SEALED"
        ? { tone: "calm", text: "Firmado" }
        : gate.status === "BLOCKED_HITL_REQUIRED"
          ? { tone: "block", text: "Falta una firma" }
          : org.conflict.hasConflict
            ? { tone: "sign", text: "Límite en disputa" }
            : { tone: "plain", text: "Sin firma pendiente" };
    return {
      id: org.orgId,
      org: org.orgName,
      title: rule.metricLabel,
      score: formatValue(gate.proposedValue, rule.unit),
      proposed: false,
      winner: gate.status === "SEALED",
      state,
      locked: org.fields.filter((field) => field.redacted).map((field) => field.label).slice(0, 3),
      note: `Límite acordado: ${formatValue(gate.effectiveThreshold, rule.unit)}`,
    };
  });
}

/** La frase grande de abajo: lo que falta ahora y quién tiene que firmar. */
export function storyMissing(room: ProjectedRoomState): { lead: "Falta" | "Listo"; text: string; who: string; whoConnected: boolean | null } {
  const allocation = room.allocation;
  const scarcity = room.scarcity;
  const orgOf = (orgId?: string | null) => room.orgs.find((org) => org.orgId === orgId);

  if (allocation && scarcity) {
    if (allocation.status === "SEALED") {
      const winner = allocation.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
      return { lead: "Listo", text: `${winner?.patientLabel ?? "El caso"} de ${orgOf(winner?.orgId)?.orgName ?? ""} recibe el recurso`.trim(), who: "El acta ya se puede descargar", whoConnected: null };
    }
    if (allocation.status === "PROPOSED") {
      return { lead: "Falta", text: "el Comité decide — aprobar o vetar con razón", who: scarcity.arbiter.title, whoConnected: scarcity.arbiter.connected };
    }
  }
  if (room.connectedPlayers.length === 0) {
    return { lead: "Falta", text: "que cada persona entre con su teléfono", who: "Escaneen el código de su rol en Organizaciones", whoConnected: null };
  }
  for (const org of room.orgs) {
    if (org.conflict.hasConflict) {
      const rule = org.authorityRule;
      const proposer = org.roles.find((role) => role.id === rule.proposerRoleId);
      const approver = org.roles.find((role) => role.id === rule.approverRoleId);
      return {
        lead: "Falta",
        text: `${org.orgName} acuerda hasta dónde se decide sin firma`,
        who: `${proposer?.title ?? "Quien propone"} y ${approver?.title ?? "quien aprueba"}`,
        whoConnected: !!proposer?.connected || !!approver?.connected,
      };
    }
  }
  for (const org of room.orgs) {
    if (org.gate.status === "BLOCKED_HITL_REQUIRED" && !(allocation && scarcity)) {
      const role = org.roles.find((entry) => entry.id === org.gate.pendingApproverRoleId);
      return { lead: "Falta", text: "firmar la propuesta — aprobar, vetar o proponer otro valor con razón", who: `${role?.title ?? "Una persona"} · ${org.orgName}`, whoConnected: role?.connected ?? null };
    }
  }
  if (allocation && scarcity) {
    const pending = scarcity.candidates.filter((candidate) => allocation.pendingCaseIds.includes(candidate.caseId));
    if (pending.length > 0) {
      const names = pending.map((candidate) => orgOf(candidate.orgId)?.orgName ?? candidate.orgId);
      const proposers = pending.map((candidate) => {
        const org = orgOf(candidate.orgId);
        return org ? `${roleTitle(org, candidate.proposerRoleId)} · ${org.orgName}` : candidate.orgId;
      });
      return {
        lead: "Falta",
        text: pending.length === 1 ? `${names[0]} presenta su caso` : "cada organización presenta su caso",
        who: proposers.join(" y "),
        whoConnected: pending.every((candidate) => orgOf(candidate.orgId)?.roles.find((role) => role.id === candidate.proposerRoleId)?.connected),
      };
    }
  }
  const org = room.orgs[0];
  if (org && org.gate.status === "SEALED") return { lead: "Listo", text: "la decisión quedó firmada", who: "El acta ya se puede descargar", whoConnected: null };
  return { lead: "Falta", text: "que alguien haga la propuesta", who: org ? roleTitle(org, org.authorityRule.proposerRoleId) : "", whoConnected: null };
}
