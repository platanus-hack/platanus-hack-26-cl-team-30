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
| h | **`DELETE /api/rooms/:id` solo pide clave si existe `NEXO_ADMIN_KEY`**, y `render.yaml` no la define. Sin ella, alguien del público podría reiniciar `demo-cross` en plena presentación. | Sebastián | Definir `NEXO_ADMIN_KEY` en el panel de Render antes de presentar. Quien ensaye tendrá que enviar la clave en el encabezado `x-admin-key` para reiniciar una sala. |
| i | **No hay límite de uso por persona.** Hay topes por rol, por sala y de salas totales, pero cualquiera puede crear salas comunes y mutarlas, y cada mutación es una llamada a Claude. | Agente 2 | Aceptado para la demo. Si preocupa el gasto, poner un tope de llamadas por minuto en `src/lib/llm.ts`. |
| j | **ElevenLabs sigue en `.env.example`** aunque no se usa. `CLAUDE.md` y `docs/` ya no mencionan Supabase ni ElevenLabs, y el código de Supabase se borró. | Agente 2 | Quitar el bloque de ElevenLabs de `.env.example`. |
| k | **`.playwright-mcp/`** quedó sin seguimiento en la raíz del repo. | Orquestador | No incluirlo en un commit, o agregarlo a `.gitignore`. |

## Qué se puede afirmar y qué no

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| l | **Las cifras del caso son de ejemplo**, no estadísticas: costos, puntajes de gravedad, pesos de la fórmula y plazos vienen de `src/lib/genome/seeds.ts`. Nadie del área de salud validó el flujo. Además, la fórmula resta el riesgo por demora (viene así del plan), lo que habría que revisar con criterio clínico. | No citarlas como datos reales. Mostrar el flujo a una persona del área de salud, o decir en la presentación que no se validó. |
| m | **p^n no sube con el veto por sí solo.** Sube al sellar la regla (43% a 96% en la clínica) y, entre organizaciones, cuando el Comité sella la asignación (12% a 89%). Es un modelo ilustrativo. | Ajustar el guion si dice "sube con el veto". Ver `docs/PREGUNTAS.md`, sección "Cuidado con estas afirmaciones". |

## Sin verificar o sin medir

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| n | **Modelo local en el Spark sin verificar.** No está confirmado el endpoint, el id del modelo (`scripts/spark-setup.sh` descarga `gpt-oss:20b` y `qwen3:32b`) ni el parámetro que apaga el razonamiento (`LLM_NO_THINK_BODY` en `src/lib/llm.ts`). | Probar contra el Spark, fijar `LLM_BASE_URL`, `LLM_MODEL` y `LLM_NO_THINK_BODY`, y anotar el resultado en `docs/ARQUITECTURA.md`, sección Modelos. |
| o | **Latencias del modelo casi sin medir.** Con Claude en el deploy hay un solo dato: una mutación de genoma tardó unos 10 segundos (`scripts/stress-llm.mjs`). Los turnos de agente no tienen cifra registrada y el Spark no se midió. El plan apuntaba a menos de 6 s por genoma y menos de 3 s por turno de agente: son metas, y con Claude la mutación ya las supera. | Registrar la salida completa de `scripts/stress-llm.mjs` en `docs/ARQUITECTURA.md`, y medir en el Spark. No dar otras cifras en la presentación. |
| p | **Carga no medida en el deploy.** Los 500 SSE con p95 de 52 ms se midieron en un notebook contra las rutas sin Next. `scripts/load-test.mjs` se niega a correr contra hosts públicos a propósito. | Si se quiere un número del deploy, correrlo una vez con `--allow-remote` y pocas conexiones, fuera del horario de demo. |
| q | **El recorrido completo con modelo no se ha corrido.** `scripts/e2e.mjs` pasó contra el deploy sin `--llm`. El agente y la mutación con Claude sí se ejercitaron con `scripts/stress-llm.mjs`. | Correr `node scripts/e2e.mjs https://team-30-platanus-hack.onrender.com --llm` una vez antes de presentar (gasta algunas llamadas a Claude). |
| r | **Ensayos con personas.** Las pruebas son automáticas. No hay registro de un ensayo con varios teléfonos reales en la red de la sede. | Hacer al menos dos ensayos cronometrados con teléfonos escaneando el QR, en la red donde se presentará. |

## Agregado por el orquestador (21 de noviembre, mañana)

- **Validación del evento.** Los cuatro requisitos que marcaba (nombre, descripción en español, URL del deploy y `project-description.md`) ya están completos en el repo oficial. El resultado solo se ve con la sesión iniciada en `hack.platan.us`: hay que revisarlo y confirmar que pasó.
- **Latencia del SSE en Render gratis.** En una de cuatro corridas del e2e contra el deploy hubo mensajes que tardaron hasta 3 segundos en llegar; las otras tres pasaron 97 de 97. Subir el servicio a un plan pagado antes de presentar reduce ese riesgo.
- **Reinicio de salas abierto.** El deploy no define `NEXO_ADMIN_KEY`, así que cualquiera que conozca el id puede reiniciar una sala con `DELETE`. Definirla en Render la protege, pero entonces el paso de borrado del e2e necesita esa clave.
- **Fórmula de prioridad.** `computeTriageScore` resta el riesgo por demora, como dice el plan. Decidir si se invierte el signo: cambia el resultado de la demo.
- **UX Pilot.** El servidor MCP quedó agregado, pero pide autenticación: correr `/mcp` en una sesión nueva de Claude Code y autorizarlo.

