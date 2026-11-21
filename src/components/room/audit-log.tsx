import type { ProjectedRoom } from "@/lib/rooms";

// Bitácora de la sala, lo más reciente arriba. Los accesos negados van en rojo.
export function AuditLog({ audit }: { audit: ProjectedRoom["audit"] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Bitácora</h2>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {[...audit].reverse().map((event, index) => (
          <li key={index} className={event.type === "ACCESS_DENIED" ? "text-destructive" : undefined}>
            {new Date(event.at).toLocaleTimeString("es-CL")} · {event.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}
