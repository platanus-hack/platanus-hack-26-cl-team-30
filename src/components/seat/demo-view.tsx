"use client";

import { useState } from "react";
import { CircleCheck, CircleX, FileDown, LoaderCircle, RefreshCw, Send } from "lucide-react";
import type { RoleViewer } from "@/components/organs/format";
import type { Act, ActResult } from "@/lib/client/use-room";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { SeatActions, SeatMain } from "./seat-shell";

/**
 * Silla de la demo pauteada. El narrador guía en voz alta («Clínica, apriete
 * Presentar»; «Comité, ¿acepta o rechaza?») y quien juega no lee: ve quién es,
 * en grande y con su color, y un solo botón cuando le toca. Lo demás se oculta.
 * Qué turno es lo calcula el servidor (room.turn); aquí solo se dibuja.
 */
export function DemoSeatView({ room, me, act, acta }: { room: ProjectedRoomState; me: RoleViewer; act: Act; acta: { md: string } }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonIndex, setReasonIndex] = useState(0);

  const seats = demoSeatList(room);
  const mine = seats.find((seat) => seat.orgId === me.orgId && seat.roleId === me.roleId);
  const other = seats.find((seat) => seat.seatOrder !== mine?.seatOrder && seat.isCase);
  const words = demoWords(room.scenarioId);
  const turn = room.turn ?? null;
  const myTurn = !!turn && turn.orgId === me.orgId && turn.roleId === me.roleId;
  const sealed = room.allocation?.status === "SEALED";
  const winner = room.allocation?.ranking.find((entry) => entry.caseId === room.allocation?.winnerCaseId);
  const winnerSeat = seats.find((seat) => seat.orgId === winner?.orgId);
  const reason = DEMO_REASONS[reasonIndex % DEMO_REASONS.length];

  async function run(id: string, action: () => Promise<ActResult>) {
    setBusy(id);
    setError(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) setError(result.error);
  }

  if (!mine) return null;

  const line = mine.isCase ? `Compites por ${words.resource}${other ? ` con ${withArticle(other.label)}` : ""}.` : `Tú decides quién recibe ${words.resource}.`;

  return (
    <>
      <SeatMain>
        <section className="st-card st-demo" data-accent={mine.accent} aria-live="polite">
          <p className="st-demo-who">Eres {withArticle(mine.label)}</p>
          <p className="st-demo-line">{line}</p>
        </section>

        {sealed ? (
          <section className="st-card st-demo-state" data-tone="done">
            <CircleCheck aria-hidden />
            <p>
              Listo: {words.resource} es para {winnerSeat ? withArticle(winnerSeat.label) : (winner?.patientLabel ?? "el caso elegido")}.
            </p>
          </section>
        ) : myTurn && turn.action === "decide" ? (
          <section className="st-card st-demo-state">
            <p className="st-demo-ask">¿Aceptas o rechazas?</p>
            <p className="st-demo-line">La regla propone {winnerSeat ? withArticle(winnerSeat.label) : (winner?.patientLabel ?? "un caso")}.</p>
            <button type="button" className="st-demo-reason" onClick={() => setReasonIndex((index) => index + 1)} aria-label={`Razón: ${reason}. Toca para cambiarla`}>
              <span>Razón: {reason}</span>
              <RefreshCw aria-hidden />
            </button>
          </section>
        ) : myTurn ? null : (
          <section className="st-card st-demo-state" data-tone="wait">
            <p>{turn ? `Espera: le toca ${toArticle(turn.label)}` : "Espera"}</p>
          </section>
        )}

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
  return seats
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((seat) => ({ ...seat, accent: ACCENT_BY_ORDER[(seat.seatOrder - 1) % ACCENT_BY_ORDER.length] }));
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
