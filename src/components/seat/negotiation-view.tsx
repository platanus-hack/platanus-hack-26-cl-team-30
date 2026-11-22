"use client";

import { useEffect, useState } from "react";
import { Bot, FastForward, LoaderCircle, Pause, Play } from "lucide-react";
import type { RoleViewer } from "@/components/organs/format";
import { loadHostCredentials, negotiationControl, type Act, type HostCredentials } from "@/lib/client/use-room";
import type { ProjectedRoomState } from "@/lib/genome/schema";
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
 * Arriba, quién eres. Después, «Tu agente»: el consejo privado que redactó tu
 * agente y las opciones de postura, a un toque. Cuando todos eligieron, el flujo
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
          {advice ? (
            <p className="st-agent-advice">{advice.text}</p>
          ) : (
            <p className="st-agent-advice st-agent-thinking">
              <span className="st-flow-spinner" aria-hidden /> Pensando qué te conviene…
            </p>
          )}
          {!committee && negotiation.myOptions && !negotiation.myPosition && (
            <div className="st-agent-options" role="group" aria-label="Tu postura">
              {negotiation.myOptions.map((option) => (
                <button key={option.id} type="button" className="st-btn" data-kind="line" disabled={busy !== null} onClick={() => choose(option.id)}>
                  {busy === option.id && <LoaderCircle className="animate-spin" aria-hidden />}
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {negotiation.myPosition && <p className="st-agent-chosen">Tu postura: {negotiation.myPosition}</p>}
          {(negotiation.myPosition || committee) && (
            <p className="st-support">
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
              <b>{message.agentLabel}</b>
              <span>{message.text}</span>
            </p>
          ))}
          {negotiation.typing && !negotiation.paused && (
            <p className="st-talk-typing">
              <span className="st-flow-spinner" aria-hidden /> {negotiation.typing.agentLabel} está escribiendo…
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
