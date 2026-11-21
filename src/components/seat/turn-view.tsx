"use client";

import { useState } from "react";
import { CircleCheck, CircleX, FileDown, LoaderCircle, Lock, Send, Star } from "lucide-react";
import type { Turn } from "@/components/nexo/guide";
import { findOrg, formatClock, formatScore, formatValue, orgLabel, roleLabel, type RoleViewer } from "@/components/organs/format";
import type { Act, ActResult } from "@/lib/client/use-room";
import type { ProjectedOrg, ProjectedRoomState } from "@/lib/genome/schema";
import { Alert, Hatch, Stat, Status, Why } from "./parts";
import { ReasonField, useLiveSlider, type ReasonChip } from "./reason-field";
import { lastGateDecision, waitReason } from "./screen";
import { SeatActions, SeatMain } from "./seat-shell";

type Props = {
  room: ProjectedRoomState;
  me: RoleViewer;
  turn: Turn;
  act: Act;
  acta: { md: string; json: string };
};

/**
 * Pestaña «Tu turno»: una tarjeta con lo único que esta persona tiene que hacer
 * ahora (o lo que espera) y, abajo, su botón. Qué turno es lo decide seatTurn
 * (nexo/guide.ts) a partir del estado del servidor; aquí solo se dibuja.
 */
export function TurnView(props: Props) {
  const { turn } = props;
  if (turn.kind === "action") return turn.action.type === "SEAL_RULE" ? <LimitTurn {...props} threshold={turn.action.threshold} /> : <PresentTurn {...props} caseId={turn.action.caseId} />;
  if (turn.kind === "sign-gate") return <GateTurn {...props} org={turn.org} />;
  if (turn.kind === "sign-allocation" && props.room.allocation?.winnerCaseId) return <AllocationTurn {...props} />;
  if (turn.kind === "done") return <DoneTurn {...props} />;
  return <WaitTurn {...props} />;
}

/** Una acción a la vez: cuál está en curso y el último error del servidor. */
function useRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(id: string, action: () => Promise<ActResult>) {
    setBusy(id);
    setError(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) setError(result.error);
    return result;
  }
  return { busy, error, run };
}

// ── 1. Acordar el límite ────────────────────────────────────────────────────

function LimitTurn({ room, me, act, threshold }: Props & { threshold: number }) {
  const { busy, error, run } = useRun();
  const org = findOrg(room, me.orgId);
  const rule = org?.authorityRule;
  const iPropose = me.roleId === rule?.proposerRoleId;
  const slider = useLiveSlider(iPropose ? (rule?.proposerLimit ?? 0) : (rule?.approverLimit ?? 0), (value) => void act("UPDATE_AUTHORITY_SLIDER", { value }));
  if (!org || !rule) return null;

  return (
    <>
      <SeatMain>
        <section className="st-card" aria-live="polite">
          <Status tone="turn" />
          <h1 className="st-title">Acuerden el límite</h1>
          <p className="st-support">Sobre ese valor, alguien tiene que firmar.</p>
          <div className="st-stats">
            <Stat value={formatValue(iPropose ? slider.shown : rule.proposerLimit, rule.unit)} label={iPropose ? "Tú pides" : roleLabel(room, org.orgId, rule.proposerRoleId)} mine={iPropose} />
            <Stat value={formatValue(iPropose ? rule.approverLimit : slider.shown, rule.unit)} label={iPropose ? roleLabel(room, org.orgId, rule.approverRoleId) : "Tú aceptas"} mine={!iPropose} />
          </div>
          <label className="st-slider">
            <span>
              Mueve tu límite <b>{formatValue(slider.shown, rule.unit)}</b>
            </span>
            <input type="range" min={rule.min} max={rule.max} step={1} value={slider.shown} onChange={(event) => slider.change(Number(event.target.value))} />
          </label>
          <Why>
            <p>Se sella en el menor de los dos límites. Si una propuesta lo supera, se frena hasta que una persona firme.</p>
          </Why>
        </section>
        {error && <Alert>{error}</Alert>}
      </SeatMain>
      <SeatActions>
        <button type="button" className="st-btn" disabled={busy !== null} onClick={() => run("seal", () => act("SEAL_RULE", { threshold }))}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
          {busy ? "Un momento…" : `Sellar en ${formatValue(threshold, rule.unit)}`}
        </button>
      </SeatActions>
    </>
  );
}

// ── 2. Firmar la compuerta ──────────────────────────────────────────────────

const GATE_CHIPS: ReasonChip[] = [
  { label: "Dentro de lo acordado", text: "Se aprueba: está dentro de lo acordado." },
  { label: "Por urgencia", text: "Se aprueba por la urgencia del caso." },
  { label: "Falta respaldo", text: "Se veta: falta respaldo para superar el límite." },
];

function GateTurn({ act, org }: Props & { org: ProjectedOrg }) {
  const { busy, error, run } = useRun();
  const [reason, setReason] = useState("");
  const { gate, authorityRule: rule } = org;
  const [counter, setCounter] = useState(gate.effectiveThreshold);
  const ready = reason.trim().length > 0 && busy === null;
  const decide = (decision: "APPROVE" | "VETO" | "COUNTER_PROPOSE") =>
    run(decision, () => act("HITL_DECISION", { decision, reason: reason.trim(), counterValue: decision === "COUNTER_PROPOSE" ? counter : undefined }));

  return (
    <>
      <SeatMain>
        <section className="st-card" aria-live="polite">
          <Status tone="turn" />
          <h1 className="st-title">Te toca firmar</h1>
          <div className="st-stats">
            <Stat value={formatValue(gate.proposedValue, rule.unit)} label="Propuesta" tone="wait" />
            <Stat value={formatValue(gate.effectiveThreshold, rule.unit)} label="Límite acordado" />
          </div>
          <Why label="Proponer otro valor">
            <label className="st-slider" style={{ marginBlockStart: 0 }}>
              <span>
                Aceptarías hasta <b>{formatValue(counter, rule.unit)}</b>
              </span>
              <input type="range" min={rule.min} max={gate.effectiveThreshold} step={1} value={counter} onChange={(event) => setCounter(Number(event.target.value))} />
            </label>
            <button type="button" className="st-btn" data-kind="line" data-size="small" disabled={!ready} onClick={() => decide("COUNTER_PROPOSE")}>
              {busy === "COUNTER_PROPOSE" ? "Registrando…" : `Proponer ${formatValue(counter, rule.unit)}`}
            </button>
          </Why>
        </section>
        <ReasonField value={reason} onChange={setReason} chips={GATE_CHIPS} />
        {error && <Alert>{error}</Alert>}
      </SeatMain>
      <SeatActions>
        <button type="button" className="st-btn" data-kind="veto" disabled={!ready} onClick={() => decide("VETO")}>
          <CircleX aria-hidden />
          {busy === "VETO" ? "Registrando…" : "Vetar"}
        </button>
        <button type="button" className="st-btn" data-kind="approve" disabled={!ready} onClick={() => decide("APPROVE")}>
          <CircleCheck aria-hidden />
          {busy === "APPROVE" ? "Registrando…" : "Aprobar"}
        </button>
      </SeatActions>
    </>
  );
}

// ── 3. Presentar el caso ────────────────────────────────────────────────────

function PresentTurn({ room, me, act, caseId }: Props & { caseId: string }) {
  const { busy, error, run } = useRun();
  const candidate = room.scarcity?.candidates.find((entry) => entry.caseId === caseId);
  if (!candidate) return <WaitTurn room={room} me={me} />;

  return (
    <>
      <SeatMain>
        <section className="st-card" aria-live="polite">
          <Status tone="turn" />
          <h1 className="st-title">Presenta a {candidate.patientLabel}</h1>
          <p className="st-support">Tu costo no sale de aquí.</p>
          <div className="st-stats">
            <Stat value={formatScore(candidate.clinicalSeverityScore)} label="Gravedad" />
            <Stat value={formatScore(candidate.timeCriticality)} label="Urgencia" />
            <Stat value={formatScore(candidate.delayRiskScore)} label="Riesgo" />
          </div>
          <div className="st-row" style={{ marginBlockStart: 8 }}>
            <div className="st-row-text">
              <strong>Costos de los demás</strong>
            </div>
            <Lock aria-hidden style={{ width: 16, height: 16 }} />
            <span className="st-hatch" aria-hidden />
            <span className="st-sr">No llegan a tu celular</span>
          </div>
        </section>
        {error && <Alert>{error}</Alert>}
      </SeatMain>
      <SeatActions>
        <button type="button" className="st-btn" disabled={busy !== null} onClick={() => run("submit", () => act("SUBMIT_CANDIDATE", { caseId }))}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {busy ? "Un momento…" : `Presentar a ${candidate.patientLabel}`}
        </button>
      </SeatActions>
    </>
  );
}

// ── 4. El Comité decide: duelo de tarjetas, razón y dos botones ─────────────

function AllocationTurn({ room, act }: Props) {
  const { busy, error, run } = useRun();
  const [reason, setReason] = useState("");
  const allocation = room.allocation!;
  const scarcity = room.scarcity!;
  const winner = allocation.ranking.find((entry) => entry.caseId === allocation.winnerCaseId)!;
  const winnerOrg = orgLabel(room, winner.orgId);
  const ready = reason.trim().length > 0 && busy === null;

  // Una tarjeta por caso: primero los que siguen en carrera, por orden; al final los vetados.
  const cards = [
    ...allocation.ranking.map((entry) => ({ caseId: entry.caseId, orgId: entry.orgId, label: entry.patientLabel, score: entry.score as number | null, need: entry.unmetNeedScore, vetoed: false })),
    ...scarcity.candidates
      .filter((candidate) => allocation.vetoedCaseIds.includes(candidate.caseId))
      .map((candidate) => ({ caseId: candidate.caseId, orgId: candidate.orgId, label: candidate.patientLabel, score: null, need: candidate.unmetNeedScore, vetoed: true })),
  ];

  const byNeed: ReasonChip = { label: "Equidad", text: `Se asigna a ${winnerOrg}: tiene la mayor necesidad sin cubrir.` };
  const byScore: ReasonChip = { label: "Mayor puntaje", text: `Se asigna a ${winnerOrg}: obtuvo el mayor puntaje.` };
  const chips: ReasonChip[] = [
    ...(allocation.tieBreakApplied ? [byNeed, byScore] : [byScore, byNeed]),
    { label: "Urgencia", text: `Se asigna a ${winnerOrg} por la urgencia del caso.` },
    { label: "Vetar: revisar", text: `Se veta a ${winner.patientLabel}: el caso necesita revisión.` },
  ];

  return (
    <>
      <SeatMain>
        <section className="st-card" aria-live="polite">
          <Status tone="turn" />
          <h1 className="st-title">Te toca decidir</h1>
          <div className="st-duel">
            {cards.map((card) => {
              const pick = card.caseId === winner.caseId;
              return (
                <article key={card.caseId} className="st-cand" data-pick={pick} data-out={card.vetoed}>
                  {pick ? (
                    <span className="st-badge">
                      <Star aria-hidden /> Recomendado
                    </span>
                  ) : card.vetoed ? (
                    <span className="st-badge" data-tone="wait">
                      <CircleX aria-hidden /> Vetado
                    </span>
                  ) : (
                    <span className="st-badge" data-tone="plain">
                      Segundo
                    </span>
                  )}
                  <span className="st-cand-org">{orgLabel(room, card.orgId)}</span>
                  <span className="st-cand-name">{card.label}</span>
                  <span className="st-cand-score">{card.score === null ? "—" : formatScore(card.score)}</span>
                  <span className="st-cand-need">Necesidad {formatScore(card.need)}</span>
                  <Hatch label="Costo oculto" />
                </article>
              );
            })}
          </div>
          <Why>
            <p>{allocation.explanation} El costo de cada organización no entra en la cuenta.</p>
          </Why>
        </section>
        <ReasonField value={reason} onChange={setReason} chips={chips} />
        {error && <Alert>{error}</Alert>}
      </SeatMain>
      <SeatActions>
        <button type="button" className="st-btn" data-kind="veto" disabled={!ready} onClick={() => run("veto", () => act("COMMITTEE_VETO", { reason: reason.trim() })).then((result) => result.ok && setReason(""))}>
          <CircleX aria-hidden />
          {busy === "veto" ? "Registrando…" : "Vetar"}
        </button>
        <button type="button" className="st-btn" data-kind="approve" disabled={!ready} onClick={() => run("seal", () => act("ALLOCATION_SEAL", { reason: reason.trim() }))}>
          <CircleCheck aria-hidden />
          {busy === "seal" ? "Registrando…" : "Aprobar y asignar"}
        </button>
      </SeatActions>
    </>
  );
}

// ── 5. Esperar ──────────────────────────────────────────────────────────────

function WaitTurn({ room, me }: Pick<Props, "room" | "me">) {
  const reason = waitReason(room, me);
  const org = findOrg(room, me.orgId);
  const candidates = room.scarcity?.candidates ?? [];
  const presented = candidates.filter((candidate) => candidate.submitted).length;

  const copy: Record<typeof reason, { title: string; support: string }> = {
    cases: { title: "Faltan casos por presentar", support: "Cuando estén todos, te toca decidir." },
    limit: { title: "Están acordando el límite", support: "Todavía no te toca." },
    signature: { title: "Falta una firma", support: org ? `Firma ${roleLabel(room, org.orgId, org.gate.pendingApproverRoleId ?? undefined) || "otra persona"}.` : "" },
    committee: { title: "El Comité está decidiendo", support: "Lo verás aquí al instante." },
    "other-org": { title: "Falta el otro caso", support: "Después decide el Comité." },
  };

  return (
    <SeatMain>
      <section className="st-card" aria-live="polite">
        <Status tone="wait" />
        <h1 className="st-title">{copy[reason].title}</h1>
        <p className="st-support">{copy[reason].support}</p>
        {reason === "limit" && org ? (
          <div className="st-stats">
            <Stat value={formatValue(org.authorityRule.proposerLimit, org.authorityRule.unit)} label={roleLabel(room, org.orgId, org.authorityRule.proposerRoleId)} />
            <Stat value={formatValue(org.authorityRule.approverLimit, org.authorityRule.unit)} label={roleLabel(room, org.orgId, org.authorityRule.approverRoleId)} />
          </div>
        ) : reason === "signature" && org ? (
          <div className="st-stats">
            <Stat value={formatValue(org.gate.proposedValue, org.authorityRule.unit)} label="Propuesta" tone="wait" />
            <Stat value={formatValue(org.gate.effectiveThreshold, org.authorityRule.unit)} label="Límite acordado" />
          </div>
        ) : reason === "committee" ? (
          <p className="st-big">
            <b>{formatClock(room.stakes.elapsedMs)}</b>
            <span>esperando</span>
          </p>
        ) : (
          <p className="st-big">
            <b>
              {presented} de {candidates.length}
            </b>
            <span>casos presentados</span>
          </p>
        )}
        <p className="st-dots" aria-hidden>
          <i />
          <i />
          <i />
        </p>
      </section>
    </SeatMain>
  );
}

// ── 6. Resuelto ─────────────────────────────────────────────────────────────

const GATE_DONE: Record<string, string> = {
  approved: "Aprobado con firma",
  vetoed: "Vetado con firma",
  counter_proposed: "Se propuso otro valor",
};

function DoneTurn({ room, me, acta }: Props) {
  const allocation = room.allocation;
  const winner = allocation?.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
  const org = findOrg(room, me.orgId);
  const elapsed = formatClock(room.stakes.timeToDecisionMs ?? room.stakes.elapsedMs);

  let title: string;
  let support: string | null = null;
  let stats: { value: string; label: string }[];
  let quote: { reason: string; by: string } | null = null;
  let why: string | null = null;

  if (allocation?.status === "SEALED" && winner) {
    const decision = allocation.committeeDecision;
    title = `${winner.patientLabel} recibe el recurso`;
    support = orgLabel(room, winner.orgId);
    stats = [
      { value: formatScore(winner.score), label: "Puntaje" },
      { value: elapsed, label: "Tiempo en decidir" },
    ];
    quote = decision ? { reason: decision.reason, by: roleLabel(room, decision.byOrgId, decision.byRoleId) } : null;
    why = allocation.explanation;
  } else if (org) {
    const decision = lastGateDecision(room, org);
    title = org.gate.outcome ? GATE_DONE[org.gate.outcome] : org.gate.status === "AUTO_EXECUTED_UNSAFE" ? "Siguió sin revisión humana" : "No hizo falta firma";
    stats = [
      { value: formatValue(decision?.counterValue ?? org.gate.proposedValue, org.authorityRule.unit), label: decision?.counterValue !== undefined ? "Valor propuesto" : "Propuesta" },
      { value: formatValue(org.gate.effectiveThreshold, org.authorityRule.unit), label: "Límite acordado" },
    ];
    quote = decision ? { reason: decision.reason, by: roleLabel(room, decision.byOrgId, decision.byRoleId) } : null;
    why = org.gate.message;
  } else {
    title = "Listo";
    stats = [{ value: elapsed, label: "Tiempo en decidir" }];
  }

  return (
    <>
      <SeatMain>
        <section className="st-card" data-tone="done" aria-live="polite">
          <Status tone="done" />
          <h1 className="st-title">{title}</h1>
          {support && <p className="st-support">{support}</p>}
          <div className="st-stats">
            {stats.map((stat) => (
              <Stat key={stat.label} value={stat.value} label={stat.label} tone="done" />
            ))}
          </div>
          {quote && (
            <figure className="st-quote">
              <blockquote>«{quote.reason}»</blockquote>
              <figcaption>Firmó {quote.by}</figcaption>
            </figure>
          )}
          {why && (
            <Why>
              <p>{why}</p>
            </Why>
          )}
        </section>
      </SeatMain>
      <SeatActions>
        <a className="st-btn" href={acta.md} download>
          <FileDown aria-hidden />
          Descargar el acta
        </a>
      </SeatActions>
    </>
  );
}
