import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  /** Texto corto a la derecha del título: estado o a quién pertenece. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

// Marco común de los órganos: superficie plana con borde, sin sombra.
export function OrganFrame({ title, aside, children, className }: Props) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold font-stretch-[108%]">{title}</h2>
        {aside && <div className="text-xs text-muted-foreground">{aside}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
