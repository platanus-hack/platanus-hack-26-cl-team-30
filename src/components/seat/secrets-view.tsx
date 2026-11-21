"use client";

import { useState } from "react";
import { Eye, Lock, LockOpen, Share2 } from "lucide-react";
import { formatValue, type RoleViewer } from "@/components/organs/format";
import type { Act } from "@/lib/client/use-room";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { splitFields } from "./screen";
import { SeatMain } from "./seat-shell";

type Attempt = { id: string; kind: "denied" } | { id: string; kind: "value"; value: string } | { id: string; kind: "error"; message: string };

/**
 * Pestaña «Secretos»: los datos que llegaron a este teléfono y los que no. Un
 * dato reservado viene sin valor desde el servidor, así que aquí no hay nada que
 * destapar: se dibuja como una barra de franjas. «Ver» lo pide de todos modos;
 * el servidor lo niega, lo anota en la bitácora y se muestra un aviso corto.
 */
export function SecretsView({ room, me, act }: { room: ProjectedRoomState; me: RoleViewer; act: Act }) {
  const { visible, hidden } = splitFields(room);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const severalOrgs = room.orgs.length > 1;

  async function peek(orgId: string, fieldKey: string) {
    const id = `${orgId}/${fieldKey}`;
    setBusy(id);
    const result = await act("TEST_RBAC_BREACH", { targetOrgId: orgId, fieldKey });
    setBusy(null);
    if (result.ok) setAttempt({ id, kind: "value", value: String(result.data.value ?? "") });
    else if (result.status === 403) setAttempt({ id, kind: "denied" });
    else setAttempt({ id, kind: "error", message: result.error });
  }

  async function toggle(fieldKey: string) {
    setBusy(`toggle/${fieldKey}`);
    await act("TOGGLE_FIELD_SECRET", { fieldKey });
    setBusy(null);
  }

  return (
    <SeatMain label="Secretos">
      <section className="st-card">
        <h2 className="st-h2">
          <span>
            <LockOpen aria-hidden style={{ display: "inline", width: 17, height: 17, marginInlineEnd: 6, verticalAlign: "-2px" }} />
            Lo que ves
          </span>
          <b>{visible.length}</b>
        </h2>
        {visible.length === 0 ? (
          <p className="st-support">Tu rol decide sin ver datos reservados.</p>
        ) : (
          <ul className="st-rows">
            {visible.map(({ org, field }) => {
              if (field.redacted) return null;
              const mine = org.orgId === me.orgId && field.ownerRoleId === me.roleId;
              const shared = field.visibleToRoleIds.length > 1;
              const canToggle = mine && field.classification !== "public";
              return (
                <li key={`${org.orgId}/${field.key}`} className="st-row">
                  <div className="st-row-text">
                    <strong>{field.label}</strong>
                    <small>{mine ? (shared ? "Lo ve tu organización" : "Solo tú") : severalOrgs ? org.orgName : "Compartido contigo"}</small>
                  </div>
                  <span className="st-row-value">{formatValue(field.value, field.unit)}</span>
                  {canToggle && (
                    <button type="button" role="switch" aria-checked={shared} aria-label={`Compartir ${field.label} con tu organización`} className="st-mini" disabled={busy === `toggle/${field.key}`} onClick={() => toggle(field.key)}>
                      {shared ? <Share2 aria-hidden /> : <Lock aria-hidden />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {hidden.length > 0 && (
        <section className="st-card">
          <h2 className="st-h2">
            <span>
              <Lock aria-hidden style={{ display: "inline", width: 17, height: 17, marginInlineEnd: 6, verticalAlign: "-2px" }} />
              Oculto para ti
            </span>
            <b>{hidden.length}</b>
          </h2>
          {room.orgs.map((org) => {
            const rows = hidden.filter((row) => row.org.orgId === org.orgId);
            if (rows.length === 0) return null;
            return (
              <div key={org.orgId}>
                {severalOrgs && <p className="st-org-name">{org.orgName}</p>}
                <ul className="st-rows" style={{ marginBlockStart: 0 }}>
                  {rows.map(({ field }) => {
                    const id = `${org.orgId}/${field.key}`;
                    const mine = attempt?.id === id ? attempt : null;
                    return (
                      <li key={id} className="st-row" style={{ flexWrap: "wrap" }}>
                        <div className="st-row-text is-wrap">
                          <strong>{field.label}</strong>
                        </div>
                        {mine?.kind === "value" ? (
                          <span className="st-row-value">{mine.value}</span>
                        ) : (
                          <>
                            <span className="st-hatch" aria-hidden />
                            <span className="st-sr">Reservado</span>
                            <button type="button" className="st-mini" disabled={busy === id} aria-label={`Intentar ver ${field.label}`} onClick={() => peek(org.orgId, field.key)}>
                              <Eye aria-hidden /> Ver
                            </button>
                          </>
                        )}
                        {mine?.kind === "denied" && (
                          <p role="status" className="st-denied" style={{ flexBasis: "100%" }}>
                            <Lock aria-hidden /> Este dato nunca llegó a tu celular.
                          </p>
                        )}
                        {mine?.kind === "error" && (
                          <p role="alert" className="st-denied" style={{ flexBasis: "100%" }}>
                            {mine.message}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </SeatMain>
  );
}
