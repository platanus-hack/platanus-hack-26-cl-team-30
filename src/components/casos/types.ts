// Contrato de una página de caso de uso (/casos/<rubro>). El texto va en
// content.ts; las cifras y lo que ve cada rol los calcula el motor en data.ts.
// Para agregar /casos/construccion basta otro objeto CaseStudy y otra página.

import type { CrossOrgScenarioId } from "@/lib/genome/scenarios";
import type { LucideIcon } from "lucide-react";

export type CaseStudy = {
  /** Escenario del motor con sus semillas (src/lib/genome/scenarios.ts). */
  scenario: CrossOrgScenarioId;
  /** Etiqueta corta sobre el título: «Caso de uso · Salud». */
  kicker: string;
  /** Título de máximo 6 palabras, en dos partes: la segunda va en serif. */
  title: [string, string];
  /** Una frase de apoyo de máximo 12 palabras. */
  lede: string;
  icon: LucideIcon;
  /** Los tres pasos: cada uno, título corto y una frase. */
  steps: [CaseStep, CaseStep, CaseStep];
  /** Nombre del rol que decide, como se ve en la tabla de «qué ve cada uno». */
  arbiterLabel: string;
  /** Otros usos del mismo esqueleto. */
  more: { icon: LucideIcon; title: string; detail: string }[];
};

export type CaseStep = { title: string; detail: string };
