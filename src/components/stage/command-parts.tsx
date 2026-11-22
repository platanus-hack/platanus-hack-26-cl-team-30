"use client";

// Piezas del centro de mando con las clases del panel de vidrio (.gd-*). Son
// componentes de presentación: reciben datos ya calculados desde la sala.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function Panel({ title, subtitle, action, className = "", children }: { title: string; subtitle?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`gd-panel ${className}`} aria-label={title}>
      <header className="gd-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Estado con significado: color + icono + palabra. */
export function State({ state, icon: Icon, children }: { state: "calm" | "sign" | "block" | "plain"; icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="nx-state" data-state={state}>
      <Icon aria-hidden="true" />
      {children}
    </span>
  );
}

export type ViewId = "mando" | "ranking" | "organizaciones" | "acta" | "preguntar";
export type ViewInfo = { id: ViewId; label: string; short: string; icon: LucideIcon };

/** Dock del panel base (lateral y flotante abajo) con su indicador deslizante. */
export function Dock({ views, active, side = false, select }: { views: ViewInfo[]; active: ViewId; side?: boolean; select: (view: ViewId) => void }) {
  const nav = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = nav.current;
    const indicator = marker.current;
    if (!container || !indicator) return;
    const adjust = () => {
      const current = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) return;
      indicator.style.width = `${current.offsetWidth}px`;
      indicator.style.height = `${current.offsetHeight}px`;
      indicator.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
      indicator.dataset.ready = "true";
    };
    const observer = new ResizeObserver(adjust);
    observer.observe(container);
    container.querySelectorAll("a").forEach((link) => observer.observe(link));
    adjust();
    // La fuente llega después del primer render y cambia el ancho de los textos.
    void document.fonts?.ready.then(adjust);
    return () => observer.disconnect();
  }, [active]);

  const onSelect = (event: MouseEvent<HTMLAnchorElement>, id: ViewId) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    select(id);
  };

  return (
    <nav ref={nav} className={side ? "gd-dock gd-dock-side" : "gd-dock gd-dock-bottom"} aria-label={side ? "Accesos rápidos" : "Secciones de la pantalla grande"}>
      <span ref={marker} className="gd-dock-indicator" aria-hidden="true" />
      {views.map(({ id, label, short, icon: Icon }) => (
        <a href={`#${id}`} key={id} aria-label={label} aria-current={active === id ? "page" : undefined} onClick={(event) => onSelect(event, id)}>
          <Icon aria-hidden="true" />
          <span className="gd-dock-text" aria-hidden="true">
            {label}
          </span>
          <span className="gd-dock-short" aria-hidden="true">
            {short}
          </span>
          {side && (
            <span className="gd-dock-tip" aria-hidden="true">
              {label}
            </span>
          )}
        </a>
      ))}
    </nav>
  );
}

/** Diálogo nativo con el estilo del panel. Se abre al montarse y avisa al cerrarse. */
export function Dialog({ title, children, close, light = false }: { title: string; children: ReactNode; close: () => void; light?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);
  return (
    <dialog
      className="gd-dialog"
      ref={ref}
      aria-label={title}
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      // Algunos contenidos usan la paleta clara de la app: en ese caso el diálogo va claro en ambos temas.
      style={light ? { background: "var(--card)", color: "var(--foreground)", maxInlineSize: "min(calc(100% - 26px), 560px)" } : undefined}
    >
      <section className="gd-dialog-inner">
        <header>
          <h2>{title}</h2>
          <button type="button" className="gd-icon-button" aria-label="Cerrar" onClick={() => ref.current?.close()}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        {children}
      </section>
    </dialog>
  );
}

/** «Nueva ronda»: el mismo reinicio del anfitrión. La sala conserva su id, sus claves y su modo. */
export function NewRoundButton({ onNewRound, label = "Nueva ronda", busyLabel = "Reiniciando…" }: { onNewRound: () => Promise<void>; label?: string; busyLabel?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="gd-primary nx-new-round"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onNewRound();
        setBusy(false);
      }}
    >
      <RotateCcw aria-hidden="true" /> {busy ? busyLabel : label}
    </button>
  );
}
