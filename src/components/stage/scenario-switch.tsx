import Link from "next/link";
import { CROSS_ORG_SCENARIOS, CROSS_ORG_SCENARIO_IDS } from "@/lib/genome/scenarios";
import { cn } from "@/lib/utils";

const SHORT: Record<string, string> = { hospitales: "Hospitales", construccion: "Construcción", logistica: "Logística" };

/** Selector segmentado de escenario: cada opción abre la sala demo de ese rubro. */
export function ScenarioSwitch({ current }: { current?: string }) {
  return (
    <nav aria-label="Escenario" className="flex rounded-full bg-white/80 p-1 shadow-soft ring-1 ring-black/5">
      {CROSS_ORG_SCENARIO_IDS.map((id) => {
        const active = id === current;
        return (
          <Link
            key={id}
            href={`/stage/${CROSS_ORG_SCENARIOS[id].fixedRoomId}`}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors sm:px-5 sm:text-base", active ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground")}
          >
            {SHORT[id] ?? CROSS_ORG_SCENARIOS[id].title}
          </Link>
        );
      })}
    </nav>
  );
}
