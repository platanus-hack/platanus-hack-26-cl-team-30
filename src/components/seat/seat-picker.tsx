"use client";

import { useState, type ReactNode } from "react";
import { CircleDashed, LoaderCircle, UserRound } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { Why } from "./parts";
import { demoHumanSeat } from "./screen";
import { SeatMain } from "./seat-shell";

type Props = {
  room: ProjectedRoomState;
  onJoin: (orgId: string, roleId: string) => Promise<{ ok: boolean }>;
  /** Botones de la zona del pulgar (por ejemplo, el sorteo de rol). */
  children?: ReactNode;
};

/**
 * Elegir silla a mano. El Comité no aparece: entra por su código QR, que trae
 * la clave del puesto, para que nadie lo tome por error.
 */
export function SeatPicker({ room, onJoin, children }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(orgId: string, roleId: string) {
    setBusy(`${orgId}/${roleId}`);
    await onJoin(orgId, roleId);
    setBusy(null);
  }

  return (
    <>
      <SeatMain>
        <section className="st-card">
          <h1 className="st-title" style={{ marginBlockStart: 0 }}>
            Elige tu silla
          </h1>
          <p className="st-support">Verás solo lo que ve ese rol.</p>
          {room.orgs.map((org) => (
            <div key={org.orgId}>
              {room.orgs.length > 1 && <p className="st-org-name">{org.orgName}</p>}
              {org.roles
                // En la demo solo se eligen los asientos de quien presenta; los demás son bots.
                .filter((role) => (room.demo ? demoHumanSeat(room, org.orgId, role.id) : !role.isQrOptional))
                .map((role) => {
                  const id = `${org.orgId}/${role.id}`;
                  return (
                    <button key={id} type="button" className="st-seat-btn" data-accent={role.accentColor} disabled={busy !== null} onClick={() => pick(org.orgId, role.id)}>
                      <strong>{role.title}</strong>
                      {busy === id ? (
                        <LoaderCircle className="size-5 animate-spin" aria-hidden />
                      ) : role.connected ? (
                        <span className="st-badge" data-tone="plain">
                          <UserRound aria-hidden /> Ocupada
                        </span>
                      ) : (
                        <span className="st-badge">
                          <CircleDashed aria-hidden /> Libre
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
          <Why label="¿Y el Comité?">
            <p>{room.demo ? "En esta demo, la tercera persona que entra es el Comité: toca «Entrar»." : "Entra escaneando su código QR en la pantalla grande. Así nadie toma ese puesto por error."}</p>
          </Why>
        </section>
      </SeatMain>
      {children}
    </>
  );
}
