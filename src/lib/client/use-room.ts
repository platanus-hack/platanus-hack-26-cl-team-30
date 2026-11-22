"use client";

// Cliente de una sala de Sculptor para el navegador. Es el único lugar de la interfaz
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

async function postAction(roomId: string, body: Record<string, unknown>, path: "action" | "seat" = "action"): Promise<ActResult> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/${path}`, {
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

/**
 * Si una pestaña que perdió su silla (el token dejó de valer, por ejemplo tras
 * un reinicio) debe recuperarla sola. En una sala de demo no: tras «Nueva ronda»
 * o el reinicio automático, el siguiente grupo tiene que poder sortear sillas,
 * así que los teléfonos viejos vuelven a la tarjeta de sorteo.
 */
export function shouldRecoverSeat(view: Pick<ProjectedRoomState, "demo">): boolean {
  return view.demo !== true;
}

export type CreateRoomOptions = {
  /** Organización semilla (solo single_org). */
  seed?: string;
  /** Escenario entre organizaciones: "hospitales", "construccion", "logistica" (solo cross_org). */
  scenario?: string;
  /** Frase que describe la organización: la sala nace ya mutada (solo single_org). */
  description?: string;
  /** Sala de demo: 3 asientos humanos y bots en los roles administrativos (solo cross_org). */
  demo?: boolean;
};

export type CreatedRoom = { roomId: string; source?: string; latencyMs?: number };

/**
 * POST /api/rooms. Devuelve la sala nueva y guarda en este navegador las
 * credenciales del anfitrión (token de controles y clave del QR del Comité),
 * que el servidor entrega una sola vez.
 */
export async function createRoom(mode: RoomMode, options: CreateRoomOptions = {}): Promise<CreatedRoom> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, ...options }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.roomId !== "string") {
    throw new Error(friendlyError(data.code, typeof data.error === "string" ? data.error : "No se pudo crear la sala"));
  }
  if (typeof data.hostToken === "string" && typeof data.committeeKey === "string") {
    storeHostCredentials(data.roomId, { hostToken: data.hostToken, committeeKey: data.committeeKey });
  }
  return { roomId: data.roomId, source: data.source, latencyMs: data.latencyMs };
}

// --- Anfitrión -----------------------------------------------------------------
// Quien crea la sala recibe un token para los controles de la pantalla grande y la
// clave que va dentro del QR del Comité. Se guardan en localStorage para que la
// pantalla grande los encuentre aunque se abra en otra pestaña del mismo equipo.

export type HostCredentials = { hostToken: string; committeeKey: string };

const hostKey = (roomId: string) => `nexo:${roomId}:host`;

function storeHostCredentials(roomId: string, credentials: HostCredentials): void {
  try {
    window.localStorage.setItem(hostKey(roomId), JSON.stringify(credentials));
  } catch {
    // Almacenamiento bloqueado: la pantalla grande no tendrá controles ni QR del Comité.
  }
}

export function loadHostCredentials(roomId: string): HostCredentials | null {
  try {
    const raw = window.localStorage.getItem(hostKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HostCredentials>;
    return typeof parsed.hostToken === "string" && typeof parsed.committeeKey === "string"
      ? { hostToken: parsed.hostToken, committeeKey: parsed.committeeKey }
      : null;
  } catch {
    return null;
  }
}

/**
 * Pide los controles de una sala fija (POST /api/rooms/:id/host). En desarrollo
 * se entregan; en el deploy hace falta la clave de administración, así que
 * responde null y la pantalla ofrece abrir una sala propia.
 */
export async function claimHostCredentials(roomId: string): Promise<HostCredentials | null> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/host`, { method: "POST" });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.hostToken !== "string" || typeof data.committeeKey !== "string") return null;
    const credentials = { hostToken: data.hostToken, committeeKey: data.committeeKey };
    storeHostCredentials(roomId, credentials);
    return credentials;
  } catch {
    return null;
  }
}

/** Control de la pantalla grande con el token de anfitrión (reiniciar, ensayo automático). */
export async function hostRequest(
  roomId: string,
  credentials: HostCredentials,
  path: "" | "/autopilot",
  method: "POST" | "DELETE",
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "x-host-token": credentials.hostToken },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: friendlyError(data.code, typeof data.error === "string" ? data.error : `El servidor respondió ${res.status}`) };
  } catch {
    return { ok: false, error: "No se pudo llegar al servidor." };
  }
}

/** Controles del narrador sobre la negociación entre agentes (solo con el token de anfitrión). */
export async function negotiationControl(roomId: string, credentials: HostCredentials, action: "pause" | "resume" | "advance"): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/negotiation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-host-token": credentials.hostToken },
      body: JSON.stringify({ action }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: typeof data.error === "string" ? data.error : `El servidor respondió ${res.status}` };
  } catch {
    return { ok: false, error: "No se pudo llegar al servidor." };
  }
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

/**
 * El Comité pide el acta por WhatsApp escribiendo su número (alternativa al botón
 * wa.me). deliverable: si hoy se le puede escribir; si no, hay que escribir «hola»
 * al número de Sculptor y volver a intentar. El número no queda en el navegador.
 */
export async function requestCommitteeSummary(roomId: string, session: RoomSession, phone: string): Promise<{ ok: true; deliverable: boolean } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/committee/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...session, phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.deliverable === "boolean") return { ok: true, deliverable: data.deliverable };
    return { ok: false, error: typeof data.error === "string" ? data.error : `El servidor respondió ${res.status}` };
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
    // Vigilante: el servidor manda la sala al menos cada 15 s. Una conexión que
    // queda abierta pero muda (pasó en un celular durante una grabación) no
    // dispara onerror, así que si no llega nada en 40 s, o si el teléfono vuelve
    // a primer plano tras 20 s sin datos, se cierra y se reabre.
    let lastMessageAt = Date.now();
    const STALE_MS = 40_000;
    const STALE_ON_RETURN_MS = 20_000;

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
        lastMessageAt = Date.now();
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

    const reopen = () => {
      if (stopped) return;
      clearTimeout(retryTimer);
      source?.close();
      publish("reconnecting");
      lastMessageAt = Date.now();
      open();
    };
    const watchdog = setInterval(() => {
      if (Date.now() - lastMessageAt > STALE_MS) reopen();
    }, 5_000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastMessageAt > STALE_ON_RETURN_MS) reopen();
    };
    document.addEventListener("visibilitychange", onVisible);

    open();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      source?.close();
    };
  }, [url]);

  // Peticiones de rol en curso. En desarrollo React ejecuta los efectos dos veces
  // y la entrada por enlace pedía el mismo rol dos veces: la segunda respondía
  // 409 y mostraba "ese rol ya lo tiene otra persona" a quien sí lo tenía.
  const joining = useRef(new Map<string, Promise<ActResult>>());
  /** Último token cuya pérdida ya se atendió (recuperación o cambio de silla). */
  const recoveredToken = useRef<string | null>(null);

  const joinOnce = useCallback(
    async (orgId: string, roleId: string, committeeKey?: string): Promise<ActResult> => {
      const previous = sessionRef.current;
      const sameRole = previous?.orgId === orgId && previous.roleId === roleId;
      // Cambiar de rol libera el anterior para que otra persona pueda tomarlo.
      if (previous && !sameRole) await postAction(roomId, { type: "LEAVE_ROLE", ...previous });
      const result = await postAction(roomId, {
        type: "JOIN_ROLE",
        orgId,
        roleId,
        ...(sameRole ? { token: previous.token } : {}),
        ...(committeeKey ? { committeeKey } : {}),
      });
      if (result.ok && result.data.token) {
        setSession({ orgId, roleId, token: result.data.token });
        setNotice(null);
      } else if (!result.ok) {
        if (previous) setSession(null);
        setNotice(
          result.code === "ROLE_TAKEN"
            ? "Ese rol ya lo tiene otra persona. Elige uno libre."
            : result.code === "COMMITTEE_KEY_REQUIRED"
              ? "Al Comité se entra escaneando el código QR de la pantalla grande."
              : result.error,
        );
      }
      return result;
    },
    [roomId, setSession],
  );

  const join = useCallback(
    (orgId: string, roleId: string, committeeKey?: string): Promise<ActResult> => {
      const key = `${orgId}/${roleId}`;
      const pending = joining.current.get(key);
      if (pending) return pending;
      const request = joinOnce(orgId, roleId, committeeKey).finally(() => joining.current.delete(key));
      joining.current.set(key, request);
      return request;
    },
    [joinOnce],
  );

  // Sorteo de silla (POST /api/rooms/:id/seat): el servidor elige una silla
  // libre al azar. Si ya se tiene una, es «sortear otro rol»: el servidor entrega
  // una distinta y libera la anterior en el mismo paso.
  const joinRandom = useCallback(
    (committeeKey?: string): Promise<ActResult> => {
      const pending = joining.current.get("*");
      if (pending) return pending;
      const previous = sessionRef.current;
      // El servidor revoca el token anterior en este mismo paso y su conexión pasa
      // a la vista "stage": se marca como ya atendido para que la recuperación
      // automática (más abajo) no vuelva a tomar la silla que se acaba de soltar.
      if (previous) recoveredToken.current = previous.token;
      const request = postAction(roomId, { ...(committeeKey ? { committeeKey } : {}), ...(previous ? { current: previous } : {}) }, "seat")
        .then((result) => {
          if (result.ok && result.data.token && result.data.seat) {
            setSession({ ...result.data.seat, token: result.data.token });
            setNotice(null);
          } else if (!result.ok) {
            setNotice(result.code === "NO_FREE_SEAT" ? (previous ? "No queda otra silla libre." : "No quedan sillas libres en esta sala.") : result.error);
          }
          return result;
        })
        .finally(() => joining.current.delete("*"));
      joining.current.set("*", request);
      return request;
    },
    [roomId, setSession],
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
  // ejemplo, tras un reinicio). Se intenta recuperar el rol una vez por token,
  // salvo en una sala de demo: ahí la silla queda libre para el siguiente grupo.
  const downgraded = !!session && freshRoom?.viewer === "stage";
  const recover = freshRoom ? shouldRecoverSeat(freshRoom) : true;
  useEffect(() => {
    if (!downgraded || !session || recoveredToken.current === session.token) return;
    // Con un cambio de silla en curso (sorteo u otro rol), la vista "stage" es la
    // de la silla que se acaba de soltar: recuperarla la volvería a ocupar.
    if (joining.current.size > 0) return;
    recoveredToken.current = session.token;
    if (!recover) {
      // Fuera del efecto: el cambio de sesión vuelve a dibujar la pantalla de sorteo.
      queueMicrotask(() => {
        setSession(null);
        setNotice("Empezó una ronda nueva. Toca «Entrar».");
      });
      return;
    }
    void join(session.orgId, session.roleId);
  }, [downgraded, session, join, recover, setSession]);

  return { room, status, unreachable, problem: status === "connected" ? null : problem, session, notice, setNotice, join, joinRandom, leave, act };
}
