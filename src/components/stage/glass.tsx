import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel de vidrio esmerilado en versión clara: blanco translúcido con desenfoque,
 * borde fino y sombra teñida. Se proyecta bien porque el texto queda sobre casi blanco.
 */
export function Glass({ children, className, as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "header" | "nav" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn("rounded-[1.75rem] bg-white/75 shadow-[0_1px_2px_rgb(28_40_38/0.06),0_18px_40px_-24px_rgb(28_40_38/0.35)] ring-1 ring-[rgb(28_40_38/0.07)] backdrop-blur-xl", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Fondo del centro de mando: el tono cálido con dos halos suaves de la paleta. Sin imágenes. */
export function CommandBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-background">
      <div className="absolute -top-40 -left-40 size-[42rem] rounded-full bg-[radial-gradient(closest-side,rgb(15_118_110/0.16),transparent)]" />
      <div className="absolute top-1/3 -right-48 size-[46rem] rounded-full bg-[radial-gradient(closest-side,rgb(180_83_9/0.10),transparent)]" />
      <div className="absolute -bottom-48 left-1/3 size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(21_128_61/0.08),transparent)]" />
    </div>
  );
}
