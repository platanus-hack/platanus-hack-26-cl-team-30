// Formato y vocabulario compartido por los órganos. Sin estado ni efectos.

import type { AccentColor, AuditEvent, GateStatus, ProjectedOrg, ProjectedRoomState, Viewer } from "@/lib/genome/schema";

const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

/** "2400000" + "CLP" -> "$2.400.000"; el resto, número con su unidad. */
export function formatValue(value: string | number, unit?: string): string {
  if (typeof value === "string") return unit ? `${value} ${unit}` : value;
  if (unit === "CLP") return `$${number.format(value)}`;
  if (unit === "%") return `${number.format(value)}%`;
  return unit ? `${number.format(value)} ${unit}` : number.format(value);
}

/** Probabilidad 0..1 como porcentaje entero: 0.4343 -> "43%". */
export function formatPct(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

/** Puntaje con dos decimales y coma: 0.53 -> "0,53". */
export function formatScore(score: number): string {
  return score.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Milisegundos como mm:ss (o h:mm:ss pasado la hora). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/** Clases por acento de rol. Literales completos para que Tailwind los encuentre. */
export const ACCENT: Record<AccentColor, { bg: string; text: string; border: string; stroke: string }> = {
  emerald: { bg: "bg-role-emerald", text: "text-role-emerald", border: "border-role-emerald", stroke: "var(--role-emerald)" },
  amber: { bg: "bg-role-amber", text: "text-role-amber", border: "border-role-amber", stroke: "var(--role-amber)" },
  violet: { bg: "bg-role-violet", text: "text-role-violet", border: "border-role-violet", stroke: "var(--role-violet)" },
};

export const GATE_LABEL: Record<GateStatus, string> = {
  OPEN: "Compuerta abierta",
  BLOCKED_HITL_REQUIRED: "Bloqueada: falta la firma de una persona",
  AUTO_EXECUTED_UNSAFE: "Ejecutada por un agente sin revisión",
  SEALED: "Decisión sellada",
};

export const AUDIT_LABEL: Record<AuditEvent["type"], string> = {
  MUTATION: "Organización generada",
  CONFLICT_DETECTED: "Choque de autoridad",
  RULE_SEALED: "Regla sellada",
  RBAC_DENIED: "403, lectura negada",
  GATE_BLOCKED: "Compuerta bloqueada",
  HITL_APPROVED: "Aprobado por una persona",
  HITL_VETOED: "Vetado por una persona",
  COUNTER_PROPOSED: "Contrapropuesta",
  QR_JOINED: "Entró por código QR",
  ALLOCATION_PROPOSED: "Asignación propuesta",
  ALLOCATION_SEALED: "Asignación sellada",
  STAKES_CONTAINED: "Espera contenida",
  ROOM_CREATED: "Sala creada",
  ROLE_JOINED: "Rol tomado",
  ROLE_LEFT: "Rol liberado",
  AUTH_FAILED: "401, identidad inválida",
  CANDIDATE_SUBMITTED: "Candidato presentado",
  AGENT_PROPOSED: "Propuesta de un agente",
};

export type RoleViewer = Exclude<Viewer, "stage">;

export function isRoleViewer(viewer: Viewer): viewer is RoleViewer {
  return viewer !== "stage";
}

/** true si quien mira es el Comité que arbitra entre organizaciones. */
export function isArbiter(room: ProjectedRoomState): boolean {
  const { viewer, scarcity } = room;
  return isRoleViewer(viewer) && !!scarcity && viewer.orgId === scarcity.arbiter.orgId && viewer.roleId === scarcity.arbiter.roleId;
}

export function findOrg(room: ProjectedRoomState, orgId: string | undefined): ProjectedOrg | undefined {
  return room.orgs.find((org) => org.orgId === orgId);
}

/** Nombre legible de una organización, incluido el Comité de la red. */
export function orgLabel(room: ProjectedRoomState, orgId: string | undefined): string {
  if (!orgId) return "";
  const org = findOrg(room, orgId);
  if (org) return org.orgName;
  const arbiter = room.scarcity?.arbiter;
  if (arbiter && arbiter.orgId === orgId) return arbiter.title;
  return orgId;
}

/** Título del rol dentro de su organización, incluido el Comité de la red. */
export function roleLabel(room: ProjectedRoomState, orgId: string | undefined, roleId: string | undefined): string {
  if (!roleId) return "";
  const role = findOrg(room, orgId)?.roles.find((entry) => entry.id === roleId);
  if (role) return role.title;
  const arbiter = room.scarcity?.arbiter;
  if (arbiter && arbiter.orgId === orgId) return arbiter.title;
  return roleId;
}

/** Claves del detalle que ya se muestran en otra parte del evento. */
const AUDIT_SKIP = new Set(["title", "by", "scope", "reason", "explanation", "message"]);

/**
 * Detalle de un evento de bitácora, sin asumir su forma: la frase principal
 * (explicación o mensaje), la razón escrita por una persona, y el resto de los
 * valores simples. Los objetos anidados no se muestran: están en el acta.
 */
/** Eventos cuya razón la escribió una persona y se cita textual. */
const HUMAN_REASON_EVENTS = new Set<AuditEvent["type"]>(["HITL_APPROVED", "HITL_VETOED", "COUNTER_PROPOSED", "ALLOCATION_SEALED"]);

export function auditDetail(detail: Record<string, unknown>, type?: AuditEvent["type"]): { text: string; reason: string | null } {
  const human = type === undefined || HUMAN_REASON_EVENTS.has(type);
  const systemReason = !human && typeof detail.reason === "string" ? detail.reason : undefined;
  const lead = [detail.explanation, detail.message, systemReason].find((value): value is string => typeof value === "string" && value.length > 0);
  const rest = Object.entries(detail)
    .filter(([key, value]) => !AUDIT_SKIP.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
    .map(([key, value]) => `${key}: ${typeof value === "boolean" ? (value ? "sí" : "no") : value}`)
    .join("; ");
  return { text: lead ?? rest, reason: human && typeof detail.reason === "string" && detail.reason ? detail.reason : null };
}

/** Resultado de una acción tal como lo necesitan los órganos para mostrar el error. */
export type OrganResult = { ok: boolean; status: number; code?: string; error?: string; data?: import("@/lib/store/actions").ActionOk };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} kB`;
  return `${(bytes / 1024 / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`;
}
