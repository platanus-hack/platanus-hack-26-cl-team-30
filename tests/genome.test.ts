// Pruebas del contrato de datos (src/lib/genome/schema.ts) y de las semillas
// (src/lib/genome/seeds.ts).
//
// Qué se garantiza aquí:
//   1. Todas las semillas pasan sus esquemas.
//   2. Invariantes que el esquema no cubre solo: referencias a roles y
//      organizaciones que existen, ids sin tilde, y costo de cobertura de cada
//      candidato visible únicamente para su organización.
//   3. Los textos públicos de las semillas no revelan valores secretos.
//   4. El esquema rechaza los errores que más daño harían en la demo.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HumanDecisionSchema,
  OrgGenomeSchema,
  RoomStateSchema,
  SharedScarcitySchema,
  TelemetrySchema,
  type OrgGenome,
} from "../src/lib/genome/schema";
import {
  CROSS_ORG_GENOME_IDS,
  DEFAULT_SEED_GENOME_ID,
  SEED_GENOME_IDS,
  getInitialCrossOrgRoom,
  getInitialSingleOrgRoom,
  getSeedGenome,
  getSeedScarcity,
  initialTelemetry,
  isSeedGenomeId,
} from "../src/lib/genome/seeds";

/** Identificador válido: minúsculas, números y guion bajo. Sin tildes, espacios ni mayúsculas. */
const ID = /^[a-z0-9_]+$/;

/** Todas las formas en que un número secreto podría colarse en un texto. */
function numberSpellings(value: number): string[] {
  const spellings = new Set([String(value), value.toLocaleString("es-CL"), value.toLocaleString("en-US")]);
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    for (const text of [String(millions), millions.toFixed(1)]) {
      for (const decimal of [text, text.replace(".", ",")]) {
        spellings.add(`${decimal}M`);
        spellings.add(`${decimal} M`);
        spellings.add(`${decimal} millones`);
      }
    }
  }
  return [...spellings];
}

/** true si el texto contiene el valor como palabra completa (no como parte de otro número). */
function mentions(text: string, value: string | number): boolean {
  const candidates = typeof value === "number" ? numberSpellings(value) : [value];
  return candidates.some((candidate) => {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\w.,])${escaped}(?![\\w]|[.,]\\d)`, "i").test(text);
  });
}

/** Textos de un genoma que ven todos los roles y, en la capa inter-org, todas las organizaciones. */
function publicTexts(genome: OrgGenome): string[] {
  return [
    genome.orgName,
    genome.industry,
    genome.orgStyle,
    genome.liveCase.title,
    genome.liveCase.summary,
    genome.liveCase.stakesLabel,
    genome.authorityRule.metricLabel,
    ...genome.fields.map((field) => field.label),
    ...genome.roles.flatMap((role) => [role.title, role.shortTag, role.agentName, role.agentPersona, role.objective, role.painPoint]),
  ];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("detector de fugas usado en estas pruebas", () => {
  it("reconoce los textos del plan original que revelaban el costo", () => {
    expect(mentions("1 vida en riesgo · $2.4M CLP de cobertura · cierre 18:00", 2400000)).toBe(true);
    expect(mentions("1 recurso · 2 organizaciones · 2 vidas en riesgo · $4.0M CLP en juego", 4000000)).toBe(true);
    expect(mentions("Costo: 2.400.000 CLP", 2400000)).toBe(true);
    expect(mentions("Costo: 2400000", 2400000)).toBe(true);
    expect(mentions("Gravedad 18/40", "18/40")).toBe(true);
  });

  it("no confunde un número con parte de otro", () => {
    expect(mentions("12% de descuento", 2)).toBe(false);
    expect(mentions("cierre 18:00", "18/40")).toBe(false);
    expect(mentions("140 km de traslado", 14)).toBe(false);
  });
});

describe("semillas de genoma", () => {
  it("hay al menos las tres del plan y la de por defecto es la clínica", () => {
    expect(SEED_GENOME_IDS).toEqual(expect.arrayContaining(["clinica_andes", "hospital_rural", "dist_tech"]));
    expect(DEFAULT_SEED_GENOME_ID).toBe("clinica_andes");
    expect(isSeedGenomeId("clinica_andes")).toBe(true);
    expect(isSeedGenomeId("clínica_andes")).toBe(false);
    expect(isSeedGenomeId(undefined)).toBe(false);
  });

  describe.each(SEED_GENOME_IDS)("%s", (seedId) => {
    const genome = getSeedGenome(seedId);

    it("pasa OrgGenomeSchema", () => {
      const result = OrgGenomeSchema.safeParse(genome);
      expect(result.success ? [] : result.error.issues).toEqual([]);
    });

    it("su orgId es el id de la semilla", () => {
      expect(genome.orgId).toBe(seedId);
    });

    it("ningún identificador lleva tilde, mayúscula ni espacio", () => {
      const ids = [
        genome.orgId,
        genome.authorityRule.id,
        genome.authorityRule.metricKey,
        genome.authorityRule.proposerRoleId,
        genome.authorityRule.approverRoleId,
        genome.liveCase.triggeredMetricKey,
        ...genome.roles.flatMap((role) => [role.id, role.orgId]),
        ...genome.fields.flatMap((field) => [field.key, field.ownerOrgId, field.ownerRoleId, ...field.visibleToOrgIds, ...field.visibleToRoleIds]),
      ];
      for (const id of ids) expect(id, `identificador "${id}"`).toMatch(ID);
    });

    it("todos los roles referenciados existen en la organización", () => {
      const roleIds = new Set(genome.roles.map((role) => role.id as string));
      const referenced = [
        genome.authorityRule.proposerRoleId,
        genome.authorityRule.approverRoleId,
        ...genome.fields.flatMap((field) => [field.ownerRoleId, ...field.visibleToRoleIds]),
      ];
      for (const roleId of referenced) expect(roleIds.has(roleId), `rol "${roleId}"`).toBe(true);
      expect(genome.roles.every((role) => role.orgId === genome.orgId)).toBe(true);
    });

    it("cada campo pertenece a la organización y su dueño puede verlo", () => {
      for (const field of genome.fields) {
        expect(field.ownerOrgId, field.key).toBe(genome.orgId);
        expect(field.visibleToOrgIds, field.key).toContain(genome.orgId);
        expect(field.visibleToRoleIds, field.key).toContain(field.ownerRoleId);
      }
    });

    it("los campos secretos y restringidos no se comparten con otra organización", () => {
      for (const field of genome.fields.filter((candidate) => candidate.classification !== "public")) {
        expect(field.visibleToOrgIds, field.key).toEqual([genome.orgId]);
      }
    });

    it("un campo secreto no lo ven todos los roles", () => {
      for (const field of genome.fields.filter((candidate) => candidate.classification === "secret")) {
        expect(field.visibleToRoleIds.length, field.key).toBeLessThan(genome.roles.length);
      }
    });

    it("tiene al menos un secreto de cada lado del choque, para que la niebla sea real", () => {
      const secretOwners = new Set(genome.fields.filter((field) => field.classification === "secret").map((field) => field.ownerRoleId));
      expect(secretOwners.has(genome.authorityRule.proposerRoleId)).toBe(true);
      expect(secretOwners.has(genome.authorityRule.approverRoleId)).toBe(true);
    });

    it("arranca con choque de autoridad sin sellar y con un caso que cruza el umbral del aprobador", () => {
      const rule = genome.authorityRule;
      expect(rule.sealedThreshold).toBeNull();
      expect(rule.proposerLimit).toBeGreaterThan(rule.approverLimit);
      expect(genome.liveCase.triggeredMetricKey).toBe(rule.metricKey);
      expect(genome.liveCase.proposedValue).toBeGreaterThan(rule.approverLimit);
      expect(genome.liveCase.proposedValue).toBeLessThanOrEqual(rule.proposerLimit);
    });

    it("exactamente un rol entra por QR y no es ni el proponente ni el aprobador", () => {
      const qrRoles = genome.roles.filter((role) => role.isQrOptional);
      expect(qrRoles).toHaveLength(1);
      expect([genome.authorityRule.proposerRoleId, genome.authorityRule.approverRoleId]).not.toContain(qrRoles[0].id);
    });

    it("los textos públicos no mencionan ningún valor secreto", () => {
      const texts = publicTexts(genome);
      for (const field of genome.fields.filter((candidate) => candidate.classification === "secret")) {
        for (const text of texts) expect(mentions(text, field.value), `"${text}" revela ${field.key}`).toBe(false);
      }
    });

    it("getSeedGenome entrega una copia: modificarla no altera la semilla", () => {
      const copy = getSeedGenome(seedId);
      copy.fields[0].value = "alterado";
      copy.authorityRule.sealedThreshold = 1;
      expect(getSeedGenome(seedId)).toEqual(genome);
    });
  });
});

describe("semilla del recurso escaso (capa inter-org)", () => {
  const scarcity = getSeedScarcity();
  const genomes = CROSS_ORG_GENOME_IDS.map((id) => getSeedGenome(id));
  const orgIds = genomes.map((genome) => genome.orgId);

  it("pasa SharedScarcitySchema", () => {
    const result = SharedScarcitySchema.safeParse(scarcity);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it("hay exactamente un recurso y el Comité puede vetar", () => {
    expect(scarcity.rule.resourceQuantity).toBe(1);
    expect(scarcity.rule.committeeVeto).toBe(true);
  });

  it("hay un candidato por cada organización que compite, y ninguno de otra", () => {
    expect(scarcity.candidates.map((candidate) => candidate.orgId).sort()).toEqual([...orgIds].sort());
  });

  it("ningún identificador lleva tilde, mayúscula ni espacio", () => {
    const ids = [
      scarcity.rule.id,
      scarcity.arbiter.orgId,
      scarcity.arbiter.roleId,
      ...scarcity.candidates.flatMap((candidate) => [candidate.orgId, candidate.proposerRoleId, ...candidate.coverageCostVisibleToOrgs]),
    ];
    for (const id of ids) expect(id, `identificador "${id}"`).toMatch(ID);
    // caseId admite mayúsculas ("A1") pero no tildes ni espacios.
    for (const candidate of scarcity.candidates) expect(candidate.caseId).toMatch(/^[A-Za-z0-9_]+$/);
  });

  it("el rol que presenta cada candidato existe en su organización", () => {
    for (const candidate of scarcity.candidates) {
      const genome = genomes.find((item) => item.orgId === candidate.orgId);
      expect(genome, candidate.caseId).toBeDefined();
      expect(genome?.roles.map((role) => role.id as string), candidate.caseId).toContain(candidate.proposerRoleId);
    }
  });

  it("el costo de cobertura de cada candidato es visible solo para su organización", () => {
    for (const candidate of scarcity.candidates) {
      expect(candidate.coverageCostVisibleToOrgs, candidate.caseId).toEqual([candidate.orgId]);
    }
  });

  it("el costo del candidato coincide con el campo coverage_cost de su organización", () => {
    for (const candidate of scarcity.candidates) {
      const field = genomes.find((genome) => genome.orgId === candidate.orgId)?.fields.find((item) => item.key === "coverage_cost");
      expect(field?.value, candidate.caseId).toBe(candidate.coverageCost);
    }
  });

  it("el Comité es un árbitro neutral: no es ninguna de las organizaciones y no ve el costo de nadie", () => {
    expect(orgIds).not.toContain(scarcity.arbiter.orgId);
    for (const candidate of scarcity.candidates) expect(candidate.coverageCostVisibleToOrgs).not.toContain(scarcity.arbiter.orgId);
    for (const genome of genomes) {
      for (const field of genome.fields) expect(field.visibleToOrgIds, `${genome.orgId}.${field.key}`).not.toContain(scarcity.arbiter.orgId);
    }
  });

  it("los pacientes van des-identificados", () => {
    for (const candidate of scarcity.candidates) expect(candidate.patientLabel).toMatch(/^Paciente [A-Z]$/);
  });

  it("los pesos del puntaje son positivos y suman 1", () => {
    const { severity, timeCriticality, delayRisk } = scarcity.rule.weights;
    for (const weight of [severity, timeCriticality, delayRisk]) expect(weight).toBeGreaterThan(0);
    expect(severity + timeCriticality + delayRisk).toBeCloseTo(1, 10);
  });

  it("los textos públicos no mencionan ningún costo de cobertura, ni su suma", () => {
    const texts = [scarcity.resource, scarcity.rule.resourceLabel, scarcity.deadlineLabel, scarcity.stakesLabel, scarcity.arbiter.title];
    const total = scarcity.candidates.reduce((sum, candidate) => sum + candidate.coverageCost, 0);
    const secrets = [...scarcity.candidates.map((candidate) => candidate.coverageCost), total];
    for (const text of texts) {
      for (const secret of secrets) expect(mentions(text, secret), `"${text}" revela ${secret}`).toBe(false);
    }
  });

  it("los textos públicos de una organización no revelan secretos de la otra", () => {
    for (const genome of genomes) {
      for (const other of genomes.filter((item) => item.orgId !== genome.orgId)) {
        for (const field of other.fields.filter((item) => item.classification === "secret")) {
          for (const text of publicTexts(genome)) expect(mentions(text, field.value), `"${text}" revela ${other.orgId}.${field.key}`).toBe(false);
        }
      }
    }
  });

  it("getSeedScarcity entrega una copia: modificarla no altera la semilla", () => {
    const copy = getSeedScarcity();
    copy.candidates[0].coverageCost = 1;
    copy.rule.weights.severity = 0;
    expect(getSeedScarcity()).toEqual(scarcity);
  });
});

describe("salas iniciales", () => {
  it("la sala de una organización pasa RoomStateSchema y no trae recurso escaso", () => {
    const room = getInitialSingleOrgRoom("sala1", "clinica_andes", { now: 1000 });
    expect(RoomStateSchema.safeParse(room).success).toBe(true);
    expect(room).toMatchObject({ roomId: "sala1", mode: "single_org", scarcity: null, allocationStatus: null, caseOpenedAt: 1000, decisionSealedAt: null, version: 0 });
    expect(room.orgGenomes.map((genome) => genome.orgId)).toEqual(["clinica_andes"]);
    expect(room.connectedPlayers).toEqual([]);
    expect(room.decisions).toEqual([]);
  });

  it.each(SEED_GENOME_IDS)("la semilla %s sirve para abrir una sala de una organización", (seedId) => {
    const room = getInitialSingleOrgRoom("sala", seedId);
    expect(RoomStateSchema.safeParse(room).success).toBe(true);
    expect(room.orgGenomes[0].orgId).toBe(seedId);
  });

  it("la sala inter-org pasa RoomStateSchema, trae dos organizaciones y la asignación pendiente", () => {
    const room = getInitialCrossOrgRoom("sala2", { now: 2000 });
    expect(RoomStateSchema.safeParse(room).success).toBe(true);
    expect(room).toMatchObject({ roomId: "sala2", mode: "cross_org", allocationStatus: "PENDING", caseOpenedAt: 2000 });
    expect(room.orgGenomes.map((genome) => genome.orgId)).toEqual(["clinica_andes", "hospital_rural"]);
    expect(room.scarcity?.candidates).toHaveLength(2);
  });

  it("dos salas no comparten estado: cambiar una no cambia la otra", () => {
    const first = getInitialCrossOrgRoom("a");
    const second = getInitialCrossOrgRoom("b");
    first.orgGenomes[0].fields[0].value = "alterado";
    if (first.scarcity) first.scarcity.candidates[0].coverageCost = 1;
    expect(second.orgGenomes[0].fields[0].value).not.toBe("alterado");
    expect(second.scarcity?.candidates[0].coverageCost).not.toBe(1);
  });
});

describe("telemetría inicial: dice la verdad sobre dónde corre el modelo", () => {
  it("con Claude declara nube y el host de Anthropic", () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("LLM_MODEL", "claude-opus-5-5");
    const telemetry = initialTelemetry();
    expect(TelemetrySchema.safeParse(telemetry).success).toBe(true);
    expect(telemetry).toMatchObject({ provider: "cloud", endpointHost: "api.anthropic.com", modelName: "claude-opus-5-5" });
  });

  it("con modelo local declara local y el host configurado", () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("LLM_BASE_URL", "http://spark:11434/v1");
    vi.stubEnv("LLM_MODEL", "gpt-oss:20b");
    const telemetry = initialTelemetry();
    expect(telemetry).toMatchObject({ provider: "local", endpointHost: "spark:11434", modelName: "gpt-oss:20b", bytesSentToCloud: 0 });
  });

  it("el esquema no fija bytesSentToCloud en 0: acepta lo enviado a la nube y rechaza negativos", () => {
    const base = { modelName: "m", provider: "cloud", endpointHost: "api.anthropic.com", queueDepth: 0, lastLatencyMs: 0, tokensPerSec: 0 };
    expect(TelemetrySchema.safeParse({ ...base, bytesSentToCloud: 1234 }).success).toBe(true);
    expect(TelemetrySchema.safeParse({ ...base, bytesSentToCloud: -1 }).success).toBe(false);
  });
});

describe("el esquema rechaza lo que rompería la demo", () => {
  it("un orgId con tilde", () => {
    const genome = getSeedGenome("clinica_andes");
    const broken = JSON.parse(JSON.stringify(genome).replaceAll("clinica_andes", "clínica_andes"));
    expect(OrgGenomeSchema.safeParse(broken).success).toBe(false);
  });

  it("un campo cuyo rol dueño no existe", () => {
    const genome = getSeedGenome("clinica_andes");
    genome.roles = genome.roles.filter((role) => role.id !== "role_c");
    genome.fields[0].ownerRoleId = "role_c";
    genome.fields[0].visibleToRoleIds = ["role_c"];
    expect(OrgGenomeSchema.safeParse(genome).success).toBe(false);
  });

  it("un campo que su propio dueño no puede ver", () => {
    const genome = getSeedGenome("clinica_andes");
    genome.fields[0].visibleToRoleIds = ["role_b"];
    expect(OrgGenomeSchema.safeParse(genome).success).toBe(false);
  });

  it("una regla cuyo proponente y aprobador son el mismo rol", () => {
    const genome = getSeedGenome("clinica_andes");
    genome.authorityRule.approverRoleId = genome.authorityRule.proposerRoleId;
    expect(OrgGenomeSchema.safeParse(genome).success).toBe(false);
  });

  it("un caso que apunta a una métrica distinta de la regla", () => {
    const genome = getSeedGenome("clinica_andes");
    genome.liveCase.triggeredMetricKey = "otra_metrica";
    expect(OrgGenomeSchema.safeParse(genome).success).toBe(false);
  });

  it("un rol de otra organización dentro del genoma", () => {
    const genome = getSeedGenome("clinica_andes");
    genome.roles[0].orgId = "hospital_rural";
    expect(OrgGenomeSchema.safeParse(genome).success).toBe(false);
  });

  it("un candidato cuyo costo de cobertura es visible para otra organización", () => {
    const scarcity = getSeedScarcity();
    scarcity.candidates[0].coverageCostVisibleToOrgs = ["clinica_andes", "hospital_rural"];
    expect(SharedScarcitySchema.safeParse(scarcity).success).toBe(false);
  });

  it("más de una unidad del recurso escaso", () => {
    const scarcity = JSON.parse(JSON.stringify(getSeedScarcity()));
    scarcity.rule.resourceQuantity = 2;
    expect(SharedScarcitySchema.safeParse(scarcity).success).toBe(false);
  });

  it("un recurso con un solo candidato", () => {
    const scarcity = getSeedScarcity();
    scarcity.candidates = scarcity.candidates.slice(0, 1);
    expect(SharedScarcitySchema.safeParse(scarcity).success).toBe(false);
  });

  it("una decisión humana sin razón, o con una razón en blanco", () => {
    const decision = { scope: "allocation", decision: "VETO", byOrgId: "comite_red", byRoleId: "role_c", ts: 1 };
    expect(HumanDecisionSchema.safeParse(decision).success).toBe(false);
    expect(HumanDecisionSchema.safeParse({ ...decision, reason: "   " }).success).toBe(false);
    expect(HumanDecisionSchema.safeParse({ ...decision, reason: "Mayor necesidad sin cubrir" }).success).toBe(true);
  });
});
