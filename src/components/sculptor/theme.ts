import type { CSSProperties } from "react";

// Paleta del manual de marca de Sculptor (docs/diseno/sculptor/README.md) como
// variables CSS. La usan la landing /sculptor y la presentación /presentacion.
export const SCULPTOR_PALETTE = {
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
