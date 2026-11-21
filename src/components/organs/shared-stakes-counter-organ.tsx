import type { StakesView } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { formatClock } from "./format";
import { PulseLine } from "./pulse-line";

type Props = {
  stakes: StakesView;
  /** "stage": franja grande para proyectar. "compact": cabecera de la estación de un rol. */
  size?: "stage" | "compact";
};

/**
 * Órgano 6. Contador compartido de lo que está en juego. Todo lo que muestra
 * viene calculado del servidor con su reloj (stakes.elapsedMs); aquí no hay
 * temporizador: el servidor emite un mensaje por segundo mientras se espera.
 */
export function SharedStakesCounterOrgan({ stakes, size = "compact" }: Props) {
  const bleeding = stakes.status === "BLEEDING";
  const stage = size === "stage";
  const sealedIn = stakes.timeToDecisionMs;

  return (
    <section
      aria-label="Lo que está en juego"
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card",
        bleeding ? "border-bleed/40" : "border-calm/40",
        stage ? "px-6 pt-5 pb-14" : "px-4 pt-3 pb-9",
      )}
    >
      <div className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-2", stage && "gap-y-4")}>
        <div className="min-w-0">
          <p className={cn("flex items-center gap-2 font-semibold", bleeding ? "text-bleed" : "text-calm", stage ? "text-xl" : "text-sm")}>
            <span
              aria-hidden
              className={cn("inline-block rounded-full", bleeding ? "heartbeat bg-bleed" : "bg-calm", stage ? "size-3.5" : "size-2.5")}
            />
            {bleeding ? "Esperando una decisión" : "Decisión tomada: la espera se detuvo"}
          </p>
          <p className={cn("mt-1 text-muted-foreground", stage ? "max-w-[60ch] text-lg" : "text-sm")}>{stakes.stakesLabel}</p>
          {stakes.deadlineLabel && (
            <p className={cn("text-muted-foreground", stage ? "text-base" : "text-xs")}>{stakes.deadlineLabel}</p>
          )}
        </div>

        <dl className={cn("flex items-end", stage ? "gap-10" : "gap-5")}>
          <Figure label={stakes.waitingCases === 1 ? "caso esperando" : "casos esperando"} value={String(stakes.waitingCases)} stage={stage} tone={bleeding ? "bleed" : "calm"} />
          <Figure label={stakes.livesAtRisk === 1 ? "vida en riesgo" : "vidas en riesgo"} value={String(stakes.livesAtRisk)} stage={stage} tone={bleeding ? "bleed" : "calm"} />
          <Figure
            label={bleeding ? "sin decidir" : "hasta decidir"}
            value={formatClock(sealedIn ?? stakes.elapsedMs)}
            stage={stage}
            tone={bleeding ? "bleed" : "calm"}
            wide
          />
        </dl>
      </div>

      {/* Pulso: late y avanza mientras alguien espera; se aquieta al decidir. */}
      <PulseLine beating={bleeding} className={cn("absolute inset-x-0 bottom-0", stage ? "h-12" : "h-8")} />
    </section>
  );
}

function Figure({ label, value, stage, tone, wide }: { label: string; value: string; stage: boolean; tone: "bleed" | "calm"; wide?: boolean }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className={cn("text-muted-foreground", stage ? "text-base" : "text-xs")}>{label}</dt>
      <dd
        className={cn(
          "leading-none font-bold tabular-nums font-stretch-condensed",
          tone === "bleed" ? "text-bleed" : "text-calm",
          stage ? "text-7xl" : "text-3xl",
          wide && (stage ? "min-w-[4.2ch]" : "min-w-[4.4ch]"),
        )}
      >
        {value}
      </dd>
    </div>
  );
}
