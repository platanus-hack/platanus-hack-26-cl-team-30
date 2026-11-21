# Diseño visual de Nexo

Guía para cualquier persona o agente (Claude, Gemini, Antigravity) que cambie cómo se ve Nexo. Si vas a tocar una pantalla, lee esto primero: así lo nuevo calza con lo que ya existe.

## A quién le hablamos

Las pantallas las usa personal de salud y de otras organizaciones, no técnicos. Además se proyectan en el pitch. De ahí salen tres reglas:

1. Se entiende en cinco segundos, desde lejos. Una idea principal por pantalla.
2. Español simple y concreto: «Falta que el Comité decida», no «Pending arbiter action».
3. Nada de jerga del sistema en la vista principal: ni ids, ni tokens, ni «auditLog», ni la bitácora. El registro existe, pero va colapsado detrás de «Ver registro».

## Paleta oficial

La paleta es la de la landing original de Ramón. Tiene un modo claro (marfil y eucalipto) y uno oscuro («night», con acento lima). El modo oscuro va por defecto en la pantalla grande, para cansar menos la vista.

### Claro

| Token | Color | Uso |
|---|---|---|
| ivory | `#fffdf8` | Superficies y tarjetas |
| mint | `#cfeae3` | Fondo base |
| mint-soft | `#eaf5f1` | Fondos suaves, degradados |
| eucalyptus | `#6faf9b` | Acento, brillos |
| sage | `#4f7c6d` | Estados positivos, foco |
| ink | `#24403a` | Texto principal y botón primario |
| ink-soft | `#4d6860` | Texto secundario |
| line | `#d7e6e0` | Bordes |
| clay | `#c58f7b` | Acento cálido |
| clay-soft | `#f6e9e3` | Fondo de avisos |
| clay-ink | `#8f5743` | Atención / alerta (texto) |

### Oscuro («night»)

| Token | Color | Uso |
|---|---|---|
| night | `#151515` | Fondo |
| night-raised | `#222220` | Tarjetas |
| ivory | `#fffdf8` | Texto principal |
| fog | `#b4b4ac` | Texto secundario |
| eucalyptus | `#6faf9b` | Botón primario |
| lime | `#e1ff00` | Paso actual, selección, foco. Úsalo poco: solo marca «lo de ahora» |
| clay | `#c58f7b` / `#e0a891` | Atención |

Los valores exactos en CSS están en `src/components/ui/glassy-dashboard.tsx`, en las variables `--gd-*` de `.gd-app` y `.gd-app[data-theme="dark"]`.

**Pendiente:** la portada y las salas (`src/app/globals.css`) todavía usan la paleta teal anterior (`--brand: #0f766e`). Hay que migrarlas a esta paleta para que todo se vea como una sola app.

### Reglas de color

- El color nunca va solo: un estado lleva siempre icono y palabra («✓ Firmó», «🔒 Reservado»).
- Verde (sage o eucalyptus) significa listo o a favor. Arcilla significa atención. Lima es solo «paso actual».
- Contraste mínimo AA en los dos modos. Prueba siempre claro y oscuro.

## Estilo: vidrio esmerilado

La base visual es el panel de vidrio de 21st.dev (`glassy-dashboard`), adaptado a esta paleta. Se ve en `/centro`.

- Paneles translúcidos con `backdrop-filter: blur`, borde claro de 1 px y sombra suave.
- Esquinas muy redondeadas: 20–34 px en paneles y píldoras en botones.
- Tipografía Manrope (variable). Títulos grandes con letter-spacing negativo y números tabulares.
- Animaciones cortas con GSAP: entradas escalonadas de 0,3 a 0,5 s y números que cuentan. Hay que respetar `prefers-reduced-motion`.

## Pantalla grande: «Historia de la decisión»

Formato elegido por Sebastián para `/stage`, la pantalla que se proyecta. De arriba hacia abajo:

```
① Unirse ─ ② Límites ─ ③ Casos ─ ●④ Comité ─ ⑤ Acta     ← paso actual en lima
1 CAMA UCI · ventana 18:00 · ⏱ 04:12                     ← recurso en grande
[Hospital Rural  0,82 ★ propuesto]  [Clínica Andes 0,64] ← una tarjeta por candidato
Falta: el Comité decide — aprobar o vetar con razón      ← una sola frase, grande
```

- Los datos reservados de cada organización se muestran con candado, **nunca su valor**: es la idea central del producto.
- Siguen los QR para unirse y el dock: Centro de mando / Ranking / Organizaciones / Acta.
- No es un tablero de métricas: sin gráficos de ingresos ni tablas en la vista principal.

## Teléfonos

Cada persona ve solo su rol y su turno. Pantalla de 390 px:

- Un botón principal por pantalla, grande (mínimo 44 px de alto).
- La tarjeta de turno dice qué hacer ahora y por qué.
- Las decisiones del Comité exigen escribir una razón, y la interfaz lo explica antes de que falle.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Portada (landing) | `src/app/page.tsx` y `src/components/landing/` |
| Pantalla grande | `src/app/stage/[roomId]/stage-client.tsx` |
| Teléfono de cada rol | `src/app/room/[roomId]/room-client.tsx` |
| Piezas de sala (turnos, pasos, QR, avisos) | `src/components/nexo/` |
| Tarjetas de caso, ranking, contador | `src/components/organs/` |
| Panel de vidrio (base visual) | `src/components/ui/glassy-dashboard.tsx`, demo en `/centro` |
| Tokens globales y tipografías | `src/app/globals.css` y `src/app/layout.tsx` |
| Componentes base (shadcn) | `src/components/ui/` |

**No toques** `src/lib/engine/` (reglas), `src/lib/store/` (salas) ni `src/integrations/` (WhatsApp y voz) para un cambio visual. Las pantallas solo leen el estado que llega por SSE (`src/lib/client/use-room.ts`).

## Cómo probar un cambio visual

```
npm run dev        # http://localhost:3000
```

1. En la portada, toca «Abrir mi propia sala»: se abre la pantalla grande con los QR.
2. Abre los QR en otra pestaña o en el celular para jugar cada rol.
3. Revisa en 1440 px y 390 px, en claro y en oscuro.
4. Antes de subir: `npx tsc --noEmit && npm run lint && npm test`.
