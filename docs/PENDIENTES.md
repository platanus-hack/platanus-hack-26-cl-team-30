# Pendientes

Lo que sigue abierto. Cuando algo se resuelve, se borra de aquí y, si corresponde, se anota en `docs/DECISIONES.md`.

Actualizado el 21 de noviembre de 2026.

## Decisiones que necesitan a Sebastián

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| a | **Resuelto: el producto se llama Sculptor** (ronda 10, antes «Nexo»). Se cambió todo lo visible. Siguen con el nombre viejo, a propósito, los identificadores internos: variables `NEXO_*`, encabezados `x-nexo-secret` y `x-nexo-session`, ids de botón `nexo:approve`/`nexo:veto`, claves de almacenamiento `nexo:*`, la carpeta `src/components/nexo/`, el repo y la URL del deploy. Cambiarlos rompería Render y los webhooks. | Equipo | Si la plantilla de WhatsApp ya aprobada se llama `nexo_comite_caso`, `KAPSO_TEMPLATE_NAME` debe seguir con ese nombre hasta que Meta apruebe `sculptor_comite_caso`. |
| b | **El logo sigue siendo el de la plantilla** (`project-logo.png`). | Subir uno propio: PNG de 1000x1000, máximo 500 KB. |
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
| i4 | **El e2e nuevo no se ha corrido contra el deploy.** Además, el paso "sala nueva desde una frase" gasta una llamada a Claude por corrida. | Orquestador | Tras desplegar, `node scripts/e2e.mjs https://team-30-platanus-hack.onrender.com`. |
| i5 | **Canales del Comité sin probar contra Kapso ni ElevenLabs.** Solo hay pruebas unitarias. La llamada necesita un número de Twilio vinculado en ElevenLabs. | Sebastián | Configurar las variables en Render, registrar el webhook en Kapso con su secreto y hacer una prueba real de cada canal antes de mencionarlos en vivo. |
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
| r | **Ensayos con personas.** Las pruebas son automáticas. No hay registro de un ensayo con varios teléfonos reales en la red de la sede. | Hacer al menos dos ensayos cronometrados con teléfonos escaneando el QR, en la red donde se presentará. |

## Agregado por el orquestador (21 de noviembre, mañana)

- **Validación del evento.** Los cuatro requisitos que marcaba (nombre, descripción en español, URL del deploy y `project-description.md`) ya están completos en el repo oficial. El resultado solo se ve con la sesión iniciada en `hack.platan.us`: hay que revisarlo y confirmar que pasó.
- **Latencia del SSE en Render gratis.** En una de cuatro corridas del e2e contra el deploy hubo mensajes que tardaron hasta 3 segundos en llegar; las otras tres pasaron 97 de 97. Subir el servicio a un plan pagado antes de presentar reduce ese riesgo.
- **Reinicio de salas:** resuelto. `DELETE /api/rooms/:id` exige el token de anfitrión que recibe quien crea la sala (o `NEXO_ADMIN_KEY`), salvo «Nueva ronda» en una sala de demo con el acta cerrada, que no lo pide (ronda 11).
- **Fórmula de prioridad.** `computeTriageScore` resta el riesgo por demora, como dice el plan. Decidir si se invierte el signo: cambia el resultado de la demo.
- **UX Pilot.** El servidor MCP quedó agregado, pero pide autenticación: correr `/mcp` en una sesión nueva de Claude Code y autorizarlo.

## Agregado en la ronda 8 (celular y sorteo de silla, 21 de noviembre, tarde)

- **QR único y el Comité:** resuelto. En las salas de demo el Comité entra por el QR único sin clave, como tercera persona (rondas 11 y 12). En las salas normales, sin `?key` el Comité no entra al sorteo.
- **WhatsApp contra el número real sin registrar.** El último commit de WhatsApp habla de «plantilla aprobada (número de producción)», pero `docs/MEDICIONES.md` no tiene ninguna prueba contra Kapso real y PREGUNTAS 11 y 28 dicen que los canales se probaron solo con pruebas unitarias. Confirmar con el equipo y anotar qué se probó y cuándo.
- **Resuelto:** `scripts/e2e.mjs` recorre el sorteo de silla, la sala de demo con 3 personas sin clave y el plan B.
- **Silla del celular sin probar en teléfonos reales:** se probó con Playwright en 390 × 844 (claro y oscuro). Falta un ensayo con iPhone y Android para revisar el área segura y el teclado sobre la razón del Comité.
- **Secretos y Sala se desplazan un poco** (hasta unos 160 px en 844 px de alto): tienen más filas que un turno. Los turnos no se desplazan.

## Agregado en la ronda 9 (demo de 3 personas, 21 de noviembre, noche)

- **Resuelto: teléfonos abiertos tras un reinicio.** En las salas de demo ya no recuperan su silla: vuelven a la tarjeta de sorteo con «Empezó una ronda nueva» (`shouldRecoverSeat`, `tests/demo-phone.test.ts`).
- **Resuelto: pestaña «Sala» en la demo.** Muestra los 4 pasos de la demo (Unirse, Casos, Comité, Acta), sin «Acordar límites» ni «Firmar» (`demoStep`).
- **Ensayo con personas reales:** el recorrido de 3 personas se probó con Playwright y con `scripts/e2e.mjs`, no con teléfonos reales en la sede.
- **Servidor de desarrollo después de `next build`:** al levantar `next dev` justo después de un `next build` en la misma carpeta, la página del celular entró en un bucle de recargas («Fast Refresh rebuilding» en cada conexión) y cada recarga pedía un sorteo. Se arregló borrando `.next/dev` y reiniciando `next dev`. No afecta al deploy (`next start`), pero conviene no ensayar la demo sobre un `next dev` que convivió con un build.

## Agregado en la ronda 10 (nombre Sculptor)

- **Asistente de voz ya creado en ElevenLabs:** el nombre, el prompt y el saludo nuevos («asistente del Comité de Sculptor») están en `src/integrations/elevenlabs.ts`, pero solo se usan al crear el agente. Si Render tiene `ELEVENLABS_AGENT_ID`, ese agente sigue diciendo «Nexo» hasta actualizarlo en el panel de ElevenLabs (o borrar la variable para que se cree uno nuevo).
- **Plantilla de WhatsApp:** el nombre sugerido ahora es `sculptor_comite_caso`. Hay que crearla y aprobarla en Meta; mientras tanto, `KAPSO_TEMPLATE_NAME` debe seguir con el nombre de la plantilla ya aprobada. El encabezado del mensaje interactivo ya dice «Sculptor · Decisión del Comité».
- **Fuera del reparto de la ronda 10:** `project-description.md` todavía dice «Nexo» (líneas 1 y 13). `public/pitch/index.html` ya está al día.

## Agregado en la ronda 11 (Comité sin clave en la demo)

- **Probar contra el deploy con 3 celulares reales** después de subir: el tercero debe quedar como Comité sin clave, y «Nueva ronda» debe funcionar desde la pantalla grande sin `NEXO_ADMIN_KEY`.

## Agregado en la ronda 14 (notas de voz por WhatsApp)

- **Probar contra los servicios reales:** activar `NEXO_VOICE_NOTES=1` en Render con el número de producción y confirmar que (a) ElevenLabs entrega el Opus en OGG y WhatsApp lo muestra como nota de voz, y (b) el audio del caso llega al tocar un botón y el del acta al escribir la razón.
- **Resuelto (ronda 15): el acta en audio también llega si el Comité sella desde la web,** siempre que a esa sala se le haya enviado el caso por WhatsApp y la conversación esté abierta (`sendActaAfterWebSeal`, llamada desde la ruta de acciones). Falta el caso del plan B: si el piloto sella solo en una sala de demo, no se envía audio.

## Agregado en la ronda 18 (veto en un paso, resumen por WhatsApp, espera con flujo)

- **Probar el botón wa.me contra el número real** (+1 208 485 0157): que el webhook de Kapso reciba «Hola, soy el Comité de la sala <código>», responda la confirmación y, al decidir, llegue el acta en texto y nota de voz (con `NEXO_VOICE_NOTES=1`).
- **Plantilla para el acta:** si `KAPSO_TEMPLATE_NAME` está configurada, el acta se envía por esa plantilla con {{1}} = sala y {{2}} = resumen. La plantilla del caso fue pensada para el caso con botones; si el texto no calza, conviene aprobar una plantilla propia para el acta.

## Agregado en la ronda 19 (componentes de 21st, segunda búsqueda)

- **Particle Galaxy (21st 18257) no se integró.** Necesita three.js, que suma más de 600 KB minificado aunque se cargue diferido con `next/dynamic`, sobre el límite de 200 KB que se fijó para la página. Si Ramón la quiere para el héroe de la landing general, habría que medir el bundle con three.js o rehacerla en canvas 2D.
- **Si cambia la pantalla grande o el celular, hay que volver a sacar las capturas de `public/casos/`**: salen de salas de demo jugadas con Playwright (pasos 1 a 3 de la pantalla grande y los tres celulares de cada rubro).

