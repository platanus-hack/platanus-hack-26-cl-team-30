"use client";

// Cliente de una sala de Nexo para el navegador. Es el único lugar de la interfaz
// que habla con /api/rooms: abre el flujo de eventos (SSE), guarda la identidad
// del rol y envía acciones. El estado que entrega ya viene filtrado por el
// servidor para quien mira; aquí no se oculta ni se calcula nada.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectedRoomState, RoomMode } from "@/lib/genome/schema";
import type { ActionErrorCode, ActionOf, ActionOk, ActionType } from "@/lib/store/actions";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting";

/** Identidad de esta pestaña en una sala. El token lo entrega JOIN_ROLE. */
export type RoomSession = { orgId: string; roleId: string; token: string };

/** Lo que cada acción necesita además de la identidad, que agrega el hook. */
export type ActionPayload<T extends ActionType> = Omit<ActionOf<T>, "type" | "orgId" | "roleId" | "token">;

export type ActResult =
  | { ok: true; status: number; data: ActionOk }
  | { ok: false; status: number; code: ActionErrorCode | "NO_ROLE" | "NETWORK"; error: string };

export type Act = <T extends ActionType>(type: T, payload: ActionPayload<T>) => Promise<ActResult>;

// --- Identidad guardada por sala ----------------------------------------------
// sessionStorage es por pestaña: dos pestañas del mismo navegador pueden ocupar
// dos roles distintos, que es como se ensaya la demo en un solo computador.

const storageKey = (roomId: string) => `nexo:${roomId}:session`;

function loadSession(roomId: string): RoomSession | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomSession>;
    return typeof parsed.orgId === "string" && typeof parsed.roleId === "string" && typeof parsed.token === "string"
      ? { orgId: parsed.orgId, roleId: parsed.roleId, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

function storeSession(roomId: string, session: RoomSession | null): void {
  try {
    if (session) window.sessionStorage.setItem(storageKey(roomId), JSON.stringify(session));
    else window.sessionStorage.removeItem(storageKey(roomId));
  } catch {
    // Almacenamiento bloqueado (modo privado): la sala funciona, pero no recuerda el rol al recargar.
  }
}

// --- Peticiones ---------------------------------------------------------------

/**
 * Mensaje para la persona cuando el servidor responde con uno de sus topes.
 * Dice qué pasó y qué hacer; el código técnico se sigue mostrando aparte.
 */
const FRIENDLY_ERRORS: Partial<Record<string, string>> = {
  BUSY: "Todavía se está procesando la petición anterior al modelo. Espera unos segundos y vuelve a intentarlo.",
  ROOM_LIMIT: "El servidor llegó al máximo de salas abiertas y todas tienen gente. Entra a la sala de demostración o intenta de nuevo en un minuto.",
  TOO_MANY_CONNECTIONS: "El servidor tiene demasiadas pantallas conectadas. Esta pantalla se volverá a conectar sola en unos segundos.",
};

export function friendlyError(code: string | undefined, fallback: string): string {
  return (code && FRIENDLY_ERRORS[code]) || fallback;
}

async function postAction(roomId: string, body: Record<string, unknown>): Promise<ActResult> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, data: data as ActionOk };
    return {
      ok: false,
      status: res.status,
      code: (data.code as ActionErrorCode | undefined) ?? "BAD_REQUEST",
      error: friendlyError(data.code, typeof data.error === "string" ? data.error : `El servidor respondió ${res.status}`),
    };
  } catch {
    return { ok: false, status: 0, code: "NETWORK", error: "No se pudo llegar al servidor. Revisa la conexión." };
  }
}

/** POST /api/rooms. Devuelve el id de la sala nueva. */
export async function createRoom(mode: RoomMode, seed?: string): Promise<string> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(seed ? { mode, seed } : { mode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.roomId !== "string") {
    throw new Error(friendlyError(data.code, typeof data.error === "string" ? data.error : "No se pudo crear la sala"));
  }
  return data.roomId;
}

export type MutateResult = { ok: boolean; source?: string; latencyMs?: number; error?: string };

/** POST /api/rooms/:id/mutate. Pide un genoma nuevo a partir de una frase. */
export async function mutateRoom(roomId: string, description: string): Promise<MutateResult> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/mutate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fallback = typeof data.error === "string" ? data.error : `El servidor respondió ${res.status}`;
      // En la mutación, BUSY significa que esta misma sala ya está generando una organización.
      return { ok: false, error: data.code === "BUSY" ? "Esta sala ya está generando una organización. Espera a que termine." : friendlyError(data.code, fallback) };
    }
    return { ok: true, source: data.source, latencyMs: data.latencyMs };
  } catch {
    return { ok: false, error: "No se pudo llegar al servidor." };
  }
}

/** Dirección del acta de decisión para descargar. */
export function actaUrl(roomId: string, format: "json" | "md"): string {
  return `/api/rooms/${encodeURIComponent(roomId)}/acta?format=${format}`;
}

// --- Hook ---------------------------------------------------------------------

type Options = {
  /** true en la pantalla de proyección: siempre mira como "stage", sin rol. */
  spectator?: boolean;
};

export function useRoom(roomId: string, { spectator = false }: Options = {}) {
  // En el servidor no hay sesión. No hay desajuste al hidratar porque, hasta que
  // llega el primer mensaje de la sala, todas las pantallas muestran "Conectando".
  const [session, setSessionState] = useState<RoomSession | null>(() =>
    spectator || typeof window === "undefined" ? null : loadSession(roomId),
  );
  const [notice, setNotice] = useState<string | null>(null);
  // La sala y el estado de conexión se guardan junto a la URL que los produjo:
  // al cambiar de rol, lo recibido con la identidad anterior deja de contar.
  const [feed, setFeed] = useState<{ url: string; room: ProjectedRoomState | null; status: ConnectionStatus; failures: number } | null>(null);
  const [lastRoom, setLastRoom] = useState<ProjectedRoomState | null>(null);
  /** Motivo legible del último rechazo de la conexión en vivo, si el servidor lo dio. */
  const [problem, setProblem] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (session) {
    params.set("orgId", session.orgId);
    params.set("roleId", session.roleId);
    params.set("token", session.token);
  }
  const query = params.toString();
  const url = `/api/rooms/${encodeURIComponent(roomId)}/events${query ? `?${query}` : ""}`;

  const current = feed?.url === url ? feed : null;
  const status: ConnectionStatus = current?.status ?? "connecting";
  const freshRoom = current?.room ?? null;
  // Mientras se abre la conexión nueva se sigue mostrando lo último recibido,
  // salvo que venga de un rol: nunca se muestra la vista de una identidad anterior.
  const room = freshRoom ?? (lastRoom?.viewer === "stage" ? lastRoom : null);
  const unreachable = !room && (current?.failures ?? 0) >= 2;

  // Copia de la identidad para las acciones: no depende de que sessionStorage funcione.
  const sessionRef = useRef<RoomSession | null>(session);
  const setSession = useCallback(
    (next: RoomSession | null) => {
      sessionRef.current = next;
      storeSession(roomId, next);
      setSessionState(next);
    },
    [roomId],
  );

  // Flujo de eventos. El navegador reintenta solo ante cortes de red; si el
  // servidor responde con error el EventSource queda cerrado y se reabre aquí
  // con espera creciente (1 s, 2 s, 4 s… hasta 10 s).
  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let stopped = false;
    let latest: ProjectedRoomState | null = null;

    const publish = (next: ConnectionStatus) => setFeed({ url, room: latest, status: next, failures: attempts });

    // Pide la misma URL con fetch solo para leer el código del rechazo (por
    // ejemplo, 503 TOO_MANY_CONNECTIONS) y la corta apenas tiene la respuesta.
    const explainFailure = async () => {
      const controller = new AbortController();
      try {
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!stopped && typeof data.code === "string") setProblem(friendlyError(data.code, typeof data.error === "string" ? data.error : `El servidor respondió ${res.status}`));
      } catch {
        // Sin red: el estado "reconectando" ya lo dice.
      } finally {
        controller.abort();
      }
    };

    const open = () => {
      source = new EventSource(url);
      source.onopen = () => {
        attempts = 0;
        setProblem(null);
        publish("connected");
      };
      source.onmessage = (event) => {
        try {
          latest = JSON.parse(event.data) as ProjectedRoomState;
        } catch {
          return;
        }
        attempts = 0;
        publish("connected");
        setLastRoom(latest);
      };
      source.onerror = () => {
        if (stopped) return;
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          void explainFailure();
          const delay = Math.min(1000 * 2 ** attempts, 10000);
          attempts += 1;
          retryTimer = setTimeout(open, delay);
        }
        publish("reconnecting");
      };
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [url]);

  // Peticiones de rol en curso. En desarrollo React ejecuta los efectos dos veces
  // y la entrada por enlace pedía el mismo rol dos veces: la segunda respondía
  // 409 y mostraba "ese rol ya lo tiene otra persona" a quien sí lo tenía.
  const joining = useRef(new Map<string, Promise<ActResult>>());

  const joinOnce = useCallback(
    async (orgId: string, roleId: string): Promise<ActResult> => {
      const previous = sessionRef.current;
      const sameRole = previous?.orgId === orgId && previous.roleId === roleId;
      // Cambiar de rol libera el anterior para que otra persona pueda tomarlo.
      if (previous && !sameRole) await postAction(roomId, { type: "LEAVE_ROLE", ...previous });
      const result = await postAction(roomId, { type: "JOIN_ROLE", orgId, roleId, ...(sameRole ? { token: previous.token } : {}) });
      if (result.ok && result.data.token) {
        setSession({ orgId, roleId, token: result.data.token });
        setNotice(null);
      } else if (!result.ok) {
        if (previous) setSession(null);
        setNotice(result.code === "ROLE_TAKEN" ? "Ese rol ya lo tiene otra persona. Elige uno libre." : result.error);
      }
      return result;
    },
    [roomId, setSession],
  );

  const join = useCallback(
    (orgId: string, roleId: string): Promise<ActResult> => {
      const key = `${orgId}/${roleId}`;
      const pending = joining.current.get(key);
      if (pending) return pending;
      const request = joinOnce(orgId, roleId).finally(() => joining.current.delete(key));
      joining.current.set(key, request);
      return request;
    },
    [joinOnce],
  );

  const leave = useCallback(async () => {
    const previous = sessionRef.current;
    setSession(null);
    if (previous) await postAction(roomId, { type: "LEAVE_ROLE", ...previous });
  }, [roomId, setSession]);

  const act: Act = useCallback(
    async (type, payload) => {
      const active = sessionRef.current;
      if (!active) return { ok: false, status: 0, code: "NO_ROLE", error: "Primero toma un rol." };
      const result = await postAction(roomId, { ...payload, type, ...active });
      if (!result.ok && result.code === "INVALID_TOKEN") {
        setSession(null);
        setNotice("Tu rol dejó de ser válido (el servidor se reinició o alguien más lo tomó). Vuelve a entrar.");
      }
      return result;
    },
    [roomId, setSession],
  );

  // El servidor entrega la vista "stage" cuando el token no es el vigente (por
  // ejemplo, tras un reinicio). Se intenta recuperar el rol una vez por token.
  const recoveredToken = useRef<string | null>(null);
  const downgraded = !!session && freshRoom?.viewer === "stage";
  useEffect(() => {
    if (!downgraded || !session || recoveredToken.current === session.token) return;
    recoveredToken.current = session.token;
    void join(session.orgId, session.roleId);
  }, [downgraded, session, join]);

  return { room, status, unreachable, problem: status === "connected" ? null : problem, session, notice, setNotice, join, leave, act };
}
