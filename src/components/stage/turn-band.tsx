"use client";

// Franja del turno de la demo pauteada: la pantalla grande le habla a una sola
// persona por su rol («Clínica: presenta a tu paciente») mientras el narrador lo
// dice en voz alta. Los jurados no leen: escuchan y aprietan. La cuenta regresiva
// es la del plan B del servidor (al llegar a 0, el servidor juega ese turno solo);
// se cuenta hacia abajo aquí desde el último dato recibido. Sin plan B no se muestra.

import { useEffect, useState } from "react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { JoinQr } from "./join-view";
import { freeHumanSeat, type DemoTurn } from "./story";

function useCountdown(turn: DemoTurn | null): { left: number; fraction: number } | null {
  const key = turn ? `${turn.seatId}:${turn.text}` : "";
  const running = !!turn && !turn.scan;
  const server = turn?.remainingMs ?? null;
  const total = turn?.totalMs ?? 0;
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  // Cada turno nuevo (o cada dato del servidor) fija el momento en que se acaba.
  useEffect(() => {
    queueMicrotask(() => {
      setNow(Date.now());
      setDeadline(running && total > 0 ? Date.now() + (server ?? total) : null);
    });
  }, [key, running, server, total]);

  useEffect(() => {
    if (deadline === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (deadline === null || !total) return null;
  const ms = Math.max(0, deadline - now);
  return { left: Math.ceil(ms / 1000), fraction: Math.min(1, ms / total) };
}

export function TurnBand({ room, turn, baseUrl }: { room: ProjectedRoomState; turn: DemoTurn; baseUrl: string | null }) {
  const countdown = useCountdown(turn);
  // Mientras quede una silla libre (y no sea esta la que falta), el código sigue a la vista, chico.
  const spare = !turn.scan && !!baseUrl && freeHumanSeat(room);
  return (
    <section className="nx-turn gd-panel" data-scan={turn.scan} aria-live="assertive" aria-label="Turno">
      <p className="nx-turn-text">
        <b>{turn.who}:</b> {turn.text}
      </p>
      <div className="nx-turn-side">
        {turn.scan && baseUrl ? (
          <JoinQr room={room} baseUrl={baseUrl} label="Escanea aquí" size={150} className="nx-qr-band" />
        ) : (
          countdown && (
            <p className="nx-turn-clock" data-late={countdown.left <= 5} style={{ ["--nx-left" as string]: countdown.fraction }} aria-label={`Quedan ${countdown.left} segundos`}>
              <span>{countdown.left}</span>
            </p>
          )
        )}
        {spare && <JoinQr room={room} baseUrl={baseUrl!} label="¿Falta alguien? Escanea" size={96} className="nx-qr-corner" />}
      </div>
    </section>
  );
}
