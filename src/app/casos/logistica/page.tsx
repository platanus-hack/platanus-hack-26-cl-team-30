import type { Metadata } from "next";
import { CasePage } from "@/components/casos/case-page";
import { CASES } from "@/components/casos/content";
import { caseView } from "@/components/casos/data";

// Caso de uso: dos distribuidoras y un camión refrigerado (escenario «logistica»).
export const metadata: Metadata = {
  title: "Caso: dos distribuidoras y un camión refrigerado",
  description: "Cómo deciden dos distribuidoras quién usa el camión refrigerado sin mostrarse sus fletes.",
};

export default function LogisticaPage() {
  return <CasePage slug="logistica" view={caseView(CASES.logistica.scenario, CASES.logistica.arbiterLabel)} />;
}
