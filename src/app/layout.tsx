import type { Metadata, Viewport } from "next";
import { Archivo, Newsreader } from "next/font/google";
import { Disclaimer } from "@/components/nexo/disclaimer";
import "./globals.css";

// Una sola familia para todo lo que calcula el sistema; el eje de ancho (wdth)
// permite cifras angostas en el tablero y titulares anchos sin cargar otra fuente.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Serif solo para lo que escribe una persona y queda en acta: la razón de un veto.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Nexo",
  description: "Coordinación de decisiones críticas entre personas y agentes, por rol y entre organizaciones.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef2f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Disclaimer />
        {children}
      </body>
    </html>
  );
}
