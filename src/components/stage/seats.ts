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
  /** Lo juega el piloto automático (src/lib/engine/autopilot.ts), no una persona. */
  bot: boolean;
  /** En una sala de demo: asiento de una persona. Fuera de la demo, todos lo son. */
  human: boolean;
  /** Nombre corto para leer de lejos: «Clínica · Urgencias», «Comité». */
  short: string;
};

// Marca por asiento que agrega el almacén en la demo: true mientras un bot del
// piloto automático tiene ese puesto (cuenta como conectado toda la ronda).
type BotMark = { bot?: boolean };

const key = (orgId: string, roleId: string) => `${orgId}/${roleId}`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

/** Puestos que juega un bot: la marca por asiento si viaja, o los del ensayo automático. */
function botKeys(room: ProjectedRoomState): Set<string> {
  const keys = new Set((room.autopilot?.running ? room.autopilot.botSeats : []).map((seat) => key(seat.orgId, seat.roleId)));
  for (const org of room.orgs) for (const role of org.roles) if ((role as BotMark).bot) keys.add(key(org.orgId, role.id));
  const arbiter = room.scarcity?.arbiter as (BotMark & { orgId: string; roleId: string }) | undefined;
  if (arbiter?.bot) keys.add(key(arbiter.orgId, arbiter.roleId));
  return keys;
}

/**
 * Sala de demo: 3 personas y 3 toques. Hospital A presenta, Hospital B presenta y
 * el Comité decide; los roles administrativos los juega el piloto automático.
 * Lo dice el servidor con `demo` (las salas fijas entre organizaciones y las que
 * se abren con `demo: true`). Si un servidor viejo no lo manda, no es demo.
 */
export function isDemoRoom(room: ProjectedRoomState): boolean {
  return room.demo === true && room.mode === "cross_org" && !!room.scarcity;
}

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
  const demo = isDemoRoom(room);
  const bots = botKeys(room);
  const seats: Seat[] = [];
  room.orgs.forEach((org, orgIndex) => {
    for (const role of org.roles) {
      // En una sala entre organizaciones el Comité es el de la red, no el de cada una.
      if (role.isQrOptional && (arbiter || orgIndex > 0)) continue;
      const kind: SeatKind = role.isQrOptional ? "arbiter" : role.id === org.authorityRule.proposerRoleId ? "proposer" : role.id === org.authorityRule.approverRoleId ? "approver" : "other";
      const tone = kind === "arbiter" ? ARBITER_TONE : kind === "other" ? OTHER_TONE : (orgIndex % 2) * 2 + (kind === "proposer" ? 0 : 1);
      const id = key(org.orgId, role.id);
      // En la demo, cada organización pone una persona (quien presenta el caso); lo demás es automático.
      const human = !demo || kind === "proposer" || kind === "arbiter";
      // Quien presenta se nombra por su etiqueta corta («Urgencias»); el resto, por su título, que trae tildes.
      const short = kind === "arbiter" ? "Comité" : `${shortLabel(org.orgName)} · ${kind === "proposer" ? capitalize(role.shortTag) : shortLabel(role.title)}`;
      seats.push({ id, label: role.title, org: org.orgName, kind, tone, connected: role.connected, bot: bots.has(id) || (demo && !human), human, short });
    }
  });
  if (arbiter) {
    const id = key(arbiter.orgId, arbiter.roleId);
    seats.push({ id, label: arbiter.title, org: "", kind: "arbiter", tone: ARBITER_TONE, connected: arbiter.connected, bot: bots.has(id), human: true, short: "Comité" });
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
