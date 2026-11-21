"use client";

import { Bot, Check, Circle, TriangleAlert } from "lucide-react";
import { isLocalUrl } from "@/components/nexo/public-url";
import { QrCode } from "@/components/nexo/qr-code";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { SEAT_TONES, type Seat } from "./seats";
import { demoTurn } from "./story";
import { StorySteps } from "./story-view";

/** Dirección que abre el código para entrar: el sorteo de silla de la sala. */
export const joinUrl = (baseUrl: string, roomId: string) => `${baseUrl}/room/${encodeURIComponent(roomId)}`;

/**
 * Código para entrar, pequeño, con una frase corta. En la demo sigue a la vista
 * en Casos y Comité mientras quede una silla de persona libre.
 */
export function JoinQr({ room, baseUrl, label, size = 112, className = "" }: { room: ProjectedRoomState; baseUrl: string; label: string; size?: number; className?: string }) {
  const url = joinUrl(baseUrl, room.roomId);
  return (
    <figure className={`nx-qr-mini ${className}`}>
      <QrCode url={url} label="Código para entrar a la sala" size={size} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/**
 * Paso «Unirse» de la pantalla grande. La galaxia va al centro (la dibuja el
 * canvas del centro de mando, detrás de esta vista); a la izquierda, el contador
 * y los asientos; a la derecha, el código para entrar. Todo sale de los asientos
 * reales que llegan por el SSE: nadie aparece conectado sin estarlo.
 */
export function JoinView({ room, seats, theme, baseUrl }: { room: ProjectedRoomState; seats: Seat[]; theme: "dark" | "light"; baseUrl: string | null }) {
  // Se cuentan solo las personas: los asientos automáticos no necesitan a nadie.
  const people = seats.filter((seat) => seat.human);
  const bots = seats.filter((seat) => !seat.human);
  const connected = people.filter((seat) => seat.connected).length;
  const full = people.length > 0 && connected === people.length;
  const turn = demoTurn(room);
  const url = baseUrl ? joinUrl(baseUrl, room.roomId) : null;

  return (
    <div className="nx-story nx-join">
      <StorySteps room={room} />
      <div className="nx-join-grid">
        <section className="nx-join-count" aria-label="Personas conectadas">
          <p className="nx-join-number" data-full={full} aria-live="polite">
            <span>{connected}</span>/{people.length}
            <small>conectados</small>
          </p>
          <ul className="nx-seats" data-big={bots.length > 0}>
            {people.map((seat) => (
              <li key={seat.id} data-on={seat.connected} data-turn={turn?.seatId === seat.id || undefined} style={{ ["--nx-seat" as string]: SEAT_TONES[seat.tone % SEAT_TONES.length][theme] }}>
                <i aria-hidden="true" />
                <span>{bots.length > 0 ? seat.short : seat.label}</span>
                {seat.connected ? <Check aria-label="Conectado" /> : <Circle aria-label="Libre" />}
              </li>
            ))}
          </ul>
          {bots.length > 0 && (
            <ul className="nx-bots" aria-label="Asientos automáticos">
              {bots.map((seat) => (
                <li key={seat.id}>
                  <span>{seat.short}</span>
                  <b>
                    <Bot aria-hidden="true" /> automático
                  </b>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* El centro queda libre: ahí se ve la galaxia. */}
        <div className="nx-join-space" aria-hidden="true" />

        {url && (
          <section className="nx-join-qr gd-panel" aria-label="Código para entrar">
            <QrCode url={url} label="Código para entrar a la sala" size={300} className="nx-join-code" />
            <p className="nx-join-url">{url.replace(/^https?:\/\//, "")}</p>
            {isLocalUrl(url) && (
              <p className="nx-warn" role="alert">
                <TriangleAlert aria-hidden="true" width={16} height={16} />
                Código local: un teléfono no lo abre.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
