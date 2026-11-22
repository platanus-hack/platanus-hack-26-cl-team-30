// Textos de «Tu agente» en el celular de la demo con negociación que arma el
// código, sin modelo, con datos públicos de la sala. Los que escribe el agente
// (consejo privado y argumentos) llegan del servidor ya filtrados para cada rol.

import type { ProjectedRoomState } from "@/lib/genome/schema";
import { orgOfLabel, withArticle } from "./demo-view";

/** Cómo se presenta el agente al entrar: antes trabajaba solo, ahora se conecta con los demás. Una frase. */
export const AGENT_INTRO = "Antes trabajaba solo, con tus datos; ahora me conecto con los agentes de los demás sin mostrarles lo tuyo.";

/** «el Hospital Rural» (o la etiqueta pública del caso) para el candidato que propone la regla. */
export function proposedName(room: ProjectedRoomState, labels: { orgId: string; label: string }[]): string | null {
  const allocation = room.allocation;
  const winner = allocation?.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
  if (!winner) return null;
  const seat = labels.find((item) => item.orgId === winner.orgId);
  return seat ? withArticle(orgOfLabel(seat.label)) : winner.patientLabel;
}

const score = (value: number) => value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * El resumen y la recomendación que el agente del Comité le da a su persona antes
 * de decidir. Lo arma el código con datos que ya ven todos (los puntajes de la
 * regla y si hubo desempate): no pasa por el modelo ni usa datos reservados. La
 * recomendación es aceptar lo que calculó la regla; la decisión es de la persona.
 * reasonIndex: la razón precargada que sugiere (índice de DEMO_REASONS).
 */
export function committeeBrief(room: ProjectedRoomState, labels: { orgId: string; label: string }[], resource: string): { summary: string; advice: string; reasonIndex: number } | null {
  const allocation = room.allocation;
  const name = proposedName(room, labels);
  if (!allocation || !name) return null;
  const [first, second] = allocation.ranking;
  if (allocation.tieBreakApplied && first && second) {
    return {
      summary: `La regla propone ${resource} para ${name}: casi empate, ${score(first.score)} contra ${score(second.score)}, y desempata el paciente con menos cobertura.`,
      advice: "Te recomiendo aceptar, porque la regla trató igual a los dos y el empate lo rompe la equidad.",
      reasonIndex: 0,
    };
  }
  if (allocation.vetoedCaseIds.length > 0) {
    return { summary: `Tras el rechazo, la regla propone ${resource} para ${name}, el que sigue en puntaje.`, advice: "Te recomiendo aceptar, porque ya no queda otro caso que comparar.", reasonIndex: 1 };
  }
  return { summary: `La regla propone ${resource} para ${name}, el caso más grave y urgente.`, advice: "Te recomiendo aceptar, porque la regla se aplicó igual a los dos casos.", reasonIndex: 1 };
}
