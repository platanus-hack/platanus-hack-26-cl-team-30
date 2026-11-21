import type { Metadata } from "next";

import { DitherBackground } from "@/components/brand/dither-background";
import { SculptorGlassReveal } from "@/components/brand/glass-logo-reveal";
import { LogoParticles } from "@/components/brand/logo-particles";
import { MultiplayerCursors } from "@/components/brand/multiplayer-cursors";
import { SculptorLogo } from "@/components/brand/sculptor-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Sculptor · Marca",
};

// Vista previa de las piezas de marca para la landing general de Sculptor (de
// Ramón): el revelado en vidrio líquido, el logo en píxeles en sus tamaños, y tres
// componentes de 21st.dev adaptados a la paleta y al logo (src/components/brand/):
// fondo con tramado, logo en partículas y cursores multijugador. Para copiarlos.
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

      {/* Fondo con tramado y logo en partículas: pasa el mouse sobre la galaxia. */}
      <section aria-labelledby="dither-titulo" className="px-4 py-16 sm:px-10">
        <h2 id="dither-titulo" className="text-3xl font-extrabold tracking-tight">Fondo con tramado y logo en partículas</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          <code>DitherBackground</code> y <code>LogoParticles</code>, en <code>src/components/brand/</code>. Pasa el mouse sobre la galaxia.
        </p>
        <div className="relative mt-8 grid min-h-[420px] place-items-center overflow-hidden rounded-[2rem]">
          <div className="absolute inset-0">
            <DitherBackground />
          </div>
          <div className="relative rounded-[1.5rem] bg-[#0f2a22]/70 p-4 backdrop-blur-sm">
            <LogoParticles size={240} />
          </div>
        </div>
      </section>

      {/* Cursores multijugador: tres personas en la misma sala y tu lente de rayos X. */}
      <section aria-labelledby="cursores-titulo" className="px-4 pb-20 sm:px-10">
        <h2 id="cursores-titulo" className="text-3xl font-extrabold tracking-tight">Cursores multijugador</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          <code>MultiplayerCursors</code>. Mueve el mouse: la lente muestra lo que solo ve tu rol.
        </p>
        <MultiplayerCursors
          className="mt-8 min-h-[380px] rounded-[2rem] border border-border bg-card"
          reveal={
            <div className="absolute inset-0 grid place-items-center bg-[#0f2a22] text-[#d7fe3e]">
              <p className="text-4xl font-extrabold tracking-tight">Costo: solo tu organización lo ve</p>
            </div>
          }
        >
          <div className="grid min-h-[380px] place-items-center p-8 text-center">
            <p className="max-w-[18ch] text-4xl font-extrabold tracking-tight">Tres personas, una misma sala.</p>
          </div>
        </MultiplayerCursors>
        <p className="mt-10 max-w-[60ch] text-lg text-muted-foreground">
          La galaxia de partículas en 3D (Particle Galaxy, 21st 18257) no está: necesita three.js, que suma más de 600 KB minificado, sobre el límite de 200 KB. Queda anotada en docs/PENDIENTES.md.
        </p>
      </section>
    </main>
  );
}
