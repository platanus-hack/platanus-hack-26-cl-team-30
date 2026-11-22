# Pendientes

Lo que sigue abierto. Cuando algo se resuelve, se borra de aquí y, si corresponde, se anota en `docs/DECISIONES.md`.

Actualizado el 22 de noviembre de 2026, 03:00.

## Antes de cerrar el repo (domingo 22)

Lista corta de lo que falta, sacada de las tablas de abajo. Lo que no se alcance se dice como «no lo medimos» o se saca del guion.

| # | Qué | Quién | Referencia |
| --- | --- | --- | --- |
| z1 | Fusionar la rama `docs` a `main` (trae `origin/main`, `guia-al-dia`, el guion del día alineado con la presentación y la portada corregida) y confirmar en GitHub que se ve la versión nueva | Ramón | y5, s |
| z2 | Decidir qué pasa con las ramas que tienen un commit sin fusionar: `portada-hero` («el puente» en vez del Venn), `orbita-galaxia` y `orbita-relevo` (bancos de prueba de `/orbita`). Si no van, no se fusionan; no cambian nada de lo que se presenta | Sebastián | — |
| z3 | **Resuelto:** según la charla oficial, el hacking se detiene a las **09:00**. Presentaciones generales de 09:30 a 11:30; finales de 12:30 a 15:30. `CLAUDE.md` ya lo dice | Equipo | — |
| z4 | Correr `node scripts/e2e.mjs https://team-30-platanus-hack.onrender.com --llm` y anotar en `docs/MEDICIONES.md` cuántas frases de la negociación fueron respaldo | Sebastián | q, ensayo del bot |
| z5 | Subir Render a un plan pagado o, como mínimo, abrir el deploy 10 minutos antes para despertarlo | Sebastián | c |
| z6 | **Video de respaldo grabado** (86 s, contra el deploy, 5 navegadores con 3 celulares a la vista; ver «Video de respaldo» en `docs/DEMO_DIA.md`). Está en el escritorio del Mac donde se grabó, no en el repo: copiarlo al computador del proyector y dejarlo abierto en una pestaña, en pausa | Sebastián y Ramón | `docs/DEMO_DIA.md` (d) |
| z7 | Ensayos cronometrados con 5 teléfonos reales en la red de la sede, desde la lámina 4 de `/presentacion` | Equipo | r, y3 |
| z8 | Revisar con sesión iniciada en `hack.platan.us` que el repo pasa la validación | Sebastián | e |
| z9 | Leer y corregir a mano el README: la plantilla pide que lo escriba una persona del equipo | Ramón | f |
| z10 | Después de la hackathon: rotar el token del proxy | Sebastián | g |

## Decisiones que necesitan a Sebastián

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| a | **Resuelto: el producto se llama Sculptor** (ronda 10, antes «Nexo»). Se cambió todo lo visible. Siguen con el nombre viejo, a propósito, los identificadores internos: variables `NEXO_*`, encabezados `x-nexo-secret` y `x-nexo-session`, ids de botón `nexo:approve`/`nexo:veto`, claves de almacenamiento `nexo:*`, la carpeta `src/components/nexo/`, el repo y la URL del deploy. Cambiarlos rompería Render y los webhooks. | Equipo | Si la plantilla de WhatsApp ya aprobada se llama `nexo_comite_caso`, `KAPSO_TEMPLATE_NAME` debe seguir con ese nombre hasta que Meta apruebe `sculptor_comite_caso`. |
| b | **Resuelto:** `project-logo.png` es el logo oficial de Sculptor (galaxia NGC 253 en píxeles, PNG 1000x1000, 193 KB). | Nada. |
| c | **Render está en plan gratis y se duerme** sin visitas. La primera carga tarda y, al dormirse, se pierden las salas, que viven en memoria. | Subir de plan antes de presentar (`plan` en `render.yaml` o desde el panel). |
| d | **Dónde corre la demo en vivo.** El deploy usa Claude, así que ahí los datos sí salen a la nube. "Cero bytes a la nube" solo vale en modo local. | Decidir si la demo corre en el deploy, en local con el Spark, o ambas. En el pitch, decir "cero bytes" solo mientras se muestra el modo local. |
| e | **La validación del evento solo se ve con sesión iniciada.** Ningún agente puede revisarla. | Después del push, entrar con tu cuenta y confirmar que el repo pasa la validación. |
| f | **El README lo escribió una IA.** La plantilla pedía que lo escribiera una persona del equipo. | Leerlo y corregirlo a mano. |
| g | **El token del proxy sigue activo.** | Rotarlo al terminar la hackathon. |

## Huecos en el código y en la configuración

| # | Pendiente | Responsable | Qué hay que hacer |
| --- | --- | --- | --- |
| h2 | **Las tablas de Supabase no existen todavía.** Sin ellas el formulario de acceso responde 503 y la entrevista no aparece (la página no se rompe). | Sebastián | Correr las tres migraciones de `supabase/migrations/` en el proyecto (en orden) y, para mostrar una entrevista, poner `published_at` a mano en una fila revisada. Las variables `NEXT_PUBLIC_SUPABASE_*` deben estar en Render antes del build, porque Next las incrusta al compilar. |
| i2 | **`TRUST_PROXY=1` en Render sin verificar.** El límite de peticiones toma el último salto de `X-Forwarded-For`. Si en Render ese salto no es la IP del cliente, todos comparten un mismo límite (protege igual, más grueso). | Sebastián | Revisar en los registros de Render qué llega en `X-Forwarded-For`. Si el primer salto es el del cliente, avisar al agente de motor para ajustar `clientKey`. |
| i3 | **`NEXO_ADMIN_KEY` sigue sin definirse en Render.** Sin ella, en producción las salas fijas no entregan sus controles ni su QR del Comité, y la pantalla grande ofrece crear una sala propia. | Sebastián | Definirla si se quiere presentar desde `demo-cross`; si no, presentar desde una sala nueva. |
| i4 | **Resuelto el 22 de noviembre, 01:57: 142 de 142 contra el deploy (`docs/MEDICIONES.md`).** Pendiente original: el e2e nuevo no se había corrido contra el deploy. Además, el paso "sala nueva desde una frase" gasta una llamada a Claude por corrida. | Orquestador | Tras desplegar, `node scripts/e2e.mjs https://team-30-platanus-hack.onrender.com`. |
| i5 | **Canales del Comité: probados en vivo, con dos huecos.** WhatsApp de punta a punta (caso, botón Aprobar, razón y acta «vía WhatsApp») y la nota de voz del caso se probaron contra Kapso y ElevenLabs reales el 21 de noviembre (ver «Canales del Comité contra los servicios reales» en `docs/MEDICIONES.md`). Faltan: la plantilla `sculptor_comite_caso`, que sigue en revisión en Meta, y la llamada telefónica, que necesita un número de Twilio. | Sebastián | Revisar el estado de la plantilla en Kapso → Templates antes de presentar; si no está aprobada, usar el botón «Recibir resumen por WhatsApp» (abre la ventana de 24 h). No ofrecer la llamada telefónica en vivo. |
| i6 | **Resuelto:** el README ya dice que las salas no usan base de datos y que Supabase solo atiende el formulario de acceso y las entrevistas de la portada. | Sebastián | Nada. |
| k | **Resuelto:** `.playwright-mcp/` está en `.gitignore`. | Orquestador | Nada. |
| s | **Lo que leen los jueces es lo publicado.** Lo de las rondas anteriores ya está en git; lo de la ronda 15 (acta en audio al sellar desde la web, decisiones automáticas marcadas, preguntas nuevas) todavía no. | Orquestador | Commit y push antes de presentar, y confirmar en GitHub que se ve la versión nueva. |
| t | **Resuelto:** el panel del agente ahora vive en la pestaña «Sala» del celular (`src/components/seat/room-view.tsx`) y, si quien lo pide es el proponente, dice «Su valor reemplaza tu propuesta»; la firma sigue siendo de una persona. | Agente 1 | Nada. |
| u | **Código que no se alcanza.** `resolveSeat` en `src/agents/role-agent.ts` arma una persona para el Comité árbitro, pero `runAgent` (`src/lib/store/rooms.ts`) responde 409 antes de llamar al agente para el árbitro. | Agente 2 | Borrar esa rama o decidir que el árbitro sí tenga agente. Mientras tanto, los docs dicen que no lo tiene. |

## Qué se puede afirmar y qué no

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| l | **Las cifras del caso son de ejemplo**, no estadísticas: costos, puntajes de gravedad, pesos de la fórmula y plazos vienen de `src/lib/genome/seeds.ts`. Nadie del área de salud validó el flujo. Además, la fórmula resta el riesgo por demora (viene así del plan), lo que habría que revisar con criterio clínico. | No citarlas como datos reales. Mostrar el flujo a una persona del área de salud, o decir en la presentación que no se validó. |
| x | **No hay justificación medida para `claude-opus-5-5`.** Es el valor por defecto del código y de `render.yaml`, y la mutación tarda unos 10 segundos (la meta del plan eran 6). Ningún documento lo compara con un modelo más rápido. | Decidir si se mantiene. Si se prueba otro, basta cambiar `LLM_MODEL` en Render y correr `node scripts/stress-llm.mjs` contra el deploy; anotar el resultado en `docs/MEDICIONES.md` y la decisión en `docs/DECISIONES.md`. |
| v | **En la semilla, el desempate de equidad no cambia al ganador.** Los puntajes son 0,52 (A) y 0,53 (B): el desempate se aplica, pero B ya ganaba por puntaje. Si el guion dice "el desempate le dio la cama al hospital rural", es inexacto. | Decidir si basta con mostrar que el desempate se aplica, o pedirle al Agente 2 una semilla donde el de mejor puntaje tenga menos necesidad sin cubrir, para que el desempate dé vuelta el resultado en vivo. |
| m | **p^n no sube con el veto por sí solo.** Sube al sellar la regla (43% a 96% en la clínica) y, entre organizaciones, cuando el Comité sella la asignación (12% a 89%). Es un modelo ilustrativo. | Ajustar el guion si dice "sube con el veto". Ver `docs/PREGUNTAS.md`, sección "Cuidado con estas afirmaciones". |

## Sin verificar o sin medir

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| n | **Modelo local en el Spark sin verificar.** No está confirmado el endpoint, el id del modelo (`scripts/spark-setup.sh` descarga `gpt-oss:20b` y `qwen3:32b`) ni el parámetro que apaga el razonamiento (`LLM_NO_THINK_BODY` en `src/lib/llm.ts`). | Probar contra el Spark, fijar `LLM_BASE_URL`, `LLM_MODEL` y `LLM_NO_THINK_BODY`, y anotar el resultado en `docs/ARQUITECTURA.md`, sección Modelos. |
| o | **Latencias del modelo casi sin medir.** Con Claude en el deploy hay un solo dato: una mutación de genoma tardó unos 10 segundos (`scripts/stress-llm.mjs`). Los turnos de agente no tienen cifra registrada y el Spark no se midió. El plan apuntaba a menos de 6 s por genoma y menos de 3 s por turno de agente: son metas, y con Claude la mutación ya las supera. | Registrar la salida completa de `scripts/stress-llm.mjs` en `docs/ARQUITECTURA.md`, y medir en el Spark. No dar otras cifras en la presentación. |
| p | **Carga no medida en el deploy.** Los 500 SSE con p95 de 52 ms se midieron en un notebook contra las rutas sin Next. `scripts/load-test.mjs` se niega a correr contra hosts públicos a propósito. | Si se quiere un número del deploy, correrlo una vez con `--allow-remote` y pocas conexiones, fuera del horario de demo. |
| q | **El recorrido completo con modelo no se ha corrido.** `scripts/e2e.mjs` pasó contra el deploy sin `--llm`. El agente y la mutación con Claude sí se ejercitaron con `scripts/stress-llm.mjs`. | Correr `node scripts/e2e.mjs https://team-30-platanus-hack.onrender.com --llm` una vez antes de presentar (gasta algunas llamadas a Claude). |
| w | **Una corrida de `npm test` falló una vez:** la contraprueba de `tests/http.test.ts` tardó 415 segundos con la máquina cargada por otros procesos. No se reprodujo aislada ni en la corrida completa siguiente (222 de 222 en 25 segundos). | Si vuelve a pasar, revisar si el recorrido queda esperando un mensaje que nunca llega. |
| x | **Rendimiento de carga medido solo en local.** La tabla antes y después de `docs/MEDICIONES.md` es Lighthouse contra `next start` en un notebook, con red y CPU simuladas. La rama `rendimiento` no está unida a `main`. El TBT de la portada en móvil sigue alto (intro y fondo WebGL). | Al unir la rama, correr `node scripts/lighthouse.mjs https://team-30-platanus-hack.onrender.com <carpeta>` y revisar que las imágenes de `public/` lleguen con `Cache-Control` largo desde Render. |
| r2 | **Un celular dejó de recibir la sala una vez (22 de noviembre, 02:40, contra el deploy).** En 1 de 6 corridas de `scripts/novato-demo.mjs --grabar`, el celular del Comité se quedó en la fase Posturas («Listo: empiezan a negociar», con el reloj detenido) mientras las otras 5 pantallas siguieron hasta la fase Comité. No hubo errores de JavaScript y la página siguió pintando: lo que se detuvo fue su SSE. La máquina estaba muy cargada (load average 15 a 20) y no se reprodujo en las 4 corridas siguientes. El cliente reabre el SSE solo cuando el `EventSource` da error (`src/lib/client/use-room.ts`, `onerror`); no vigila latidos, así que una conexión abierta pero muda no se reabre sola. | **Corregido:** `useRoom` (`src/lib/client/use-room.ts`) ahora vigila: el servidor manda la sala al menos cada 15 s, y si en 40 s no llega nada, o si el teléfono vuelve a primer plano tras 20 s sin datos, cierra el SSE y lo reabre. En vivo, si igual un celular quedara pegado, recargar la página: la silla queda guardada en esa pestaña (`sessionStorage`). |
| r | **Ensayos con personas.** Las pruebas son automáticas. No hay registro de un ensayo con varios teléfonos reales en la red de la sede. | Hacer al menos dos ensayos cronometrados con teléfonos escaneando el QR, en la red donde se presentará. |

## Para subir todo a `main` (21 de noviembre, noche)

Revisión de la entrega. Los borradores del pitch que no coincidían con el código (dossier, guion PDF, deck «Cupo» y prototipos del deck) se sacaron del repo; lo vigente es `docs/DEMO_DIA.md`.

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| y1 | **«Nexo» como nombre de la implementación en salud.** Sculptor es el sistema; la clínica sería su primera implementación («Nexo»). Hoy la interfaz dice Sculptor en todas partes y «Nexo» solo queda en identificadores internos. | Decidir si se usa «Nexo» en el pitch o en la página del caso hospitalario (`/casos/hospitales`). |
| y2 | **Resuelto: una sola dirección.** `/` es la landing de Sculptor, la portada con el ejemplo pasó a `/hospitales`, `/demo` abre la demo en vivo y `/sculptor` redirige a `/`. | Nada. |
| y3 | **Ensayar con la presentación web** (`/presentacion`) y el guion de `docs/DEMO_DIA.md`, que ya están alineados con el código. | Al menos 3 ensayos cronometrados con la tecla T (reloj de 3:00). |
| y4 | **La simulación orbital depende de internet.** Carga Three.js desde jsDelivr y un video desde CloudFront. En la landing y en el pitch, sin red queda en negro. | Si la red de la sede falla, abrir la app sin esa sección o descargar Three.js al repo. |
| y5 | **Fusionar la rama `docs` a `main`.** Trae la ronda 20, la landing, la presentación, la marca, la investigación y el proceso. | Revisar el diff, correr `npm test`, `npm run build` y `scripts/e2e.mjs`, y fusionar. |

## Agregado por el orquestador (21 de noviembre, mañana)

- **Validación del evento.** Los cuatro requisitos que marcaba (nombre, descripción en español, URL del deploy y `project-description.md`) ya están completos en el repo oficial. El resultado solo se ve con la sesión iniciada en `hack.platan.us`: hay que revisarlo y confirmar que pasó.
- **Latencia del SSE en Render gratis.** En una de cuatro corridas del e2e contra el deploy hubo mensajes que tardaron hasta 3 segundos en llegar; las otras tres pasaron 97 de 97. Con la versión actual pasó 142 de 142 (22 de noviembre). Subir el servicio a un plan pagado antes de presentar reduce ese riesgo.
- **Reinicio de salas:** resuelto. `DELETE /api/rooms/:id` exige el token de anfitrión que recibe quien crea la sala (o `NEXO_ADMIN_KEY`), salvo «Nueva ronda» en una sala de demo con el acta cerrada, que no lo pide (ronda 11).
- **Fórmula de prioridad.** `computeTriageScore` resta el riesgo por demora, como dice el plan. Decidir si se invierte el signo: cambia el resultado de la demo.
- **UX Pilot.** El servidor MCP quedó agregado, pero pide autenticación: correr `/mcp` en una sesión nueva de Claude Code y autorizarlo.

## Agregado en la ronda 8 (celular y sorteo de silla, 21 de noviembre, tarde)

- **QR único y el Comité:** resuelto. En las salas de demo el Comité entra por el QR único sin clave, como tercera persona (rondas 11 y 12). En las salas normales, sin `?key` el Comité no entra al sorteo.
- **WhatsApp contra el número real:** resuelto. La prueba en vivo del 21 de noviembre está en `docs/MEDICIONES.md`.
- **Resuelto:** `scripts/e2e.mjs` recorre el sorteo de silla, la sala de demo con 3 personas sin clave y el plan B.
- **Silla del celular sin probar en teléfonos reales:** se probó con Playwright en 390 × 844 (claro y oscuro). Falta un ensayo con iPhone y Android para revisar el área segura y el teclado sobre la razón del Comité.
- **Secretos y Sala se desplazan un poco** (hasta unos 160 px en 844 px de alto): tienen más filas que un turno. Los turnos no se desplazan.

## Agregado en la ronda 9 (demo de 3 personas, 21 de noviembre, noche)

- **Resuelto: teléfonos abiertos tras un reinicio.** En las salas de demo ya no recuperan su silla: vuelven a la tarjeta de sorteo con «Empezó una ronda nueva» (`shouldRecoverSeat`, `tests/demo-phone.test.ts`).
- **Resuelto: pestaña «Sala» en la demo.** Muestra los 4 pasos de la demo (Unirse, Casos, Comité, Acta), sin «Acordar límites» ni «Firmar» (`demoStep`).
- **Ensayo con personas reales:** el recorrido de 3 personas se probó con Playwright y con `scripts/e2e.mjs`, no con teléfonos reales en la sede.
- **Servidor de desarrollo después de `next build`:** al levantar `next dev` justo después de un `next build` en la misma carpeta, la página del celular entró en un bucle de recargas («Fast Refresh rebuilding» en cada conexión) y cada recarga pedía un sorteo. Se arregló borrando `.next/dev` y reiniciando `next dev`. No afecta al deploy (`next start`), pero conviene no ensayar la demo sobre un `next dev` que convivió con un build.

## Agregado en la ronda 10 (nombre Sculptor)

- **Asistente de voz ya creado en ElevenLabs:** resuelto. Se actualizó por la API a «Sculptor · Asistente del Comité», con `eleven_v3_conversational` y la voz chilena «Joaquín» (verificado con `GET`).
- **Plantilla de WhatsApp:** el nombre sugerido ahora es `sculptor_comite_caso`. Hay que crearla y aprobarla en Meta; mientras tanto, `KAPSO_TEMPLATE_NAME` debe seguir con el nombre de la plantilla ya aprobada. El encabezado del mensaje interactivo ya dice «Sculptor · Decisión del Comité».
- **Resuelto:** `project-description.md` ya dice «Sculptor». `public/pitch/index.html` ya está al día.

## Agregado en la ronda 11 (Comité sin clave en la demo)

- **Probar contra el deploy con 3 celulares reales** después de subir: el tercero debe quedar como Comité sin clave, y «Nueva ronda» debe funcionar desde la pantalla grande sin `NEXO_ADMIN_KEY`.

## Agregado en la ronda 14 (notas de voz por WhatsApp)

- **Notas de voz contra los servicios reales:** la del caso llegó en la prueba del 21 de noviembre (con `NEXO_VOICE_NOTES=1`). Falta confirmar en vivo el acta en audio y la voz «Fer» después del cambio.
- **Resuelto (ronda 15): el acta en audio también llega si el Comité sella desde la web,** siempre que a esa sala se le haya enviado el caso por WhatsApp y la conversación esté abierta (`sendActaAfterWebSeal`, llamada desde la ruta de acciones). Falta el caso del plan B: si el piloto sella solo en una sala de demo, no se envía audio.

## Agregado en la ronda 18 (veto en un paso, resumen por WhatsApp, espera con flujo)

- **Probar el botón wa.me contra el número real** (+1 208 485 0157): que el webhook de Kapso reciba «Hola, soy el Comité de la sala <código>», responda la confirmación y, al decidir, llegue el acta en texto y nota de voz (con `NEXO_VOICE_NOTES=1`).
- **Plantilla para el acta:** si `KAPSO_TEMPLATE_NAME` está configurada, el acta se envía por esa plantilla con {{1}} = sala y {{2}} = resumen. La plantilla del caso fue pensada para el caso con botones; si el texto no calza, conviene aprobar una plantilla propia para el acta.

## Agregado en la ronda 19 (componentes de 21st, segunda búsqueda)

- **Particle Galaxy (21st 18257) no se integró.** Necesita three.js, que suma más de 600 KB minificado aunque se cargue diferido con `next/dynamic`, sobre el límite de 200 KB que se fijó para la página. Si Ramón la quiere para el héroe de la landing general, habría que medir el bundle con three.js o rehacerla en canvas 2D.
- **Si cambia la pantalla grande o el celular, hay que volver a sacar las capturas de `public/casos/`**: salen de salas de demo jugadas con Playwright (pasos 1 a 3 de la pantalla grande y los tres celulares de cada rubro).
- **Ronda 20:** las capturas de la pantalla grande de `public/casos/` ya son de la demo con negociación (`<rubro>-negociacion-*.webp`), y también los celulares (`<rubro>-negociacion-cel-*.webp`, del celular de p3 en `src/components/seat/negotiation-view.tsx`). Los textos de las páginas de caso ya hablan de la demo de 5 personas con agentes («Pruébalo con cinco personas», «2 min aproximadamente, como máximo por ronda»).

## Agregado en la ronda 20 (negociación entre agentes)

- **Los textos del modelo en la negociación no se han visto contra Claude real.** Las pruebas y los recorridos locales corren sin modelo, así que publicaron el respaldo (`fallback: true`). Falta una corrida en el deploy para ver si Claude responde en menos de 6 s y si sus frases caben en 110 caracteres sin cortarse. Si tarda, subir `NEGOTIATION_MODEL_TIMEOUT_MS` también obliga a subir `NEXO_NEGOTIATION_STEP_MS`.
- **El filtro de datos reservados busca valores, no ideas.** Atrapa números de 3 o más cifras, «2,4 millones», «2.400 mil» y «23/50» o «23 de 50». No atrapa una paráfrasis como «cuesta más de dos millones»; la defensa principal sigue siendo que el agente solo recibe la vista de su rol.
- **La demo pauteada de 3 personas sigue en el código** (`negotiation: false` en `POST /api/rooms`), con sus pruebas, pero ninguna pantalla la ofrece.
- **Los códigos de sala no se reutilizan mientras vive el proceso.** Un reinicio del servidor en Render olvida la lista; con 32^5 (más de 33 millones) códigos posibles, repetir uno es muy improbable, pero no está garantizado entre reinicios.
- **Sin capturas de la negociación en el celular** si el servidor local no podía levantarse; ver el resumen de la ronda.

## Agregado en el ensayo del bot de los jueces (22 de noviembre)

Lo encontraron tres revisores sin contexto leyendo el código; las respuestas para el jurado están en `docs/PREGUNTAS_JUECES.md`. Nada de esto se cambió en el código.

- **No hay medición de cuántas frases de la negociación escribe Claude en el deploy** ni de su latencia por frase. La pantalla no distingue respaldo de modelo (la marca `fallback` solo sale en el acta). Correr `node scripts/e2e.mjs <deploy> --llm` y anotar la línea «N de 4 con texto de respaldo».
- **El temporizador de la negociación presenta los casos en nombre de las personas** (`proposalTick` en `src/lib/store/rooms.ts`) con `{ via: "negociación" }` y sin `automatic`.
- **El filtro `containsReserved` no cubre secretos de texto** («Vacunas y sueros», «Alto», «4 toneladas»): solo valores con 3 o más dígitos. Opciones: no enviar al modelo los valores reservados para el argumento público, o filtrar también por texto.
- **La identidad protege la silla, no a la persona:** un mismo cliente puede tomar sillas de las dos organizaciones.
- **La compuerta no bloquea la asignación entre organizaciones** y el proponente puede sellar la regla solo, incluso en modo autónomo.
- **Sin tope global para los turnos de agente y la negociación;** la cola del modelo es global y sin largo máximo.
- **Canales del Comité para una sola sala a la vez:** número de WhatsApp global, razón aplicada a la sesión más reciente, `getOnlyVoiceSession` global, mismo secreto para la herramienta de la guía y la que sella.
- **La telemetría informa la configuración, no lo observado,** y no cuenta lo que sale a ElevenLabs ni a Kapso.
- ~~**El prompt de la guía describe la demo de 3 personas** y `guide-status.ts` dice que la propuesta sale «con el resultado del debate», lo que no es cierto.~~ **Resuelto (22 nov):** `GUIDE_PROMPT` describe la demo de 5 personas, el texto de `guide-status.ts` dice que la propuesta sale de la regla visible y no del debate, y el agente ya creado en ElevenLabs se actualizó por la API (`PATCH`, verificado con `GET`).
- **Resuelto (22 nov): textos de la portada.** `src/components/sculptor/content.ts` ya no dice «Ningún agente cambia el estado» ni «en el mismo segundo», «97/97» pasó a «142/142» y la barra (`chrome.tsx`) dice «Ver un caso» en vez de «Ejemplo real». «500 conexiones» sigue, con «en un notebook» al lado.
