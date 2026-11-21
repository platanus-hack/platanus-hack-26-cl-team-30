// Guía de la sala: en qué paso va y qué le toca hacer a cada persona.
//
// Solo lee el estado que envió el servidor (ProjectedRoomState) y lo traduce a
// una instrucción en lenguaje simple. No decide nada: si la persona aprieta el
// botón, el servidor vuelve a revisar permisos y estado.

import type { ProjectedOrg, ProjectedRoomState } from "@/lib/genome/schema";
import { formatValue } from "@/components/organs/format";

export type StepInfo = { index: number; total: number; labels: string[]; done: boolean };

/** Acción que la persona puede ejecutar con un solo botón. */
export type TurnAction =
  | { type: "SEAL_RULE"; threshold: number }
  | { type: "SUBMIT_CANDIDATE"; caseId: string };

export type Turn =
  | { kind: "action"; title: string; body: string; actionLabel: string; action: TurnAction }
  | { kind: "sign-gate"; title: string; body: string; org: ProjectedOrg }
  | { kind: "sign-allocation"; title: string; body: string }
  | { kind: "wait"; title: string; body: string }
  | { kind: "done"; title: string; body: string };

const CROSS_STEPS = ["Acordar límites", "Firmar", "Presentar casos", "Decide el Comité", "Listo"];
const SINGLE_STEPS = ["Acordar el límite", "Firmar", "Listo"];

function roleTitle(org: ProjectedOrg, roleId: string | null | undefined): string {
  return org.roles.find((role) => role.id === roleId)?.title ?? "otra persona";
}

/** Paso en que va la sala completa. Lo usan la pantalla grande y la estación. */
export function roomStep(room: ProjectedRoomState): StepInfo {
  const cross = room.mode === "cross_org" && !!room.allocation;
  const labels = cross ? CROSS_STEPS : SINGLE_STEPS;
  const anyConflict = room.orgs.some((org) => org.conflict.hasConflict);
  const anyBlocked = room.orgs.some((org) => org.gate.status === "BLOCKED_HITL_REQUIRED");
  let index: number;
  if (cross) {
    const status = room.allocation!.status;
    if (status === "SEALED") index = 4;
    else if (status === "PROPOSED") index = 3;
    else if (anyConflict) index = 0;
    else if (anyBlocked) index = 1;
    else index = 2;
  } else {
    index = anyConflict ? 0 : anyBlocked ? 1 : 2;
  }
  return { index, total: labels.length, labels, done: index === labels.length - 1 };
}

/** Frase corta de lo que está pasando ahora en la sala, para la pantalla grande. */
export function roomHeadline(room: ProjectedRoomState): { title: string; body: string } {
  const step = roomStep(room);
  const cross = room.mode === "cross_org" && !!room.allocation && !!room.scarcity;
  if (cross) {
    const allocation = room.allocation!;
    const scarcity = room.scarcity!;
    const winner = allocation.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
    const orgName = (orgId: string | null | undefined) => room.orgs.find((org) => org.orgId === orgId)?.orgName ?? "";
    switch (step.index) {
      case 0:
        return { title: "Cada organización acuerda hasta dónde se decide sin firma", body: "Quien propone y quien aprueba tienen límites distintos. Hasta que los acuerden, nada avanza." };
      case 1:
        return { title: "Falta una firma", body: "Una propuesta pasó el límite acordado. La tiene que aprobar o vetar una persona." };
      case 2: {
        const ready = scarcity.candidates.filter((candidate) => candidate.submitted).length;
        return { title: "Las organizaciones presentan su caso", body: `${ready} de ${scarcity.candidates.length} casos presentados. Nadie ve los costos del otro.` };
      }
      case 3:
        return {
          title: `El Comité decide: ¿${winner?.patientLabel ?? "el primer caso"} recibe ${scarcity.rule.resourceLabel.toLowerCase()}?`,
          body: allocation.tieBreakApplied
            ? `La regla dejó un empate y lo resolvió por equidad a favor de ${orgName(winner?.orgId)}. El Comité tiene la última palabra.`
            : `La regla puso primero a ${orgName(winner?.orgId)}. El Comité tiene la última palabra.`,
        };
      default:
        return { title: `Decidido: ${winner?.patientLabel ?? "el caso"} de ${orgName(winner?.orgId)} recibe el recurso`, body: "La espera se detuvo. El acta con todo lo que pasó ya se puede descargar." };
    }
  }
  const org = room.orgs[0];
  if (!org) return { title: "Sala sin organización", body: "" };
  switch (step.index) {
    case 0:
      return { title: "Acordar hasta dónde se decide sin firma", body: `${roleTitle(org, org.authorityRule.proposerRoleId)} y ${roleTitle(org, org.authorityRule.approverRoleId)} tienen límites distintos.` };
    case 1:
      return { title: `Falta la firma de ${roleTitle(org, org.gate.pendingApproverRoleId)}`, body: org.gate.message };
    default:
      return { title: "Decisión tomada", body: org.gate.message };
  }
}

/**
 * Lo que le toca a quien mira. El orden es el del guion: acordar el límite,
 * firmar, presentar el caso y, para el Comité, decidir la asignación.
 */
export function seatTurn(room: ProjectedRoomState): Turn | null {
  const viewer = room.viewer;
  if (viewer === "stage") return null;
  const scarcity = room.scarcity;
  const allocation = room.allocation;
  const cross = room.mode === "cross_org" && !!scarcity && !!allocation;

  // Comité árbitro entre organizaciones.
  if (cross && viewer.orgId === scarcity.arbiter.orgId && viewer.roleId === scarcity.arbiter.roleId) {
    if (allocation.status === "SEALED") {
      return { kind: "done", title: "Listo: tu decisión quedó sellada", body: "Todas las pantallas ya muestran el resultado. Puedes descargar el acta." };
    }
    if (allocation.status === "PROPOSED") {
      return { kind: "sign-allocation", title: "Te toca decidir", body: "La regla ya ordenó los casos. Apruebas o vetas, y escribes por qué." };
    }
    const ready = scarcity.candidates.filter((candidate) => candidate.submitted).length;
    return {
      kind: "wait",
      title: "Espera a que las organizaciones presenten su caso",
      body: `${ready} de ${scarcity.candidates.length} casos presentados. Cuando estén todos, te toca decidir.`,
    };
  }

  const org = room.orgs.find((entry) => entry.orgId === viewer.orgId);
  if (!org) return null;
  const rule = org.authorityRule;
  const isProposer = viewer.roleId === rule.proposerRoleId;
  const isApprover = viewer.roleId === rule.approverRoleId;
  const isDecider = org.gate.deciderRoleIds.includes(viewer.roleId);
  const candidate = scarcity?.candidates.find((entry) => entry.orgId === viewer.orgId) ?? null;

  if (cross && allocation.status === "SEALED") {
    const winner = allocation.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
    const mine = winner?.orgId === viewer.orgId;
    return {
      kind: "done",
      title: mine ? `${winner?.patientLabel} recibe el recurso` : "El Comité asignó el recurso a la otra organización",
      body: "La decisión quedó sellada con su razón. Puedes descargar el acta.",
    };
  }

  // Sala de demo: quien presenta el caso no ve el límite ni la firma; eso lo
  // hacen los bots administrativos. Solo presenta y espera al Comité.
  if (cross && room.demo && candidate && candidate.proposerRoleId === viewer.roleId) {
    if (!candidate.submitted) {
      return {
        kind: "action",
        title: `Presenta a ${candidate.patientLabel}`,
        body: "Tu costo no sale de aquí.",
        actionLabel: `Presentar a ${candidate.patientLabel}`,
        action: { type: "SUBMIT_CANDIDATE", caseId: candidate.caseId },
      };
    }
    if (allocation.status === "PROPOSED") return { kind: "wait", title: "El Comité está decidiendo", body: "Lo verás aquí al instante." };
    return { kind: "wait", title: "Falta el otro caso", body: "Después decide el Comité." };
  }

  // 1. Acordar el límite.
  if (org.conflict.hasConflict) {
    const agreed = Math.min(rule.proposerLimit, rule.approverLimit);
    if (isProposer || isApprover) {
      return {
        kind: "action",
        title: "Pónganse de acuerdo en el límite",
        body: `${roleTitle(org, rule.proposerRoleId)} quiere decidir sin firma hasta ${formatValue(rule.proposerLimit, rule.unit)}; ${roleTitle(org, rule.approverRoleId)} acepta hasta ${formatValue(rule.approverLimit, rule.unit)}. Al sellar, sobre ${formatValue(agreed, rule.unit)} hará falta una firma.`,
        actionLabel: `Sellar el límite en ${formatValue(agreed, rule.unit)}`,
        action: { type: "SEAL_RULE", threshold: agreed },
      };
    }
    return { kind: "wait", title: "Están acordando el límite", body: `${roleTitle(org, rule.proposerRoleId)} y ${roleTitle(org, rule.approverRoleId)} deciden hasta dónde se puede avanzar sin firma.` };
  }

  // 2. Firmar la compuerta.
  if (org.gate.status === "BLOCKED_HITL_REQUIRED" && isDecider) {
    return {
      kind: "sign-gate",
      title: "Te toca firmar",
      body: `La propuesta es ${formatValue(org.gate.proposedValue, rule.unit)} y el límite acordado es ${formatValue(org.gate.effectiveThreshold, rule.unit)}. Apruebas, vetas o propones otro valor, y escribes por qué.`,
      org,
    };
  }

  // 3. Presentar el caso al recurso compartido.
  if (cross && candidate && candidate.proposerRoleId === viewer.roleId && !candidate.submitted) {
    return {
      kind: "action",
      title: `Presenta a ${candidate.patientLabel}`,
      body: "Se comparten solo los datos del caso. El costo de tu organización no sale de aquí.",
      actionLabel: `Presentar a ${candidate.patientLabel}`,
      action: { type: "SUBMIT_CANDIDATE", caseId: candidate.caseId },
    };
  }

  if (org.gate.status === "BLOCKED_HITL_REQUIRED") {
    return { kind: "wait", title: "Falta una firma", body: `Le toca a ${roleTitle(org, org.gate.pendingApproverRoleId)}.` };
  }
  if (cross) {
    if (allocation.status === "PROPOSED") return { kind: "wait", title: "El Comité está decidiendo", body: "Cuando firme, lo verás aquí al instante." };
    return { kind: "wait", title: "Esperando a la otra organización", body: "Cuando presente su caso, la regla ordenará los dos y decidirá el Comité." };
  }
  return { kind: "done", title: "Listo", body: org.gate.message };
}
