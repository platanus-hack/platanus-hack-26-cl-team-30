"use client";

// Tema claro u oscuro de toda la app (portada, casos, pantalla grande, celular,
// /marca y /centro). Una sola fuente: el atributo data-theme de <html>, que
// globals.css, la pantalla grande y el celular ya leen.
//
// - Por defecto sigue la preferencia del sistema.
// - Si la persona elige, se recuerda en localStorage («sculptor:theme») y vale
//   para todas las páginas. Sin almacenamiento, la elección dura hasta recargar.
// - THEME_SCRIPT (theme-script.ts, sin React) corre en el <head> antes de pintar
//   (src/app/layout.tsx): así no hay un destello blanco al cargar en oscuro.

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export type Theme = "light" | "dark";
export { THEME_KEY };
const EVENT = "sculptor:theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** Tema en uso: el elegido, o el del sistema. */
export function getTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  return current === "light" || current === "dark" ? current : (storedTheme() ?? systemTheme());
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.dispatchEvent(new Event(EVENT));
}

/** Elige un tema, lo recuerda y avisa a todo lo que lo escucha en la página. */
export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Sin almacenamiento: el cambio dura hasta recargar.
  }
  apply(theme);
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  // Si la persona no eligió, el tema sigue al sistema también cuando este cambia.
  const onSystem = () => {
    if (!storedTheme()) apply(systemTheme());
  };
  // Otra pestaña cambió el tema: se aplica aquí también.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) apply(storedTheme() ?? systemTheme());
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onSystem);
  };
}

/** Tema en uso, reactivo. En el servidor (y en el primer render) devuelve `fallback`. */
export function useTheme(fallback: Theme = "light"): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => fallback);
}
