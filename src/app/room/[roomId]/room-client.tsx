"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { AuditLog } from "@/components/room/audit-log";
import { ConnectionBadge } from "@/components/room/connection-badge";
import { FieldList } from "@/components/room/field-list";
import { publicBaseUrl } from "@/components/room/public-url";
import { RoleList } from "@/components/room/role-list";
import { clearSession, loadSession, saveSession } from "@/components/room/session";
import { useRoomEvents } from "@/components/room/use-room-events";

type Session = { role: string; token: string | null };

const noopSubscribe = () => () => {};

// Pantalla de una sala. Sirve para probar el núcleo multijugador: entrar con un
// rol, ver quién está conectado y comprobar que cada rol recibe datos distintos.
// La idea final reemplaza el contenido, no el mecanismo.
export default function RoomClient() {
  const { roomId } = useParams<{ roomId: string }>();
  // El rol y su token se recuperan de sessionStorage al recargar. En el servidor
  // no hay sesión; no hay desajuste de hidratación porque hasta recibir la sala
  // solo se muestra "Conectando".
  const [session, setSession] = useState<Session | null>(() =>
    typeof window === "undefined" ? null : loadSession(roomId),
  );
  const [message, setMessage] = useState<string | null>(null);
  const baseUrl = useSyncExternalStore(noopSubscribe, publicBaseUrl, () => null);
  const role = session?.role ?? null;
  const { room, status } = useRoomEvents(roomId, role, session?.token ?? null);

  // Al cargar: si hay un rol guardado, se reconecta presentando su token
  // (JOIN_ROLE con token recupera el rol propio). Si no, el rol puede venir en
  // el enlace (?role=role_b), que es lo que abre el código QR.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("role");
    const stored = loadSession(roomId);
    if (stored && (!fromUrl || fromUrl === stored.role)) join(stored.role, stored.token);
    else if (fromUrl) join(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(body: Record<string, unknown>, token = session?.token) {
    const res = await fetch(`/api/rooms/${roomId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token ? { ...body, token } : body),
    });
    const data = await res.json().catch(() => ({}));
    // Token vencido o inválido (por ejemplo, el servidor se reinició): se olvida
    // el rol guardado y se vuelve a mirar como pantalla general.
    if (res.status === 401) {
      clearSession(roomId);
      setSession(null);
    }
    return { ok: res.ok, status: res.status, data };
  }

  async function join(roleId: string, storedToken?: string) {
    if (roleId === role && !storedToken) return;
    const result = await act({ type: "JOIN_ROLE", roleId }, storedToken ?? null);
    if (!result.ok && storedToken) {
      // El token guardado ya no sirve (servidor reiniciado u otra persona tomó el rol).
      clearSession(roomId);
      setSession(null);
    }
    if (result.ok) {
      const token = typeof result.data.token === "string" ? result.data.token : null;
      if (token) saveSession(roomId, { role: roleId, token });
      setSession({ role: roleId, token });
      setMessage(null);
      return;
    }
    const title = room?.roles.find((entry) => entry.id === roleId)?.title ?? roleId;
    setMessage(
      result.status === 409
        ? `El rol "${title}" ya está ocupado por otra persona. Elige un rol libre.`
        : (result.data.error ?? "No se pudo entrar"),
    );
  }

  async function tryRead(key: string) {
    if (!role) return;
    const result = await act({ type: "READ_FIELD", roleId: role, key });
    setMessage(
      result.ok
        ? `Lectura permitida: ${result.data.value}`
        : result.status === 401
          ? "Tu sesión en este rol ya no es válida. Vuelve a entrar."
          : `${result.status} ${result.data.code}: ${result.data.error}`,
    );
  }

  if (!room) {
    return (
      <main className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
        Conectando con la sala… <ConnectionBadge status={status} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Sala {room.id}</h1>
          <ConnectionBadge status={status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {role ? `Estás como ${room.roles.find((entry) => entry.id === role)?.title}` : "Estás mirando sin rol (pantalla general)"}
        </p>
      </header>

      <RoleList roomId={roomId} roles={room.roles} currentRole={role} baseUrl={baseUrl} onJoin={join} />
      <FieldList fields={room.fields} canRead={role !== null} onTryRead={tryRead} message={message} />
      <AuditLog audit={room.audit} />
    </main>
  );
}
