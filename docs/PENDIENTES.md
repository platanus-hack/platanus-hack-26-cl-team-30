# Pendientes que necesitan a Sebastián

Decisiones y verificaciones que ningún agente puede cerrar solo. Cuando una se resuelve, se borra de aquí y, si corresponde, se anota en `docs/DECISIONES.md`.

## Antes de presentar

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| a | **"Nexo" es un nombre provisional.** Está en `platanus-hack-project.jsonc`, `README.md`, `project-description.md`, `CLAUDE.md` y `docs/ARQUITECTURA.md`. | Confirmarlo o elegir otro. Si cambia, hay que reemplazarlo en esos cinco archivos. |
| b | **El logo sigue siendo el de la plantilla** (`project-logo.png`). | Subir uno propio: PNG de 1000x1000, máximo 500 KB. |
| f | **Render está en plan gratis y se duerme** cuando no recibe visitas. La primera carga después tarda, y al dormirse se pierde el estado de las salas, que vive en memoria. | Subir de plan antes de presentar (`plan` en `render.yaml` o desde el panel). |
| g | **La validación del evento solo se ve con sesión iniciada.** Ningún agente puede revisarla. | Después del push, entrar con tu cuenta y confirmar que el repo pasa la validación. |
| i | **El README lo escribió una IA.** La plantilla pedía que lo escribiera una persona del equipo. | Leerlo y corregirlo a mano. |
| j | **El token del proxy sigue activo.** | Rotarlo al terminar la hackathon. |

## Qué se puede afirmar y qué no

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| c | **"0 bytes a la nube" solo vale en modo local.** El deploy público en Render usa Claude porque no llega al Spark, así que ahí los datos sí salen a la nube. La telemetría debe mostrar el proveedor real y si es local o nube. | En el pitch, decir "0 bytes a la nube" solo mientras se muestra el modo local. Decidir si la demo en vivo corre local, en el deploy, o ambas. |
| h | **Las cifras del caso son de ejemplo, no estadísticas.** Costos, puntajes de gravedad y plazos vienen de la semilla. Además, nadie del área de salud ha validado el flujo. | No citarlas como datos reales. Mostrar el flujo a una persona real del área de salud, o decir en la presentación que no se validó. |

## Sin verificar en el Spark

| # | Pendiente | Qué hay que hacer |
| --- | --- | --- |
| d | **Endpoint, id de modelo y control de thinking del modelo local.** El plan los marca como no verificados. `scripts/spark-setup.sh` descarga `gpt-oss:20b` y `qwen3:32b`, pero no está confirmado cuál se usa ni cómo se apaga el thinking en ese runtime. | Probar contra el Spark y fijar `LLM_BASE_URL` y `LLM_MODEL`. Anotar el resultado en `docs/ARQUITECTURA.md`, sección Modelos. |
| e | **Latencias en el Spark sin medir.** El plan apunta a menos de 6 s para generar un genoma y menos de 3 s por turno de agente; son metas, no mediciones. | Medir en el Spark. Hasta entonces, no dar cifras de latencia en la presentación. |
