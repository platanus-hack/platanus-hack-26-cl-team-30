// Catálogo de escenarios entre organizaciones. Módulo sin dependencias: lo
// pueden importar el servidor y la interfaz (por ejemplo, para listar los
// ejemplos en la portada) sin arrastrar código de servidor.
//
// Sculptor sirve para cualquier grupo de organizaciones que deben decidir juntas
// sobre un recurso escaso sin mostrarse sus datos. Los hospitales son el ejemplo
// principal; los otros dos muestran que el mismo esqueleto sirve en otros rubros.
// Los genomas y el recurso de cada escenario viven en seeds.ts.

export const CROSS_ORG_SCENARIO_IDS = ["hospitales", "construccion", "logistica"] as const;

export type CrossOrgScenarioId = (typeof CROSS_ORG_SCENARIO_IDS)[number];

export const DEFAULT_CROSS_ORG_SCENARIO: CrossOrgScenarioId = "hospitales";

export type CrossOrgScenarioInfo = {
  id: CrossOrgScenarioId;
  /** Título corto, en lenguaje simple. */
  title: string;
  /** Qué recurso escaso se disputa. */
  resource: string;
  /** Una frase que explica el caso a alguien que no es técnico. */
  summary: string;
  /** Sala fija que se recrea sola con este escenario. */
  fixedRoomId: string;
};

export const CROSS_ORG_SCENARIOS: Readonly<Record<CrossOrgScenarioId, CrossOrgScenarioInfo>> = {
  hospitales: {
    id: "hospitales",
    title: "Dos hospitales y una cama UCI",
    resource: "Cama UCI de referencia",
    summary: "Dos hospitales necesitan la misma cama y ninguno puede ver el costo del otro.",
    fixedRoomId: "demo-cross",
  },
  construccion: {
    id: "construccion",
    title: "Dos constructoras y una grúa",
    resource: "Grúa torre compartida",
    summary: "Dos obras necesitan la misma grúa el mismo día y ninguna muestra sus costos.",
    fixedRoomId: "demo-construccion",
  },
  logistica: {
    id: "logistica",
    title: "Dos distribuidoras y un camión",
    resource: "Camión refrigerado compartido",
    summary: "Dos distribuidoras quieren el único camión refrigerado y ninguna muestra cuánto paga por el flete.",
    fixedRoomId: "demo-logistica",
  },
};

export function isCrossOrgScenarioId(value: unknown): value is CrossOrgScenarioId {
  return typeof value === "string" && (CROSS_ORG_SCENARIO_IDS as readonly string[]).includes(value);
}
