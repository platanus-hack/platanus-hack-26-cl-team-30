import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { THEME_SCRIPT } from "@/components/ui/theme-script";

// Tipografías (docs/DECISIONES.md, «Rendimiento de carga»):
// - Manrope es la letra de casi todo, así que es la única que se precarga en todas
//   las rutas. Solo el subconjunto latino (cubre el español entero: tildes, ñ, ¿ y ¡),
//   variable de 200 a 800, servido desde el paquete @fontsource-variable/manrope.
// - Instrument Serif y JetBrains Mono aparecen en detalles chicos (una razón entre
//   comillas, una etiqueta), nunca en lo primero que se lee: no se precargan, y el
//   navegador las baja solo en la página que de verdad las usa.
// - Archivo es solo de la landing y de /presentacion: se declara en esas páginas.

// Una sans para toda la app: Manrope, la misma de la pantalla grande y del teléfono.
const manrope = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

// La segunda voz: serif itálica para la parte humana de un título y para la razón de un veto.
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

// Solo para códigos técnicos en la consola de auditoría.
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const title = "Sculptor: decidir juntos sin mostrar los datos";
const description =
  "Un lugar donde organizaciones que no pueden compartir su información deciden juntas a quién le toca lo que escasea: cada una ve solo lo suyo, una regla conocida ordena los casos y quien firma deja su razón.";

// Base de las URL absolutas de metadata (imagen al compartir en redes): sin esto,
// Next las arma con localhost y WhatsApp o LinkedIn no encuentran la imagen.
const siteUrl = process.env.NEXO_PUBLIC_BASE_URL ?? "https://team-30-platanus-hack.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · Sculptor" },
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
    // suppressHydrationWarning: THEME_SCRIPT pone data-theme en <html> antes de que React hidrate.
    <html lang="es-CL" className={`${manrope.variable} ${instrument.variable} ${jetbrains.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Tema antes del primer pintado: sin destello blanco en modo oscuro (src/components/ui/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
