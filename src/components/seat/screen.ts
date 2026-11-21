// Lo que la silla necesita saber para dibujarse, calculado solo con el estado
// que envió el servidor (ProjectedRoomState). Sin estado ni efectos, y sin
// decidir nada: quién puede hacer qué lo vuelve a revisar el servidor.

import type { HumanDecision, ProjectedField, ProjectedOrg, ProjectedRoomState } from "@/lib/genome/schema";
import { formatValue, isArbiter, type RoleViewer } from "@/components/organs/format";

/** Por qué esta persona está esperando. Sigue el mismo orden que seatTurn (nexo/guide.ts). */
export type WaitReason = "cases" | "limit" | "signature" | "committee" | "other-org";

export function waitReason(room: ProjectedRoomState, me: RoleViewer): WaitReason {
  const cross = room.mode === "cross_org" && !!room.scarcity && !!room.allocation;
  if (cross && isArbiter(room)) return "cases";
  const org = room.orgs.find((entry) => entry.orgId === me.orgId);
  // En la sala de demo, quien presenta no espera el límite ni la firma: los hacen los bots.
  const presents = room.scarcity?.candidates.some((candidate) => candidate.orgId === me.orgId && candidate.proposerRoleId === me.roleId);
  if (room.demo && presents) return cross && room.allocation?.status === "PROPOSED" ? "committee" : "other-org";
  if (org?.conflict.hasConflict) return "limit";
  if (org?.gate.status === "BLOCKED_HITL_REQUIRED") return "signature";
  if (cross && room.allocation?.status === "PROPOSED") return "committee";
  return "other-org";
}

export type FieldRow = { org: ProjectedOrg; field: ProjectedField };

/** Datos que llegaron a este teléfono y datos que el servidor no envió. */
export function splitFields(room: ProjectedRoomState): { visible: FieldRow[]; hidden: FieldRow[] } {
  const rows = room.orgs.flatMap((org) => org.fields.map((field) => ({ org, field })));
  return { visible: rows.filter((row) => !row.field.redacted), hidden: rows.filter((row) => row.field.redacted) };
}

/** Los dos chips de la tarjeta «Te tocó»: un dato que sí ve y cuántos no. */
export function revealChips(room: ProjectedRoomState, me: RoleViewer): { sees: string; hidden: string } {
  const { visible, hidden } = splitFields(room);
  const own = visible.find((row) => row.org.orgId === me.orgId && row.field.ownerRoleId === me.roleId) ?? visible[0];
  const sees =
    own && !own.field.redacted
      ? `${own.field.label}: ${formatValue(own.field.value, own.field.unit)}`
      : room.allocation
        ? "Ves los puntajes"
        : "Ves la propuesta";
  return { sees, hidden: hidden.length === 1 ? "1 dato oculto" : `${hidden.length} datos ocultos` };
}

/** Palabras de cada escenario para las misiones de la demo. */
const DEMO_WORDS: Record<string, { present: string; decide: string }> = {
  hospitales: { present: "Tu paciente necesita la cama. Preséntalo.", decide: "Elige quién recibe la cama y di por qué." },
  construccion: { present: "Tu obra necesita la grúa. Preséntala.", decide: "Elige qué obra usa la grúa y di por qué." },
  logistica: { present: "Tu carga necesita el camión. Preséntala.", decide: "Elige qué carga va en el camión y di por qué." },
};

/**
 * Misión de una frase, sin jerga. En la sala de demo, para los 3 asientos
 * humanos: quien presenta su caso y el Comité. En el resto, la del genoma.
 */
export function mission(room: ProjectedRoomState, me: RoleViewer): string {
  const role = room.orgs.find((org) => org.orgId === me.orgId)?.roles.find((entry) => entry.id === me.roleId);
  const words = DEMO_WORDS[room.scenarioId ?? ""] ?? { present: "Tu caso necesita el recurso. Preséntalo.", decide: "Elige quién recibe el recurso y di por qué." };
  if (isArbiter(room)) return words.decide;
  const presents = room.scarcity?.candidates.some((candidate) => candidate.orgId === me.orgId && candidate.proposerRoleId === me.roleId);
  if (room.demo && presents) return words.present;
  return role?.objective ?? words.decide;
}

/** Asientos que juega una persona en la sala de demo: quien presenta cada caso. El Comité entra con su QR. */
export function demoHumanSeat(room: ProjectedRoomState, orgId: string, roleId: string): boolean {
  return !!room.scarcity?.candidates.some((candidate) => candidate.orgId === orgId && candidate.proposerRoleId === roleId);
}

/** Pasos de la sala de demo, los mismos que muestra la pantalla grande. */
export const DEMO_STEPS = ["Unirse", "Casos", "Comité", "Acta"];

/**
 * En qué paso va una sala de demo: Unirse (faltan personas), Casos (faltan casos
 * por presentar), Comité (la asignación espera su firma) y Acta (decidido). Sin
 * «Acordar límites» ni «Firmar»: esos los hacen los bots.
 */
export function demoStep(room: ProjectedRoomState): { index: number; total: number; labels: string[]; done: boolean } {
  const total = DEMO_STEPS.length;
  const candidates = room.scarcity?.candidates ?? [];
  const humans = candidates.map((candidate) => room.orgs.find((org) => org.orgId === candidate.orgId)?.roles.find((role) => role.id === candidate.proposerRoleId));
  const everyoneIn = humans.every((role) => role?.connected && !role.bot) && room.scarcity?.arbiter.connected === true;
  const index =
    room.allocation?.status === "SEALED" ? 3 : room.allocation?.status === "PROPOSED" ? 2 : everyoneIn || candidates.some((candidate) => candidate.submitted) ? 1 : 0;
  return { index, total, labels: DEMO_STEPS, done: index === total - 1 };
}

/** Última decisión humana sobre la compuerta de una organización. */
export function lastGateDecision(room: ProjectedRoomState, org: ProjectedOrg): HumanDecision | null {
  const own = room.decisions.filter((decision) => decision.scope === "gate" && (decision.targetOrgId ?? decision.byOrgId) === org.orgId);
  return own.at(-1) ?? null;
}

export type SeatInfo = { key: string; orgId: string; roleId: string; title: string; accent: "emerald" | "amber" | "violet"; connected: boolean; bot: boolean };

/**
 * Sillas que se juegan en esta sala, con quién está conectado. En una sala entre
 * organizaciones el Comité es el árbitro de la red y va al final; el rol interno
 * que entra por QR en cada organización solo aparece si alguien lo ocupa.
 */
export function seats(room: ProjectedRoomState): { orgName: string; seats: SeatInfo[] }[] {
  const arbiter = room.scarcity?.arbiter;
  const groups = room.orgs.map((org) => ({
    orgName: org.orgName,
    seats: org.roles
      .filter((role) => !arbiter || !role.isQrOptional || role.connected)
      .map((role): SeatInfo => ({ key: `${org.orgId}/${role.id}`, orgId: org.orgId, roleId: role.id, title: role.title, accent: role.accentColor, connected: role.connected, bot: role.bot === true })),
  }));
  if (arbiter) {
    groups.push({
      orgName: "Entre organizaciones",
      seats: [{ key: `${arbiter.orgId}/${arbiter.roleId}`, orgId: arbiter.orgId, roleId: arbiter.roleId, title: arbiter.title, accent: "violet", connected: arbiter.connected, bot: arbiter.bot === true }],
    });
  }
  return groups;
}

/**
 * Cuántas sillas libres podrían tocar en un sorteo, sin contar la propia. Es
 * solo para decidir si se ofrece «Sortear otro rol»: quién recibe qué silla lo
 * decide el servidor. El Comité cuenta únicamente si este teléfono trae su clave.
 */
export function freeDrawSeats(room: ProjectedRoomState, withCommittee: boolean, me?: RoleViewer | null): number {
  const arbiter = room.scarcity?.arbiter;
  const drawable = room.orgs.flatMap((org) =>
    org.roles.filter((role) => (room.demo ? demoHumanSeat(room, org.orgId, role.id) : role.isQrOptional ? !arbiter && withCommittee : true)).map((role) => ({ orgId: org.orgId, roleId: role.id as string, connected: role.connected })),
  );
  if (arbiter && withCommittee) drawable.push({ orgId: arbiter.orgId, roleId: arbiter.roleId, connected: arbiter.connected });
  return drawable.filter((seat) => !seat.connected && !(me && me.orgId === seat.orgId && me.roleId === seat.roleId)).length;
}
