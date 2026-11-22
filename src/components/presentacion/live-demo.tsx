"use client";

// Lámina «En vivo»: a la izquierda la pantalla grande real (/stage/demo-cross, que
// crea la sala con su QR); a la derecha la galaxia del pitch (public/sculptor/orbital.html)
// movida por los eventos de esa misma sala.
//
// De dónde salen los datos: el flujo SSE de la sala (GET /api/rooms/:id/events, vista
// «stage», sin datos reservados). No hay base de datos: las salas viven en la memoria
// del servidor. Por cada persona conectada se encienden dos nodos; con el debate la red
// converge; al sellarse el acta la galaxia se aleja hasta NGC 253.
//
// Los dos iframes se montan la primera vez que se llega a esta lámina y no se desmontan:
// si se recargaran, la pantalla grande abriría otra sala y los celulares quedarían fuera.

import { useEffect, useRef, useState } from "react";
import type { ProjectedRoomState } from "@/lib/genome/schema";

type OrbitalApi = {
  setStage: (stage: number) => void;
  connectNextNode: () => boolean;
  app: { stage: number; connectedCount: number };
};

type Live = { roomId: string | null; people: number; phase: string | null; sealed: boolean };

const NODES_PER_PERSON = 2;
const MAX_NODES = 10;
const SEATS = 5;

export function LiveDemo({ active }: { active: boolean }) {
  const stage = useRef<HTMLIFrameElement>(null);
  const orbital = useRef<HTMLIFrameElement>(null);
  const api = useRef<OrbitalApi | null>(null);
  const zoomed = useRef(false);
  const [orbitalKey, setOrbitalKey] = useState(0);
  const [ready, setReady] = useState(0);
  const [live, setLive] = useState<Live>({ roomId: null, people: 0, phase: null, sealed: false });

  // 1. Saber qué sala abrió la pantalla grande: su URL pasa de /stage/demo-cross a /stage/<código>.
  useEffect(() => {
    let tries = 0;
    const id = window.setInterval(() => {
      tries++;
      let path = "";
      try {
        path = stage.current?.contentWindow?.location.pathname ?? "";
      } catch {
        return;
      }
      const match = path.match(/^\/stage\/([^/]+)$/);
      if (!match) return;
      const room = decodeURIComponent(match[1]);
      // Si a los ~8 s sigue en demo-cross, la pantalla grande se quedó con la sala fija (sin red o sin cupo).
      if (room !== "demo-cross" || tries > 16) {
        setLive((l) => (l.roomId === room ? l : { ...l, roomId: room }));
      }
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  // 2. Escuchar la sala: personas conectadas, fase de la negociación y acta.
  useEffect(() => {
    if (!live.roomId) return;
    const source = new EventSource(`/api/rooms/${encodeURIComponent(live.roomId)}/events`);
    source.onmessage = (event) => {
      try {
        const room = JSON.parse(event.data) as ProjectedRoomState;
        setLive((l) => ({
          ...l,
          people: Math.min(SEATS, room.connectedPlayers.length),
          phase: room.negotiation?.phase ?? null,
          sealed: room.allocationStatus === "SEALED",
        }));
      } catch {
        // Un mensaje que no se puede leer no cambia la galaxia.
      }
    };
    return () => source.close();
  }, [live.roomId]);

  // 3. Conectar con la galaxia y esconder sus propios controles, su QR y su etiqueta.
  useEffect(() => {
    api.current = null;
    zoomed.current = false;
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

    // Ronda nueva: la sala volvió a cero después de un acta. La galaxia empieza de nuevo.
    if (zoomed.current && !live.sealed && live.people === 0) {
      setTimeout(() => setOrbitalKey((k) => k + 1), 0);
      return;
    }

    // Cada persona enciende dos nodos, de a uno para que se vean llegar.
    const target = Math.min(MAX_NODES, live.people * NODES_PER_PERSON);
    for (let i = galaxy.app.connectedCount; i < target; i++) {
      timers.push(window.setTimeout(() => galaxy.connectNextNode(), (i - galaxy.app.connectedCount) * 350));
    }

    // El debate y la propuesta: la red converge.
    if (live.phase && live.phase !== "positions" && galaxy.app.stage < 4) galaxy.setStage(4);

    // Acta sellada: red completa y alejamiento hasta la galaxia NGC 253.
    if (live.sealed && !zoomed.current) {
      zoomed.current = true;
      galaxy.setStage(5);
      timers.push(window.setTimeout(() => galaxy.setStage(6), 4000));
      timers.push(window.setTimeout(() => galaxy.setStage(7), 8000));
      timers.push(window.setTimeout(() => galaxy.setStage(8), 12000));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [live.people, live.phase, live.sealed, orbitalKey, ready]);

  return (
    <div
      className={`absolute inset-x-[3vw] top-0 bottom-2 grid gap-4 md:grid-cols-[1.2fr_1fr] ${active ? "" : "pointer-events-none invisible"}`}
      aria-hidden={!active}
    >
      <figure className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-(--basalto) bg-(--grafito)">
        <figcaption className="flex items-center justify-between border-b border-(--basalto) px-4 py-2 font-mono text-xs tracking-[0.14em] text-(--piedra) uppercase">
          <span>Pantalla grande · sala {live.roomId && live.roomId !== "demo-cross" ? live.roomId : "…"}</span>
          <span>Clic aquí para usar espacio y →</span>
        </figcaption>
        <iframe ref={stage} src="/stage/demo-cross" title="Pantalla grande de la demo" className="h-full w-full flex-1 bg-(--obsidiana)" />
      </figure>
      <figure className="relative flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-(--basalto) bg-black">
        <figcaption className="flex items-center justify-between border-b border-(--basalto) px-4 py-2 font-mono text-xs tracking-[0.14em] text-(--piedra) uppercase">
          <span>Galaxia en vivo</span>
          <span className="text-(--cincel)">
            {live.people} de {SEATS} personas{live.sealed ? " · acta sellada" : ""}
          </span>
        </figcaption>
        <iframe
          key={orbitalKey}
          ref={orbital}
          src="/sculptor/orbital.html"
          title="Galaxia: un nodo por cada persona que entra a la sala"
          className="h-full w-full flex-1"
        />
      </figure>
    </div>
  );
}
