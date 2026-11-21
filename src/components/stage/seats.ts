// Asientos de la sala tal como llegan por el SSE: uno por rol que se puede
// ocupar. La galaxia de la pantalla grande dibuja un nodo y una órbita por cada
// asiento conectado. Este módulo solo lee el estado proyectado; no decide nada.

import type { ProjectedRoomState } from "@/lib/genome/schema";

export type SeatKind = "proposer" | "approver" | "arbiter" | "other";

export type Seat = {
  /** `orgId/roleId`: estable mientras dure la sala. */
  id: string;
  label: string;
  org: string;
  kind: SeatKind;
  /** Índice en la paleta de asientos (ver SEAT_TONES). */
  tone: number;
  connected: boolean;
};

/**
 * Colores de los asientos, tomados de la paleta oficial (docs/DISENO.md). El tipo
 * de rol da el tono y la organización el matiz: quien propone va en eucalipto,
 * quien aprueba en ocre o arcilla, y el Comité, neutral, en marfil (o tinta en claro).
 */
export const SEAT_TONES: { dark: string; light: string }[] = [
  { dark: "#6faf9b", light: "#4f7c6d" }, // propone · organización 1
  { dark: "#f1be58", light: "#8a6a1d" }, // aprueba · organización 1
  { dark: "#8fd3bd", light: "#3f8f7a" }, // propone · organización 2
  { dark: "#e0a891", light: "#8f5743" }, // aprueba · organización 2
  { dark: "#fffdf8", light: "#24403a" }, // Comité
  { dark: "#b4b4ac", light: "#4d6860" }, // otros roles
];
const ARBITER_TONE = 4;
const OTHER_TONE = 5;

/** Asientos de la sala, en el orden en que se sientan: cada organización y, al final, el Comité. */
export function stageSeats(room: ProjectedRoomState): Seat[] {
  const arbiter = room.scarcity?.arbiter;
  const seats: Seat[] = [];
  room.orgs.forEach((org, orgIndex) => {
    for (const role of org.roles) {
      // En una sala entre organizaciones el Comité es el de la red, no el de cada una.
      if (role.isQrOptional && (arbiter || orgIndex > 0)) continue;
      const kind: SeatKind = role.isQrOptional ? "arbiter" : role.id === org.authorityRule.proposerRoleId ? "proposer" : role.id === org.authorityRule.approverRoleId ? "approver" : "other";
      const tone = kind === "arbiter" ? ARBITER_TONE : kind === "other" ? OTHER_TONE : (orgIndex % 2) * 2 + (kind === "proposer" ? 0 : 1);
      seats.push({ id: `${org.orgId}/${role.id}`, label: role.title, org: org.orgName, kind, tone, connected: role.connected });
    }
  });
  if (arbiter) {
    seats.push({ id: `${arbiter.orgId}/${arbiter.roleId}`, label: arbiter.title, org: "", kind: "arbiter", tone: ARBITER_TONE, connected: arbiter.connected });
  } else {
    // Sala de una organización: su Comité va al final, como en la otra.
    const index = seats.findIndex((seat) => seat.kind === "arbiter");
    if (index >= 0) seats.push(...seats.splice(index, 1));
  }
  return seats;
}

const JOINER = /^(de|del|la|las|el|los|y|e|en|a|al|por|para|con|sin|su|sus)$/i;

/** Etiqueta para leer de lejos: una o dos palabras, cortada antes del primer conector («Costo de cobertura UCI» → «Costo»). */
export function shortLabel(label: string): string {
  const words = label.replace(/\s*[/(·,:].*$/, "").split(/\s+/).filter(Boolean);
  const cut = words.findIndex((word, index) => index > 0 && JOINER.test(word));
  return (cut > 0 ? words.slice(0, cut) : words).slice(0, 2).join(" ") || label;
}
