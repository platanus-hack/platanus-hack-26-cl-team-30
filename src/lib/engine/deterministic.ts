// Motor determinista de Nexo. Aquí viven las reglas: choque de autoridad,
// compuerta, confiabilidad p^n, asignación del recurso escaso, permisos por
// organización y rol, contador de lo que está en juego y acta.
//
// Reglas de este archivo:
//   - Ningún modelo de lenguaje interviene. Mismas entradas, misma salida.
//   - Las funciones son puras: no leen el reloj ni variables globales (el reloj
//     del servidor entra como parámetro nowTs) y no modifican el estado que
//     reciben; las que cambian algo devuelven un estado nuevo.
//   - Los permisos se deciden aquí. Lo que un viewer no puede ver se elimina en
//     projectStateForOrgAndRole, que es la única salida de estado hacia clientes.
//   - La bitácora nunca lleva valores secretos: la ve todo el mundo.

import type {
  AllocationRule,
  AllocationView,
  AuditEvent,
  AuditEventType,
  AuthorityRule,
  ConflictView,
  EquityTieBreak,
  GateMode,
  GateStatus,
  GateView,
  HumanDecision,
  OrgCandidate,
  OrgGenome,
  ProjectedCandidate,
  ProjectedField,
  ProjectedOrg,
  ProjectedRoomState,
  RankedCandidate,
  ReliabilityView,
  RoleDefinition,
  RoleVisibilityField,
  RoomState,
  SharedScarcity,
  StakesView,
  Viewer,
} from "../genome/schema";

// --- Constantes ---------------------------------------------------------------

/** Un rol se muestra conectado si dio señal de vida hace menos que esto. */
export const PRESENCE_TTL_MS = 45_000;

/** Tasa de detección de la revisión humana cuando la organización no tiene Comité. */
export const DEFAULT_HUMAN_REVIEW_RELIABILITY = 0.95;

/** Eventos de bitácora que viajan en cada mensaje SSE. El acta lleva la bitácora completa. */
export const PROJECTED_AUDIT_LIMIT = 80;

/** Tope de la bitácora en memoria. */
export const MAX_AUDIT_EVENTS = 2000;

/**
 * Tope de intentos sin identidad válida (AUTH_FAILED) que se conservan. Los puede
 * provocar cualquiera sin token, así que tienen cupo propio: inundarlos no desplaza
 * ningún otro evento.
 */
export const MAX_AUTH_FAILED_EVENTS = 300;

export const ACTA_DISCLAIMER =
  "Demostración simulada de coordinación organizacional. Los datos del caso son de ejemplo; no constituye diagnóstico ni uso real de datos de pacientes.";

// --- Tipos del motor ----------------------------------------------------------

/** Quien actúa: un rol de una organización, o el Comité árbitro (con el orgId del árbitro). */
export type ActorRef = { orgId: string; roleId: string };

export type EngineErrorCode =
  | "REASON_REQUIRED"
  | "INVALID_VALUE"
  | "RBAC_DENIED"
  | "ROLE_NOT_FOUND"
  | "FIELD_NOT_FOUND"
  | "CANDIDATE_NOT_FOUND"
  | "WRONG_MODE"
  | "RULE_NOT_SEALED"
  | "GATE_NOT_BLOCKED"
  | "DECISION_SEALED"
  | "ALLOCATION_NOT_READY";

export type EngineFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  code: EngineErrorCode;
  message: string;
  /** Presente cuando el rechazo quedó en la bitácora (403): el estado con ese evento. */
  state?: RoomState;
};

export type EngineSuccess<Extra = unknown> = { ok: true; state: RoomState } & Extra;
export type EngineResult<Extra = unknown> = EngineSuccess<Extra> | EngineFailure;

type NewEvent = { type: AuditEventType; orgId?: string; roleId?: string; detail?: Record<string, unknown> };

// --- Utilidades ---------------------------------------------------------------

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

/** Texto escrito por una persona, en una sola línea, para que no rompa el formato del acta. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decimal(value: number): string {
  return String(round(value, 4)).replace(".", ",");
}

function fail(status: EngineFailure["status"], code: EngineErrorCode, message: string, state?: RoomState): EngineFailure {
  return state ? { ok: false, status, code, message, state } : { ok: false, status, code, message };
}

export function findGenome(state: RoomState, orgId: string): OrgGenome | undefined {
  return state.orgGenomes.find((genome) => genome.orgId === orgId);
}

/** El rol que entra por QR y firma o veta: el Comité de la organización. */
export function committeeRoleOf(genome: OrgGenome): RoleDefinition | undefined {
  return genome.roles.find((role) => role.isQrOptional);
}

export function isArbiter(state: RoomState, actor: ActorRef): boolean {
  const arbiter = state.scarcity?.arbiter;
  return !!arbiter && arbiter.orgId === actor.orgId && arbiter.roleId === actor.roleId;
}

function findRole(state: RoomState, actor: ActorRef): { genome: OrgGenome; role: RoleDefinition } | undefined {
  const genome = findGenome(state, actor.orgId);
  const role = genome?.roles.find((candidate) => candidate.id === actor.roleId);
  return genome && role ? { genome, role } : undefined;
}

/** true si el par orgId/roleId existe en la sala, como rol de una organización o como árbitro. */
export function isKnownActor(state: RoomState, actor: ActorRef): boolean {
  return !!findRole(state, actor) || isArbiter(state, actor);
}

function actorTitle(state: RoomState, actor: ActorRef): string {
  if (isArbiter(state, actor)) return state.scarcity!.arbiter.title;
  return findRole(state, actor)?.role.title ?? `${actor.orgId}/${actor.roleId}`;
}

/** Decisión humana que cerró la compuerta de una organización, si existe. Es definitiva. */
export function gateDecisionOf(state: Pick<RoomState, "decisions">, orgId: string): HumanDecision | null {
  return state.decisions.findLast((decision) => decision.scope === "gate" && decision.targetOrgId === orgId) ?? null;
}

function replaceGenome(state: RoomState, genome: OrgGenome): RoomState {
  return { ...state, orgGenomes: state.orgGenomes.map((current) => (current.orgId === genome.orgId ? genome : current)) };
}

// --- Choque de autoridad --------------------------------------------------------

/**
 * Hay choque cuando el proponente cree que puede decidir solo hasta un valor
 * mayor que el que le reconoce el aprobador, y todavía no sellaron un umbral.
 */
export function detectRuleConflict(rule: AuthorityRule): ConflictView {
  const delta = round(rule.proposerLimit - rule.approverLimit);
  const hasConflict = rule.proposerLimit > rule.approverLimit && rule.sealedThreshold === null;
  let message: string;
  if (hasConflict) {
    message = `Choque de autoridad: el proponente cree que decide solo hasta ${rule.proposerLimit}${rule.unit} y el aprobador le reconoce hasta ${rule.approverLimit}${rule.unit}. Diferencia: ${delta}${rule.unit}.`;
  } else if (rule.sealedThreshold !== null) {
    message = `Regla sellada: sobre ${rule.sealedThreshold}${rule.unit} se requiere firma.`;
  } else {
    message = `Sin choque: el límite del proponente (${rule.proposerLimit}${rule.unit}) no supera el del aprobador (${rule.approverLimit}${rule.unit}).`;
  }
  return { hasConflict, delta, proposerRoleId: rule.proposerRoleId, approverRoleId: rule.approverRoleId, message };
}

// --- Compuerta ----------------------------------------------------------------

/** Umbral vigente: el sellado si existe; si no, lo que reconoce el aprobador. */
export function effectiveThreshold(rule: AuthorityRule): number {
  return rule.sealedThreshold ?? rule.approverLimit;
}

/**
 * Estado de la compuerta de una organización.
 *   - Con decisión humana registrada: SEALED (aprobada, vetada o contrapropuesta).
 *   - Valor propuesto dentro del umbral: OPEN (no necesita firma).
 *   - Sobre el umbral en modo deterministic_hitl: BLOCKED_HITL_REQUIRED.
 *   - Sobre el umbral en modo agent_autonomous: AUTO_EXECUTED_UNSAFE (nadie firmó).
 */
export function evaluateGate(
  genome: OrgGenome,
  proposedValue: number = genome.liveCase.proposedValue,
  decision: HumanDecision | null = null,
): GateView {
  const rule = genome.authorityRule;
  const threshold = effectiveThreshold(rule);
  const crossesThreshold = proposedValue > threshold;
  const committee = committeeRoleOf(genome);
  const deciderRoleIds = [...new Set([rule.approverRoleId, ...(committee ? [committee.id] : [])])];
  const base = { mode: rule.gateMode, proposedValue, effectiveThreshold: threshold, crossesThreshold, deciderRoleIds };

  if (decision) {
    const outcome = decision.decision === "APPROVE" ? "approved" : decision.decision === "VETO" ? "vetoed" : "counter_proposed";
    const verb = outcome === "approved" ? "Aprobada" : outcome === "vetoed" ? "Vetada" : `Cerrada con contrapropuesta de ${proposedValue}${rule.unit}`;
    return { ...base, status: "SEALED", pendingApproverRoleId: null, outcome, message: `${verb} por una persona. Razón: ${decision.reason}` };
  }
  if (!crossesThreshold) {
    return { ...base, status: "OPEN", pendingApproverRoleId: null, outcome: null, message: `${proposedValue}${rule.unit} está dentro del umbral de ${threshold}${rule.unit}: no requiere firma.` };
  }
  if (rule.gateMode === "deterministic_hitl") {
    return {
      ...base,
      status: "BLOCKED_HITL_REQUIRED",
      pendingApproverRoleId: committee?.id ?? rule.approverRoleId,
      outcome: null,
      message: `${proposedValue}${rule.unit} supera el umbral de ${threshold}${rule.unit}: bloqueada hasta que una persona firme.`,
    };
  }
  return {
    ...base,
    status: "AUTO_EXECUTED_UNSAFE",
    pendingApproverRoleId: null,
    outcome: null,
    message: `${proposedValue}${rule.unit} supera el umbral de ${threshold}${rule.unit} y la compuerta está en modo autónomo: se ejecutó sin firma.`,
  };
}

/** Compuerta de una organización dentro de una sala, con su decisión si la hay. */
export function evaluateGateInRoom(state: RoomState, orgId: string): GateView | null {
  const genome = findGenome(state, orgId);
  return genome ? evaluateGate(genome, genome.liveCase.proposedValue, gateDecisionOf(state, orgId)) : null;
}

/** Estado de compuerta de la sala: el más grave entre sus organizaciones. */
export function computeRoomGateStatus(state: RoomState): GateStatus {
  const statuses = state.orgGenomes.map((genome) => evaluateGateInRoom(state, genome.orgId)!.status);
  if (statuses.includes("BLOCKED_HITL_REQUIRED")) return "BLOCKED_HITL_REQUIRED";
  if (statuses.includes("AUTO_EXECUTED_UNSAFE")) return "AUTO_EXECUTED_UNSAFE";
  if (statuses.length > 0 && statuses.every((status) => status === "SEALED")) return "SEALED";
  return "OPEN";
}

// --- Confiabilidad p^n ----------------------------------------------------------
//
// MODELO ILUSTRATIVO, NO UNA MEDICIÓN. Sirve para mostrar por qué una cadena de
// pasos automáticos se degrada y cuánto recupera un control humano. Los valores
// de p vienen del genoma (reliabilityP de cada rol), no de un benchmark.
//
//   p  = promedio de reliabilityP de los agentes que ejecutan pasos
//        (los roles que no son el Comité).
//   n  = pasos encadenados de la decisión (liveCase.stepCountN).
//   h  = probabilidad de que la revisión humana detecte un error: reliabilityP
//        del Comité, o DEFAULT_HUMAN_REVIEW_RELIABILITY si no hay Comité.
//
//   autónomo = p^n
//       Todos los pasos los ejecutan agentes y nadie revisa.
//       Ejemplo de la semilla: 0,92^10 = 43,4%.
//
//   híbrido  = (1 − (1 − p)·(1 − h))^n
//       Un paso solo falla si falla el agente Y además la compuerta con revisión
//       humana no lo detecta. Ejemplo: (1 − 0,08·0,05)^10 = 0,996^10 = 96,1%.
//
// Cuál aplica ahora (current): el híbrido solo si la compuerta está de verdad en
// vigor, es decir, modo deterministic_hitl y sin choque de autoridad pendiente.
// En modo agent_autonomous, o con la regla en disputa, aplica el autónomo.

type ReliabilityParts = { p: number; h: number; n: number; controlled: boolean };

function reliabilityParts(genome: OrgGenome): ReliabilityParts {
  const committee = committeeRoleOf(genome);
  const agents = genome.roles.filter((role) => !role.isQrOptional);
  const chain = agents.length > 0 ? agents : genome.roles;
  const p = chain.reduce((sum, role) => sum + role.reliabilityP, 0) / chain.length;
  const h = committee?.reliabilityP ?? DEFAULT_HUMAN_REVIEW_RELIABILITY;
  const controlled = genome.authorityRule.gateMode === "deterministic_hitl" && !detectRuleConflict(genome.authorityRule).hasConflict;
  return { p, h, n: genome.liveCase.stepCountN, controlled };
}

function hybridStep(p: number, h: number): number {
  return 1 - (1 - p) * (1 - h);
}

/** Confiabilidad de la cadena de decisión de una organización. Ver el modelo arriba. */
export function computeReliabilityPn(genome: OrgGenome): ReliabilityView {
  const { p, h, n, controlled } = reliabilityParts(genome);
  const autonomous = p ** n;
  const hybrid = hybridStep(p, h) ** n;
  return {
    p: round(p),
    n,
    autonomous: round(autonomous),
    hybrid: round(hybrid),
    current: round(controlled ? hybrid : autonomous),
    currentMode: controlled ? "hybrid" : "autonomous",
    formula:
      `Modelo ilustrativo. Autónomo = p^n = ${decimal(p)}^${n} = ${percent(autonomous)}. ` +
      `Híbrido = (1 − (1 − p)·(1 − h))^n = (1 − ${decimal(1 - p)}·${decimal(1 - h)})^${n} = ${percent(hybrid)}.`,
  };
}

/**
 * Confiabilidad de la cadena que cruza todas las organizaciones de la sala: se
 * multiplican las cadenas de cada una, así que más pasos dan más riesgo autónomo.
 *
 *   autónomo = Π p_i^n_i        híbrido = Π (1 − (1 − p_i)·(1 − h_i))^n_i
 *
 * n es la suma de pasos y p es el promedio geométrico (autónomo^(1/n)), de modo
 * que p^n sigue siendo el valor autónomo. El híbrido aplica cuando el Comité
 * selló la asignación; sin recurso compartido, cuando todas las compuertas están
 * en vigor. Modelo ilustrativo, igual que computeReliabilityPn.
 */
export function computeCrossOrgReliabilityPn(state: Pick<RoomState, "orgGenomes" | "scarcity" | "allocationStatus">): ReliabilityView {
  const parts = state.orgGenomes.map(reliabilityParts);
  const n = parts.reduce((sum, part) => sum + part.n, 0);
  const autonomous = parts.reduce((product, part) => product * part.p ** part.n, 1);
  const hybrid = parts.reduce((product, part) => product * hybridStep(part.p, part.h) ** part.n, 1);
  const controlled = state.scarcity ? state.allocationStatus === "SEALED" : parts.every((part) => part.controlled);
  const autonomousTerms = parts.map((part) => `${decimal(part.p)}^${part.n}`).join(" · ");
  const hybridTerms = parts.map((part) => `(1 − ${decimal(1 - part.p)}·${decimal(1 - part.h)})^${part.n}`).join(" · ");
  return {
    p: round(n > 0 ? autonomous ** (1 / n) : 1),
    n,
    autonomous: round(autonomous),
    hybrid: round(hybrid),
    current: round(controlled ? hybrid : autonomous),
    currentMode: controlled ? "hybrid" : "autonomous",
    formula: `Modelo ilustrativo. Autónomo = ${autonomousTerms} = ${percent(autonomous)}. Híbrido = ${hybridTerms} = ${percent(hybrid)}.`,
  };
}

// --- Asignación del recurso escaso ----------------------------------------------

type TriageInput = Pick<OrgCandidate, "clinicalSeverityScore" | "timeCriticality" | "delayRiskScore">;

/** Aporte de cada término al puntaje, ya multiplicado por su peso. */
export function computeTriageTerms(candidate: TriageInput, weights: AllocationRule["weights"]): RankedCandidate["terms"] {
  return {
    severity: round(weights.severity * candidate.clinicalSeverityScore),
    timeCriticality: round(weights.timeCriticality * candidate.timeCriticality),
    delayRisk: round(weights.delayRisk * candidate.delayRiskScore),
  };
}

/** Puntaje de un candidato: S = w_sev·gravedad + w_time·urgencia − w_delay·riesgo_de_demora. */
export function computeTriageScore(candidate: TriageInput, weights: AllocationRule["weights"]): number {
  const terms = computeTriageTerms(candidate, weights);
  return round(terms.severity + terms.timeCriticality - terms.delayRisk);
}

export type AllocationResolution = {
  /** Candidatos elegibles en orden. El primero es el ganador propuesto. */
  ranking: RankedCandidate[];
  /** null si no hay candidatos elegibles o si falta alguno por presentar. */
  winnerCaseId: string | null;
  winnerOrgId: string | null;
  tieBreakApplied: boolean;
  tieBreakRule: EquityTieBreak;
  tieEpsilon: number;
  /** Diferencia entre los dos mejores puntajes. 0 si hay menos de dos candidatos. */
  scoreGap: number;
  explanation: string;
  /** Casos no vetados que su organización todavía no presentó. */
  pendingCaseIds: string[];
};

export type AllocationOptions = {
  /** Casos vetados por el Comité: quedan fuera del orden. */
  excludedCaseIds?: string[];
  /** true: solo compiten los candidatos ya presentados (submitted). Por defecto compiten todos. */
  requireSubmitted?: boolean;
};

/**
 * Clave del desempate: gana el valor más alto.
 *   - worst_unmet_need: mayor necesidad sin cubrir (unmetNeedScore).
 *   - coverage_gap: menor costo de cobertura. Usa el costo secreto solo dentro
 *     del servidor; hacia afuera sale el orden, nunca el monto.
 *   - geographic: el esquema no tiene datos geográficos, así que usa la necesidad
 *     sin cubrir como aproximación. La explicación lo dice.
 */
function tieBreakKey(candidate: OrgCandidate, rule: EquityTieBreak): number {
  return rule === "coverage_gap" ? -candidate.coverageCost : candidate.unmetNeedScore;
}

const TIE_BREAK_LABEL: Record<EquityTieBreak, string> = {
  worst_unmet_need: "mayor necesidad sin cubrir",
  coverage_gap: "menor costo de cobertura",
  geographic: "mayor necesidad sin cubrir (no hay datos geográficos; se usa como aproximación)",
};

/**
 * Asigna el recurso al candidato con mayor puntaje. Si los mejores puntajes
 * difieren en menos que tieEpsilon, decide el desempate de equidad de la regla.
 * Empate total: orden alfabético de caseId, para que el resultado sea siempre el mismo.
 */
export function resolveAllocation(scarcity: SharedScarcity, options: AllocationOptions = {}): AllocationResolution {
  const { rule } = scarcity;
  const excluded = new Set(options.excludedCaseIds ?? []);
  const alive = scarcity.candidates.filter((candidate) => !excluded.has(candidate.caseId));
  const eligible = options.requireSubmitted ? alive.filter((candidate) => candidate.submitted === true) : alive;
  const pendingCaseIds = alive.filter((candidate) => !eligible.includes(candidate)).map((candidate) => candidate.caseId);

  const scored = eligible
    .map((candidate) => ({ candidate, score: computeTriageScore(candidate, rule.weights) }))
    .sort((a, b) => b.score - a.score || a.candidate.caseId.localeCompare(b.candidate.caseId));

  const top = scored[0];
  const tieGroup = top ? scored.filter((entry) => round(top.score - entry.score) < rule.tieEpsilon) : [];
  const tieBreakApplied = tieGroup.length > 1;
  if (tieBreakApplied) {
    tieGroup.sort(
      (a, b) =>
        tieBreakKey(b.candidate, rule.equityTieBreak) - tieBreakKey(a.candidate, rule.equityTieBreak) ||
        b.score - a.score ||
        a.candidate.caseId.localeCompare(b.candidate.caseId),
    );
  }
  const ordered = [...tieGroup, ...scored.slice(tieGroup.length)];
  const scoreGap = scored.length > 1 ? round(scored[0].score - scored[1].score) : 0;

  const ranking: RankedCandidate[] = ordered.map(({ candidate, score }, index) => ({
    rank: index + 1,
    orgId: candidate.orgId,
    caseId: candidate.caseId,
    patientLabel: candidate.patientLabel,
    score,
    terms: computeTriageTerms(candidate, rule.weights),
    unmetNeedScore: candidate.unmetNeedScore,
  }));

  const complete = pendingCaseIds.length === 0 && ranking.length > 0;
  const winner = complete ? ranking[0] : null;

  let explanation: string;
  if (ranking.length === 0) {
    explanation = pendingCaseIds.length > 0 ? "Ninguna organización ha presentado su candidato todavía." : "No quedan candidatos elegibles.";
  } else if (!complete) {
    explanation = `Faltan candidatos por presentar (${pendingCaseIds.join(", ")}). El orden es parcial y todavía no hay ganador.`;
  } else if (tieBreakApplied) {
    explanation =
      `Los mejores puntajes difieren en ${decimal(scoreGap)}, menos que el margen de empate (${decimal(rule.tieEpsilon)}). ` +
      `Se aplica el desempate de equidad: ${TIE_BREAK_LABEL[rule.equityTieBreak]}. Gana ${ranking[0].patientLabel} (${ranking[0].caseId}).`;
  } else if (ranking.length === 1) {
    explanation = `${ranking[0].patientLabel} (${ranking[0].caseId}) es el único candidato elegible.`;
  } else {
    explanation = `Gana ${ranking[0].patientLabel} (${ranking[0].caseId}) por puntaje: ${decimal(ranking[0].score)} contra ${decimal(ranking[1].score)}. La diferencia supera el margen de empate (${decimal(rule.tieEpsilon)}).`;
  }

  return {
    ranking,
    winnerCaseId: winner?.caseId ?? null,
    winnerOrgId: winner?.orgId ?? null,
    tieBreakApplied,
    tieBreakRule: rule.equityTieBreak,
    tieEpsilon: rule.tieEpsilon,
    scoreGap,
    explanation,
    pendingCaseIds,
  };
}

/** Casos que el Comité vetó en esta sala. */
export function vetoedCaseIds(state: Pick<RoomState, "decisions">): string[] {
  return state.decisions
    .filter((decision) => decision.scope === "allocation" && decision.decision === "VETO" && decision.targetCaseId)
    .map((decision) => decision.targetCaseId!);
}

/** Asignación vigente de la sala: solo candidatos presentados y sin los vetados. null en single_org. */
export function resolveRoomAllocation(state: Pick<RoomState, "scarcity" | "decisions">): AllocationResolution | null {
  if (!state.scarcity) return null;
  return resolveAllocation(state.scarcity, { excludedCaseIds: vetoedCaseIds(state), requireSubmitted: true });
}

export function buildAllocationView(state: Pick<RoomState, "scarcity" | "decisions" | "allocationStatus">): AllocationView | null {
  const resolution = resolveRoomAllocation(state);
  if (!resolution) return null;
  return {
    status: state.allocationStatus ?? "PENDING",
    ranking: resolution.ranking,
    winnerCaseId: resolution.winnerCaseId,
    winnerOrgId: resolution.winnerOrgId,
    tieBreakApplied: resolution.tieBreakApplied,
    tieBreakRule: resolution.tieBreakRule,
    tieEpsilon: resolution.tieEpsilon,
    scoreGap: resolution.scoreGap,
    explanation: resolution.explanation,
    vetoedCaseIds: vetoedCaseIds(state),
    pendingCaseIds: resolution.pendingCaseIds,
    committeeDecision: state.decisions.findLast((decision) => decision.scope === "allocation") ?? null,
  };
}

// --- Contador de lo que está en juego ---------------------------------------------

/**
 * Desde cuándo corre el reloj de espera: desde que entró la primera persona
 * (clockStartedAt). null si nadie ha entrado. Un estado sin ese campo (armado a
 * mano o anterior al cambio) usa caseOpenedAt.
 */
export function clockStart(state: Pick<RoomState, "clockStartedAt" | "caseOpenedAt">): number | null {
  return state.clockStartedAt === undefined ? state.caseOpenedAt : state.clockStartedAt;
}

/** Tiempo desde que empezó el reloj hasta nowTs. 0 si no ha empezado. */
function waitedMs(state: RoomState, nowTs: number): number {
  const start = clockStart(state);
  return start === null ? 0 : Math.max(0, nowTs - start);
}

/**
 * Contador compartido. nowTs es el reloj del servidor.
 * BLEEDING mientras no hay decisión sellada; CONTAINED desde decisionSealedAt
 * (firma de la compuerta en single_org, sello de la asignación en cross_org).
 */
export function computeSharedStakesCounter(state: RoomState, nowTs: number): StakesView {
  const sealed = state.decisionSealedAt !== null;
  const end = state.decisionSealedAt ?? nowTs;
  const start = clockStart(state);
  const elapsedMs = start === null ? 0 : Math.max(0, end - start);
  const timeToDecisionMs = sealed ? elapsedMs : null;

  if (state.scarcity) {
    // Cada candidato es un caso que espera el mismo recurso. Las vidas en riesgo
    // salen de los casos de cada organización (liveCase.livesAtRisk): en los
    // hospitales hay una por caso; en una obra o una carga, ninguna.
    const waitingCases = sealed ? 0 : state.scarcity.candidates.length;
    const candidateOrgs = new Set(state.scarcity.candidates.map((candidate) => candidate.orgId));
    const lives = state.orgGenomes.filter((genome) => candidateOrgs.has(genome.orgId)).reduce((sum, genome) => sum + (genome.liveCase.livesAtRisk ?? 0), 0);
    return {
      status: sealed ? "CONTAINED" : "BLEEDING",
      waitingCases,
      livesAtRisk: sealed ? 0 : lives,
      elapsedMs,
      timeToDecisionMs,
      stakesLabel: state.scarcity.stakesLabel,
      deadlineLabel: state.scarcity.deadlineLabel,
    };
  }

  const cases = state.orgGenomes.map((genome) => genome.liveCase);
  return {
    status: sealed ? "CONTAINED" : "BLEEDING",
    waitingCases: sealed ? 0 : cases.length,
    livesAtRisk: sealed ? 0 : cases.reduce((sum, liveCase) => sum + (liveCase.livesAtRisk ?? 0), 0),
    elapsedMs,
    timeToDecisionMs,
    stakesLabel: cases.map((liveCase) => liveCase.stakesLabel).join(" · "),
    deadlineLabel: null,
  };
}

// --- Permisos y vista por viewer ----------------------------------------------------

/** Si el viewer no es un rol de la sala ni el árbitro, se lo trata como pantalla general. */
export function normalizeViewer(state: RoomState, viewer: Viewer): Viewer {
  return viewer !== "stage" && isKnownActor(state, viewer) ? { orgId: viewer.orgId, roleId: viewer.roleId } : "stage";
}

/**
 * Permiso doble sobre un campo: la organización del viewer debe estar en
 * visibleToOrgIds Y su rol en visibleToRoleIds.
 *
 * La pantalla general ("stage") no tiene identidad: la recibe cualquiera que
 * conozca la sala, y de ella sale también el acta. Por eso solo ve los campos
 * clasificados "public" que además pueden ver todas las organizaciones de la
 * sala y todos los roles de la organización dueña. Un campo "restricted"
 * compartido con todos los roles sigue siendo interno: no sale a la pantalla general.
 */
export function canViewField(state: Pick<RoomState, "orgGenomes">, field: RoleVisibilityField, viewer: Viewer): boolean {
  if (viewer === "stage") {
    const owner = state.orgGenomes.find((genome) => genome.orgId === field.ownerOrgId);
    return (
      field.classification === "public" &&
      state.orgGenomes.every((genome) => field.visibleToOrgIds.includes(genome.orgId)) &&
      !!owner &&
      owner.roles.every((role) => field.visibleToRoleIds.includes(role.id))
    );
  }
  return field.visibleToOrgIds.includes(viewer.orgId) && field.visibleToRoleIds.includes(viewer.roleId);
}

/** Clave del campo del genoma que resguarda el costo de cobertura de un candidato. */
export const COVERAGE_COST_FIELD_KEY = "coverage_cost";

/**
 * El costo de cobertura de un candidato lo ve solo su organización
 * (coverageCostVisibleToOrgs) y, dentro de ella, solo los roles que pueden ver el
 * campo "coverage_cost" del genoma. Así el rol clínico de la misma organización
 * tampoco lo recibe por esta vía.
 */
export function canViewCoverageCost(state: Pick<RoomState, "orgGenomes">, candidate: OrgCandidate, viewer: Viewer): boolean {
  if (viewer === "stage") return false;
  if (viewer.orgId !== candidate.orgId || !candidate.coverageCostVisibleToOrgs.includes(viewer.orgId)) return false;
  const guard = state.orgGenomes.find((genome) => genome.orgId === candidate.orgId)?.fields.find((field) => field.key === COVERAGE_COST_FIELD_KEY);
  return guard ? canViewField(state, guard, viewer) : true;
}

function projectField(state: RoomState, field: RoleVisibilityField, viewer: Viewer): ProjectedField {
  if (canViewField(state, field, viewer)) return { ...field, redacted: false };
  return {
    key: field.key,
    label: field.label,
    ...(field.unit !== undefined ? { unit: field.unit } : {}),
    ownerOrgId: field.ownerOrgId,
    ownerRoleId: field.ownerRoleId,
    classification: field.classification,
    redacted: true,
    reason: "RBAC_SERVER_FILTERED",
  };
}

function projectCandidate(state: RoomState, candidate: OrgCandidate, viewer: Viewer): ProjectedCandidate {
  // Se construye campo por campo: coverageCostVisibleToOrgs no sale, y el costo solo con permiso.
  return {
    orgId: candidate.orgId,
    caseId: candidate.caseId,
    patientLabel: candidate.patientLabel,
    clinicalSeverityScore: candidate.clinicalSeverityScore,
    timeCriticality: candidate.timeCriticality,
    delayRiskScore: candidate.delayRiskScore,
    unmetNeedScore: candidate.unmetNeedScore,
    proposerRoleId: candidate.proposerRoleId,
    submitted: candidate.submitted === true,
    coverageCost: canViewCoverageCost(state, candidate, viewer) ? candidate.coverageCost : { redacted: true, reason: "RBAC_SERVER_FILTERED" },
  };
}

/** true si el asiento lo tiene un bot del piloto automático. */
export function isBotSeat(state: Pick<RoomState, "botSeats">, actor: ActorRef): boolean {
  return (state.botSeats ?? []).some((seat) => seat.orgId === actor.orgId && seat.roleId === actor.roleId);
}

/** Un asiento bot cuenta como conectado toda la ronda, aunque el piloto ya haya terminado sus pasos. */
function isConnected(state: RoomState, actor: ActorRef, nowTs: number): boolean {
  if (isBotSeat(state, actor)) return true;
  return state.connectedPlayers.some(
    (player) => player.orgId === actor.orgId && player.roleId === actor.roleId && nowTs - player.heartbeatMs < PRESENCE_TTL_MS,
  );
}

/**
 * Arma lo que recibe un viewer. Es la ÚNICA salida de estado hacia clientes.
 * Permiso doble (organización y rol): el valor de un campo ajeno y el costo de
 * cobertura de otra organización se eliminan aquí, así que no viajan por la red.
 * Un viewer desconocido recibe la vista de pantalla general.
 */
export function projectStateForOrgAndRole(state: RoomState, viewer: Viewer, nowTs: number): ProjectedRoomState {
  const safeViewer = normalizeViewer(state, viewer);

  const orgs: ProjectedOrg[] = state.orgGenomes.map((genome) => ({
    orgId: genome.orgId,
    orgName: genome.orgName,
    industry: genome.industry,
    orgStyle: genome.orgStyle,
    authorityRule: genome.authorityRule,
    liveCase: genome.liveCase,
    roles: genome.roles.map((role) => {
      const seat = { orgId: genome.orgId, roleId: role.id };
      return { ...role, connected: isConnected(state, seat, nowTs), bot: isBotSeat(state, seat) };
    }),
    fields: genome.fields.map((field) => projectField(state, field, safeViewer)),
    conflict: detectRuleConflict(genome.authorityRule),
    gate: evaluateGate(genome, genome.liveCase.proposedValue, gateDecisionOf(state, genome.orgId)),
    reliability: computeReliabilityPn(genome),
  }));

  return {
    roomId: state.roomId,
    version: state.version,
    mode: state.mode,
    ...(state.scenarioId !== undefined ? { scenarioId: state.scenarioId } : {}),
    demo: state.demo === true,
    viewer: safeViewer,
    serverNowTs: nowTs,
    orgs,
    scarcity: state.scarcity
      ? {
          resource: state.scarcity.resource,
          rule: state.scarcity.rule,
          candidates: state.scarcity.candidates.map((candidate) => projectCandidate(state, candidate, safeViewer)),
          arbiter: { ...state.scarcity.arbiter, connected: isConnected(state, state.scarcity.arbiter, nowTs), bot: isBotSeat(state, state.scarcity.arbiter) },
          deadlineLabel: state.scarcity.deadlineLabel,
          stakesLabel: state.scarcity.stakesLabel,
        }
      : null,
    allocation: buildAllocationView(state),
    crossOrgReliability: state.scarcity ? computeCrossOrgReliabilityPn(state) : null,
    stakes: computeSharedStakesCounter(state, nowTs),
    gateStatus: computeRoomGateStatus(state),
    allocationStatus: state.allocationStatus,
    decisions: state.decisions,
    connectedPlayers: state.connectedPlayers
      .filter((player) => nowTs - player.heartbeatMs < PRESENCE_TTL_MS)
      .map((player) => ({ orgId: player.orgId, roleId: player.roleId })),
    auditLog: state.auditLog.slice(-PROJECTED_AUDIT_LIMIT),
    telemetry: state.telemetry,
    caseOpenedAt: state.caseOpenedAt,
    decisionSealedAt: state.decisionSealedAt,
  };
}

// --- Cambios de estado ---------------------------------------------------------
//
// Cada función recibe el estado, quién actúa y el reloj del servidor, y devuelve
// un estado nuevo o un rechazo. commit agrega los eventos a la bitácora, registra
// las transiciones (choque detectado, compuerta bloqueada), recalcula el estado
// de compuerta de la sala y sube la versión.

/** Eventos que nunca se descartan: son la decisión misma y su rastro. */
const PROTECTED_AUDIT_TYPES: ReadonlySet<AuditEventType> = new Set<AuditEventType>([
  "ROOM_CREATED",
  "HITL_APPROVED",
  "HITL_VETOED",
  "COUNTER_PROPOSED",
  "CANDIDATE_SUBMITTED",
  "ALLOCATION_PROPOSED",
  "ALLOCATION_SEALED",
  "STAKES_CONTAINED",
]);

/**
 * Mantiene la bitácora dentro de sus topes sin perder lo importante:
 *   1. Los AUTH_FAILED tienen cupo propio (los provoca cualquiera sin token).
 *   2. Sobre el tope general se descartan primero los eventos de rutina más
 *      antiguos; las decisiones y su rastro se conservan.
 * Devuelve cuántos eventos se descartaron, para que el acta lo declare.
 */
export function trimAudit(events: AuditEvent[]): { events: AuditEvent[]; dropped: number } {
  let kept = events;
  let authExcess = kept.reduce((count, event) => count + (event.type === "AUTH_FAILED" ? 1 : 0), 0) - MAX_AUTH_FAILED_EVENTS;
  if (authExcess > 0) kept = kept.filter((event) => !(event.type === "AUTH_FAILED" && authExcess-- > 0));
  let excess = kept.length - MAX_AUDIT_EVENTS;
  if (excess > 0) kept = kept.filter((event) => PROTECTED_AUDIT_TYPES.has(event.type) || excess-- <= 0);
  // Última defensa: ni siquiera los eventos protegidos crecen sin límite.
  if (kept.length > MAX_AUDIT_EVENTS * 2) kept = kept.slice(-MAX_AUDIT_EVENTS * 2);
  return { events: kept, dropped: events.length - kept.length };
}

function commit(prev: RoomState, next: RoomState, events: NewEvent[], nowTs: number): RoomState {
  const derived: NewEvent[] = [];
  for (const genome of next.orgGenomes) {
    const before = findGenome(prev, genome.orgId);
    const conflict = detectRuleConflict(genome.authorityRule);
    if (conflict.hasConflict && !(before && detectRuleConflict(before.authorityRule).hasConflict)) {
      derived.push({
        type: "CONFLICT_DETECTED",
        orgId: genome.orgId,
        detail: { ruleId: genome.authorityRule.id, proposerLimit: genome.authorityRule.proposerLimit, approverLimit: genome.authorityRule.approverLimit, delta: conflict.delta },
      });
    }
    const gate = evaluateGate(genome, genome.liveCase.proposedValue, gateDecisionOf(next, genome.orgId));
    const gateBefore = before ? evaluateGate(before, before.liveCase.proposedValue, gateDecisionOf(prev, before.orgId)) : null;
    if (gate.status !== gateBefore?.status && (gate.status === "BLOCKED_HITL_REQUIRED" || gate.status === "AUTO_EXECUTED_UNSAFE")) {
      derived.push({
        type: "GATE_BLOCKED",
        orgId: genome.orgId,
        detail: {
          gateStatus: gate.status,
          proposedValue: gate.proposedValue,
          threshold: gate.effectiveThreshold,
          pendingApproverRoleId: gate.pendingApproverRoleId,
          executedWithoutSignature: gate.status === "AUTO_EXECUTED_UNSAFE",
        },
      });
    }
  }
  const auditLog = [
    ...next.auditLog,
    ...[...events, ...derived].map((event): AuditEvent => ({
      ts: nowTs,
      type: event.type,
      ...(event.orgId !== undefined ? { orgId: event.orgId } : {}),
      ...(event.roleId !== undefined ? { roleId: event.roleId } : {}),
      detail: event.detail ?? {},
    })),
  ];
  const trimmed = trimAudit(auditLog);
  const committed: RoomState = {
    ...next,
    auditLog: trimmed.events,
    version: prev.version + 1,
    ...(trimmed.dropped > 0 ? { auditDropped: (next.auditDropped ?? 0) + trimmed.dropped } : {}),
  };
  return { ...committed, gateStatus: computeRoomGateStatus(committed) };
}

/** Rechazo 403 que queda en la bitácora con fecha, organización, rol y regla. */
function deny(state: RoomState, actor: ActorRef, nowTs: number, action: string, rule: string, message: string, extra: Record<string, unknown> = {}): EngineFailure {
  const logged = commit(state, state, [{ type: "RBAC_DENIED", orgId: actor.orgId, roleId: actor.roleId, detail: { status: 403, action, rule, actor: actorTitle(state, actor), ...extra } }], nowTs);
  return fail(403, "RBAC_DENIED", message, logged);
}

/**
 * Estado inicial de una sala recién creada: registra ROOM_CREATED y deja en la
 * bitácora el choque y la compuerta con que parte el caso.
 */
export function openRoom(state: RoomState, nowTs: number): RoomState {
  const blank: RoomState = { ...state, orgGenomes: [], auditLog: [], version: 0 };
  const opened = commit(blank, { ...state, auditLog: [] }, [{ type: "ROOM_CREATED", detail: { roomId: state.roomId, mode: state.mode, orgIds: state.orgGenomes.map((genome) => genome.orgId) } }], nowTs);
  return { ...opened, version: 0 };
}

function withoutSeat(seats: ActorRef[] | undefined, actor: ActorRef): ActorRef[] {
  return (seats ?? []).filter((seat) => !(seat.orgId === actor.orgId && seat.roleId === actor.roleId));
}

/**
 * Marca un rol como presente. El Comité (rol por QR o árbitro) queda como
 * QR_JOINED. extra se agrega al detalle del evento: el ensayo automático marca
 * { bot: true } para que la bitácora diga que no fue una persona.
 */
export function markRoleJoined(state: RoomState, actor: ActorRef, nowTs: number, extra: Record<string, unknown> = {}): EngineResult {
  if (!isKnownActor(state, actor)) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  const viaQr = isArbiter(state, actor) || findRole(state, actor)?.role.isQrOptional === true;
  const players = state.connectedPlayers.filter((player) => !(player.orgId === actor.orgId && player.roleId === actor.roleId));
  const bot = extra.bot === true;
  // Un bot queda marcado en botSeats; una persona que entra a ese asiento lo desmarca.
  // El reloj de espera arranca con la primera persona, nunca con un bot.
  const botSeats = [...withoutSeat(state.botSeats, actor), ...(bot ? [{ orgId: actor.orgId, roleId: actor.roleId }] : [])];
  const next: RoomState = {
    ...state,
    connectedPlayers: [...players, { orgId: actor.orgId, roleId: actor.roleId, heartbeatMs: nowTs }],
    ...(bot || state.botSeats !== undefined ? { botSeats } : {}),
    ...(!bot && state.clockStartedAt === null ? { clockStartedAt: nowTs } : {}),
  };
  return { ok: true, state: commit(state, next, [{ type: viaQr ? "QR_JOINED" : "ROLE_JOINED", orgId: actor.orgId, roleId: actor.roleId, detail: { title: actorTitle(state, actor), ...extra } }], nowTs) };
}

/** Marca un rol como ausente. extra se agrega al detalle (por ejemplo, { revokedByHost: true }). */
export function markRoleLeft(state: RoomState, actor: ActorRef, nowTs: number, extra: Record<string, unknown> = {}): EngineResult {
  if (!isKnownActor(state, actor)) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  const next: RoomState = {
    ...state,
    connectedPlayers: state.connectedPlayers.filter((player) => !(player.orgId === actor.orgId && player.roleId === actor.roleId)),
    ...(state.botSeats !== undefined ? { botSeats: withoutSeat(state.botSeats, actor) } : {}),
  };
  return { ok: true, state: commit(state, next, [{ type: "ROLE_LEFT", orgId: actor.orgId, roleId: actor.roleId, detail: { title: actorTitle(state, actor), ...extra } }], nowTs) };
}

/** Deja en la bitácora un hito del ensayo automático (inicio, paso o fin). No cambia nada más. */
export function recordAutopilotEvent(state: RoomState, detail: Record<string, unknown>, nowTs: number): RoomState {
  return commit(state, state, [{ type: "AUTOPILOT", detail }], nowTs);
}

/** Mantiene vivas en la lista de presentes a las sillas que maneja un bot del ensayo. */
export function refreshPresence(state: RoomState, seats: ActorRef[], nowTs: number): RoomState {
  const keys = new Set(seats.map((seat) => `${seat.orgId}:${seat.roleId}`));
  return {
    ...state,
    connectedPlayers: state.connectedPlayers.map((player) => (keys.has(`${player.orgId}:${player.roleId}`) ? { ...player, heartbeatMs: nowTs } : player)),
  };
}

/** Deja en la bitácora un intento de actuar sin identidad válida. No revela nada más. */
export function recordAuthFailure(state: RoomState, actor: ActorRef, reason: string, nowTs: number): RoomState {
  return commit(state, state, [{ type: "AUTH_FAILED", orgId: actor.orgId, roleId: actor.roleId, detail: { reason } }], nowTs);
}

/**
 * Mueve el límite de autoridad de quien actúa: el proponente mueve
 * proposerLimit, el aprobador approverLimit. Mover un límite reabre la regla
 * (borra el umbral sellado). No se puede después de la decisión.
 */
export function updateAuthoritySlider(state: RoomState, actor: ActorRef, value: number, nowTs: number): EngineResult {
  const found = findRole(state, actor);
  if (!found) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  const rule = found.genome.authorityRule;
  const side = actor.roleId === rule.proposerRoleId ? "proposerLimit" : actor.roleId === rule.approverRoleId ? "approverLimit" : null;
  if (!side) return deny(state, actor, nowTs, "UPDATE_AUTHORITY_SLIDER", "solo proponente o aprobador mueven su propio límite", "Solo el proponente y el aprobador pueden mover su límite de autoridad");
  if (gateDecisionOf(state, actor.orgId)) return fail(409, "DECISION_SEALED", "La decisión ya se selló: la regla no se puede cambiar");
  if (!Number.isFinite(value) || value < rule.min || value > rule.max) return fail(400, "INVALID_VALUE", `El límite debe estar entre ${rule.min} y ${rule.max}`);

  const genome: OrgGenome = { ...found.genome, authorityRule: { ...rule, [side]: value, sealedThreshold: null } };
  const event: NewEvent = { type: "MUTATION", orgId: actor.orgId, roleId: actor.roleId, detail: { change: side, from: rule[side], to: value, reopenedRule: rule.sealedThreshold !== null } };
  return { ok: true, state: commit(state, replaceGenome(state, genome), [event], nowTs) };
}

/**
 * Alterna un campo entre reservado (solo el rol dueño) y compartido (todos los
 * roles de su organización). Solo el rol dueño. No cambia qué organizaciones lo ven.
 */
export function toggleFieldSecret(state: RoomState, actor: ActorRef, fieldKey: string, nowTs: number): EngineResult {
  const found = findRole(state, actor);
  if (!found) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  const field = found.genome.fields.find((candidate) => candidate.key === fieldKey);
  if (!field) return fail(404, "FIELD_NOT_FOUND", `El campo ${fieldKey} no existe en ${actor.orgId}`);
  if (field.ownerRoleId !== actor.roleId) {
    return deny(state, actor, nowTs, "TOGGLE_FIELD_SECRET", "solo el rol dueño cambia la visibilidad de su campo", "Solo el rol dueño del campo puede cambiar su visibilidad", { fieldKey, fieldLabel: field.label });
  }
  const reserved = field.visibleToRoleIds.length === 1;
  const updated: RoleVisibilityField = reserved
    ? { ...field, visibleToRoleIds: found.genome.roles.map((role) => role.id), classification: "restricted" }
    : { ...field, visibleToRoleIds: [field.ownerRoleId], classification: "secret" };
  const genome: OrgGenome = { ...found.genome, fields: found.genome.fields.map((candidate) => (candidate.key === fieldKey ? updated : candidate)) };
  const event: NewEvent = {
    type: "MUTATION",
    orgId: actor.orgId,
    roleId: actor.roleId,
    detail: { change: "fieldVisibility", fieldKey, fieldLabel: field.label, visibleToRoleIds: updated.visibleToRoleIds, classification: updated.classification },
  };
  return { ok: true, state: commit(state, replaceGenome(state, genome), [event], nowTs) };
}

/**
 * Sella la regla de autoridad: fija el umbral y el modo de compuerta. Solo
 * proponente o aprobador. El umbral no puede superar lo que reconoce el
 * aprobador: si el aprobador quiere ceder, primero sube su propio límite.
 */
export function sealRule(state: RoomState, actor: ActorRef, input: { threshold?: number; gateMode?: GateMode }, nowTs: number): EngineResult {
  const found = findRole(state, actor);
  if (!found) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  const rule = found.genome.authorityRule;
  if (actor.roleId !== rule.proposerRoleId && actor.roleId !== rule.approverRoleId) {
    return deny(state, actor, nowTs, "SEAL_RULE", "solo proponente o aprobador sellan la regla", "Solo el proponente y el aprobador pueden sellar la regla");
  }
  if (gateDecisionOf(state, actor.orgId)) return fail(409, "DECISION_SEALED", "La decisión ya se selló: la regla no se puede cambiar");
  const threshold = input.threshold ?? Math.min(rule.proposerLimit, rule.approverLimit);
  if (!Number.isFinite(threshold) || threshold < rule.min || threshold > rule.max) return fail(400, "INVALID_VALUE", `El umbral debe estar entre ${rule.min} y ${rule.max}`);
  if (threshold > rule.approverLimit) return fail(400, "INVALID_VALUE", `El umbral no puede superar el límite del aprobador (${rule.approverLimit}${rule.unit})`);

  const gateMode = input.gateMode ?? rule.gateMode;
  const genome: OrgGenome = { ...found.genome, authorityRule: { ...rule, sealedThreshold: threshold, gateMode } };
  const event: NewEvent = { type: "RULE_SEALED", orgId: actor.orgId, roleId: actor.roleId, detail: { ruleId: rule.id, threshold, unit: rule.unit, gateMode } };
  return { ok: true, state: commit(state, replaceGenome(state, genome), [event], nowTs) };
}

/**
 * Intento de lectura de un campo. Con permiso devuelve el valor. Sin permiso
 * devuelve 403 RBAC_DENIED y lo deja en la bitácora con fecha, organización,
 * rol y la regla que lo impidió. Sirve dentro de una organización y entre organizaciones.
 */
export function attemptProtectedRead(
  state: RoomState,
  requester: ActorRef,
  target: { orgId?: string; fieldKey: string },
  nowTs: number,
): EngineResult<{ value: string | number }> {
  if (!isKnownActor(state, requester)) return fail(404, "ROLE_NOT_FOUND", `El rol ${requester.roleId} no existe en ${requester.orgId}`);
  const targetOrgId = target.orgId ?? requester.orgId;
  const field = findGenome(state, targetOrgId)?.fields.find((candidate) => candidate.key === target.fieldKey);
  if (!field) return fail(404, "FIELD_NOT_FOUND", `El campo ${target.fieldKey} no existe en ${targetOrgId}`);
  if (canViewField(state, field, requester)) return { ok: true, state, value: field.value };

  const orgAllowed = field.visibleToOrgIds.includes(requester.orgId);
  return deny(
    state,
    requester,
    nowTs,
    "READ_FIELD",
    orgAllowed ? "visibleToRoleIds: el rol no está autorizado" : "visibleToOrgIds: la organización no está autorizada",
    orgAllowed ? "Este rol no tiene permiso para leer el campo" : "Esta organización no tiene permiso para leer el campo",
    { fieldKey: field.key, fieldLabel: field.label, targetOrgId, classification: field.classification, crossOrg: targetOrgId !== requester.orgId },
  );
}

export type GateDecisionInput = { decision: HumanDecision["decision"]; reason: string; counterValue?: number };

/**
 * Decisión humana sobre la compuerta de la organización de quien actúa. Solo el
 * aprobador o el Comité. Exige razón, regla sin choque pendiente y compuerta
 * bloqueada. La decisión es definitiva. En single_org detiene el contador.
 */
export function recordGateDecision(state: RoomState, actor: ActorRef, input: GateDecisionInput, nowTs: number): EngineResult {
  const found = findRole(state, actor);
  if (!found) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  const { genome } = found;
  const rule = genome.authorityRule;
  const gate = evaluateGate(genome, genome.liveCase.proposedValue, gateDecisionOf(state, genome.orgId));
  if (!gate.deciderRoleIds.includes(actor.roleId)) {
    return deny(state, actor, nowTs, "HITL_DECISION", "solo el aprobador o el Comité firman la compuerta", "Solo el aprobador o el Comité pueden decidir sobre la compuerta");
  }
  const reason = input.reason.trim();
  if (!reason) return fail(400, "REASON_REQUIRED", "La razón es obligatoria");
  if (gate.status === "SEALED") return fail(409, "DECISION_SEALED", "La decisión ya se selló y no se puede cambiar");
  if (detectRuleConflict(rule).hasConflict) return fail(409, "RULE_NOT_SEALED", "Hay un choque de autoridad sin resolver: primero hay que sellar la regla");
  if (gate.status !== "BLOCKED_HITL_REQUIRED") {
    return fail(409, "GATE_NOT_BLOCKED", gate.status === "OPEN" ? "La compuerta está abierta: no hay nada que firmar" : "La compuerta está en modo autónomo: se ejecutó sin pedir firma");
  }

  let nextGenome = genome;
  if (input.decision === "COUNTER_PROPOSE") {
    const counter = input.counterValue;
    if (counter === undefined || !Number.isFinite(counter) || counter < rule.min || counter > gate.effectiveThreshold) {
      return fail(400, "INVALID_VALUE", `La contrapropuesta debe estar entre ${rule.min} y el umbral (${gate.effectiveThreshold}${rule.unit})`);
    }
    nextGenome = { ...genome, liveCase: { ...genome.liveCase, proposedValue: counter } };
  }

  const decision: HumanDecision = {
    scope: "gate",
    targetOrgId: genome.orgId,
    decision: input.decision,
    reason,
    ...(input.decision === "COUNTER_PROPOSE" ? { counterValue: input.counterValue } : {}),
    byOrgId: actor.orgId,
    byRoleId: actor.roleId,
    ts: nowTs,
  };
  const type: AuditEventType = input.decision === "APPROVE" ? "HITL_APPROVED" : input.decision === "VETO" ? "HITL_VETOED" : "COUNTER_PROPOSED";
  const events: NewEvent[] = [
    {
      type,
      orgId: actor.orgId,
      roleId: actor.roleId,
      detail: { scope: "gate", by: found.role.title, reason, proposedValue: genome.liveCase.proposedValue, threshold: gate.effectiveThreshold, ...(decision.counterValue !== undefined ? { counterValue: decision.counterValue } : {}) },
    },
  ];
  let next: RoomState = { ...replaceGenome(state, nextGenome), decisions: [...state.decisions, decision] };
  if (state.mode === "single_org" && state.decisionSealedAt === null) {
    next = { ...next, decisionSealedAt: nowTs };
    events.push({ type: "STAKES_CONTAINED", orgId: actor.orgId, detail: { timeToDecisionMs: waitedMs(state, nowTs) } });
  }
  return { ok: true, state: commit(state, next, events, nowTs) };
}

/**
 * Presenta el candidato de una organización al recurso escaso. Solo el rol
 * proponente de ese caso. Cuando todas presentaron, el algoritmo propone la
 * asignación (ALLOCATION_PROPOSED) y queda a la espera del Comité.
 */
export function submitCandidate(state: RoomState, actor: ActorRef, caseId: string | undefined, nowTs: number): EngineResult {
  if (!state.scarcity) return fail(409, "WRONG_MODE", "Esta sala no tiene un recurso compartido entre organizaciones");
  if (!isKnownActor(state, actor)) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  const candidate = state.scarcity.candidates.find((entry) => (caseId ? entry.caseId === caseId : entry.orgId === actor.orgId));
  if (!candidate) return fail(404, "CANDIDATE_NOT_FOUND", caseId ? `El caso ${caseId} no existe` : `${actor.orgId} no tiene un candidato en esta sala`);
  if (candidate.orgId !== actor.orgId || candidate.proposerRoleId !== actor.roleId) {
    return deny(state, actor, nowTs, "SUBMIT_CANDIDATE", "solo el rol proponente de la organización presenta su caso", "Solo el rol proponente de la organización puede presentar su caso", { caseId: candidate.caseId });
  }
  if (state.allocationStatus === "SEALED") return fail(409, "DECISION_SEALED", "La asignación ya se selló");
  if (candidate.submitted === true) return { ok: true, state };

  const scarcity: SharedScarcity = {
    ...state.scarcity,
    candidates: state.scarcity.candidates.map((entry) => (entry.caseId === candidate.caseId ? { ...entry, submitted: true } : entry)),
  };
  let next: RoomState = { ...state, scarcity };
  const events: NewEvent[] = [{ type: "CANDIDATE_SUBMITTED", orgId: actor.orgId, roleId: actor.roleId, detail: { caseId: candidate.caseId, patientLabel: candidate.patientLabel } }];
  const resolution = resolveRoomAllocation(next)!;
  if (resolution.pendingCaseIds.length === 0 && state.allocationStatus !== "PROPOSED") {
    next = { ...next, allocationStatus: "PROPOSED" };
    events.push(allocationProposedEvent(resolution));
  }
  return { ok: true, state: commit(state, next, events, nowTs) };
}

function allocationProposedEvent(resolution: AllocationResolution): NewEvent {
  return {
    type: "ALLOCATION_PROPOSED",
    detail: {
      winnerCaseId: resolution.winnerCaseId,
      winnerOrgId: resolution.winnerOrgId,
      ranking: resolution.ranking.map((entry) => ({ rank: entry.rank, caseId: entry.caseId, orgId: entry.orgId, score: entry.score })),
      tieBreakApplied: resolution.tieBreakApplied,
      tieBreakRule: resolution.tieBreakRule,
      scoreGap: resolution.scoreGap,
      explanation: resolution.explanation,
    },
  };
}

export type CommitteeDecisionInput = { decision: "APPROVE" | "VETO"; reason: string };

/**
 * Decisión del Comité, con razón obligatoria.
 *   - Comité árbitro (cross_org), sobre la asignación propuesta:
 *       APPROVE sella la asignación y detiene el contador.
 *       VETO saca al ganador propuesto y el algoritmo vuelve a ordenar. No se
 *       puede vetar al último candidato: el recurso no puede quedar sin asignar.
 *   - Comité de una organización: decide la compuerta de su organización
 *     (igual que recordGateDecision).
 * Cualquier otro rol recibe 403 y queda en la bitácora.
 */
export function recordCommitteeDecision(state: RoomState, actor: ActorRef, input: CommitteeDecisionInput, nowTs: number): EngineResult {
  if (!isArbiter(state, actor)) {
    const found = findRole(state, actor);
    if (!found) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
    if (found.role.id !== committeeRoleOf(found.genome)?.id) {
      return deny(state, actor, nowTs, "COMMITTEE_DECISION", "solo el Comité aprueba o veta", "Solo el Comité puede tomar esta decisión");
    }
    return recordGateDecision(state, actor, input, nowTs);
  }

  const reason = input.reason.trim();
  if (!reason) return fail(400, "REASON_REQUIRED", "La razón es obligatoria");
  if (state.allocationStatus === "SEALED") return fail(409, "DECISION_SEALED", "La asignación ya se selló y no se puede cambiar");
  const resolution = resolveRoomAllocation(state)!;
  const winner = resolution.ranking.find((entry) => entry.caseId === resolution.winnerCaseId);
  if (state.allocationStatus !== "PROPOSED" || !winner) {
    return fail(409, "ALLOCATION_NOT_READY", "Todavía no hay una asignación propuesta: faltan candidatos por presentar");
  }
  const title = state.scarcity!.arbiter.title;
  const decision: HumanDecision = { scope: "allocation", targetCaseId: winner.caseId, decision: input.decision, reason, byOrgId: actor.orgId, byRoleId: actor.roleId, ts: nowTs };

  if (input.decision === "APPROVE") {
    const next: RoomState = { ...state, decisions: [...state.decisions, decision], allocationStatus: "SEALED", decisionSealedAt: nowTs };
    const events: NewEvent[] = [
      {
        type: "ALLOCATION_SEALED",
        orgId: actor.orgId,
        roleId: actor.roleId,
        detail: { by: title, reason, winnerCaseId: winner.caseId, winnerOrgId: winner.orgId, patientLabel: winner.patientLabel, score: winner.score, tieBreakApplied: resolution.tieBreakApplied, tieBreakRule: resolution.tieBreakRule },
      },
      { type: "STAKES_CONTAINED", detail: { timeToDecisionMs: waitedMs(state, nowTs) } },
    ];
    return { ok: true, state: commit(state, next, events, nowTs) };
  }

  if (resolution.ranking.length < 2) {
    return fail(409, "ALLOCATION_NOT_READY", "No se puede vetar al último candidato: el recurso no puede quedar sin asignar");
  }
  const next: RoomState = { ...state, decisions: [...state.decisions, decision] };
  const events: NewEvent[] = [
    { type: "HITL_VETOED", orgId: actor.orgId, roleId: actor.roleId, detail: { scope: "allocation", by: title, reason, vetoedCaseId: winner.caseId, vetoedOrgId: winner.orgId } },
    allocationProposedEvent(resolveRoomAllocation(next)!),
  ];
  return { ok: true, state: commit(state, next, events, nowTs) };
}

/** Sella la asignación propuesta. Solo el Comité árbitro. */
export function sealAllocation(state: RoomState, actor: ActorRef, reason: string, nowTs: number): EngineResult {
  if (!state.scarcity) return fail(409, "WRONG_MODE", "Esta sala no tiene un recurso compartido entre organizaciones");
  if (!isKnownActor(state, actor)) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  if (!isArbiter(state, actor)) return deny(state, actor, nowTs, "ALLOCATION_SEAL", "solo el Comité árbitro sella la asignación", "Solo el Comité árbitro puede sellar la asignación");
  return recordCommitteeDecision(state, actor, { decision: "APPROVE", reason }, nowTs);
}

export type AgentProposalInput = {
  /** Valor que sugiere el agente para la métrica del caso. */
  suggestedValue: number | null;
  /** Clave de un campo que el agente intentó leer, si lo hizo. */
  attemptedFieldRead: string | null;
  /**
   * Organización dueña de ese campo. La misma clave puede existir en varias
   * organizaciones ("coverage_cost"), así que sin este dato se asume la propia.
   */
  attemptedFieldOrgId?: string | null;
  source: "model" | "fallback";
};

/**
 * Registra la propuesta que una persona le pidió a su agente. El texto de la
 * propuesta NO entra aquí ni a la bitácora: puede citar datos reservados del rol.
 *   - Si quien la pidió es el proponente y aún no hay decisión, el valor sugerido
 *     pasa a ser el valor propuesto del caso (acotado a min y max) y la compuerta
 *     se vuelve a evaluar.
 *   - Si el agente intentó leer un campo sin permiso, queda como 403 en la bitácora.
 */
export function applyAgentProposal(state: RoomState, actor: ActorRef, input: AgentProposalInput, nowTs: number): EngineResult<{ appliedValue: number | null; deniedFieldKey: string | null }> {
  const found = findRole(state, actor);
  if (!found) return fail(404, "ROLE_NOT_FOUND", `El rol ${actor.roleId} no existe en ${actor.orgId}`);
  const { genome, role } = found;
  const rule = genome.authorityRule;

  let appliedValue: number | null = null;
  let next = state;
  const canPropose = actor.roleId === rule.proposerRoleId && !gateDecisionOf(state, genome.orgId);
  if (canPropose && input.suggestedValue !== null && Number.isFinite(input.suggestedValue)) {
    appliedValue = Math.min(rule.max, Math.max(rule.min, input.suggestedValue));
    next = replaceGenome(state, { ...genome, liveCase: { ...genome.liveCase, proposedValue: appliedValue } });
  }
  let committed = commit(
    state,
    next,
    [{ type: "AGENT_PROPOSED", orgId: actor.orgId, roleId: actor.roleId, detail: { agentName: role.agentName, requestedBy: role.title, source: input.source, metricKey: rule.metricKey, appliedValue } }],
    nowTs,
  );

  let deniedFieldKey: string | null = null;
  if (input.attemptedFieldRead) {
    const key = input.attemptedFieldRead;
    const hasKey = (candidate: OrgGenome) => candidate.fields.some((field) => field.key === key);
    // Si el agente dijo de qué organización es el campo, se evalúa contra esa. Si no, primero la propia.
    const named = input.attemptedFieldOrgId ? findGenome(state, input.attemptedFieldOrgId) : undefined;
    const owner = named && hasKey(named) ? named : [genome, ...state.orgGenomes.filter((other) => other.orgId !== genome.orgId)].find(hasKey);
    if (owner) {
      const read = attemptProtectedRead(committed, actor, { orgId: owner.orgId, fieldKey: key }, nowTs);
      if (!read.ok && read.state) {
        committed = read.state;
        deniedFieldKey = key;
      }
    }
  }
  return { ok: true, state: committed, appliedValue, deniedFieldKey };
}

/**
 * Reemplaza el genoma de una sala single_org por otro ya validado (mutación).
 * Es un caso nuevo: se reinician reloj, decisiones y presencia.
 */
export function replaceRoomGenome(state: RoomState, genome: OrgGenome, source: string, nowTs: number): EngineResult {
  if (state.mode !== "single_org") return fail(409, "WRONG_MODE", "Solo se puede mutar una sala de una sola organización");
  const next: RoomState = { ...state, orgGenomes: [genome], decisions: [], connectedPlayers: [], caseOpenedAt: nowTs, ...(state.clockStartedAt !== undefined ? { clockStartedAt: null } : {}), botSeats: undefined, decisionSealedAt: null };
  const event: NewEvent = { type: "MUTATION", orgId: genome.orgId, detail: { change: "genome", orgName: genome.orgName, industry: genome.industry, source } };
  // Se compara contra una sala sin organizaciones para que el choque y la compuerta del caso nuevo queden en la bitácora.
  const committed = commit({ ...state, orgGenomes: [] }, next, [event], nowTs);
  return { ok: true, state: committed };
}

// --- Acta ---------------------------------------------------------------------

export type AuditActa = {
  product: "Nexo";
  disclaimer: string;
  roomId: string;
  mode: RoomState["mode"];
  generatedAt: string;
  caseOpenedAt: string;
  decisionSealedAt: string | null;
  timeToDecisionMs: number | null;
  stakes: StakesView;
  gateStatus: GateStatus;
  allocationStatus: RoomState["allocationStatus"];
  organizations: {
    orgId: string;
    orgName: string;
    industry: string;
    caseTitle: string;
    roles: { id: string; title: string }[];
    authorityRule: AuthorityRule;
    conflict: ConflictView;
    gate: GateView;
    reliability: ReliabilityView;
  }[];
  resource: { label: string; rule: AllocationRule; arbiter: string } | null;
  allocation: AllocationView | null;
  crossOrgReliability: ReliabilityView | null;
  /** Decisiones humanas, con su razón. */
  decisions: HumanDecision[];
  /** Bitácora en orden. Completa salvo que auditLogDropped sea mayor que 0. */
  auditLog: AuditEvent[];
  /** Eventos de rutina antiguos descartados por el tope de memoria. Las decisiones nunca se descartan. */
  auditLogDropped: number;
  telemetry: RoomState["telemetry"];
  notes: string[];
};

/**
 * Acta de la decisión con la bitácora completa. Se arma desde la vista de
 * pantalla general, así que no contiene ningún valor reservado y se puede exportar.
 */
export function buildAuditActa(state: RoomState, nowTs: number): AuditActa {
  const view = projectStateForOrgAndRole(state, "stage", nowTs);
  return {
    product: "Nexo",
    disclaimer: ACTA_DISCLAIMER,
    roomId: state.roomId,
    mode: state.mode,
    generatedAt: new Date(nowTs).toISOString(),
    caseOpenedAt: new Date(state.caseOpenedAt).toISOString(),
    decisionSealedAt: state.decisionSealedAt === null ? null : new Date(state.decisionSealedAt).toISOString(),
    timeToDecisionMs: view.stakes.timeToDecisionMs,
    stakes: view.stakes,
    gateStatus: view.gateStatus,
    allocationStatus: view.allocationStatus,
    organizations: view.orgs.map((org) => ({
      orgId: org.orgId,
      orgName: org.orgName,
      industry: org.industry,
      caseTitle: org.liveCase.title,
      roles: org.roles.map((role) => ({ id: role.id, title: role.title })),
      authorityRule: org.authorityRule,
      conflict: org.conflict,
      gate: org.gate,
      reliability: org.reliability,
    })),
    resource: view.scarcity ? { label: view.scarcity.rule.resourceLabel, rule: view.scarcity.rule, arbiter: view.scarcity.arbiter.title } : null,
    allocation: view.allocation,
    crossOrgReliability: view.crossOrgReliability,
    decisions: state.decisions,
    auditLog: state.auditLog,
    auditLogDropped: state.auditDropped ?? 0,
    telemetry: state.telemetry,
    notes: [
      "La asignación, los permisos, la compuerta y el contador los calcula código determinista; ningún modelo de lenguaje decide.",
      "La confiabilidad p^n es un modelo ilustrativo, no una medición.",
      "Los valores reservados de cada organización no aparecen en esta acta.",
      ...(state.auditDropped
        ? [`La bitácora superó el tope de memoria: se descartaron los ${state.auditDropped} eventos de rutina más antiguos. Las decisiones se conservan todas.`]
        : []),
    ],
  };
}

/** El acta en Markdown, para leer o imprimir. */
export function renderActaMarkdown(acta: AuditActa): string {
  const lines: string[] = [
    `# Acta de decisión · sala ${acta.roomId}`,
    "",
    `> ${acta.disclaimer}`,
    "",
    `- Generada: ${acta.generatedAt}`,
    `- Caso abierto: ${acta.caseOpenedAt}`,
    `- Decisión sellada: ${acta.decisionSealedAt ?? "pendiente"}`,
    `- Tiempo hasta la decisión: ${acta.timeToDecisionMs === null ? "pendiente" : `${Math.round(acta.timeToDecisionMs / 1000)} s`}`,
    `- Estado: ${acta.stakes.status} · compuerta ${acta.gateStatus}${acta.allocationStatus ? ` · asignación ${acta.allocationStatus}` : ""}`,
    `- Modelo: ${acta.telemetry.modelName} (${acta.telemetry.provider === "local" ? "local" : "nube"}, ${acta.telemetry.endpointHost}), ${acta.telemetry.bytesSentToCloud} bytes enviados a la nube`,
    "",
    "## Organizaciones",
  ];
  for (const org of acta.organizations) {
    lines.push(
      "",
      `### ${org.orgName} (${org.orgId})`,
      "",
      `- Caso: ${org.caseTitle}`,
      `- Regla: ${org.authorityRule.metricLabel}. ${org.conflict.message}`,
      `- Compuerta: ${org.gate.status}. ${oneLine(org.gate.message)}`,
      `- Confiabilidad vigente: ${percent(org.reliability.current)} (${org.reliability.currentMode === "hybrid" ? "híbrido" : "autónomo"}). ${org.reliability.formula}`,
    );
  }
  if (acta.allocation && acta.resource) {
    lines.push("", `## Asignación de ${acta.resource.label}`, "", `Árbitro: ${acta.resource.arbiter}. ${acta.allocation.explanation}`, "", "| # | Caso | Organización | Puntaje | Necesidad sin cubrir |", "| --- | --- | --- | --- | --- |");
    for (const entry of acta.allocation.ranking) {
      lines.push(`| ${entry.rank} | ${entry.patientLabel} (${entry.caseId}) | ${entry.orgId} | ${decimal(entry.score)} | ${decimal(entry.unmetNeedScore)} |`);
    }
    if (acta.allocation.vetoedCaseIds.length > 0) lines.push("", `Casos vetados por el Comité: ${acta.allocation.vetoedCaseIds.join(", ")}.`);
    if (acta.crossOrgReliability) lines.push("", `Confiabilidad de la cadena entre organizaciones: ${percent(acta.crossOrgReliability.current)}. ${acta.crossOrgReliability.formula}`);
  }
  lines.push("", "## Decisiones humanas", "");
  if (acta.decisions.length === 0) lines.push("Ninguna todavía.");
  for (const decision of acta.decisions) {
    const target = decision.scope === "gate" ? `compuerta de ${decision.targetOrgId}` : `asignación, caso ${decision.targetCaseId}`;
    lines.push(`- ${new Date(decision.ts).toISOString()} · ${decision.byOrgId}/${decision.byRoleId} · ${decision.decision} (${target}). Razón: ${oneLine(decision.reason)}`);
  }
  lines.push("", acta.auditLogDropped > 0 ? `## Bitácora (se descartaron ${acta.auditLogDropped} eventos de rutina antiguos)` : "## Bitácora completa", "", "| Hora (servidor) | Evento | Organización | Rol | Detalle |", "| --- | --- | --- | --- | --- |");
  for (const event of acta.auditLog) {
    const detail = JSON.stringify(event.detail).replaceAll("|", "\\|");
    lines.push(`| ${new Date(event.ts).toISOString()} | ${event.type} | ${event.orgId ?? ""} | ${event.roleId ?? ""} | ${detail} |`);
  }
  lines.push("", "## Notas", "", ...acta.notes.map((note) => `- ${note}`), "");
  return lines.join("\n");
}
