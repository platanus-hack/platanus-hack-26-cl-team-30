// Textos de las páginas de caso de uso. Pocas palabras (docs/DISENO.md): títulos
// de hasta 6 palabras y una frase de hasta 12. Las cifras y los nombres de cada
// organización no van aquí: salen del motor, igual que en la demo (data.ts).

import { BedDouble, Construction, Truck } from "lucide-react";
import type { CaseStudy, CaseUse } from "./types";

const STEP_DECIDE = { title: "El Comité decide con razón", detail: "Acepta o rechaza. Queda el acta." };

export const CASES = {
  hospitales: {
    scenario: "hospitales",
    slug: "hospitales",
    nav: "Salud",
    kicker: "Caso de uso · Salud",
    title: ["Una cama UCI.", "Dos hospitales."],
    lede: "Ninguno puede mostrarle sus datos al otro.",
    icon: BedDouble,
    steps: [
      { title: "Cada hospital presenta su caso", detail: "Sin mostrar costos ni camas." },
      { title: "La regla ordena a la vista", detail: "Solo lo clínico. El costo no entra." },
      STEP_DECIDE,
    ],
    arbiterLabel: "Comité",
    disclaimer: "Demostración simulada. No es una herramienta clínica.",
  },
  construccion: {
    scenario: "construccion",
    slug: "construccion",
    nav: "Construcción",
    kicker: "Caso de uso · Construcción",
    title: ["Una grúa torre.", "Dos obras."],
    lede: "El jueves la necesitan las dos. Ninguna muestra sus costos.",
    icon: Construction,
    steps: [
      { title: "Cada obra presenta su caso", detail: "Sin mostrar costos ni multas." },
      { title: "La regla ordena a la vista", detail: "Riesgo y urgencia. El costo no entra." },
      STEP_DECIDE,
    ],
    arbiterLabel: "Comité",
    disclaimer: "Demostración simulada. Datos de ejemplo.",
  },
  logistica: {
    scenario: "logistica",
    slug: "logistica",
    nav: "Logística",
    kicker: "Caso de uso · Logística",
    title: ["Un camión refrigerado.", "Dos distribuidoras."],
    lede: "Ninguna puede mostrarle a la otra cuánto paga.",
    icon: Truck,
    steps: [
      { title: "Cada distribuidora presenta su carga", detail: "Sin mostrar fletes ni presupuestos." },
      { title: "La regla ordena a la vista", detail: "Lo que se pierde si espera. El flete no entra." },
      STEP_DECIDE,
    ],
    arbiterLabel: "Comité",
    disclaimer: "Demostración simulada. Datos de ejemplo.",
  },
} satisfies Record<string, CaseStudy>;

export type CaseSlug = keyof typeof CASES;

/** Orden de la fila de enlaces entre casos. */
export const CASE_ORDER: CaseSlug[] = ["hospitales", "construccion", "logistica"];

/**
 * Dónde más sirve el mismo esqueleto: la misma lista de rubros que la landing de Sculptor
 * («Mismo esqueleto, otro genoma», src/components/sculptor/content.ts), dicha como la
 * pregunta que se hace la gente. Los rubros con página llevan su enlace.
 */
const USES: Record<CaseSlug | "ventas" | "rrhh" | "banca" | "mineria", CaseUse> = {
  hospitales: { title: "Salud", detail: "¿A quién va la última cama UCI?", status: "Ver el caso", href: "/casos/hospitales" },
  construccion: { title: "Construcción", detail: "¿Qué obra usa la grúa el jueves?", status: "Ver el caso", href: "/casos/construccion" },
  logistica: { title: "Logística", detail: "¿Qué carga sube primero al camión frío?", status: "Ver el caso", href: "/casos/logistica" },
  ventas: { title: "Ventas B2B", detail: "¿Cuánto descuento le damos sin mostrar el margen?", status: "Genoma listo" },
  rrhh: { title: "RR.HH.", detail: "¿Quién asciende sin que se filtren los sueldos?", status: "Desde una frase" },
  banca: { title: "Banca", detail: "¿Se aprueba el crédito si riesgo y comercial no coinciden?", status: "Desde una frase" },
  mineria: { title: "Minería", detail: "¿Qué faena se queda con la pala este turno?", status: "Desde una frase" },
};

/** «¿Dónde más pasa esto?»: los otros dos casos primero y después el resto de los rubros. */
export function otherUses(slug: CaseSlug): CaseUse[] {
  return [...CASE_ORDER.filter((entry) => entry !== slug).map((entry) => USES[entry]), USES.ventas, USES.rrhh, USES.banca, USES.mineria];
}
