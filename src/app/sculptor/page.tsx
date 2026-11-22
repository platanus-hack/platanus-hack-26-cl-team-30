import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import type { CSSProperties } from "react";
import { Atmosphere } from "@/components/sculptor/atmosphere";
import { Footer, Nav } from "@/components/sculptor/chrome";
import { sculptorData } from "@/components/sculptor/data";
import { Example } from "@/components/sculptor/example";
import { Hack } from "@/components/sculptor/hack";
import { Hero } from "@/components/sculptor/hero";
import { SculptorShell } from "@/components/sculptor/intro-state";
import { Market } from "@/components/sculptor/market";
import { Measured } from "@/components/sculptor/measured";
import { Orbital } from "@/components/sculptor/orbital";
import { Origin } from "@/components/sculptor/origin";
import { Principles } from "@/components/sculptor/principles";
import { Reliability } from "@/components/sculptor/reliability";
import { Team } from "@/components/sculptor/team";
import "./sculptor.css";

// Landing de Sculptor, el protocolo. Vive aparte de la portada de la demo mientras
// se termina; la paleta es la del manual de marca (docs/diseno/sculptor/README.md).
// Tipografía: Archivo (títulos anchos y texto), Instrument Serif itálica para la voz
// humana y JetBrains Mono para etiquetas, las mismas de la simulación orbital del
// pitch. Manrope queda solo en la palabra "sculptor", que es el logo.

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

const title = "Sculptor: un agente solo es ruido, deliberar juntos es poder";
const description =
  "Esqueleto organizacional multijugador: personas y agentes emparejados por rol deciden en tiempo real sobre recursos críticos. Cada rol ve solo lo suyo y nada se sella sin una persona. Equipo 30, Platanus Hack 26.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: { title, description, type: "website", locale: "es_CL", images: ["/sculptor/logo.png"] },
  icons: { icon: "/sculptor/logo.png" },
};

const PALETTE = {
  "--obsidiana": "#0C0E0D",
  "--grafito": "#181B1A",
  "--basalto": "#2A2F2D",
  "--piedra": "#A3A69D",
  "--marmol": "#F3F0E8",
  "--eucalipto": "#6FAF9B",
  "--patina": "#2E5E51",
  "--cincel": "#D7FF3D",
  "--senal": "#F0524A",
  fontFamily: "var(--font-archivo), var(--font-sans), sans-serif",
} as CSSProperties;

export default function SculptorPage() {
  const data = sculptorData();
  return (
    <div
      id="top"
      style={PALETTE}
      className={`${archivo.variable} min-h-svh bg-(--obsidiana) text-(--marmol) antialiased selection:bg-(--cincel) selection:text-(--obsidiana)`}
    >
      <SculptorShell>
        <Atmosphere />
        <Nav />
        <main className="relative z-10">
          <Hero />
          <Origin />
          <Principles />
          <Reliability single={data.single} cross={data.cross} />
          <Example example={data.example} />
          <Market />
          <Orbital />
          <Measured />
          <Hack />
          <Team />
        </main>
        <div className="relative z-10">
          <Footer />
        </div>
      </SculptorShell>
    </div>
  );
}
