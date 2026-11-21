"use client";

import { useState } from "react";
import { Ban, Bot, CircleCheck, Lock, Share2 } from "lucide-react";
import type { ProjectedOrg, Viewer } from "@/lib/genome/schema";
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
    <OrganFrame title={me ? "Los datos que ves" : "Lo que ve la pantalla general"} aside={`${total - hidden} de ${total} datos llegan a esta pantalla`}>
      <div className="space-y-5">
        {hidden > 0 && (
          <p className="small text-muted-foreground">
            Los datos con candado no están escondidos aquí: el servidor no los envió. {me ? "Cada rol recibe solo lo suyo." : "Cada rol los ve, o no, desde su teléfono."}
          </p>
        )}
        {orgs.map((org) => {
          const own = me?.orgId === org.orgId;
          return (
            <div key={org.orgId}>
              {(orgs.length > 1 || me) && (
                <h3 className="mb-2 text-sm font-semibold">
                  {org.orgName}
                  {own && <span className="font-normal text-muted-foreground"> (tu organización)</span>}
                </h3>
              )}
              <ul className="space-y-1.5">
                {org.fields.map((field) => {
                  const id = `${org.orgId}/${field.key}`;
                  const attempt = attempts[id];
                  const owner = org.roles.find((role) => role.id === field.ownerRoleId);
                  const mine = own && me?.roleId === field.ownerRoleId;
                  const shared = !field.redacted && field.visibleToRoleIds.length > 1;
                  return (
                    <li key={field.key} className={cn("rounded-xl px-3", dense ? "py-2" : "py-2.5", field.redacted ? "shield" : "bg-muted/60")}>
                      <div className="flex items-center justify-between gap-x-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{field.label}</p>
                          {!dense && <p className="text-xs text-muted-foreground">Dato de {owner?.title ?? field.ownerRoleId}</p>}
                          {field.redacted && <p className="mt-0.5 text-xs font-semibold sm:hidden">{me ? "No disponible para tu rol" : "No viaja"}</p>}
                        </div>
                        {field.redacted ? (
                          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                            <Lock className="size-4 sm:size-3.5" aria-hidden />
                            <span className="max-sm:sr-only">{me ? "No disponible para tu rol" : "No viaja"}</span>
                          </span>
                        ) : (
                          <p className="shrink-0 text-base font-semibold tabular-nums">{formatValue(field.value, field.unit)}</p>
                        )}
                      </div>

                      {field.redacted && me && onBreach && !attempt && (
                        <button type="button" className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-ink underline underline-offset-4" disabled={busy === id} onClick={() => breach(org.orgId, field.key)}>
                          <Bot className="size-4" aria-hidden />
                          {busy === id ? "Pidiendo el dato…" : "Pedírselo a mi agente"}
                        </button>
                      )}
                      {mine && onToggleSecret && !field.redacted && field.classification !== "public" && (
                        <button type="button" className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-brand-ink underline underline-offset-4" disabled={busy === `toggle/${field.key}`} onClick={() => toggle(field.key)}>
                          {shared ? <Lock className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                          {shared ? "Dejarlo solo para mi rol" : "Compartirlo con mi organización"}
                        </button>
                      )}

                      {attempt && (
                        <p role="status" className={cn("mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm", attempt.result.ok ? "bg-calm-soft text-calm" : "bg-bleed-soft text-bleed")}>
                          {attempt.result.ok ? (
                            <>
                              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                              Puedes verlo: {String(attempt.result.data?.value ?? "")}
                            </>
                          ) : attempt.result.status === 403 ? (
                            <>
                              <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
                              <span>
                                <strong className="font-semibold">No disponible para tu rol.</strong> El servidor no lo entregó y el intento quedó registrado a las {formatTime(attempt.at)}.
                              </span>
                            </>
                          ) : (
                            <>
                              <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
                              {attempt.result.error ?? "No se pudo pedir el dato."}
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
