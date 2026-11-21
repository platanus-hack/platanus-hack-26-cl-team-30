// El acta de una ronda como línea de tiempo: quién entró, quién presentó, qué
// propuso la regla y qué decidió el Comité, con su razón. La arma el motor en el
// servidor (data.ts), jugando una ronda de la sala de demo con las mismas
// funciones que una persona. Adaptado de Activity Feed de 21st.dev (29394).

import { CheckCircle2, LogIn, Scale, Send } from "lucide-react";
import type { ActaEntry } from "./data";

const ICONS = { join: LogIn, submit: Send, propose: Scale, seal: CheckCircle2 } as const;

export function ActaFeed({ entries }: { entries: ActaEntry[] }) {
  return (
    <ol className="relative">
      {entries.map((entry, index) => {
        const Icon = ICONS[entry.kind];
        return (
          <li key={`${entry.kind}-${index}`} className="grid grid-cols-[auto_1fr] gap-x-5">
            <span className="relative flex flex-col items-center">
              <span className={`grid size-11 place-items-center rounded-full border ${entry.kind === "seal" ? "border-calm bg-calm-soft text-calm" : "border-border bg-card text-brand"}`}>
                <Icon className="size-5" aria-hidden />
              </span>
              {index < entries.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
            </span>
            <div className="pb-8">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-xl font-bold tracking-tight">{entry.title}</span>
                <span className="cs-body text-muted-foreground">{entry.step}</span>
              </p>
              {entry.detail && <p className="cs-body mt-1 text-muted-foreground">{entry.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
