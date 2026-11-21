import type { AuditEvent, ProjectedRoomState } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { AUDIT_LABEL, auditDetail, formatTime, orgLabel, roleLabel } from "@/components/organs/format";
import { OrganFrame } from "@/components/organs/organ-frame";

const DENIED: AuditEvent["type"][] = ["RBAC_DENIED", "AUTH_FAILED", "GATE_BLOCKED", "HITL_VETOED"];
const SETTLED: AuditEvent["type"][] = ["RULE_SEALED", "HITL_APPROVED", "ALLOCATION_SEALED", "STAKES_CONTAINED"];

type Props = {
  room: ProjectedRoomState;
  /** Cuántos eventos mostrar, del más reciente hacia atrás. */
  limit?: number;
  acta?: { md: string; json: string };
};

/**
 * Bitácora de la sala, lo más reciente arriba. La escribe el servidor y la ven
 * todos los roles, por eso nunca trae valores ocultos. Los 403 van en rojo.
 */
export function AuditConsole({ room, limit = 40, acta }: Props) {
  const events = [...room.auditLog].reverse().slice(0, limit);
  return (
    <OrganFrame title="Bitácora" aside={`${room.auditLog.length} eventos, reloj del servidor`}>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no pasa nada en esta sala. Cada acción de una persona queda registrada aquí.</p>
      ) : (
        <ol className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {events.map((event, index) => {
            const denied = DENIED.includes(event.type);
            const settled = SETTLED.includes(event.type);
            const role = roleLabel(room, event.orgId, event.roleId);
            const org = room.orgs.length > 1 ? orgLabel(room, event.orgId) : "";
            const who = [role, org !== role ? org : ""].filter(Boolean).join(", ");
            const detail = auditDetail(event.detail);
            return (
              <li key={`${event.ts}-${index}`} className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                <time className="pt-0.5 text-xs text-muted-foreground tabular-nums">{formatTime(event.ts)}</time>
                <div className="min-w-0">
                  <p className={cn("font-semibold", denied && "text-bleed", settled && "text-calm")}>
                    {AUDIT_LABEL[event.type] ?? event.type}
                    {who && <span className="font-normal text-muted-foreground"> por {who}</span>}
                  </p>
                  {detail.reason && <p className="font-serif text-[0.95rem] leading-snug italic">«{detail.reason}»</p>}
                  {detail.text && <p className="text-xs break-words text-muted-foreground">{detail.text}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {acta && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Acta con la bitácora completa:</span>
          <a className="font-semibold underline underline-offset-4" href={acta.md} download>
            Descargar en Markdown
          </a>
          <a className="font-semibold underline underline-offset-4" href={acta.json} download>
            Descargar en JSON
          </a>
        </p>
      )}
    </OrganFrame>
  );
}
