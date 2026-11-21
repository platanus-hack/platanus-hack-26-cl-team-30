// Contrato de datos de Nexo. Todo lo que entra al sistema (semillas o genomas
// generados por un modelo) se valida contra estos esquemas antes de usarse.
//
// Dos familias de tipos:
//   1. Estado del servidor (RoomState y sus partes): contiene los secretos.
//   2. Vista del cliente (Projected*): lo que emite el SSE para un viewer, con los
//      valores ocultos ya eliminados y los valores derivados que calcula el motor.
// El cliente solo debe importar los tipos Projected*.

import { z } from "zod";

// --- 2.1 Campos con visibilidad ---------------------------------------------

export const FieldClassificationSchema = z.enum(["public", "restricted", "secret"]);

export const RoleVisibilityFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  /** Organización dueña del dato. */
  ownerOrgId: z.string().min(1),
  /** Rol dueño dentro de la organización. */
  ownerRoleId: z.string().min(1),
  /** Permiso entre organizaciones: solo estas reciben el valor. */
  visibleToOrgIds: z.array(z.string()),
  /** Permiso dentro de la organización: solo estos roles reciben el valor. */
  visibleToRoleIds: z.array(z.string()),
  classification: FieldClassificationSchema,
});

// --- 2.2 Regla de autoridad (compuerta determinista) ---------------------------

export const GateModeSchema = z.enum(["deterministic_hitl", "agent_autonomous"]);

export const AuthorityRuleSchema = z.object({
  id: z.string().min(1),
  metricKey: z.string().min(1),
  metricLabel: z.string().min(1),
  unit: z.string(),
  min: z.number(),
  max: z.number(),
  proposerRoleId: z.string().min(1),
  /** Hasta dónde cree el proponente que puede decidir solo. */
  proposerLimit: z.number(),
  approverRoleId: z.string().min(1),
  /** Hasta dónde lo deja decidir solo el aprobador. */
  approverLimit: z.number(),
  /** Umbral acordado. null mientras haya choque sin resolver. */
  sealedThreshold: z.number().nullable(),
  gateMode: GateModeSchema,
});

// --- 2.3 Definición de rol ---------------------------------------------------

export const RoleIdSchema = z.enum(["role_a", "role_b", "role_c"]);
export const AccentColorSchema = z.enum(["emerald", "amber", "violet"]);

export const RoleDefinitionSchema = z.object({
  id: RoleIdSchema,
  orgId: z.string().min(1),
  title: z.string().min(1),
  shortTag: z.string().min(1),
  accentColor: AccentColorSchema,
  agentName: z.string().min(1),
  agentPersona: z.string().min(1),
  objective: z.string().min(1),
  painPoint: z.string().min(1),
  /** Confiabilidad p de un paso del agente de este rol, usada en p^n. */
  reliabilityP: z.number().min(0.7).max(0.999),
  /** true para el rol que entra por QR (Comité). */
  isQrOptional: z.boolean().default(false),
});

// --- 2.4 Caso vivo -----------------------------------------------------------

export const LiveCaseSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  triggeredMetricKey: z.string().min(1),
  /** Valor propuesto; si cruza el umbral dispara la compuerta. */
  proposedValue: z.number(),
  /** n de p^n: pasos encadenados de la decisión. */
  stepCountN: z.number().int().min(3).max(15),
  /** Texto público de lo que está en juego. No debe revelar valores secretos. */
  stakesLabel: z.string().min(1),
  /** Personas en riesgo mientras el caso espera. Lo usa el contador. Si falta, 0. Agregado al plan. */
  livesAtRisk: z.number().int().min(0).optional(),
});

// --- 2.5 Genoma de organización ----------------------------------------------

export const OrgGenomeBaseSchema = z.object({
  orgId: z.string().regex(/^[a-z0-9_]+$/, "orgId: solo minúsculas, números y guion bajo, sin tildes"),
  orgName: z.string().min(1),
  industry: z.string().min(1),
  orgStyle: z.string().min(1),
  roles: z.array(RoleDefinitionSchema).min(2).max(3),
  fields: z.array(RoleVisibilityFieldSchema).min(4).max(8),
  authorityRule: AuthorityRuleSchema,
  liveCase: LiveCaseSchema,
});

/** Genoma con coherencia interna verificada: referencias a roles, claves y rangos. */
export const OrgGenomeSchema = OrgGenomeBaseSchema.superRefine((genome, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const roleIds = new Set<string>();
  genome.roles.forEach((role, i) => {
    if (roleIds.has(role.id)) issue(["roles", i, "id"], `Rol repetido: ${role.id}`);
    roleIds.add(role.id);
    if (role.orgId !== genome.orgId) issue(["roles", i, "orgId"], "El rol debe pertenecer a la organización del genoma");
  });
  const fieldKeys = new Set<string>();
  genome.fields.forEach((field, i) => {
    if (fieldKeys.has(field.key)) issue(["fields", i, "key"], `Campo repetido: ${field.key}`);
    fieldKeys.add(field.key);
    if (field.ownerOrgId !== genome.orgId) issue(["fields", i, "ownerOrgId"], "El campo debe pertenecer a la organización del genoma");
    if (!roleIds.has(field.ownerRoleId)) issue(["fields", i, "ownerRoleId"], `El rol dueño ${field.ownerRoleId} no existe`);
    if (!field.visibleToRoleIds.includes(field.ownerRoleId)) issue(["fields", i, "visibleToRoleIds"], "El rol dueño debe poder ver su propio campo");
    if (!field.visibleToOrgIds.includes(genome.orgId)) issue(["fields", i, "visibleToOrgIds"], "La organización dueña debe poder ver su propio campo");
  });
  const rule = genome.authorityRule;
  if (!roleIds.has(rule.proposerRoleId)) issue(["authorityRule", "proposerRoleId"], "El rol proponente no existe");
  if (!roleIds.has(rule.approverRoleId)) issue(["authorityRule", "approverRoleId"], "El rol aprobador no existe");
  if (rule.proposerRoleId === rule.approverRoleId) issue(["authorityRule", "approverRoleId"], "Proponente y aprobador deben ser roles distintos");
  if (rule.min >= rule.max) issue(["authorityRule", "max"], "max debe ser mayor que min");
  for (const key of ["proposerLimit", "approverLimit", "sealedThreshold"] as const) {
    const value = rule[key];
    if (value !== null && (value < rule.min || value > rule.max)) issue(["authorityRule", key], `${key} debe estar entre min y max`);
  }
  if (genome.liveCase.triggeredMetricKey !== rule.metricKey) issue(["liveCase", "triggeredMetricKey"], "El caso debe apuntar a la métrica de la regla de autoridad");
  if (genome.liveCase.proposedValue < rule.min || genome.liveCase.proposedValue > rule.max) issue(["liveCase", "proposedValue"], "proposedValue debe estar entre min y max de la regla");
});

// --- 2.6 Recurso escaso compartido (capa inter-org) ---------------------------

export const OrgCandidateSchema = z.object({
  orgId: z.string().min(1),
  caseId: z.string().min(1),
  /** Etiqueta des-identificada: "Paciente A". */
  patientLabel: z.string().min(1),
  clinicalSeverityScore: z.number().min(0).max(1),
  timeCriticality: z.number().min(0).max(1),
  delayRiskScore: z.number().min(0).max(1),
  /**
   * Necesidad sin cubrir (0 a 1): qué tan lejos queda la alternativa si este caso
   * no recibe el recurso. Es el dato que usa el desempate "worst_unmet_need".
   * Agregado al plan: sin él, el desempate no tiene de dónde calcularse.
   */
  unmetNeedScore: z.number().min(0).max(1),
  /** SECRETO de la organización. */
  coverageCost: z.number(),
  /** Organizaciones que reciben coverageCost: solo la dueña. */
  coverageCostVisibleToOrgs: z.array(z.string()),
  proposerRoleId: z.string().min(1),
  /** true cuando la organización presentó el caso (SUBMIT_CANDIDATE). Si falta, false. Agregado al plan. */
  submitted: z.boolean().optional(),
});

export const EquityTieBreakSchema = z.enum(["worst_unmet_need", "coverage_gap", "geographic"]);

export const AllocationRuleSchema = z.object({
  id: z.string().min(1),
  resourceLabel: z.string().min(1),
  resourceQuantity: z.literal(1),
  /** Pesos del puntaje. Deterministas y auditables; no interviene ningún modelo. */
  weights: z.object({
    severity: z.number(),
    timeCriticality: z.number(),
    delayRisk: z.number(),
  }),
  /** Si dos puntajes difieren en menos que esto, se aplica el desempate. Agregado al plan. */
  tieEpsilon: z.number().min(0).max(1),
  equityTieBreak: EquityTieBreakSchema,
  committeeVeto: z.literal(true),
});

/**
 * Árbitro neutral de la capa inter-org (el Comité que entra por QR). Agregado al
 * plan: en modo cross_org el Comité no pertenece a ninguna de las organizaciones
 * que compiten, así que tiene su propio orgId y no ve el costo de ninguna.
 */
export const ArbiterSchema = z.object({
  orgId: z.string().min(1),
  roleId: RoleIdSchema,
  title: z.string().min(1),
  shortTag: z.string().min(1),
});

export const SharedScarcitySchema = z
  .object({
    resource: z.string().min(1),
    rule: AllocationRuleSchema,
    candidates: z.array(OrgCandidateSchema).min(2).max(4),
    arbiter: ArbiterSchema,
    deadlineLabel: z.string().min(1),
    /** Texto público. No debe revelar valores secretos (por ejemplo, la suma de costos). */
    stakesLabel: z.string().min(1),
  })
  .superRefine((scarcity, ctx) => {
    const caseIds = new Set<string>();
    scarcity.candidates.forEach((candidate, i) => {
      if (caseIds.has(candidate.caseId)) ctx.addIssue({ code: "custom", path: ["candidates", i, "caseId"], message: `Caso repetido: ${candidate.caseId}` });
      caseIds.add(candidate.caseId);
      if (candidate.coverageCostVisibleToOrgs.some((orgId) => orgId !== candidate.orgId)) {
        ctx.addIssue({ code: "custom", path: ["candidates", i, "coverageCostVisibleToOrgs"], message: "El costo de cobertura solo puede verlo la organización dueña" });
      }
    });
  });

// --- 2.7 Estado de sala y bitácora -------------------------------------------

export const AuditEventTypeSchema = z.enum([
  // Del plan
  "MUTATION",
  "CONFLICT_DETECTED",
  "RULE_SEALED",
  "RBAC_DENIED",
  "GATE_BLOCKED",
  "HITL_APPROVED",
  "HITL_VETOED",
  "COUNTER_PROPOSED",
  "QR_JOINED",
  "ALLOCATION_PROPOSED",
  "ALLOCATION_SEALED",
  "STAKES_CONTAINED",
  // Agregados: ciclo de vida de la sala e identidad
  "ROOM_CREATED",
  "ROLE_JOINED",
  "ROLE_LEFT",
  "AUTH_FAILED",
  "CANDIDATE_SUBMITTED",
  "AGENT_PROPOSED",
]);

export const AuditEventSchema = z.object({
  /** Reloj del servidor, en milisegundos. */
  ts: z.number(),
  type: AuditEventTypeSchema,
  orgId: z.string().optional(),
  roleId: z.string().optional(),
  /** Nunca debe contener valores secretos: la bitácora la ven todos. */
  detail: z.record(z.string(), z.unknown()),
});

export const GateStatusSchema = z.enum(["OPEN", "BLOCKED_HITL_REQUIRED", "AUTO_EXECUTED_UNSAFE", "SEALED"]);
export const AllocationStatusSchema = z.enum(["PENDING", "PROPOSED", "SEALED"]);
export const RoomModeSchema = z.enum(["single_org", "cross_org"]);

export const PlayerSchema = z.object({ orgId: z.string(), roleId: z.string(), heartbeatMs: z.number() });

/** Decisión de una persona sobre una compuerta o sobre la asignación. La razón es obligatoria. */
export const HumanDecisionSchema = z.object({
  /** "gate": compuerta de una organización. "allocation": asignación del recurso escaso. */
  scope: z.enum(["gate", "allocation"]),
  /** Organización cuya compuerta se decide. Solo en scope "gate". */
  targetOrgId: z.string().optional(),
  /** Caso sobre el que recae la decisión (el aprobado o el vetado). Solo en scope "allocation". */
  targetCaseId: z.string().optional(),
  decision: z.enum(["APPROVE", "VETO", "COUNTER_PROPOSE"]),
  reason: z.string().trim().min(1, "La razón es obligatoria"),
  /** Valor contrapropuesto. Solo en COUNTER_PROPOSE. */
  counterValue: z.number().optional(),
  byOrgId: z.string(),
  byRoleId: z.string(),
  ts: z.number(),
});

/**
 * Telemetría del modelo. Dice la verdad: en el Spark provider es "local" y
 * bytesSentToCloud queda en 0; en el deploy público provider es "cloud" y
 * bytesSentToCloud cuenta lo enviado. La llena la capa de modelos (src/lib/llm.ts).
 */
export const TelemetrySchema = z.object({
  modelName: z.string(),
  provider: z.enum(["local", "cloud"]),
  /** Host al que se le habla, por ejemplo "localhost:11434" o "api.anthropic.com". */
  endpointHost: z.string(),
  bytesSentToCloud: z.number().min(0),
  queueDepth: z.number(),
  lastLatencyMs: z.number(),
  tokensPerSec: z.number(),
});

export const RoomStateSchema = z.object({
  roomId: z.string().min(1),
  mode: RoomModeSchema,
  orgGenomes: z.array(OrgGenomeSchema).min(1),
  scarcity: SharedScarcitySchema.nullable(),
  connectedPlayers: z.array(PlayerSchema),
  gateStatus: GateStatusSchema,
  allocationStatus: AllocationStatusSchema.nullable(),
  /** Decisiones humanas tomadas en la sala, en orden. Agregado al plan. */
  decisions: z.array(HumanDecisionSchema),
  auditLog: z.array(AuditEventSchema),
  telemetry: TelemetrySchema,
  caseOpenedAt: z.number(),
  decisionSealedAt: z.number().nullable(),
  /** Sube en cada cambio. Agregado al plan. */
  version: z.number().int().min(0),
  /** Eventos antiguos de la bitácora descartados por el tope de memoria. Si falta, 0. */
  auditDropped: z.number().int().min(0).optional(),
});

// --- Vista del cliente: lo que emite el SSE ----------------------------------

/** Quién mira: una persona con rol en una organización, o la pantalla general. */
export const ViewerSchema = z.union([z.object({ orgId: z.string(), roleId: z.string() }), z.literal("stage")]);

export const RedactedSchema = z.object({ redacted: z.literal(true), reason: z.literal("RBAC_SERVER_FILTERED") });

/** Campo con valor (el viewer tiene permiso) o sin valor (el valor nunca salió del servidor). */
export const ProjectedFieldSchema = z.discriminatedUnion("redacted", [
  RoleVisibilityFieldSchema.extend({ redacted: z.literal(false) }),
  RoleVisibilityFieldSchema.pick({ key: true, label: true, unit: true, ownerOrgId: true, ownerRoleId: true, classification: true }).extend({
    redacted: z.literal(true),
    reason: z.literal("RBAC_SERVER_FILTERED"),
  }),
]);

/** Candidato con el costo de cobertura visible solo para su propia organización. */
export const ProjectedCandidateSchema = OrgCandidateSchema.omit({ coverageCost: true, coverageCostVisibleToOrgs: true }).extend({
  coverageCost: z.union([z.number(), RedactedSchema]),
});

/** Choque de autoridad entre proponente y aprobador. Derivado. */
export const ConflictViewSchema = z.object({
  hasConflict: z.boolean(),
  /** proposerLimit − approverLimit. */
  delta: z.number(),
  proposerRoleId: z.string(),
  approverRoleId: z.string(),
  message: z.string(),
});

/** Estado de la compuerta de una organización. Derivado. */
export const GateViewSchema = z.object({
  status: GateStatusSchema,
  mode: GateModeSchema,
  proposedValue: z.number(),
  /** Umbral vigente: sealedThreshold si existe; si no, approverLimit. */
  effectiveThreshold: z.number(),
  crossesThreshold: z.boolean(),
  /** Rol que debe decidir cuando la compuerta está bloqueada (el Comité si existe; si no, el aprobador). */
  pendingApproverRoleId: z.string().nullable(),
  /** Roles a los que el motor les acepta la decisión: aprobador y Comité. */
  deciderRoleIds: z.array(z.string()),
  /** Cómo se cerró la compuerta. null mientras no hay decisión humana. */
  outcome: z.enum(["approved", "vetoed", "counter_proposed"]).nullable(),
  message: z.string(),
});

/** Confiabilidad de la cadena de decisión. Derivada. */
export const ReliabilityViewSchema = z.object({
  /** p de un paso (promedio de los roles de la cadena). */
  p: z.number(),
  /** Cantidad de pasos encadenados. */
  n: z.number().int(),
  /** p^n: todos los pasos los ejecutan agentes sin control. */
  autonomous: z.number(),
  /** Con compuerta determinista y revisión humana en los pasos críticos. */
  hybrid: z.number(),
  /** Cuál de los dos aplica ahora según el modo de compuerta y las decisiones tomadas. */
  current: z.number(),
  currentMode: z.enum(["autonomous", "hybrid"]),
  /** Fórmula con los números reemplazados, para mostrar y auditar. Modelo ilustrativo, no una medición. */
  formula: z.string(),
});

export const RankedCandidateSchema = z.object({
  rank: z.number().int().min(1),
  orgId: z.string(),
  caseId: z.string(),
  patientLabel: z.string(),
  /** S = w_sev·sev + w_time·time − w_delay·delayRisk. */
  score: z.number(),
  /** Aporte de cada término al puntaje, ya multiplicado por su peso. */
  terms: z.object({ severity: z.number(), timeCriticality: z.number(), delayRisk: z.number() }),
  unmetNeedScore: z.number(),
});

/** Resultado de la asignación del recurso escaso. Derivado. */
export const AllocationViewSchema = z.object({
  status: AllocationStatusSchema,
  ranking: z.array(RankedCandidateSchema),
  winnerCaseId: z.string().nullable(),
  winnerOrgId: z.string().nullable(),
  tieBreakApplied: z.boolean(),
  tieBreakRule: EquityTieBreakSchema,
  tieEpsilon: z.number(),
  /** Diferencia entre el primer y el segundo puntaje. */
  scoreGap: z.number(),
  /** Explicación de la regla aplicada, en una frase. */
  explanation: z.string(),
  /** Casos vetados por el Comité: quedan fuera del orden. */
  vetoedCaseIds: z.array(z.string()),
  /** Candidatos que todavía no han sido presentados por su organización. */
  pendingCaseIds: z.array(z.string()),
  /** Última decisión del Comité sobre la asignación, si la hay. */
  committeeDecision: HumanDecisionSchema.nullable(),
});

/** Contador de lo que está en juego. Derivado con el reloj del servidor. */
export const StakesViewSchema = z.object({
  status: z.enum(["BLEEDING", "CONTAINED"]),
  /** Casos que siguen esperando decisión. */
  waitingCases: z.number().int().min(0),
  livesAtRisk: z.number().int().min(0),
  /** Milisegundos desde que se abrió el caso hasta ahora (o hasta que se selló). */
  elapsedMs: z.number().min(0),
  /** Tiempo hasta la decisión; null mientras no se sella. */
  timeToDecisionMs: z.number().nullable(),
  stakesLabel: z.string(),
  deadlineLabel: z.string().nullable(),
});

export const ProjectedRoleSchema = RoleDefinitionSchema.extend({ connected: z.boolean() });

export const ProjectedOrgSchema = OrgGenomeBaseSchema.omit({ roles: true, fields: true }).extend({
  roles: z.array(ProjectedRoleSchema),
  fields: z.array(ProjectedFieldSchema),
  conflict: ConflictViewSchema,
  gate: GateViewSchema,
  reliability: ReliabilityViewSchema,
});

export const ProjectedScarcitySchema = z.object({
  resource: z.string(),
  rule: AllocationRuleSchema,
  candidates: z.array(ProjectedCandidateSchema),
  arbiter: ArbiterSchema.extend({ connected: z.boolean() }),
  deadlineLabel: z.string(),
  stakesLabel: z.string(),
});

/** Lo que recibe un cliente por SSE. Es la única forma en que sale estado del servidor. */
export const ProjectedRoomStateSchema = z.object({
  roomId: z.string(),
  version: z.number().int(),
  mode: RoomModeSchema,
  viewer: ViewerSchema,
  /** Reloj del servidor al armar este paquete. */
  serverNowTs: z.number(),
  orgs: z.array(ProjectedOrgSchema),
  scarcity: ProjectedScarcitySchema.nullable(),
  /** null en single_org. */
  allocation: AllocationViewSchema.nullable(),
  /** p^n de la cadena que cruza todas las organizaciones. null en single_org. */
  crossOrgReliability: ReliabilityViewSchema.nullable(),
  stakes: StakesViewSchema,
  gateStatus: GateStatusSchema,
  allocationStatus: AllocationStatusSchema.nullable(),
  decisions: z.array(HumanDecisionSchema),
  connectedPlayers: z.array(PlayerSchema.pick({ orgId: true, roleId: true })),
  auditLog: z.array(AuditEventSchema),
  telemetry: TelemetrySchema,
  caseOpenedAt: z.number(),
  decisionSealedAt: z.number().nullable(),
});

// --- Tipos inferidos ---------------------------------------------------------

export type FieldClassification = z.infer<typeof FieldClassificationSchema>;
export type RoleVisibilityField = z.infer<typeof RoleVisibilityFieldSchema>;
export type GateMode = z.infer<typeof GateModeSchema>;
export type AuthorityRule = z.infer<typeof AuthorityRuleSchema>;
export type RoleId = z.infer<typeof RoleIdSchema>;
export type AccentColor = z.infer<typeof AccentColorSchema>;
export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;
export type LiveCase = z.infer<typeof LiveCaseSchema>;
export type OrgGenome = z.infer<typeof OrgGenomeSchema>;
/** Genoma antes de validar (isQrOptional puede faltar). Útil para escribir semillas. */
export type OrgGenomeInput = z.input<typeof OrgGenomeSchema>;
export type OrgCandidate = z.infer<typeof OrgCandidateSchema>;
export type EquityTieBreak = z.infer<typeof EquityTieBreakSchema>;
export type AllocationRule = z.infer<typeof AllocationRuleSchema>;
export type Arbiter = z.infer<typeof ArbiterSchema>;
export type SharedScarcity = z.infer<typeof SharedScarcitySchema>;
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type GateStatus = z.infer<typeof GateStatusSchema>;
export type AllocationStatus = z.infer<typeof AllocationStatusSchema>;
export type RoomMode = z.infer<typeof RoomModeSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type HumanDecision = z.infer<typeof HumanDecisionSchema>;
export type Telemetry = z.infer<typeof TelemetrySchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;

export type Viewer = z.infer<typeof ViewerSchema>;
export type Redacted = z.infer<typeof RedactedSchema>;
export type ProjectedField = z.infer<typeof ProjectedFieldSchema>;
export type ProjectedCandidate = z.infer<typeof ProjectedCandidateSchema>;
export type ConflictView = z.infer<typeof ConflictViewSchema>;
export type GateView = z.infer<typeof GateViewSchema>;
export type ReliabilityView = z.infer<typeof ReliabilityViewSchema>;
export type RankedCandidate = z.infer<typeof RankedCandidateSchema>;
export type AllocationView = z.infer<typeof AllocationViewSchema>;
export type StakesView = z.infer<typeof StakesViewSchema>;
export type ProjectedRole = z.infer<typeof ProjectedRoleSchema>;
export type ProjectedOrg = z.infer<typeof ProjectedOrgSchema>;
export type ProjectedScarcity = z.infer<typeof ProjectedScarcitySchema>;
export type ProjectedRoomState = z.infer<typeof ProjectedRoomStateSchema>;
