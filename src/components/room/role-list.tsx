"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import type { ProjectedRoom } from "@/lib/rooms";
import { isLocalUrl, roleJoinUrl } from "./public-url";

type Props = {
  roomId: string;
  roles: ProjectedRoom["roles"];
  currentRole: string | null;
  baseUrl: string | null;
  onJoin: (roleId: string) => void;
};

// Tarjetas de roles: estado de conexión, código QR para entrar desde el teléfono
// y botón para tomar el rol en este navegador.
export function RoleList({ roomId, roles, currentRole, baseUrl, onJoin }: Props) {
  const [qr, setQr] = useState<Record<string, string>>({});
  const roleIds = roles.map((entry) => entry.id).join(",");

  useEffect(() => {
    if (!baseUrl) return;
    let cancelled = false;
    Promise.all(
      roleIds.split(",").filter(Boolean).map(async (id) => {
        const url = roleJoinUrl(baseUrl, roomId, id);
        return [id, await QRCode.toDataURL(url, { margin: 1, width: 160 })] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setQr(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, roomId, roleIds]);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Roles</h2>
      {baseUrl && isLocalUrl(baseUrl) && (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300" role="alert">
          Los códigos apuntan a <span className="font-mono">{baseUrl}</span> y los teléfonos no podrán abrirlos. Abre esta
          pantalla con la IP de la red local o define <span className="font-mono">NEXT_PUBLIC_BASE_URL</span>.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {roles.map((entry) => (
          <div key={entry.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{entry.title}</span>
              <span className={entry.connected ? "text-emerald-600" : "text-muted-foreground"}>
                {entry.connected ? "conectado" : "libre"}
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr[entry.id] && <img src={qr[entry.id]} alt={`Código para entrar como ${entry.title}`} className="mx-auto rounded" />}
            <Button
              size="sm"
              variant={currentRole === entry.id ? "default" : "outline"}
              className="w-full"
              onClick={() => onJoin(entry.id)}
            >
              {currentRole === entry.id ? "Tu rol" : "Entrar con este rol"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
