"use client";

// Enlace que se adelanta (prefetch) recién cuando la persona muestra intención:
// al pasar el cursor, al tocarlo o al enfocarlo con el teclado. Un <Link> normal
// se adelanta apenas aparece en pantalla, y eso trae el código y las tipografías
// de la página de destino mientras la actual todavía carga. Se usa en los enlaces
// a páginas pesadas (la landing y la pantalla grande) desde otras páginas.
// Patrón de la documentación de Next 16 («Linking and Navigating», prefetch on hover).

import Link from "next/link";
import { useState, type ComponentProps } from "react";

export function HoverPrefetchLink({ onMouseEnter, onTouchStart, onFocus, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(event) => {
        setActive(true);
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        setActive(true);
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        setActive(true);
        onFocus?.(event);
      }}
    />
  );
}
