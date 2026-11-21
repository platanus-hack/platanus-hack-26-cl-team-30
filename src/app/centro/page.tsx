import type { Metadata } from "next";

import { GlassyDashboard } from "@/components/ui/glassy-dashboard";

export const metadata: Metadata = {
  title: "Nexo · Centro de mando (vista previa)",
};

// Vista previa del panel de vidrio con la paleta de Nexo. Parte en modo oscuro;
// el botón de luna/sol de la barra superior cambia a modo claro.
export default function CentroPage() {
  return <GlassyDashboard initialTheme="dark" />;
}
