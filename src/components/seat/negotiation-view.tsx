"use client";

import { useEffect, useState } from "react";
import { Bot, FastForward, LoaderCircle, Pause, Play, Star } from "lucide-react";
import type { RoleViewer } from "@/components/organs/format";
import { loadHostCredentials, negotiationControl, type Act, type HostCredentials } from "@/lib/client/use-room";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { AGENT_INTRO } from "./agent-text";
import { demoSeatList, orgOfLabel, withArticle } from "./demo-view";
import { SeatMain } from "./seat-shell";

const PHASES = [
  { id: "positions", label: "Posturas" },
  { id: "debate", label: "Debate" },
  { id: "proposal", label: "Propuesta" },
  { id: "decision", label: "Decisión" },
  { id: "done", label: "Acta" },
] as const;

/**
 * Celular en la negociación entre agentes (fases de posturas, debate y propuesta).
 * Arriba, quién eres. Después, «Tu agente»: se presenta (antes trabajaba solo,
 * ahora se conecta con los agentes de los demás), te dice qué decides en concreto
 * («¿Cuánto autorizas sin pedir firma?»), te recomienda una opción y por qué, y
 * las opciones van a un toque, con la recomendada marcada. La recomendación la
 * calcula el servidor (myPrompt) con datos que tu rol ya ve; el consejo lo redacta
 * tu agente. En el debate, lo que dice tu agente por ti va marcado como tuyo. Cuando todos eligieron, el flujo
 * en vivo de la negociación en versión corta: quién está escribiendo y los
 * últimos mensajes. La decisión y el acta las muestra la vista de demo.
 * Todo viene del servidor (room.negotiation), ya filtrado para este rol.
 */
export function NegotiationSeatView({ room, me, act }: { room: ProjectedRoomState; me: RoleViewer; act: Act }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const negotiation = room.negotiation!;
  const seats = demoSeatList(room);
  const mine = seats.find((seat) => seat.orgId === me.orgId && seat.roleId === me.roleId);
  const advice = [...negotiation.messages].reverse().find((message) => message.kind === "advice" && message.orgId === me.orgId && message.roleId === me.roleId);
  const publicMessages = negotiation.messages.filter((message) => message.kind !== "advice" && message.kind !== "position");
  const pending = negotiation.positions.filter((position) => position.position === null).length;
  const phaseIndex = PHASES.findIndex((phase) => phase.id === negotiation.phase);
  const seconds = useSecondsUntil(negotiation.nextAt, room.serverNowTs);

  async function choose(optionId: string) {
    setBusy(optionId);
    setError(null);
    const result = await act("SET_POSITION", { optionId });
    setBusy(null);
    if (!result.ok) setError(result.error);
  }

  if (!mine) return null;
  const committee = !mine.isCase;
  const isMe = (ref: { orgId: string; roleId: string }) => ref.orgId === me.orgId && ref.roleId === me.roleId;
  const choosing = !committee && !!negotiation.myOptions && !negotiation.myPosition;

  return (
    <SeatMain>
      <section className="st-card st-demo" data-accent={mine.accent} aria-live="polite">
        <p className="st-demo-who">{committee ? "Eres el Comité" : `Eres ${withArticle(orgOfLabel(mine.label))}`}</p>
        <p className="st-demo-line">{committee ? "Escucha a los agentes y decide al final." : mine.label.split(" · ")[1] ?? mine.label}</p>
      </section>

      <ol className="st-flow-steps" aria-label={`Paso ${phaseIndex + 1} de ${PHASES.length}`}>
        {PHASES.map((phase, i) => (
          <li key={phase.id} data-state={i < phaseIndex ? "done" : i === phaseIndex ? "now" : "next"}>
            {phase.label}
          </li>
        ))}
      </ol>

      {negotiation.phase === "positions" && (
        <section className="st-card st-agent">
          <p className="st-agent-title">
            <Bot aria-hidden /> Tu agente
          </p>
          {!negotiation.myPosition && <p className="st-agent-intro">{AGENT_INTRO}</p>}
          {choosing && negotiation.myPrompt && <p className="st-agent-question">{negotiation.myPrompt.question}</p>}
          {negotiation.myPosition ? null : advice ? (
            <p className="st-agent-advice">{advice.text}</p>
          ) : (
            <p className="st-agent-advice st-agent-thinking">
              <span className="st-flow-spinner" aria-hidden /> Pensando qué te conviene…
            </p>
          )}
          {choosing && (
            <div className="st-agent-options" role="group" aria-label="Tu postura">
              {negotiation.myOptions!.map((option) => {
                const recommended = option.id === negotiation.myPrompt?.recommendedId;
                return (
                  <button key={option.id} type="button" className="st-btn st-option" data-kind={recommended ? undefined : "line"} data-recommended={recommended || undefined} disabled={busy !== null} onClick={() => choose(option.id)}>
                    <span className="st-option-main">
                      {busy === option.id && <LoaderCircle className="animate-spin" aria-hidden />}
                      {option.answer ?? option.label}
                      {recommended && (
                        <span className="st-option-tag">
                          <Star aria-hidden /> Recomendado
                        </span>
                      )}
                    </span>
                    {option.value && <span className="st-option-value">{option.value}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {negotiation.myPosition && <p className="st-agent-chosen">Tu postura: {chosenAnswer(negotiation.myOptions, negotiation.myPosition)}</p>}
          {(negotiation.myPosition || committee) && (
            <p className="st-support">
              {negotiation.myPosition ? "Ahora la defiendo ante los agentes de los demás. " : ""}
              {pending > 0 ? `Faltan ${pending} posturas.` : "Listo: empiezan a negociar."}
              {seconds !== null && pending > 0 ? ` Si no llegan en ${seconds} s, las pone un bot.` : ""}
            </p>
          )}
        </section>
      )}

      {negotiation.phase !== "positions" && (
        <section className="st-card st-talk" aria-label="La negociación en vivo">
          {publicMessages.slice(-3).map((message) => (
            <p key={message.id} className="st-talk-line" data-kind={message.kind} data-mine={message.orgId === me.orgId || undefined}>
              <b>{isMe(message) ? "Tu agente, por ti en la pantalla grande" : message.agentLabel}</b>
              <span>{message.text}</span>
            </p>
          ))}
          {negotiation.typing && !negotiation.paused && (
            <p className="st-talk-typing">
              <span className="st-flow-spinner" aria-hidden /> {isMe(negotiation.typing) ? "Tu agente está escribiendo por ti…" : `${negotiation.typing.agentLabel} está escribiendo…`}
            </p>
          )}
          {negotiation.paused && <p className="st-talk-typing">En pausa: el narrador la reanuda.</p>}
        </section>
      )}

      {error && (
        <p role="alert" className="st-alert">
          {error}
        </p>
      )}

      <NarratorControls roomId={room.roomId} paused={negotiation.paused} phase={negotiation.phase} />
    </SeatMain>
  );
}

/** La respuesta que eligió la persona, tal como la vio en su botón. */
function chosenAnswer(options: { label: string; answer?: string }[] | undefined, position: string): string {
  return options?.find((option) => option.label === position)?.answer ?? position;
}

/** Segundos que faltan para el próximo paso, contados con el reloj del servidor. null si no hay paso programado. */
function useSecondsUntil(nextAt: number | null, serverNowTs: number): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (nextAt === null) return;
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [nextAt]);
  if (nextAt === null) return null;
  return Math.max(0, Math.ceil((nextAt - serverNowTs) / 1000));
}

/** Pausar, reanudar o adelantar: solo si este navegador abrió la sala (tiene el token de anfitrión). */
function NarratorControls({ roomId, paused, phase }: { roomId: string; paused: boolean; phase: string }) {
  const [host] = useState<HostCredentials | null>(() => (typeof window === "undefined" ? null : loadHostCredentials(roomId)));
  const [busy, setBusy] = useState(false);
  if (!host || phase === "decision" || phase === "done") return null;
  const send = async (action: "pause" | "resume" | "advance") => {
    setBusy(true);
    await negotiationControl(roomId, host, action);
    setBusy(false);
  };
  return (
    <section className="st-links" aria-label="Controles del narrador">
      <button type="button" className="st-link" disabled={busy} onClick={() => send(paused ? "resume" : "pause")}>
        {paused ? <Play aria-hidden /> : <Pause aria-hidden />} {paused ? "Reanudar" : "Pausar"}
      </button>
      <button type="button" className="st-link" disabled={busy} onClick={() => send("advance")}>
        <FastForward aria-hidden /> Adelantar
      </button>
    </section>
  );
}
