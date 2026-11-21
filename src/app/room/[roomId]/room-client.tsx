"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import type { ProjectedRoom } from "@/lib/rooms";

// Pantalla de una sala. Sirve para probar el núcleo multijugador: entrar con un
// rol, ver quién está conectado y comprobar que cada rol recibe datos distintos.
// La idea final reemplaza el contenido, no el mecanismo.
export default function RoomClient() {
  const { roomId } = useParams<{ roomId: string }>();
  const [role, setRole] = useState<string | null>(null);
  const [room, setRoom] = useState<ProjectedRoom | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});

  // El rol puede venir en el enlace (?role=role_b), que es lo que abre el código QR.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("role");
    if (fromUrl) join(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = new EventSource(`/api/rooms/${roomId}/events?role=${role ?? "stage"}`);
    source.onmessage = (event) => setRoom(JSON.parse(event.data));
    return () => source.close();
  }, [roomId, role]);

  useEffect(() => {
    if (!room) return;
    Promise.all(
      room.roles.map(async (entry) => {
        const url = `${window.location.origin}/room/${roomId}?role=${entry.id}`;
        return [entry.id, await QRCode.toDataURL(url, { margin: 1, width: 160 })] as const;
      }),
    ).then((pairs) => setQr(Object.fromEntries(pairs)));
    // Solo se recalcula si cambia la lista de roles, no en cada actualización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, room?.roles.length]);

  async function act(body: Record<string, unknown>) {
    const res = await fetch(`/api/rooms/${roomId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function join(roleId: string) {
    const result = await act({ type: "JOIN_ROLE", roleId });
    if (result.ok) setRole(roleId);
    else setMessage(result.data.error ?? "No se pudo entrar");
  }

  async function tryRead(key: string) {
    if (!role) return;
    const result = await act({ type: "READ_FIELD", roleId: role, key });
    setMessage(result.ok ? `Lectura permitida: ${result.data.value}` : `${result.status} ${result.data.code}: ${result.data.error}`);
  }

  if (!room) {
    return <main className="p-6 text-sm text-muted-foreground">Conectando con la sala…</main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Sala {room.id}</h1>
        <p className="text-sm text-muted-foreground">
          {role ? `Estás como ${room.roles.find((entry) => entry.id === role)?.title}` : "Estás mirando sin rol (pantalla general)"}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Roles</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {room.roles.map((entry) => (
            <div key={entry.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{entry.title}</span>
                <span className={entry.connected ? "text-emerald-600" : "text-muted-foreground"}>
                  {entry.connected ? "conectado" : "libre"}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr[entry.id] && <img src={qr[entry.id]} alt={`Código para entrar como ${entry.title}`} className="mx-auto rounded" />}
              <Button size="sm" variant={role === entry.id ? "default" : "outline"} className="w-full" onClick={() => join(entry.id)}>
                {role === entry.id ? "Tu rol" : "Entrar con este rol"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Lo que ve este rol</h2>
        <ul className="divide-y rounded-lg border">
          {room.fields.map((field) => (
            <li key={field.key} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>{field.label}</span>
              {field.redacted ? (
                <span className="flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">oculto para este rol</span>
                  {role && (
                    <Button size="sm" variant="ghost" onClick={() => tryRead(field.key)}>
                      Intentar leer
                    </Button>
                  )}
                </span>
              ) : (
                <span className="font-mono">{String(field.value)}</span>
              )}
            </li>
          ))}
        </ul>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Bitácora</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {[...room.audit].reverse().map((event, index) => (
            <li key={index} className={event.type === "ACCESS_DENIED" ? "text-destructive" : undefined}>
              {new Date(event.at).toLocaleTimeString("es-CL")} · {event.detail}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
