"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ProjectedField, ProjectedOrg, Viewer } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { formatTime, formatValue, isRoleViewer, type OrganResult } from "./format";
import { OrganFrame } from "./organ-frame";

type Props = {
  /** Todas las organizaciones de la sala, ya filtradas por el servidor para quien mira. */
  orgs: ProjectedOrg[];
  viewer: Viewer;
  /** Intento de lectura de un campo. El servidor responde 403 si el rol no tiene permiso. */
  onBreach?: (targetOrgId: string, fieldKey: string) => Promise<OrganResult>;
  /** Reservar o compartir un campo propio dentro de la organización. */
  onToggleSecret?: (fieldKey: string) => Promise<OrganResult>;
  /** Una línea por campo, para la pantalla de proyección. */
  dense?: boolean;
};

type Attempt = { at: number; result: OrganResult };

const CLASSIFICATION: Record<ProjectedField["classification"], string> = {
  public: "público",
  restricted: "restringido",
  secret: "secreto",
};

/**
 * Órgano 3. Lo que este rol puede ver de cada organización. Un campo oculto
 * llega sin valor desde el servidor (redacted: true): no hay nada que revelar
 * en el navegador. El botón pide el dato de todos modos, para mostrar el 403.
 */
export function FogOfWarPanelOrgan({ orgs, viewer, onBreach, onToggleSecret, dense = false }: Props) {
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const me = isRoleViewer(viewer) ? viewer : null;
  const hidden = orgs.reduce((total, org) => total + org.fields.filter((field) => field.redacted).length, 0);
  const total = orgs.reduce((sum, org) => sum + org.fields.length, 0);

  async function breach(orgId: string, fieldKey: string) {
    if (!onBreach) return;
    const id = `${orgId}/${fieldKey}`;
    setBusy(id);
    const result = await onBreach(orgId, fieldKey);
    setBusy(null);
    setAttempts((prev) => ({ ...prev, [id]: { at: Date.now(), result } }));
  }

  async function toggle(fieldKey: string) {
    if (!onToggleSecret) return;
    setBusy(`toggle/${fieldKey}`);
    await onToggleSecret(fieldKey);
    setBusy(null);
  }

  return (
    <OrganFrame title="Qué datos llegan a esta pantalla" aside={`${total - hidden} de ${total} campos; ${hidden} no viajaron`}>
      <div className="space-y-5">
        {dense && hidden > 0 && (
          <p className="text-sm text-muted-foreground">Lo tachado no está escondido aquí: el servidor no lo envió (RBAC_SERVER_FILTERED). Cada rol lo ve o no desde su propia pantalla.</p>
        )}
        {orgs.map((org) => {
          const own = me?.orgId === org.orgId;
          return (
            <div key={org.orgId}>
              {(orgs.length > 1 || me) && (
                <h3 className="mb-1 text-sm font-semibold">
                  {org.orgName}
                  {own && <span className="font-normal text-muted-foreground"> (tu organización)</span>}
                </h3>
              )}
              <ul className="divide-y divide-border">
                {org.fields.map((field) => {
                  const id = `${org.orgId}/${field.key}`;
                  const attempt = attempts[id];
                  const owner = org.roles.find((role) => role.id === field.ownerRoleId);
                  const mine = own && me?.roleId === field.ownerRoleId;
                  const shared = !field.redacted && field.visibleToRoleIds.length > 1;
                  return (
                    <li key={field.key} className={dense ? "py-1.5" : "py-2.5"}>
                      <div className="flex items-start justify-between gap-x-4">
                        <div className="min-w-0">
                          <p className="text-sm">{field.label}</p>
                          {!dense && (
                            <p className="text-xs text-muted-foreground">
                              {CLASSIFICATION[field.classification]}, de {owner?.title ?? field.ownerRoleId}
                              {field.redacted && <span className="max-sm:hidden">; {org.orgId}: {field.reason}</span>}
                            </p>
                          )}
                        </div>
                        {field.redacted ? (
                          <span className="redaction mt-0.5 block h-4 w-20 shrink-0 sm:w-24" role="img" aria-label="Valor oculto: el servidor no lo envió" />
                        ) : (
                          <p className="shrink-0 text-base font-semibold tabular-nums">{formatValue(field.value, field.unit)}</p>
                        )}
                      </div>

                      {field.redacted && me && onBreach && (
                        <Button variant="outline" size="sm" className="mt-1.5 min-h-9 text-xs" disabled={busy === id} onClick={() => breach(org.orgId, field.key)}>
                          {busy === id ? "Pidiendo el dato…" : "Intentar leerlo con mi agente"}
                        </Button>
                      )}
                      {mine && onToggleSecret && !field.redacted && field.classification !== "public" && (
                        <Button variant="ghost" size="sm" className="mt-1 -ml-2 min-h-9" disabled={busy === `toggle/${field.key}`} onClick={() => toggle(field.key)}>
                          {shared ? "Reservarlo solo para mi rol" : "Compartirlo con mi organización"}
                        </Button>
                      )}

                      {attempt && (
                        <p
                          role="status"
                          className={cn(
                            "mt-2 rounded-md border px-3 py-2 text-sm",
                            attempt.result.ok ? "border-calm/50 bg-calm-soft" : "border-bleed/50 bg-bleed-soft text-bleed",
                          )}
                        >
                          {attempt.result.ok ? (
                            <>Lectura permitida: {String(attempt.result.data?.value ?? "")}</>
                          ) : (
                            <>
                              <strong className="font-bold tabular-nums">
                                {attempt.result.status} {attempt.result.code}
                              </strong>{" "}
                              a las {formatTime(attempt.at)}. {attempt.result.error} El intento quedó en la bitácora.
                            </>
                          )}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </OrganFrame>
  );
}
