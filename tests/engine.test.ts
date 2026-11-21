// Pruebas del motor determinista (src/lib/engine/deterministic.ts).
//
// Siguen el plan de verificación del proyecto:
//   1. Permisos: lo que un viewer no puede ver no está en lo que se le envía. Se
//      comprueba serializando a JSON y buscando los valores, que es lo que vería
//      alguien inspeccionando el tráfico de red.
//   2. Lectura protegida: 403 RBAC_DENIED dentro de una organización y entre
//      organizaciones, y siempre queda en la bitácora.
//   3. Choque de autoridad: aparece y desaparece al sellar la regla.
//   4. Compuerta: determinista.
//   5. Asignación: reproducible, con desempate de equidad ante empate.
//   6. Confiabilidad p^n: sube al sellar la regla y al sellar el Comité.
//   7. Contador: pasa de BLEEDING a CONTAINED.
//   8. Acta: trae toda la bitácora y ningún valor reservado.
//
// El motor es puro, así que estas pruebas no usan red, reloj ni modelo: el reloj
// del servidor entra como parámetro.

import { describe, expect, it } from "vitest";
import {
  ACTA_DISCLAIMER,
  PROJECTED_AUDIT_LIMIT,
  attemptProtectedRead,
  buildAuditActa,
  computeCrossOrgReliabilityPn,
  computeReliabilityPn,
  computeSharedStakesCounter,
  computeTriageScore,
  detectRuleConflict,
  evaluateGate,
  markRoleJoined,
  openRoom,
  projectStateForOrgAndRole,
  recordCommitteeDecision,
  recordGateDecision,
  renderActaMarkdown,
  resolveAllocation,
  sealAllocation,
  sealRule,
  submitCandidate,
  toggleFieldSecret,
  updateAuthoritySlider,
  type ActorRef,
  type EngineResult,
} from "../src/lib/engine/deterministic";
import { ProjectedRoomStateSchema, type OrgCandidate, type RoomState, type SharedScarcity, type Telemetry, type Viewer } from "../src/lib/genome/schema";
import { getInitialCrossOrgRoom, getInitialSingleOrgRoom, getSeedGenome, getSeedScarcity } from "../src/lib/genome/seeds";

// --- Apoyo ---------------------------------------------------------------------

const T0 = 1_800_000_000_000;
const TELEMETRY: Telemetry = { modelName: "prueba", provider: "local", endpointHost: "localhost:11434", bytesSentToCloud: 0, queueDepth: 0, lastLatencyMs: 0, tokensPerSec: 0 };

const CLINIC = "clinica_andes";
const RURAL = "hospital_rural";
const A_CLINIC: ActorRef = { orgId: CLINIC, roleId: "role_a" };
const B_CLINIC: ActorRef = { orgId: CLINIC, roleId: "role_b" };
const C_CLINIC: ActorRef = { orgId: CLINIC, roleId: "role_c" };
const A_RURAL: ActorRef = { orgId: RURAL, roleId: "role_a" };
const B_RURAL: ActorRef = { orgId: RURAL, roleId: "role_b" };
const C_RURAL: ActorRef = { orgId: RURAL, roleId: "role_c" };
const ARBITER: ActorRef = { orgId: "comite_red", roleId: "role_c" };

const CROSS_VIEWERS: Viewer[] = [A_CLINIC, B_CLINIC, C_CLINIC, A_RURAL, B_RURAL, C_RURAL, ARBITER, "stage"];

/** Congela en profundidad: si el motor intentara modificar su entrada, la prueba falla. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function singleRoom(): RoomState {
  return deepFreeze(openRoom(getInitialSingleOrgRoom("sala-uno", CLINIC, { now: T0, telemetry: TELEMETRY }), T0));
}

function crossRoom(): RoomState {
  return deepFreeze(openRoom(getInitialCrossOrgRoom("sala-cruzada", { now: T0, telemetry: TELEMETRY }), T0));
}

/** Exige que el motor haya aceptado la acción y devuelve el estado nuevo, congelado. */
function accepted(result: EngineResult): RoomState {
  if (!result.ok) throw new Error(`El motor rechazó la acción: ${result.status} ${result.code} · ${result.message}`);
  return deepFreeze(result.state);
}

function rejected(result: EngineResult) {
  if (result.ok) throw new Error("El motor aceptó una acción que debía rechazar");
  return result;
}

const view = (state: RoomState, viewer: Viewer, nowTs = T0) => projectStateForOrgAndRole(state, viewer, nowTs);
const wire = (state: RoomState, viewer: Viewer, nowTs = T0) => JSON.stringify(view(state, viewer, nowTs));
const genomeOf = (state: RoomState, orgId: string) => state.orgGenomes.find((genome) => genome.orgId === orgId)!;
const eventsOf = (state: RoomState, type: string) => state.auditLog.filter((event) => event.type === type);

/** Valores no públicos de una organización que son lo bastante largos para buscarlos como texto. */
function reservedValues(state: RoomState, orgId: string): string[] {
  const fromFields = genomeOf(state, orgId)
    .fields.filter((field) => field.classification !== "public")
    .map((field) => String(field.value));
  const fromCandidates = (state.scarcity?.candidates ?? []).filter((candidate) => candidate.orgId === orgId).map((candidate) => String(candidate.coverageCost));
  return [...new Set([...fromFields, ...fromCandidates])].filter((value) => value.length >= 4);
}

/** Lleva una sala cross_org hasta la asignación propuesta: reglas selladas, compuertas firmadas y candidatos presentados. */
function crossRoomProposed(): RoomState {
  let state = crossRoom();
  let clock = T0;
  for (const [approver, proposer] of [[B_CLINIC, A_CLINIC], [B_RURAL, A_RURAL]] as const) {
    state = accepted(sealRule(state, approver, {}, (clock += 500)));
    state = accepted(recordGateDecision(state, approver, { decision: "APPROVE", reason: `Firma de ${approver.orgId}` }, (clock += 500)));
    state = accepted(submitCandidate(state, proposer, undefined, (clock += 500)));
  }
  return state;
}

/** Generador pseudoaleatorio con semilla: las pruebas "al azar" son siempre las mismas. */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- 1. Permisos: la vista de cada viewer ----------------------------------------

describe("projectStateForOrgAndRole: lo reservado no sale del servidor", () => {
  it("ningún rol de hospital_rural recibe el costo de cobertura ni los campos reservados de clinica_andes", () => {
    const state = crossRoom();
    const secrets = reservedValues(state, CLINIC);
    expect(secrets).toEqual(expect.arrayContaining(["2400000", "18/40", "3100000"]));
    for (const viewer of [A_RURAL, B_RURAL, C_RURAL]) {
      const json = wire(state, viewer);
      for (const secret of secrets) expect(json, `${viewer.roleId} de hospital_rural recibió ${secret}`).not.toContain(secret);
    }
  });

  it("ningún rol de clinica_andes recibe el costo de cobertura ni los campos reservados de hospital_rural", () => {
    const state = crossRoom();
    const secrets = reservedValues(state, RURAL);
    expect(secrets).toEqual(expect.arrayContaining(["1600000", "22/40", "1900000"]));
    for (const viewer of [A_CLINIC, B_CLINIC, C_CLINIC]) {
      const json = wire(state, viewer);
      for (const secret of secrets) expect(json, `${viewer.roleId} de clinica_andes recibió ${secret}`).not.toContain(secret);
    }
  });

  it("para otra organización, todos los campos vienen sin valor y el costo del candidato viene oculto", () => {
    const projected = view(crossRoom(), B_RURAL);
    const clinic = projected.orgs.find((org) => org.orgId === CLINIC)!;
    for (const field of clinic.fields) {
      expect(field.redacted, field.key).toBe(true);
      expect(field, field.key).not.toHaveProperty("value");
      expect(field, field.key).not.toHaveProperty("visibleToRoleIds");
      expect(field, field.key).not.toHaveProperty("visibleToOrgIds");
      expect(field).toMatchObject({ reason: "RBAC_SERVER_FILTERED" });
    }
    const candidate = projected.scarcity!.candidates.find((entry) => entry.orgId === CLINIC)!;
    expect(candidate.coverageCost).toEqual({ redacted: true, reason: "RBAC_SERVER_FILTERED" });
    expect(candidate).not.toHaveProperty("coverageCostVisibleToOrgs");
  });

  it("dentro de la organización, el rol clínico no recibe el costo: ni por el campo ni por la lista de candidatos", () => {
    const state = crossRoom();
    const json = wire(state, A_CLINIC);
    expect(json).not.toContain("2400000");
    expect(json).not.toContain("3100000");
    expect(json).toContain("18/40");
    const own = view(state, A_CLINIC).scarcity!.candidates.find((entry) => entry.orgId === CLINIC)!;
    expect(own.coverageCost).toEqual({ redacted: true, reason: "RBAC_SERVER_FILTERED" });
  });

  it("el rol administrativo sí recibe su costo y no recibe la gravedad clínica", () => {
    const state = crossRoom();
    const projected = view(state, B_CLINIC);
    expect(projected.scarcity!.candidates.find((entry) => entry.orgId === CLINIC)!.coverageCost).toBe(2400000);
    expect(projected.orgs.find((org) => org.orgId === CLINIC)!.fields.find((field) => field.key === "coverage_cost")).toMatchObject({ redacted: false, value: 2400000 });
    expect(wire(state, B_CLINIC)).not.toContain("18/40");
  });

  it("el Comité árbitro y la pantalla general no reciben ningún valor reservado de ninguna organización", () => {
    const state = crossRoom();
    const secrets = [...reservedValues(state, CLINIC), ...reservedValues(state, RURAL)];
    for (const viewer of [ARBITER, "stage"] as Viewer[]) {
      const projected = view(state, viewer);
      const json = JSON.stringify(projected);
      for (const secret of secrets) expect(json, `${JSON.stringify(viewer)} recibió ${secret}`).not.toContain(secret);
      for (const candidate of projected.scarcity!.candidates) expect(typeof candidate.coverageCost).toBe("object");
    }
  });

  it("en una sola organización, la pantalla general solo recibe lo que ven todos los roles", () => {
    const projected = view(singleRoom(), "stage");
    const visible = projected.orgs[0].fields.filter((field) => !field.redacted).map((field) => field.key);
    expect(visible.sort()).toEqual(["deadline_window", "icu_beds_available"]);
    const json = JSON.stringify(projected);
    for (const secret of ["2400000", "3100000", "18/40"]) expect(json).not.toContain(secret);
  });

  it("un viewer desconocido, o de una organización que no está en la sala, recibe la vista general", () => {
    const state = crossRoom();
    for (const viewer of [{ orgId: "org_inventada", roleId: "role_a" }, { orgId: CLINIC, roleId: "role_z" }, { orgId: "comite_red", roleId: "role_a" }]) {
      const projected = view(state, viewer);
      expect(projected.viewer).toBe("stage");
      expect(JSON.stringify(projected)).not.toContain("2400000");
    }
  });

  it("regla doble, campo por campo: el valor viaja si y solo si la organización Y el rol están autorizados", () => {
    // Cada campo y cada costo recibe un valor centinela único; así se sabe exactamente qué viajó.
    const base = getInitialCrossOrgRoom("centinelas", { now: T0, telemetry: TELEMETRY });
    base.orgGenomes.forEach((genome) => genome.fields.forEach((field) => (field.value = `CENTINELA_${genome.orgId}_${field.key}`)));
    base.scarcity!.candidates.forEach((candidate, index) => (candidate.coverageCost = 91000001 + index));
    const state = openRoom(base, T0);

    for (const viewer of CROSS_VIEWERS) {
      const json = wire(state, viewer);
      for (const genome of state.orgGenomes) {
        for (const field of genome.fields) {
          const allowed =
            viewer === "stage"
              ? state.orgGenomes.every((org) => field.visibleToOrgIds.includes(org.orgId)) && genome.roles.every((role) => field.visibleToRoleIds.includes(role.id))
              : field.visibleToOrgIds.includes(viewer.orgId) && field.visibleToRoleIds.includes(viewer.roleId);
          expect(json.includes(String(field.value)), `${JSON.stringify(viewer)} y ${genome.orgId}.${field.key}`).toBe(allowed);
        }
      }
      for (const candidate of state.scarcity!.candidates) {
        const guard = genomeOf(state, candidate.orgId).fields.find((field) => field.key === "coverage_cost")!;
        const allowed = viewer !== "stage" && viewer.orgId === candidate.orgId && guard.visibleToRoleIds.includes(viewer.roleId);
        expect(json.includes(String(candidate.coverageCost)), `${JSON.stringify(viewer)} y costo de ${candidate.caseId}`).toBe(allowed);
      }
    }
  });

  it("la regla doble se cumple con 300 configuraciones de visibilidad generadas al azar", () => {
    const random = seededRandom(20261121);
    const allOrgs = [CLINIC, RURAL, "comite_red"];
    const allRoles = ["role_a", "role_b", "role_c"];
    const subset = (items: string[]) => items.filter(() => random() < 0.5);

    for (let round = 0; round < 300; round++) {
      const base = getInitialCrossOrgRoom("azar", { now: T0, telemetry: TELEMETRY });
      base.orgGenomes.forEach((genome) =>
        genome.fields.forEach((field) => {
          field.value = `AZAR_${round}_${genome.orgId}_${field.key}`;
          field.visibleToOrgIds = subset(allOrgs);
          field.visibleToRoleIds = subset(allRoles);
        }),
      );
      const state = openRoom(base, T0);
      for (const viewer of CROSS_VIEWERS) {
        if (viewer === "stage") continue;
        const json = wire(state, viewer);
        for (const genome of state.orgGenomes) {
          for (const field of genome.fields) {
            const allowed = field.visibleToOrgIds.includes(viewer.orgId) && field.visibleToRoleIds.includes(viewer.roleId);
            if (json.includes(String(field.value)) !== allowed) {
              throw new Error(`Ronda ${round}: ${JSON.stringify(viewer)} ${allowed ? "debía recibir" : "recibió sin permiso"} ${genome.orgId}.${field.key} (orgs ${field.visibleToOrgIds}, roles ${field.visibleToRoleIds})`);
            }
          }
        }
      }
    }
  });

  it("lo que se envía cumple el contrato ProjectedRoomState para todos los viewers", () => {
    for (const [state, viewers] of [[singleRoom(), [A_CLINIC, B_CLINIC, C_CLINIC, "stage"]], [crossRoomProposed(), CROSS_VIEWERS]] as [RoomState, Viewer[]][]) {
      for (const viewer of viewers) {
        const result = ProjectedRoomStateSchema.safeParse(view(state, viewer));
        expect(result.success ? [] : result.error.issues, JSON.stringify(viewer)).toEqual([]);
      }
    }
  });

  it("compartir un campo lo entrega a los roles de la organización y a nadie de fuera; reservarlo lo vuelve a quitar", () => {
    const state = crossRoom();
    const shared = accepted(toggleFieldSecret(state, B_CLINIC, "coverage_cost", T0 + 1));
    expect(wire(shared, A_CLINIC)).toContain("2400000");
    expect(wire(shared, C_CLINIC)).toContain("2400000");
    for (const viewer of [A_RURAL, B_RURAL, C_RURAL, ARBITER, "stage"] as Viewer[]) expect(wire(shared, viewer), JSON.stringify(viewer)).not.toContain("2400000");

    const reserved = accepted(toggleFieldSecret(shared, B_CLINIC, "coverage_cost", T0 + 2));
    expect(wire(reserved, A_CLINIC)).not.toContain("2400000");
    expect(wire(reserved, B_CLINIC)).toContain("2400000");
  });

  it("solo el rol dueño puede cambiar la visibilidad de un campo: 403 y queda en la bitácora", () => {
    const state = crossRoom();
    const result = rejected(toggleFieldSecret(state, A_CLINIC, "coverage_cost", T0 + 1));
    expect(result).toMatchObject({ status: 403, code: "RBAC_DENIED" });
    expect(eventsOf(result.state!, "RBAC_DENIED").at(-1)).toMatchObject({ orgId: CLINIC, roleId: "role_a" });
    expect(wire(result.state!, A_CLINIC)).not.toContain("2400000");
  });

  it("después de un recorrido completo con rechazos, vetos y sello, ninguna vista ni la bitácora filtran nada", () => {
    let state = crossRoomProposed();
    state = deepFreeze(rejected(attemptProtectedRead(state, B_RURAL, { orgId: CLINIC, fieldKey: "coverage_cost" }, T0 + 4000)).state!);
    state = deepFreeze(rejected(attemptProtectedRead(state, A_CLINIC, { fieldKey: "coverage_cost" }, T0 + 4100)).state!);
    state = accepted(markRoleJoined(state, ARBITER, T0 + 4200));
    state = accepted(recordCommitteeDecision(state, ARBITER, { decision: "VETO", reason: "Falta respaldo clínico" }, T0 + 5000));
    state = accepted(sealAllocation(state, ARBITER, "Se confirma la asignación", T0 + 6000));

    for (const [own, other] of [[CLINIC, RURAL], [RURAL, CLINIC]]) {
      for (const roleId of ["role_a", "role_b", "role_c"]) {
        const json = wire(state, { orgId: own, roleId }, T0 + 7000);
        for (const secret of reservedValues(state, other)) expect(json, `${own}/${roleId} recibió ${secret}`).not.toContain(secret);
      }
    }
    const everything = [...reservedValues(state, CLINIC), ...reservedValues(state, RURAL)];
    const log = JSON.stringify(state.auditLog);
    for (const secret of everything) {
      expect(log, `la bitácora contiene ${secret}`).not.toContain(secret);
      expect(wire(state, "stage", T0 + 7000)).not.toContain(secret);
      expect(wire(state, ARBITER, T0 + 7000)).not.toContain(secret);
    }
  });
});

// --- 2. Lectura protegida ----------------------------------------------------------

describe("attemptProtectedRead: 403 RBAC_DENIED y evento en la bitácora", () => {
  it("dentro de la organización: el rol clínico no puede leer el costo", () => {
    const state = singleRoom();
    const result = rejected(attemptProtectedRead(state, A_CLINIC, { fieldKey: "coverage_cost" }, T0 + 500));
    expect(result).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });

    const logged = result.state!;
    expect(logged.auditLog).toHaveLength(state.auditLog.length + 1);
    expect(logged.version).toBe(state.version + 1);
    const event = logged.auditLog.at(-1)!;
    expect(event).toMatchObject({ ts: T0 + 500, type: "RBAC_DENIED", orgId: CLINIC, roleId: "role_a" });
    expect(event.detail).toMatchObject({ status: 403, fieldKey: "coverage_cost", targetOrgId: CLINIC, crossOrg: false });
    expect(String(event.detail.rule)).toContain("visibleToRoleIds");
  });

  it("entre organizaciones: hospital_rural no puede leer el costo de clinica_andes", () => {
    const state = crossRoom();
    const result = rejected(attemptProtectedRead(state, B_RURAL, { orgId: CLINIC, fieldKey: "coverage_cost" }, T0 + 700));
    expect(result).toMatchObject({ status: 403, code: "RBAC_DENIED" });
    const event = result.state!.auditLog.at(-1)!;
    expect(event).toMatchObject({ ts: T0 + 700, type: "RBAC_DENIED", orgId: RURAL, roleId: "role_b" });
    expect(event.detail).toMatchObject({ targetOrgId: CLINIC, crossOrg: true });
    expect(String(event.detail.rule)).toContain("visibleToOrgIds");
  });

  it("el rechazo no revela el valor: ni en el mensaje ni en la bitácora", () => {
    const result = rejected(attemptProtectedRead(crossRoom(), B_RURAL, { orgId: CLINIC, fieldKey: "coverage_cost" }, T0));
    expect(result.message).not.toContain("2400000");
    expect(JSON.stringify(result.state!.auditLog)).not.toContain("2400000");
  });

  it("siempre rechaza: todo rol de fuera contra todo campo reservado, incluido el Comité árbitro", () => {
    const state = crossRoom();
    for (const requester of [A_RURAL, B_RURAL, C_RURAL, ARBITER]) {
      for (const field of genomeOf(state, CLINIC).fields) {
        const result = attemptProtectedRead(state, requester, { orgId: CLINIC, fieldKey: field.key }, T0);
        expect(result, `${requester.orgId}/${requester.roleId} leyendo ${field.key}`).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });
        expect(rejected(result).state!.auditLog.at(-1)).toMatchObject({ type: "RBAC_DENIED", orgId: requester.orgId, roleId: requester.roleId });
      }
    }
  });

  it("con permiso devuelve el valor y no deja evento", () => {
    const state = singleRoom();
    const result = attemptProtectedRead(state, B_CLINIC, { fieldKey: "coverage_cost" }, T0);
    expect(result).toMatchObject({ ok: true, value: 2400000 });
    expect(result.ok && result.state.auditLog).toHaveLength(state.auditLog.length);
  });

  it("un rol o un campo que no existen dan 404, sin evento", () => {
    const state = singleRoom();
    expect(attemptProtectedRead(state, { orgId: CLINIC, roleId: "role_z" }, { fieldKey: "coverage_cost" }, T0)).toMatchObject({ ok: false, status: 404, code: "ROLE_NOT_FOUND" });
    expect(attemptProtectedRead(state, A_CLINIC, { fieldKey: "campo_inventado" }, T0)).toMatchObject({ ok: false, status: 404, code: "FIELD_NOT_FOUND" });
  });
});

// --- 3. Choque de autoridad -------------------------------------------------------

describe("detectRuleConflict: el choque aparece y desaparece al sellar", () => {
  it("la semilla parte con choque: el proponente cree que decide hasta 100 y el aprobador le reconoce 60", () => {
    const conflict = detectRuleConflict(getSeedGenome(CLINIC).authorityRule);
    expect(conflict).toMatchObject({ hasConflict: true, delta: 40, proposerRoleId: "role_a", approverRoleId: "role_b" });
    expect(conflict.message).toContain("100");
    expect(conflict.message).toContain("60");
  });

  it("no hay choque si el proponente no pide más de lo que el aprobador reconoce", () => {
    const rule = getSeedGenome(CLINIC).authorityRule;
    expect(detectRuleConflict({ ...rule, proposerLimit: 60 }).hasConflict).toBe(false);
    expect(detectRuleConflict({ ...rule, proposerLimit: 40 })).toMatchObject({ hasConflict: false, delta: -20 });
  });

  it("al abrir la sala el choque queda en la bitácora", () => {
    expect(eventsOf(singleRoom(), "CONFLICT_DETECTED")).toHaveLength(1);
    expect(eventsOf(crossRoom(), "CONFLICT_DETECTED").map((event) => event.orgId)).toEqual([CLINIC, RURAL]);
  });

  it("desaparece al sellar la regla y reaparece si alguien mueve su límite", () => {
    let state = singleRoom();
    expect(view(state, "stage").orgs[0].conflict.hasConflict).toBe(true);

    state = accepted(sealRule(state, B_CLINIC, { threshold: 60 }, T0 + 1));
    expect(view(state, "stage").orgs[0].conflict.hasConflict).toBe(false);
    expect(genomeOf(state, CLINIC).authorityRule.sealedThreshold).toBe(60);
    expect(eventsOf(state, "RULE_SEALED").at(-1)).toMatchObject({ orgId: CLINIC, roleId: "role_b" });

    state = accepted(updateAuthoritySlider(state, A_CLINIC, 90, T0 + 2));
    expect(genomeOf(state, CLINIC).authorityRule).toMatchObject({ proposerLimit: 90, sealedThreshold: null });
    expect(view(state, "stage").orgs[0].conflict).toMatchObject({ hasConflict: true, delta: 30 });
    expect(eventsOf(state, "CONFLICT_DETECTED")).toHaveLength(2);
  });

  it("aparece en vivo cuando el proponente sube su límite sobre el del aprobador", () => {
    let state = accepted(updateAuthoritySlider(singleRoom(), A_CLINIC, 60, T0 + 1));
    expect(view(state, "stage").orgs[0].conflict.hasConflict).toBe(false);
    const before = eventsOf(state, "CONFLICT_DETECTED").length;
    state = accepted(updateAuthoritySlider(state, A_CLINIC, 61, T0 + 2));
    expect(view(state, "stage").orgs[0].conflict).toMatchObject({ hasConflict: true, delta: 1 });
    expect(eventsOf(state, "CONFLICT_DETECTED")).toHaveLength(before + 1);
  });

  it("cada rol mueve solo su propio límite; un tercero recibe 403", () => {
    const state = singleRoom();
    expect(genomeOf(accepted(updateAuthoritySlider(state, B_CLINIC, 70, T0)), CLINIC).authorityRule).toMatchObject({ proposerLimit: 100, approverLimit: 70 });
    expect(updateAuthoritySlider(state, C_CLINIC, 70, T0)).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });
    expect(updateAuthoritySlider(state, A_CLINIC, 101, T0)).toMatchObject({ ok: false, status: 400, code: "INVALID_VALUE" });
    expect(sealRule(state, C_CLINIC, {}, T0)).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });
  });

  it("el umbral sellado no puede superar lo que reconoce el aprobador", () => {
    expect(sealRule(singleRoom(), A_CLINIC, { threshold: 95 }, T0)).toMatchObject({ ok: false, status: 400, code: "INVALID_VALUE" });
  });
});

// --- 4. Compuerta -----------------------------------------------------------------

describe("evaluateGate: determinista", () => {
  it("mismas entradas, misma salida, y no modifica el genoma", () => {
    const genome = deepFreeze(getSeedGenome(CLINIC));
    const first = evaluateGate(genome, 82);
    for (let i = 0; i < 50; i++) expect(evaluateGate(genome, 82)).toEqual(first);
    expect(evaluateGate(getSeedGenome(CLINIC), 82)).toEqual(first);
  });

  it("sobre el umbral en modo con firma: bloqueada, y decide el Comité", () => {
    expect(evaluateGate(getSeedGenome(CLINIC))).toMatchObject({
      status: "BLOCKED_HITL_REQUIRED",
      proposedValue: 82,
      effectiveThreshold: 60,
      crossesThreshold: true,
      pendingApproverRoleId: "role_c",
      deciderRoleIds: ["role_b", "role_c"],
      outcome: null,
    });
  });

  it("dentro del umbral: abierta. El umbral exacto no lo cruza", () => {
    const genome = getSeedGenome(CLINIC);
    expect(evaluateGate(genome, 60)).toMatchObject({ status: "OPEN", crossesThreshold: false, pendingApproverRoleId: null });
    expect(evaluateGate(genome, 60.01)).toMatchObject({ status: "BLOCKED_HITL_REQUIRED", crossesThreshold: true });
    expect(evaluateGate(genome, 0)).toMatchObject({ status: "OPEN" });
  });

  it("usa el umbral sellado cuando existe", () => {
    const genome = getSeedGenome(CLINIC);
    genome.authorityRule.sealedThreshold = 50;
    expect(evaluateGate(genome, 55)).toMatchObject({ status: "BLOCKED_HITL_REQUIRED", effectiveThreshold: 50 });
  });

  it("en modo autónomo se ejecuta sin firma y queda marcado como inseguro", () => {
    const genome = getSeedGenome(CLINIC);
    genome.authorityRule.gateMode = "agent_autonomous";
    expect(evaluateGate(genome, 82)).toMatchObject({ status: "AUTO_EXECUTED_UNSAFE", pendingApproverRoleId: null });
    expect(evaluateGate(genome, 10)).toMatchObject({ status: "OPEN" });
  });

  it("al abrir la sala la compuerta bloqueada queda en la bitácora", () => {
    const state = singleRoom();
    expect(state.gateStatus).toBe("BLOCKED_HITL_REQUIRED");
    expect(eventsOf(state, "GATE_BLOCKED")).toHaveLength(1);
    expect(eventsOf(state, "GATE_BLOCKED")[0].detail).toMatchObject({ proposedValue: 82, threshold: 60 });
  });
});

describe("decisión humana sobre la compuerta", () => {
  const sealed = () => accepted(sealRule(singleRoom(), B_CLINIC, { threshold: 60 }, T0 + 1000));

  it("no se puede firmar mientras hay choque de autoridad sin resolver: 409", () => {
    expect(recordGateDecision(singleRoom(), C_CLINIC, { decision: "APPROVE", reason: "Urgente" }, T0)).toMatchObject({ ok: false, status: 409, code: "RULE_NOT_SEALED" });
  });

  it("la razón es obligatoria: 400 y nada cambia", () => {
    const state = sealed();
    for (const reason of ["", "   ", "\n\t"]) {
      expect(recordGateDecision(state, C_CLINIC, { decision: "APPROVE", reason }, T0)).toMatchObject({ ok: false, status: 400, code: "REASON_REQUIRED" });
    }
  });

  it("el proponente no puede firmar su propia propuesta: 403 y queda en la bitácora", () => {
    const result = rejected(recordGateDecision(sealed(), A_CLINIC, { decision: "APPROVE", reason: "Me apruebo" }, T0 + 2000));
    expect(result).toMatchObject({ status: 403, code: "RBAC_DENIED" });
    expect(result.state!.auditLog.at(-1)).toMatchObject({ type: "RBAC_DENIED", roleId: "role_a" });
    expect(result.state!.decisions).toHaveLength(0);
  });

  it("el Comité aprueba con razón: compuerta sellada, decisión registrada y evento HITL_APPROVED", () => {
    const state = accepted(recordGateDecision(sealed(), C_CLINIC, { decision: "APPROVE", reason: "  Gravedad clínica alta  " }, T0 + 2000));
    expect(state.gateStatus).toBe("SEALED");
    expect(state.decisions).toEqual([{ scope: "gate", targetOrgId: CLINIC, decision: "APPROVE", reason: "Gravedad clínica alta", byOrgId: CLINIC, byRoleId: "role_c", ts: T0 + 2000 }]);
    expect(view(state, "stage").orgs[0].gate).toMatchObject({ status: "SEALED", outcome: "approved", pendingApproverRoleId: null });
    expect(eventsOf(state, "HITL_APPROVED").at(-1)!.detail).toMatchObject({ reason: "Gravedad clínica alta" });
  });

  it("el Comité de la organización veta con razón: queda como HITL_VETOED", () => {
    const state = accepted(recordCommitteeDecision(sealed(), C_CLINIC, { decision: "VETO", reason: "Sin respaldo del contrato" }, T0 + 2000));
    expect(view(state, "stage").orgs[0].gate).toMatchObject({ status: "SEALED", outcome: "vetoed" });
    expect(eventsOf(state, "HITL_VETOED").at(-1)).toMatchObject({ orgId: CLINIC, roleId: "role_c" });
    expect(state.decisions.at(-1)).toMatchObject({ decision: "VETO", reason: "Sin respaldo del contrato" });
  });

  it("una contrapropuesta debe quedar dentro del umbral y pasa a ser el valor del caso", () => {
    const state = sealed();
    expect(recordGateDecision(state, B_CLINIC, { decision: "COUNTER_PROPOSE", reason: "Bajar cobertura", counterValue: 75 }, T0)).toMatchObject({ ok: false, status: 400, code: "INVALID_VALUE" });
    const next = accepted(recordGateDecision(state, B_CLINIC, { decision: "COUNTER_PROPOSE", reason: "Bajar cobertura", counterValue: 55 }, T0 + 2000));
    expect(genomeOf(next, CLINIC).liveCase.proposedValue).toBe(55);
    expect(view(next, "stage").orgs[0].gate).toMatchObject({ status: "SEALED", outcome: "counter_proposed" });
    expect(eventsOf(next, "COUNTER_PROPOSED")).toHaveLength(1);
  });

  it("la decisión es definitiva: no se decide dos veces ni se mueve la regla después", () => {
    const state = accepted(recordGateDecision(sealed(), C_CLINIC, { decision: "APPROVE", reason: "Aprobado" }, T0 + 2000));
    expect(recordGateDecision(state, B_CLINIC, { decision: "VETO", reason: "Me arrepentí" }, T0 + 3000)).toMatchObject({ ok: false, status: 409, code: "DECISION_SEALED" });
    expect(updateAuthoritySlider(state, A_CLINIC, 10, T0 + 3000)).toMatchObject({ ok: false, status: 409, code: "DECISION_SEALED" });
    expect(sealRule(state, B_CLINIC, { threshold: 10 }, T0 + 3000)).toMatchObject({ ok: false, status: 409, code: "DECISION_SEALED" });
  });
});

// --- 5. Asignación del recurso escaso ------------------------------------------------

describe("resolveAllocation: reproducible y con desempate de equidad", () => {
  const candidate = (overrides: Partial<OrgCandidate> & Pick<OrgCandidate, "caseId" | "orgId">): OrgCandidate => ({
    patientLabel: `Paciente ${overrides.caseId}`,
    clinicalSeverityScore: 0.8,
    timeCriticality: 0.8,
    delayRiskScore: 0.5,
    unmetNeedScore: 0.5,
    coverageCost: 1000000,
    coverageCostVisibleToOrgs: [overrides.orgId],
    proposerRoleId: "role_a",
    ...overrides,
  });
  const scarcityWith = (candidates: OrgCandidate[], rule: Partial<SharedScarcity["rule"]> = {}): SharedScarcity => {
    const seed = getSeedScarcity();
    return { ...seed, rule: { ...seed.rule, ...rule }, candidates };
  };

  it("el puntaje es S = w_sev·gravedad + w_time·urgencia − w_delay·riesgo de demora", () => {
    const { rule, candidates } = getSeedScarcity();
    expect(computeTriageScore(candidates[0], rule.weights)).toBeCloseTo(0.5 * 0.9 + 0.3 * 0.8 - 0.2 * 0.85, 9);
    expect(computeTriageScore(candidates[0], rule.weights)).toBe(0.52);
    expect(computeTriageScore(candidates[1], rule.weights)).toBe(0.53);
  });

  it("mismas entradas, misma salida, sin modificar la entrada", () => {
    const scarcity = deepFreeze(getSeedScarcity());
    const first = resolveAllocation(scarcity);
    for (let i = 0; i < 50; i++) expect(resolveAllocation(scarcity)).toEqual(first);
  });

  it("el resultado no depende del orden en que llegan los candidatos", () => {
    const scarcity = getSeedScarcity();
    const reversed = { ...scarcity, candidates: [...scarcity.candidates].reverse() };
    expect(resolveAllocation(reversed)).toEqual(resolveAllocation(scarcity));

    const many = scarcityWith([
      candidate({ caseId: "A1", orgId: "org_a", clinicalSeverityScore: 0.9 }),
      candidate({ caseId: "B1", orgId: "org_b", clinicalSeverityScore: 0.6 }),
      candidate({ caseId: "C1", orgId: "org_c", clinicalSeverityScore: 0.89, unmetNeedScore: 0.9 }),
      candidate({ caseId: "D1", orgId: "org_d", clinicalSeverityScore: 0.3 }),
    ]);
    const expected = resolveAllocation(many);
    const random = seededRandom(7);
    for (let i = 0; i < 30; i++) {
      const shuffled = { ...many, candidates: [...many.candidates].sort(() => random() - 0.5) };
      expect(resolveAllocation(shuffled)).toEqual(expected);
    }
  });

  it("con la semilla hay empate técnico (0,52 y 0,53) y gana quien tiene mayor necesidad sin cubrir", () => {
    const result = resolveAllocation(getSeedScarcity());
    expect(result).toMatchObject({ tieBreakApplied: true, tieBreakRule: "worst_unmet_need", tieEpsilon: 0.02, scoreGap: 0.01, winnerCaseId: "B1", winnerOrgId: RURAL });
    expect(result.ranking.map((entry) => [entry.rank, entry.caseId, entry.score])).toEqual([[1, "B1", 0.53], [2, "A1", 0.52]]);
    expect(result.explanation).toContain("desempate");
  });

  it("ante empate, el desempate de equidad puede ganarle al mejor puntaje", () => {
    const scarcity = scarcityWith([
      candidate({ caseId: "A1", orgId: "org_a", clinicalSeverityScore: 0.82, unmetNeedScore: 0.2 }),
      candidate({ caseId: "B1", orgId: "org_b", clinicalSeverityScore: 0.8, unmetNeedScore: 0.9 }),
    ]);
    const result = resolveAllocation(scarcity);
    const scoreOf = (caseId: string) => result.ranking.find((entry) => entry.caseId === caseId)!.score;
    expect(scoreOf("A1")).toBeGreaterThan(scoreOf("B1"));
    expect(result).toMatchObject({ tieBreakApplied: true, winnerCaseId: "B1" });

    // Sin margen de empate, la misma entrada la gana el mejor puntaje.
    expect(resolveAllocation(scarcityWith(scarcity.candidates, { tieEpsilon: 0 }))).toMatchObject({ tieBreakApplied: false, winnerCaseId: "A1" });
  });

  it("si la diferencia alcanza el margen de empate, gana el puntaje y no se aplica el desempate", () => {
    const scarcity = scarcityWith([
      candidate({ caseId: "A1", orgId: "org_a", clinicalSeverityScore: 0.9, unmetNeedScore: 0.1 }),
      candidate({ caseId: "B1", orgId: "org_b", clinicalSeverityScore: 0.8, unmetNeedScore: 0.9 }),
    ]);
    const result = resolveAllocation(scarcity);
    expect(result.scoreGap).toBe(0.05);
    expect(result).toMatchObject({ tieBreakApplied: false, winnerCaseId: "A1" });
    // En el borde exacto (diferencia igual al margen) tampoco hay empate.
    expect(resolveAllocation(scarcityWith(scarcity.candidates, { tieEpsilon: 0.05 }))).toMatchObject({ tieBreakApplied: false, winnerCaseId: "A1" });
    expect(resolveAllocation(scarcityWith(scarcity.candidates, { tieEpsilon: 0.0501 }))).toMatchObject({ tieBreakApplied: true, winnerCaseId: "B1" });
  });

  it("empate total: decide el orden alfabético del caso, siempre igual", () => {
    const scarcity = scarcityWith([candidate({ caseId: "Z9", orgId: "org_z" }), candidate({ caseId: "M5", orgId: "org_m" }), candidate({ caseId: "B2", orgId: "org_b" })]);
    expect(resolveAllocation(scarcity).ranking.map((entry) => entry.caseId)).toEqual(["B2", "M5", "Z9"]);
  });

  it("el desempate por menor costo usa el costo dentro del servidor y no lo publica", () => {
    const scarcity = scarcityWith(
      [candidate({ caseId: "A1", orgId: "org_a", coverageCost: 7654321 }), candidate({ caseId: "B1", orgId: "org_b", coverageCost: 1234567 })],
      { equityTieBreak: "coverage_gap" },
    );
    const result = resolveAllocation(scarcity);
    expect(result).toMatchObject({ tieBreakApplied: true, winnerCaseId: "B1" });
    expect(JSON.stringify(result)).not.toContain("7654321");
    expect(JSON.stringify(result)).not.toContain("1234567");
  });

  it("los casos vetados quedan fuera y gana el siguiente", () => {
    const result = resolveAllocation(getSeedScarcity(), { excludedCaseIds: ["B1"] });
    expect(result.ranking.map((entry) => entry.caseId)).toEqual(["A1"]);
    expect(result).toMatchObject({ winnerCaseId: "A1", tieBreakApplied: false });
  });

  it("en la sala no hay ganador hasta que todas las organizaciones presentan su candidato", () => {
    let state = crossRoom();
    expect(view(state, "stage").allocation).toMatchObject({ status: "PENDING", winnerCaseId: null, ranking: [], pendingCaseIds: ["A1", "B1"] });

    state = accepted(submitCandidate(state, A_CLINIC, undefined, T0 + 1));
    expect(view(state, "stage").allocation).toMatchObject({ status: "PENDING", winnerCaseId: null, pendingCaseIds: ["B1"] });
    expect(eventsOf(state, "ALLOCATION_PROPOSED")).toHaveLength(0);

    state = accepted(submitCandidate(state, A_RURAL, "B1", T0 + 2));
    expect(view(state, "stage").allocation).toMatchObject({ status: "PROPOSED", winnerCaseId: "B1", winnerOrgId: RURAL, tieBreakApplied: true, pendingCaseIds: [] });
    expect(eventsOf(state, "CANDIDATE_SUBMITTED")).toHaveLength(2);
    expect(eventsOf(state, "ALLOCATION_PROPOSED")).toHaveLength(1);
  });

  it("todos los participantes reciben exactamente el mismo ranking", () => {
    const state = crossRoomProposed();
    const rankings = new Set(CROSS_VIEWERS.map((viewer) => JSON.stringify(view(state, viewer).allocation)));
    expect(rankings.size).toBe(1);
  });

  it("solo el rol proponente de una organización presenta su caso; nadie presenta el de otra", () => {
    const state = crossRoom();
    expect(submitCandidate(state, B_CLINIC, "A1", T0)).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });
    expect(submitCandidate(state, A_RURAL, "A1", T0)).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });
    expect(submitCandidate(state, ARBITER, "A1", T0)).toMatchObject({ ok: false, status: 403, code: "RBAC_DENIED" });
    expect(submitCandidate(state, A_CLINIC, "Z9", T0)).toMatchObject({ ok: false, status: 404, code: "CANDIDATE_NOT_FOUND" });
    expect(submitCandidate(singleRoom(), A_CLINIC, undefined, T0)).toMatchObject({ ok: false, status: 409, code: "WRONG_MODE" });
  });
});

describe("Comité árbitro: veta o aprueba con razón", () => {
  it("la razón es obligatoria para vetar y para sellar: 400 y nada cambia", () => {
    const state = crossRoomProposed();
    expect(recordCommitteeDecision(state, ARBITER, { decision: "VETO", reason: "  " }, T0)).toMatchObject({ ok: false, status: 400, code: "REASON_REQUIRED" });
    expect(sealAllocation(state, ARBITER, "", T0)).toMatchObject({ ok: false, status: 400, code: "REASON_REQUIRED" });
  });

  it("nadie más que el Comité árbitro sella o veta la asignación: 403 y queda en la bitácora", () => {
    const state = crossRoomProposed();
    for (const actor of [A_CLINIC, B_CLINIC, C_CLINIC, A_RURAL, B_RURAL, C_RURAL]) {
      const seal = rejected(sealAllocation(state, actor, "Quiero la cama", T0 + 9000));
      expect(seal, `${actor.orgId}/${actor.roleId}`).toMatchObject({ status: 403, code: "RBAC_DENIED" });
      expect(seal.state!.auditLog.at(-1)).toMatchObject({ type: "RBAC_DENIED", orgId: actor.orgId, roleId: actor.roleId });
      expect(seal.state!.allocationStatus).toBe("PROPOSED");
    }
    // El Comité interno de un hospital no puede vetar la asignación entre organizaciones.
    const veto = recordCommitteeDecision(state, C_RURAL, { decision: "VETO", reason: "No me conviene" }, T0 + 9000);
    expect(veto.ok ? veto.state.decisions.filter((decision) => decision.scope === "allocation") : []).toHaveLength(0);
    expect(veto.ok ? veto.state.allocationStatus : state.allocationStatus).toBe("PROPOSED");
  });

  it("no se puede decidir antes de que haya una asignación propuesta: 409", () => {
    expect(sealAllocation(crossRoom(), ARBITER, "Apurado", T0)).toMatchObject({ ok: false, status: 409, code: "ALLOCATION_NOT_READY" });
  });

  it("el veto con razón saca al ganador, el algoritmo reordena y todo queda registrado", () => {
    const state = accepted(recordCommitteeDecision(crossRoomProposed(), ARBITER, { decision: "VETO", reason: "Falta respaldo clínico" }, T0 + 5000));
    expect(state.allocationStatus).toBe("PROPOSED");
    expect(state.decisions.at(-1)).toEqual({ scope: "allocation", targetCaseId: "B1", decision: "VETO", reason: "Falta respaldo clínico", byOrgId: "comite_red", byRoleId: "role_c", ts: T0 + 5000 });
    expect(view(state, "stage").allocation).toMatchObject({ winnerCaseId: "A1", vetoedCaseIds: ["B1"], committeeDecision: { decision: "VETO", reason: "Falta respaldo clínico" } });
    expect(view(state, "stage").allocation!.ranking.map((entry) => entry.caseId)).toEqual(["A1"]);
    expect(eventsOf(state, "HITL_VETOED").at(-1)).toMatchObject({ orgId: "comite_red", roleId: "role_c", detail: { reason: "Falta respaldo clínico", vetoedCaseId: "B1" } });
  });

  it("no se puede vetar al último candidato: el recurso no puede quedar sin asignar", () => {
    const afterVeto = accepted(recordCommitteeDecision(crossRoomProposed(), ARBITER, { decision: "VETO", reason: "Primer veto" }, T0 + 5000));
    expect(recordCommitteeDecision(afterVeto, ARBITER, { decision: "VETO", reason: "Segundo veto" }, T0 + 6000)).toMatchObject({ ok: false, status: 409, code: "ALLOCATION_NOT_READY" });
  });

  it("al sellar queda asignado, con la razón, y ya no se puede cambiar", () => {
    const state = accepted(sealAllocation(crossRoomProposed(), ARBITER, "Mayor necesidad sin cubrir", T0 + 5000));
    expect(state).toMatchObject({ allocationStatus: "SEALED", decisionSealedAt: T0 + 5000 });
    expect(view(state, "stage").allocation).toMatchObject({ status: "SEALED", winnerCaseId: "B1", winnerOrgId: RURAL });
    expect(eventsOf(state, "ALLOCATION_SEALED").at(-1)!.detail).toMatchObject({ reason: "Mayor necesidad sin cubrir", winnerCaseId: "B1", tieBreakApplied: true });

    expect(recordCommitteeDecision(state, ARBITER, { decision: "VETO", reason: "Tarde" }, T0 + 6000)).toMatchObject({ ok: false, status: 409, code: "DECISION_SEALED" });
    expect(sealAllocation(state, ARBITER, "Otra vez", T0 + 6000)).toMatchObject({ ok: false, status: 409, code: "DECISION_SEALED" });
    expect(submitCandidate(state, A_CLINIC, "A1", T0 + 6000)).toMatchObject({ ok: false, status: 409, code: "DECISION_SEALED" });
  });
});

// --- 6. Confiabilidad p^n -----------------------------------------------------------

describe("confiabilidad p^n", () => {
  it("autónomo es p^n y el híbrido es (1 − (1 − p)(1 − h))^n, con los números de la semilla", () => {
    const reliability = computeReliabilityPn(getSeedGenome(CLINIC));
    expect(reliability).toMatchObject({ p: 0.92, n: 10 });
    expect(reliability.autonomous).toBeCloseTo(0.92 ** 10, 6);
    expect(reliability.hybrid).toBeCloseTo((1 - 0.08 * 0.05) ** 10, 6);
    expect(reliability.autonomous).toBeCloseTo(0.434, 3);
    expect(reliability.hybrid).toBeCloseTo(0.961, 3);
    expect(reliability.formula).toContain("ilustrativo");
  });

  it("es determinista y no modifica el genoma", () => {
    const genome = deepFreeze(getSeedGenome(RURAL));
    expect(computeReliabilityPn(genome)).toEqual(computeReliabilityPn(genome));
  });

  it("sube al sellar la regla: con choque pendiente aplica el autónomo; sellada, el híbrido", () => {
    const open = singleRoom();
    const before = view(open, "stage").orgs[0].reliability;
    expect(before).toMatchObject({ currentMode: "autonomous" });
    expect(before.current).toBe(before.autonomous);

    const sealed = accepted(sealRule(open, B_CLINIC, { threshold: 60 }, T0 + 1));
    const after = view(sealed, "stage").orgs[0].reliability;
    expect(after).toMatchObject({ currentMode: "hybrid" });
    expect(after.current).toBe(after.hybrid);
    expect(after.current).toBeGreaterThan(before.current + 0.5);
  });

  it("se mantiene en el nivel híbrido después de la decisión humana, apruebe o vete", () => {
    const sealed = accepted(sealRule(singleRoom(), B_CLINIC, { threshold: 60 }, T0 + 1));
    const level = view(sealed, "stage").orgs[0].reliability.current;
    const approved = accepted(recordGateDecision(sealed, C_CLINIC, { decision: "APPROVE", reason: "Aprobado" }, T0 + 2));
    const vetoed = accepted(recordCommitteeDecision(sealed, C_CLINIC, { decision: "VETO", reason: "Vetado" }, T0 + 2));
    expect(view(approved, "stage").orgs[0].reliability).toMatchObject({ current: level, currentMode: "hybrid" });
    expect(view(vetoed, "stage").orgs[0].reliability).toMatchObject({ current: level, currentMode: "hybrid" });
  });

  it("baja al nivel autónomo si la regla se sella en modo autónomo o se reabre", () => {
    const autonomous = accepted(sealRule(singleRoom(), B_CLINIC, { threshold: 60, gateMode: "agent_autonomous" }, T0 + 1));
    expect(view(autonomous, "stage").orgs[0].reliability.currentMode).toBe("autonomous");
    expect(view(autonomous, "stage").orgs[0].gate.status).toBe("AUTO_EXECUTED_UNSAFE");

    const sealed = accepted(sealRule(singleRoom(), B_CLINIC, { threshold: 60 }, T0 + 1));
    const reopened = accepted(updateAuthoritySlider(sealed, A_CLINIC, 99, T0 + 2));
    expect(view(reopened, "stage").orgs[0].reliability.currentMode).toBe("autonomous");
  });

  it("entre organizaciones la cadena es más larga, así que el riesgo autónomo es mayor que el de cada una", () => {
    const state = crossRoom();
    const cross = computeCrossOrgReliabilityPn(state);
    const clinic = computeReliabilityPn(genomeOf(state, CLINIC));
    const rural = computeReliabilityPn(genomeOf(state, RURAL));
    expect(cross.n).toBe(clinic.n + rural.n);
    expect(cross.autonomous).toBeCloseTo(0.92 ** 10 * 0.9 ** 12, 6);
    expect(cross.autonomous).toBeLessThan(Math.min(clinic.autonomous, rural.autonomous));
    expect(cross.p ** cross.n).toBeCloseTo(cross.autonomous, 5);
    expect(cross.hybrid).toBeCloseTo((1 - 0.08 * 0.05) ** 10 * (1 - 0.1 * 0.06) ** 12, 6);
    expect(cross.hybrid).toBeGreaterThan(cross.autonomous);
  });

  it("entre organizaciones sube cuando el Comité sella la asignación; el veto solo no la baja", () => {
    const proposed = crossRoomProposed();
    const before = view(proposed, "stage").crossOrgReliability!;
    expect(before.currentMode).toBe("autonomous");

    const vetoed = accepted(recordCommitteeDecision(proposed, ARBITER, { decision: "VETO", reason: "Revisar" }, T0 + 5000));
    expect(view(vetoed, "stage").crossOrgReliability!.current).toBeGreaterThanOrEqual(before.current);

    const sealedAfterVeto = accepted(sealAllocation(vetoed, ARBITER, "Confirmado tras revisión", T0 + 6000));
    const after = view(sealedAfterVeto, "stage").crossOrgReliability!;
    expect(after.currentMode).toBe("hybrid");
    expect(after.current).toBe(after.hybrid);
    expect(after.current).toBeGreaterThan(before.current + 0.5);
  });

  it("en una sola organización no hay cadena entre organizaciones", () => {
    expect(view(singleRoom(), "stage").crossOrgReliability).toBeNull();
  });
});

// --- 7. Contador ---------------------------------------------------------------------

describe("computeSharedStakesCounter: de BLEEDING a CONTAINED", () => {
  it("corre con el reloj del servidor que se le pasa, sin leer la hora por su cuenta", () => {
    const state = singleRoom();
    expect(computeSharedStakesCounter(state, T0 + 12_345)).toMatchObject({ status: "BLEEDING", elapsedMs: 12_345, timeToDecisionMs: null, waitingCases: 1, livesAtRisk: 1 });
    expect(computeSharedStakesCounter(state, T0 + 12_345)).toEqual(computeSharedStakesCounter(state, T0 + 12_345));
    expect(computeSharedStakesCounter(state, T0 - 5000).elapsedMs).toBe(0);
  });

  it("una organización: se detiene cuando una persona decide sobre la compuerta", () => {
    const sealed = accepted(sealRule(singleRoom(), B_CLINIC, { threshold: 60 }, T0 + 1000));
    expect(computeSharedStakesCounter(sealed, T0 + 2000).status).toBe("BLEEDING");

    const decided = accepted(recordGateDecision(sealed, C_CLINIC, { decision: "APPROVE", reason: "Aprobado" }, T0 + 40_000));
    expect(decided.decisionSealedAt).toBe(T0 + 40_000);
    expect(eventsOf(decided, "STAKES_CONTAINED").at(-1)!.detail).toMatchObject({ timeToDecisionMs: 40_000 });
    for (const later of [T0 + 40_000, T0 + 90_000, T0 + 3_600_000]) {
      expect(computeSharedStakesCounter(decided, later)).toMatchObject({ status: "CONTAINED", elapsedMs: 40_000, timeToDecisionMs: 40_000, waitingCases: 0, livesAtRisk: 0 });
    }
  });

  it("dos organizaciones: firmar las compuertas no basta; se detiene cuando el Comité sella la asignación", () => {
    const proposed = crossRoomProposed();
    expect(computeSharedStakesCounter(proposed, T0 + 10_000)).toMatchObject({ status: "BLEEDING", waitingCases: 2, livesAtRisk: 2, timeToDecisionMs: null });

    const vetoed = accepted(recordCommitteeDecision(proposed, ARBITER, { decision: "VETO", reason: "Revisar" }, T0 + 20_000));
    expect(computeSharedStakesCounter(vetoed, T0 + 25_000).status).toBe("BLEEDING");

    const sealed = accepted(sealAllocation(vetoed, ARBITER, "Confirmado", T0 + 30_000));
    expect(computeSharedStakesCounter(sealed, T0 + 99_000)).toMatchObject({ status: "CONTAINED", elapsedMs: 30_000, timeToDecisionMs: 30_000, waitingCases: 0, livesAtRisk: 0 });
    expect(eventsOf(sealed, "STAKES_CONTAINED")).toHaveLength(1);
    expect(view(sealed, "stage", T0 + 99_000).stakes.status).toBe("CONTAINED");
  });

  it("el texto de lo que está en juego no revela ningún costo", () => {
    for (const state of [singleRoom(), crossRoom()]) {
      const label = computeSharedStakesCounter(state, T0).stakesLabel;
      for (const secret of ["2400000", "1600000", "4000000", "2.4", "4.0"]) expect(label).not.toContain(secret);
    }
  });
});

// --- 8. Acta --------------------------------------------------------------------------

describe("buildAuditActa: toda la bitácora, ningún secreto", () => {
  function fullStory(): RoomState {
    let state = crossRoomProposed();
    state = deepFreeze(rejected(attemptProtectedRead(state, B_RURAL, { orgId: CLINIC, fieldKey: "coverage_cost" }, T0 + 4000)).state!);
    state = accepted(markRoleJoined(state, ARBITER, T0 + 4500));
    state = accepted(recordCommitteeDecision(state, ARBITER, { decision: "VETO", reason: "Falta respaldo clínico del traslado" }, T0 + 5000));
    return accepted(sealAllocation(state, ARBITER, "Se confirma por mayor necesidad sin cubrir", T0 + 6000));
  }

  it("incluye la bitácora completa, en orden, y todas las decisiones con su razón", () => {
    const state = fullStory();
    const acta = buildAuditActa(state, T0 + 7000);
    expect(acta.auditLog).toEqual(state.auditLog);
    expect(acta.decisions).toEqual(state.decisions);
    expect(acta.decisions.map((decision) => decision.reason)).toEqual(expect.arrayContaining(["Falta respaldo clínico del traslado", "Se confirma por mayor necesidad sin cubrir"]));
    const types = new Set(acta.auditLog.map((event) => event.type));
    for (const type of ["ROOM_CREATED", "CONFLICT_DETECTED", "GATE_BLOCKED", "RULE_SEALED", "HITL_APPROVED", "CANDIDATE_SUBMITTED", "ALLOCATION_PROPOSED", "RBAC_DENIED", "QR_JOINED", "HITL_VETOED", "ALLOCATION_SEALED", "STAKES_CONTAINED"]) {
      expect(types.has(type as never), type).toBe(true);
    }
    expect(acta.auditLog.map((event) => event.ts)).toEqual([...acta.auditLog.map((event) => event.ts)].sort((a, b) => a - b));
  });

  it("resume el resultado: ganador, tiempo hasta la decisión y aviso de datos simulados", () => {
    const acta = buildAuditActa(fullStory(), T0 + 7000);
    expect(acta).toMatchObject({ roomId: "sala-cruzada", mode: "cross_org", allocationStatus: "SEALED", timeToDecisionMs: 6000, disclaimer: ACTA_DISCLAIMER });
    expect(acta.allocation).toMatchObject({ status: "SEALED", winnerCaseId: "A1", vetoedCaseIds: ["B1"] });
    expect(acta.stakes.status).toBe("CONTAINED");
    expect(acta.disclaimer).toMatch(/simulad/i);
  });

  it("trae toda la bitácora aunque sea más larga que lo que viaja por SSE", () => {
    let state = singleRoom();
    for (let i = 0; i < PROJECTED_AUDIT_LIMIT + 25; i++) {
      state = deepFreeze(rejected(attemptProtectedRead(state, A_CLINIC, { fieldKey: "coverage_cost" }, T0 + i)).state!);
    }
    expect(view(state, "stage").auditLog).toHaveLength(PROJECTED_AUDIT_LIMIT);
    const acta = buildAuditActa(state, T0 + 1000);
    expect(acta.auditLog.length).toBeGreaterThan(PROJECTED_AUDIT_LIMIT + 25);
    expect(acta.auditLog).toEqual(state.auditLog);
    expect(acta.auditLog[0].type).toBe("ROOM_CREATED");
  });

  it("no contiene ningún valor reservado, ni en JSON ni en markdown", () => {
    const state = fullStory();
    const acta = buildAuditActa(state, T0 + 7000);
    const markdown = renderActaMarkdown(acta);
    const json = JSON.stringify(acta);
    for (const secret of [...reservedValues(state, CLINIC), ...reservedValues(state, RURAL)]) {
      expect(json, `el acta JSON contiene ${secret}`).not.toContain(secret);
      expect(markdown, `el acta markdown contiene ${secret}`).not.toContain(secret);
    }
  });

  it("el markdown lista cada evento de la bitácora y cada razón", () => {
    const state = fullStory();
    const markdown = renderActaMarkdown(buildAuditActa(state, T0 + 7000));
    const rows = markdown.split("\n").filter((line) => /^\| \d{4}-\d{2}-\d{2}T/.test(line));
    expect(rows).toHaveLength(state.auditLog.length);
    for (const decision of state.decisions) expect(markdown).toContain(decision.reason);
    expect(markdown).toContain(ACTA_DISCLAIMER);
    expect(markdown).toContain("Paciente A (A1)");
  });

  it("es determinista: mismo estado y mismo reloj, misma acta", () => {
    const state = fullStory();
    expect(buildAuditActa(state, T0 + 7000)).toEqual(buildAuditActa(state, T0 + 7000));
  });
});

// --- Presencia --------------------------------------------------------------------------

describe("presencia y entrada por QR", () => {
  it("un rol común queda como ROLE_JOINED; el Comité, de una organización o árbitro, como QR_JOINED", () => {
    let state = crossRoom();
    state = accepted(markRoleJoined(state, A_CLINIC, T0 + 1));
    expect(state.auditLog.at(-1)).toMatchObject({ type: "ROLE_JOINED", orgId: CLINIC, roleId: "role_a" });
    state = accepted(markRoleJoined(state, C_RURAL, T0 + 2));
    expect(state.auditLog.at(-1)).toMatchObject({ type: "QR_JOINED", orgId: RURAL, roleId: "role_c" });
    state = accepted(markRoleJoined(state, ARBITER, T0 + 3));
    expect(state.auditLog.at(-1)).toMatchObject({ type: "QR_JOINED", orgId: "comite_red", roleId: "role_c" });

    const projected = view(state, "stage", T0 + 10);
    expect(projected.scarcity!.arbiter.connected).toBe(true);
    expect(projected.orgs.find((org) => org.orgId === CLINIC)!.roles.map((role) => role.connected)).toEqual([true, false, false]);
    expect(projected.orgs.find((org) => org.orgId === RURAL)!.roles.map((role) => role.connected)).toEqual([false, false, true]);
  });

  it("un rol que no existe no puede entrar: 404", () => {
    expect(markRoleJoined(crossRoom(), { orgId: CLINIC, roleId: "role_z" }, T0)).toMatchObject({ ok: false, status: 404, code: "ROLE_NOT_FOUND" });
    expect(markRoleJoined(singleRoom(), ARBITER, T0)).toMatchObject({ ok: false, status: 404, code: "ROLE_NOT_FOUND" });
  });
});
