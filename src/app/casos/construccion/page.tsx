import type { Metadata } from "next";
import { CasePage } from "@/components/casos/case-page";
import { CASES } from "@/components/casos/content";
import { caseView } from "@/components/casos/data";

// Caso de uso: dos constructoras y una grúa torre compartida el jueves (escenario «construccion»).
export const metadata: Metadata = {
  title: "Caso: dos obras y una grúa torre",
  description: "Cómo deciden dos constructoras quién usa la grúa el jueves sin mostrarse sus costos.",
};

export default function ConstruccionPage() {
  return <CasePage slug="construccion" view={caseView(CASES.construccion.scenario, CASES.construccion.arbiterLabel)} />;
}
