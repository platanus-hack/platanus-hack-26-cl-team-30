import type { ReactNode } from "react";

/**
 * Explicación que no va a la vista: queda plegada detrás de una pregunta corta.
 * La portada se lee en frases y números; quien quiere el detalle lo despliega.
 */
export function Why({ children, label = "¿Por qué?", className = "" }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <details className={`group ${className}`}>
      <summary className="small inline-flex min-h-11 cursor-pointer list-none items-center rounded-full px-4 font-semibold shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="small mt-3 max-w-[34rem] space-y-2 text-muted-foreground">{children}</div>
    </details>
  );
}
