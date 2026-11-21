// «Historia de la decisión»: la pantalla grande cuenta en qué va la sala con
// pocas palabras grandes. Este módulo solo traduce el estado que envió el
// servidor (ProjectedRoomState) a esa historia; no decide nada.

import type { ProjectedOrg, ProjectedRoomState } from "@/lib/genome/schema";
import { formatScore, formatValue } from "@/components/organs/format";
import { isDemoRoom, shortLabel, stageSeats } from "./seats";

export type StoryStep = { id: string; label: string };
export type StoryProgress = { steps: StoryStep[]; index: number; done: boolean };

const CROSS_STEPS: StoryStep[] = [
  { id: "join", label: "Unirse" },
  { id: "limits", label: "Límites" },
  { id: "cases", label: "Casos" },
  { id: "committee", label: "Comité" },
  { id: "acta", label: "Acta" },
];
// Sala de demo: los límites y las firmas internas los hace el piloto automático, así que no son un paso.
const DEMO_STEPS: StoryStep[] = [
  { id: "join", label: "Unirse" },
  { id: "cases", label: "Casos" },
  { id: "committee", label: "Comité" },
  { id: "acta", label: "Acta" },
];
const SINGLE_STEPS: StoryStep[] = [
  { id: "join", label: "Unirse" },
  { id: "limits", label: "Límites" },
  { id: "sign", label: "Firma" },
  { id: "acta", label: "Acta" },
];

const roleTitle = (org: ProjectedOrg, roleId: string | null | undefined) => org.roles.find((role) => role.id === roleId)?.title ?? "una persona";

// Lo que ya es trabajo sobre el caso: si pasó algo de esto, la sala dejó atrás el paso «Unirse».
const WORK: ReadonlySet<string> = new Set(["RULE_SEALED", "HITL_APPROVED", "HITL_VETOED", "COUNTER_PROPOSED", "CANDIDATE_SUBMITTED", "ALLOCATION_PROPOSED", "ALLOCATION_SEALED", "AGENT_PROPOSED", "AUTOPILOT"]);
// En la demo los bots trabajan desde el principio: solo cuenta lo que hacen las personas.
const DEMO_WORK: ReadonlySet<string> = new Set(["CANDIDATE_SUBMITTED", "ALLOCATION_PROPOSED", "ALLOCATION_SEALED"]);

/**
 * La sala ya partió: están sentados todos los que trabajan el caso (el Comité
 * entra después, por su código) o alguien ya hizo algo. Antes de eso, la
 * pantalla grande muestra el paso «Unirse» con la galaxia.
 */
export function roomStarted(room: ProjectedRoomState): boolean {
  const demo = isDemoRoom(room);
  const players = stageSeats(room).filter((seat) => seat.kind !== "arbiter" && seat.human);
  const work = demo ? DEMO_WORK : WORK;
  return (players.length > 0 && players.every((seat) => seat.connected)) || room.auditLog.some((event) => work.has(event.type) && !(demo && event.detail?.bot === true));
}

/** Paso en que va la sala. Unirse mientras falta gente; Acta cuando la decisión quedó sellada. */
export function storyProgress(room: ProjectedRoomState): StoryProgress {
  const cross = room.mode === "cross_org" && !!room.allocation;
  const anyone = roomStarted(room);
  if (cross && isDemoRoom(room)) {
    const status = room.allocation!.status;
    const index = status === "SEALED" ? 3 : status === "PROPOSED" ? 2 : anyone ? 1 : 0;
    return { steps: DEMO_STEPS, index, done: index === 3 };
  }
  const steps = cross ? CROSS_STEPS : SINGLE_STEPS;
  const conflict = room.orgs.some((org) => org.conflict.hasConflict);
  let index: number;
  if (cross) {
    const status = room.allocation!.status;
    if (status === "SEALED") index = 4;
    else if (status === "PROPOSED") index = 3;
    else if (!anyone) index = 0;
    // Entre organizaciones, una firma pendiente no impide presentar el caso: el
    // paso «Límites» depende solo de los límites en disputa, igual que la frase de abajo.
    else if (conflict) index = 1;
    else index = 2;
  } else {
    const sealed = room.orgs[0]?.gate.status === "SEALED";
    index = sealed ? 3 : !anyone ? 0 : conflict ? 1 : 2;
  }
  return { steps, index, done: index === steps.length - 1 };
}

/** Franja del recurso: la cantidad y el nombre en grande, el plazo y si sigue esperando. */
export function storyResource(room: ProjectedRoomState): { quantity: string; name: string; detail: string } {
  if (room.mode === "cross_org" && room.scarcity) {
    const full = room.scarcity.resource.replace(/\s*\(.*\)\s*$/, "");
    // En la demo, el recurso en una o dos palabras: «Cama UCI».
    const name = isDemoRoom(room) ? shortLabel(full) : full;
    return { quantity: String(room.scarcity.rule.resourceQuantity), name, detail: room.scarcity.stakesLabel };
  }
  const org = room.orgs[0];
  return { quantity: "1", name: org?.liveCase.title ?? "Caso", detail: org?.liveCase.stakesLabel ?? "" };
}

/** Tarjeta de un candidato (o de la organización, en una sala de una sola). */
export type StoryCard = {
  id: string;
  /** Organización del candidato (o la sala), para saber de quién es el turno. */
  orgId: string;
  org: string;
  title: string;
  score: string | null;
  /** Propuesto por la regla (estrella). */
  proposed: boolean;
  /** Recibe el recurso: el Comité ya selló. */
  winner: boolean;
  state: { tone: "calm" | "sign" | "block" | "plain"; text: string };
  /** Datos que no viajan a esta pantalla: solo su nombre (una o dos palabras), nunca el valor. */
  locked: string[];
  /** Un número de apoyo, corto. */
  note?: string;
  /** Explicación que va detrás de «¿Por qué?». */
  why?: string;
};

const lockedLabels = (labels: string[]) => [...new Set(labels.map(shortLabel))].slice(0, 3);

export function storyCards(room: ProjectedRoomState): StoryCard[] {
  const allocation = room.allocation;
  const scarcity = room.scarcity;
  // En la demo basta un candado por tarjeta: el costo, que es la idea central. El resto está en «Organizaciones».
  const demo = isDemoRoom(room);
  // Y cada tarjeta lleva el rol de quien la juega: «Clínica», «Hospital Rural».
  const shorts = new Map(stageSeats(room).map((seat) => [seat.id, seat.short]));
  if (allocation && scarcity) {
    return scarcity.candidates.map((candidate) => {
      const org = room.orgs.find((entry) => entry.orgId === candidate.orgId);
      const ranked = allocation.ranking.find((entry) => entry.caseId === candidate.caseId);
      const vetoed = allocation.vetoedCaseIds.includes(candidate.caseId);
      const proposed = allocation.winnerCaseId === candidate.caseId;
      const winner = proposed && allocation.status === "SEALED";
      const locked = lockedLabels([
        ...(typeof candidate.coverageCost === "number" ? [] : ["Costo"]),
        ...(org?.fields.filter((field) => field.redacted && field.key !== "coverage_cost").map((field) => field.label) ?? []),
      ]);
      const state: StoryCard["state"] = vetoed
        ? { tone: "block", text: "Vetado" }
        : winner
          ? { tone: "calm", text: "Recibe" }
          : proposed
            ? { tone: "sign", text: "Propuesto" }
            : candidate.submitted
              ? { tone: "plain", text: "Presentado" }
              : { tone: "plain", text: "Sin presentar" };
      return {
        id: candidate.caseId,
        orgId: candidate.orgId,
        org: (demo ? (shorts.get(`${candidate.orgId}/${candidate.proposerRoleId}`) ?? (org ? shortLabel(org.orgName) : undefined)) : org?.orgName) ?? candidate.orgId,
        title: candidate.patientLabel,
        score: ranked ? formatScore(ranked.score) : null,
        proposed,
        winner,
        state,
        locked: demo ? locked.slice(0, 1) : locked,
        why: proposed && allocation.tieBreakApplied ? "Casi empatados: va primero quien tiene más necesidad sin cubrir." : undefined,
      };
    });
  }
  return room.orgs.map((org) => {
    const gate = org.gate;
    const rule = org.authorityRule;
    const state: StoryCard["state"] =
      gate.status === "SEALED"
        ? { tone: "calm", text: "Firmado" }
        : gate.status === "BLOCKED_HITL_REQUIRED"
          ? { tone: "block", text: "Falta firma" }
          : org.conflict.hasConflict
            ? { tone: "sign", text: "En disputa" }
            : { tone: "plain", text: "Sin pendientes" };
    return {
      id: org.orgId,
      orgId: org.orgId,
      org: org.orgName,
      title: rule.metricLabel,
      score: formatValue(gate.proposedValue, rule.unit),
      proposed: false,
      winner: gate.status === "SEALED",
      state,
      locked: lockedLabels(org.fields.filter((field) => field.redacted).map((field) => field.label)),
      note: `Límite: ${formatValue(gate.effectiveThreshold, rule.unit)}`,
    };
  });
}

/** La frase grande de abajo: lo que falta ahora y quién tiene que firmar. */
/** Lo que falta ahora. `scan`: en la demo, alguien tiene que entrar con el QR para que la sala siga. */
export type StoryMissing = { lead: "Falta" | "Listo"; text: string; who: string; whoConnected: boolean | null; scan?: boolean };

/**
 * Turno de la demo pauteada: a quién le habla la pantalla grande ahora y qué tiene
 * que apretar. El narrador lo dice en voz alta; la franja lo repite en grande.
 * Si el servidor manda `turn`, manda ese turno (con su cuenta regresiva del plan B:
 * al llegar a 0, el servidor juega ese turno solo). Si no viene (nadie entró
 * todavía, o un servidor sin plan B), se deduce aquí: la primera silla libre, el
 * primer caso pendiente por orden de llegada y después el Comité, sin cuenta regresiva.
 */
export type DemoTurn = {
  seatId: string;
  /** Orden de llegada de esa persona (no se muestra). */
  order: number;
  /** El rol que se muestra: «Clínica», «Hospital Rural», «Comité». */
  who: string;
  /** «presenta a tu paciente», «¿aceptas o rechazas?» o «escanea el QR». */
  text: string;
  /** La persona todavía no entra: hay que mostrarle el código. */
  scan: boolean;
  /** Cuenta regresiva del servidor (plan B). totalMs 0: no hay plan B y no se muestra. */
  remainingMs: number | null;
  totalMs: number;
};

/** Turno que puede mandar el servidor en el estado de la sala (opcional). */
type ServerTurn = { orgId: string; roleId: string; seatOrder?: number; label?: string; action?: "submit" | "decide"; remainingMs?: number; totalMs?: number } | null | undefined;

export function demoTurn(room: ProjectedRoomState): DemoTurn | null {
  if (!isDemoRoom(room) || !room.allocation || !room.scarcity) return null;
  const allocation = room.allocation;
  if (allocation.status === "SEALED") return null;
  const seats = stageSeats(room).filter((seat) => seat.human && seat.order);
  const make = (seatId: string, action: "submit" | "decide" | "join", server?: ServerTurn): DemoTurn | null => {
    const seat = seats.find((entry) => entry.id === seatId);
    if (!seat || !seat.order) return null;
    const scan = !seat.connected;
    const text = scan ? "escanea el QR" : action === "decide" ? "¿aceptas o rechazas?" : action === "submit" ? "presenta a tu paciente" : "escanea el QR";
    return { seatId, order: seat.order, who: server?.label ?? seat.short, text, scan, remainingMs: scan ? null : (server?.remainingMs ?? null), totalMs: scan ? 0 : (server?.totalMs ?? 0) };
  };
  // Mientras falta gente, el turno es de la primera silla libre: que escanee. (El
  // servidor ya puede tener el turno de presentar de quien entró, pero aún no se juega.)
  if (!roomStarted(room)) {
    const free = seats.find((seat) => !seat.connected);
    return free ? make(free.id, "join") : null;
  }
  const server = room.turn as ServerTurn;
  if (server) {
    const turn = make(`${server.orgId}/${server.roleId}`, server.action ?? (server.orgId === room.scarcity.arbiter.orgId ? "decide" : "submit"), server);
    if (turn) return turn;
  }
  if (allocation.status === "PROPOSED") {
    const arbiter = room.scarcity.arbiter;
    return make(`${arbiter.orgId}/${arbiter.roleId}`, "decide");
  }
  const pending = room.scarcity.candidates
    .filter((candidate) => allocation.pendingCaseIds.includes(candidate.caseId))
    .map((candidate) => seats.find((seat) => seat.id === `${candidate.orgId}/${candidate.proposerRoleId}`))
    .filter((seat): seat is NonNullable<typeof seat> => !!seat)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return pending[0] ? make(pending[0].id, "submit") : null;
}

/** En la demo: queda alguna silla de persona libre (los bots cuentan como conectados). */
export function freeHumanSeat(room: ProjectedRoomState): boolean {
  return isDemoRoom(room) && stageSeats(room).some((seat) => seat.human && !seat.connected);
}

export function storyMissing(room: ProjectedRoomState): StoryMissing {
  const allocation = room.allocation;
  const scarcity = room.scarcity;
  const orgOf = (orgId?: string | null) => room.orgs.find((org) => org.orgId === orgId);

  if (allocation && scarcity) {
    if (allocation.status === "SEALED") {
      const winner = allocation.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
      const name = orgOf(winner?.orgId)?.orgName;
      const shown = name && isDemoRoom(room) ? shortLabel(name) : name;
      return { lead: "Listo", text: `${shown ?? winner?.patientLabel ?? "El caso"} recibe el recurso`, who: "Acta lista", whoConnected: null };
    }
    if (allocation.status === "PROPOSED") {
      // En la demo, si el Comité todavía no entra, lo que falta es que alguien escanee el código.
      if (isDemoRoom(room) && !scarcity.arbiter.connected) return { lead: "Falta", text: "escanea el QR", who: "Comité", whoConnected: false, scan: true };
      return { lead: "Falta", text: "el Comité decide", who: isDemoRoom(room) ? "Comité" : scarcity.arbiter.title, whoConnected: scarcity.arbiter.connected };
    }
  }
  const demo = isDemoRoom(room);
  if (!roomStarted(room)) {
    const seats = stageSeats(room).filter((seat) => seat.human);
    return { lead: "Falta", text: "que entren todos", who: `${seats.filter((seat) => seat.connected).length}/${seats.length} conectados`, whoConnected: null };
  }
  // En la demo, los límites y las firmas internas las hace el piloto automático: no se piden en pantalla.
  for (const org of demo ? [] : room.orgs) {
    if (org.conflict.hasConflict) {
      const rule = org.authorityRule;
      const proposer = org.roles.find((role) => role.id === rule.proposerRoleId);
      const approver = org.roles.find((role) => role.id === rule.approverRoleId);
      return {
        lead: "Falta",
        text: `${org.orgName} acuerda su límite`,
        who: `${proposer?.title ?? "Quien propone"} y ${approver?.title ?? "quien aprueba"}`,
        whoConnected: !!proposer?.connected || !!approver?.connected,
      };
    }
  }
  for (const org of demo ? [] : room.orgs) {
    if (org.gate.status === "BLOCKED_HITL_REQUIRED" && !(allocation && scarcity)) {
      const role = org.roles.find((entry) => entry.id === org.gate.pendingApproverRoleId);
      return { lead: "Falta", text: "una firma", who: `${role?.title ?? "Una persona"} · ${org.orgName}`, whoConnected: role?.connected ?? null };
    }
  }
  if (allocation && scarcity) {
    const pending = scarcity.candidates.filter((candidate) => allocation.pendingCaseIds.includes(candidate.caseId));
    if (pending.length > 0) {
      const names = pending.map((candidate) => orgOf(candidate.orgId)?.orgName ?? candidate.orgId);
      // En la demo se nombra a cada persona como en la pantalla «Unirse»: «Clínica · Urgencias».
      const shorts = new Map(stageSeats(room).map((seat) => [seat.id, seat.short]));
      const proposers = pending.map((candidate) => {
        const org = orgOf(candidate.orgId);
        if (demo) return shorts.get(`${candidate.orgId}/${candidate.proposerRoleId}`) ?? candidate.orgId;
        return org ? `${roleTitle(org, candidate.proposerRoleId)} · ${org.orgName}` : candidate.orgId;
      });
      return {
        lead: "Falta",
        text: pending.length === 1 ? `${names[0]} presenta su caso` : "cada organización presenta su caso",
        who: proposers.join(" y "),
        whoConnected: pending.every((candidate) => orgOf(candidate.orgId)?.roles.find((role) => role.id === candidate.proposerRoleId)?.connected),
      };
    }
  }
  const org = room.orgs[0];
  if (org && org.gate.status === "SEALED") return { lead: "Listo", text: "decisión firmada", who: "Acta lista", whoConnected: null };
  return { lead: "Falta", text: "la primera propuesta", who: org ? roleTitle(org, org.authorityRule.proposerRoleId) : "", whoConnected: null };
}
