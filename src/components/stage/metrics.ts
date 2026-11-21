// Cifras del centro de mando, sacadas del estado que envía el servidor. No decide nada.

import type { ProjectedRoomState } from "@/lib/genome/schema";

/** Cuántos accesos negó el servidor (403) según la bitácora que recibe la pantalla general. */
export function deniedCount(room: ProjectedRoomState): number {
  return room.auditLog.filter((event) => event.type === "RBAC_DENIED").length;
}

/** Personas y organizaciones con alguien conectado. */
export function connectedSummary(room: ProjectedRoomState): { people: number; orgsWithPeople: number; orgs: number; committee: boolean } {
  const orgsWithPeople = room.orgs.filter((org) => org.roles.some((role) => role.connected)).length;
  return {
    people: room.connectedPlayers.length,
    orgsWithPeople,
    orgs: room.orgs.length,
    committee: room.scarcity?.arbiter.connected ?? room.orgs.some((org) => org.roles.some((role) => role.isQrOptional && role.connected)),
  };
}

/**
 * Ventana hasta el cierre. El caso trae el cierre como texto ("Ventana de
 * derivación 18:00 (hoy)"); se toma la hora y se mide contra el reloj del
 * servidor. Si no hay hora o ya pasó, se informa sin barra.
 */
export function deadlineWindow(room: ProjectedRoomState): { label: string; progress: number | null; remainingMs: number | null } {
  const label = room.stakes.deadlineLabel ?? room.orgs[0]?.fields.find((field) => field.key.startsWith("deadline") && !field.redacted)?.label ?? "Sin hora de cierre";
  const match = label.match(/(\d{1,2}):(\d{2})/);
  if (!match) return { label, progress: null, remainingMs: null };
  const now = new Date(room.serverNowTs);
  const deadline = new Date(room.serverNowTs);
  deadline.setHours(Number(match[1]), Number(match[2]), 0, 0);
  const total = deadline.getTime() - room.caseOpenedAt;
  const remaining = deadline.getTime() - now.getTime();
  if (total <= 0 || remaining <= 0) return { label, progress: null, remainingMs: null };
  return { label, progress: Math.min(1, Math.max(0, (now.getTime() - room.caseOpenedAt) / total)), remainingMs: remaining };
}

/** Lo que está esperando una firma o una decisión, en orden de urgencia. */
export type Pending = { id: string; tone: "sign" | "blocked" | "done"; title: string; detail: string };

export function pendingItems(room: ProjectedRoomState): Pending[] {
  const items: Pending[] = [];
  const allocation = room.allocation;
  // Con la asignación sellada ya no queda nada que decidir en la sala.
  if (allocation?.status === "SEALED") {
    return [{ id: "sealed", tone: "done", title: "Asignación sellada", detail: "El Comité firmó con su razón. Queda en el acta." }];
  }
  if (allocation?.status === "PROPOSED") {
    const winner = allocation.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
    const org = room.orgs.find((entry) => entry.orgId === winner?.orgId)?.orgName;
    items.push({ id: "committee", tone: "sign", title: "Decisión del Comité", detail: `¿${winner?.patientLabel ?? "El primer caso"}${org ? ` (${org})` : ""} recibe el recurso?` });
  }
  for (const org of room.orgs) {
    if (org.gate.status === "BLOCKED_HITL_REQUIRED") {
      const role = org.roles.find((entry) => entry.id === org.gate.pendingApproverRoleId)?.title ?? "una persona";
      items.push({ id: `gate-${org.orgId}`, tone: "blocked", title: `Falta una firma en ${org.orgName}`, detail: `Le toca a ${role}.` });
    } else if (org.conflict.hasConflict) {
      items.push({ id: `rule-${org.orgId}`, tone: "sign", title: `Límite en disputa en ${org.orgName}`, detail: "Quien propone y quien aprueba todavía no se ponen de acuerdo." });
    }
  }
  if (items.length === 0) {
    const sealed = !allocation && room.orgs.every((org) => org.gate.status === "SEALED" || org.gate.status === "OPEN");
    if (sealed) items.push({ id: "none", tone: "done", title: "Nada por firmar", detail: "Todas las decisiones quedaron registradas en el acta." });
  }
  return items;
}
