"use client";

import { useEffect, useState } from "react";
import type { ProjectedRoom } from "@/lib/rooms";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting";

// Conexión SSE a la sala. El navegador reintenta solo ante cortes de red, pero
// si el servidor responde con error el EventSource queda cerrado; en ese caso
// se vuelve a abrir con espera creciente (1 s, 2 s, 4 s… hasta 10 s).
export function useRoomEvents(roomId: string, role: string | null, token: string | null) {
  const [room, setRoom] = useState<ProjectedRoom | null>(null);
  // El estado se guarda junto a la URL de la conexión: si cambia el rol, la
  // conexión nueva parte en "connecting" sin un setState dentro del efecto.
  const [state, setState] = useState<{ url: string; status: ConnectionStatus } | null>(null);
  const params = new URLSearchParams({ role: role ?? "stage" });
  if (role && token) params.set("token", token);
  const url = `/api/rooms/${encodeURIComponent(roomId)}/events?${params}`;
  const status: ConnectionStatus = state?.url === url ? state.status : "connecting";

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let stopped = false;

    const setStatus = (next: ConnectionStatus) => setState({ url, status: next });

    const open = () => {
      source = new EventSource(url);
      source.onopen = () => {
        attempts = 0;
        setStatus("connected");
      };
      source.onmessage = (event) => {
        setStatus("connected");
        setRoom(JSON.parse(event.data));
      };
      source.onerror = () => {
        if (stopped) return;
        setStatus("reconnecting");
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          const delay = Math.min(1000 * 2 ** attempts, 10000);
          attempts += 1;
          retryTimer = setTimeout(open, delay);
        }
      };
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [url]);

  return { room, status };
}
