"use client";

// Centro de mando de la pantalla grande. La base visual es el panel de vidrio de
// src/components/ui/glassy-dashboard.tsx (mismas clases .gd-* y tema claro u
// oscuro); todo lo que muestra sale del estado de la sala que llega por el SSE,
// en lenguaje simple. La bitácora no va a la vista principal: queda en «Ver
// registro», colapsado.

import "@fontsource-variable/manrope";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  BarChart3,
  BellRing,
  Bot,
  ChevronDown,
  CircleCheck,
  ExternalLink,
  FileDown,
  FileText,
  Hourglass,
  LayoutDashboard,
  Lock,
  Moon,
  PenLine,
  RotateCcw,
  Scale,
  ScrollText,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Square,
  Sun,
  TriangleAlert,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { CommitteeNotify } from "@/components/nexo/committee-notify";
import { EventToasts } from "@/components/nexo/event-toasts";
import { useIntegrations } from "@/components/nexo/integrations";
import { isLocalUrl, publicBaseUrl, roleJoinUrl } from "@/components/nexo/public-url";
import { QrCode } from "@/components/nexo/qr-code";
import { Mark } from "@/components/landing/mark";
import { AUDIT_LABEL, auditDetail, formatScore, formatTime, orgLabel, roleLabel } from "@/components/organs/format";
import { hostRequest, type ConnectionStatus, type HostCredentials } from "@/lib/client/use-room";
import type { AuditEvent, ProjectedRoomState } from "@/lib/genome/schema";
import { CROSS_ORG_SCENARIOS, CROSS_ORG_SCENARIO_IDS } from "@/lib/genome/scenarios";
import { SUGGESTIONS, answer } from "./ask";
import { commandStyles } from "./command-styles";
import { Dialog, Dock, Panel, State, type ViewId, type ViewInfo } from "./command-parts";
import { Galaxy } from "./galaxy";
import { JoinView } from "./join-view";
import { shortLabel, stageSeats } from "./seats";
import { storyProgress } from "./story";
import { StoryView } from "./story-view";

const VIEWS: ViewInfo[] = [
  { id: "mando", label: "Centro de mando", short: "Mando", icon: LayoutDashboard },
  { id: "ranking", label: "Ranking", short: "Ranking", icon: BarChart3 },
  { id: "organizaciones", label: "Organizaciones", short: "Orgs.", icon: Users },
  { id: "acta", label: "Acta", short: "Acta", icon: FileText },
];

const SCENARIO_SHORT: Record<string, string> = { hospitales: "Hospitales", construccion: "Construcción", logistica: "Logística" };
const THEME_KEY = "nexo:stage-theme";
const noopSubscribe = () => () => {};
/** Tiempo que el paso «Unirse» sigue a la vista después de completarse, para que se vea la esfera armada. */
const JOIN_LINGER_MS = 2600;

/** Sigue en true un rato después de que «active» pasa a false. */
function useLinger(active: boolean, ms: number): boolean {
  const [held, setHeld] = useState(active);
  useEffect(() => {
    const timer = window.setTimeout(() => setHeld(active), active ? 0 : ms);
    return () => window.clearTimeout(timer);
  }, [active, ms]);
  return active || held;
}

type Props = {
  room: ProjectedRoomState;
  status: ConnectionStatus;
  host: HostCredentials | null;
  acta: { md: string; json: string };
  onOpenOwnRoom: () => Promise<void>;
};

export function CommandCenter({ room, status, host, acta, onOpenOwnRoom }: Props) {
  const [view, setView] = useState<ViewId>("mando");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [modal, setModal] = useState<"ask" | "notify" | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const integrations = useIntegrations();
  const baseUrl = useSyncExternalStore(noopSubscribe, publicBaseUrl, () => null);
  const logRef = useRef<HTMLDetailsElement>(null);

  // Parte en oscuro; si la persona eligió claro antes en este equipo, se respeta.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light") queueMicrotask(() => setTheme("light"));
    } catch {
      // Sin almacenamiento: queda en oscuro.
    }
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Sin almacenamiento: el cambio dura hasta recargar.
    }
  };

  const cross = room.mode === "cross_org" && !!room.scarcity && !!room.allocation;
  // La galaxia sale de los asientos reales de la sala: un nodo por rol conectado.
  const seats = stageSeats(room);
  const progress = storyProgress(room);
  const joining = useLinger(progress.index === 0, JOIN_LINGER_MS);
  const sealed = progress.done;
  const canNotify = !!host && cross && !!integrations && (integrations.whatsapp || (integrations.voice && integrations.canCall));
  const current = VIEWS.find((entry) => entry.id === view)!;

  const openLog = () => {
    setView("acta");
    setLogOpen(true);
    requestAnimationFrame(() => logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="gd-app" data-theme={theme}>
      <style>{commandStyles}</style>
      <div className="gd-surround">
        <header className="gd-top">
          <div className="gd-brand">
            <span className="gd-logo" aria-hidden="true">
              <Mark size={26} />
            </span>
            <div>
              <strong>NEXO</strong>
              <small>Pantalla grande</small>
            </div>
          </div>
          <button type="button" className="gd-ask" aria-label="Pregúntale al caso" onClick={() => setModal("ask")}>
            <span className="gd-orb" aria-hidden="true" />
            <span className="gd-prompt">Pregúntale al caso</span>
            <Search aria-hidden="true" className="gd-ask-search" />
          </button>
          <div className="gd-top-actions">
            <span className="gd-icon-button" role="status" title={status === "connected" ? "En vivo" : status === "reconnecting" ? "Reconectando" : "Conectando"} aria-label={status === "connected" ? "En vivo" : status === "reconnecting" ? "Reconectando" : "Conectando"} style={{ color: status === "connected" ? "var(--gd-calm)" : "var(--gd-sign)" }}>
              {status === "connected" ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
            </span>
            <button type="button" className="gd-icon-button" aria-label="Ver registro" title="Ver registro" onClick={openLog}>
              <ScrollText aria-hidden="true" />
            </button>
            <button type="button" className="gd-icon-button" title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} onClick={toggleTheme}>
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
          </div>
        </header>

        <div className="gd-stage-wrap">
          <Dock views={VIEWS} active={view} side select={setView} />
          <main className="gd-stage" data-join={view === "mando" && joining}>
            {view === "mando" && <Galaxy seats={seats} sealed={sealed} variant={joining ? "hero" : "backdrop"} theme={theme} />}
            <div className="gd-stage-scroll">
              <header className="gd-view-head">
                <div>
                  <h1>{view === "mando" && joining ? "Escanea y entra" : current.label}</h1>
                </div>
                <div className="gd-view-actions">
                  {cross && (
                    <nav className="gd-period" aria-label="Escenario">
                      {CROSS_ORG_SCENARIO_IDS.map((id) => (
                        <Link key={id} href={`/stage/${CROSS_ORG_SCENARIOS[id].fixedRoomId}`} aria-current={id === (room.scenarioId ?? "hospitales") ? "page" : undefined}>
                          {SCENARIO_SHORT[id] ?? CROSS_ORG_SCENARIOS[id].title}
                        </Link>
                      ))}
                    </nav>
                  )}
                </div>
              </header>

              <div className="gd-content" data-view={view}>
                {view === "mando" &&
                  (joining ? <JoinView room={room} seats={seats} theme={theme} baseUrl={baseUrl} /> : <StoryView room={room} onNotify={canNotify ? () => setModal("notify") : undefined} />)}
                {view === "ranking" && <RankingView room={room} />}
                {view === "organizaciones" && <OrgsView room={room} baseUrl={baseUrl} committeeKey={host?.committeeKey ?? null} onOpenOwnRoom={onOpenOwnRoom} />}
                {view === "acta" && (
                  <ActaView room={room} acta={acta} host={host} onNotify={canNotify ? () => setModal("notify") : undefined} logOpen={logOpen} onLogToggle={setLogOpen} logRef={logRef} />
                )}
              </div>
            </div>
          </main>
          <Dock views={VIEWS} active={view} select={setView} />
        </div>
        <footer className="gd-footer">
          <span className="nx-footer-note">Demostración simulada. No es una herramienta clínica.</span>
          <Link href={`/room/${encodeURIComponent(room.roomId)}`}>
            <Smartphone aria-hidden="true" width={12} height={12} /> Entrar con un rol
          </Link>
        </footer>
      </div>

      {modal === "ask" && <AskDialog room={room} close={() => setModal(null)} />}
      {modal === "notify" && host && (
        <Dialog title="Avisar al Comité" close={() => setModal(null)} light>
          <CommitteeNotify room={room} credentials={host} />
        </Dialog>
      )}
      {/* Al unirse, las entradas ya se ven en la galaxia y los avisos taparían el código. */}
      {!(view === "mando" && joining) && <EventToasts room={room} />}
    </div>
  );
}

// --- Vistas ---------------------------------------------------------------------

/** Una explicación que no va a la vista: queda detrás de «¿Por qué?». */
function Why({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <details className="nx-why">
      <summary>¿Por qué?</summary>
      <p>{children}</p>
    </details>
  );
}

const DENIED: AuditEvent["type"][] = ["RBAC_DENIED", "AUTH_FAILED", "GATE_BLOCKED", "HITL_VETOED"];
const SETTLED: AuditEvent["type"][] = ["RULE_SEALED", "HITL_APPROVED", "ALLOCATION_SEALED", "STAKES_CONTAINED"];
const STATUS_CODE: Partial<Record<AuditEvent["type"], string>> = { RBAC_DENIED: "403", AUTH_FAILED: "401" };

/** Tabla de actividad del panel base, con la bitácora completa y sus códigos técnicos. */
function AuditTable({ room, acta }: { room: ProjectedRoomState; acta: { md: string; json: string } }) {
  const events = [...room.auditLog].reverse();
  return (
    <>
      <div className="gd-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Código</th>
              <th scope="col">Qué pasó</th>
              <th scope="col">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => {
              const role = roleLabel(room, event.orgId, event.roleId);
              const org = room.orgs.length > 1 ? orgLabel(room, event.orgId) : "";
              const who = [role, org !== role ? org : ""].filter(Boolean).join(", ");
              const detail = auditDetail(event.detail, event.type);
              const state = DENIED.includes(event.type) ? "block" : SETTLED.includes(event.type) ? "calm" : undefined;
              return (
                <tr key={`${event.ts}-${index}`}>
                  <td>{formatTime(event.ts)}</td>
                  <td className="nx-code" data-state={state}>
                    {STATUS_CODE[event.type] ? `${STATUS_CODE[event.type]} ` : ""}
                    {event.type}
                  </td>
                  <td>
                    {AUDIT_LABEL[event.type] ?? event.type}
                    {who ? ` · ${who}` : ""}
                  </td>
                  <td className="nx-wrap">{detail.reason ? `«${detail.reason}» ` : ""}{detail.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {events.length === 0 && <p className="gd-empty">Sin eventos todavía.</p>}
      <p className="nx-meta" style={{ marginTop: 10 }}>
        <a href={acta.md} download style={{ textDecoration: "underline" }}>
          Descargar el acta
        </a>
      </p>
    </>
  );
}

function RankingView({ room }: { room: ProjectedRoomState }) {
  const allocation = room.allocation;
  const scarcity = room.scarcity;
  if (!allocation || !scarcity) {
    const org = room.orgs[0];
    return (
      <div className="gd-analytics">
        <Panel title="Una sola organización: sin ranking">
          <Why>{org?.gate.message}</Why>
        </Panel>
      </div>
    );
  }
  const orgName = (orgId: string) => orgLabel(room, orgId);
  const decision = allocation.committeeDecision;
  return (
    <div className="gd-analytics">
      <div>
        <Panel title="Orden" subtitle={allocation.status === "SEALED" ? "Sellado por el Comité" : allocation.status === "PROPOSED" ? "Falta el Comité" : "Esperando los casos"}>
          <div className="nx-rank">
            {allocation.ranking.map((entry) => (
              <div key={entry.caseId} className="nx-rank-row" data-winner={entry.caseId === allocation.winnerCaseId}>
                <span className="nx-rank-pos">{entry.rank}</span>
                <span>
                  <span className="nx-rank-name">{entry.patientLabel}</span>
                  <span className="nx-rank-org" style={{ display: "block" }}>
                    {orgName(entry.orgId)}
                  </span>
                </span>
                <span className="nx-rank-score">{formatScore(entry.score)}</span>
                <span className="nx-rank-terms">
                  <span>
                    Gravedad<b>+{formatScore(entry.terms.severity)}</b>
                  </span>
                  <span>
                    Urgencia<b>+{formatScore(entry.terms.timeCriticality)}</b>
                  </span>
                  <span>
                    Demora<b>−{formatScore(Math.abs(entry.terms.delayRisk))}</b>
                  </span>
                  <span>
                    Sin cubrir<b>{formatScore(entry.unmetNeedScore)}</b>
                  </span>
                </span>
              </div>
            ))}
            {allocation.ranking.length === 0 && <p className="gd-empty">Sin casos todavía.</p>}
            {allocation.ranking.length > 1 && <Why>{allocation.explanation}</Why>}
            {decision && (
              <figure>
                <figcaption className="nx-meta">
                  {scarcity.arbiter.title} {decision.decision === "VETO" ? "vetó" : "aprobó"} a las {formatTime(decision.ts)}
                </figcaption>
                <blockquote className="nx-quote" style={{ margin: "6px 0 0" }}>
                  «{decision.reason}»
                </blockquote>
              </figure>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function OrgsView({ room, baseUrl, committeeKey, onOpenOwnRoom }: { room: ProjectedRoomState; baseUrl: string | null; committeeKey: string | null; onOpenOwnRoom: () => Promise<void> }) {
  const [opening, setOpening] = useState(false);
  const arbiter = room.scarcity?.arbiter;
  const committee = arbiter
    ? { orgId: arbiter.orgId, roleId: arbiter.roleId, title: arbiter.title, connected: arbiter.connected }
    : (() => {
        const role = room.orgs[0]?.roles.find((entry) => entry.isQrOptional);
        return role ? { orgId: room.orgs[0].orgId, roleId: role.id, title: role.title, connected: role.connected } : null;
      })();
  const players = room.orgs.flatMap((org) => org.roles.filter((role) => !role.isQrOptional).map((role) => ({ org, role })));

  return (
    <div className="gd-analytics">
      <div className="nx-org-grid">
        {room.orgs.map((org) => {
          const candidate = room.scarcity?.candidates.find((entry) => entry.orgId === org.orgId);
          const connected = org.roles.filter((role) => role.connected).length;
          const hidden = org.fields.filter((field) => field.redacted);
          return (
            <Panel key={org.orgId} title={org.orgName} subtitle={`${connected}/${org.roles.length} conectados`}>
              <div className="nx-chips">
                {org.conflict.hasConflict ? (
                  <State state="sign" icon={Scale}>
                    En disputa
                  </State>
                ) : (
                  <State state={org.authorityRule.sealedThreshold !== null ? "calm" : "plain"} icon={CircleCheck}>
                    {org.authorityRule.sealedThreshold !== null ? "Límite acordado" : "Sin límite"}
                  </State>
                )}
                {org.gate.status === "BLOCKED_HITL_REQUIRED" && (
                  <State state="block" icon={TriangleAlert}>
                    Falta firma
                  </State>
                )}
                {org.gate.status === "SEALED" && (
                  <State state="calm" icon={PenLine}>
                    Firmado
                  </State>
                )}
                {candidate && (
                  <State state={candidate.submitted ? "calm" : "plain"} icon={Send}>
                    {candidate.submitted ? "Presentado" : "Sin presentar"}
                  </State>
                )}
              </div>
              {hidden.length > 0 && (
                <>
                  <p className="nx-meta" style={{ marginBottom: 6 }}>
                    Reservado
                  </p>
                  <ul className="nx-locked">
                    {hidden.map((field) => (
                      <li key={field.key}>
                        <Lock aria-hidden="true" />
                        <span>{shortLabel(field.label)}</span>
                        <i aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel title="Un código por rol">
        {baseUrl && isLocalUrl(baseUrl) && (
          <p className="nx-warn" role="alert">
            <TriangleAlert aria-hidden="true" width={16} height={16} />
            Códigos locales: un teléfono no los abre. Usa la IP de la red.
          </p>
        )}
        {committee &&
          baseUrl &&
          (committeeKey ? (
            <div className="nx-qr-hero">
              <QrCode url={roleJoinUrl(baseUrl, room.roomId, committee.orgId, committee.roleId, committeeKey)} label={`Código para entrar como ${committee.title}`} size={180} />
              <div style={{ minWidth: 200, flex: 1 }}>
                <h3>Escanea y decide: {committee.title}</h3>
                <p style={{ marginTop: 8 }}>
                  <State state={committee.connected ? "calm" : "plain"} icon={committee.connected ? CircleCheck : Hourglass}>
                    {committee.connected ? "Comité conectado" : "Esperando al Comité"}
                  </State>
                </p>
              </div>
            </div>
          ) : (
            <div className="nx-qr-hero">
              <div style={{ flex: 1 }}>
                <h3>Código del Comité: abre tu sala</h3>
              </div>
              <button
                type="button"
                className="gd-primary"
                disabled={opening}
                onClick={async () => {
                  setOpening(true);
                  await onOpenOwnRoom();
                  setOpening(false);
                }}
              >
                {opening ? "Abriendo…" : "Abrir mi propia sala"}
              </button>
            </div>
          ))}
        {baseUrl && (
          <div className="nx-qr-grid">
            {players.map(({ org, role }) => {
              const url = roleJoinUrl(baseUrl, room.roomId, org.orgId, role.id);
              return (
                <div key={`${org.orgId}/${role.id}`} className="nx-qr-item">
                  <QrCode url={url} label={`Código para entrar como ${role.title}`} size={120} />
                  <strong>{role.title}</strong>
                  {room.orgs.length > 1 && <span className="nx-meta">{org.orgName}</span>}
                  <span className="nx-meta" style={{ color: role.connected ? "var(--gd-calm)" : undefined }}>
                    {role.connected ? "Conectado" : "Libre"} ·{" "}
                    <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                      abrir <ExternalLink aria-hidden="true" width={11} height={11} style={{ display: "inline" }} />
                    </a>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ActaView({
  room,
  acta,
  host,
  onNotify,
  logOpen,
  onLogToggle,
  logRef,
}: {
  room: ProjectedRoomState;
  acta: { md: string; json: string };
  host: HostCredentials | null;
  onNotify?: () => void;
  logOpen: boolean;
  onLogToggle: (open: boolean) => void;
  logRef: React.RefObject<HTMLDetailsElement | null>;
}) {
  const telemetry = room.telemetry;
  const local = telemetry.provider === "local";
  return (
    <div className="gd-analytics">
      <div className="gd-analytics-grid">
        <Panel title="Decisiones con su razón">
          {room.decisions.length === 0 ? (
            <p className="gd-empty">Nadie ha firmado todavía.</p>
          ) : (
            <div className="nx-rank">
              {room.decisions.map((decision) => (
                <figure key={decision.ts} className="nx-rank-row" style={{ display: "block" }}>
                  <figcaption className="nx-meta">
                    {roleLabel(room, decision.byOrgId, decision.byRoleId)} · {decision.decision === "APPROVE" ? "aprobó" : decision.decision === "VETO" ? "vetó" : "propuso otro valor"}
                    {decision.scope === "allocation" ? " la asignación" : ` en ${orgLabel(room, decision.targetOrgId ?? decision.byOrgId)}`} · {formatTime(decision.ts)}
                  </figcaption>
                  <blockquote className="nx-quote" style={{ margin: "6px 0 0" }}>
                    «{decision.reason}»
                  </blockquote>
                </figure>
              ))}
            </div>
          )}
          <div className="gd-balance-actions" style={{ marginBottom: 0 }}>
            <a href={acta.md} download className="gd-primary">
              <FileDown aria-hidden="true" /> Descargar el acta
            </a>
            <a href={acta.json} download className="gd-secondary">
              <FileDown aria-hidden="true" /> Acta en JSON
            </a>
          </div>
        </Panel>
        <div className="gd-command-side" style={{ gridColumn: "auto" }}>
          <Panel title="Dónde corre el modelo">
            <p className="gd-approval-content" style={{ marginBottom: 10 }}>
              <State state={local ? "calm" : "sign"} icon={local ? ShieldCheck : TriangleAlert}>
                {local ? "Local: nada sale de la red" : "En la nube"}
              </State>
            </p>
            <div className="gd-streams">
              <div>
                <span>Modelo</span>
                <strong>{telemetry.modelName}</strong>
              </div>
              <div>
                <span>Enviado a la nube</span>
                <strong>{local && telemetry.bytesSentToCloud === 0 ? "nada" : `${telemetry.bytesSentToCloud} B`}</strong>
              </div>
            </div>
          </Panel>
          {host && <HostPanel room={room} credentials={host} onNotify={onNotify} />}
        </div>
      </div>
      <details ref={logRef} className="gd-panel nx-log" open={logOpen} onToggle={(event) => onLogToggle((event.currentTarget as HTMLDetailsElement).open)}>
        <summary>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ScrollText aria-hidden="true" /> Ver registro
            <span className="nx-meta">{room.auditLog.length} eventos</span>
          </span>
          <ChevronDown aria-hidden="true" className="nx-chevron" />
        </summary>
        <AuditTable room={room} acta={acta} />
      </details>
    </div>
  );
}

/** Controles del presentador con el estilo del panel: avisar al Comité, ensayo automático y reiniciar. */
function HostPanel({ room, credentials, onNotify }: { room: ProjectedRoomState; credentials: HostCredentials; onNotify?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const running = room.autopilot?.running ?? false;
  async function run(id: string, path: "" | "/autopilot", method: "POST" | "DELETE", body: Record<string, unknown> | undefined, ok: string) {
    setBusy(id);
    setMessage(null);
    const result = await hostRequest(room.roomId, credentials, path, method, body);
    setBusy(null);
    setMessage(result.ok ? ok : (result.error ?? "No se pudo."));
  }
  return (
    <Panel title="Controles del presentador" subtitle={room.autopilot?.lastStep ? `Ensayo: ${room.autopilot.lastStep}` : undefined}>
      <div className="gd-balance-actions" style={{ margin: 0 }}>
        {onNotify && (
          <button type="button" className="gd-primary" onClick={onNotify}>
            <BellRing aria-hidden="true" /> Avisar al Comité
          </button>
        )}
        {running ? (
          <button type="button" className="gd-secondary" disabled={busy !== null} onClick={() => run("stop", "/autopilot", "POST", { action: "stop" }, "Ensayo detenido.")}>
            <Square aria-hidden="true" /> Detener el ensayo
          </button>
        ) : (
          <button type="button" className="gd-secondary" disabled={busy !== null} onClick={() => run("start", "/autopilot", "POST", { action: "start" }, "Ensayo en marcha.")}>
            <Bot aria-hidden="true" /> Ensayo automático
          </button>
        )}
        <button
          type="button"
          className="gd-secondary"
          disabled={busy !== null}
          onClick={() => {
            if (window.confirm("¿Reiniciar la sala? Todos deberán entrar de nuevo.")) void run("reset", "", "DELETE", undefined, "Sala reiniciada.");
          }}
        >
          <RotateCcw aria-hidden="true" /> Reiniciar la sala
        </button>
      </div>
      {message && (
        <p className="nx-meta" role="status" style={{ marginTop: 10 }}>
          {message}
        </p>
      )}
    </Panel>
  );
}

/** «Pregúntale al caso»: respuestas armadas con los datos de la sala, sin modelo. */
function AskDialog({ room, close }: { room: ProjectedRoomState; close: () => void }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const ask = (text: string) => {
    const clean = text.trim();
    if (clean) setAsked(clean);
  };
  return (
    <Dialog title="Pregúntale al caso" close={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label className="gd-search gd-command-input">
          <Search aria-hidden="true" />
          <input type="search" aria-label="Tu pregunta" placeholder="¿Quién va primero?" value={question} onChange={(event) => setQuestion(event.target.value)} />
        </label>
      </form>
      {asked && <p className="nx-answer" role="status">{answer(room, asked)}</p>}
      <div className="nx-suggest">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setQuestion(suggestion);
              ask(suggestion);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <p className="nx-meta" style={{ marginTop: 12 }}>
        Sin modelo. Sin datos reservados.
      </p>
    </Dialog>
  );
}
