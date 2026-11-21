"use client";

import { BarChart3, FileText, LayoutGrid, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageTab = "mando" | "ranking" | "organizaciones" | "acta";

const ITEMS: { id: StageTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "mando", label: "Centro de mando", icon: LayoutGrid },
  { id: "ranking", label: "Ranking", icon: BarChart3 },
  { id: "organizaciones", label: "Organizaciones", icon: Users },
  { id: "acta", label: "Acta", icon: FileText },
];

/** Navegación inferior flotante de la pantalla grande. En una sola organización, «Ranking» se llama «Caso». */
export function BottomNav({ tab, onChange, single }: { tab: StageTab; onChange: (tab: StageTab) => void; single: boolean }) {
  return (
    <nav aria-label="Secciones de la pantalla grande" className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-3">
      <ul className="flex gap-1 rounded-full bg-white/85 p-1.5 shadow-lift ring-1 ring-black/5 backdrop-blur-xl">
        {ITEMS.map((item) => {
          const active = item.id === tab;
          const label = single && item.id === "ranking" ? "Caso" : single && item.id === "organizaciones" ? "Organización" : item.label;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex min-h-12 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors sm:px-5 sm:text-base",
                  active ? "bg-brand text-white shadow-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-5 shrink-0" aria-hidden />
                <span className={cn(!active && "max-sm:sr-only")}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
