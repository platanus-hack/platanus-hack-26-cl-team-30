import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Una sans para todo lo que se lee y se toca.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

// La segunda voz: serif itálica para la parte humana de un título y para la razón de un veto.
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

// Solo para códigos técnicos en la consola de auditoría.
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const title = "Nexo: decidir juntos sin mostrar los datos";
const description =
  "Un lugar donde organizaciones que no pueden compartir su información deciden juntas a quién le toca lo que escasea: cada una ve solo lo suyo, una regla conocida ordena los casos y quien firma deja su razón.";

export const metadata: Metadata = {
  title: { default: title, template: "%s · Nexo" },
  description,
  openGraph: { title, description, type: "website", locale: "es_CL" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf7",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${geist.variable} ${instrument.variable} ${jetbrains.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
