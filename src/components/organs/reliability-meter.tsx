import type { ReliabilityView } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { formatPct } from "./format";

type Props = {
  reliability: ReliabilityView;
  /** Qué cadena se mide: "de la clínica", "entre las dos organizaciones". */
  scope?: string;
  size?: "stage" | "default";
};

/**
 * Medidor p^n. Compara la misma cadena de n pasos hecha solo por agentes
 * (p multiplicado n veces) contra la cadena con compuerta y firma humana.
 * Los dos números y la fórmula vienen del motor del servidor.
 */
export function ReliabilityMeter({ reliability, scope, size = "default" }: Props) {
  const stage = size === "stage";
  const rows = [
    { mode: "autonomous" as const, label: "Si los agentes deciden solos", value: reliability.autonomous, bar: "bg-bleed", text: "text-bleed" },
    { mode: "hybrid" as const, label: "Con compuerta y firma de una persona", value: reliability.hybrid, bar: "bg-calm", text: "text-calm" },
  ];
  return (
    <div className="space-y-3">
      <p className={cn(stage ? "text-lg" : "text-sm")}>
        Probabilidad de que los {reliability.n} pasos {scope ? `${scope} ` : ""}terminen bien
      </p>
      {rows.map((row) => {
        const active = reliability.currentMode === row.mode;
        return (
          <div key={row.mode} className={cn("grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-1", !active && "opacity-55")}>
            <p className={cn(stage ? "text-base" : "text-xs", active ? "font-semibold" : "text-muted-foreground")}>
              {row.label}
              {active && <span className="ml-2 rounded-sm bg-foreground px-1.5 py-0.5 text-[0.7em] font-semibold text-background">ahora</span>}
            </p>
            <p className={cn("row-span-2 leading-none font-bold tabular-nums font-stretch-condensed", row.text, stage ? "text-6xl" : "text-4xl")}>{formatPct(row.value)}</p>
            <div className={cn("rounded-sm bg-muted", stage ? "h-3" : "h-2")}>
              <div className={cn("h-full rounded-sm transition-[width] duration-500", row.bar)} style={{ width: `${row.value * 100}%` }} />
            </div>
          </div>
        );
      })}
      <p className={cn("text-muted-foreground tabular-nums", stage ? "text-sm" : "text-xs")}>{reliability.formula}</p>
    </div>
  );
}
