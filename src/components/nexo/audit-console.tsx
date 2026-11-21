import type { AuditEvent, ProjectedRoomState } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { AUDIT_LABEL, auditDetail, formatTime, orgLabel, roleLabel } from "@/components/organs/format";

const DENIED: AuditEvent["type"][] = ["RBAC_DENIED", "AUTH_FAILED", "GATE_BLOCKED", "HITL_VETOED"];
const SETTLED: AuditEvent["type"][] = ["RULE_SEALED", "HITL_APPROVED", "ALLOCATION_SEALED", "STAKES_CONTAINED"];

/** Código técnico que acompaña a cada tipo de evento en la consola del jurado. */
const STATUS_CODE: Partial<Record<AuditEvent["type"], string>> = { RBAC_DENIED: "403", AUTH_FAILED: "401" };

type Props = {
  room: ProjectedRoomState;
  acta?: { md: string; json: string };
};

/**
 * Consola de auditoría para el jurado. Muestra cada evento de la bitácora con su
 * código técnico (403 RBAC_DENIED, etc.). La bitácora la escribe el servidor y
 * nunca trae valores ocultos. No aparece en las pantallas de los usuarios.
 */
export function AuditConsole({ room, acta }: Props) {
  const events = [...room.auditLog].reverse();
  return (
    <div className="space-y-4">
      <p className="small text-muted-foreground">
        {room.auditLog.length} eventos, con el reloj del servidor. Lo más reciente arriba. Es la misma bitácora que va en el acta.
      </p>
      {events.length === 0 ? (
        <p className="small text-muted-foreground">Todavía no pasa nada en esta sala.</p>
      ) : (
        <ol className="space-y-2.5">
          {events.map((event, index) => {
            const denied = DENIED.includes(event.type);
            const settled = SETTLED.includes(event.type);
            const role = roleLabel(room, event.orgId, event.roleId);
            const org = room.orgs.length > 1 ? orgLabel(room, event.orgId) : "";
            const who = [role, org !== role ? org : ""].filter(Boolean).join(", ");
            const detail = auditDetail(event.detail, event.type);
            const code = STATUS_CODE[event.type];
            return (
              <li key={`${event.ts}-${index}`} className="grid grid-cols-[auto_1fr] gap-x-3 border-b border-border pb-2.5 last:border-0">
                <time className="code pt-0.5 text-muted-foreground">{formatTime(event.ts)}</time>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn("code font-semibold", denied ? "text-bleed" : settled ? "text-calm" : "text-foreground")}>
                      {code ? `${code} ` : ""}
                      {event.type}
                    </span>
                    <span className="small font-medium">{AUDIT_LABEL[event.type] ?? event.type}</span>
                    {who && <span className="small text-muted-foreground">por {who}</span>}
                  </p>
                  {detail.reason && <p className="mt-0.5 font-serif text-[1.05rem] leading-snug italic">«{detail.reason}»</p>}
                  {detail.text && <p className="code mt-0.5 break-words text-muted-foreground">{detail.text}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {acta && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Acta completa:</span>
          <a className="font-semibold underline underline-offset-4" href={acta.md} download>
            Markdown
          </a>
          <a className="font-semibold underline underline-offset-4" href={acta.json} download>
            JSON
          </a>
        </p>
      )}
    </div>
  );
}
