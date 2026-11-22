// Estilos del centro de mando de la pantalla grande. La base es el CSS de
// src/components/ui/glassy-dashboard.tsx (clases .gd-*, variables --gd-* y
// data-theme claro/oscuro), copiado tal cual por un script para no divergir a
// mano. Al final se agregan las piezas propias de Sculptor (prefijo .nx-*): colores
// con significado, tipografía más grande para proyectar y los bloques de la sala.
// Si cambia el panel base, volver a copiar su bloque dashboardStyles aquí.

export const commandStyles = `
.gd-app {
  --gd-ink: #24403a;
  --gd-muted: #4d6860;
  --gd-line: rgb(36 64 58 / 14%);
  --gd-grid: rgb(36 64 58 / 17%);
  --gd-rim: rgb(255 253 248 / 62%);
  --gd-edge-light: rgb(255 255 252 / 88%);
  --gd-edge-shade: rgb(36 64 58 / 15%);
  --gd-gloss: rgb(255 253 248 / 52%);
  --gd-frame: rgb(234 245 241 / 34%);
  --gd-rail: rgb(234 245 241 / 62%);
  --gd-card: rgb(255 253 248 / 55%);
  --gd-card-light: rgb(255 255 252 / 40%);
  --gd-raised: rgb(255 253 248 / 88%);
  --gd-inner: rgb(234 245 241 / 52%);
  --gd-surface: #fffdf8;
  --gd-track: rgb(36 64 58 / 12%);
  --gd-primary: #24403a;
  --gd-primary-ink: #fffdf8;
  --gd-pick: #fffdf8;
  --gd-pick-ink: #24403a;
  --gd-coral: #8f5743;
  --gd-teal: #4f7c6d;
  --gd-ochre: #8a6a1d;
  --gd-graph-ink: #4d6860;
  --gd-focus: #4f7c6d;
  --gd-dark-shadow: 36 64 58;
  --gd-bg: #cfeae3;
  --gd-wash: radial-gradient(circle at 12% 18%, rgb(111 175 155 / 38%), transparent 42%),
    radial-gradient(circle at 88% 78%, rgb(197 143 123 / 30%), transparent 44%),
    radial-gradient(circle at 70% 8%, rgb(255 253 248 / 70%), transparent 38%),
    linear-gradient(160deg, #eaf5f1, #cfeae3 55%, #f6e9e3);
  inline-size: 100%;
  min-inline-size: 0;
  flex: 1 1 100%;
  position: relative;
  isolation: isolate;
  min-block-size: 100svh;
  background: var(--gd-bg);
  color: var(--gd-ink);
  color-scheme: light;
  font-family: var(--font-manrope), "Manrope Variable", Manrope, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}
.gd-app[data-theme="dark"] {
  --gd-ink: #fffdf8;
  --gd-muted: #b4b4ac;
  --gd-line: rgb(255 253 248 / 13%);
  --gd-grid: rgb(255 253 248 / 13%);
  --gd-rim: rgb(255 253 248 / 15%);
  --gd-edge-light: rgb(255 253 248 / 20%);
  --gd-edge-shade: rgb(0 0 0 / 45%);
  --gd-gloss: rgb(255 253 248 / 6%);
  --gd-frame: rgb(34 34 32 / 58%);
  --gd-rail: rgb(34 34 32 / 74%);
  --gd-card: rgb(34 34 32 / 72%);
  --gd-card-light: rgb(80 80 76 / 22%);
  --gd-raised: rgb(48 48 45 / 92%);
  --gd-inner: rgb(255 253 248 / 6%);
  --gd-surface: #222220;
  --gd-track: rgb(255 253 248 / 12%);
  --gd-primary: #6faf9b;
  --gd-primary-ink: #151515;
  --gd-pick: #e1ff00;
  --gd-pick-ink: #151515;
  --gd-coral: #e0a891;
  --gd-teal: #8fd3bd;
  --gd-ochre: #f1be58;
  --gd-graph-ink: #d7e6e0;
  --gd-focus: #e1ff00;
  --gd-dark-shadow: 0 0 0;
  --gd-bg: #151515;
  --gd-wash: radial-gradient(circle at 12% 18%, rgb(111 175 155 / 20%), transparent 44%),
    radial-gradient(circle at 88% 80%, rgb(197 143 123 / 14%), transparent 44%),
    radial-gradient(circle at 60% 5%, rgb(225 255 0 / 5%), transparent 35%),
    linear-gradient(160deg, #1b1b1a, #151515 60%, #10100f);
  color-scheme: dark;
}

.gd-app *, .gd-app *::before, .gd-app *::after { box-sizing: border-box; }
.gd-app :where(button, input, select) { color: inherit; font: inherit; }
.gd-app :where(button, a, input, select):focus-visible { outline: 2px solid var(--gd-focus); outline-offset: 3px; }
.gd-app a { color: inherit; text-decoration: none; }
.gd-app button { cursor: pointer; }
.gd-app :where(h1, h2, h3, p, figure) { margin: 0; }
.gd-app svg { flex: none; }
.gd-sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

.gd-background, .gd-app::before {
  position: fixed;
  z-index: -2;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  pointer-events: none;
}
.gd-background {
  object-fit: cover;
  object-position: center 60%;
  filter: saturate(.8) brightness(.95);
}
.gd-app::before {
  content: "";
  z-index: -1;
  background: var(--gd-wash);
}
.gd-app[data-has-image="true"]::before { opacity: .72; }
.gd-app[data-theme="dark"] .gd-background { filter: saturate(.7) brightness(.5); }
.gd-surround {
  inline-size: min(calc(100% - 100px), 1380px);
  margin-inline: auto;
  padding-block: 24px 8px;
}
.gd-top, .gd-dock {
  border: 1px solid var(--gd-rim);
  background: linear-gradient(165deg, var(--gd-gloss), transparent 32% 73%, var(--gd-gloss)), var(--gd-rail);
  box-shadow: inset 1px 1px 1px var(--gd-edge-light), inset -1px -1px 1px var(--gd-edge-shade),
    inset 0 -2px 5px var(--gd-gloss), 0 7px 20px rgb(var(--gd-dark-shadow) / 17%);
  backdrop-filter: blur(15px) saturate(1.35);
  -webkit-backdrop-filter: blur(15px) saturate(1.35);
}
.gd-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 400px) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-block-size: 60px;
  border-radius: 999px;
  padding: 6px 9px 6px 13px;
}
.gd-brand { display: flex; align-items: center; gap: 10px; min-inline-size: 0; padding-inline-start: 3px; }
.gd-logo {
  inline-size: 35px; block-size: 35px; display: grid; place-items: center;
  border-radius: 50%; background: var(--gd-pick); color: var(--gd-pick-ink);
  box-shadow: inset 0 0 0 1px var(--gd-gloss), 0 2px 7px rgb(var(--gd-dark-shadow) / 12%);
}
.gd-logo svg { width: 22px; height: 22px; }
.gd-brand strong { display: block; font-size: 12px; letter-spacing: .17em; line-height: 1.1; font-weight: 850; }
.gd-brand small { display: block; margin-block-start: 3px; font-size: 10px; color: var(--gd-muted); }
.gd-ask {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-block-size: 43px;
  max-inline-size: 100%;
  border: 1px solid var(--gd-line);
  border-radius: 999px;
  background: var(--gd-inner);
  box-shadow: inset 0 1px 0 var(--gd-gloss);
  padding: 4px 13px 4px 9px;
  text-align: start;
}
.gd-ask:hover, .gd-icon-button:hover { background: var(--gd-raised); }
.gd-orb {
  flex: none;
  inline-size: 25px;
  block-size: 25px;
  border-radius: 50%;
  background:
    radial-gradient(ellipse at 32% 24%, #fffdf8 5%, #cfeae3 26%, transparent 58%),
    radial-gradient(ellipse at 67% 54%, #9fd2c1, #6faf9b 50%, #24403a 82%);
  box-shadow: inset 0 0 0 .75px rgb(255 253 248 / 75%), inset 0 -2px 5px #4f7c6d, 0 0 0 3px rgb(79 124 109 / 14%), 0 2px 8px rgb(36 64 58 / 30%);
}
.gd-prompt {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-size: 12px; font-weight: 750;
  animation: gd-prompt-in .74s steps(28, end) both;
}
@keyframes gd-prompt-in { from { clip-path: inset(0 100% 0 0); } }
.gd-ask-search { margin-inline-start: auto; width: 15px; height: 15px; color: var(--gd-muted); }
.gd-top-actions { display: flex; justify-content: flex-end; gap: 6px; }
.gd-icon-button {
  position: relative; min-inline-size: 44px; min-block-size: 44px; display: inline-grid; place-items: center;
  border-radius: 999px; border: 1px solid var(--gd-line); padding: 0; background: var(--gd-inner);
}
.gd-icon-button svg { width: 17px; height: 17px; stroke-width: 1.75; }
.gd-notices { background: var(--gd-raised); }
.gd-notices i {
  position: absolute; block-size: 6px; inline-size: 6px; inset: 9px 9px auto auto; border-radius: 50%;
  background: var(--gd-coral); box-shadow: 0 0 0 2px var(--gd-surface);
}

.gd-stage-wrap { position: relative; margin-block: 11px 0; }
.gd-stage {
  color: var(--gd-ink);
  border: 1px solid var(--gd-rim);
  border-radius: 34px;
  background:
    linear-gradient(148deg, var(--gd-gloss), transparent 19% 77%, color-mix(in srgb, var(--gd-gloss) 48%, transparent)),
    var(--gd-frame);
  box-shadow: inset 1px 1px 1px var(--gd-edge-light), inset -1px -1px 1px var(--gd-edge-shade),
    inset 0 0 7px var(--gd-gloss),
    0 1px 3px rgb(var(--gd-dark-shadow) / 17%), 0 22px 72px rgb(var(--gd-dark-shadow) / 22%);
  backdrop-filter: blur(var(--gd-panel-frost, 12px)) saturate(1.24);
  -webkit-backdrop-filter: blur(var(--gd-panel-frost, 12px)) saturate(1.24);
}
.gd-stage-scroll {
  block-size: max(605px, min(865px, calc(100svh - 165px)));
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--gd-line) transparent;
  border-radius: inherit;
  padding: clamp(19px, 2.15vw, 35px) clamp(25px, 3.2vw, 49px) 41px;
}
.gd-view-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 22px;
  margin-block-end: 19px;
}
.gd-view-head h1 {
  font-size: clamp(29px, 3.35vw, 49px);
  font-weight: 760;
  line-height: 1.03;
  letter-spacing: -.062em;
}
.gd-view-head p { color: var(--gd-muted); font-size: 13px; margin-block-start: 8px; }
.gd-view-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
.gd-period {
  display: inline-flex; align-items: center; padding: 3px; border-radius: 999px;
  border: 1px solid var(--gd-rim); background: var(--gd-inner);
  box-shadow: inset 0 1px 0 var(--gd-gloss);
}
.gd-period button {
  min-block-size: 35px; min-inline-size: 56px; border: 0; border-radius: 999px; background: transparent;
  padding: 0 11px; font-size: 11px; font-weight: 750; white-space: nowrap;
}
.gd-period button[aria-pressed="true"] { background: var(--gd-primary); color: var(--gd-primary-ink); }
.gd-period button[aria-pressed="false"]:hover { background: var(--gd-inner); }

.gd-primary, .gd-secondary {
  display: inline-flex; justify-content: center; align-items: center; gap: 7px;
  min-block-size: 40px; padding: 7px 12px;
  font-size: 11.5px; font-weight: 790; line-height: 1.2; border-radius: 999px;
  border: 1px solid transparent;
}
.gd-primary { background: var(--gd-primary); color: var(--gd-primary-ink); }
.gd-secondary { background: var(--gd-raised); border-color: var(--gd-rim); color: var(--gd-ink); }
.gd-primary:hover { filter: brightness(1.12); }
.gd-secondary:hover { background: var(--gd-surface); }
.gd-primary svg, .gd-secondary svg { width: 14px; height: 14px; }
.gd-export { white-space: nowrap; }
.gd-content { min-inline-size: 0; }
.gd-analytics, .gd-command-grid, .gd-command-side, .gd-summary, .gd-metric-grid, .gd-analytics-grid { display: grid; gap: 12px; }
.gd-command-grid { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr) minmax(0, 1.05fr); align-items: stretch; }
.gd-command-side { grid-column: 1; align-content: start; }
.gd-command-grid > .gd-activity { grid-column: 2 / -1; }
.gd-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding: 6px; }
.gd-analytics-grid { grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr); }
.gd-metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.gd-panel, .gd-metric, .gd-summary {
  min-inline-size: 0;
  border: 1px solid var(--gd-rim);
  border-radius: 20px;
  background: linear-gradient(144deg, var(--gd-card-light), transparent 66%), var(--gd-card);
  box-shadow: inset 0 1px 1px var(--gd-edge-light), inset 0 -1px 1px var(--gd-edge-shade), 0 6px 18px rgb(var(--gd-dark-shadow) / 9%);
}
.gd-summary { border-radius: 20px; background: var(--gd-inner); }
.gd-summary .gd-metric { border-radius: 15px; }
.gd-panel { padding: 15px 16px; }
.gd-panel-head {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start;
  gap: 7px 12px; margin-block-end: 12px;
}
.gd-panel-head h2 { font-size: 14px; font-weight: 810; letter-spacing: -.024em; }
.gd-panel-head p { font-size: 11px; color: var(--gd-muted); margin-block-start: 3px; }
.gd-metric { display: flex; flex-direction: column; justify-content: space-between; min-block-size: 112px; padding: 11px 12px; }
.gd-metric[data-tone="teal"] {
  --gd-coral: #f6e9e3;
  --gd-teal: #e1ff00;
  --gd-muted: #eaf5f1;
  color: #fffdf8;
  border-color: rgb(207 234 227 / 55%);
  background: radial-gradient(ellipse at 5% -20%, #6faf9b, transparent 68%), linear-gradient(145deg, #4f7c6d, #24403a);
  box-shadow: inset 0 1px 2px rgb(234 245 241 / 45%), 0 6px 14px rgb(36 64 58 / 18%);
}
.gd-metric-head { display: flex; justify-content: space-between; align-items: center; gap: 4px; min-inline-size: 0; font-size: 11px; font-weight: 740; }
.gd-metric-icon, .gd-list-icon {
  display: grid; place-items: center; flex: none; color: inherit;
  inline-size: 28px; block-size: 28px; border-radius: 10px;
  background: var(--gd-inner); box-shadow: inset 0 1px 0 var(--gd-gloss);
}
.gd-metric-icon svg, .gd-list-icon svg { width: 14px; height: 14px; }
.gd-metric[data-tone="teal"] .gd-metric-icon { background: rgb(255 253 248 / 16%); }
.gd-metric-value { display: block; font-size: clamp(22px, 2.35vw, 35px); line-height: 1.05; margin-block: 3px 7px; letter-spacing: -.052em; font-weight: 815; }
.gd-summary .gd-metric-value { font-size: clamp(20px, 2vw, 31px); }
.gd-metric-caption, .gd-balance-change { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; color: var(--gd-muted); font-size: 10px; font-weight: 680; }
.gd-delta {
  display: inline-flex; align-items: center; gap: 2px; color: var(--gd-teal); font-weight: 850;
  border-radius: 6px; padding: 2px 4px;
  background: color-mix(in srgb, var(--gd-teal) 12%, transparent);
}
.gd-delta[data-attention="true"] { color: var(--gd-coral); background: color-mix(in srgb, var(--gd-coral) 11%, transparent); }
.gd-delta svg { width: 11px; height: 11px; stroke-width: 2.4; }

.gd-balance .gd-panel-head { align-items: center; margin-block-end: 9px; }
.gd-unit { border-radius: 6px; padding: 4px 6px; background: var(--gd-raised); font-size: 10px; font-weight: 810; }
.gd-balance-number { font-size: clamp(28px, 3.85vw, 57px); font-weight: 820; letter-spacing: -.077em; line-height: 1.02; }
.gd-balance-change { margin-block-start: 7px; }
.gd-balance-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-block: 13px 12px; }
.gd-streams { display: flex; border-radius: 12px; background: var(--gd-inner); padding: 8px 2px; }
.gd-streams div { flex: 1; min-inline-size: 0; padding: 0 7px; }
.gd-streams div + div { border-inline-start: 1px solid var(--gd-line); }
.gd-streams span, .gd-streams strong { display: block; }
.gd-streams span { font-size: 9px; color: var(--gd-muted); }
.gd-streams strong { font-size: 11px; font-weight: 810; margin-block-start: 4px; }
.gd-capacity .gd-panel-head, .gd-approvals .gd-panel-head { margin-block-end: 10px; }
.gd-capacity-track, .gd-mix-track { display: block; height: 7px; border-radius: 999px; overflow: hidden; background: var(--gd-track); }
.gd-capacity-track .gd-fill { display: block; block-size: 100%; border-radius: inherit; background: var(--gd-teal); transform-origin: left center; }
.gd-capacity-label { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; color: var(--gd-muted); font-size: 10px; margin-top: 8px; }
.gd-capacity-label strong { color: var(--gd-ink); }
.gd-approval-content { display: flex; align-items: center; gap: 9px; min-inline-size: 0; }
.gd-approval-content .gd-list-icon { inline-size: 37px; block-size: 37px; color: var(--gd-teal); background: color-mix(in srgb, var(--gd-teal) 12%, var(--gd-inner)); }
.gd-approval-content div { flex: 1; min-inline-size: 0; }
.gd-approval-content strong, .gd-approval-content small { display: block; }
.gd-approval-content strong { font-size: 12px; font-weight: 810; }
.gd-approval-content small { margin-top: 4px; font-size: 10px; color: var(--gd-muted); }
.gd-statement .gd-panel-head { margin-block-end: 8px; }

.gd-table-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; max-inline-size: 100%; }
.gd-search, .gd-filter {
  display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--gd-line); border-radius: 10px;
  background: var(--gd-inner); min-block-size: 35px; padding: 0 8px;
}
.gd-search svg, .gd-filter svg { width: 13px; height: 13px; color: var(--gd-muted); }
.gd-search input { width: 105px; flex: 1; min-inline-size: 0; border: 0; background: transparent; min-block-size: 33px; }
.gd-search input::placeholder { color: var(--gd-muted); opacity: 1; }
.gd-search input, .gd-filter select { font-size: 11px; }
.gd-filter select { border: 0; background: transparent; padding: 5px 0; min-inline-size: 0; }
.gd-filter select option { color: var(--gd-ink); background: var(--gd-surface); }
.gd-search:focus-within, .gd-filter:focus-within { outline: 2px solid var(--gd-focus); }
.gd-app .gd-search input:focus-visible, .gd-app .gd-filter select:focus-visible { outline: none; }
.gd-table-scroll { max-inline-size: 100%; overflow: auto; scrollbar-width: thin; }
.gd-table-scroll table { inline-size: 100%; border-spacing: 0; text-align: start; }
.gd-table-scroll th, .gd-table-scroll td { padding: 9px 10px; text-align: start; }
.gd-table-scroll th { background: var(--gd-inner); font-size: 10px; color: var(--gd-muted); font-weight: 800; }
.gd-table-scroll th:first-child { border-radius: 8px 0 0 8px; }
.gd-table-scroll th:last-child { border-radius: 0 8px 8px 0; }
.gd-table-scroll td { white-space: nowrap; font-size: 11px; }
.gd-table-scroll td:first-child { font-weight: 750; }
.gd-table-scroll tr + tr td { border-top: 1px solid var(--gd-line); }
.gd-status {
  --gd-status-color: var(--gd-graph-ink);
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 6px; border-radius: 999px; font-size: 10px; font-weight: 790;
  background: color-mix(in srgb, var(--gd-status-color) 11%, var(--gd-inner));
  color: var(--gd-status-color); white-space: nowrap;
}
.gd-status[data-state="teal"] { --gd-status-color: var(--gd-teal); }
.gd-status[data-state="coral"] { --gd-status-color: var(--gd-coral); }
.gd-status i { inline-size: 5px; block-size: 5px; border-radius: 50%; background: currentColor; }
.gd-empty { padding: 12px 3px; color: var(--gd-muted); font-size: 12px; }

.gd-app [data-tone="ink"] { --gd-series: var(--gd-graph-ink); }
.gd-app [data-tone="coral"] { --gd-series: var(--gd-coral); }
.gd-app [data-tone="teal"] { --gd-series: var(--gd-teal); }
.gd-app [data-tone="ochre"] { --gd-series: var(--gd-ochre); }
.gd-legend { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; color: var(--gd-muted); }
.gd-legend span, .gd-device-list button span:first-child { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 740; }
.gd-legend i, .gd-device-list button span:first-child i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--gd-series); }
.gd-stack-meta { display: flex; justify-content: space-between; align-items: center; height: 20px; gap: 4px; }
.gd-chart-readout { font-size: 10px; font-weight: 830; white-space: nowrap; }
.gd-stack-plot { display: grid; grid-template-columns: repeat(var(--gd-series-count), minmax(0, 1fr)); gap: 4px; block-size: 194px; margin-top: 5px; }
.gd-command-chart .gd-stack-plot { block-size: 141px; }
.gd-stack-column { display: flex; flex-direction: column; align-items: center; min-inline-size: 0; border: 0; border-radius: 8px; background: transparent; padding: 3px 0 0; }
.gd-stack-column:is(:focus-visible, :hover, [aria-pressed="true"]) { background: var(--gd-inner); }
.gd-stack-track { display: flex; justify-content: center; align-items: end; flex: 1; inline-size: 100%; border-bottom: 1px solid var(--gd-line); }
.gd-stack-bar {
  display: flex; flex-direction: column; transform-origin: center bottom;
  inline-size: min(65%, 40px); min-inline-size: 6px; border-radius: 6px 6px 3px 3px; overflow: hidden;
}
.gd-stack-bar i { display: block; flex-basis: 0; background: var(--gd-series); min-block-size: 2px; }
.gd-stack-bar i:first-child { background: repeating-linear-gradient(138deg, var(--gd-series) 0 4px, color-mix(in srgb, var(--gd-series) 76%, white) 4px 6px); }
.gd-stack-label { font-size: 9px; color: var(--gd-muted); margin-top: 7px; white-space: nowrap; }
.gd-revenue-main { display: grid; grid-template-columns: 38px minmax(0, 1fr); }
.gd-chart-y { display: flex; flex-direction: column; justify-content: space-between; padding-block: 0; font-size: 10px; color: var(--gd-muted); }
.gd-line-plot { position: relative; min-inline-size: 0; block-size: 208px; }
.gd-line-plot svg { display: block; width: 100%; height: 100%; overflow: visible; }
.gd-grid-line { stroke: var(--gd-grid); stroke-dasharray: 3 4; vector-effect: non-scaling-stroke; }
.gd-chart-path { fill: none; stroke: var(--gd-series); stroke-width: 2.5; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.gd-line-cursor { stroke: var(--gd-muted); stroke-dasharray: 2 4; vector-effect: non-scaling-stroke; }
.gd-chart-zones { position: absolute; inset: 0; display: flex; align-items: stretch; }
.gd-chart-zones button { flex: 1; min-inline-size: 0; border: 0; background: transparent; padding: 0; border-radius: 2px; }
.gd-line-tooltip {
  pointer-events: none; position: absolute; top: 6px; left: clamp(70px, var(--gd-tooltip-x), calc(100% - 70px)); translate: -50% 0;
  display: grid; gap: 2px; min-inline-size: 132px; padding: 7px 8px; background: var(--gd-surface);
  border: 1px solid var(--gd-line); border-radius: 9px; font-size: 10px; box-shadow: 0 4px 10px rgb(var(--gd-dark-shadow) / 15%);
}
.gd-line-tooltip span { display: flex; justify-content: space-between; gap: 10px; }
.gd-chart-axis { display: flex; justify-content: space-between; margin: 9px 0 0 38px; font-size: 9px; color: var(--gd-muted); }
.gd-device { display: grid; gap: 8px; justify-items: stretch; }
.gd-device-ring { position: relative; inline-size: min(100%, 150px); aspect-ratio: 1; justify-self: center; }
.gd-device-ring svg { display: block; inline-size: 100%; block-size: 100%; }
.gd-device-segment { stroke: var(--gd-series); transition: opacity .2s ease; }
.gd-device-segment[data-muted="true"] { opacity: .29; }
.gd-device-total { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; pointer-events: none; }
.gd-device-total strong { font-size: 23px; line-height: 1.05; letter-spacing: -.05em; font-weight: 850; }
.gd-device-total > span { font-size: 10px; margin-top: 5px; color: var(--gd-muted); }
.gd-device-list { display: grid; gap: 2px; }
.gd-device-list button {
  display: grid; grid-template-columns: 66px minmax(0, 1fr) 34px; gap: 7px; align-items: center;
  min-block-size: 32px; text-align: start; background: transparent; border: 0; border-radius: 8px; padding: 3px 6px;
}
.gd-device-list button:is(:hover, [aria-pressed="true"]) { background: var(--gd-inner); }
.gd-device-list button strong { text-align: end; font-weight: 850; font-size: 11px; }
.gd-mix-track { height: 4px; }
.gd-mix-track .gd-fill { display: block; block-size: 100%; border-radius: inherit; background: var(--gd-series); transform-origin: left center; }

.gd-lanes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }
.gd-lanes[data-filtered="true"] { grid-template-columns: minmax(0, 1fr); }
.gd-lane { min-inline-size: 0; border: 1px solid var(--gd-line); background: var(--gd-inner); padding: 7px; border-radius: 14px; }
.gd-lane header { display: flex; align-items: center; gap: 5px; padding: 3px 4px 8px; }
.gd-lane header i { display: inline-grid; place-items: center; border-radius: 7px; width: 23px; height: 23px; color: var(--gd-series); background: color-mix(in srgb, var(--gd-series) 13%, transparent); }
.gd-lane header svg { width: 13px; height: 13px; }
.gd-lane header h3 { min-inline-size: 0; font-size: 11px; font-weight: 840; }
.gd-lane header span { margin-inline-start: auto; color: var(--gd-muted); font-size: 10px; }
.gd-work-item {
  display: grid; gap: 5px; width: 100%; text-align: start; border-radius: 11px; padding: 9px;
  border: 1px solid var(--gd-rim); background: var(--gd-card);
  box-shadow: inset 0 1px 0 var(--gd-gloss);
}
.gd-work-item + .gd-work-item { margin-top: 6px; }
.gd-work-item:hover { background: var(--gd-raised); }
.gd-work-titlerow, .gd-work-meta { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
.gd-work-titlerow strong { font-size: 11.5px; font-weight: 820; }
.gd-work-titlerow svg { width: 14px; height: 14px; }
.gd-work-detail { font-size: 10.5px; line-height: 1.42; color: var(--gd-muted); }
.gd-work-meta { font-size: 9.5px; font-weight: 750; margin-top: 2px; color: var(--gd-muted); }

.gd-dock {
  position: absolute; z-index: 3;
  display: flex; align-items: center; gap: 3px; padding: 4px; border-radius: 999px;
}
.gd-dock-side { flex-direction: column; left: -24px; top: clamp(66px, 16vh, 153px); }
.gd-dock-bottom { left: 50%; bottom: -24px; translate: -50% 0; }
.gd-dock a {
  z-index: 1; position: relative; display: flex; gap: 6px; justify-content: center; align-items: center;
  min-inline-size: 44px; min-block-size: 44px; padding: 0 13px; border-radius: 999px;
  font-size: 11px; font-weight: 800; white-space: nowrap;
}
.gd-dock-side a { padding: 0; }
.gd-dock a svg { width: 16px; height: 16px; stroke-width: 1.9; }
.gd-dock a[aria-current="page"] { color: var(--gd-pick-ink); }
.gd-dock a:not([aria-current="page"]):hover { background: var(--gd-inner); }
.gd-dock-indicator {
  position: absolute; inset: 0 auto auto 0; pointer-events: none; visibility: hidden;
  border-radius: 999px; background: var(--gd-pick); box-shadow: inset 0 1px 0 rgb(255 255 255 / 60%), 0 2px 7px rgb(var(--gd-dark-shadow) / 16%);
}
.gd-dock-indicator[data-ready="true"] { visibility: visible; transition: transform .36s cubic-bezier(.24, .89, .26, 1), width .36s cubic-bezier(.24, .89, .26, 1), height .36s cubic-bezier(.24, .89, .26, 1); }
.gd-dock-side .gd-dock-text, .gd-dock-short { display: none; }
.gd-dock-tip {
  display: none; position: absolute; left: calc(100% + 7px); z-index: 1; pointer-events: none;
  color: var(--gd-ink); background: var(--gd-surface); padding: 6px 9px; border: 1px solid var(--gd-rim);
  border-radius: 7px; box-shadow: 0 3px 8px rgb(var(--gd-dark-shadow) / 17%);
}
.gd-dock-side a:is(:hover, :focus-visible) .gd-dock-tip { display: inline; }
.gd-footer { padding: 33px 3px 1px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.gd-footer > * {
  border-radius: 999px; padding: 5px 8px; color: var(--gd-ink); font-size: 10px; font-weight: 740;
  background: var(--gd-raised); min-block-size: 24px; display: flex; align-items: center; gap: 4px;
}
.gd-footer a:hover { text-decoration: underline; }
.gd-footer a svg { width: 10px; height: 10px; }

.gd-dialog {
  max-inline-size: min(calc(100% - 26px), 485px); inline-size: 100%;
  border-radius: 23px; border: 1px solid var(--gd-rim); color: var(--gd-ink); padding: 0;
  background: var(--gd-surface); box-shadow: 0 20px 80px rgb(var(--gd-dark-shadow) / 38%);
}
.gd-dialog::backdrop { background: rgb(21 21 21 / 43%); backdrop-filter: blur(5px); }
.gd-dialog-inner { padding: 18px; }
.gd-dialog-inner > header { display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.gd-dialog-inner h2 { font-size: 24px; font-weight: 830; letter-spacing: -.045em; }
.gd-command-input { inline-size: 100%; padding-inline: 10px; margin-bottom: 8px; min-block-size: 44px; }
.gd-command-input input { min-block-size: 42px; font-size: 14px; }
.gd-quick-list { display: grid; gap: 5px; }
.gd-quick-list button {
  display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px;
  text-align: start; border: 1px solid var(--gd-line); border-radius: 10px; background: var(--gd-inner);
}
.gd-quick-list button:hover { background: var(--gd-raised); }
.gd-quick-list button svg { width: 16px; height: 16px; color: var(--gd-muted); }
.gd-quick-list button div { flex: 1; }
.gd-quick-list strong, .gd-quick-list small { display: block; }
.gd-quick-list small { color: var(--gd-muted); margin-top: 2px; font-size: 11px; }
.gd-work-dialog-description { margin: 12px 0; }
.gd-work-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.gd-work-facts div { border: 1px solid var(--gd-line); border-radius: 9px; padding: 8px; }
.gd-work-facts dt { font-size: 11px; color: var(--gd-muted); }
.gd-work-facts dd { margin: 4px 0 0; font-weight: 790; }

@media (max-width: 1060px) {
  .gd-surround { inline-size: calc(100% - 74px); }
  .gd-stage-scroll { padding-inline: 29px; }
  .gd-command-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .gd-command-grid > .gd-command-chart { grid-column: 1; }
  .gd-command-side { grid-column: 2; }
  .gd-command-grid > .gd-activity { grid-column: 1 / -1; }
}
@media (max-width: 760px) {
  .gd-surround { padding-top: 11px; padding-bottom: calc(73px + env(safe-area-inset-bottom)); inline-size: calc(100% - 24px); }
  .gd-top { grid-template-columns: minmax(0, 1fr) auto; padding: 7px 9px; gap: 6px 12px; border-radius: 21px; }
  .gd-brand { padding-inline-start: 3px; }
  .gd-ask { grid-area: 2 / 1 / 3 / -1; min-block-size: 41px; }
  .gd-top-actions { grid-area: 1 / 2; }
  .gd-top-actions .gd-icon-button { width: 41px; min-inline-size: 41px; min-block-size: 41px; }
  .gd-stage { border-radius: 23px; }
  .gd-stage-scroll { block-size: auto; padding: 15px 13px 17px; overflow: visible; }
  .gd-view-head { align-items: flex-start; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .gd-view-head p { font-size: 12px; margin-top: 6px; }
  .gd-view-actions { justify-content: flex-start; }
  .gd-command-grid, .gd-analytics-grid { grid-template-columns: minmax(0, 1fr); }
  .gd-command-side, .gd-command-grid > .gd-activity { grid-column: 1; }
  .gd-metric-grid, .gd-lanes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gd-dock-side { display: none; }
  .gd-dock-bottom { position: fixed; inset: auto 11px calc(9px + env(safe-area-inset-bottom)); translate: none; justify-content: space-between; }
  .gd-dock-bottom a { flex: 1; flex-direction: column; gap: 2px; padding: 3px 5px; min-block-size: 47px; line-height: 1.2; font-size: 9.5px; }
  .gd-dock-bottom a svg { width: 15px; height: 15px; }
  .gd-dock-bottom .gd-dock-text { display: none; }
  .gd-dock-bottom .gd-dock-short { display: inline; }
  .gd-footer { padding-top: 9px; }
  .gd-period button { min-block-size: 41px; }
  .gd-primary, .gd-secondary { min-block-size: 44px; }
}
@media (max-width: 420px) {
  .gd-panel { padding: 12px; }
  .gd-metric { padding: 9px; }
  .gd-summary { gap: 5px; padding: 5px; }
  .gd-chart-axis span:nth-child(even) { visibility: hidden; }
  .gd-chart-y { font-size: 9px; }
  .gd-stack-label { font-size: 8px; }
  .gd-lanes { grid-template-columns: 1fr; }
  .gd-table-scroll table { min-inline-size: 278px; }
  .gd-table-scroll th, .gd-table-scroll td { padding-inline: 6px; }
  .gd-table-scroll td { font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .gd-app *, .gd-app *::before, .gd-app *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active) {
  .gd-top, .gd-stage, .gd-dock, .gd-panel, .gd-metric, .gd-summary { background: var(--gd-surface); backdrop-filter: none; -webkit-backdrop-filter: none; }
  .gd-metric[data-tone="teal"] { background: var(--gd-surface); color: var(--gd-ink); --gd-muted: var(--gd-ink); --gd-teal: var(--gd-ink); }
}
@media (forced-colors: active) {
  .gd-app { --gd-ink: CanvasText; --gd-muted: CanvasText; --gd-focus: Highlight; --gd-coral: LinkText; --gd-teal: Highlight; --gd-graph-ink: CanvasText; --gd-surface: Canvas; }
  .gd-app :is(.gd-metric, .gd-panel, .gd-lane, .gd-dock, button, .gd-stage) { border: 1px solid CanvasText; }
  .gd-dock a[aria-current="page"] { border: 2px solid Highlight; }
}

/* ── Sculptor: pantalla grande ─────────────────────────────────────────────────
   Agregado sobre el panel base: colores con significado (resuelto, por firmar,
   bloqueado) en ambos temas y una tipografía más grande para proyectar. */
.gd-app {
  --gd-calm: #15803d;
  --gd-sign: #b45309;
  --gd-block: #b91c1c;
  font-size: 15px;
}
.gd-app[data-theme="dark"] {
  --gd-calm: #86efac;
  --gd-sign: #fbbf24;
  --gd-block: #fca5a5;
}
.gd-app .gd-surround { inline-size: min(calc(100% - 100px), 1560px); }
.gd-app .gd-stage-scroll { block-size: auto; min-block-size: max(605px, calc(100svh - 190px)); overflow: visible; padding-bottom: 64px; }
.gd-app .gd-view-head h1 { font-size: clamp(32px, 3.6vw, 56px); }
.gd-app .gd-view-head p { font-size: clamp(15px, 1.15vw, 19px); max-inline-size: 70ch; }
.gd-app .gd-view-head .nx-now { color: var(--gd-ink); font-weight: 760; font-size: clamp(17px, 1.4vw, 24px); margin-block-start: 10px; }
.gd-app .gd-panel-head h2 { font-size: clamp(16px, 1.25vw, 20px); }
.gd-app .gd-panel-head p { font-size: 13px; }
.gd-app .gd-metric { min-block-size: 150px; padding: 14px 16px; }
.gd-app .gd-metric-head { font-size: 14px; }
.gd-app .gd-metric-value, .gd-app .gd-summary .gd-metric-value { font-size: clamp(30px, 3vw, 52px); }
.gd-app .gd-metric-caption { font-size: 13px; }
.gd-app .gd-balance-number { font-size: clamp(54px, 6.4vw, 104px); }
.gd-app .gd-balance-title { font-size: clamp(22px, 2vw, 34px); font-weight: 800; letter-spacing: -.035em; line-height: 1.1; }
.gd-app .gd-balance-sub { color: var(--gd-muted); font-size: 15px; margin-block-start: 6px; }
.gd-app .gd-streams span { font-size: 12px; }
.gd-app .gd-streams strong { font-size: 18px; }
.gd-app .gd-primary, .gd-app .gd-secondary { min-block-size: 48px; font-size: 14px; padding-inline: 16px; }
.gd-app .gd-primary svg, .gd-app .gd-secondary svg { width: 17px; height: 17px; }
.gd-app .gd-period button { min-block-size: 42px; font-size: 14px; padding-inline: 16px; }
.gd-app .gd-period a { display: inline-flex; align-items: center; min-block-size: 42px; border-radius: 999px; padding: 0 16px; font-size: 14px; font-weight: 750; white-space: nowrap; }
.gd-app .gd-period a[aria-current="page"] { background: var(--gd-primary); color: var(--gd-primary-ink); }
.gd-app .gd-period a:not([aria-current="page"]):hover { background: var(--gd-raised); }
.gd-app .gd-dock a { font-size: 14px; min-block-size: 50px; flex-shrink: 0; }
/* Con letra más grande, el dock centrado al 50 % se encogía y el texto quedaba fuera del indicador. */
.gd-app .gd-dock-bottom { inline-size: max-content; }
.gd-app .gd-dock a svg { width: 19px; height: 19px; }
.gd-app .gd-capacity-label { font-size: 14px; }
.gd-app .gd-capacity-track { height: 12px; }
.gd-app .gd-capacity-track .gd-fill[data-tone-state="sign"] { background: var(--gd-sign); }
.gd-app .gd-capacity-track .gd-fill[data-tone-state="block"] { background: var(--gd-block); }
.gd-app .gd-approval-content strong { font-size: 15px; }
.gd-app .gd-approval-content small { font-size: 13px; }
.gd-app .gd-stack-label { font-size: 13px; font-weight: 760; color: var(--gd-ink); }
.gd-app .gd-command-chart .gd-stack-plot, .gd-app .gd-stack-plot { block-size: 220px; }
.gd-app .gd-chart-readout { font-size: 13px; }
.gd-app .gd-legend span { font-size: 12px; }
.gd-app .gd-brand strong { font-size: 15px; letter-spacing: .12em; }
.gd-app .gd-brand .gd-wordmark { font-size: 21px; letter-spacing: -.03em; font-weight: 800; }
.gd-app .gd-brand small { font-size: 12px; }
.gd-app .gd-prompt { font-size: 14px; }

/* Estado con significado: color + icono + palabra. */
.nx-state { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 10px; font-size: 13px; font-weight: 800; white-space: nowrap;
  color: var(--nx-state); background: color-mix(in srgb, var(--nx-state) 13%, var(--gd-inner)); }
.nx-state svg { width: 15px; height: 15px; }
.nx-state[data-state="calm"] { --nx-state: var(--gd-calm); }
.nx-state[data-state="sign"] { --nx-state: var(--gd-sign); }
.nx-state[data-state="block"] { --nx-state: var(--gd-block); }
.nx-state[data-state="plain"] { --nx-state: var(--gd-muted); }
.nx-timer[data-state="block"] { color: var(--gd-block); }
.nx-timer[data-state="calm"] { color: var(--gd-calm); }
.gd-metric[data-tone="coral"] .gd-metric-value { color: var(--gd-block); }
.gd-metric[data-tone="calm"] .gd-metric-value { color: var(--gd-calm); }

.gd-app .gd-balance-change { font-size: 14px; }
.gd-app .gd-stack-bar { inline-size: min(70%, 88px); }
.gd-app .gd-stack-label { white-space: normal; text-align: center; line-height: 1.25; }
.gd-app .gd-stack-label b { display: block; font-size: 20px; font-weight: 820; letter-spacing: -.03em; }
.gd-app .gd-stack-column[data-winner="true"] .gd-stack-label b { color: var(--gd-calm); }
.gd-app .gd-command-chart .gd-stack-plot, .gd-app .gd-stack-plot { block-size: 260px; }
.gd-app .nx-log { align-self: start; }
/* «.gd-app a» hereda el color del texto: los enlaces con forma de botón recuperan el suyo. */
.gd-app a.gd-primary { color: var(--gd-primary-ink); }
.gd-app a.gd-secondary { color: var(--gd-ink); }
.gd-app .gd-chart-readout { white-space: normal; text-align: end; max-inline-size: 60%; }

/* Por firmar */
.nx-pending { display: grid; gap: 8px; }
.nx-pending li { list-style: none; display: flex; align-items: flex-start; gap: 10px; border-radius: 14px; padding: 10px; background: var(--gd-inner); border: 1px solid var(--gd-line); }
.nx-pending ul { padding: 0; margin: 0; }
.nx-pending .gd-list-icon { inline-size: 36px; block-size: 36px; color: var(--nx-state); background: color-mix(in srgb, var(--nx-state) 14%, var(--gd-inner)); }
.nx-pending strong { display: block; font-size: 15px; font-weight: 800; }
.nx-pending small { display: block; font-size: 13px; color: var(--gd-muted); margin-top: 3px; }

/* Ranking detallado */
.nx-rank { display: grid; gap: 10px; }
.nx-rank-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; border-radius: 16px; padding: 12px 14px; background: var(--gd-inner); border: 1px solid var(--gd-line); }
.nx-rank-row[data-winner="true"] { border-color: var(--gd-calm); box-shadow: inset 0 0 0 1px var(--gd-calm); }
.nx-rank-pos { font-size: 38px; font-weight: 820; letter-spacing: -.05em; line-height: 1; }
.nx-rank-row[data-winner="true"] .nx-rank-pos, .nx-rank-row[data-winner="true"] .nx-rank-score { color: var(--gd-calm); }
.nx-rank-name { font-size: 18px; font-weight: 800; }
.nx-rank-org { font-size: 13px; color: var(--gd-muted); }
.nx-rank-score { font-size: 32px; font-weight: 820; letter-spacing: -.04em; text-align: end; }
.nx-rank-terms { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; font-size: 12px; color: var(--gd-muted); }
.nx-rank-terms b { display: block; color: var(--gd-ink); font-size: 15px; }
.nx-note { border-radius: 14px; padding: 12px 14px; font-size: 14px; line-height: 1.45; background: color-mix(in srgb, var(--gd-sign) 11%, var(--gd-inner)); border: 1px solid color-mix(in srgb, var(--gd-sign) 30%, transparent); }
.nx-quote { font-family: var(--font-serif), Georgia, serif; font-style: italic; font-size: clamp(20px, 1.8vw, 28px); line-height: 1.3; }
.nx-meta { font-size: 13px; color: var(--gd-muted); font-weight: 700; }

/* Organizaciones */
.nx-org-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.nx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-block: 4px 12px; }
.nx-fields { display: grid; gap: 6px; padding: 0; margin: 0; }
.nx-fields li { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 10px; border-radius: 12px; padding: 9px 12px; font-size: 14px;
  background: repeating-linear-gradient(-52deg, color-mix(in srgb, var(--gd-teal) 16%, transparent) 0 1.5px, transparent 1.5px 7px), var(--gd-inner); }
.nx-fields li svg { width: 15px; height: 15px; color: var(--gd-muted); }
.nx-qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.nx-qr-item { display: grid; gap: 6px; justify-items: start; font-size: 13px; }
.nx-qr-item strong { font-size: 14px; line-height: 1.2; }
.nx-qr-hero { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; border-radius: 18px; padding: 16px; margin-block-end: 14px;
  background: color-mix(in srgb, var(--gd-pick) 16%, var(--gd-inner)); border: 1px solid color-mix(in srgb, var(--gd-pick) 45%, transparent); }
.nx-qr-hero h3 { font-size: clamp(20px, 1.8vw, 30px); font-weight: 820; letter-spacing: -.03em; line-height: 1.15; }
.nx-warn { display: flex; gap: 8px; align-items: flex-start; border-radius: 12px; padding: 10px 12px; font-size: 13px; margin-block-end: 12px;
  color: var(--gd-sign); background: color-mix(in srgb, var(--gd-sign) 11%, var(--gd-inner)); }

/* Registro (actividad) colapsado */
.nx-log summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 10px; min-block-size: 44px; font-weight: 800; font-size: 15px; }
.nx-log summary::-webkit-details-marker { display: none; }
.nx-log summary svg { width: 18px; height: 18px; transition: transform .2s ease; }
.nx-log[open] summary svg.nx-chevron { transform: rotate(180deg); }
.nx-log .gd-table-scroll { margin-top: 10px; max-block-size: 420px; }
.nx-log td.nx-code { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; }
.nx-log td.nx-code[data-state="block"] { color: var(--gd-block); }
.nx-log td.nx-code[data-state="calm"] { color: var(--gd-calm); }
.nx-log td.nx-wrap { white-space: normal; min-inline-size: 260px; color: var(--gd-muted); }

/* Respuesta de «Pregúntale al caso» */
.nx-answer { font-size: 18px; line-height: 1.45; margin-block: 6px 12px; }
.nx-suggest { display: flex; flex-wrap: wrap; gap: 6px; }
.nx-suggest button { border: 1px solid var(--gd-line); background: var(--gd-inner); border-radius: 999px; padding: 7px 12px; font-size: 13px; font-weight: 700; }
.nx-suggest button:hover { background: var(--gd-raised); }
.nx-footer-note { font-size: 12px !important; }


/* ── Historia de la decisión (vista principal) ───────────────────────────── */
.gd-app { --nx-current: var(--gd-pick); --nx-current-ink: var(--gd-pick-ink); }
.gd-app:not([data-theme="dark"]) { --nx-current: #6faf9b; --nx-current-ink: #1c332e; }
.nx-story { display: grid; gap: clamp(14px, 1.6vw, 22px); }
.nx-steps { display: grid; grid-template-columns: repeat(var(--nx-steps, 5), minmax(0, 1fr)); gap: 8px; padding: 0; margin: 0; counter-reset: step; }
.nx-steps li { list-style: none; position: relative; display: flex; align-items: center; gap: 10px; min-inline-size: 0;
  border-radius: 999px; padding: 8px 14px 8px 8px; border: 1px solid var(--gd-rim); background: var(--gd-inner); color: var(--gd-muted); }
.nx-step-dot { display: grid; place-items: center; flex: none; inline-size: clamp(34px, 2.6vw, 44px); block-size: clamp(34px, 2.6vw, 44px); border-radius: 50%;
  font-weight: 850; font-size: clamp(15px, 1.2vw, 19px); background: var(--gd-track); color: var(--gd-ink); }
.nx-step-dot svg { width: 20px; height: 20px; stroke-width: 2.6; }
.nx-step-label { font-size: clamp(15px, 1.35vw, 22px); font-weight: 800; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nx-steps li[data-state="done"] { color: var(--gd-ink); }
.nx-steps li[data-state="done"] .nx-step-dot { background: color-mix(in srgb, var(--gd-calm) 22%, var(--gd-inner)); color: var(--gd-calm); }
.nx-steps li[data-state="current"] { background: var(--nx-current); color: var(--nx-current-ink); border-color: transparent; box-shadow: 0 8px 22px rgb(var(--gd-dark-shadow) / 22%); }
.nx-steps li[data-state="current"] .nx-step-dot { background: rgb(0 0 0 / 14%); color: var(--nx-current-ink); }

.nx-resource { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px 28px; padding: clamp(16px, 1.8vw, 26px) clamp(18px, 2.2vw, 32px); }
.nx-resource-name { display: flex; align-items: baseline; gap: clamp(12px, 1.2vw, 20px); min-inline-size: 0; flex: 1 1 360px;
  font-size: clamp(28px, 3.6vw, 60px); font-weight: 830; letter-spacing: -.04em; line-height: 1.02; text-transform: uppercase; }
.nx-resource { position: relative; }
.nx-resource-qty { font-size: 1.5em; line-height: .9; color: var(--nx-current); }
.gd-app:not([data-theme="dark"]) .nx-resource-qty { color: var(--gd-teal); }
.nx-resource-facts { display: flex; flex-wrap: wrap; gap: 12px 26px; }
.nx-resource-facts p { display: flex; align-items: center; gap: 10px; }
.nx-resource-facts svg { width: 28px; height: 28px; color: var(--gd-muted); }
.nx-resource-facts small { display: block; font-size: 14px; color: var(--gd-muted); font-weight: 700; }
.nx-resource-facts strong { display: block; font-size: clamp(22px, 2.2vw, 36px); font-weight: 830; letter-spacing: -.03em; line-height: 1.05; font-variant-numeric: tabular-nums; }
.nx-elapsed[data-state="block"] strong, .nx-elapsed[data-state="block"] svg { color: var(--gd-block); }
.nx-elapsed[data-state="calm"] strong, .nx-elapsed[data-state="calm"] svg { color: var(--gd-calm); }

.nx-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: clamp(12px, 1.4vw, 20px); }
.nx-card { position: relative; display: flex; flex-direction: column; gap: 6px; padding: clamp(16px, 1.6vw, 24px); }
.nx-card-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.nx-card-row .nx-why[open] { flex-basis: 100%; }
.nx-card header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.nx-card-org { font-size: clamp(15px, 1.2vw, 19px); font-weight: 750; color: var(--gd-muted); }
.nx-card-title { font-size: clamp(24px, 2.4vw, 40px); font-weight: 830; letter-spacing: -.035em; line-height: 1.05; }
.nx-card-score { display: flex; align-items: baseline; gap: 10px; font-size: clamp(52px, 5.4vw, 96px); font-weight: 840; letter-spacing: -.06em; line-height: .95; font-variant-numeric: tabular-nums; margin-block: 4px; }
.nx-card-score small { font-size: 15px; letter-spacing: 0; font-weight: 700; color: var(--gd-muted); }
.nx-card .nx-state { align-self: flex-start; font-size: 15px; padding: 6px 12px; }
.nx-card-note { font-size: 14px; color: var(--gd-muted); }
.nx-card.is-proposed { border-color: var(--nx-current); box-shadow: inset 0 0 0 2px var(--nx-current), 0 14px 34px rgb(var(--gd-dark-shadow) / 20%); }
.nx-card.is-winner { border-color: var(--gd-calm); box-shadow: inset 0 0 0 2px var(--gd-calm), 0 14px 34px rgb(var(--gd-dark-shadow) / 20%); }
.nx-card.is-winner .nx-card-score { color: var(--gd-calm); }
.nx-star { position: absolute; inset: clamp(14px, 1.4vw, 20px) clamp(14px, 1.4vw, 20px) auto auto; display: grid; place-items: center; inline-size: 48px; block-size: 48px; border-radius: 50%; background: var(--nx-current); color: var(--nx-current-ink); }
.nx-card.is-winner .nx-star { background: var(--gd-calm); color: var(--gd-surface); }
.nx-star svg { width: 26px; height: 26px; fill: currentColor; }
.nx-locked { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 6px 0 0; }
.nx-locked li { list-style: none; display: flex; align-items: center; gap: 8px; border-radius: 10px; padding: 8px 10px; font-size: 14px; font-weight: 750; color: var(--gd-muted); background: var(--gd-inner); white-space: nowrap; }
.nx-locked svg { width: 16px; height: 16px; flex: none; }
/* Dato tachado: franjas diagonales en vez del valor, que nunca llega a esta pantalla. */
.nx-locked i { flex: none; inline-size: 54px; block-size: 14px; border-radius: 4px;
  background: repeating-linear-gradient(-52deg, color-mix(in srgb, var(--gd-ink) 62%, transparent) 0 3px, transparent 3px 7px); }

.nx-missing { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px 28px; padding: clamp(16px, 1.6vw, 26px) clamp(18px, 2.4vw, 36px); }
.nx-missing-text { font-size: clamp(26px, 3vw, 50px); font-weight: 820; letter-spacing: -.035em; line-height: 1.12; text-wrap: balance; }
.nx-missing-text b { color: var(--gd-sign); font-weight: 860; }
.nx-missing[data-lead="Listo"] .nx-missing-text b { color: var(--gd-calm); }
.nx-missing-who { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 18px; }
.nx-missing-who p { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: clamp(16px, 1.4vw, 22px); font-weight: 750; }
.nx-missing-who p > svg { width: 24px; height: 24px; color: var(--gd-muted); }

@media (max-width: 760px) {
  .nx-steps { gap: 4px; }
  .nx-steps li { flex-direction: column; justify-content: center; gap: 4px; padding: 6px 2px; border-radius: 16px; }
  .nx-step-label { font-size: 11px; }
  .nx-step-dot { inline-size: 28px; block-size: 28px; font-size: 13px; }
  .nx-resource-name { font-size: 26px; flex-basis: 100%; }
  .nx-card-score { font-size: 56px; }
}

@media (max-width: 760px) {
  .gd-app .gd-surround { inline-size: calc(100% - 20px); }
  .gd-app .gd-metric { min-block-size: 124px; }
  .gd-app .gd-balance-number { font-size: 60px; }
  .gd-app .gd-period { flex-wrap: wrap; }
  .gd-app .gd-period a { padding-inline: 12px; font-size: 13px; }
  .nx-rank-terms { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gd-app .gd-dock-bottom a { font-size: 11px; }
  .gd-app .gd-balance-actions { grid-template-columns: 1fr; }
  .nx-log summary .nx-meta { display: none; }
  .gd-app .gd-dock-bottom { inline-size: auto; }
  .gd-app .gd-dock-bottom a { flex-shrink: 1; }
}

/* ── Ronda 8: galaxia, paso «Unirse», pulso y «¿Por qué?» ─────────────────── */
.gd-app .gd-stage { position: relative; }
.gd-app .gd-stage-scroll { position: relative; z-index: 1; }
/* La galaxia vive detrás del contenido: protagonista al unirse, fondo sutil después. */
.nx-galaxy { position: absolute; inset: 0; z-index: 0; inline-size: 100%; block-size: 100%; border-radius: inherit; pointer-events: none; transition: opacity .9s ease; }
.nx-galaxy[data-variant="backdrop"] { opacity: .5; }
.gd-app:not([data-theme="dark"]) .nx-galaxy[data-variant="backdrop"] { opacity: .42; }

.nx-join-grid { display: grid; grid-template-columns: minmax(250px, .85fr) minmax(0, 1.6fr) auto; align-items: center; gap: clamp(16px, 2vw, 32px); min-block-size: clamp(440px, 58svh, 640px); }
.nx-join-number { font-size: clamp(84px, 10.5vw, 176px); font-weight: 840; letter-spacing: -.065em; line-height: .88; font-variant-numeric: tabular-nums; color: var(--gd-muted); }
.nx-join-number span { color: var(--gd-ink); transition: color .5s ease; }
.nx-join-number[data-full="true"] span { color: var(--gd-calm); }
.nx-join-number small { display: block; margin-block-start: 10px; font-size: clamp(18px, 1.7vw, 28px); font-weight: 780; letter-spacing: -.01em; line-height: 1.1; color: var(--gd-muted); }
.nx-seats { display: grid; gap: 8px; justify-items: start; padding: 0; margin: clamp(18px, 2vw, 30px) 0 0; }
.nx-seats li { list-style: none; display: flex; align-items: center; gap: 10px; border-radius: 999px; padding: 8px 14px 8px 11px; border: 1px solid var(--gd-rim);
  background: var(--gd-card); color: var(--gd-muted); font-size: clamp(14px, 1.15vw, 18px); font-weight: 760; line-height: 1.15; transition: color .4s ease, border-color .4s ease; }
.nx-seats li i { flex: none; inline-size: 14px; block-size: 14px; border-radius: 50%; border: 2px solid var(--nx-seat); transition: background .4s ease, box-shadow .4s ease; }
.nx-seats li svg { flex: none; width: 16px; height: 16px; opacity: .55; }
.nx-seats li[data-on="true"] { color: var(--gd-ink); border-color: color-mix(in srgb, var(--nx-seat) 70%, transparent); }
.nx-seats li[data-on="true"] i { background: var(--nx-seat); box-shadow: 0 0 12px color-mix(in srgb, var(--nx-seat) 70%, transparent); }
.nx-seats li[data-on="true"] svg { color: var(--gd-calm); opacity: 1; stroke-width: 3; }
.nx-join-qr { display: grid; justify-items: center; gap: 12px; padding: clamp(14px, 1.4vw, 22px); }
.nx-join-code { inline-size: clamp(210px, 21vw, 300px) !important; block-size: auto !important; aspect-ratio: 1; border-radius: 16px !important; border: 0 !important; }
.nx-join-url { max-inline-size: clamp(210px, 21vw, 300px); text-align: center; overflow-wrap: anywhere; font-family: var(--font-mono), ui-monospace, monospace; font-size: 13px; font-weight: 700; color: var(--gd-muted); }
.nx-join-qr .nx-warn { margin: 0; max-inline-size: clamp(210px, 21vw, 300px); }

/* Los avisos van arriba a la derecha: abajo tapaban la frase «Falta: …». */
@media (min-width: 761px) {
  .gd-app > div[aria-live="polite"] { top: 108px; bottom: auto; flex-direction: column; }
}

/* Pulso: rojo y vivo mientras se espera; verde y plano cuando se decidió. */
.nx-ecg { position: absolute; inset: auto clamp(18px, 2.2vw, 32px) 4px; display: block; block-size: 24px; color: var(--gd-block); }
.nx-resource { padding-block-end: clamp(30px, 2.6vw, 38px); }
.nx-ecg svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; overflow: visible; }
.nx-ecg path { fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.nx-ecg[data-state="calm"] { color: var(--gd-calm); }
.nx-ecg[data-state="block"] .nx-ecg-trace { opacity: .38; }
.nx-ecg-beam {
  -webkit-mask: linear-gradient(90deg, transparent 38%, #000 49.5%, #000 50%, transparent 50.4%) 100% 0 / 300% 100% no-repeat;
  mask: linear-gradient(90deg, transparent 38%, #000 49.5%, #000 50%, transparent 50.4%) 100% 0 / 300% 100% no-repeat;
  animation: nx-ecg 2.8s linear infinite;
}
@keyframes nx-ecg { from { -webkit-mask-position: 85% 0; mask-position: 85% 0; } to { -webkit-mask-position: 5% 0; mask-position: 5% 0; } }

/* Las explicaciones no van a la vista: quedan detrás de «¿Por qué?». */
.nx-why summary { cursor: pointer; list-style: none; display: inline-flex; align-items: center; min-block-size: 34px; padding: 0 13px; border-radius: 999px;
  border: 1px solid var(--gd-line); background: var(--gd-inner); font-size: 13px; font-weight: 800; }
.nx-why summary::-webkit-details-marker { display: none; }
.nx-why[open] summary { background: var(--gd-raised); }
.nx-why p { margin-block-start: 8px; max-inline-size: 62ch; font-size: 14px; line-height: 1.45; color: var(--gd-muted); }

@media (max-width: 760px) {
  .nx-join-grid { grid-template-columns: minmax(0, 1fr); min-block-size: 0; }
  .nx-join-space { order: -1; block-size: 300px; }
  .nx-join-qr { justify-self: center; }
  .gd-stage[data-join="true"] .nx-galaxy { inset: 150px 0 auto; block-size: 320px; }
  .nx-ecg { block-size: 20px; }
  .nx-missing { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  /* Sin barrido: el pulso queda dibujado entero y quieto. */
  .nx-ecg-beam { animation: none; -webkit-mask: none; mask: none; }
  .nx-galaxy { transition: none; }
}

/* ── Ronda 9: demo de 3 personas ──────────────────────────────────────────── */
/* Sin «Pregúntale al caso» arriba (está en el dock), la barra deja el centro libre. */
.gd-app .gd-top { grid-template-columns: minmax(0, 1fr) auto; }
.gd-app .gd-top > span[aria-hidden="true"]:empty { display: none; }
/* Las 3 personas, grandes; los asientos automáticos, pequeños y con su chip. */
.nx-seats[data-big="true"] li { font-size: clamp(18px, 1.6vw, 26px); padding: 12px 20px 12px 15px; gap: 12px; white-space: nowrap; }
.nx-join-grid:has(.nx-seats[data-big="true"]) { grid-template-columns: minmax(300px, 1fr) minmax(0, 1.4fr) auto; }
.nx-bots li { white-space: nowrap; }
.nx-seats[data-big="true"] li i { inline-size: 18px; block-size: 18px; }
.nx-seats[data-big="true"] li svg { width: 20px; height: 20px; }
.nx-bots { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 16px 0 0; }
.nx-bots li { list-style: none; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 5px 6px 5px 12px; font-size: 13px; font-weight: 700; color: var(--gd-muted); background: var(--gd-inner); border: 1px dashed var(--gd-line); }
.nx-bots b { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--gd-ink); background: var(--gd-raised); }
.nx-bots svg { width: 13px; height: 13px; }
/* «Nueva ronda»: el botón grande del anfitrión al cerrar el acta. */
.gd-app .nx-new-round { min-block-size: 64px; padding-inline: 30px; font-size: clamp(18px, 1.5vw, 24px); }
.gd-app .nx-new-round svg { width: 24px; height: 24px; }
.gd-analytics > .nx-new-round { justify-self: start; }
.nx-host-scenarios { margin-block-end: 12px; flex-wrap: wrap; }
/* La frase «Falta: …» manda: el «quién» no le quita más de la mitad del ancho. */
.nx-missing { grid-template-columns: minmax(50%, 1fr) minmax(0, auto); }
.nx-missing-who { max-inline-size: 46ch; }

/* Demo: el dock de abajo con etiquetas de una palabra, también en pantalla grande. */
.gd-app[data-demo="true"] .gd-dock-bottom .gd-dock-text { display: none; }
.gd-app[data-demo="true"] .gd-dock-bottom .gd-dock-short { display: inline; }
/* Tarjeta sin caso: «Esperando caso» en lugar de un puntaje vacío. */
.nx-card-waiting { display: flex; align-items: center; gap: 12px; min-block-size: clamp(52px, 5.4vw, 96px); font-size: clamp(24px, 2.4vw, 40px); font-weight: 800; letter-spacing: -.03em; color: var(--gd-muted); }
.nx-card-waiting svg { width: 1em; height: 1em; flex: none; }

/* ── Ronda 11: el código para entrar no desaparece en la demo ─────────────── */
.nx-qr-mini { display: flex; align-items: center; gap: 12px; margin: 0; }
.nx-qr-mini > span { border-radius: 12px !important; border: 0 !important; }
.nx-qr-mini figcaption { font-size: clamp(15px, 1.2vw, 19px); font-weight: 800; line-height: 1.2; max-inline-size: 11ch; }
.nx-qr-corner { border-radius: 20px; padding: 10px 16px 10px 10px; border: 1px solid var(--gd-rim); background: var(--gd-card); }
.nx-qr-band { justify-self: end; flex-direction: row-reverse; }
.nx-qr-band figcaption { text-align: end; color: var(--gd-sign); }
@media (max-width: 760px) {
  .nx-qr-band { justify-self: start; flex-direction: row; }
  .nx-qr-band figcaption { text-align: start; }
}

/* ── Ronda 12: demo pauteada. La pantalla le habla a una persona por su rol ── */
.nx-turn { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px 28px;
  padding: clamp(18px, 2vw, 30px) clamp(20px, 2.6vw, 40px); border: 2px solid var(--nx-current); }
.nx-turn[data-scan="true"] { border-color: var(--gd-sign); }
.nx-turn[data-done="true"] { border-color: var(--gd-calm); }
.nx-turn-text { font-size: clamp(34px, 4.4vw, 72px); font-weight: 840; letter-spacing: -.04em; line-height: 1.02; text-wrap: balance; }
.nx-turn-text b { color: var(--nx-current); font-weight: 860; }
.gd-app:not([data-theme="dark"]) .nx-turn-text b { color: var(--gd-teal); }
.nx-turn[data-scan="true"] .nx-turn-text b { color: var(--gd-sign); }
.nx-turn[data-done="true"] .nx-turn-text b { color: var(--gd-calm); }
/* Cuenta regresiva del plan B: un anillo que se vacía y el número de segundos. */
.nx-turn-clock { position: relative; display: grid; place-items: center; inline-size: clamp(96px, 8vw, 136px); aspect-ratio: 1; border-radius: 50%;
  background: conic-gradient(var(--nx-current) calc(var(--nx-left, 1) * 360deg), var(--gd-track) 0); }
.nx-turn-clock::before { content: ""; position: absolute; inset: 9px; border-radius: 50%; background: var(--gd-surface); }
.nx-turn-clock span { position: relative; font-size: clamp(38px, 3.4vw, 58px); font-weight: 850; font-variant-numeric: tabular-nums; letter-spacing: -.04em; }
.nx-turn-clock[data-late="true"] { background: conic-gradient(var(--gd-sign) calc(var(--nx-left, 1) * 360deg), var(--gd-track) 0); }
.nx-turn-clock[data-late="true"] span { color: var(--gd-sign); }
/* El asiento y la tarjeta de quien tiene el turno, resaltados. */
.nx-card[data-turn] { border-color: var(--nx-current); box-shadow: inset 0 0 0 3px var(--nx-current), 0 14px 34px rgb(var(--gd-dark-shadow) / 22%); }
.nx-seats li[data-turn] { border-color: var(--nx-current); box-shadow: 0 0 0 3px var(--nx-current); color: var(--gd-ink); }
/* En la demo, la franja del turno ocupa el lugar del título. */
.gd-app[data-demo="true"] .gd-view-head:not(:has(h1)) { margin-block-end: 6px; }
@media (max-width: 760px) {
  .nx-turn { grid-template-columns: minmax(0, 1fr); }
  .nx-turn-text { font-size: 32px; }
}
.nx-turn-side { display: flex; align-items: center; gap: 18px; }
@media (max-width: 760px) { .nx-turn-side { flex-wrap: wrap; } }
`;
