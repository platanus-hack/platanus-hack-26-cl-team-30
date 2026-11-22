// Estilos de la negociación entre agentes en la pantalla grande (negotiation-view.tsx).
// Usan las variables del centro de mando (command-styles.ts): la paleta oficial de
// docs/DISENO.md en claro y oscuro. Todo se lee desde el fondo de la sala: nada
// baja de 15 px y los mensajes del debate van a 24–36 px, en dos líneas como máximo.

export const negotiationStyles = `
.nx-ng { --nx-ng-accent: var(--nx-current); }
.gd-app:not([data-theme="dark"]) .nx-ng { --nx-ng-accent: var(--gd-ink); }

/* ── Unirse: el código gigante junto al código QR ─────────────────────── */
.nx-ng-join { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: clamp(20px, 3vw, 56px); }
.nx-ng-label { font-size: clamp(18px, 1.6vw, 26px); font-weight: 760; color: var(--gd-muted); }
.nx-ng-code { font-size: clamp(88px, 15.5vw, 236px); font-weight: 850; line-height: .92; letter-spacing: .05em; color: var(--nx-ng-accent);
  font-variant-numeric: tabular-nums; margin-block: 6px 10px; white-space: nowrap; }
.nx-ng-code[data-small="true"] { font-size: clamp(40px, 4.4vw, 68px); margin: 0; }
.nx-ng-count { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 16px; font-size: clamp(22px, 2.1vw, 34px); font-weight: 720; color: var(--gd-muted); }
.nx-ng-tally { font-size: clamp(56px, 6.4vw, 104px); line-height: 1; color: var(--gd-ink); font-weight: 850; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.nx-ng-count[data-compact="true"] { margin-block-start: 10px; font-size: clamp(18px, 1.5vw, 24px); }
.nx-ng-count[data-compact="true"] .nx-ng-tally { font-size: clamp(32px, 3vw, 48px); }
.nx-ng-bots { white-space: nowrap; }
.nx-ng-bots svg { display: inline; inline-size: .9em; block-size: .9em; vertical-align: -.1em; }
.nx-ng-start { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 22px; margin-block-start: clamp(16px, 2vh, 28px); }
.gd-primary.nx-ng-start-btn { min-block-size: clamp(64px, 7.5vh, 88px); padding-inline: clamp(30px, 3vw, 48px); border-radius: 999px; font-size: clamp(26px, 2.4vw, 38px); font-weight: 850; gap: 14px; }
.gd-primary.nx-ng-start-btn svg { width: 1em; height: 1em; }
.nx-ng-start-btn:disabled { opacity: .7; cursor: progress; }
.nx-ng-start-note { font-size: clamp(16px, 1.3vw, 21px); font-weight: 650; color: var(--gd-muted); max-inline-size: 22em; }
.nx-ng-qr { flex-direction: column; align-items: center; gap: 14px; padding: clamp(16px, 1.6vw, 24px); }
.nx-ng-qr figcaption { max-inline-size: none; font-size: clamp(20px, 1.7vw, 28px); text-align: center; }

/* ── Los 5 asientos ───────────────────────────────────────────────────── */
.nx-ng-seats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: clamp(8px, 1vw, 14px); padding: 0; margin: 0; }
.nx-ng-seats li { list-style: none; display: grid; align-content: start; gap: 10px; min-inline-size: 0; padding: clamp(14px, 1.4vw, 22px);
  border-radius: 20px; border: 1px solid var(--gd-rim); border-block-start: 5px solid color-mix(in srgb, var(--nx-seat) 45%, transparent);
  background: var(--gd-card); color: var(--gd-muted); transition: border-color .5s ease, box-shadow .5s ease, color .5s ease, background .5s ease; }
.nx-ng-seat-who { display: grid; gap: 6px; min-inline-size: 0; }
.nx-ng-seat-who i { flex: none; inline-size: 16px; block-size: 16px; border-radius: 50%; border: 2.5px solid var(--nx-seat); transition: background .5s ease, box-shadow .5s ease; }
.nx-ng-seat-who small { display: flex; align-items: center; gap: 9px; min-block-size: 20px; font-size: clamp(15px, 1.15vw, 19px); font-weight: 700; line-height: 1.2; white-space: nowrap; }
.nx-ng-seat-who b { font-size: clamp(17px, 1.62vw, 27px); font-weight: 840; letter-spacing: -.03em; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nx-ng-seat-line { display: flex; align-items: center; gap: 8px; font-size: clamp(16px, 1.3vw, 21px); font-weight: 700; line-height: 1.2; }
.nx-ng-seat-line svg { width: 20px; height: 20px; stroke-width: 3; color: var(--gd-calm); }
.nx-ng-auto { display: inline-flex; align-items: center; gap: 6px; justify-self: start; border-radius: 999px; padding: 4px 10px; font-size: 15px; font-weight: 750;
  color: var(--gd-ink); background: var(--gd-inner); border: 1px solid var(--gd-rim); }
.nx-ng-auto svg { width: 15px; height: 15px; }
.nx-ng-seats li[data-on="true"] { color: var(--gd-ink); border-color: color-mix(in srgb, var(--nx-seat) 75%, transparent); border-block-start-color: var(--nx-seat);
  background: linear-gradient(180deg, color-mix(in srgb, var(--nx-seat) 16%, transparent), transparent 70%), var(--gd-card);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--nx-seat) 40%, transparent), 0 12px 34px color-mix(in srgb, var(--nx-seat) 22%, transparent); animation: nx-ng-lit .9s ease-out; }
.nx-ng-seats li[data-on="true"] .nx-ng-seat-who i { background: var(--nx-seat); box-shadow: 0 0 16px color-mix(in srgb, var(--nx-seat) 75%, transparent); }
@keyframes nx-ng-lit { 0% { transform: scale(.96); } 45% { transform: scale(1.03); } 100% { transform: scale(1); } }

/* Posturas: los asientos son la pantalla; la postura se lee de lejos. */
.nx-ng-head { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.nx-ng-title { font-size: clamp(34px, 4.2vw, 68px); font-weight: 840; letter-spacing: -.04em; line-height: 1.02; }
.nx-ng-late { display: flex; align-items: center; gap: 22px; }
.nx-ng-seats[data-mode="positions"] li { min-block-size: clamp(200px, 42vh, 400px); gap: 18px; }
.nx-ng-seats[data-mode="positions"] .nx-ng-seat-line { align-items: flex-start; font-size: clamp(20px, 1.95vw, 32px); font-weight: 780; letter-spacing: -.02em; line-height: 1.12; text-wrap: balance; }
.nx-ng-seats[data-mode="positions"] li[data-on="false"] .nx-ng-seat-line { font-size: clamp(16px, 1.3vw, 21px); font-weight: 650; }
.nx-ng-seats[data-mode="positions"] .nx-ng-seat-line svg { width: 26px; height: 26px; margin-block-start: 3px; }
.nx-ng-seats[data-mode="positions"] .nx-ng-auto { align-self: end; }

/* ── Debate: asientos a un costado y la conversación al centro ────────── */
.nx-ng-debate { display: grid; grid-template-columns: minmax(230px, 19%) minmax(0, 1fr); gap: clamp(16px, 2vw, 30px); align-items: start; }
.nx-ng-seats[data-mode="rail"] { grid-template-columns: minmax(0, 1fr); gap: 6px; }
.nx-ng-seats[data-mode="rail"] li { padding: 8px 13px; gap: 3px; border-radius: 16px; border-block-start-width: 1px; border-inline-start: 5px solid var(--nx-seat); animation: none; box-shadow: none; }
.nx-ng-seats[data-mode="rail"] .nx-ng-seat-who { gap: 0; }
.nx-ng-seats[data-mode="rail"] .nx-ng-seat-who small { font-size: 15px; }
.nx-ng-seats[data-mode="rail"] .nx-ng-seat-who b { font-size: clamp(17px, 1.3vw, 21px); }
.nx-ng-seats[data-mode="rail"] .nx-ng-seat-line { font-size: 15px; font-weight: 650; color: var(--gd-muted); }
.nx-ng-seats[data-mode="rail"] .nx-ng-auto { display: none; }

.nx-chat { display: grid; align-content: end; gap: clamp(8px, .9vw, 13px); padding: 0; margin: 0; min-block-size: clamp(320px, 47vh, 500px); }
.nx-chat-empty { list-style: none; align-self: center; justify-self: center; font-size: clamp(22px, 2vw, 32px); font-weight: 700; color: var(--gd-muted); }
.nx-msg { list-style: none; display: grid; gap: 5px; justify-self: start; max-inline-size: min(86%, 31em); font-size: clamp(22px, 2.1vw, 34px);
  padding: clamp(10px, 1vw, 15px) clamp(18px, 1.8vw, 28px); border-radius: 26px; border: 1px solid var(--gd-rim); border-inline-start: 6px solid var(--nx-seat);
  background: var(--gd-surface); box-shadow: 0 10px 28px rgb(var(--gd-dark-shadow) / 14%); color: var(--gd-ink); transition: color .5s ease; }
.nx-msg[data-side="right"] { justify-self: end; border-inline-start: 1px solid var(--gd-rim); border-inline-end: 6px solid var(--nx-seat); }
.nx-msg[data-side="center"] { justify-self: center; border-inline-start-width: 1px; box-shadow: none; }
/* Lo ya dicho se apaga en el texto, no en la burbuja: el fondo sigue tapando la galaxia. */
.nx-msg[data-last="false"] { color: var(--gd-muted); box-shadow: none; }
.nx-msg[data-last="false"] .nx-msg-who { opacity: .8; }
.nx-msg[data-last="true"], .nx-typing { animation: nx-msg-in .55s cubic-bezier(.2, .8, .2, 1); }
.nx-msg-who { display: flex; align-items: center; gap: 9px; font-size: clamp(16px, 1.3vw, 21px); font-weight: 800; letter-spacing: -.01em; color: var(--nx-seat); }
.nx-msg-who i { flex: none; inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--nx-seat); }
.nx-msg-text { font-size: 1em; font-weight: 660; letter-spacing: -.022em; line-height: 1.16; text-wrap: pretty;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.nx-typing .nx-msg-text { display: flex; align-items: center; gap: 14px; }
.nx-typing-word { font-size: clamp(18px, 1.5vw, 24px); font-weight: 650; color: var(--gd-muted); }
.nx-dots { display: inline-flex; gap: 7px; }
.nx-dots b { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--nx-seat); animation: nx-dot 1.1s ease-in-out infinite; }
.nx-dots b:nth-child(2) { animation-delay: .16s; }
.nx-dots b:nth-child(3) { animation-delay: .32s; }
@keyframes nx-msg-in { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
@keyframes nx-dot { 0%, 70%, 100% { transform: translateY(0); opacity: .45; } 35% { transform: translateY(-7px); opacity: 1; } }

/* ── Propuesta: primero el código calcula, después la tarjeta emerge ──── */
.nx-calculating { border-inline-start-width: 1px; border-style: dashed; border-color: var(--nx-ng-accent); background: var(--gd-surface); }
.nx-calculating .nx-msg-who { color: var(--nx-ng-accent); }
.nx-calculating .nx-dots b { background: var(--nx-ng-accent); }
.nx-calculating .nx-typing-word { color: var(--gd-ink); font-weight: 760; }
/* La tarjeta ocupa el lugar de la conversación, centrada en el alto que dejaba el chat. */
.nx-ng-stagecard { display: grid; align-content: center; min-block-size: clamp(320px, 47vh, 500px); }
.nx-ng-stagecard .nx-proposal.gd-panel { grid-template-columns: minmax(0, 1fr); gap: clamp(16px, 2vw, 28px); }
.nx-ng-stagecard .nx-proposal-title { font-size: clamp(36px, 4.3vw, 70px); }
.nx-ng-stagecard .nx-proposal-score { font-size: clamp(56px, 6.4vw, 104px); }
.nx-proposal.gd-panel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); align-items: center; gap: clamp(18px, 2.6vw, 44px);
  padding: clamp(20px, 2.4vw, 38px) clamp(22px, 2.8vw, 44px); border: 2px solid var(--nx-current); transform-origin: 50% 0; animation: nx-emerge .8s cubic-bezier(.2, .9, .25, 1); }
.nx-proposal[data-sealed="true"] { border-color: var(--gd-calm); animation: none; }
.nx-proposal-kicker { font-size: clamp(17px, 1.4vw, 22px); font-weight: 780; color: var(--nx-ng-accent); }
.nx-proposal[data-sealed="true"] .nx-proposal-kicker { color: var(--gd-calm); }
.nx-proposal-title { font-size: clamp(32px, 3.7vw, 60px); font-weight: 840; letter-spacing: -.04em; line-height: 1.03; margin-block: 8px 12px; text-wrap: balance; }
.nx-proposal-title[data-quote="true"] { font-size: clamp(26px, 2.9vw, 46px); letter-spacing: -.03em; line-height: 1.08; }
.nx-proposal-note { font-size: clamp(16px, 1.3vw, 21px); font-weight: 600; color: var(--gd-muted); }
.nx-proposal-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 0; margin: 0; }
.nx-proposal-list li { list-style: none; display: grid; gap: 4px; padding: clamp(14px, 1.5vw, 22px); border-radius: 18px; border: 1px solid var(--gd-rim); background: var(--gd-inner); color: var(--gd-muted); }
.nx-proposal-list li[data-winner="true"] { color: var(--gd-ink); border: 2px solid var(--nx-current); background: color-mix(in srgb, var(--nx-current) 12%, var(--gd-inner)); }
.nx-proposal[data-sealed="true"] .nx-proposal-list li[data-winner="true"] { border-color: var(--gd-calm); background: color-mix(in srgb, var(--gd-calm) 12%, var(--gd-inner)); }
.nx-proposal-org { display: flex; align-items: center; gap: 8px; font-size: clamp(18px, 1.6vw, 26px); font-weight: 800; letter-spacing: -.02em; }
.nx-proposal-org svg { width: 22px; height: 22px; color: var(--nx-ng-accent); fill: currentColor; }
.nx-proposal-score { font-size: clamp(46px, 5.4vw, 88px); font-weight: 850; letter-spacing: -.045em; line-height: 1; font-variant-numeric: tabular-nums; color: var(--gd-ink); }
.nx-proposal-list li[data-winner="false"] .nx-proposal-score { color: var(--gd-muted); }
.nx-proposal-score small { font-size: .38em; font-weight: 750; letter-spacing: -.01em; color: var(--gd-muted); margin-inline-start: 4px; }
.nx-proposal-case { font-size: clamp(16px, 1.3vw, 21px); font-weight: 700; color: var(--gd-muted); }
.nx-proposal-locks { display: flex; flex-wrap: wrap; gap: 6px; }
.nx-proposal-lock { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 4px 11px; font-size: 15px; font-weight: 700;
  color: var(--gd-muted); background: var(--gd-inner); border: 1px dashed var(--gd-rim); }
.nx-proposal-lock svg { width: 14px; height: 14px; }
@keyframes nx-emerge { 0% { opacity: 0; transform: translateY(-46px) scale(.9); } 60% { opacity: 1; } 100% { opacity: 1; transform: none; } }
.nx-ng-done-icon { display: inline; inline-size: .8em; block-size: .8em; vertical-align: -.08em; }

/* ── Narrador: discreto, al pie ───────────────────────────────────────── */
.nx-narrator { display: flex; align-items: center; gap: 10px; opacity: .78; transition: opacity .2s ease; }
.nx-narrator:hover, .nx-narrator:focus-within { opacity: 1; }
.nx-narrator-btn { display: inline-flex; align-items: center; gap: 7px; min-block-size: 44px; padding-inline: 16px; border-radius: 999px; border: 1px solid var(--gd-rim);
  background: var(--gd-inner); color: var(--gd-ink); font-size: 15px; font-weight: 750; white-space: nowrap; }
.nx-narrator-btn:hover { background: var(--gd-raised); }
.nx-narrator-btn svg { width: 16px; height: 16px; }
.nx-narrator-track { flex: 1; block-size: 6px; border-radius: 999px; background: var(--gd-track); overflow: hidden; }
.nx-narrator-fill { display: block; block-size: 100%; border-radius: inherit; background: var(--nx-ng-accent); transform: scaleX(0); transform-origin: 0 50%; }
.nx-narrator-track[data-paused="true"] .nx-narrator-fill { background: var(--gd-sign); }
.nx-narrator-state { min-inline-size: 11ch; font-size: 15px; font-weight: 700; color: var(--gd-muted); text-align: end; white-space: nowrap; }

@media (max-width: 1060px) {
  .nx-ng-debate { grid-template-columns: minmax(0, 1fr); }
  .nx-ng-seats[data-mode="rail"] { display: none; }
  .nx-proposal.gd-panel { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .nx-ng-join { grid-template-columns: minmax(0, 1fr); }
  .nx-ng-seats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nx-ng-seats[data-mode="positions"] li { min-block-size: 0; }
  .nx-ng-head { flex-direction: column; align-items: flex-start; }
  .nx-msg { max-inline-size: 100%; }
  /* En un celular la conversación va sin alto mínimo y cada mensaje se lee entero (hasta 4 líneas). */
  .nx-chat, .nx-ng-stagecard { min-block-size: 0; }
  .nx-msg-text { -webkit-line-clamp: 4; line-clamp: 4; }
  .nx-narrator { flex-wrap: wrap; }
  .nx-narrator-track { flex-basis: 100%; order: 3; }
}
@media (prefers-reduced-motion: reduce) {
  .nx-ng-seats li, .nx-msg, .nx-typing, .nx-proposal.gd-panel, .nx-dots b { animation: none !important; transition: none !important; }
  .nx-dots b { opacity: .8; }
}
`;
