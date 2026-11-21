"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, CircleCheck, Lock, PenLine, QrCode, Send, UserPlus, type LucideIcon } from "lucide-react";
import type { AuditEvent, ProjectedRoomState } from "@/lib/genome/schema";
import { orgLabel, roleLabel } from "@/components/organs/format";
import { cn } from "@/lib/utils";

type Toast = { id: string; text: string; tone: "done" | "sign" | "blocked" | "brand"; Icon: LucideIcon };

const DURATION_MS = 6000;

/** Traduce un evento importante de la bitácora a un aviso corto y amable. null si no merece aviso. */
function toToast(room: ProjectedRoomState, event: AuditEvent): Omit<Toast, "id"> | null {
  const org = orgLabel(room, event.orgId);
  const role = roleLabel(room, event.orgId, event.roleId);
  const who = room.orgs.length > 1 && org && org !== role ? `${role} (${org})` : role;
  switch (event.type) {
    case "RBAC_DENIED":
      return { text: `Acceso rechazado: ${who || org} intentó ver un dato reservado`, tone: "blocked", Icon: Ban };
    case "QR_JOINED":
      return { text: `${role || "El Comité"} entró desde su teléfono`, tone: "brand", Icon: QrCode };
    case "ROLE_JOINED":
      return { text: `${who} se conectó`, tone: "brand", Icon: UserPlus };
    case "RULE_SEALED":
      return { text: `${org} acordó su límite`, tone: "done", Icon: Lock };
    case "HITL_APPROVED":
      return { text: `${who} aprobó y dejó su razón`, tone: "done", Icon: PenLine };
    case "HITL_VETOED":
      return { text: `${who} vetó y dejó su razón`, tone: "blocked", Icon: PenLine };
    case "COUNTER_PROPOSED":
      return { text: `${who} propuso otro valor`, tone: "sign", Icon: PenLine };
    case "CANDIDATE_SUBMITTED":
      return { text: `${org} presentó su caso`, tone: "brand", Icon: Send };
    case "ALLOCATION_SEALED":
      return { text: "El Comité selló la asignación", tone: "done", Icon: CircleCheck };
    default:
      return null;
  }
}

const TONES: Record<Toast["tone"], string> = {
  done: "border-calm/40 text-calm",
  sign: "border-clash/40 text-clash",
  blocked: "border-bleed/40 text-bleed",
  brand: "border-brand/40 text-brand-ink",
};

/**
 * Avisos breves de la pantalla grande. Aparecen cuando la bitácora trae algo
 * importante y desaparecen solos. Lo que ya estaba al abrir la pantalla no avisa.
 */
export function EventToasts({ room }: { room: ProjectedRoomState }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const log = room.auditLog;
    const lastTs = log.length ? log[log.length - 1].ts : 0;
    if (seen.current === null) {
      seen.current = lastTs;
      return;
    }
    const since = seen.current;
    seen.current = Math.max(since, lastTs);
    const fresh = log
      .filter((event) => event.ts > since)
      .map((event, i) => {
        const toast = toToast(room, event);
        return toast ? { ...toast, id: `${event.ts}-${i}-${event.type}` } : null;
      })
      .filter((toast): toast is Toast => toast !== null);
    if (fresh.length === 0) return;
    setToasts((prev) => [...prev, ...fresh].slice(-2));
    // El servidor manda un mensaje por segundo mientras se espera: el temporizador
    // no puede depender de este efecto, o se cancelaría antes de cerrar el aviso.
    const ids = fresh.map((toast) => toast.id);
    timers.current.push(window.setTimeout(() => setToasts((prev) => prev.filter((toast) => !ids.includes(toast.id))), DURATION_MS));
  }, [room]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-24 left-4 z-40 flex flex-col-reverse items-end gap-2 sm:left-auto sm:w-[28rem]">
      {toasts.map((toast) => (
        <p
          key={toast.id}
          role="status"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-2xl border bg-white px-4 py-3 text-base font-semibold shadow-lift motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
            TONES[toast.tone],
          )}
        >
          <toast.Icon className="size-5 shrink-0" aria-hidden />
          <span className="text-foreground">{toast.text}</span>
        </p>
      ))}
    </div>
  );
}
