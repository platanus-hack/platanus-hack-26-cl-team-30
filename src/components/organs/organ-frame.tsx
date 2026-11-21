import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  /** Texto corto a la derecha del título: estado o a quién pertenece. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

// Marco común de los órganos: panel blanco sobre el fondo cálido.
export function OrganFrame({ title, aside, children, className }: Props) {
  return (
    <section className={cn("panel", className)} aria-label={title}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-5 pt-5 pb-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}
