"use client";

import { useState } from "react";
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
      {arbiter && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Árbitro entre las organizaciones</h2>
          <RoleButton
            title={arbiter.title}
            detail="Decide quién recibe el recurso. No ve el costo de ninguna organización."
            accent="bg-role-violet"
            connected={arbiter.connected}
            busy={busy === `${arbiter.orgId}/${arbiter.roleId}`}
            onClick={() => pick(arbiter.orgId, arbiter.roleId)}
          />
        </div>
      )}
      {room.orgs.map((org) => (
        <div key={org.orgId}>
          <h2 className="mb-2 text-sm font-semibold">{org.orgName}</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {org.roles.map((role) => (
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
    </div>
  );
}

function RoleButton({ title, detail, accent, connected, busy, onClick }: { title: string; detail: string; accent: string; connected: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="relative flex min-h-20 w-full flex-col items-start gap-0.5 overflow-hidden rounded-md border border-border bg-card py-3 pr-3 pl-5 text-left outline-none hover:border-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", accent)} />
      <span className="text-base leading-tight font-semibold">{title}</span>
      <span className="text-sm leading-snug text-muted-foreground">{detail}</span>
      <span className={cn("mt-1 text-xs", connected ? "text-clash" : "text-calm")}>{busy ? "Entrando…" : connected ? "Ocupado por otra persona" : "Libre: toca para entrar"}</span>
    </button>
  );
}
