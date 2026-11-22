"use client";

import { useState } from "react";
import { Bot, CircleCheck, CircleX, FileDown, LoaderCircle, MessageCircle, RefreshCw, Send, Star } from "lucide-react";
import { formatScore, type RoleViewer } from "@/components/organs/format";
import { requestCommitteeSummary, type Act, type ActResult, type RoomSession } from "@/lib/client/use-room";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { committeeBrief } from "./agent-text";
import { demoStep } from "./screen";
import { SeatActions, SeatMain } from "./seat-shell";

/**
 * Silla de la demo pauteada. El narrador guía en voz alta («Clínica, apriete
 * Presentar»; «Comité, ¿acepta o rechaza?») y quien juega no lee: ve quién es,
 * en grande y con su color, y un solo botón cuando le toca. Lo demás se oculta.
 * Qué turno es lo calcula el servidor (room.turn); aquí solo se dibuja.
 */
export function DemoSeatView({ room, me, act, acta, session }: { room: ProjectedRoomState; me: RoleViewer; act: Act; acta: { md: string }; session?: RoomSession | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null: la razón que sugiere el agente del Comité. Un toque pasa a la siguiente.
  const [reasonPick, setReasonPick] = useState<number | null>(null);

  const seats = demoSeatList(room);
  const mine = seats.find((seat) => seat.orgId === me.orgId && seat.roleId === me.roleId);
  // La otra organización (en la negociación hay dos asientos por organización).
  const other = seats.find((seat) => seat.isCase && seat.orgId !== mine?.orgId);
  const words = demoWords(room.scenarioId);
  const turn = room.turn ?? null;
  const myTurn = !!turn && turn.orgId === me.orgId && turn.roleId === me.roleId;
  const sealed = room.allocation?.status === "SEALED";
  const winner = room.allocation?.ranking.find((entry) => entry.caseId === room.allocation?.winnerCaseId);
  const winnerSeat = seats.find((seat) => seat.orgId === winner?.orgId);
  // Con negociación, el agente del Comité le resume el caso y le recomienda (texto del código, sin modelo).
  const brief = room.negotiation ? committeeBrief(room, seats, words.resource) : null;
  const reasonIndex = reasonPick ?? brief?.reasonIndex ?? 0;
  const reason = DEMO_REASONS[reasonIndex % DEMO_REASONS.length];

  async function run(id: string, action: () => Promise<ActResult>) {
    setBusy(id);
    setError(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) setError(result.error);
  }

  if (!mine) return null;

  const line = mine.isCase ? `Compites por ${words.resource}${other ? ` con ${withArticle(orgOfLabel(other.label))}` : ""}.` : `Tú decides quién recibe ${words.resource}.`;

  return (
    <>
      <SeatMain>
        <section className="st-card st-demo" data-accent={mine.accent} aria-live="polite">
          <p className="st-demo-who">Eres {withArticle(orgOfLabel(mine.label))}</p>
          <p className="st-demo-line">{line}</p>
        </section>

        {/* Mientras decide, el WhatsApp sigue a la vista: compacto y arriba, para que la barra de Aceptar/Rechazar no lo tape. */}
        {!mine.isCase && !sealed && myTurn && turn.action === "decide" && <WhatsAppSummary roomId={room.roomId} session={session ?? null} compact />}

        {sealed ? (
          <section className="st-card st-demo-state st-reveal" data-tone="done">
            <CircleCheck aria-hidden />
            <p>
              Listo: {words.resource} es para {winnerSeat ? withArticle(orgOfLabel(winnerSeat.label)) : (winner?.patientLabel ?? "el caso elegido")}.
            </p>
            {room.allocation?.committeeDecision?.decision === "VETO" && <p className="st-demo-line">El Comité rechazó la propuesta de la regla.</p>}
          </section>
        ) : myTurn && turn.action === "decide" ? (
          <section className="st-card st-demo-state">
            <p className="st-demo-ask">¿Aceptas o rechazas?</p>
            {brief ? (
              <div className="st-demo-agent">
                <p className="st-agent-title">
                  <Bot aria-hidden /> Tu agente
                </p>
                <p className="st-demo-line">{brief.summary}</p>
                <p className="st-agent-advice">{brief.advice}</p>
              </div>
            ) : (
              <p className="st-demo-line">La regla propone {winnerSeat ? withArticle(orgOfLabel(winnerSeat.label)) : (winner?.patientLabel ?? "un caso")}.</p>
            )}
            <button type="button" className="st-demo-reason" onClick={() => setReasonPick((reasonIndex + 1) % DEMO_REASONS.length)} aria-label={`Razón: ${reason}. Toca para cambiarla`}>
              <span>Razón: {reason}</span>
              <RefreshCw aria-hidden />
            </button>
          </section>
        ) : myTurn ? null : mine.isCase && turn?.action === "decide" ? (
          <CommitteeDeciding room={room} seats={seats} remainingMs={turn.remainingMs} totalMs={turn.totalMs} />
        ) : (
          <section className="st-card st-demo-state" data-tone="wait">
            <p>{turn ? `Espera: le toca ${toArticle(turn.label)}` : "Espera"}</p>
          </section>
        )}

        {/* El Comité pide el acta por WhatsApp: destacado hasta que decide; después, discreto (si lo pide tarde, el acta sale igual). */}
        {!mine.isCase && !(myTurn && turn?.action === "decide" && !sealed) && <WhatsAppSummary roomId={room.roomId} session={session ?? null} featured={!sealed} />}

        {error && (
          <p role="alert" className="st-alert">
            {error}
          </p>
        )}
      </SeatMain>

      {sealed ? (
        <SeatActions>
          <a className="st-btn" data-kind="line" href={acta.md} download>
            <FileDown aria-hidden />
            Descargar el acta
          </a>
        </SeatActions>
      ) : myTurn && turn.action === "submit" ? (
        <SeatActions>
          <button type="button" className="st-btn" data-size="huge" disabled={busy !== null} onClick={() => run("submit", () => act("SUBMIT_CANDIDATE", {}))}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            Presentar
          </button>
        </SeatActions>
      ) : myTurn && turn.action === "decide" ? (
        <SeatActions>
          <button
            type="button"
            className="st-btn"
            data-kind="veto"
            data-size="huge"
            disabled={busy !== null}
            onClick={() => run("veto", () => act("COMMITTEE_VETO", { reason: `Se rechaza la propuesta ${reason}.` }))}
          >
            <CircleX aria-hidden />
            Rechazar
          </button>
          <button
            type="button"
            className="st-btn"
            data-kind="approve"
            data-size="huge"
            disabled={busy !== null}
            onClick={() => run("seal", () => act("ALLOCATION_SEAL", { reason: `Se acepta la propuesta ${reason}.` }))}
          >
            <CircleCheck aria-hidden />
            Aceptar
          </button>
        </SeatActions>
      ) : null}
    </>
  );
}

/** Razones precargadas del Comité. Sirven para aceptar o rechazar («Se acepta la propuesta por equidad»). Un toque cambia a la siguiente. */
export const DEMO_REASONS = ["por equidad", "por gravedad", "por urgencia", "para revisar el caso"];

type DemoSeatInfo = { orgId: string; roleId: string; seatOrder: number; label: string; isCase: boolean; accent: "emerald" | "amber" | "violet" };

const ACCENT_BY_ORDER: DemoSeatInfo["accent"][] = ["emerald", "amber", "violet"];

/** Los asientos humanos de la demo, con el orden y el nombre corto que manda el servidor. El color sale del orden. */
export function demoSeatList(room: ProjectedRoomState): DemoSeatInfo[] {
  const seats: DemoSeatInfo[] = [];
  for (const org of room.orgs) {
    for (const role of org.roles) {
      if (role.seatOrder && role.seatLabel) seats.push({ orgId: org.orgId, roleId: role.id, seatOrder: role.seatOrder, label: role.seatLabel, isCase: true, accent: "emerald" });
    }
  }
  const arbiter = room.scarcity?.arbiter;
  if (arbiter?.seatOrder && arbiter.seatLabel) seats.push({ orgId: arbiter.orgId, roleId: arbiter.roleId, seatOrder: arbiter.seatOrder, label: arbiter.seatLabel, isCase: false, accent: "violet" });
  // Color por organización (la primera eucalipto, la segunda arcilla) y el Comité violeta.
  const orgOrder = [...new Set(seats.filter((seat) => seat.isCase).sort((a, b) => a.seatOrder - b.seatOrder).map((seat) => seat.orgId))];
  return seats
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((seat) => ({ ...seat, accent: seat.isCase ? ACCENT_BY_ORDER[orgOrder.indexOf(seat.orgId) % 2] : "violet" }));
}

/** «Clínica · Urgencias» → «Clínica». En la demo de 3, el nombre ya es el de la organización. */
export function orgOfLabel(label: string): string {
  return label.split(" · ")[0] ?? label;
}

/** Artículo de cada nombre corto: «la Clínica», «el Hospital Rural», «el Comité». Los demás, sin artículo. */
const ARTICLE: Record<string, string> = { Clínica: "la", "Hospital Rural": "el", Comité: "el" };

export function withArticle(label: string): string {
  const article = ARTICLE[label];
  return article ? `${article} ${label}` : label;
}

/** «a la Clínica», «al Hospital Rural», «al Comité». */
export function toArticle(label: string): string {
  const article = ARTICLE[label];
  return article === "el" ? `al ${label}` : article ? `a ${article} ${label}` : `a ${label}`;
}

function demoWords(scenarioId: string | undefined): { resource: string } {
  if (scenarioId === "hospitales") return { resource: "la cama" };
  if (scenarioId === "construccion") return { resource: "la grúa" };
  if (scenarioId === "logistica") return { resource: "el camión" };
  return { resource: "el recurso" };
}

/** Número de WhatsApp de Sculptor (el conectado en Kapso). */
const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "12084850157").replace(/\D/g, "");
/** «12084850157» → «+1 208 485 0157». */
const WHATSAPP_DISPLAY = WHATSAPP_NUMBER.length === 11 && WHATSAPP_NUMBER.startsWith("1") ? `+1 ${WHATSAPP_NUMBER.slice(1, 4)} ${WHATSAPP_NUMBER.slice(4, 7)} ${WHATSAPP_NUMBER.slice(7)}` : `+${WHATSAPP_NUMBER}`;

/** Enlace wa.me al número de Sculptor con «Hola, soy el Comité de la sala <código>» ya escrito. */
export function committeeWhatsAppHref(roomId: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hola, soy el Comité de la sala ${roomId}`)}`;
}

/**
 * «Recibir resumen por WhatsApp». El botón abre WhatsApp con el mensaje
 * prellenado «Hola, soy el Comité de la sala <código>»: al enviarlo, el servidor
 * asocia ese número a la sala y, al decidir, le manda el acta (texto y, si está
 * activada, nota de voz). Alternativa: escribir el número aquí. El número no se
 * guarda en el celular. `featured`: el Comité lo ve apenas entra, lleno y con una
 * línea que dice para qué sirve, hasta que decide (en el pitch, un juez lo prueba).
 * `compact`: solo el botón, mientras decide, para no empujar la decisión.
 */
export function WhatsAppSummary({ roomId, session, featured = false, compact = false }: { roomId: string; session: RoomSession | null; featured?: boolean; compact?: boolean }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [result, setResult] = useState<{ tone: "done" | "wait"; text: string } | null>(null);
  const href = committeeWhatsAppHref(roomId);

  if (compact) {
    return (
      <section className="st-wa" data-compact aria-label="Resumen por WhatsApp">
        <a className="st-btn" data-kind="wa" href={href} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden />
          Recibir resumen por WhatsApp
        </a>
      </section>
    );
  }

  async function submit() {
    if (!session) return;
    setBusy(true);
    const response = await requestCommitteeSummary(roomId, session, phone);
    setBusy(false);
    if (!response.ok) setResult({ tone: "wait", text: response.error });
    else if (response.deliverable) setResult({ tone: "done", text: "Listo: al decidir le llegará el acta por WhatsApp." });
    else setResult({ tone: "wait", text: `Para recibirlo, escriba hola al ${WHATSAPP_DISPLAY} y vuelva a intentar.` });
  }

  return (
    <section className="st-card st-wa" data-featured={featured || undefined} aria-label="Resumen por WhatsApp">
      {featured && <p className="st-wa-why">Cuando decidas, te llega el acta a tu WhatsApp. Un toque y envía el mensaje que ya viene escrito.</p>}
      <a className="st-btn" data-kind={featured ? "wa" : "line"} href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
        <MessageCircle aria-hidden />
        Recibir resumen por WhatsApp
      </a>
      {featured && opened && <p className="st-wa-result" data-tone="done">Envía el mensaje en WhatsApp y vuelve aquí para decidir.</p>}
      <details className="st-why">
        <summary>O escriba su número</summary>
        <form
          className="st-wa-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input className="st-wa-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+56 9 1234 5678" value={phone} onChange={(event) => setPhone(event.target.value)} aria-label="Su número de WhatsApp" required />
          <button type="submit" className="st-mini" disabled={busy || phone.replace(/\D/g, "").length < 8 || !session}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            Enviar
          </button>
        </form>
      </details>
      {result && (
        <p role="status" className="st-wa-result" data-tone={result.tone}>
          {result.text}
        </p>
      )}
    </section>
  );
}

/**
 * Lo que ven los hospitales mientras el Comité decide: no una pantalla quieta, sino
 * el flujo en vivo. Los pasos con el actual pulsando, las dos tarjetas con su
 * puntaje y la estrella en la propuesta, y la cuenta regresiva del plan B (el
 * servidor manda la sala cada segundo mientras se espera).
 */
function CommitteeDeciding({ room, seats, remainingMs, totalMs }: { room: ProjectedRoomState; seats: DemoSeatInfo[]; remainingMs: number; totalMs: number }) {
  const step = demoStep(room);
  const ranking = room.allocation?.ranking ?? [];
  const proposed = room.allocation?.winnerCaseId;
  const seconds = Math.ceil(remainingMs / 1000);
  return (
    <section className="st-card st-flow" aria-live="polite">
      <p className="st-flow-title">
        <span className="st-flow-spinner" aria-hidden />
        El Comité está decidiendo…
      </p>
      <ol className="st-flow-steps" aria-label={`Paso ${step.index + 1} de ${step.total}`}>
        {step.labels.map((label, i) => (
          <li key={label} data-state={i < step.index ? "done" : i === step.index ? "now" : "next"}>
            {label}
          </li>
        ))}
      </ol>
      <div className="st-duel">
        {ranking.map((entry) => {
          const seat = seats.find((item) => item.orgId === entry.orgId);
          const pick = entry.caseId === proposed;
          return (
            <article key={entry.caseId} className="st-cand" data-pick={pick} data-accent={seat?.accent}>
              {pick && (
                <span className="st-badge">
                  <Star aria-hidden /> Propuesto
                </span>
              )}
              <span className="st-cand-name">{seat ? seat.label : entry.patientLabel}</span>
              <span className="st-cand-score">{formatScore(entry.score)}</span>
              <span className="st-cand-need">puntaje</span>
            </article>
          );
        })}
      </div>
      {totalMs > 0 && (
        <div className="st-flow-timer" role="timer" aria-label={`Si el Comité no responde en ${seconds} segundos, decide el plan B`}>
          <span>Plan B en {seconds} s</span>
          <i style={{ inlineSize: `${Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))}%` }} />
        </div>
      )}
    </section>
  );
}

