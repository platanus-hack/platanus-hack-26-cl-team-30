import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
// Una sans para toda la app: Manrope, la misma de la pantalla grande y del teléfono.
import "@fontsource-variable/manrope";
import "./globals.css";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdf8" },
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${instrument.variable} ${jetbrains.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
