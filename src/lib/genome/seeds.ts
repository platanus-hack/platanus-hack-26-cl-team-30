// Semillas de Sculptor: genomas y recurso escaso listos para usar sin ningún modelo.
// Sirven de arranque con un clic y de respaldo si el modelo falla o devuelve un
// genoma inválido. Se validan contra los esquemas al cargar el módulo: si una
// semilla queda mal escrita, el servidor falla al iniciar y no en plena demo.
//
// DATOS SIMULADOS: todas las cifras son de un caso de ejemplo. No son datos de
// pacientes, obras ni empresas reales, ni estadísticas, y esto no es una
// herramienta clínica.
//
// Escenarios entre organizaciones (catálogo en scenarios.ts): hospitales (el
// ejemplo principal), construcción y logística. Todos usan el mismo esqueleto:
// dos organizaciones con tres roles, un dato reservado "coverage_cost" que solo
// ve quien cuida el presupuesto, y un recurso escaso con un Comité árbitro.
//
// Los textos públicos (stakesLabel, summary) no mencionan valores secretos: el
// plan original ponía el costo de cobertura en stakesLabel, lo que lo filtraba a
// roles y organizaciones que no deben verlo.

import {
  OrgGenomeSchema,
  RoomStateSchema,
  SharedScarcitySchema,
  type OrgGenome,
  type OrgGenomeInput,
  type RoomState,
  type SharedScarcity,
  type Telemetry,
} from "./schema";
import { isLocalHost } from "../llm";
import { DEFAULT_CROSS_ORG_SCENARIO, type CrossOrgScenarioId } from "./scenarios";

// --- Semilla 1: clínica (suelo de la demo) -----------------------------------

const clinicaAndesInput: OrgGenomeInput = {
  orgId: "clinica_andes",
  orgName: "Clínica de Alta Complejidad Andes",
  industry: "Salud",
  orgStyle: "Jerárquica asistencial con control de cobertura",
  roles: [
    {
      id: "role_a",
      orgId: "clinica_andes",
      title: "Jefatura de Urgencias",
      shortTag: "URGENCIAS",
      accentColor: "emerald",
      agentName: "Agente Triaje",
      agentPersona: "Prioriza por gravedad y propone la acción clínica. No tiene acceso a costos ni cobertura.",
      objective: "Cubrir al paciente antes de las 18:00.",
      painPoint: "Se pierde tiempo pidiendo permiso de costo por WhatsApp.",
      reliabilityP: 0.92,
      isQrOptional: false,
    },
    {
      id: "role_b",
      orgId: "clinica_andes",
      title: "Dirección Administrativa",
      shortTag: "GESTION",
      accentColor: "amber",
      agentName: "Agente Cobertura",
      agentPersona: "Cruza costo y contrato. Protege el secreto financiero.",
      objective: "No exceder el cupo sin firma del Comité.",
      painPoint: "Bloquea a última hora sin ver la gravedad.",
      reliabilityP: 0.92,
      isQrOptional: false,
    },
    {
      id: "role_c",
      orgId: "clinica_andes",
      title: "Comité Ético / Dirección Médica",
      shortTag: "ETICO",
      accentColor: "violet",
      agentName: "Agente Auditoría Ética",
      agentPersona: "Aprueba o veta las decisiones que cruzan el umbral, con una razón auditable.",
      objective: "Decisión ética y financiera, auditada.",
      painPoint: "No tiene visibilidad en tiempo real de la decisión.",
      reliabilityP: 0.95,
      isQrOptional: true,
    },
  ],
  fields: [
    {
      key: "triage_criticality",
      label: "Gravedad clínica",
      value: "18/40",
      unit: "pts",
      ownerOrgId: "clinica_andes",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["clinica_andes"],
      visibleToRoleIds: ["role_a"],
      classification: "secret",
    },
    {
      key: "icu_beds_available",
      label: "Camas UCI disponibles",
      value: 1,
      unit: "cama",
      ownerOrgId: "clinica_andes",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["clinica_andes"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "coverage_cost",
      label: "Costo de cobertura UCI",
      value: 2400000,
      unit: "CLP",
      ownerOrgId: "clinica_andes",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["clinica_andes"],
      visibleToRoleIds: ["role_b"],
      classification: "secret",
    },
    {
      key: "insurance_contract_cap",
      label: "Tope de contrato",
      value: 3100000,
      unit: "CLP",
      ownerOrgId: "clinica_andes",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["clinica_andes"],
      visibleToRoleIds: ["role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "deadline_window",
      label: "Ventana de cierre",
      value: "18:00",
      unit: "hoy",
      ownerOrgId: "clinica_andes",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["clinica_andes"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "public",
    },
  ],
  authorityRule: {
    id: "rule_transfer_icu",
    metricKey: "transfer_coverage_pct",
    metricLabel: "Cobertura sin firma del Comité",
    unit: "%",
    min: 0,
    max: 100,
    proposerRoleId: "role_a",
    proposerLimit: 100,
    approverRoleId: "role_b",
    approverLimit: 60,
    sealedThreshold: null,
    gateMode: "deterministic_hitl",
  },
  liveCase: {
    title: "Paciente crítico: cama UCI y derivación",
    summary: "Urgencias quiere autorizar ya; Gestión exige firma si se supera el umbral.",
    triggeredMetricKey: "transfer_coverage_pct",
    proposedValue: 82,
    stepCountN: 10,
    stakesLabel: "1 vida en riesgo · cobertura sobre el umbral · cierre 18:00",
    livesAtRisk: 1,
  },
};

// --- Semilla 2: segunda organización de la capa inter-org --------------------

const hospitalRuralInput: OrgGenomeInput = {
  orgId: "hospital_rural",
  orgName: "Hospital Rural Valle Sur",
  industry: "Salud",
  orgStyle: "Hospital público de baja complejidad que depende de derivaciones",
  roles: [
    {
      id: "role_a",
      orgId: "hospital_rural",
      title: "Médico Jefe de Turno",
      shortTag: "TURNO",
      accentColor: "emerald",
      agentName: "Agente Derivación",
      agentPersona: "Evalúa la gravedad y pide la derivación a un centro de referencia. No tiene acceso a costos ni convenios.",
      objective: "Derivar al paciente antes de que cierre la ventana de traslado.",
      painPoint: "Llama centro por centro buscando cama y nadie le confirma.",
      reliabilityP: 0.9,
      isQrOptional: false,
    },
    {
      id: "role_b",
      orgId: "hospital_rural",
      title: "Administración y Convenios",
      shortTag: "CONVENIOS",
      accentColor: "amber",
      agentName: "Agente Convenios",
      agentPersona: "Cruza el costo del traslado con el presupuesto de convenios. Protege el secreto financiero.",
      objective: "No comprometer el presupuesto mensual de derivaciones sin respaldo.",
      painPoint: "Se entera del traslado cuando ya llegó la factura.",
      reliabilityP: 0.9,
      isQrOptional: false,
    },
    {
      id: "role_c",
      orgId: "hospital_rural",
      title: "Dirección del Hospital",
      shortTag: "DIRECCION",
      accentColor: "violet",
      agentName: "Agente Auditoría",
      agentPersona: "Aprueba o veta las derivaciones que cruzan el umbral, con una razón auditable.",
      objective: "Que cada derivación costosa quede justificada y registrada.",
      painPoint: "Firma después de los hechos, sin haber visto el caso.",
      reliabilityP: 0.94,
      isQrOptional: true,
    },
  ],
  fields: [
    {
      key: "triage_criticality",
      label: "Gravedad clínica",
      value: "22/40",
      unit: "pts",
      ownerOrgId: "hospital_rural",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["hospital_rural"],
      visibleToRoleIds: ["role_a"],
      classification: "secret",
    },
    {
      key: "transfer_distance_km",
      label: "Distancia al centro de referencia",
      value: 140,
      unit: "km",
      ownerOrgId: "hospital_rural",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["hospital_rural"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "coverage_cost",
      label: "Costo de traslado y cobertura",
      value: 1600000,
      unit: "CLP",
      ownerOrgId: "hospital_rural",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["hospital_rural"],
      visibleToRoleIds: ["role_b"],
      classification: "secret",
    },
    {
      key: "referral_budget_left",
      label: "Presupuesto de derivaciones disponible",
      value: 1900000,
      unit: "CLP",
      ownerOrgId: "hospital_rural",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["hospital_rural"],
      visibleToRoleIds: ["role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "deadline_window",
      label: "Ventana de traslado",
      value: "18:00",
      unit: "hoy",
      ownerOrgId: "hospital_rural",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["hospital_rural"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "public",
    },
  ],
  authorityRule: {
    id: "rule_referral_budget",
    metricKey: "referral_budget_pct",
    metricLabel: "Presupuesto de derivaciones usado sin firma de Dirección",
    unit: "%",
    min: 0,
    max: 100,
    proposerRoleId: "role_a",
    proposerLimit: 100,
    approverRoleId: "role_b",
    approverLimit: 50,
    sealedThreshold: null,
    gateMode: "deterministic_hitl",
  },
  liveCase: {
    title: "Paciente crítico: derivación a UCI de referencia",
    summary: "El turno quiere derivar ya; Convenios exige firma si el traslado consume más de la mitad del presupuesto.",
    triggeredMetricKey: "referral_budget_pct",
    proposedValue: 84,
    stepCountN: 12,
    stakesLabel: "1 vida en riesgo · derivación pendiente · ventana 18:00",
    livesAtRisk: 1,
  },
};

// --- Semilla 2: recurso escaso entre las dos organizaciones ------------------
//
// Con estos pesos los puntajes quedan en 0,52 (Paciente A) y 0,53 (Paciente B):
// la diferencia de 0,01 es menor que tieEpsilon, así que decide el desempate por
// equidad (mayor necesidad sin cubrir), que favorece al hospital rural.

const scarcityInput = {
  resource: "Cama UCI de referencia (derivación)",
  rule: {
    id: "alloc_ref_icu",
    resourceLabel: "Cama de referencia #1",
    resourceQuantity: 1 as const,
    weights: { severity: 0.5, timeCriticality: 0.3, delayRisk: 0.2 },
    tieEpsilon: 0.02,
    equityTieBreak: "worst_unmet_need" as const,
    committeeVeto: true as const,
  },
  candidates: [
    {
      orgId: "clinica_andes",
      caseId: "A1",
      patientLabel: "Paciente A",
      clinicalSeverityScore: 0.9,
      timeCriticality: 0.8,
      delayRiskScore: 0.85,
      unmetNeedScore: 0.4,
      coverageCost: 2400000,
      coverageCostVisibleToOrgs: ["clinica_andes"],
      proposerRoleId: "role_a",
    },
    {
      orgId: "hospital_rural",
      caseId: "B1",
      patientLabel: "Paciente B",
      clinicalSeverityScore: 0.8,
      timeCriticality: 0.9,
      delayRiskScore: 0.7,
      unmetNeedScore: 0.9,
      coverageCost: 1600000,
      coverageCostVisibleToOrgs: ["hospital_rural"],
      proposerRoleId: "role_a",
    },
  ],
  arbiter: {
    orgId: "comite_red",
    roleId: "role_c" as const,
    title: "Comité Ético de la Red",
    shortTag: "COMITE",
  },
  deadlineLabel: "Ventana de derivación 18:00 (hoy)",
  stakesLabel: "1 cama · 2 organizaciones · 2 vidas en riesgo",
};

// --- Semilla 3: distribuidora B2B (caso no clínico) ---------------------------

const distTechInput: OrgGenomeInput = {
  orgId: "dist_tech",
  orgName: "Distribuidora Tech B2B",
  industry: "Distribución mayorista de tecnología",
  orgStyle: "Comercial por metas con control financiero centralizado",
  roles: [
    {
      id: "role_a",
      orgId: "dist_tech",
      title: "Gerencia Comercial",
      shortTag: "COMERCIAL",
      accentColor: "emerald",
      agentName: "Agente Ventas",
      agentPersona: "Negocia precio y plazo para cerrar el pedido. No tiene acceso al margen neto real.",
      objective: "Cerrar el pedido urgente hoy, aunque haya que dar descuento.",
      painPoint: "Promete descuentos por chat y Finanzas los rechaza después.",
      reliabilityP: 0.9,
      isQrOptional: false,
    },
    {
      id: "role_b",
      orgId: "dist_tech",
      title: "Gerencia de Finanzas",
      shortTag: "FINANZAS",
      accentColor: "amber",
      agentName: "Agente Margen",
      agentPersona: "Calcula el margen de cada pedido. Protege el margen neto real y el costo de reposición.",
      objective: "Que ningún pedido salga bajo el margen mínimo sin firma del Directorio.",
      painPoint: "Revisa los descuentos cuando el pedido ya fue despachado.",
      reliabilityP: 0.93,
      isQrOptional: false,
    },
    {
      id: "role_c",
      orgId: "dist_tech",
      title: "Directorio",
      shortTag: "DIRECTORIO",
      accentColor: "violet",
      agentName: "Agente Gobierno",
      agentPersona: "Aprueba o veta los descuentos que cruzan el umbral, con una razón auditable.",
      objective: "Crecer sin regalar margen, con cada excepción registrada.",
      painPoint: "Se entera de las excepciones en el cierre de mes.",
      reliabilityP: 0.95,
      isQrOptional: true,
    },
  ],
  fields: [
    {
      key: "order_value",
      label: "Valor del pedido",
      value: 48000000,
      unit: "CLP",
      ownerOrgId: "dist_tech",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["dist_tech"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "customer_churn_risk",
      label: "Riesgo de perder al cliente",
      value: "Alto",
      ownerOrgId: "dist_tech",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["dist_tech"],
      visibleToRoleIds: ["role_a"],
      classification: "secret",
    },
    {
      key: "net_margin_pct",
      label: "Margen neto real",
      value: 14,
      unit: "%",
      ownerOrgId: "dist_tech",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["dist_tech"],
      visibleToRoleIds: ["role_b"],
      classification: "secret",
    },
    {
      key: "min_margin_policy_pct",
      label: "Margen mínimo por política",
      value: 6,
      unit: "%",
      ownerOrgId: "dist_tech",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["dist_tech"],
      visibleToRoleIds: ["role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "shared_stock_units",
      label: "Stock compartido disponible",
      value: 120,
      unit: "unidades",
      ownerOrgId: "dist_tech",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["dist_tech"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "public",
    },
    {
      key: "dispatch_cutoff",
      label: "Corte de despacho",
      value: "17:00",
      unit: "hoy",
      ownerOrgId: "dist_tech",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["dist_tech"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "public",
    },
  ],
  authorityRule: {
    id: "rule_max_discount",
    metricKey: "discount_pct",
    metricLabel: "Descuento sin firma del Directorio",
    unit: "%",
    min: 0,
    max: 30,
    proposerRoleId: "role_a",
    proposerLimit: 20,
    approverRoleId: "role_b",
    approverLimit: 8,
    sealedThreshold: null,
    gateMode: "deterministic_hitl",
  },
  liveCase: {
    title: "Pedido urgente con descuento fuera de política",
    summary: "Comercial quiere cerrar hoy con 12% de descuento; Finanzas exige firma si se pasa del umbral.",
    triggeredMetricKey: "discount_pct",
    proposedValue: 12,
    stepCountN: 8,
    stakesLabel: "1 pedido urgente · 1 cliente en riesgo · despacho 17:00",
  },
};

// --- Escenario "construccion": dos constructoras y una grúa -------------------
//
// Mismo esqueleto que los hospitales con otro rubro. Cada constructora tiene
// quien quiere actuar ya (terreno), quien cuida el presupuesto (finanzas) y una
// gerencia que firma las excepciones. El costo de arriendo es el dato reservado.

const constructoraNorteInput: OrgGenomeInput = {
  orgId: "constructora_norte",
  orgName: "Constructora Cordillera",
  industry: "Construcción",
  orgStyle: "Obras por proyecto con control de presupuesto central",
  roles: [
    {
      id: "role_a",
      orgId: "constructora_norte",
      title: "Jefatura de Obra",
      shortTag: "OBRA",
      accentColor: "emerald",
      agentName: "Agente Obra",
      agentPersona: "Ordena las faenas y pide los equipos que la obra necesita. No ve costos de arriendo ni presupuesto.",
      objective: "Terminar el montaje de la losa antes del hormigonado del jueves.",
      painPoint: "Pide la grúa por teléfono y nadie confirma a tiempo.",
      reliabilityP: 0.9,
      isQrOptional: false,
    },
    {
      id: "role_b",
      orgId: "constructora_norte",
      title: "Gerencia de Finanzas",
      shortTag: "FINANZAS",
      accentColor: "amber",
      agentName: "Agente Presupuesto",
      agentPersona: "Cruza el costo de cada equipo con el presupuesto de la obra. Protege el costo de arriendo.",
      objective: "No pasarse del presupuesto de equipos sin firma del Directorio.",
      painPoint: "Se entera del arriendo cuando llega la factura.",
      reliabilityP: 0.92,
      isQrOptional: false,
    },
    {
      id: "role_c",
      orgId: "constructora_norte",
      title: "Directorio",
      shortTag: "DIRECTORIO",
      accentColor: "violet",
      agentName: "Agente Gobierno",
      agentPersona: "Aprueba o rechaza los gastos que cruzan el umbral, con una razón que queda registrada.",
      objective: "Que cada gasto fuera de presupuesto quede justificado.",
      painPoint: "Firma después de los hechos, sin ver la urgencia de la obra.",
      reliabilityP: 0.95,
      isQrOptional: true,
    },
  ],
  fields: [
    {
      key: "stop_risk",
      label: "Riesgo si la obra se detiene",
      value: "Alto",
      ownerOrgId: "constructora_norte",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["constructora_norte"],
      visibleToRoleIds: ["role_a"],
      classification: "secret",
    },
    {
      key: "coverage_cost",
      label: "Costo de arriendo de la grúa",
      value: 4800000,
      unit: "CLP",
      ownerOrgId: "constructora_norte",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["constructora_norte"],
      visibleToRoleIds: ["role_b"],
      classification: "secret",
    },
    {
      key: "equipment_budget_left",
      label: "Presupuesto de equipos disponible",
      value: 6100000,
      unit: "CLP",
      ownerOrgId: "constructora_norte",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["constructora_norte"],
      visibleToRoleIds: ["role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "pour_window",
      label: "Hormigonado programado",
      value: "Jueves 08:00",
      ownerOrgId: "constructora_norte",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["constructora_norte"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "public",
    },
  ],
  authorityRule: {
    id: "rule_equipment_budget",
    metricKey: "equipment_budget_pct",
    metricLabel: "Presupuesto de equipos usado sin firma del Directorio",
    unit: "%",
    min: 0,
    max: 100,
    proposerRoleId: "role_a",
    proposerLimit: 100,
    approverRoleId: "role_b",
    approverLimit: 55,
    sealedThreshold: null,
    gateMode: "deterministic_hitl",
  },
  liveCase: {
    title: "Montaje de losa: hace falta la grúa el jueves",
    summary: "La obra quiere la grúa ya; Finanzas exige firma si el arriendo se come más de la mitad del presupuesto.",
    triggeredMetricKey: "equipment_budget_pct",
    proposedValue: 80,
    stepCountN: 9,
    stakesLabel: "1 losa sin terminar · cuadrilla esperando · hormigonado jueves 08:00",
  },
};

const constructoraSurInput: OrgGenomeInput = {
  orgId: "constructora_sur",
  orgName: "Constructora Litoral Sur",
  industry: "Construcción",
  orgStyle: "Contratista con multas por atraso en cada contrato",
  roles: [
    {
      id: "role_a",
      orgId: "constructora_sur",
      title: "Jefatura de Terreno",
      shortTag: "TERRENO",
      accentColor: "emerald",
      agentName: "Agente Terreno",
      agentPersona: "Coordina el montaje y pide los equipos que faltan. No ve costos de arriendo ni multas.",
      objective: "Izar la estructura antes de que corra la multa del contrato.",
      painPoint: "Compite por la misma grúa con otra obra y gana quien llama primero.",
      reliabilityP: 0.89,
      isQrOptional: false,
    },
    {
      id: "role_b",
      orgId: "constructora_sur",
      title: "Administración de Contratos",
      shortTag: "CONTRATOS",
      accentColor: "amber",
      agentName: "Agente Contratos",
      agentPersona: "Compara el costo del arriendo con las multas del contrato. Protege el costo de arriendo.",
      objective: "No comprometer el presupuesto del contrato sin respaldo de la Gerencia.",
      painPoint: "Aprueba a ciegas porque no ve cuánto se atrasa la obra.",
      reliabilityP: 0.91,
      isQrOptional: false,
    },
    {
      id: "role_c",
      orgId: "constructora_sur",
      title: "Gerencia General",
      shortTag: "GERENCIA",
      accentColor: "violet",
      agentName: "Agente Auditoría",
      agentPersona: "Aprueba o rechaza los gastos que cruzan el umbral, con una razón que queda registrada.",
      objective: "Cumplir el contrato sin gastos sin justificar.",
      painPoint: "Se entera de las multas cuando ya están cobradas.",
      reliabilityP: 0.94,
      isQrOptional: true,
    },
  ],
  fields: [
    {
      key: "stop_risk",
      label: "Riesgo si el montaje se detiene",
      value: "Moderado",
      ownerOrgId: "constructora_sur",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["constructora_sur"],
      visibleToRoleIds: ["role_a"],
      classification: "secret",
    },
    {
      key: "coverage_cost",
      label: "Costo de arriendo de la grúa",
      value: 3900000,
      unit: "CLP",
      ownerOrgId: "constructora_sur",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["constructora_sur"],
      visibleToRoleIds: ["role_b"],
      classification: "secret",
    },
    {
      key: "daily_penalty",
      label: "Multa diaria por atraso",
      value: 1250000,
      unit: "CLP",
      ownerOrgId: "constructora_sur",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["constructora_sur"],
      visibleToRoleIds: ["role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "lift_window",
      label: "Izaje programado",
      value: "Jueves 14:00",
      ownerOrgId: "constructora_sur",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["constructora_sur"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "public",
    },
  ],
  authorityRule: {
    id: "rule_contract_budget",
    metricKey: "contract_budget_pct",
    metricLabel: "Presupuesto del contrato usado sin firma de Gerencia",
    unit: "%",
    min: 0,
    max: 100,
    proposerRoleId: "role_a",
    proposerLimit: 100,
    approverRoleId: "role_b",
    approverLimit: 45,
    sealedThreshold: null,
    gateMode: "deterministic_hitl",
  },
  liveCase: {
    title: "Izaje de estructura: la grúa o la multa",
    summary: "Terreno quiere la grúa el jueves; Contratos exige firma si el arriendo pasa del umbral.",
    triggeredMetricKey: "contract_budget_pct",
    proposedValue: 75,
    stepCountN: 10,
    stakesLabel: "1 estructura sin izar · multa por atraso corriendo · izaje jueves 14:00",
  },
};

// Puntajes: Obra A 0,51 y Obra B 0,50. La diferencia (0,01) es menor que
// tieEpsilon, así que decide la equidad: Obra B tiene más necesidad sin cubrir y
// gana aunque su puntaje sea menor. Aquí el desempate sí cambia el resultado.
const construccionScarcityInput = {
  resource: "Grúa torre compartida (jueves)",
  rule: {
    id: "alloc_tower_crane",
    resourceLabel: "Grúa torre #1",
    resourceQuantity: 1 as const,
    weights: { severity: 0.5, timeCriticality: 0.3, delayRisk: 0.2 },
    tieEpsilon: 0.02,
    equityTieBreak: "worst_unmet_need" as const,
    committeeVeto: true as const,
  },
  candidates: [
    {
      orgId: "constructora_norte",
      caseId: "O1",
      patientLabel: "Obra A",
      clinicalSeverityScore: 0.8,
      timeCriticality: 0.7,
      delayRiskScore: 0.5,
      unmetNeedScore: 0.4,
      coverageCost: 4800000,
      coverageCostVisibleToOrgs: ["constructora_norte"],
      proposerRoleId: "role_a",
    },
    {
      orgId: "constructora_sur",
      caseId: "O2",
      patientLabel: "Obra B",
      clinicalSeverityScore: 0.7,
      timeCriticality: 0.9,
      delayRiskScore: 0.6,
      unmetNeedScore: 0.85,
      coverageCost: 3900000,
      coverageCostVisibleToOrgs: ["constructora_sur"],
      proposerRoleId: "role_a",
    },
  ],
  arbiter: {
    orgId: "comite_obras",
    roleId: "role_c" as const,
    title: "Comité de Coordinación de Obras",
    shortTag: "COMITE",
  },
  deadlineLabel: "La grúa queda libre el jueves a las 08:00",
  stakesLabel: "1 grúa · 2 constructoras · 2 obras esperando",
};

// --- Escenario "logistica": dos distribuidoras y un camión ---------------------

const distribuidoraCentroInput: OrgGenomeInput = {
  orgId: "distribuidora_centro",
  orgName: "Distribuidora Centro Alimentos",
  industry: "Distribución de alimentos",
  orgStyle: "Despachos diarios con presupuesto de fletes mensual",
  roles: [
    {
      id: "role_a",
      orgId: "distribuidora_centro",
      title: "Jefatura de Despacho",
      shortTag: "DESPACHO",
      accentColor: "emerald",
      agentName: "Agente Despacho",
      agentPersona: "Arma las rutas y pide el transporte que hace falta. No ve el costo de los fletes.",
      objective: "Sacar la mercadería perecible antes de que se pierda.",
      painPoint: "Consigue camión llamando a varios proveedores el mismo día.",
      reliabilityP: 0.9,
      isQrOptional: false,
    },
    {
      id: "role_b",
      orgId: "distribuidora_centro",
      title: "Gerencia de Finanzas",
      shortTag: "FINANZAS",
      accentColor: "amber",
      agentName: "Agente Fletes",
      agentPersona: "Compara cada flete con el presupuesto del mes. Protege el costo del flete.",
      objective: "No pasarse del presupuesto de fletes sin firma de la Gerencia General.",
      painPoint: "Aprueba fletes caros sin saber qué se pierde si no salen.",
      reliabilityP: 0.92,
      isQrOptional: false,
    },
    {
      id: "role_c",
      orgId: "distribuidora_centro",
      title: "Gerencia General",
      shortTag: "GERENCIA",
      accentColor: "violet",
      agentName: "Agente Gobierno",
      agentPersona: "Aprueba o rechaza los fletes que cruzan el umbral, con una razón que queda registrada.",
      objective: "Que ningún flete fuera de presupuesto salga sin justificar.",
      painPoint: "Revisa los fletes a fin de mes, cuando ya no hay nada que hacer.",
      reliabilityP: 0.95,
      isQrOptional: true,
    },
  ],
  fields: [
    {
      key: "perishable_load",
      label: "Mercadería perecible en bodega",
      value: "4 toneladas",
      ownerOrgId: "distribuidora_centro",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["distribuidora_centro"],
      visibleToRoleIds: ["role_a"],
      classification: "secret",
    },
    {
      key: "coverage_cost",
      label: "Costo del flete",
      value: 850000,
      unit: "CLP",
      ownerOrgId: "distribuidora_centro",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["distribuidora_centro"],
      visibleToRoleIds: ["role_b"],
      classification: "secret",
    },
    {
      key: "freight_budget_left",
      label: "Presupuesto de fletes disponible",
      value: 1400000,
      unit: "CLP",
      ownerOrgId: "distribuidora_centro",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["distribuidora_centro"],
      visibleToRoleIds: ["role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "truck_departure",
      label: "Salida del camión",
      value: "Martes 06:00",
      ownerOrgId: "distribuidora_centro",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["distribuidora_centro"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "public",
    },
  ],
  authorityRule: {
    id: "rule_freight_budget_centro",
    metricKey: "freight_budget_pct",
    metricLabel: "Presupuesto de fletes usado sin firma de Gerencia",
    unit: "%",
    min: 0,
    max: 100,
    proposerRoleId: "role_a",
    proposerLimit: 100,
    approverRoleId: "role_b",
    approverLimit: 50,
    sealedThreshold: null,
    gateMode: "deterministic_hitl",
  },
  liveCase: {
    title: "Carga perecible: hace falta el camión el martes",
    summary: "Despacho quiere el camión ya; Finanzas exige firma si el flete pasa de la mitad del presupuesto.",
    triggeredMetricKey: "freight_budget_pct",
    proposedValue: 70,
    stepCountN: 8,
    stakesLabel: "1 carga perecible · clientes esperando · salida martes 06:00",
  },
};

const distribuidoraCostaInput: OrgGenomeInput = {
  orgId: "distribuidora_costa",
  orgName: "Distribuidora Costa Farma",
  industry: "Distribución farmacéutica",
  orgStyle: "Despachos con cadena de frío y control de gestión estricto",
  roles: [
    {
      id: "role_a",
      orgId: "distribuidora_costa",
      title: "Jefatura de Bodega",
      shortTag: "BODEGA",
      accentColor: "emerald",
      agentName: "Agente Bodega",
      agentPersona: "Prepara los pedidos y pide el transporte refrigerado. No ve el costo de los fletes.",
      objective: "Entregar los insumos refrigerados a tiempo en la costa.",
      painPoint: "Si el camión no llega, los insumos se quedan en bodega.",
      reliabilityP: 0.89,
      isQrOptional: false,
    },
    {
      id: "role_b",
      orgId: "distribuidora_costa",
      title: "Control de Gestión",
      shortTag: "GESTION",
      accentColor: "amber",
      agentName: "Agente Gestión",
      agentPersona: "Revisa cada flete contra el presupuesto. Protege el costo del flete.",
      objective: "No comprometer el presupuesto de fletes sin firma de la Dirección.",
      painPoint: "Bloquea fletes urgentes porque no ve qué se pierde.",
      reliabilityP: 0.91,
      isQrOptional: false,
    },
    {
      id: "role_c",
      orgId: "distribuidora_costa",
      title: "Dirección",
      shortTag: "DIRECCION",
      accentColor: "violet",
      agentName: "Agente Auditoría",
      agentPersona: "Aprueba o rechaza los fletes que cruzan el umbral, con una razón que queda registrada.",
      objective: "Que cada excepción quede justificada y registrada.",
      painPoint: "Firma sin haber visto el caso completo.",
      reliabilityP: 0.94,
      isQrOptional: true,
    },
  ],
  fields: [
    {
      key: "cold_chain_load",
      label: "Insumos con cadena de frío",
      value: "Vacunas y sueros",
      ownerOrgId: "distribuidora_costa",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["distribuidora_costa"],
      visibleToRoleIds: ["role_a"],
      classification: "secret",
    },
    {
      key: "coverage_cost",
      label: "Costo del flete",
      value: 620000,
      unit: "CLP",
      ownerOrgId: "distribuidora_costa",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["distribuidora_costa"],
      visibleToRoleIds: ["role_b"],
      classification: "secret",
    },
    {
      key: "freight_budget_left",
      label: "Presupuesto de fletes disponible",
      value: 910000,
      unit: "CLP",
      ownerOrgId: "distribuidora_costa",
      ownerRoleId: "role_b",
      visibleToOrgIds: ["distribuidora_costa"],
      visibleToRoleIds: ["role_b", "role_c"],
      classification: "restricted",
    },
    {
      key: "route_window",
      label: "Ruta a la costa",
      value: "Martes 06:00",
      ownerOrgId: "distribuidora_costa",
      ownerRoleId: "role_a",
      visibleToOrgIds: ["distribuidora_costa"],
      visibleToRoleIds: ["role_a", "role_b", "role_c"],
      classification: "public",
    },
  ],
  authorityRule: {
    id: "rule_freight_budget_costa",
    metricKey: "freight_budget_pct",
    metricLabel: "Presupuesto de fletes usado sin firma de Dirección",
    unit: "%",
    min: 0,
    max: 100,
    proposerRoleId: "role_a",
    proposerLimit: 100,
    approverRoleId: "role_b",
    approverLimit: 60,
    sealedThreshold: null,
    gateMode: "deterministic_hitl",
  },
  liveCase: {
    title: "Insumos refrigerados: el camión o la pérdida",
    summary: "Bodega quiere el camión el martes; Gestión exige firma si el flete pasa del umbral.",
    triggeredMetricKey: "freight_budget_pct",
    proposedValue: 85,
    stepCountN: 9,
    stakesLabel: "1 carga refrigerada · farmacias esperando · salida martes 06:00",
  },
};

// Puntajes: Carga A 0,46 y Carga B 0,48. La diferencia (0,02) no es menor que
// tieEpsilon: gana Carga B por puntaje, sin desempate. Un escenario de cada tipo.
const logisticaScarcityInput = {
  resource: "Camión refrigerado compartido (martes)",
  rule: {
    id: "alloc_cold_truck",
    resourceLabel: "Camión refrigerado #1",
    resourceQuantity: 1 as const,
    weights: { severity: 0.5, timeCriticality: 0.3, delayRisk: 0.2 },
    tieEpsilon: 0.02,
    equityTieBreak: "worst_unmet_need" as const,
    committeeVeto: true as const,
  },
  candidates: [
    {
      orgId: "distribuidora_centro",
      caseId: "C1",
      patientLabel: "Carga A",
      clinicalSeverityScore: 0.6,
      timeCriticality: 0.8,
      delayRiskScore: 0.4,
      unmetNeedScore: 0.3,
      coverageCost: 850000,
      coverageCostVisibleToOrgs: ["distribuidora_centro"],
      proposerRoleId: "role_a",
    },
    {
      orgId: "distribuidora_costa",
      caseId: "C2",
      patientLabel: "Carga B",
      clinicalSeverityScore: 0.9,
      timeCriticality: 0.7,
      delayRiskScore: 0.9,
      unmetNeedScore: 0.7,
      coverageCost: 620000,
      coverageCostVisibleToOrgs: ["distribuidora_costa"],
      proposerRoleId: "role_a",
    },
  ],
  arbiter: {
    orgId: "comite_logistica",
    roleId: "role_c" as const,
    title: "Comité de Coordinación Logística",
    shortTag: "COMITE",
  },
  deadlineLabel: "El camión sale el martes a las 06:00",
  stakesLabel: "1 camión · 2 distribuidoras · 2 cargas esperando",
};

// --- Validación al cargar -----------------------------------------------------

const GENOMES = {
  clinica_andes: OrgGenomeSchema.parse(clinicaAndesInput),
  hospital_rural: OrgGenomeSchema.parse(hospitalRuralInput),
  dist_tech: OrgGenomeSchema.parse(distTechInput),
  constructora_norte: OrgGenomeSchema.parse(constructoraNorteInput),
  constructora_sur: OrgGenomeSchema.parse(constructoraSurInput),
  distribuidora_centro: OrgGenomeSchema.parse(distribuidoraCentroInput),
  distribuidora_costa: OrgGenomeSchema.parse(distribuidoraCostaInput),
} satisfies Record<string, OrgGenome>;

const SCARCITY: SharedScarcity = SharedScarcitySchema.parse(scarcityInput);

/** Cada escenario entre organizaciones: sus dos genomas, en orden, y su recurso escaso. */
const CROSS_ORG_SCENARIO_SEEDS: Record<CrossOrgScenarioId, { genomeIds: [keyof typeof GENOMES, keyof typeof GENOMES]; scarcity: SharedScarcity }> = {
  hospitales: { genomeIds: ["clinica_andes", "hospital_rural"], scarcity: SCARCITY },
  construccion: { genomeIds: ["constructora_norte", "constructora_sur"], scarcity: SharedScarcitySchema.parse(construccionScarcityInput) },
  logistica: { genomeIds: ["distribuidora_centro", "distribuidora_costa"], scarcity: SharedScarcitySchema.parse(logisticaScarcityInput) },
};

export type SeedGenomeId = keyof typeof GENOMES;

export const SEED_GENOME_IDS = Object.keys(GENOMES) as SeedGenomeId[];

/** Genoma por defecto del suelo de la demo. */
export const DEFAULT_SEED_GENOME_ID: SeedGenomeId = "clinica_andes";

/** Organizaciones del escenario principal (hospitales), en el orden en que se muestran. */
export const CROSS_ORG_GENOME_IDS: SeedGenomeId[] = [...CROSS_ORG_SCENARIO_SEEDS.hospitales.genomeIds];

/** Genomas de un escenario entre organizaciones, en el orden en que se muestran. */
export function getScenarioGenomeIds(scenario: CrossOrgScenarioId = DEFAULT_CROSS_ORG_SCENARIO): SeedGenomeId[] {
  return [...CROSS_ORG_SCENARIO_SEEDS[scenario].genomeIds];
}

export function isSeedGenomeId(value: unknown): value is SeedGenomeId {
  return typeof value === "string" && value in GENOMES;
}

/** Copia nueva del genoma semilla: modificarla no altera la semilla. */
export function getSeedGenome(id: SeedGenomeId = DEFAULT_SEED_GENOME_ID): OrgGenome {
  return structuredClone(GENOMES[id]);
}

/** Copia nueva del recurso escaso de un escenario entre organizaciones (por defecto, los hospitales). */
export function getSeedScarcity(scenario: CrossOrgScenarioId = DEFAULT_CROSS_ORG_SCENARIO): SharedScarcity {
  return structuredClone(CROSS_ORG_SCENARIO_SEEDS[scenario].scarcity);
}

/**
 * Telemetría antes de la primera llamada al modelo. Solo declara lo que se sabe
 * por configuración: "local" únicamente si el modelo se sirve desde esta máquina
 * o una red privada (misma regla que la capa de modelos, isLocalHost); cualquier
 * otro host cuenta como nube. Los contadores parten en 0 y los lleva la capa de
 * modelos (getTelemetry en src/lib/llm.ts).
 */
export function initialTelemetry(): Telemetry {
  const anthropic = process.env.LLM_PROVIDER === "anthropic";
  let endpointHost = "api.anthropic.com";
  let local = false;
  if (!anthropic) {
    try {
      const url = new URL(process.env.LLM_BASE_URL ?? "http://localhost:11434/v1");
      endpointHost = url.host;
      local = isLocalHost(url.hostname);
    } catch {
      endpointHost = "desconocido";
    }
  }
  return {
    modelName: process.env.LLM_MODEL ?? (anthropic ? "claude-opus-5-5" : "gpt-oss:20b"),
    provider: local ? "local" : "cloud",
    endpointHost,
    bytesSentToCloud: 0,
    queueDepth: 0,
    lastLatencyMs: 0,
    tokensPerSec: 0,
  };
}

export type InitialRoomOptions = {
  /** Reloj del servidor al abrir el caso. Por defecto, ahora. */
  now?: number;
  telemetry?: Telemetry;
  /** Solo en cross_org: qué escenario abrir. Por defecto, los hospitales. */
  scenario?: CrossOrgScenarioId;
};

function baseRoom(roomId: string, options: InitialRoomOptions): Pick<
  RoomState,
  "roomId" | "connectedPlayers" | "gateStatus" | "decisions" | "auditLog" | "telemetry" | "caseOpenedAt" | "decisionSealedAt" | "version"
> {
  return {
    roomId,
    connectedPlayers: [],
    // Estado neutro: el motor lo recalcula a partir del genoma al crear la sala.
    gateStatus: "OPEN",
    decisions: [],
    auditLog: [],
    telemetry: options.telemetry ?? initialTelemetry(),
    caseOpenedAt: options.now ?? Date.now(),
    decisionSealedAt: null,
    version: 0,
  };
}

/** Sala inicial de una sola organización (suelo). Acepta una semilla o un genoma ya validado. */
export function getInitialSingleOrgRoom(
  roomId: string,
  genome: SeedGenomeId | OrgGenome = DEFAULT_SEED_GENOME_ID,
  options: InitialRoomOptions = {},
): RoomState {
  return RoomStateSchema.parse({
    ...baseRoom(roomId, options),
    mode: "single_org",
    orgGenomes: [typeof genome === "string" ? getSeedGenome(genome) : genome],
    scarcity: null,
    allocationStatus: null,
  });
}

/** Sala inicial entre organizaciones: dos organizaciones y un recurso escaso, del escenario pedido. */
export function getInitialCrossOrgRoom(roomId: string, options: InitialRoomOptions = {}): RoomState {
  const scenario = options.scenario ?? DEFAULT_CROSS_ORG_SCENARIO;
  return RoomStateSchema.parse({
    ...baseRoom(roomId, options),
    mode: "cross_org",
    scenarioId: scenario,
    orgGenomes: getScenarioGenomeIds(scenario).map((id) => getSeedGenome(id)),
    scarcity: getSeedScarcity(scenario),
    allocationStatus: "PENDING",
  });
}
