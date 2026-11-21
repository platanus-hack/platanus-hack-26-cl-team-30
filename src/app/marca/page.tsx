import type { Metadata } from "next";

import { SculptorGlassReveal } from "@/components/brand/glass-logo-reveal";
import { SculptorLogo } from "@/components/brand/sculptor-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Sculptor · Marca",
};

// Vista previa de las dos animaciones del logo, para la landing general de Sculptor:
// arriba, el revelado en vidrio líquido (clic para repetir); abajo, el cubo que se
// arma solo con SVG y CSS (pasa el mouse para repetir) y los tamaños pequeños.
export default function MarcaPage() {
  return (
    // El fondo sigue el tema de toda la app (bg-background); el revelado de vidrio trae su propio fondo.
    <main className="relative min-h-svh bg-background text-foreground">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <SculptorGlassReveal style={{ height: "70svh", minHeight: 420, width: "100%" }} />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: 48,
          padding: "48px 24px 64px",
        }}
      >
        <SculptorLogo size={140} wordmark animate />
        <SculptorLogo size={64} />
        <SculptorLogo size={32} />
        <SculptorLogo size={20} />
      </div>
    </main>
  );
}
