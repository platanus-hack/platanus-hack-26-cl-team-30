"use client";

import { useState } from "react";
import { ExternalLink, LoaderCircle, QrCode as QrIcon, TriangleAlert } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { isLocalUrl, roleJoinUrl } from "./public-url";
import { QrCode } from "./qr-code";

type Props = {
  room: ProjectedRoomState;
  /** Dirección pública de la app. null mientras no se conoce (primer render). */
  baseUrl: string | null;
  /** Clave del QR del Comité. null si esta pantalla no es del anfitrión de la sala. */
  committeeKey: string | null;
  /** Abre una sala propia de este mismo caso, con su QR del Comité. */
  onOpenOwnRoom?: () => Promise<void>;
};

type Entry = { orgId: string; roleId: string; title: string; orgName: string; connected: boolean; committee: boolean };

/**
 * Códigos QR de entrada, uno por rol. El del Comité va grande: es el que escanea
 * una persona del público para entrar a decidir desde su teléfono, y lleva la
 * clave del Comité. Si esta pantalla no tiene esa clave, ofrece abrir una sala propia.
 */
export function JoinCodes({ room, baseUrl, committeeKey, onOpenOwnRoom }: Props) {
  const [opening, setOpening] = useState(false);
  const arbiter = room.scarcity?.arbiter;
  const entries: Entry[] = room.orgs.flatMap((org) =>
    org.roles.map((role) => ({
      orgId: org.orgId,
      roleId: role.id,
      title: role.title,
      orgName: org.orgName,
      connected: role.connected,
      // Sin árbitro (una sola organización), el Comité es el rol que entra por QR.
      committee: !arbiter && role.isQrOptional,
    })),
  );
  // En la sala entre organizaciones, los Comités internos no juegan: decide el Comité de la red.
  const players = arbiter ? entries.filter((entry) => !room.orgs.find((org) => org.orgId === entry.orgId)?.roles.find((role) => role.id === entry.roleId)?.isQrOptional) : entries.filter((entry) => !entry.committee);
  const committee: Entry | undefined = arbiter
    ? { orgId: arbiter.orgId, roleId: arbiter.roleId, title: arbiter.title, orgName: "", connected: arbiter.connected, committee: true }
    : entries.find((entry) => entry.committee);

  return (
    <section className="panel p-5" aria-labelledby="codigos-titulo">
      <h2 id="codigos-titulo" className="flex items-center gap-2 text-lg font-semibold">
        <QrIcon className="size-5 text-brand" aria-hidden /> Entrar con el teléfono
      </h2>
      {!baseUrl ? (
        <p className="small mt-3 text-muted-foreground">Preparando los códigos…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {isLocalUrl(baseUrl) && (
            <p role="alert" className="small flex items-start gap-2 rounded-xl bg-clash-soft px-3 py-2 text-clash">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Los códigos apuntan a <strong>{baseUrl}</strong> y un teléfono no puede abrir esa dirección. Abre esta pantalla con la IP de la red local o define
                NEXT_PUBLIC_BASE_URL.
              </span>
            </p>
          )}

          {committee &&
            (committeeKey ? (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-violet-soft p-4 ring-2 ring-role-violet">
                <QrCode url={roleJoinUrl(baseUrl, room.roomId, committee.orgId, committee.roleId, committeeKey)} label={`Código para entrar como ${committee.title}`} size={176} />
                <div className="min-w-40 flex-1">
                  <p className="text-2xl leading-tight font-semibold">Escanea y decide como {committee.title}</p>
                  <p className="small mt-1 text-muted-foreground">Vas a aprobar o vetar, y tendrás que escribir por qué.</p>
                  <p className={cn("small mt-2 font-semibold", committee.connected ? "text-calm" : "text-muted-foreground")}>{committee.connected ? "Comité conectado" : "Esperando al Comité"}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-violet-soft p-4">
                <p className="font-semibold">El código del Comité lo tiene quien abrió esta sala.</p>
                <p className="small mt-1 text-muted-foreground">Para mostrarlo aquí, abre una sala propia de este mismo caso: tendrás el código del Comité y los controles.</p>
                {onOpenOwnRoom && (
                  <button
                    type="button"
                    className="btn btn-primary mt-3"
                    disabled={opening}
                    onClick={async () => {
                      setOpening(true);
                      await onOpenOwnRoom();
                      setOpening(false);
                    }}
                  >
                    {opening && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                    {opening ? "Abriendo…" : "Abrir mi propia sala"}
                  </button>
                )}
              </div>
            ))}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {players.map((entry) => {
              const url = roleJoinUrl(baseUrl, room.roomId, entry.orgId, entry.roleId);
              return (
                <li key={`${entry.orgId}/${entry.roleId}`} className="min-w-0 space-y-1.5">
                  <QrCode url={url} label={`Código para entrar como ${entry.title}`} size={104} />
                  <p className="text-sm leading-tight font-semibold">{entry.title}</p>
                  {room.orgs.length > 1 && <p className="text-xs leading-tight text-muted-foreground">{entry.orgName}</p>}
                  <p className="text-xs">
                    <span className={entry.connected ? "font-semibold text-calm" : "text-muted-foreground"}>{entry.connected ? "Conectado" : "Libre"}</span>
                    {" · "}
                    <a className="inline-flex items-center gap-0.5 underline underline-offset-2" href={url} target="_blank" rel="noreferrer">
                      abrir <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
