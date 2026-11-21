# Pendientes

Lo que sigue abierto. Cuando algo se resuelve, se borra de aquí y, si corresponde, se anota en `docs/DECISIONES.md`.

Actualizado el 21 de noviembre de 2026.

## Decisiones que necesitan a Sebastián

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| a | **"Nexo" es un nombre provisional.** Está en `platanus-hack-project.jsonc`, `README.md`, `project-description.md`, `CLAUDE.md`, `docs/` y en la interfaz (`src/app/layout.tsx`, `src/app/page.tsx`). | Confirmarlo o elegir otro. Si cambia, reemplazarlo en todos esos lugares. |
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
| i6 | **El README dice "No hay base de datos".** Las salas siguen sin base de datos, pero ahora la portada usa Supabase. El README lo escribe una persona del equipo. | Sebastián | Ajustar esa frase a mano. |
| k | **`.playwright-mcp/`** quedó sin seguimiento en la raíz del repo. | Orquestador | No incluirlo en un commit, o agregarlo a `.gitignore`. |
| s | **Lo que leen los jueces es lo publicado.** El trabajo de las últimas rondas sigue sin commit: entre otros, `docs/RECORRIDO.md`, `docs/MEDICIONES.md`, `src/lib/store/http.ts`, `scripts/stress-llm.mjs`, y el `CLAUDE.md` sin Supabase. El `CLAUDE.md` publicado todavía describe Supabase y un cliente que ya no existe. El agente del ensayo lo notó. | Orquestador | Commit y push antes de presentar, y confirmar en GitHub que se ve la versión nueva. |
| t | **Un texto de la interfaz contradice al motor.** `src/components/organs/role-agent-panel-organ.tsx` dice que la propuesta del agente no cambia nada hasta que una persona decide, pero si quien la pide es el proponente, el valor sugerido pasa en ese momento a ser el valor propuesto del caso (`applyAgentProposal`). La compuerta sigue exigiendo firma. | Agente 1 | Cambiar el texto, por ejemplo: "Si eres el proponente, el valor sugerido reemplaza tu propuesta; la firma sigue siendo de una persona". |
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
- **Reinicio de salas:** resuelto. `DELETE /api/rooms/:id` ahora exige el token de anfitrión que recibe quien crea la sala (o `NEXO_ADMIN_KEY`); el e2e usa el token de las salas que crea.
- **Fórmula de prioridad.** `computeTriageScore` resta el riesgo por demora, como dice el plan. Decidir si se invierte el signo: cambia el resultado de la demo.
- **UX Pilot.** El servidor MCP quedó agregado, pero pide autenticación: correr `/mcp` en una sesión nueva de Claude Code y autorizarlo.

