// Textos de las páginas de caso de uso. Pocas palabras (docs/DISENO.md): títulos
// de hasta 6 palabras y una frase de hasta 12. Las cifras y los nombres de cada
// organización no van aquí: salen del motor, igual que en la demo (data.ts).

import { BedDouble, Construction, Truck, Wallet } from "lucide-react";
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

/** Usos del mismo esqueleto. Los que tienen página llevan su enlace; presupuestos todavía no. */
const USES: Record<CaseSlug | "presupuestos", CaseUse> = {
  hospitales: { icon: BedDouble, title: "Salud", detail: "Dos hospitales, una cama UCI.", href: "/casos/hospitales" },
  construccion: { icon: Construction, title: "Construcción", detail: "Dos obras, una grúa compartida.", href: "/casos/construccion" },
  logistica: { icon: Truck, title: "Logística", detail: "Dos distribuidoras, un camión refrigerado.", href: "/casos/logistica" },
  presupuestos: { icon: Wallet, title: "Presupuestos", detail: "Dos áreas, lo que queda del trimestre." },
};

/** «Sculptor sirve para más»: los otros dos casos y presupuestos. */
export function otherUses(slug: CaseSlug): CaseUse[] {
  return [...CASE_ORDER.filter((entry) => entry !== slug).map((entry) => USES[entry]), USES.presupuestos];
}
