import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "@/components/landing/mark";
import { Disclaimer } from "./disclaimer";

/** Barra superior de la sala: marca, de qué sala se trata y lo que cada pantalla quiera mostrar a la derecha. */
export function RoomHeader({ subtitle, children }: { subtitle: ReactNode; children?: ReactNode }) {
  return (
    <>
      <Disclaimer />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Ir a la portada de Sculptor">
            <Mark size={28} />
            <span className="text-lg font-semibold tracking-tight">Sculptor</span>
          </Link>
          <span className="min-w-0 truncate text-sm text-muted-foreground">{subtitle}</span>
          <div className="ml-auto flex items-center gap-2">{children}</div>
        </div>
      </header>
    </>
  );
}

/** Espacio de la barra cuando todavía no hay rol. */
export function RoleHeaderPlaceholder() {
  return <span className="text-sm text-muted-foreground max-sm:hidden">Sin rol todavía</span>;
}
