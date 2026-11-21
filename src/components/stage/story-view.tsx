"use client";

import {
  BellRing,
  Check,
  CircleCheck,
  Clock3,
  Hourglass,
  Lock,
  Star,
  UserRound,
} from "lucide-react";
import { NewRoundButton } from "./command-parts";
import { Ecg } from "./ecg";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { formatClock } from "@/components/organs/format";
import { cn } from "@/lib/utils";
import { deadlineWindow } from "./metrics";
import { isDemoRoom } from "./seats";
import {
  storyCards,
  storyMissing,
  storyProgress,
  storyResource,
} from "./story";

/** Los pasos de la sala, con el actual resaltado. Los comparten «Unirse» y la Historia. */
export function StorySteps({ room }: { room: ProjectedRoomState }) {
  const progress = storyProgress(room);
  return (
    <ol
      className="nx-steps"
      style={{ ["--nx-steps" as string]: progress.steps.length }}
      aria-label={`Paso ${progress.index + 1} de ${progress.steps.length}`}
    >
      {progress.steps.map((step, i) => {
        // Al cerrar la sala, «Acta» es el paso en curso: queda resaltado, no tachado como hecho.
        const state =
          i < progress.index
            ? "done"
            : i === progress.index
              ? "current"
              : "next";
        return (
          <li
            key={step.id}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="nx-step-dot" aria-hidden="true">
              {state === "done" || (state === "current" && progress.done) ? (
                <Check />
              ) : (
                i + 1
              )}
            </span>
            <span className="nx-step-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * «Historia de la decisión»: la vista principal de la pantalla grande, para leer
 * de lejos. Cuatro partes, de arriba abajo: los pasos, el recurso con su plazo,
 * una tarjeta por candidato y una sola frase con lo que falta ahora. Pocas
 * palabras: lo que hay que explicar va detrás de «¿Por qué?».
 */
export function StoryView({
  room,
  onNotify,
  onNewRound,
}: {
  room: ProjectedRoomState;
  onNotify?: () => void;
  onNewRound?: () => Promise<void>;
}) {
  const done = storyProgress(room).done;
  const resource = storyResource(room);
  const cards = storyCards(room);
  const missing = storyMissing(room);
  const window = deadlineWindow(room);
  const bleeding = room.stakes.status === "BLEEDING";
  const elapsed = room.stakes.timeToDecisionMs ?? room.stakes.elapsedMs;

  return (
    <div className="nx-story">
      {/* 1. Pasos */}
      <StorySteps room={room} />

      {/* 2. Recurso, plazo y tiempo */}
      <section className="nx-resource gd-panel" aria-label="Recurso en disputa">
        <p className="nx-resource-name">
          <span className="nx-resource-qty">{resource.quantity}</span>
          <span>{resource.name}</span>
        </p>
        <div className="nx-resource-facts">
          {/* En la demo el plazo no se muestra: lo que importa es cuánto lleva esperando. */}
          {!isDemoRoom(room) && (
            <p>
              <Clock3 aria-hidden="true" />
              <span>
                <small>Plazo</small>
                <strong>
                  {window.remainingMs !== null
                    ? `quedan ${formatClock(window.remainingMs)}`
                    : window.label}
                </strong>
              </span>
            </p>
          )}
          <p className="nx-elapsed" data-state={bleeding ? "block" : "calm"}>
            {bleeding ? (
              <Hourglass aria-hidden="true" />
            ) : (
              <CircleCheck aria-hidden="true" />
            )}
            <span>
              <small>{bleeding ? "Esperando" : "Decidido en"}</small>
              <strong>{formatClock(elapsed)}</strong>
            </span>
          </p>
        </div>
        {/* Pulso rojo mientras se espera; línea verde y plana cuando se decidió. */}
        <Ecg calm={!bleeding} />
      </section>

      {/* 3. Candidatos */}
      <section className="nx-cards" aria-label="Candidatos">
        {cards.map((card) => (
          <article
            key={card.id}
            className={cn(
              "nx-card gd-panel",
              card.proposed && "is-proposed",
              card.winner && "is-winner",
            )}
          >
            <header>
              <p className="nx-card-org">{card.org}</p>
              {card.proposed && (
                <span className="nx-star">
                  <Star aria-hidden="true" />
                </span>
              )}
            </header>
            <p className="nx-card-title">{card.title}</p>
            {card.score === null && room.allocation ? (
              // Sin caso todavía no hay puntaje: se dice qué falta, no un guion.
              <p className="nx-card-waiting">
                <Hourglass aria-hidden="true" /> Esperando caso
              </p>
            ) : (
              <p className="nx-card-score">
                {card.score ?? "—"}
                <small>{room.allocation ? "puntaje" : "propuesto"}</small>
              </p>
            )}
            <div className="nx-card-row">
              {!(card.score === null && room.allocation) && (
                <p className="nx-state" data-state={card.state.tone}>
                  {card.state.text}
                </p>
              )}
              {card.note && <p className="nx-card-note">{card.note}</p>}
              {card.why && (
                <details className="nx-why">
                  <summary>¿Por qué?</summary>
                  <p>{card.why}</p>
                </details>
              )}
            </div>
            {card.locked.length > 0 && (
              <ul className="nx-locked" aria-label="Datos reservados">
                {card.locked.map((label) => (
                  <li key={label}>
                    <Lock aria-hidden="true" />
                    <span>{label}</span>
                    {/* El valor nunca llega a esta pantalla: en su lugar va una barra tachada. */}
                    <i aria-hidden="true" />
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>

      {/* 4. Lo que falta */}
      <section
        className="nx-missing gd-panel"
        data-lead={missing.lead}
        aria-live="polite"
        aria-label="Lo que falta ahora"
      >
        <p className="nx-missing-text">
          <b>{missing.lead}:</b> {missing.text}
        </p>
        <div className="nx-missing-who">
          <p>
            <UserRound aria-hidden="true" />
            <span>{missing.who}</span>
            {missing.whoConnected !== null && (
              <span
                className="nx-state"
                data-state={missing.whoConnected ? "calm" : "plain"}
              >
                {missing.whoConnected ? "conectado" : "sin entrar"}
              </span>
            )}
          </p>
          {onNewRound && done && <NewRoundButton onNewRound={onNewRound} />}
          {onNotify && room.allocation?.status === "PROPOSED" && (
            <button type="button" className="gd-secondary" onClick={onNotify}>
              <BellRing aria-hidden="true" /> Avisar al Comité
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
