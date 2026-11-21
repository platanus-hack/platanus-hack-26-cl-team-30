import type { ReactNode } from "react";
import { ChevronDown, CircleCheck, Hourglass, Lock, Send } from "lucide-react";

/** Explicación plegada. Regla de la silla: ninguna explicación va a la vista sin que la pidan. */
export function Why({ label = "¿Por qué?", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="st-why">
      <summary>
        {label}
        <ChevronDown aria-hidden />
      </summary>
      {children}
    </details>
  );
}

/** Estado de la tarjeta, siempre con icono y palabra: el color nunca va solo. */
export function Status({ tone }: { tone: "turn" | "wait" | "done" }) {
  if (tone === "wait") {
    return (
      <span className="st-status" data-tone="wait">
        <Hourglass aria-hidden /> Esperando
      </span>
    );
  }
  if (tone === "done") {
    return (
      <span className="st-status" data-tone="done">
        <CircleCheck aria-hidden /> Resuelto
      </span>
    );
  }
  return (
    <span className="st-status" data-tone="accent">
      <Send aria-hidden /> Tu turno
    </span>
  );
}

/** Una cifra grande con su etiqueta corta. */
export function Stat({ value, label, tone, mine }: { value: ReactNode; label: string; tone?: "wait" | "done"; mine?: boolean }) {
  return (
    <div className="st-stat" data-tone={tone} data-mine={mine || undefined}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** Barra de franjas diagonales: un dato que el servidor no envió a este teléfono. */
export function Hatch({ label }: { label: string }) {
  return (
    <span className="st-cand-cost">
      <Lock aria-hidden />
      <span className="st-hatch" aria-hidden />
      <span className="st-sr">{label}</span>
    </span>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="st-alert">
      {children}
    </p>
  );
}
