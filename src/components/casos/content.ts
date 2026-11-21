// Textos de las páginas de caso de uso. Pocas palabras (docs/DISENO.md): títulos
// de hasta 6 palabras y una frase de hasta 12. Las cifras no van aquí: salen del motor.

import { BedDouble, Construction, Truck, Wallet } from "lucide-react";
import type { CaseStudy } from "./types";

const MORE: CaseStudy["more"] = [
  { icon: Construction, title: "Construcción", detail: "Dos obras, una grúa compartida." },
  { icon: Truck, title: "Logística", detail: "Dos distribuidoras, un camión refrigerado." },
  { icon: Wallet, title: "Presupuestos", detail: "Dos áreas, lo que queda del trimestre." },
];

export const CASES = {
  hospitales: {
    scenario: "hospitales",
    kicker: "Caso de uso · Salud",
    title: ["Una cama UCI.", "Dos hospitales."],
    lede: "Ninguno puede mostrarle sus datos al otro.",
    icon: BedDouble,
    steps: [
      { title: "Cada hospital presenta su caso", detail: "Sin mostrar costos ni camas." },
      { title: "La regla ordena a la vista", detail: "Solo lo clínico. El costo no entra." },
      { title: "El Comité decide con razón", detail: "Acepta o rechaza. Queda el acta." },
    ],
    arbiterLabel: "Comité",
    more: MORE,
  },
} satisfies Record<string, CaseStudy>;
