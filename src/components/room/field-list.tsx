import { Button } from "@/components/ui/button";
import type { ProjectedRoom } from "@/lib/rooms";

type Props = {
  fields: ProjectedRoom["fields"];
  canRead: boolean;
  onTryRead: (key: string) => void;
  message: string | null;
};

// Campos de la sala tal como llegan para este rol. Los ocultos llegan sin valor
// desde el servidor; "Intentar leer" demuestra que el servidor niega el acceso.
export function FieldList({ fields, canRead, onTryRead, message }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Lo que ve este rol</h2>
      <ul className="divide-y rounded-lg border">
        {fields.map((field) => (
          <li key={field.key} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span>{field.label}</span>
            {field.redacted ? (
              <span className="flex items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">oculto para este rol</span>
                {canRead && (
                  <Button size="sm" variant="ghost" onClick={() => onTryRead(field.key)}>
                    Intentar leer
                  </Button>
                )}
              </span>
            ) : (
              <span className="font-mono">{String(field.value)}</span>
            )}
          </li>
        ))}
      </ul>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}
