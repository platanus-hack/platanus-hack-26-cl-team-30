import type { Metadata } from "next";
import { CasePage } from "@/components/casos/case-page";
import { CASES } from "@/components/casos/content";
import { caseView } from "@/components/casos/data";

// Caso de uso: dos hospitales y una cama UCI. Las otras páginas de /casos son iguales
// con otro caso de CASES (src/components/casos/content.ts).
export const metadata: Metadata = {
  title: "Caso: dos hospitales y una cama UCI",
  description: "Cómo deciden dos hospitales quién recibe la última cama UCI sin mostrarse sus datos.",
};

export default function HospitalesPage() {
  return <CasePage slug="hospitales" view={caseView(CASES.hospitales.scenario, CASES.hospitales.arbiterLabel)} />;
}
