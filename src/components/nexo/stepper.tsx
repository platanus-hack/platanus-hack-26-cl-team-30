import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepInfo } from "./guide";

/** Los pasos de la sala. Es una secuencia real, por eso va numerada. */
export function Stepper({
  step,
  size = "default",
}: {
  step: StepInfo;
  size?: "default" | "stage";
}) {
  const stage = size === "stage";
  return (
    <div>
      <ol
        className="flex w-full items-center gap-1.5 sm:gap-2"
        aria-label={`Paso ${step.index + 1} de ${step.total}`}
      >
        {step.labels.map((label, i) => {
          const done = i < step.index || (step.done && i === step.index);
          const current = i === step.index && !step.done;
          return (
            <li
              key={label}
              className="flex min-w-0 flex-1 flex-col gap-1.5"
              aria-current={current ? "step" : undefined}
            >
              <span
                className={cn(
                  "h-1.5 rounded-full",
                  done ? "bg-calm" : current ? "bg-brand" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 truncate font-medium",
                  stage ? "text-sm" : "text-xs",
                  done
                    ? "text-calm"
                    : current
                      ? "text-brand-ink"
                      : "text-muted-foreground",
                  !stage && "max-sm:sr-only",
                )}
              >
                {done && <Check className="size-3.5 shrink-0" aria-hidden />}
                {current && <span className="sr-only">Ahora: </span>}
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      {/* En el teléfono no caben las cinco etiquetas: se lee el paso actual completo. */}
      {!stage && (
        <p
          className={cn(
            "mt-1.5 text-sm font-semibold sm:hidden",
            step.done ? "text-calm" : "text-brand-ink",
          )}
          aria-hidden
        >
          {step.done
            ? "Listo"
            : `Paso ${step.index + 1} de ${step.total}: ${step.labels[step.index]}`}
        </p>
      )}
    </div>
  );
}
