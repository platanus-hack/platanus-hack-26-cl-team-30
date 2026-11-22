"use client";

// Pantalla grande de la demo con negociación entre agentes (ronda 20). Pasos:
// Unirse (código de sala gigante, código QR y los 5 asientos), Posturas (cada
// asiento se ilumina al dar la suya), Debate (los agentes conversan a la vista, de
// a un mensaje), Propuesta (la tarjeta del motor emerge de la conversación),
// Comité y Acta. Solo texto, sin audio.
//
// La IA escribe y el código decide: los mensajes llegan ya revisados desde el
// servidor (docs/DECISIONES.md, «Negociación entre agentes»); la propuesta y los
// puntajes son del motor (`allocation`). Esta vista solo dibuja lo que trae el SSE.

import { useEffect, useRef, useState } from "react";
import { Bot, Check, CircleCheck, Lock, Pause, Play, SkipForward, Star } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { NewRoundButton } from "./command-parts";
import { JoinQr } from "./join-view";
import { debateMessages, lockedFields, peopleCount, progressWindow, proposalMessage, roomCode, seatColor, seatOf, seatParts, stageStep, scorePoints, STAGE_STEPS, type Negotiation, type StageStep } from "./negotiation";
import { negotiationStyles } from "./negotiation-styles";
import { stageSeats, type Seat } from "./seats";
import { storyMissing, type DemoTurn } from "./story";
import { TurnBand } from "./turn-band";

type Theme = "dark" | "light";

/**
 * La propuesta llegó: el motor ya ordenó los casos (`allocation` en PROPOSED o SEALED,
 * con `ranking`). No depende del texto del mensaje: la tarjeta sale de los números.
 */
const proposalReady = (room: ProjectedRoomState) => !!room.allocation && room.allocation.status !== "PENDING" && room.allocation.ranking.length > 0;
export type NarratorAction = "pause" | "resume" | "advance";

const tone = (seat: Seat | undefined, theme: Theme) => ({ ["--nx-seat" as string]: seatColor(seat, theme) });
/** Las sillas de persona, en su orden de llegada. */
const peopleOf = (room: ProjectedRoomState) =>
  stageSeats(room)
    .filter((seat) => seat.human)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

function Steps({ step }: { step: StageStep }) {
  const index = STAGE_STEPS.findIndex((entry) => entry.id === step);
  return (
    <ol className="nx-steps" style={{ ["--nx-steps" as string]: STAGE_STEPS.length }} aria-label={`Paso ${index + 1} de ${STAGE_STEPS.length}`}>
      {STAGE_STEPS.map((entry, i) => {
        const current = i === index;
        const done = i < index;
        return (
          <li key={entry.id} data-state={current ? "current" : done ? "done" : "next"} aria-current={current ? "step" : undefined}>
            <span className="nx-step-dot" aria-hidden="true">
              {done || (current && entry.id === "done") ? <Check /> : i + 1}
            </span>
            <span className="nx-step-label">{entry.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Los 5 asientos, cada uno con su color. Al unirse se enciende quien entró; en
 * Posturas, quien ya dio la suya (y se lee cuál). Un asiento sin persona lo juega
 * un bot y queda marcado como automático.
 */
function SeatTiles({ room, negotiation, theme, mode }: { room: ProjectedRoomState; negotiation: Negotiation; theme: Theme; mode: "join" | "positions" | "rail" }) {
  const positions = new Map(negotiation.positions.map((entry) => [`${entry.orgId}/${entry.roleId}`, entry]));
  return (
    <ul className="nx-ng-seats" data-mode={mode}>
      {peopleOf(room).map((seat) => {
        const { org, role } = seatParts(seat.short);
        const entry = positions.get(seat.id);
        const automatic = seat.bot || !!entry?.automatic;
        const decides = seat.kind === "arbiter";
        const lit = mode === "join" ? seat.connected : decides ? negotiation.phase !== "positions" : !!entry?.position;
        const line =
          mode === "join"
            ? seat.connected
              ? automatic
                ? "Automático"
                : "Conectado"
              : "Libre"
            : decides
              ? "Decide al final"
              : (entry?.position ?? "Pensando su postura");
        return (
          <li key={seat.id} data-on={lit} data-decides={decides || undefined} style={tone(seat, theme)}>
            <span className="nx-ng-seat-who">
              {(org || mode !== "rail") && (
                <small>
                  {mode !== "rail" && <i aria-hidden="true" />}
                  {org}
                </small>
              )}
              <b>{role}</b>
            </span>
            <span className="nx-ng-seat-line">
              {lit && !automatic && mode !== "rail" && <Check aria-hidden="true" />}
              {line}
            </span>
            {automatic && mode !== "join" && (
              <span className="nx-ng-auto">
                <Bot aria-hidden="true" /> automático
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Conversación entre los agentes: de a un mensaje, grandes, con el «escribiendo…» de quien sigue. */
function Debate({ room, negotiation, theme, calculating = false }: { room: ProjectedRoomState; negotiation: Negotiation; theme: Theme; calculating?: boolean }) {
  const messages = debateMessages(negotiation);
  // Cabe lo que se lee de lejos: los últimos tres mensajes.
  const visible = messages.slice(-3);
  const firstOrg = room.orgs[0]?.orgId;
  // Quien escribe es un agente con asiento; si no tiene (la regla), es el código calculando la propuesta.
  const typingSeat = negotiation.typing ? seatOf(room, negotiation.typing.orgId, negotiation.typing.roleId) : undefined;
  const agentTyping = !!negotiation.typing && !!typingSeat && !calculating;
  return (
    <ol className="nx-chat" aria-live="polite" aria-label="Conversación entre los agentes">
      {visible.length === 0 && !negotiation.typing && <li className="nx-chat-empty">Los agentes están por empezar.</li>}
      {visible.map((message, index) => {
        const seat = seatOf(room, message.orgId, message.roleId);
        const side = message.kind === "system" ? "center" : message.orgId === firstOrg ? "left" : "right";
        return (
          <li key={message.id} className="nx-msg" data-side={side} data-last={index === visible.length - 1} style={tone(seat, theme)}>
            {message.kind !== "system" && (
              <span className="nx-msg-who">
                <i aria-hidden="true" /> {message.agentLabel}
              </span>
            )}
            <p className="nx-msg-text">{message.text}</p>
          </li>
        );
      })}
      {agentTyping && negotiation.typing && (
        <li className="nx-msg nx-typing" data-side={negotiation.typing.orgId === firstOrg ? "left" : "right"} style={tone(typingSeat, theme)}>
          <span className="nx-msg-who">
            <i aria-hidden="true" /> {negotiation.typing.agentLabel}
          </span>
          <p className="nx-msg-text">
            <span className="nx-dots" aria-hidden="true">
              <b />
              <b />
              <b />
            </span>
            <span className="nx-typing-word">escribiendo…</span>
          </p>
        </li>
      )}
      {calculating && (
        <li className="nx-msg nx-typing nx-calculating" data-side="center">
          <span className="nx-msg-who">Regla de asignación · código</span>
          <p className="nx-msg-text">
            <span className="nx-dots" aria-hidden="true">
              <b />
              <b />
              <b />
            </span>
            <span className="nx-typing-word">Calculando la propuesta…</span>
          </p>
        </li>
      )}
    </ol>
  );
}

/**
 * La propuesta: sale del motor determinista, no de los agentes. Quién recibe el
 * recurso, la etiqueta pública de cada caso y su puntaje compuesto en la escala 1 a 50.
 * La gravedad de cada caso es reservada: aquí solo aparece su nombre, con candado.
 */
function Proposal({ room, negotiation }: { room: ProjectedRoomState; negotiation: Negotiation }) {
  const allocation = room.allocation;
  const scarcity = room.scarcity;
  if (!allocation || !scarcity || allocation.ranking.length === 0) return null;
  const sealed = allocation.status === "SEALED";
  const orgName = (orgId: string, roleId?: string) => {
    const seat = stageSeats(room).find((entry) => entry.id === `${orgId}/${roleId}`);
    return seat ? seatParts(seat.short).org || seat.short : (room.orgs.find((org) => org.orgId === orgId)?.orgName ?? orgId);
  };
  const rows = allocation.ranking.map((entry) => {
    const candidate = scarcity.candidates.find((item) => item.caseId === entry.caseId);
    return { entry, candidate, org: orgName(entry.orgId, candidate?.proposerRoleId), winner: entry.caseId === allocation.winnerCaseId };
  });
  const winner = rows.find((row) => row.winner);
  const text = proposalMessage(negotiation)?.text;
  const resource = scarcity.resource.replace(/\s*\(.*\)\s*$/, "");
  // Cerrada el acta, la tarjeta dice qué decidió el Comité y por qué (la frase de arriba ya dice quién recibe).
  const decision = sealed ? room.decisions.findLast((entry) => entry.scope === "allocation") : undefined;
  const kicker = !sealed ? "Propuesta de la regla" : !decision ? "Decisión firmada" : decision.decision === "VETO" ? "El Comité rechazó la propuesta" : "El Comité aceptó la propuesta";
  const title = decision ? `«${decision.reason}»` : winner ? `${winner.org} ${sealed ? "recibe" : "recibiría"} el recurso` : (text ?? "Sin propuesta todavía");
  // Si nadie decidió a tiempo y lo hizo el plan B, se dice: nunca pasa por decisión de una persona.
  const note = !sealed ? "La calculó el código, no un agente." : decision?.automatic ? "Decisión automática: nadie decidió a tiempo." : "La firmó una persona.";
  return (
    <section className="nx-proposal gd-panel" data-sealed={sealed} aria-live="polite" aria-label={kicker}>
      <header>
        <p className="nx-proposal-kicker">{kicker}</p>
        <h2 className="nx-proposal-title" data-quote={!!decision}>
          {title}
        </h2>
        <p className="nx-proposal-note">
          {resource}. {note}
        </p>
      </header>
      <ul className="nx-proposal-list">
        {rows.map(({ entry, candidate, org, winner: first }) => (
          <li key={entry.caseId} data-winner={first}>
            <span className="nx-proposal-org">
              {first && <Star aria-label={sealed ? "Recibe el recurso" : "Propuesto"} />}
              {org}
            </span>
            {candidate && <span className="nx-proposal-case">{candidate.patientLabel}</span>}
            <span className="nx-proposal-score" aria-label={`Puntaje ${scorePoints(entry.score)} de 50`}>
              {scorePoints(entry.score)}
              <small>/50</small>
            </span>
            {/* Lo reservado de cada organización no llega a esta pantalla: solo su nombre, con candado. */}
            <span className="nx-proposal-locks">
              {/* El costo nunca viaja a esta pantalla; va primero, como en las tarjetas de la otra demo. */}
              {["Costo", ...lockedFields(room, entry.orgId)].slice(0, 2).map((label) => (
                <span key={label} className="nx-proposal-lock">
                  <Lock aria-hidden="true" /> {label}
                  <span className="sr-only"> reservado</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Controles del narrador: pausa o reanudar, siguiente, y la barra del tiempo que
 * falta para el próximo mensaje. Los botones solo los ve quien abrió la sala (el
 * anfitrión); la barra, todos. Atajos: espacio (pausa) y flecha derecha (siguiente).
 */
function NarratorBar({ room, negotiation, onControl }: { room: ProjectedRoomState; negotiation: Negotiation; onControl?: (action: NarratorAction) => void }) {
  const fill = useRef<HTMLSpanElement>(null);
  const seen = useRef<{ nextAt: number; at: number } | null>(null);
  const { nextAt, paused, stepMs } = negotiation;

  useEffect(() => {
    const element = fill.current;
    if (!element) return;
    // Desfase entre el reloj del servidor y el de este navegador, para que la barra calce.
    const offset = room.serverNowTs - Date.now();
    if (nextAt === null) {
      // En pausa la barra se queda donde estaba; esperando a una persona, vacía.
      if (!paused) element.style.transform = "scaleX(0)";
      return;
    }
    if (seen.current?.nextAt !== nextAt) seen.current = { nextAt, at: room.serverNowTs };
    const { start, total } = progressWindow(nextAt, seen.current.at, stepMs);
    let frame = 0;
    const tick = () => {
      const fraction = Math.max(0, Math.min(1, (Date.now() + offset - start) / total));
      element.style.transform = `scaleX(${fraction})`;
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [room.serverNowTs, nextAt, paused, stepMs]);

  useEffect(() => {
    if (!onControl) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [contenteditable], [role='dialog']")) return;
      if (event.key === " ") {
        event.preventDefault();
        onControl(paused ? "resume" : "pause");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onControl("advance");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onControl, paused]);

  const waiting = nextAt === null && !paused;
  return (
    <div className="nx-narrator" role="group" aria-label="Controles del narrador">
      {onControl && (
        <>
          <button type="button" className="nx-narrator-btn" onClick={() => onControl(paused ? "resume" : "pause")} title="Espacio">
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {paused ? "Reanudar" : "Pausa"}
          </button>
          <button type="button" className="nx-narrator-btn" onClick={() => onControl("advance")} title="Flecha derecha">
            <SkipForward aria-hidden="true" />
            Siguiente
          </button>
        </>
      )}
      <span className="nx-narrator-track" data-paused={paused} aria-hidden="true">
        <span ref={fill} className="nx-narrator-fill" />
      </span>
      <span className="nx-narrator-state" aria-live="polite">
        {paused ? "En pausa" : waiting ? "Esperando" : negotiation.phase === "positions" ? "Plazo para las posturas" : "Próximo mensaje"}
      </span>
    </div>
  );
}

/**
 * Contador grande de personas: «3/5», y «· 2 automáticos» si el piloto ya tomó
 * asientos. Los bots nunca suman como personas (peopleCount).
 */
function PeopleCount({ room, compact = false }: { room: ProjectedRoomState; compact?: boolean }) {
  const { people, bots, total } = peopleCount(room);
  return (
    <p className="nx-ng-count" data-compact={compact || undefined} aria-live="polite" aria-label={`${people} de ${total} personas${bots ? `, ${bots} ${bots === 1 ? "asiento automático" : "asientos automáticos"}` : ""}`}>
      <b className="nx-ng-tally">
        {people}/{total}
      </b>
      <span>
        {people === 1 ? "persona" : "personas"}
        {bots > 0 && (
          <span className="nx-ng-bots">
            {" "}
            · <Bot aria-hidden="true" /> {bots} {bots === 1 ? "automático" : "automáticos"}
          </span>
        )}
      </span>
    </p>
  );
}

/**
 * «Iniciar» del narrador, en el paso Unirse: los asientos libres los toma un bot
 * del piloto automático y la negociación arranca. No pide clave: el servidor solo
 * lo acepta mientras nadie dio su postura (POST /api/rooms/:id/start).
 */
function StartButton({ onStart }: { room: ProjectedRoomState; onStart: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="nx-ng-start">
      <button
        type="button"
        className="gd-primary nx-ng-start-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onStart();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Play aria-hidden="true" /> {busy ? "Iniciando…" : "Iniciar"}
      </button>
    </div>
  );
}

/** Turno del Comité, para la franja grande: la cuenta regresiva es la del plan B del servidor. */
function committeeTurn(room: ProjectedRoomState): DemoTurn | null {
  const arbiter = room.scarcity?.arbiter;
  if (!arbiter) return null;
  const seat = seatOf(room, arbiter.orgId, arbiter.roleId);
  const server = room.turn && room.turn.orgId === arbiter.orgId && room.turn.roleId === arbiter.roleId ? room.turn : null;
  const scan = !seat?.connected;
  return {
    seatId: `${arbiter.orgId}/${arbiter.roleId}`,
    order: seat?.order ?? 5,
    who: "Comité",
    text: scan ? "escanea el QR" : "¿aceptas o rechazas?",
    scan,
    remainingMs: scan ? null : (server?.remainingMs ?? null),
    totalMs: scan ? 0 : (server?.totalMs ?? 0),
  };
}

export function NegotiationView({
  room,
  negotiation,
  theme,
  baseUrl,
  onControl,
  onNewDemo,
  onStart,
}: {
  room: ProjectedRoomState;
  negotiation: Negotiation;
  theme: Theme;
  baseUrl: string | null;
  /** Solo el anfitrión: pausa, reanudar y siguiente. */
  onControl?: (action: NarratorAction) => void;
  /** Abre una sala nueva, con código nuevo. */
  onNewDemo?: () => Promise<void>;
  /** «Iniciar» en el paso Unirse: llena con bots los asientos libres y arranca. Lo ve cualquiera en la demo. */
  onStart?: () => Promise<void>;
}) {
  const step = stageStep(room, negotiation);
  const people = peopleOf(room);
  const freeSeat = people.some((seat) => !seat.connected);
  const code = roomCode(room);
  const turn = step === "decision" ? committeeTurn(room) : null;
  const missing = storyMissing(room);

  return (
    <div className="nx-story nx-ng" data-step={step}>
      <style>{negotiationStyles}</style>
      <Steps step={step} />

      {step === "join" && (
        <>
          <div className="nx-ng-join">
            <section aria-label="Código de la sala">
              <p className="nx-ng-label">Código de la sala</p>
              <p className="nx-ng-code" aria-label={code.split("").join(" ")}>
                {code}
              </p>
              <PeopleCount room={room} />
              {onStart && <StartButton room={room} onStart={onStart} />}
            </section>
            {baseUrl && <JoinQr room={room} baseUrl={baseUrl} label="Escanea y entra" size={280} className="nx-ng-qr gd-panel" />}
          </div>
          <SeatTiles room={room} negotiation={negotiation} theme={theme} mode="join" />
        </>
      )}

      {step === "positions" && (
        <>
          <header className="nx-ng-head">
            <div>
              <h2 className="nx-ng-title">Cada persona da su postura.</h2>
              <PeopleCount room={room} compact />
            </div>
            {freeSeat && baseUrl && (
              <div className="nx-ng-late">
                <p className="nx-ng-code" data-small="true" aria-label={`Código de la sala: ${code.split("").join(" ")}`}>
                  {code}
                </p>
                <JoinQr room={room} baseUrl={baseUrl} label="¿Falta alguien? Escanea" size={104} className="nx-qr-corner" />
              </div>
            )}
          </header>
          <SeatTiles room={room} negotiation={negotiation} theme={theme} mode="positions" />
        </>
      )}

      {step === "debate" && (
        <div className="nx-ng-debate">
          <SeatTiles room={room} negotiation={negotiation} theme={theme} mode="rail" />
          <Debate room={room} negotiation={negotiation} theme={theme} />
        </div>
      )}

      {/* Propuesta: mientras el código calcula, la conversación completa; apenas llega el dato, la tarjeta grande y centrada. */}
      {step === "proposal" && (
        <div className="nx-ng-debate">
          <SeatTiles room={room} negotiation={negotiation} theme={theme} mode="rail" />
          {proposalReady(room) ? (
            <div className="nx-ng-stagecard">
              <Proposal room={room} negotiation={negotiation} />
            </div>
          ) : (
            <Debate room={room} negotiation={negotiation} theme={theme} calculating />
          )}
        </div>
      )}

      {step === "decision" &&
        (proposalReady(room) ? (
          <>
            <Proposal room={room} negotiation={negotiation} />
            {turn && <TurnBand room={room} turn={turn} baseUrl={baseUrl} />}
          </>
        ) : (
          <div className="nx-ng-debate">
            <SeatTiles room={room} negotiation={negotiation} theme={theme} mode="rail" />
            <Debate room={room} negotiation={negotiation} theme={theme} calculating />
          </div>
        ))}

      {step === "done" && (
        <>
          <section className="nx-turn gd-panel" data-done="true" aria-live="polite">
            <p className="nx-turn-text">
              <b>
                <CircleCheck aria-hidden="true" className="nx-ng-done-icon" /> {missing.lead}:
              </b>{" "}
              {missing.text}
            </p>
            {onNewDemo && <NewRoundButton onNewRound={onNewDemo} label="Nueva demo" busyLabel="Abriendo…" />}
          </section>
          <Proposal room={room} negotiation={negotiation} />
        </>
      )}

      {(step === "positions" || step === "debate" || step === "proposal") && <NarratorBar room={room} negotiation={negotiation} onControl={onControl} />}
    </div>
  );
}
