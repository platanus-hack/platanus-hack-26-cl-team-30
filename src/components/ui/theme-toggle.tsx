"use client";

// Botón de modo claro/oscuro, el mismo en todas las pantallas. Cambia el tema de
// toda la app (src/components/ui/theme.ts) y lo recuerda entre páginas. Muestra el
// ícono del modo al que se pasa: luna en claro, sol en oscuro.

import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "./theme";

export type ThemeToggleProps = {
  /** Lado del ícono en px. Por defecto 18. */
  size?: number;
  /** Clases del botón. Sin ellas lleva un estilo base redondo con los tokens globales. */
  className?: string;
};

const BASE =
  "inline-grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ThemeToggle({ size = 18, className }: ThemeToggleProps) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button type="button" className={className ?? BASE} aria-label={label} title={label} onClick={() => setTheme(next)}>
      {/* suppressHydrationWarning: en el servidor no se sabe el tema; el ícono se corrige al montar. */}
      <span suppressHydrationWarning aria-hidden="true" className="grid place-items-center">
        {theme === "dark" ? <Sun width={size} height={size} /> : <Moon width={size} height={size} />}
      </span>
    </button>
  );
}
