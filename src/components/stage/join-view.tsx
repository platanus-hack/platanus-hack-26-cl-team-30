"use client";

import { Check, Circle, TriangleAlert } from "lucide-react";
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
  const connected = seats.filter((seat) => seat.connected).length;
  const full = seats.length > 0 && connected === seats.length;
  const url = baseUrl ? `${baseUrl}/room/${encodeURIComponent(room.roomId)}` : null;

  return (
    <div className="nx-story nx-join">
      <StorySteps room={room} />
      <div className="nx-join-grid">
        <section className="nx-join-count" aria-label="Personas conectadas">
          <p className="nx-join-number" data-full={full} aria-live="polite">
            <span>{connected}</span>/{seats.length}
            <small>conectados</small>
          </p>
          <ul className="nx-seats">
            {seats.map((seat) => (
              <li key={seat.id} data-on={seat.connected} style={{ ["--nx-seat" as string]: SEAT_TONES[seat.tone % SEAT_TONES.length][theme] }}>
                <i aria-hidden="true" />
                <span>{seat.label}</span>
                {seat.connected ? <Check aria-label="Conectado" /> : <Circle aria-label="Libre" />}
              </li>
            ))}
          </ul>
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
