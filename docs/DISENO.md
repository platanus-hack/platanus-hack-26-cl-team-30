# Diseño visual de Sculptor

Guía para cualquier persona o agente (Claude, Gemini, Antigravity) que cambie cómo se ve Sculptor. Si vas a tocar una pantalla, lee esto primero: así lo nuevo calza con lo que ya existe.

## Nombre y marca

El producto se llama **Sculptor** (antes «Nexo»). En pantalla se escribe «Sculptor», y en mayúsculas espaciadas «SCULPTOR» en el encabezado de la pantalla grande. Los identificadores internos siguen diciendo `nexo` y no se cambian: variables `NEXO_*`, encabezados `x-nexo-*`, ids como `nexo:approve`, la carpeta `src/components/nexo/`, el repo y la URL del deploy.

La marca (`src/components/landing/mark.tsx`) es una «S» de un solo trazo sobre un cuadrado redondeado en tinta, con un punto de arcilla. Es un SVG con los tokens de la paleta, sin imágenes externas. Con `bare` queda solo el trazo en `currentColor`, para ponerlo sobre el círculo lima de la pantalla grande. El ícono de la pestaña es `src/app/icon.svg`, con los mismos trazos.

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

Los tokens globales (`src/app/globals.css`: `--brand`, `--primary`, `--background`, `--clash`…) ya usan esta paleta en claro: la portada, las salas y la pantalla grande se ven como una sola app. El botón primario va en tinta y `--brand` es sage. El teléfono tiene sus propios tokens con los mismos valores (`--st-*` en `src/components/seat/seat.css`).

El modo «night» de los tokens globales sigue a `prefers-color-scheme`, igual que el teléfono, y se puede forzar con `data-theme="dark"` o `data-theme="light"`. La portada y `src/components/nexo/` ya no usan `bg-white` fijo (salvo el código QR, que necesita fondo blanco para leerse). Toda la app usa Manrope.

**Pendiente:** revisar la portada en oscuro con capturas; la verificación en el navegador quedó a medias.

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

### Sala de demo: 3 personas

En las salas de demo (`demo` en el estado de la sala) la pantalla grande se simplifica para que alguien que no conoce Sculptor pueda conducirla:

- Pasos: Unirse → Casos → Comité → Acta. «Límites» no aparece: los límites y las firmas de cada hospital los hace el piloto automático.
- En «Unirse» van grandes solo las 3 personas: «Clínica · Urgencias», «Hospital Rural · Turno» y «Comité». Los roles que juega el piloto automático van pequeños, con borde punteado y el chip «automático».
- La barra de arriba no tiene «Pregúntale al caso» (está en el dock) y la vista principal no muestra el selector de escenario (está en «Controles del presentador», en Acta).
- Al cerrar el acta aparece un botón grande «Nueva ronda». En la demo lo puede apretar cualquiera.
- **Demo pauteada:** la pantalla le habla a una persona a la vez, por su rol: una franja gigante dice «Clínica: presenta a tu paciente», «Hospital Rural: presenta a tu paciente» o «Comité: ¿aceptas o rechazas?», con el asiento o la tarjeta de esa persona resaltados en el color del paso actual. Si el servidor manda la cuenta regresiva del plan B, va al lado como un anillo que se vacía (en arcilla los últimos 5 s). Nunca se numera a las personas: cada una es su rol y su color.
- Mientras quede una silla libre, el código para entrar sigue a la vista: grande en «Unirse», en la esquina en Casos («¿Falta alguien? Escanea») y en la franja cuando falta el Comité («Comité: escanea el QR»).
- El guion del narrador, sincronizado con cada paso, está en `docs/GUION_DEMO.md`.

### Paso «Unirse»: la galaxia

Mientras falta gente, la pantalla grande no muestra la Historia sino esto:

```
Escanea y entra
●① Unirse ─ ② Límites ─ ③ Casos ─ ④ Comité ─ ⑤ Acta
3/5            (esfera con un nodo        ┌────────┐
conectados      y una órbita por          │   QR   │
● Urgencias ✓   cada rol conectado)       │ grande │
○ Comité                                  └────────┘
```

- La galaxia (`src/components/stage/galaxy.tsx`) es un canvas que vive detrás del contenido. Cada rol conectado enciende un nodo, una órbita de su color y su parte de la esfera; con todos conectados la esfera queda completa.
- Los nodos salen de los asientos reales del SSE. No hay teclas ni simulador.
- En los pasos siguientes la misma galaxia queda de fondo, tenue. Al sellar se calma y se vuelve verde.
- Colores de los asientos (`SEAT_TONES` en `src/components/stage/seats.ts`): quien propone va en eucalipto, quien aprueba en ocre o arcilla y el Comité en marfil (tinta en claro). Lima sigue reservado para «lo de ahora».
- Con `prefers-reduced-motion` no gira ni anima: se dibuja quieta y cambia solo cuando entra alguien.

### Motivos tomados de los prototipos de Nahum

Están en `docs/diseno/nahum/`. Usamos sus motivos con la paleta oficial, no con su paleta petróleo:

- **Rojo de espera y verde de resuelto**, siempre con icono y palabra.
- **Pulso** (`src/components/stage/ecg.tsx`): un trazo de electrocardiograma rojo mientras la decisión sigue abierta, que pasa a una línea verde y plana al sellar.
- **Franjas diagonales** para el dato tachado: el nombre del dato en una o dos palabras y una barra rayada en lugar del valor.

## Reglas de texto

Vienen del mentor («bombardean con texto todo, eso no aporta») y valen para toda pantalla:

1. Un título de máximo 6 palabras.
2. Como mucho una frase de apoyo, de máximo 12 palabras.
3. Números grandes en vez de párrafos.
4. Las explicaciones van detrás de un «¿Por qué?» que se despliega, o se eliminan.
5. Un solo aviso de «demostración simulada» por pantalla, pequeño, en el pie.
6. Las etiquetas de candado llevan una o dos palabras.

## Teléfonos

Cada persona ve solo su rol y su turno. La silla vive en `src/components/seat/` (estilos en `seat.css`, con la paleta oficial y modo oscuro según el teléfono). Pantalla de 390 px:

- Al entrar, la tarjeta «Te tocó <rol>» con la organización, la misión en una frase y dos chips (qué ves / cuántos datos no). Un botón: «Entrar a mi silla».
- Cada turno cabe en una pantalla: una tarjeta, un solo botón primario anclado abajo (56 px, ancho completo, respeta el área segura) y tres pestañas: Tu turno, Secretos y Sala.
- El Comité ve un duelo de dos tarjetas (puntaje grande, el recomendado con borde verde), chips de razón que rellenan el texto editable, y «Vetar» / «Aprobar y asignar». Sin razón los botones no se habilitan.
- Los datos reservados son barras de franjas diagonales. Pedir uno ajeno muestra «Este dato nunca llegó a tu celular».
- Arriba, el pulso ECG late en rojo mientras se espera y queda verde y plano al sellar.

Reglas de texto (feedback del mentor: «bombardean con texto todo»): título de máximo 6 palabras, a lo más una frase de apoyo de 12 palabras, números grandes en vez de párrafos, explicaciones detrás de «¿Por qué?», un solo aviso de demostración simulada por pantalla (pequeño, al pie) y cero jerga.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Portada (landing) | `src/app/page.tsx` y `src/components/landing/` |
| Caso de uso (hoy, los hospitales) | `src/app/casos/hospitales/page.tsx` y `src/components/casos/` (texto en `content.ts`, cifras del motor en `data.ts`) |
| Pantalla grande | `src/app/stage/[roomId]/stage-client.tsx` |
| Deck del pitch (6 láminas, flechas o espacio para avanzar; diseño v2 de Nahum con cifras del repo) | `public/pitch/index.html`, se abre en `/pitch/index.html` |
| Teléfono de cada rol | `src/app/room/[roomId]/room-client.tsx` y `src/components/seat/` |
| Piezas de sala (guía de turnos, QR, avisos, voz) | `src/components/nexo/` |
| Grafo vivo, choque de autoridad, medidor p^n, telemetría | `src/components/organs/` |
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
