// Piloto automático: el guion de la demo como datos, para ensayar sin gente.
//
// Adaptado de la versión de Ramón (su src/lib/engine/autopilot.ts) a nuestro
// motor: cada paso llama a la misma función del motor que usaría una persona,
// con las mismas reglas y permisos. No hay atajos ni modelo de lenguaje: los
// pasos de agente se omiten para que el ensayo sea reproducible y no gaste
// llamadas.
//
// Quién juega: un bot toma cada puesto del guion que no tenga a una persona. Si
// una persona toma un puesto a mitad del ensayo, su paso se salta y lo hace ella.
// El almacén (src/lib/store/rooms.ts) ejecuta los pasos uno a uno con un
// intervalo; aquí solo se arma el guion y se puede reproducir entero (playAutopilot),
// lo que sirve para las pruebas.
//
// Todo lo que hace el ensayo queda en la bitácora con eventos AUTOPILOT y las
// entradas de los bots llevan { bot: true }: nunca se presenta como si lo
// hubiera hecho una persona.

import type { OrgGenome, RoomState } from "../genome/schema";
import {
  COVERAGE_COST_FIELD_KEY,
  canViewField,
  committeeRoleOf,
  effectiveThreshold,
  findGenome,
  attemptProtectedRead,
  recordCommitteeDecision,
  recordGateDecision,
  sealRule,
  submitCandidate,
  updateAuthoritySlider,
  type ActorRef,
  type EngineResult,
} from "./deterministic";

export type AutopilotStep = {
  /** Puesto que actúa en este paso. */
  seat: ActorRef;
  /** Qué pasa, en lenguaje simple: "Finanzas de Constructora Cordillera acuerda la regla". */
  description: string;
  /** El cambio, hecho por el motor como si lo pidiera ese puesto. */
  run: (state: RoomState, nowTs: number) => EngineResult;
  /** true si el paso muestra un rechazo: el 403 es el resultado esperado. */
  expectDenied?: boolean;
};

export type AutopilotOptions = {
  /** true: un bot también decide como Comité (ensayo completo sin jurado). */
  withCommittee: boolean;
};

/** Intervalo por defecto entre pasos, y sus límites. */
export const AUTOPILOT_DEFAULT_STEP_MS = 1500;
export const AUTOPILOT_MIN_STEP_MS = 300;
export const AUTOPILOT_MAX_STEP_MS = 5000;

/** Razones que escribe el ensayo. Son de ejemplo y lo dicen. */
export const AUTOPILOT_REASONS = {
  counter: "Ensayo automático: cubrimos hasta nuestro umbral; lo demás lo decide quien firma.",
  approve: "Ensayo automático: el caso lo justifica y la regla lo permite.",
  committee: "Ensayo automático: la regla conocida ordenó a los candidatos y no hay objeción.",
} as const;

/** "Gerencia de Finanzas (Constructora Cordillera)". */
function who(genome: OrgGenome, roleId: string): string {
  const title = genome.roles.find((role) => role.id === roleId)?.title ?? "Un rol";
  return `${title} (${genome.orgName})`;
}

/** Un campo de `target` que `reader` no puede ver: el costo si existe, si no el primero reservado. */
function hiddenFieldFor(state: RoomState, reader: ActorRef, target: OrgGenome): string | null {
  const hidden = target.fields.filter((field) => !canViewField(state, field, reader));
  return (hidden.find((field) => field.key === COVERAGE_COST_FIELD_KEY) ?? hidden[0])?.key ?? null;
}

const missing = (message: string): EngineResult => ({ ok: false, status: 409, code: "WRONG_MODE", message });

/** Pasos de la regla de autoridad de una organización hasta que alguien la firma. */
function authorityOpening(genome: OrgGenome): AutopilotStep[] {
  const rule = genome.authorityRule;
  const proposer = { orgId: genome.orgId, roleId: rule.proposerRoleId };
  const approver = { orgId: genome.orgId, roleId: rule.approverRoleId };
  return [
    {
      seat: proposer,
      description: `${who(genome, proposer.roleId)} pide decidir sola hasta el máximo`,
      run: (state, now) => updateAuthoritySlider(state, proposer, rule.max, now),
    },
    {
      seat: approver,
      description: `${who(genome, approver.roleId)} acuerda la regla: sobre el umbral firma una persona`,
      run: (state, now) => sealRule(state, approver, { gateMode: "deterministic_hitl" }, now),
    },
  ];
}

/** Arma el guion para la sala tal como está. Sirve para cualquier escenario, también uno mutado. */
export function buildAutopilotScript(state: RoomState, options: AutopilotOptions): AutopilotStep[] {
  const [first, second] = state.orgGenomes;
  if (!first) return [];

  if (state.mode === "single_org" || !second || !state.scarcity) {
    const rule = first.authorityRule;
    const proposer = { orgId: first.orgId, roleId: rule.proposerRoleId };
    const committee = committeeRoleOf(first);
    const decider = { orgId: first.orgId, roleId: options.withCommittee && committee ? committee.id : rule.approverRoleId };
    const [push, seal] = authorityOpening(first);
    return [
      push,
      {
        seat: proposer,
        description: `${who(first, proposer.roleId)} intenta leer un dato que no le corresponde`,
        expectDenied: true,
        run: (current, now) => {
          const key = hiddenFieldFor(current, proposer, findGenome(current, first.orgId) ?? first);
          return key ? attemptProtectedRead(current, proposer, { orgId: first.orgId, fieldKey: key }, now) : missing("No hay un dato oculto que intentar leer");
        },
      },
      seal,
      {
        seat: decider,
        description: `${who(first, decider.roleId)} aprueba con una razón`,
        run: (current, now) => recordGateDecision(current, decider, { decision: "APPROVE", reason: AUTOPILOT_REASONS.approve }, now),
      },
    ];
  }

  const approverA = { orgId: first.orgId, roleId: first.authorityRule.approverRoleId };
  const approverB = { orgId: second.orgId, roleId: second.authorityRule.approverRoleId };
  const candidates = state.scarcity.candidates;
  const steps: AutopilotStep[] = [
    authorityOpening(first)[0],
    {
      seat: approverB,
      description: `${who(second, approverB.roleId)} intenta leer el costo de la otra organización`,
      expectDenied: true,
      run: (current, now) => {
        const key = hiddenFieldFor(current, approverB, findGenome(current, first.orgId) ?? first);
        return key ? attemptProtectedRead(current, approverB, { orgId: first.orgId, fieldKey: key }, now) : missing("No hay un dato oculto que intentar leer");
      },
    },
    authorityOpening(first)[1],
    authorityOpening(second)[1],
    {
      seat: approverA,
      description: `${who(first, approverA.roleId)} contrapropone hasta su umbral, con una razón`,
      run: (current, now) => {
        const genome = findGenome(current, first.orgId) ?? first;
        return recordGateDecision(current, approverA, { decision: "COUNTER_PROPOSE", counterValue: effectiveThreshold(genome.authorityRule), reason: AUTOPILOT_REASONS.counter }, now);
      },
    },
    {
      seat: approverB,
      description: `${who(second, approverB.roleId)} aprueba con una razón`,
      run: (current, now) => recordGateDecision(current, approverB, { decision: "APPROVE", reason: AUTOPILOT_REASONS.approve }, now),
    },
    ...[first, second].flatMap((genome): AutopilotStep[] => {
      const candidate = candidates.find((entry) => entry.orgId === genome.orgId);
      if (!candidate) return [];
      const seat = { orgId: genome.orgId, roleId: candidate.proposerRoleId };
      return [{ seat, description: `${who(genome, seat.roleId)} presenta su caso (${candidate.patientLabel})`, run: (current, now) => submitCandidate(current, seat, candidate.caseId, now) }];
    }),
  ];
  if (options.withCommittee) {
    const arbiter = { orgId: state.scarcity.arbiter.orgId, roleId: state.scarcity.arbiter.roleId };
    steps.push({
      seat: arbiter,
      description: `El ${state.scarcity.arbiter.title} firma la asignación con una razón`,
      run: (current, now) => recordCommitteeDecision(current, arbiter, { decision: "APPROVE", reason: AUTOPILOT_REASONS.committee }, now),
    });
  }
  return steps;
}

/** Puestos distintos que aparecen en el guion, en orden de aparición. */
export function scriptSeats(script: AutopilotStep[]): ActorRef[] {
  const seen = new Map<string, ActorRef>();
  for (const step of script) seen.set(`${step.seat.orgId}:${step.seat.roleId}`, step.seat);
  return [...seen.values()];
}

/** Resultado de un paso. ok es true si salió como el guion espera (un rechazo esperado también cuenta). */
export type AutopilotOutcome = { description: string; ok: boolean; code?: string };

/** Traduce el resultado del motor al del guion. */
export function stepOutcome(step: AutopilotStep, result: EngineResult): AutopilotOutcome {
  if (step.expectDenied) return result.ok ? { description: step.description, ok: false, code: "NOT_DENIED" } : { description: step.description, ok: result.code === "RBAC_DENIED", code: result.code };
  return result.ok ? { description: step.description, ok: true } : { description: step.description, ok: false, code: result.code };
}

/**
 * Reproduce el guion completo de una vez, con reloj fijo: t0 + i·stepMs en el
 * paso i. Mismas reglas que una sala en vivo. Sirve para pruebas y para
 * comprobar que el guion llega al final en cualquier escenario.
 */
export function playAutopilot(start: RoomState, options: AutopilotOptions, t0: number, stepMs = AUTOPILOT_DEFAULT_STEP_MS): { state: RoomState; outcomes: AutopilotOutcome[] } {
  let state = start;
  const outcomes: AutopilotOutcome[] = [];
  buildAutopilotScript(start, options).forEach((step, index) => {
    const result = step.run(state, t0 + (index + 1) * stepMs);
    if (result.state) state = result.state;
    outcomes.push(stepOutcome(step, result));
  });
  return { state, outcomes };
}
