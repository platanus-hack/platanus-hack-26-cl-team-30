# Kit Maestro para UX Pilot / UX Studio — Experiencia Mobile "For Dummies" (10 Jugadores en Vivo)

> **Escenario integrado desde Render (`https://team-30-platanus-hack.onrender.com`):** Sala `demo-cross` (*Dos hospitales, una cama UCI*) con **5 sillas núcleo × 2 co-pilotos = 10 personas simultáneas** (3 jurados + 7 del público).  
> **Marca:** Placeholder `[NOMBRE_APP]` (reemplázalo con Buscar y Reemplazar en 2 segundos cuando definan el nombre final).  
> **Referencia visual interactiva:** Abre [`prototipo_mobile_jurado.html`](./prototipo_mobile_jurado.html) en tu celular o navegador para probar este flujo exacto con una mano y sacar screenshots de referencia visual (*Style Match*) para UX Pilot.

---

## 0. ¿Seguimos en tu proyecto actual de UX Pilot o creamos uno desde 0?

| Situación de tu base actual en UX Pilot | Qué hacer | Por qué |
| :--- | :--- | :--- |
| **Tu base ya es Mobile (`390×844`), tema claro y te gusta su tipografía/espaciado** | **NO empieces de 0.** Crea un **Nuevo Flow / nueva sección** dentro del mismo proyecto y pega el *Global Context* abajo. | Aprovechas tus componentes y estilos ya afinados sin perder trabajo. |
| **Tu base era Desktop, Dark Mode genérico, tenía tablas densas o *lorem ipsum*** | **Crea un Proyecto Nuevo Mobile App (`390×844`) desde 0** y pega Prompt 0 + Prompts 1–6. *(Toma ~10 min).* | UX Pilot hereda el estilo visual de pantallas previas del mismo canvas como contexto implícito; parchar una base cargada gasta 3× más créditos y tiempo que generar limpio con tokens reales. |

> **Flujo ganador en UX Pilot (15 minutos total):**
> 1. Crea proyecto **Mobile App (iOS/Android · `390×844`)** → modo **HiFi** (o Wireframe primero si quieres validar solo layout).
> 2. Pega el **Prompt 0 (Design System / Global Context)** en el campo de contexto global de UX Pilot (o al principio de cada prompt si tu plan no tiene contexto global persistente).
> 3. Genera las **6 pantallas en orden** (Prompts 1 a 6). Si quieres máxima fidelidad estética en el primer intento, sube capturas de `prototipo_mobile_jurado.html` como *Reference Image*.
> 4. Pule detalles puntuales con el **Prompt 7** (Follow-ups locales) sin regenerar toda la pantalla.

---

## PROMPT 0 — Global Context & Design System (Copiar primero en UX Pilot / UX Studio)

```text
DESIGN SYSTEM & GLOBAL CONTEXT FOR MOBILE WEB APP ([NOMBRE_APP]):
Platform: Mobile web app (390x844 viewport, portrait, one-handed thumb-first usability for non-technical live-event judges scanning a QR code).
Language: Natural, crystal-clear Spanish (Chile/LatAm). Zero engineering jargon (NEVER display technical strings like "RBAC_SERVER_FILTERED", "403_ERROR_CODE", or raw English keys).

Visual World (Clinical-Editorial High-Contrast Light Mode — NOT dark neon, NOT generic SaaS dashboard):
- Canvas background: Clinical linoleum #EEF2F1
- Elevated surface / cards: Crisp white #FFFFFF with subtle 1px hairline border #C7D2D0 (NO nested cards inside cards, NO heavy drop shadows, NO glassmorphism)
- Primary ink / text: Deep petrol #0E2A33
- Secondary text: Slate #51676D
- Semantic colors (used ONLY with meaning):
  - Urgent / Waiting / Blocked / Denied: Bleed Red #D3273E (soft surface #FBE9EC)
  - Resolved / Approved / Safe: Calm Green #14795A (soft surface #E3F3EC)
  - Authority Clash / Warning: Clash Amber #A86C00 (soft surface #FBF1D9)
  - Neutral Arbiter (Comité Ético): Violet #6A4BD6 (soft surface #EEEAFC)
  - Role Accents: Clinical/Proposer Emerald #2BA36B | Finance/Approver Amber #D59411 | Arbiter Violet #6A4BD6
- Signature visual motifs:
  1. Compact animated red ECG heartbeat pulse line while the hospital bed is waiting; turns into a calm flat green line once sealed.
  2. Redacted secret fields shown as crisp diagonal hatched dark-petrol stripes (like declassified clinical/legal redaction bars), never blurry gray text.

Typography:
- Primary UI font: Archivo (Bold/SemiBold for headlines and tabular numbers, Regular/Medium for body).
- Editorial Accent font: Newsreader Italic ONLY for human-written verdict reasons that go into the official record.
- No tiny eyebrow kickers above headings. Headings carry their own weight. Minimum body size 15px, high contrast (>= 4.5:1) for auditorium lighting.

Mobile Ergonomics (Strict):
- 8pt spacing grid, 12px-16px corner radius.
- Single primary CTA anchored in the bottom thumb zone (minimum height 52px, full width, respecting iOS bottom safe area).
- Bottom navigation bar with 4 clean tabs (minimum 44x44px touch targets) with crisp outline SVG icons (NO emojis as UI icons).
- Keep every active tab within 1 to 1.2 screens of height — zero long scrolling walls.
```

---

## PROMPT 1 — Pantalla 1: Escaneo QR & Revelación Aleatoria de Rol ("La Ruleta de Identidad")

*Úsala como primera pantalla del flujo: es lo primero que ve un jurado o asistente 1 segundo después de escanear el QR único del escenario.*

```text
Design Screen 1 of 6 for mobile web app [NOMBRE_APP] (390x844, Spanish, using our Clinical-Editorial Light Design System: #EEF2F1 background, #FFFFFF surfaces, #0E2A33 ink, Archivo + Newsreader).

User context: A judge or audience member just scanned a single stage QR code during a 3-minute live demo. The server automatically assigned them 1 of 5 key roles at random with zero login and zero role-picker clutter. 10 people are playing live (2 co-pilots per role).

Layout top to bottom (fits in 1 single screen, zero vertical scroll):
1. Minimal top bar (56px): Left shows "[NOMBRE_APP]" with a small pulsing red status dot. Right shows a compact pill: "10 en sala · 00:42" with a red ECG pulse icon.
2. Centered Role Identity Card (white #FFFFFF, 1px border #C7D2D0, generous 24px padding, 16px radius):
   - Top horizontal strip of crisp role pills: Emerald badge "URGENCIAS" + neutral pill "2 de 2 en tu rol · Co-piloto activo".
   - Bold display heading (30px Archivo Bold): "Te tocó: Jefatura de Urgencias"
   - Organization subtitle (16px #51676D): "Clínica de Alta Complejidad Andes"
   - Visual divider (1px #E1E8E6).
   - Clear "For Dummies" mission statement (16px #0E2A33, max 2 lines): "Tienes un paciente crítico esperando la única cama UCI. No puedes ver el costo del otro hospital."
   - Compact preview row with two simple chips:
     - Green lock-open chip: "Ves gravedad: 18/40 pts"
     - Diagonal-hatched redaction chip: "Costos ajenos: Bloqueados"
3. Subtle secondary text link below card: "¿Prefieres mirar otro rol? Cambiar silla" (centered, 14px underlined #51676D).
4. Sticky bottom thumb-zone dock (white surface with top 1px border and safe-area padding):
   - Full-width primary button (54px height, #0E2A33 background, white bold text, 12px radius): "Entrar a mi silla →"

Strict constraints: No emojis as icons (use clean geometric SVG icons). No login fields. No eyebrow text above the heading. Everything readable in 3 seconds with one hand.
```

---

## PROMPT 2 — Pantalla 2: Tu Turno — Rol Clínico Proponente (`Urgencias` / `Médico de Turno`)

*Muestra la experiencia del jugador que defiende a su paciente (`Clínica Andes` o `Hospital Rural`) y siente el Fog of War (`403`) al primer toque.*

```text
Design Screen 2 of 6 for mobile web app [NOMBRE_APP] (390x844, Spanish, Clinical-Editorial Light Design System: #EEF2F1 canvas, #FFFFFF cards, #0E2A33 ink, #2BA36B emerald role accent, #D3273E bleed red).

User context: A judge assigned to "Jefatura de Urgencias · Clínica Andes" (sharing the seat with 1 co-pilot). They need to understand the urgent case, feel the real Fog of War protection in 1 tap, and submit their patient for the shared ICU bed.

Layout top to bottom (max 1.1 screen height, ultra-clean, no clutter):
1. Compact Sticky Header (60px, white #FFFFFF, bottom border #C7D2D0):
   - Left: Emerald dot + "Urgencias · Clínica Andes" (bold 15px) + tiny subtext "2 en tu rol".
   - Right: Live urgent timer pill in soft red (#FBE9EC background, #D3273E bold monospace text): "● 01:08 · Cama esperando".
2. Primary Case Card (white #FFFFFF, 16px radius, 1px border):
   - Heading (22px Archivo Bold): "Paciente A necesita la cama UCI"
   - One-line status (14px #51676D): "Compites contra Hospital Rural. Cierre a las 18:00."
   - Clean 3-column metric strip inside soft surface (#EEF2F1, 10px radius, NO nested cards):
     - "Gravedad": "18/40" (with tiny green lock label "Solo tú")
     - "Puntaje": "0,52" (tabular bold)
     - "Camas": "1 UCI"
3. Interactive Fog of War Peek Card (soft tinted surface #FFFFFF with subtle red status pill):
   - Title (16px bold): "Lo que no puedes ver"
   - Row showing label "Costo de Hospital Rural" next to a bold diagonal-hatched redaction bar (#0E2A33 stripes).
   - Compact inline error toast state already visible below to demonstrate the aha-moment (#FBE9EC background, #D3273E text, 1px red border):
     - Crisp lock icon + bold "Bloqueado por el servidor (403)" + one-line explanation "Ese dato jamás viajó a tu celular."
   - Secondary tactile pill button (44px height): "Intentar espiar otro dato"
4. Fixed Bottom Thumb-Zone Dock (white, top border #C7D2D0):
   - Full-width Primary CTA (52px height, #0E2A33 fill, white bold text): "Presentar a Paciente A para la cama →"
   - 4-Tab Bottom Navigation Bar (56px height, 44px+ touch targets, crisp outline SVG icons):
     - Tab 1 (Active, petrol bold + top 2px indicator): "Tu turno"
     - Tab 2: "Secretos"
     - Tab 3: "Mi agente"
     - Tab 4: "Sala"

Strict constraints: Zero raw error codes like "RBAC_SERVER_FILTERED". No desktop graphs or server telemetry. No emojis. Clean editorial spacing.
```

---

## PROMPT 3 — Pantalla 3: Tu Turno — Rol Financiero Aprobador (`Gestión` / `Convenios`)

*Diseñada para los 2 co-pilotos que guardan el secreto financiero (`$2.400.000` o `$1.600.000`), ven el choque de autoridad (`100% vs 60%`) y sellan el umbral con un slider táctil.*

```text
Design Screen 3 of 6 for mobile web app [NOMBRE_APP] (390x844, Spanish, Clinical-Editorial Light Design System: #EEF2F1 canvas, #FFFFFF cards, #0E2A33 ink, #D59411 amber role accent, #A86C00 clash amber, #14795A calm green).

User context: A judge assigned to "Dirección Administrativa · Clínica Andes" (with 1 co-pilot). They hold the private financial cost that Urgencias and the rival hospital CANNOT see, and must resolve an authority clash using a thumb-friendly slider.

Layout top to bottom:
1. Compact Sticky Header (60px):
   - Left: Amber dot + "Gestión · Clínica Andes" + subtext "2 en tu rol".
   - Right: Live urgent timer pill (#FBE9EC / #D3273E): "● 01:19".
2. Confidential Vault Card (white #FFFFFF, 16px radius, 1px border):
   - Row with bold heading (17px): "Dato confidencial · Solo tú lo ves" and a clean iOS-style toggle switch ON ("Oculto al resto").
   - Large tabular figure (32px Archivo Bold #0E2A33): "$2.400.000 CLP"
   - Sub-label (14px #51676D): "Costo cobertura UCI · Tope de contrato: $3.100.000"
3. Authority Clash & Threshold Control Card (white #FFFFFF, 16px radius):
   - Heading (19px bold): "Choque de autoridad (40%)" with compact amber pill (#FBF1D9 / #A86C00): "Bloqueado".
   - Visual horizontal bar comparing two markers: "Tu tope: 60%" vs "Urgencias pide: 100%" (with proposed case marker at "82%").
   - Large thumb-friendly range slider (28px circular handle, 48px touch area, active track #0E2A33) labeled "Tu umbral sin firma del Comité: 60%".
   - Compact live reliability impact strip (#E3F3EC soft green pill): "Al sellar el freno humano: confiabilidad sube de 43,4% a 96,1%".
4. Fixed Bottom Thumb-Zone Dock:
   - Full-width Primary CTA (52px height, #14795A calm green fill, white bold text): "Sellar tope en 60% →"
   - Same 4-Tab Bottom Navigation Bar ("Tu turno" active, "Secretos", "Mi agente", "Sala").

Strict constraints: Never force scrolling up and down between clash and approval — everything sits cleanly on one screen. No nested cards. High contrast tabular numerals.
```

---

## PROMPT 4 — Pantalla 4: Tu Turno — Comité Ético de la Red (El Clímax del Jurado)

*La pantalla más fotografiada y crítica del pitch: el árbitro neutral que decide la cama UCI con 1 toque en un chip de razón editable + botón verde/rojo.*

```text
Design Screen 4 of 6 for mobile web app [NOMBRE_APP] (390x844, Spanish, Clinical-Editorial Light Design System: #EEF2F1 canvas, #FFFFFF cards, #0E2A33 ink, #6A4BD6 violet arbiter accent, #14795A calm green, #D3273E bleed red).

User context: A judge assigned to "Comité Ético de la Red" (neutral arbiter, 2 co-pilots, NO AI agent). Both hospitals have submitted their patients. The judge does NOT see either hospital's financial cost, sees the deterministic equity tie-break, picks a quick editable reason chip in 1 tap, and seals the final allocation live.

Layout top to bottom:
1. Compact Sticky Header (60px):
   - Left: Violet badge dot + "Comité Ético · Árbitro neutral" + subtext "2 en tu rol · Sin ver costos".
   - Right: Live urgent timer pill (#FBE9EC / #D3273E): "● 01:42".
2. Deterministic Duel Card (white #FFFFFF, 16px radius, 1px border):
   - Heading (20px Archivo Bold): "Empate técnico: decide la equidad"
   - Two clean side-by-side candidate panels inside a soft #EEF2F1 track (no heavy borders):
     - Left: "Paciente A · Clínica Andes" · Big score "0,52" · Subtext "Necesidad sin cubrir: 0,40" · Hatched redaction bar "Costo oculto".
     - Right (highlighted with 1.5px #14795A border & white bg): Green badge "Recomendado" · "Paciente B · Hospital Rural" · Big score "0,53" · Subtext "Necesidad sin cubrir: 0,90" · Hatched redaction bar "Costo oculto".
   - Concise 1-line explanation below (13px #51676D): "Diferencia 0,01 (< 0,02). Gana quien más sufre si espera. El costo nunca entra."
3. Mandatory Human Reason Input (clean, effortless on mobile):
   - Label (14px bold #0E2A33): "Tu razón para el acta (obligatoria)"
   - Horizontally scrollable / wrapping 1-tap quick chips (36px height, pill radius):
     - Selected chip (#0E2A33 fill, white text): "Equidad verificada"
     - Unselected chips (#FFFFFF, 1px border): "Prioridad rural" · "Mayor riesgo al esperar" · "Vetar por revisión"
   - Compact 2-line editable textarea (Newsreader Italic 15px, pre-filled from selected chip): "Se asigna al Hospital Rural por criterio de equidad ante empate técnico (mayor necesidad sin cubrir)."
4. Fixed Bottom Thumb-Zone Dock:
   - Dual action row (12px gap):
     - Secondary button (38% width, 52px height, white fill, 1.5px #D3273E border, red bold text): "Vetar a B"
     - Primary button (62% width, 52px height, #14795A fill, white bold text): "Aprobar y asignar cama"
   - Clean 3-Tab Bottom Navigation Bar (NOTE: "Mi agente" tab is intentionally OMITTED for Comité Ético because the arbiter has no AI agent):
     - Tab 1 (Active): "Tu turno" · Tab 2: "Secretos" · Tab 3: "Sala"

Strict constraints: NEVER mention an AI agent on this screen. Keep the duel + quick chips + approve/veto buttons visible without scrolling on 390x844.
```

---

## PROMPT 5 — Pantalla 5: Tabs Secundarias (`Secretos / 403` y `Mi Agente`)

*Genera esta pantalla (o sepárala en 5A y 5B en UX Pilot) para mostrar cómo las pestañas mantienen limpio "Tu turno" mientras dan profundidad instantánea a los jurados curiosos.*

```text
Design Screen 5 of 6 (Two side-by-side mobile frames: 5A "Tab Secretos" and 5B "Tab Mi Agente") for [NOMBRE_APP] (390x844 each, Spanish, Clinical-Editorial Light Design System).

FRAME 5A — TAB "SECRETOS" (Fog of War in plain human language):
1. Same compact sticky header ("Urgencias · Clínica Andes" + live timer).
2. Heading (22px Archivo Bold): "Tus cartas y lo oculto"
3. Section 1 ("Lo que SÍ puedes ver"): Clean grouped white list container (1px border, internal dividers) with 3 rows:
   - "Gravedad clínica · 18/40 pts" with green pill "Solo tú" and eye toggle switch.
   - "Camas UCI disponibles · 1 cama" with neutral pill "Tu clínica".
   - "Ventana de cierre · 18:00 hoy" with neutral pill "Compartido".
4. Section 2 ("Bloqueado en el servidor"): Grouped white list with 2 crisp rows showing diagonal-hatched redaction bars instead of values:
   - "Costo cobertura · Clínica Andes" + hatched bar + subtle caption "Solo Dirección Administrativa".
   - "Costo traslado · Hospital Rural" + hatched bar + compact red outline button (40px height): "Probar acceso (403)".
5. Bottom bar with "Secretos" active.

FRAME 5B — TAB "MI AGENTE" (Role-paired AI inheriting exact RBAC):
1. Same compact sticky header.
2. Agent Identity Card (white #FFFFFF, 1px border):
   - Clean circular emerald geometric avatar + Heading "Agente Triaje" + subtitle "Hereda tus mismos permisos · No puede ver costos".
3. Concise AI Response Bubble (soft white card with subtle petrol accent, max 3 lines):
   - "Con gravedad 18/40 y cierre 18:00, recomiendo presentar a Paciente A ahora. No tengo acceso al costo de cobertura para evaluar presupuesto."
4. 1-Tap Prompt Chips above bottom bar (zero typing needed):
   - Chip 1: "¿Qué jugada recomiendas ahora?"
   - Chip 2 (red-tinted outline): "Intenta leer el costo del otro hospital (403)"
5. Collapsed accordion link at bottom: "Ver detalles del servidor (modelo y latencia) ▾" (collapsed by default so judges see zero technical clutter).
6. Bottom bar with "Mi agente" active.
```

---

## PROMPT 6 — Pantalla 6: Veredicto Sellado & Acta ("El Latido se Calma")

*El cierre emocional que aparece simultáneamente en los 10 celulares cuando el Comité aprueba: todo el rojo pasa a verde calmado.*

```text
Design Screen 6 of 6 for mobile web app [NOMBRE_APP] (390x844, Spanish, Clinical-Editorial Light Design System, state transitioned from Bleed Red to Calm Green #14795A).

User context: The Comité Ético just tapped "Aprobar y asignar cama". Instantly on all 10 connected phones and the big projector, the urgent red heartbeat stops and turns into a calm green flatline.

Layout top to bottom (fits in 1 screen, celebratory yet dignified clinical-editorial tone):
1. Calm Status Header (white #FFFFFF, bottom 1px #14795A border):
   - Left: Calm green pill "● RECURSO CONTENIDO" + time sealed "Decidido en 01:48".
   - Full-width calm flat green ECG wave graphic (#14795A stroke) directly underneath.
2. Verdict Hero Card (white #FFFFFF, 16px radius, 1.5px #14795A border):
   - Display heading (26px Archivo Bold #0E2A33): "Cama UCI asignada a Hospital Rural Valle Sur"
   - Winner summary line (15px #51676D): "Paciente B · Puntaje 0,53 · Desempate por equidad"
   - Human Verdict Quote Block (soft #E3F3EC surface, 12px radius, 16px padding):
     - Text in Newsreader Italic (17px #0E2A33): "“Se asigna al Hospital Rural por criterio de equidad ante empate técnico (mayor necesidad sin cubrir).”"
     - Attribution (13px #14795A bold): "Firmado por Comité Ético de la Red · 10 pantallas sincronizadas"
3. Proof Metrics Row (2 clean side-by-side stat tiles, #FFFFFF, 1px border):
   - Tile 1: "Confiabilidad del flujo" → "12,3% → 89,4%" (green bold)
   - Tile 2: "Secretos filtrados" → "0 fugas · 3 bloqueos 403"
4. Fixed Bottom Thumb-Zone Dock:
   - Primary CTA (52px, #0E2A33 fill, white text): "Descargar Acta auditada (.md / .json)"
   - Secondary outline button (46px): "Ver sala general"
   - Tiny honest footer disclaimer (11px #51676D): "Demostración simulada de coordinación organizacional. No es diagnóstico ni herramienta clínica."

Strict constraints: No confetti, no cartoon illustrations, no emojis. The calm green ECG line + Newsreader italic human signature create the emotional payoff.
```

---

## PROMPT 7 — Follow-ups Rápidos en UX Pilot (Para pulir sin regenerar toda la pantalla)

Usa cualquiera de estos prompts cortos directamente sobre una pantalla generada en UX Pilot:

- **Si UX Pilot agrega demasiado texto o tarjetas anidadas:**
  > *"Simplify this mobile screen for a 15-second live demo: remove any nested cards, remove eyebrow labels above headings, increase primary CTA height to 52px anchored at the bottom thumb zone, and replace any technical jargon with plain Spanish."*
- **Si UX Pilot pone emojis en la barra inferior o botones:**
  > *"Replace all emojis with clean, consistent 1.8px stroke monochrome outline SVG icons matching #0E2A33 and #51676D."*
- **Si UX Pilot pone texto gris ilegible para los secretos en vez de tachaduras:**
  > *"Replace blurred/gray placeholder values on hidden fields with crisp diagonal striped redaction bars in #0E2A33 (high-contrast declassified document style) paired with a short label 'Bloqueado en el servidor'."*
- **Si UX Pilot baja el contraste o lo vuelve dark mode:**
  > *"Enforce our Clinical-Editorial Light palette strictly: #EEF2F1 background, #FFFFFF cards with 1px #C7D2D0 borders, #0E2A33 primary text, #D3273E red only for waiting/blocked states, and #14795A green only for sealed/approved states."*

---

## 8. Mapa de Handoff a Render (Cuando tu equipo decida implementarlo)

Cuando aprueben las pantallas en UX Pilot / UX Studio (exportando HTML+Tailwind o Figma), el cambio técnico en `platanus-hack-26-cl-team-30` queda quirúrgicamente acotado a **4 piezas** sin romper los 80 tests:
1. **`JOIN_AUTO` atómico + co-pilotos (`rooms.ts`, `actions.ts`, `schema.ts`):** sortea primero las **5 sillas núcleo vacías** (`andes/a`, `andes/b`, `rural/a`, `rural/b`, `comite_red/c`) y del 6° al 10°+ asigna balanceadamente co-pilotos (`min(connectedCount)`), cambiando `tokens` de silla única a `Map<token, ParticipantSession>` → **0% errores `409 ROLE_TAKEN`**.
2. **QR único en `/stage` (`join-codes.tsx`):** 1 QR gigante a `/room/demo-cross?auto=1` ("Escanea y recibe tu rol aleatorio") + acordeón opcional con QRs por rol para ensayos.
3. **Layout mobile por 4 tabs + Sticky CTA (`room-client.tsx`, `decision-form.tsx`):** reemplaza la pila de 7 pantallas en `< lg` por el diseño aprobado en UX Pilot + chips editables de razón rápida en `DecisionForm` (respetando `REASON_REQUIRED`).
4. **Fixes de copy y visibilidad (`fog-of-war-panel-organ.tsx`, `seeds.ts`):** ocultar mención de agente en `comite_red` y marcar `deadline_window` visible a ambas orgs en `demo-cross`.
