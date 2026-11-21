"use client";

import type { ProjectedRoomState } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { OrganFrame } from "@/components/organs/organ-frame";
import { isLocalUrl, roleJoinUrl } from "./public-url";
import { QrCode } from "./qr-code";

type Props = {
  room: ProjectedRoomState;
  /** Dirección pública de la app. null mientras no se conoce (primer render). */
  baseUrl: string | null;
};

type Entry = { orgId: string; roleId: string; title: string; orgName: string; connected: boolean; featured: boolean };

/**
 * Códigos QR de entrada, uno por rol. El del Comité va grande: es el que escanea
 * una persona del público para entrar a decidir desde su teléfono.
 */
export function JoinCodes({ room, baseUrl }: Props) {
  const arbiter = room.scarcity?.arbiter;
  const entries: Entry[] = room.orgs.flatMap((org) =>
    org.roles.map((role) => ({
      orgId: org.orgId,
      roleId: role.id,
      title: role.title,
      orgName: org.orgName,
      connected: role.connected,
      // Sin árbitro (una sola organización), el destacado es el Comité de la organización.
      featured: !arbiter && role.isQrOptional,
    })),
  );
  if (arbiter) entries.unshift({ orgId: arbiter.orgId, roleId: arbiter.roleId, title: arbiter.title, orgName: "", connected: arbiter.connected, featured: true });
  const featured = entries.find((entry) => entry.featured);
  const rest = entries.filter((entry) => entry !== featured);

  return (
    <OrganFrame title="Entrar con el teléfono" aside="un código por rol">
      {!baseUrl ? (
        <p className="text-sm text-muted-foreground">Preparando los códigos…</p>
      ) : (
        <div className="space-y-4">
          {isLocalUrl(baseUrl) && (
            <p role="alert" className="rounded-md border border-clash/50 bg-clash-soft px-3 py-2 text-sm">
              Los códigos apuntan a <strong className="font-semibold">{baseUrl}</strong> y un teléfono no puede abrir esa dirección. Abre esta pantalla con la IP de la red local o
              define NEXT_PUBLIC_BASE_URL.
            </p>
          )}

          {featured && (
            <div className="flex flex-wrap items-center gap-4 rounded-md border-2 border-role-violet bg-violet-soft p-3">
              <QrCode url={roleJoinUrl(baseUrl, room.roomId, featured.orgId, featured.roleId)} label={`Código para entrar como ${featured.title}`} size={184} />
              <div className="min-w-40 flex-1">
                <p className="text-2xl leading-tight font-semibold font-stretch-[108%]">Escanea y decide como {featured.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">Vas a aprobar o vetar, y tendrás que escribir por qué.</p>
                <RoleLink entry={featured} baseUrl={baseUrl} roomId={room.roomId} className="mt-2" />
              </div>
            </div>
          )}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rest.map((entry) => (
              <li key={`${entry.orgId}/${entry.roleId}`} className="min-w-0 space-y-1.5">
                <QrCode url={roleJoinUrl(baseUrl, room.roomId, entry.orgId, entry.roleId)} label={`Código para entrar como ${entry.title}`} size={104} />
                <p className="text-sm leading-tight font-semibold">{entry.title}</p>
                {room.orgs.length > 1 && <p className="text-xs leading-tight text-muted-foreground">{entry.orgName}</p>}
                <RoleLink entry={entry} baseUrl={baseUrl} roomId={room.roomId} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </OrganFrame>
  );
}

function RoleLink({ entry, baseUrl, roomId, className }: { entry: Entry; baseUrl: string; roomId: string; className?: string }) {
  return (
    <p className={cn("text-xs", className)}>
      <span className={entry.connected ? "text-calm" : "text-muted-foreground"}>{entry.connected ? "Conectado" : "Libre"}</span>
      {", "}
      <a className="underline underline-offset-2" href={roleJoinUrl(baseUrl, roomId, entry.orgId, entry.roleId)} target="_blank" rel="noreferrer">
        abrir en otra pestaña
      </a>
    </p>
  );
}
