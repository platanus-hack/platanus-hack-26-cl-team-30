"use client";

import { Bot, Check, Circle, TriangleAlert } from "lucide-react";
import { isLocalUrl } from "@/components/nexo/public-url";
import { QrCode } from "@/components/nexo/qr-code";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { SEAT_TONES, type Seat } from "./seats";
import { StorySteps } from "./story-view";

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
  const url = baseUrl ? `${baseUrl}/room/${encodeURIComponent(room.roomId)}` : null;

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
              <li key={seat.id} data-on={seat.connected} style={{ ["--nx-seat" as string]: SEAT_TONES[seat.tone % SEAT_TONES.length][theme] }}>
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
