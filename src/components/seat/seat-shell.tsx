"use client";

import { useId, type ReactNode } from "react";
import { CircleCheck, Clock3, Hourglass, Lock, LoaderCircle, TriangleAlert, Users, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "@/lib/client/use-room";
import type { AccentColor, StakesView } from "@/lib/genome/schema";
import { Mark, SCULPTOR_HOME } from "@/components/landing/mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { formatClock } from "@/components/organs/format";
import "./seat.css";

export type SeatTab = "turn" | "secrets" | "room";

const TABS: { id: SeatTab; label: string; Icon: typeof Clock3 }[] = [
  { id: "turn", label: "Tu turno", Icon: Clock3 },
  { id: "secrets", label: "Secretos", Icon: Lock },
  { id: "room", label: "Sala", Icon: Users },
];

type Props = {
  /** Quién ocupa esta silla. Sin rol todavía, solo el nombre de la sala. */
  who: { title: string; org?: string; accent?: AccentColor };
  /** Lo que está en juego, con el reloj del servidor. null mientras conecta. */
  stakes: StakesView | null;
  status: ConnectionStatus;
  /** Pestaña activa. Sin ella no se dibuja la barra de pestañas (entrada y revelación). */
  tab?: SeatTab;
  onTab?: (tab: SeatTab) => void;
  /** Marca «Tu turno» con un punto cuando hay algo que hacer y se mira otra pestaña. */
  turnPending?: boolean;
  /** Aviso corto de la conexión o del último rechazo del servidor. */
  alert?: string | null;
  /** Cada vista entrega su <SeatMain> y, si tiene acción, sus <SeatActions>. */
  children: ReactNode;
};

/**
 * Armazón de la silla de un rol en el celular: arriba quién soy y cuánto se
 * lleva esperando, el pulso, el contenido, y abajo la zona del pulgar (botón
 * primario y pestañas). Todo cabe en el alto de la pantalla; solo el contenido
 * se desplaza si el teléfono es muy bajo.
 */
export function SeatShell({ who, stakes, status, tab, onTab, turnPending = false, alert, children }: Props) {
  const waiting = stakes ? stakes.status === "BLEEDING" : true;
  const elapsed = stakes ? (stakes.timeToDecisionMs ?? stakes.elapsedMs) : 0;

  return (
    <div className="seat" data-accent={who.accent}>
      <header className="st-top">
        {/* Logo oficial, sin animación, como en los demás encabezados de la app. */}
        <a href={SCULPTOR_HOME} target="_blank" rel="noopener" aria-label="Abrir la landing de Sculptor en otra pestaña" style={{ display: "inline-flex" }}>
          <Mark size={26} title="Sculptor" />
        </a>
        <div className="st-who">
          <span className="st-dot" aria-hidden />
          <div style={{ minWidth: 0 }}>
            <strong>{who.title}</strong>
            {who.org && <small>{who.org}</small>}
          </div>
        </div>
        {status !== "connected" ? (
          <span className="st-timer" data-state="plain" role="status">
            {status === "connecting" ? <LoaderCircle className="animate-spin" aria-hidden /> : <WifiOff aria-hidden />}
            {status === "connecting" ? "Conectando" : "Reconectando"}
          </span>
        ) : (
          stakes && (
            <span className="st-timer" data-state={waiting ? "wait" : "done"} role="timer">
              {waiting ? <Hourglass aria-hidden /> : <CircleCheck aria-hidden />}
              <span className="st-sr">{waiting ? "Esperando hace" : "Resuelto en"}</span>
              {formatClock(elapsed)}
            </span>
          )
        )}
        {/* Modo claro/oscuro, el mismo botón de todas las pantallas; se recuerda entre páginas. */}
        <ThemeToggle size={18} className="st-theme" />
      </header>

      <Ecg beating={waiting} />

      {alert && (
        <p role="alert" className="st-alert st-banner">
          <TriangleAlert aria-hidden />
          {alert}
        </p>
      )}

      {children}

      {tab && onTab && (
        <nav className="st-tabs" role="tablist" aria-label="Secciones de tu silla">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="tab" className="st-tab" aria-selected={tab === id} onClick={() => onTab(id)}>
              <Icon aria-hidden />
              {label}
              {id === "turn" && turnPending && tab !== "turn" && (
                <span className="st-tab-flag">
                  <span className="st-sr">Te toca</span>
                </span>
              )}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Zona de contenido. El aviso de demostración va una sola vez, pequeño, al pie. */
export function SeatMain({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <main className="st-main" aria-label={label}>
      {children}
      <p className="st-foot" role="note">
        Demostración simulada: los datos no son reales.
      </p>
    </main>
  );
}

/** Botones anclados sobre las pestañas, en la zona del pulgar. */
export function SeatActions({ children, stack = false }: { children: ReactNode; stack?: boolean }) {
  return (
    <div className="st-actions" data-stack={stack}>
      {children}
    </div>
  );
}

// Trazos de 160 px que se repiten: un latido mientras se espera y una línea
// plana cuando la decisión quedó sellada.
const BEAT = "M0 14 H44 L50 11 L56 14 H66 L72 2 L80 26 L87 8 L92 14 H112 L120 10 L128 14 H160";
const REST = "M0 14 H160";

/** Pulso bajo la barra superior: rojo y en movimiento al esperar; verde y plano al sellar. */
function Ecg({ beating }: { beating: boolean }) {
  const id = useId();
  return (
    <div className="st-ecg" data-state={beating ? "wait" : "done"} aria-hidden>
      {(["beat", "rest"] as const).map((kind) => (
        <svg key={kind} className={`st-ecg-${kind}`} preserveAspectRatio="none">
          <defs>
            <pattern id={`${id}-${kind}`} width="160" height="28" patternUnits="userSpaceOnUse">
              <path
                d={kind === "beat" ? BEAT : REST}
                fill="none"
                stroke={kind === "beat" ? "var(--st-wait)" : "var(--st-done)"}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </pattern>
          </defs>
          <rect width="100%" height="28" fill={`url(#${id}-${kind})`} />
        </svg>
      ))}
    </div>
  );
}
