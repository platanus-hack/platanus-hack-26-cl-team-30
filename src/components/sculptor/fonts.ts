import { Instrument_Serif, JetBrains_Mono } from "next/font/google";

// Instrument Serif y JetBrains Mono, precargadas. El layout raíz las declara sin
// precarga porque en casi todas las páginas son detalles chicos; en la landing y en
// /presentacion, en cambio, están en lo primero que se ve (la etiqueta del héroe, la
// píldora «Equipo 30», el titular en itálica). Sin precarga llegaban tarde y el texto
// se corría al cambiar de letra (CLS 0,05 medido con Lighthouse en móvil).
// Mismas opciones que en src/app/layout.tsx: los mismos archivos, ahora precargados.
// Se aplican con `.variable` en el contenedor de cada página.

export const instrumentPreload = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const jetbrainsPreload = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});
