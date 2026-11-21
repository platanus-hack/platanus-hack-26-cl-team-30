// «Pregúntale al caso»: respuestas armadas con los datos de la sala que ya
// recibió la pantalla general. No hay modelo detrás: es una búsqueda por
// palabras clave sobre el estado proyectado, así que nunca inventa ni ve datos ocultos.

import type { ProjectedRoomState } from "@/lib/genome/schema";
import { formatClock } from "@/components/organs/format";
import { roomHeadline } from "@/components/nexo/guide";
import { deadlineWindow, deniedCount, pendingItems } from "./metrics";

export const SUGGESTIONS = ["¿Quién va primero?", "¿Por qué?", "¿Qué falta por firmar?", "¿Cuánto llevamos esperando?", "¿Alguien pidió un dato ajeno?"];

const has = (q: string, ...words: string[]) => words.some((word) => q.includes(word));

export function answer(room: ProjectedRoomState, question: string): string {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const allocation = room.allocation;
  const orgName = (orgId?: string | null) => room.orgs.find((org) => org.orgId === orgId)?.orgName ?? "";

  if (has(q, "costo", "cuesta", "precio", "plata", "dinero", "margen")) {
    return "El costo de cada organización no viaja a esta pantalla ni entra en la regla. Solo lo ve el rol dueño de ese dato, en su propio teléfono.";
  }
  if (has(q, "rechaz", "acceso", "403", "permiso", "ajeno", "reservado", "intento")) {
    const denied = room.auditLog.filter((event) => event.type === "RBAC_DENIED");
    if (denied.length === 0) return "Nadie ha pedido un dato que no le corresponde.";
    const last = denied[denied.length - 1];
    const who = room.orgs.find((org) => org.orgId === last.orgId)?.roles.find((role) => role.id === last.roleId)?.title ?? "Alguien";
    return `El servidor rechazó ${deniedCount(room)} ${deniedCount(room) === 1 ? "intento" : "intentos"} de ver datos ajenos. El último fue de ${who}${last.orgId ? ` (${orgName(last.orgId)})` : ""}. Cada intento queda en el registro.`;
  }
  if (has(q, "firma", "pendiente", "falta", "toca")) {
    const items = pendingItems(room);
    return items.length ? items.map((item) => `${item.title}: ${item.detail}`).join(" ") : "Todavía no hay nada por firmar.";
  }
  if (has(q, "cuanto", "tiempo", "espera", "hora", "cierre", "ventana")) {
    const window = deadlineWindow(room);
    const waited = room.stakes.timeToDecisionMs ?? room.stakes.elapsedMs;
    const base = room.stakes.status === "CONTAINED" ? `La decisión se tomó en ${formatClock(waited)}.` : `Llevamos ${formatClock(waited)} esperando una decisión.`;
    return window.remainingMs !== null ? `${base} Quedan ${formatClock(window.remainingMs)} hasta el cierre (${window.label}).` : `${base} ${window.label}.`;
  }
  if (allocation && has(q, "por que", "porque", "regla", "formula", "empate", "puntaje", "equidad")) {
    const w = room.scarcity?.rule.weights;
    const formula = w ? ` La regla suma ${w.severity} por gravedad y ${w.timeCriticality} por urgencia, y resta ${w.delayRisk} por riesgo de demora.` : "";
    return `${allocation.explanation}${formula} El costo no entra en la cuenta.`;
  }
  if (allocation && has(q, "primero", "gana", "ganador", "quien", "ranking", "orden", "recibe")) {
    if (allocation.ranking.length === 0) return "Todavía ninguna organización presentó su caso.";
    const first = allocation.ranking[0];
    const state = allocation.status === "SEALED" ? "recibe el recurso: el Comité ya lo selló" : "va primero, pero falta que el Comité decida";
    return `${first.patientLabel} de ${orgName(first.orgId)} ${state}. ${allocation.tieBreakApplied ? "Quedaron casi empatados y la regla dio prioridad a quien tiene más necesidad sin cubrir." : ""}`.trim();
  }
  if (has(q, "comite")) {
    const arbiter = room.scarcity?.arbiter;
    if (!arbiter) return "El Comité entra con el código QR de la sección Organizaciones.";
    if (allocation?.committeeDecision) return `El Comité ${allocation.committeeDecision.decision === "VETO" ? "vetó" : "aprobó"} y escribió: «${allocation.committeeDecision.reason}».`;
    return arbiter.connected ? "El Comité está conectado y decidirá cuando la regla proponga una asignación." : "El Comité todavía no entra. Su código QR está en la sección Organizaciones.";
  }
  const headline = roomHeadline(room);
  return `${headline.title}. ${headline.body} Prueba preguntando quién va primero, por qué o qué falta por firmar.`;
}
