import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Deck } from "@/components/presentacion/deck";
import { Atmosphere } from "@/components/sculptor/atmosphere";
import { sculptorData } from "@/components/sculptor/data";
import { SCULPTOR_PALETTE } from "@/components/sculptor/theme";
import "../sculptor.css";

// Presentación de 3:00 para el domingo 22. Guion y tiempos en
// src/components/presentacion/slides.ts, tomados de docs/DEMO_DIA.md. La cifra pⁿ
// de la lámina del problema la calcula el motor (data.ts), no está escrita a mano.

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: "Presentación",
  robots: { index: false },
};

export default function PresentacionPage() {
  const { single } = sculptorData();
  return (
    <div style={SCULPTOR_PALETTE} className={`${archivo.variable} h-svh overflow-hidden bg-(--obsidiana) text-(--marmol) antialiased`}>
      <Atmosphere />
      <Deck autonomous={single.autonomous} steps={single.n} accuracy={single.p} />
    </div>
  );
}
