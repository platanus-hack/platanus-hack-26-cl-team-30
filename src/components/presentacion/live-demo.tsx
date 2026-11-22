"use client";

// Lámina «En vivo»: a la izquierda la pantalla grande real de la sala (con su código y
// su QR); a la derecha la galaxia del pitch (public/sculptor/orbital.html) movida por
// los eventos de esa misma sala.
//
// Dónde vive la sala:
// - Sin deploy remoto: en este mismo servidor. La presentación abre la sala con
//   POST /api/rooms y deja las credenciales de anfitrión en localStorage, donde las
//   busca la pantalla grande (mismo dominio), así que sus controles funcionan.
// - Con PRESENTACION_DEMO_URL (por ejemplo https://nexo-og8m.onrender.com): en ese
//   deploy, a través de /api/presentacion/sala. El QR apunta a la dirección pública y
//   los celulares lo pueden escanear aunque la presentación corra en localhost.
//
// De dónde salen los datos de la galaxia: el flujo SSE de la sala en la vista «stage»
// (sin datos reservados). No hay base de datos: las salas viven en la memoria del
// servidor. Cada mensaje actualiza las dos vistas en el mismo segundo.
//
// Teclas en esta lámina: P pausa o reanuda el debate, S adelanta un paso, B abre una
// sala nueva (ronda nueva). Los iframes no se desmontan al cambiar de lámina: si se
// recargaran, los celulares quedarían en una sala vieja.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectedRoomState } from "@/lib/genome/schema";

type OrbitalApi = {
  setStage: (stage: number) => void;
  connectNextNode: () => boolean;
  app: { stage: number; connectedCount: number };
};

type Room = { roomId: string; hostToken: string | null };
type Live = { people: number; phase: string | null; proposed: boolean; sealed: boolean };

const NODES_PER_PERSON = 2;
const MAX_NODES = 10;
const SEATS = 5;
const EMPTY: Live = { people: 0, phase: null, proposed: false, sealed: false };

export function LiveDemo({ active, remote }: { active: boolean; remote: string | null }) {
  const orbital = useRef<HTMLIFrameElement>(null);
  const api = useRef<OrbitalApi | null>(null);
  const zoomed = useRef(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orbitalKey, setOrbitalKey] = useState(0);
  const [ready, setReady] = useState(0);
  const [live, setLive] = useState<Live>(EMPTY);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 1. Abrir la sala (aquí o en el deploy remoto).
  const openRoom = useCallback(async () => {
    setError(null);
    try {
      const res = remote
        ? await fetch("/api/presentacion/sala", { method: "POST" })
        : await fetch("/api/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "cross_org", scenario: "hospitales", demo: true }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.roomId !== "string") throw new Error(typeof data.error === "string" ? data.error : "No se pudo abrir la sala");
      const hostToken = typeof data.hostToken === "string" ? data.hostToken : null;
      // Mismo dominio: la pantalla grande busca aquí sus credenciales (ver use-room.ts).
      if (!remote && hostToken && typeof data.committeeKey === "string") {
        try {
          window.localStorage.setItem(`nexo:${data.roomId}:host`, JSON.stringify({ hostToken, committeeKey: data.committeeKey }));
        } catch {
          // Sin almacenamiento la pantalla grande no tendrá controles; P y S siguen funcionando.
        }
      }
      zoomed.current = false;
      setLive(EMPTY);
      setPaused(false);
      setRoom({ roomId: data.roomId, hostToken });
      setOrbitalKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la sala");
    }
  }, [remote]);

  useEffect(() => {
    const id = window.setTimeout(() => void openRoom(), 0);
    return () => window.clearTimeout(id);
  }, [openRoom]);

  // 2. Escuchar la sala: personas conectadas, fase de la negociación y acta.
  useEffect(() => {
    if (!room) return;
    const id = encodeURIComponent(room.roomId);
    const source = new EventSource(remote ? `/api/presentacion/sala/${id}/events` : `/api/rooms/${id}/events`);
    source.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data) as ProjectedRoomState;
        setLive({
          people: Math.min(SEATS, state.connectedPlayers.length),
          phase: state.negotiation?.phase ?? null,
          proposed: state.allocationStatus === "PROPOSED",
          sealed: state.allocationStatus === "SEALED",
        });
      } catch {
        // Un mensaje que no se puede leer no cambia la galaxia.
      }
    };
    return () => source.close();
  }, [room, remote]);

  // 3. Conectar con la galaxia y esconder sus propios controles, su QR y su etiqueta.
  useEffect(() => {
    api.current = null;
    let tries = 0;
    let timer = 0;
    const poll = () => {
      const win = orbital.current?.contentWindow as (Window & { __ORBITAL__?: OrbitalApi }) | null | undefined;
      const doc = orbital.current?.contentDocument;
      if (win?.__ORBITAL__ && doc) {
        api.current = win.__ORBITAL__;
        for (const id of ["stageControls", "qrDock", "sseTag"]) {
          const el = doc.getElementById(id);
          if (el) el.style.display = "none";
        }
        api.current.setStage(0);
        setReady((r) => r + 1);
      } else if (tries++ < 150) {
        timer = window.setTimeout(poll, 150);
      }
    };
    poll();
    return () => window.clearTimeout(timer);
  }, [orbitalKey]);

  // 4. Traducir la sala a la galaxia.
  useEffect(() => {
    const galaxy = api.current;
    if (!galaxy) return;
    const timers: number[] = [];

    // Ronda nueva en la misma sala: volvió a cero después de un acta. La galaxia empieza de nuevo.
    if (zoomed.current && !live.sealed && live.people === 0) {
      zoomed.current = false;
      timers.push(window.setTimeout(() => setOrbitalKey((k) => k + 1), 0));
      return () => timers.forEach((t) => window.clearTimeout(t));
    }

    // Cada persona enciende dos nodos, de a uno para que se vean llegar.
    const target = Math.min(MAX_NODES, live.people * NODES_PER_PERSON);
    const from = galaxy.app.connectedCount;
    for (let i = from; i < target; i++) timers.push(window.setTimeout(() => galaxy.connectNextNode(), (i - from) * 350));

    // El debate y la propuesta: la red converge. Sin negociación (salas de versiones
    // anteriores) converge cuando el motor propone la asignación.
    if (((live.phase && live.phase !== "positions") || live.proposed) && galaxy.app.stage < 4) galaxy.setStage(4);

    // Acta sellada: red completa y alejamiento hasta la galaxia NGC 253.
    if (live.sealed && !zoomed.current) {
      zoomed.current = true;
      galaxy.setStage(5);
      timers.push(window.setTimeout(() => galaxy.setStage(6), 4000));
      timers.push(window.setTimeout(() => galaxy.setStage(7), 8000));
      timers.push(window.setTimeout(() => galaxy.setStage(8), 12000));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [live, ready]);

  // 5. Controles del narrador desde el teclado de la presentación.
  const control = useCallback(
    async (action: "pause" | "resume" | "advance") => {
      if (!room?.hostToken) {
        setNotice("Esta sala no entregó controles de anfitrión");
        return;
      }
      const id = encodeURIComponent(room.roomId);
      const res = remote
        ? await fetch(`/api/presentacion/sala/${id}/negotiation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, hostToken: room.hostToken }),
          })
        : await fetch(`/api/rooms/${id}/negotiation`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-host-token": room.hostToken },
            body: JSON.stringify({ action }),
          });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (typeof data.paused === "boolean") setPaused(data.paused);
        setNotice(action === "advance" ? "Siguiente paso" : action === "pause" ? "Debate en pausa" : "Debate reanudado");
      } else {
        setNotice(typeof data.error === "string" ? data.error : "El servidor no aceptó el control");
      }
    },
    [room, remote],
  );

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "p") void control(paused ? "resume" : "pause");
      else if (k === "s") void control("advance");
      else if (k === "b") void openRoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, control, openRoom, paused]);

  const stageSrc = room ? `${remote ?? ""}/stage/${encodeURIComponent(room.roomId)}` : null;

  return (
    <div
      className={`absolute inset-x-[3vw] top-0 bottom-2 grid gap-4 md:grid-cols-[1.2fr_1fr] ${active ? "" : "pointer-events-none invisible"}`}
      aria-hidden={!active}
    >
      <figure className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-(--basalto) bg-(--grafito)">
        <figcaption className="flex items-center justify-between gap-3 border-b border-(--basalto) px-4 py-2 font-mono text-xs tracking-[0.14em] text-(--piedra) uppercase">
          <span>
            Pantalla grande · sala {room?.roomId ?? "…"}
            {remote ? ` · ${new URL(remote).host}` : ""}
          </span>
          <span>P pausa · S siguiente · B sala nueva</span>
        </figcaption>
        {stageSrc ? (
          <iframe key={stageSrc} src={stageSrc} title="Pantalla grande de la demo" className="h-full w-full flex-1 bg-(--obsidiana)" />
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            {error ? (
              <div>
                <p className="text-lg text-(--senal)">{error}</p>
                <button type="button" onClick={() => void openRoom()} className="mt-4 rounded-full bg-(--cincel) px-5 py-2 font-bold text-(--obsidiana)">
                  Reintentar
                </button>
              </div>
            ) : (
              <p className="font-mono text-sm tracking-[0.16em] text-(--piedra) uppercase">Abriendo la sala…</p>
            )}
          </div>
        )}
      </figure>
      <figure className="relative flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-(--basalto) bg-black">
        <figcaption className="flex items-center justify-between border-b border-(--basalto) px-4 py-2 font-mono text-xs tracking-[0.14em] text-(--piedra) uppercase">
          <span>Galaxia en vivo</span>
          <span className="text-(--cincel)">
            {live.people} de {SEATS} personas{live.sealed ? " · acta sellada" : paused ? " · en pausa" : ""}
          </span>
        </figcaption>
        <iframe
          key={orbitalKey}
          ref={orbital}
          src="/sculptor/orbital.html"
          title="Galaxia: un nodo por cada persona que entra a la sala"
          className="h-full w-full flex-1"
        />
        {notice && (
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-(--obsidiana)/90 px-4 py-2 font-mono text-xs tracking-[0.14em] text-(--marmol) uppercase">
            {notice}
          </p>
        )}
      </figure>
    </div>
  );
}
