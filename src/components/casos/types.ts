// Contrato de una página de caso de uso (/casos/<rubro>). El texto va en
// content.ts; las cifras y lo que ve cada rol los calcula el motor en data.ts.
// Para agregar un rubro basta otro objeto CaseStudy y otra página de tres líneas.

import type { CrossOrgScenarioId } from "@/lib/genome/scenarios";
import type { LucideIcon } from "lucide-react";

export type CaseStudy = {
  /** Escenario del motor con sus semillas (src/lib/genome/scenarios.ts). */
  scenario: CrossOrgScenarioId;
  /** Ruta de la página: /casos/<slug>. */
  slug: string;
  /** Nombre del rubro en la fila de enlaces entre casos: «Salud». */
  nav: string;
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
  /** Aviso del pie: uno solo, pequeño. */
  disclaimer: string;
};

export type CaseStep = { title: string; detail: string };

/**
 * Otro uso del mismo esqueleto, para «¿Dónde más pasa esto?». `detail` es la pregunta que se hace
 * la gente; `status` dice cuán listo está (como en la landing); con href si tiene su página.
 */
export type CaseUse = { title: string; detail: string; status: "Ver el caso" | "Genoma listo" | "Desde una frase"; href?: string };
