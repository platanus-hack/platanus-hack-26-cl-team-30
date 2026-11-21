# team-30 · Platanus Hack 26 Santiago

Repo oficial del equipo 30 en Platanus Hack 26: Santiago ft. Buk. Track: **Multiplayer**. El hacking termina el domingo 22 de noviembre a las 09:30 y las presentaciones son de 11:00 a 14:00.

## Equipo

- **Ramón Molina** (@rm004607): producto web. Pantallas y rutas de la API.
- **Sebastián Vargas** (@iswebster1401): agente e infraestructura. Modelos, Spark, integraciones y deploy. Decide qué se corta cuando falta tiempo.
- **Nahum Díaz** (@nadilopoff): negocio y pitch. Usuarios reales, finanzas y relato.

## Qué construimos

**Nexo** (nombre de trabajo): un esqueleto organizacional multijugador que coordina decisiones críticas entre personas y agentes emparejados por rol. Cada persona entra con un rol, ve solo lo que su rol y su organización pueden ver, y lo que decide cambia en el mismo segundo lo que ven los demás.

- **Suelo (lo que tiene que funcionar sí o sí):** una clínica (`clinica_andes`) con 3 roles: Jefatura de Urgencias, Dirección Administrativa y Comité Ético. Urgencias quiere autorizar una cama UCI; Gestión exige firma si se cruza un umbral; el Comité entra por QR y aprueba o veta con una razón obligatoria.
- **Capa inter-org (la ambición):** 2 hospitales (`clinica_andes` y `hospital_rural`) compiten por 1 cama UCI de referencia. Ninguno ve el costo de cobertura del otro. Un algoritmo determinista ordena a los candidatos, desempata por equidad, y el Comité puede vetar. Todo queda en una bitácora exportable como acta.
- **Regla de corte:** si la capa inter-org no queda estable, se presenta el suelo. Nunca se presenta algo que no corra.

El código vive en este repo: contrato de datos en `src/lib/genome/`, reglas en `src/lib/engine/deterministic.ts`, salas e identidad en `src/lib/store/rooms.ts`. Los ids se escriben sin tilde (`clinica_andes`). Los datos del caso son simulados: no es una herramienta clínica.

## Principios que no se negocian

1. **El modelo solo produce contenido, nunca estructura.** El modelo genera un genoma JSON que se valida antes de usarse; nunca genera HTML ni JSX. Roles, jerarquía, compuertas, permisos, asignación y confiabilidad (p^n) son código determinista, sin modelo.
2. **Nada se mueve sin una persona.** Los agentes nunca cambian el estado por su cuenta. Toda mutación, conflicto, asignación y veto lo dispara un humano y se refleja al instante en las demás pantallas.
3. **Permisos de verdad.** El dato oculto no viaja por la red: se filtra en el servidor por `orgId` y `roleId`. Un intento de lectura ajena devuelve 403 y queda en la bitácora.
4. **Demo con algo en juego.** Empieza y termina con 2 o más personas decidiendo sobre algo que cuesta (vida, dinero o tiempo).
5. **La telemetría dice la verdad.** En modo local el modelo corre en el Spark y ningún dato sale de la red. El deploy público en Render usa Claude porque no llega al Spark, así que ahí sí salen datos a la nube. La telemetría muestra el proveedor real y si es local o nube; nunca un "0 bytes a la nube" fijo.
6. **Una sola capa de modelos.** Todo pasa por `src/lib/llm.ts`. No se crea un cliente aparte para el modelo local.

@AGENTS.md

## Prioridades

1. Una demo que funcione en vivo vale más que código limpio. Un solo flujo completo antes que varias funciones a medias.
2. Cambios chicos y desplegables. Si algo toma más de una hora, buscar el atajo.
3. Responder y comentar en español.

## Stack

- Next.js (App Router, `src/`), TypeScript, Tailwind y shadcn/ui. Componentes nuevos con `npx shadcn@latest add <nombre>`.
- Sin base de datos: las salas viven en la memoria del servidor (`src/lib/store/rooms.ts`). Ver `docs/DECISIONES.md`.
- Zod para validar todo lo que entra (`src/lib/genome/schema.ts`, `src/lib/store/actions.ts`).
- Deploy público en Render (`render.yaml`), desde un repo personal espejo.

## Regla de modelos

Toda llamada a un modelo pasa por `src/lib/llm.ts`. No llamar a un proveedor directo desde otra parte del código. `LLM_PROVIDER=anthropic` usa Claude con el SDK oficial; cualquier otro valor usa el protocolo compatible con OpenAI (Ollama). Pasar del Spark a la nube es cambiar variables de entorno.

- El Spark es un NVIDIA DGX Spark de 128 GB con Ollama en el puerto 11434. Es ARM64: no instalar ni compilar cosas en él sin revisar que exista build para esa arquitectura.
- El deploy público no puede llegar al Spark por IP local. Para la demo desplegada se usa Claude.

## Comandos

- `npm run dev`: servidor local en http://localhost:3000
- `npm run build` y `npm run lint`: correr antes de cada deploy
- `npm test`: pruebas del motor, los permisos y la API (Vitest, sin modelo)
- `node scripts/e2e.mjs <url>`: recorrido completo por HTTP contra un servidor levantado
- `GET /api/health`: dice si el modelo configurado responde

## Documentación técnica

Los jueces revisan este repositorio con un agente de IA mientras el equipo presenta, y después hacen preguntas sobre la estructura de la solución. Por eso la documentación se mantiene al día durante todo el desarrollo, no al final.

- `docs/RECORRIDO.md`: los archivos que hay que leer, en orden, para entender el sistema.
- `docs/ARQUITECTURA.md`: componentes, flujo de un dato, agentes, modelos, integraciones y qué es real o simulado.
- `docs/DECISIONES.md`: por qué se eligió cada cosa y qué se descartó.
- `docs/PREGUNTAS.md`: preguntas probables del jurado con respuestas de 20 segundos.
- `docs/MEDICIONES.md`: cifras medidas, con cómo y dónde. Una cifra que no está aquí no está medida.
- `docs/PENDIENTES.md`: lo que sigue abierto o sin verificar.

Reglas para cualquier cambio:

1. Si un cambio agrega, quita o modifica un componente, un agente, una integración o el flujo de datos, actualizar `docs/ARQUITECTURA.md` en el mismo commit.
2. Si se toma una decisión técnica entre dos alternativas, agregar una entrada en `docs/DECISIONES.md`.
3. Si un cambio responde o altera una pregunta de `docs/PREGUNTAS.md`, actualizar la respuesta.
4. Cada agente vive en su propio archivo bajo `src/agents/`, con su instrucción y su formato de salida a la vista.
5. Lo simulado se marca como simulado en el código y en la tabla de "Qué es real y qué es simulado". Nunca presentar algo simulado como real.
6. La documentación describe lo que existe. No escribir lo que se planea como si ya estuviera hecho.

## Entrega

- Completar `platanus-hack-project.jsonc` (nombre, resumen, descripción y URL del deploy) y `project-description.md` antes de enviar.
- El logo debe ser un PNG de 1000x1000 de máximo 500 KB.
- El README debe ser corto y directo. Lo escribe una persona del equipo.
- Vercel no puede conectarse a este repo de la organización. El deploy sale de un repo personal espejo; el README explica cómo configurar el doble `push`.
