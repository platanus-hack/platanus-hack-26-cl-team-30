"use client";

import { useState } from "react";
import { LoaderCircle, QrCode, UserRound } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { ACCENT } from "@/components/organs/format";

type Props = {
  room: ProjectedRoomState;
  onJoin: (orgId: string, roleId: string) => Promise<{ ok: boolean }>;
};

/** Elegir organización y rol. Botones grandes: se usa sobre todo desde el teléfono. */
export function RolePicker({ room, onJoin }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const arbiter = room.scarcity?.arbiter;

  async function pick(orgId: string, roleId: string) {
    setBusy(`${orgId}/${roleId}`);
    const result = await onJoin(orgId, roleId);
    setBusy(null);
    // En el teléfono el selector queda abajo; al entrar se vuelve al principio de la estación.
    if (result.ok) window.scrollTo({ top: 0 });
  }

  return (
    <div className="space-y-6">
      {room.orgs.map((org) => (
        <div key={org.orgId}>
          <h2 className="mb-2 font-semibold">{org.orgName}</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {org.roles
              .filter((role) => !role.isQrOptional)
              .map((role) => (
                <RoleButton
                  key={role.id}
                  title={role.title}
                  detail={role.objective}
                  accent={ACCENT[role.accentColor].bg}
                  connected={role.connected}
                  busy={busy === `${org.orgId}/${role.id}`}
                  onClick={() => pick(org.orgId, role.id)}
                />
              ))}
          </div>
        </div>
      ))}
      <p className="small flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-brand-ink">
        <QrCode className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {arbiter ? `${arbiter.title}` : "El Comité"} entra escaneando su código QR en la pantalla grande. Así nadie toma ese puesto por error.
        </span>
      </p>
    </div>
  );
}

function RoleButton({ title, detail, accent, connected, busy, onClick }: { title: string; detail: string; accent: string; connected: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="panel relative flex min-h-24 w-full flex-col items-start gap-1 overflow-hidden py-4 pr-4 pl-6 text-left outline-none hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", accent)} />
      <span className="flex items-center gap-2 text-base leading-tight font-semibold">
        <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {title}
      </span>
      <span className="small text-muted-foreground">{detail}</span>
      <span className={cn("mt-1 inline-flex items-center gap-1.5 text-sm font-semibold", connected ? "text-clash" : "text-calm")}>
        {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {busy ? "Entrando…" : connected ? "Ocupado por otra persona" : "Libre: toca para entrar"}
      </span>
    </button>
  );
}
