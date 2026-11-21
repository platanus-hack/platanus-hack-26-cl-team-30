# Arquitectura

Documento vivo. Se actualiza en el mismo commit que cambia la arquitectura. Si este documento y el código no coinciden, el código manda y esto es un error que hay que corregir.

**Estado (21 de noviembre de 2026):** el producto funciona de punta a punta y está desplegado en https://team-30-platanus-hack.onrender.com. Todo lo que este documento describe existe en el código; lo que no está verificado o es simulado se marca como tal.

## Resumen

Nexo (nombre de trabajo) es una sala compartida donde varias personas, cada una con un rol, toman una decisión crítica en tiempo real. Cada rol tiene un agente de IA emparejado que propone, pero no decide.

- **Quiénes participan a la vez:** los roles de una organización (proponente, aprobador y Comité) y, en la capa entre organizaciones, los roles de dos organizaciones más un Comité árbitro que no pertenece a ninguna.
- **Qué hace el sistema con sus aportes:** el servidor guarda un solo estado por sala y le envía a cada conexión una versión distinta, filtrada por organización y por rol. Las reglas (permisos, choque de autoridad, compuerta, asignación del recurso, contador) son código determinista, sin modelo.
- **Qué entrega:** una decisión tomada por personas, con su razón escrita, y un acta con la bitácora completa.

El caso de la demo es de salud y usa datos simulados. En `single_org`, una clínica con 3 roles decide sobre una cama UCI. En `cross_org`, 2 hospitales compiten por 1 cama de referencia sin ver el costo del otro, y un Comité que entra por código QR aprueba o veta con una razón.

## Dónde mirar

| Si la pregunta es sobre... | Archivo |
| --- | --- |
| Qué datos existen y qué recibe un cliente | `src/lib/genome/schema.ts` |
| Los datos del caso de la demo | `src/lib/genome/seeds.ts` |
| Permisos, compuerta, asignación, p^n, contador, acta | `src/lib/engine/deterministic.ts` |
| Qué acciones existen y su forma | `src/lib/store/actions.ts` |
| Identidad (token por rol), salas y aviso de cambios | `src/lib/store/rooms.ts` |
| Tiempo real (SSE) | `src/app/api/rooms/[roomId]/events/route.ts` |
| Llamadas a modelos, cola y telemetría | `src/lib/llm.ts` |
| Qué le llega al modelo y qué se hace con su respuesta | `src/agents/role-agent.ts`, `src/agents/mutate-genome.ts` |
| Qué está comprobado | `tests/`, `scripts/e2e.mjs`, `scripts/load-test.mjs` |

## Componentes

| Componente | Qué hace | Dónde vive | Tecnología |
| --- | --- | --- | --- |
| Contrato de datos | Esquemas de todo lo que entra y sale: genoma, recurso escaso, estado de sala (`RoomState`, con secretos) y vista del cliente (`ProjectedRoomState`, sin ellos) | `src/lib/genome/schema.ts` | Zod |
| Semillas | Tres organizaciones (`clinica_andes`, `hospital_rural`, `dist_tech`) y el recurso escaso, validados al cargar el módulo | `src/lib/genome/seeds.ts` | TypeScript |
| Motor determinista | Todas las reglas. Funciones puras: reciben el estado y el reloj, devuelven un estado nuevo o un rechazo | `src/lib/engine/deterministic.ts` | TypeScript, sin dependencias |
| Contrato de acciones | Forma de las 11 acciones (`ActionSchema`) y códigos de error | `src/lib/store/actions.ts` | Zod |
| Almacén de salas | Estado en memoria, token por rol, salas fijas `demo` y `demo-cross`, aviso de cambios y topes de memoria. No decide reglas: valida, comprueba identidad y delega en el motor | `src/lib/store/rooms.ts`, `src/lib/store/http.ts` (lectura acotada del body) | `Map` y `EventEmitter` de Node |
| Rutas de la API | Entrada HTTP. Cada ruta llama al almacén | `src/app/api/` | Route Handlers de Next.js |
| Capa de modelos | Única puerta a un modelo de lenguaje: dos proveedores, cola, tope de tokens, JSON validado y telemetría | `src/lib/llm.ts` | SDK de Anthropic; `fetch` para el protocolo compatible con OpenAI |
| Agentes | Agente de rol y agente de mutación. Cada uno en su archivo, con su instrucción y su formato de salida | `src/agents/` | Llaman a `chatJson` de la capa de modelos |
| Cliente de sala | Único lugar de la interfaz que habla con `/api/rooms`: abre el SSE, guarda la identidad y envía acciones | `src/lib/client/use-room.ts` | React, `EventSource`, `sessionStorage` |
| Pantallas | Portada (`/`), estación de un rol (`/room/[roomId]`) y pantalla general para proyectar (`/stage/[roomId]`) | `src/app/` | Next.js 16 (App Router), React 19, Tailwind 4 |
| Órganos | Siete piezas de interfaz que dibujan el estado proyectado. No calculan ni ocultan nada | `src/components/organs/` | React |
| Piezas de sala | Códigos QR, selector de rol, bitácora, formulario de mutación y aviso de datos simulados | `src/components/nexo/` | React, `qrcode` |
| Deploy | Un servicio Node siempre encendido | `render.yaml` | Render |
| Preparación del Spark | Instala Ollama, lo expone a la red y descarga modelos | `scripts/spark-setup.sh` | Bash |
| Pruebas | Motor, permisos, almacén, agentes y API por HTTP (`npm test`); recorrido completo (`scripts/e2e.mjs`), carga de tiempo real (`scripts/load-test.mjs`) y llamadas simultáneas al modelo (`scripts/stress-llm.mjs`) | `tests/`, `src/agents/__tests__/`, `scripts/` | Vitest, Node |

### Rutas de la API

| Ruta | Qué hace | Archivo |
| --- | --- | --- |
| `POST /api/rooms` | Crea una sala. Body `{ mode: "single_org" \| "cross_org", seed? }`. Responde `{ roomId }` | `src/app/api/rooms/route.ts` |
| `GET /api/rooms/:id/events?orgId=&roleId=&token=` | SSE. Cada mensaje es un `ProjectedRoomState` ya filtrado. Sin token válido entrega la vista general (`stage`) | `src/app/api/rooms/[roomId]/events/route.ts` |
| `POST /api/rooms/:id/action` | Única puerta para cambiar una sala. Body `{ type, orgId, roleId, token, ...datos }`. Responde `{ ok: true, ... }` o `{ error, code }` con 400, 401, 403, 404 o 409 | `src/app/api/rooms/[roomId]/action/route.ts` |
| `POST /api/rooms/:id/mutate` | Reemplaza la organización de una sala `single_org` por una generada desde una frase. Responde `{ ok, source, latencyMs }` | `src/app/api/rooms/[roomId]/mutate/route.ts` |
| `GET /api/rooms/:id/acta?format=json\|md` | Acta de la decisión con la bitácora completa | `src/app/api/rooms/[roomId]/acta/route.ts` |
| `DELETE /api/rooms/:id` | Reinicia una sala fija a su semilla o borra una sala común. Si el servidor define `NEXO_ADMIN_KEY`, exige esa clave en el encabezado `x-admin-key` | `src/app/api/rooms/[roomId]/route.ts` |
| `GET /api/ping` | 200 si el servidor está vivo. Lo usa Render | `src/app/api/ping/route.ts` |
| `GET /api/health` | Dice si el modelo configurado responde | `src/app/api/health/route.ts` |

### Las 11 acciones

Definidas en `ActionSchema` (`src/lib/store/actions.ts`). El almacén (`applyAction` en `src/lib/store/rooms.ts`) las reparte hacia el motor.

| Acción | Quién puede | Función del motor |
| --- | --- | --- |
| `JOIN_ROLE` | Cualquiera, si el rol está libre. Entrega el token | `markRoleJoined` |
| `LEAVE_ROLE` | El rol, con su token | `markRoleLeft` |
| `UPDATE_AUTHORITY_SLIDER` | Proponente o aprobador, cada uno su propio límite | `updateAuthoritySlider` |
| `TOGGLE_FIELD_SECRET` | El rol dueño del campo | `toggleFieldSecret` |
| `SEAL_RULE` | Proponente o aprobador | `sealRule` |
| `TEST_RBAC_BREACH` | Cualquier rol. Si no tiene permiso: 403 y queda en la bitácora | `attemptProtectedRead` |
| `HITL_DECISION` | Aprobador o Comité de la organización, con razón | `recordGateDecision` |
| `SUBMIT_CANDIDATE` | El rol proponente de la organización dueña del caso | `submitCandidate` |
| `ALLOCATION_SEAL` | Solo el Comité árbitro, con razón | `sealAllocation` |
| `COMMITTEE_VETO` | Comité árbitro (veta al ganador propuesto) o Comité de una organización (veta su compuerta), con razón | `recordCommitteeDecision` |
| `RUN_ROLE_AGENT` | Un rol de una organización. Llama al modelo | `runRoleAgentTurn` y luego `applyAgentProposal` |

### Los siete órganos de interfaz

| # | Órgano | Archivo en `src/components/organs/` | Qué muestra |
| --- | --- | --- | --- |
| 1 | Grafo vivo | `living-graph-organ.tsx` | Roles con su agente, quién está conectado, choque, compuerta y, entre organizaciones, el recurso al centro con el Comité |
| 2 | Caso | `dynamic-case-card-organ.tsx` | Valor propuesto contra el umbral, estado de la compuerta y formulario de decisión |
| 3 | Niebla | `fog-of-war-panel-organ.tsx` | Campos visibles y campos ocultos; botón para pedir un dato oculto y ver el 403 |
| 4 | Choque de autoridad | `allocation-conflict-organ.tsx` | Deslizadores de cada rol, aviso de choque y sello de la regla |
| 5 | Agente del rol | `role-agent-panel-organ.tsx` | Propuesta del agente y telemetría del modelo |
| 6 | Contador | `shared-stakes-counter-organ.tsx` | Tiempo de espera y casos pendientes, con el reloj del servidor |
| 7 | Tablero de asignación | `allocation-board-organ.tsx` | Orden de candidatos, fórmula, desempate, veto o sello del Comité y descarga del acta |

`reliability-meter.tsx` dibuja el medidor p^n dentro de los órganos 1 y 4 y en la pantalla general.

## Modelo de datos

- **Genoma de una organización** (`OrgGenomeSchema`): hasta 3 roles (`role_a`, `role_b`, `role_c`), entre 4 y 8 campos con visibilidad, una regla de autoridad y un caso vivo. Cada campo declara `visibleToOrgIds` y `visibleToRoleIds`.
- **Recurso escaso** (`SharedScarcitySchema`): una regla de asignación con pesos, margen de empate y desempate; de 2 a 4 candidatos, cada uno con su `coverageCost` secreto; y un árbitro (`ArbiterSchema`) con su propio `orgId` (`comite_red` en la semilla).
- **Estado de sala** (`RoomStateSchema`): los genomas, el recurso, jugadores conectados, decisiones humanas, bitácora, telemetría y versión. Contiene todos los secretos y nunca sale del servidor.
- **Vista del cliente** (`ProjectedRoomStateSchema`): lo único que viaja por el SSE. Los campos ocultos llegan como `{ redacted: true, reason: "RBAC_SERVER_FILTERED" }`, sin la propiedad `value`. Trae además los valores derivados que calcula el motor: `conflict`, `gate`, `reliability`, `allocation`, `stakes`.
- **Tokens:** viven en `RoomRecord.tokens`, dentro del almacén y fuera de `RoomState`. Por eso ninguna vista ni el acta pueden contenerlos.

## Flujo de un dato, de punta a punta

Ejemplo: una persona del público escanea el QR del Comité y veta la asignación de la cama. Todas las pantallas cambian.

1. **El QR.** `src/components/nexo/join-codes.tsx` dibuja el código con `roleJoinUrl` (`src/components/nexo/public-url.ts`): `/room/demo-cross?orgId=comite_red&roleId=role_c`.
2. **Entrar.** `src/app/room/[roomId]/room-client.tsx` lee `orgId` y `roleId` del enlace y llama a `join` de `useRoom` (`src/lib/client/use-room.ts`), que envía `POST /api/rooms/demo-cross/action` con `{ type: "JOIN_ROLE", orgId, roleId }`.
3. **Identidad.** `src/app/api/rooms/[roomId]/action/route.ts` llama a `applyAction` (`src/lib/store/rooms.ts`). La función `join` genera un token aleatorio (`randomBytes(24)`), lo guarda y llama a `markRoleJoined` del motor, que agrega el evento `QR_JOINED`. El token vuelve en la respuesta y el navegador lo guarda en `sessionStorage`.
4. **Conexión en vivo.** `useRoom` abre un `EventSource` a `/api/rooms/demo-cross/events?orgId=comite_red&roleId=role_c&token=...`. La ruta (`events/route.ts`) llama a `resolveViewer` (compara el token en tiempo constante) y a `projectRoom`, que usa `projectStateForOrgAndRole` del motor. El Comité recibe la sala sin el costo de ningún hospital.
5. **La decisión.** El Comité escribe su razón en `src/components/organs/decision-form.tsx`, dentro de `allocation-board-organ.tsx`, y presiona vetar. `room-client.tsx` llama a `act("COMMITTEE_VETO", { reason })`.
6. **Validación.** En `applyAction`: `ActionSchema.safeParse` revisa la forma (400 si falla), `isKnownActor` revisa que el rol exista (404) y `tokenMatches` revisa el token (401).
7. **La regla.** `recordCommitteeDecision` (`src/lib/engine/deterministic.ts`) comprueba que quien actúa es el árbitro (403 si no), que hay razón (400 `REASON_REQUIRED`) y que hay una asignación propuesta (409). Agrega la decisión a `decisions`, vuelve a ordenar sin el caso vetado (`resolveRoomAllocation`) y escribe los eventos `HITL_VETOED` y `ALLOCATION_PROPOSED`. `commit` sube la versión.
8. **Aviso.** `settle` guarda el estado nuevo y llama a `emit(roomId)`.
9. **Difusión.** Cada conexión SSE abierta está suscrita (`subscribe`). Su función `send` vuelve a resolver quién mira, proyecta la sala para ese viewer y escribe un mensaje `data:`. Cada conexión recibe su propia versión filtrada.
10. **Las otras pantallas.** En cada navegador, `useRoom` recibe el mensaje y React vuelve a dibujar: el tablero muestra al nuevo ganador y la razón del veto, y `src/components/nexo/audit-console.tsx` muestra el evento.
11. **El acta.** `GET /api/rooms/demo-cross/acta?format=md` llama a `getActa`, que usa `buildAuditActa` y `renderActaMarkdown` del motor.

## Agentes

Hay dos agentes. Cada uno vive en su archivo, con su instrucción y su formato de salida a la vista. Ninguno actúa por su cuenta: responden cuando una persona lo pide, y lo que cambia en la sala lo decide el motor.

| Agente | Archivo | Entrada | Salida | Modelo | Qué decide el código y no el modelo |
| --- | --- | --- | --- | --- | --- |
| Agente de rol | `src/agents/role-agent.ts` (`runRoleAgentTurn`) | La vista ya filtrada de un rol (`ProjectedRoomState`) y un pedido opcional de la persona | `{ proposalText, suggestedValue, attemptedFieldRead, latencyMs, source }` | El configurado en `LLM_MODEL`, vía `chatJson`. Tope de 140 tokens, razonamiento reducido, plazo de 12 s | Qué datos entran al prompt (solo los que el rol ve). Largo máximo de 80 palabras. `suggestedValue` acotado al rango de la regla. `attemptedFieldRead` solo vale si es un campo oculto de la vista. Los valores reservados se tachan del texto (`redactReserved`). Si el modelo falla, propuesta fija marcada "Respaldo sin modelo" |
| Agente de mutación | `src/agents/mutate-genome.ts` (`mutateGenomeFromPrompt`) | Una frase de hasta 400 caracteres, limpiada con `sanitizeDescription` | `{ genome, source: "llm" \| "fallback_seed", latencyMs }` | El mismo, vía `chatJson`. Tope de 900 tokens, plazo de 25 s | Toda la estructura (`normalizeGenome`): ids de rol, quién propone y quién aprueba, colores, clasificación de cada campo, rangos. `OrgGenomeSchema` decide si el resultado se usa. `findLeakedSecret` rechaza textos públicos que citen un valor reservado y `findMarkup` rechaza HTML o código. Si falla dos veces, se usa la semilla más parecida (`pickClosestSeed`) |

Detalles que importan:

- **El agente hereda los permisos del rol.** `runAgent` (`src/lib/store/rooms.ts`) le pasa a `runRoleAgentTurn` el resultado de `projectRoom(roomId, actor)`: lo mismo que recibe el navegador de esa persona. Un valor oculto nunca llega al prompt porque nunca salió del motor.
- **El agente propone; no decide.** `applyAgentProposal` del motor solo hace dos cosas: si quien pidió es el proponente, el valor sugerido pasa a ser el valor propuesto del caso (y la compuerta se reevalúa); y si el agente declaró un campo que no puede ver, queda un 403 en la bitácora. No existe camino para que una propuesta firme una compuerta o selle una asignación.
- **El texto de la propuesta no entra a la bitácora.** Vuelve solo en la respuesta HTTP a quien la pidió.
- **El Comité árbitro no tiene agente.** `runAgent` responde 409.
- **No hay orquestación entre agentes.** Los agentes no se llaman entre sí ni corren en bucle.

## Modelos

| Uso | Modelo | Dónde corre | Estado |
| --- | --- | --- | --- |
| Deploy público | `claude-opus-5-5` (`render.yaml`) | API de Anthropic, en la nube | En uso. `GET /api/health` del deploy responde "Claude disponible". Una mutación de genoma tarda unos 10 segundos (medido con `scripts/stress-llm.mjs`, ver abajo) |
| Local | El de `LLM_MODEL`, servido por Ollama con el protocolo compatible con OpenAI. `scripts/spark-setup.sh` descarga `gpt-oss:20b` y `qwen3:32b` | NVIDIA DGX Spark de 128 GB o un notebook | Implementado y probado contra un servidor simulado. **Sin verificar contra el Spark:** falta confirmar endpoint, id del modelo y cómo se apaga el razonamiento. **Latencia sin medir** |

`LLM_PROVIDER` elige el camino (`llmConfig` en `src/lib/llm.ts`): `anthropic` usa el SDK oficial; cualquier otro valor usa `fetch` contra `LLM_BASE_URL`. Qué agrega la capa:

- **Cola** (`acquireSlot`): por defecto 1 llamada a la vez en local y 2 en Claude. `LLM_MAX_CONCURRENT` lo cambia.
- **JSON validado** (`chatJson`): extrae el objeto, lo valida y, si falla, reintenta una vez mostrándole el error al modelo.
- **Llamadas rápidas** (`thinking: false`): en Claude baja `effort` a `low`. En local mezcla en la petición lo que diga `LLM_NO_THINK_BODY`; el nombre del parámetro depende del servidor y no está verificado.
- **Respaldo de Claude:** el parámetro `fallbacks` hace que la API reintente en otro modelo si el primero declina.
- **Telemetría veraz** (`getTelemetry`): `provider` es `local` solo si el host es de la máquina o de una red privada (`isLocalHost`). `bytesSentToCloud` cuenta el cuerpo de cada petición enviada a un host de nube; queda en 0 únicamente cuando todo se habló con un host local. Viaja en cada mensaje SSE y la muestran el órgano 5 y la pantalla general.

En el deploy público los datos del caso que el rol puede ver sí salen hacia Anthropic. "Ningún dato sale de la red" vale solo en modo local.

## Integraciones externas

| Servicio | Para qué | Estado |
| --- | --- | --- |
| API de Anthropic | Modelo de lenguaje del deploy público | Real, en uso |
| Ollama (protocolo compatible con OpenAI) | Modelo de lenguaje local | Implementado. Probado con un servidor simulado en `src/agents/__tests__/agents.test.ts`. Sin verificar contra el Spark |
| Render | Hosting del servidor público | Real, plan gratis |

No hay base de datos, autenticación externa ni otros servicios. Los códigos QR se generan en el navegador con la librería `qrcode`; no pasan por ningún servicio. Nexo no se conecta a ningún sistema hospitalario.

## Colaboración en tiempo real

**Transporte.** Cada navegador abre una conexión de eventos (SSE) a `/api/rooms/:id/events`. Las acciones van por `POST` normales. El servidor envía la sala completa en cada mensaje, no diferencias.

**Una vista por viewer.** En cada envío, `send` (`events/route.ts`) vuelve a resolver quién mira con `resolveViewer` y proyecta con `projectStateForOrgAndRole`. El dato oculto no se esconde en el navegador: no se envía. Si el token deja de ser válido (el rol se liberó o la sala se reinició), la misma conexión pasa a recibir la vista general sin reconectar.

**Permiso doble.** `canViewField` exige que la organización del viewer esté en `visibleToOrgIds` y que su rol esté en `visibleToRoleIds`. El costo de cobertura de un candidato usa `canViewCoverageCost`: solo lo recibe su organización y, dentro de ella, solo los roles que pueden ver el campo `coverage_cost`. La pantalla general no tiene identidad (la recibe cualquiera que conozca la sala, y de ella sale el acta), así que solo recibe campos clasificados `public` que además ven todas las organizaciones y todos los roles. Un campo `restricted` que ven los tres roles de la clínica sigue siendo interno.

**Pulso.** Mientras el contador corre (`isStakesRunning`), cada conexión recibe un mensaje por segundo con el reloj del servidor. Con la decisión sellada, uno cada 15 segundos para mantener viva la conexión.

**Presencia.** Un rol aparece conectado si su conexión dio señal de vida hace menos de 45 segundos (`PRESENCE_TTL_MS`). Pasado ese tiempo sin conexión, otra persona puede tomar el rol y el token anterior deja de servir.

**Dos personas a la vez.** Node ejecuta el código de a una acción por vez, y cada función del motor es síncrona: recibe un estado y devuelve otro. No hay dos escrituras simultáneas. Cada cambio sube `version`. Las únicas acciones que esperan (`RUN_ROLE_AGENT` y la mutación) llaman al modelo y aplican su resultado sobre el estado que exista al volver; si el rol cambió de manos o la sala se reinició mientras tanto, se descarta. Hay una sola llamada al modelo a la vez por rol y una sola mutación a la vez por sala; repetir el botón responde 409 `BUSY`.

**Decisiones definitivas.** Una compuerta decidida o una asignación sellada no se pueden cambiar: el motor responde 409 `DECISION_SEALED`.

**Topes de memoria** (`src/lib/store/rooms.ts`), para que un deploy público no se llene:

| Tope | Valor | Al llegar |
| --- | --- | --- |
| Salas creadas por `POST /api/rooms` | 200 (`NEXO_MAX_ROOMS`) | Sale la sala sin conexiones con más tiempo inactiva; si todas tienen gente, 503 `ROOM_LIMIT` |
| Sala común sin conexiones ni actividad | 2 horas | Se borra |
| Sala fija usada y sin conexiones ni actividad | 15 minutos | Vuelve a su semilla, para que el siguiente visitante no encuentre un caso ya decidido |
| Conexiones SSE | 200 por sala, 1000 en total | 503 `TOO_MANY_CONNECTIONS` |
| Body de una petición | 8000 caracteres (`src/lib/store/http.ts`) | 400 |
| Razón de una decisión | 500 caracteres (`REASON_MAX_LENGTH`) | 400 |
| Bitácora | 2000 eventos; los intentos sin token (`AUTH_FAILED`) tienen cupo propio de 300 | Se descartan primero los eventos de rutina más antiguos. Las decisiones y su rastro nunca se descartan, y el acta declara cuántos eventos se perdieron (`auditLogDropped`) |

**Reconexión.** Si la conexión cae, `useRoom` la reabre con espera creciente (de 1 a 10 segundos). Si el servidor se reinició, intenta recuperar el rol una vez.

**Probado.**

| Qué | Cómo | Resultado |
| --- | --- | --- |
| Recorrido completo con participantes independientes, cada uno con su SSE | `node scripts/e2e.mjs <url>` | 97 de 97 pasos contra el deploy público (21 de noviembre) y contra las rutas locales |
| Carga | `node scripts/load-test.mjs`, 10 cambios | 500 conexiones SSE simultáneas: todos los cambios llegaron a todas, p95 de 52 ms. Medido en un notebook contra las rutas sin Next. **No se midió contra el deploy** |
| Detector de fugas | `tests/http.test.ts` levanta un servidor que cuela un costo en el SSE | El recorrido falla, como debe |
| Llamadas al modelo a la vez | `node scripts/stress-llm.mjs <url>`: lanza a la vez 1 mutación de genoma y 3 turnos de agente (uno por rol), y lee la cola desde la telemetría del SSE | Contra el deploy (Claude en la nube), el 21 de noviembre: la mutación tardó unos 10 segundos. Los tres turnos de agente declararon un campo oculto que necesitaban (`attemptedFieldRead`) y los tres quedaron como `RBAC_DENIED` en la bitácora. Es el comportamiento esperado: la instrucción del agente le pide nombrar un dato que no puede ver, y el servidor registra el intento sin entregar el valor. La latencia de los turnos de agente no quedó registrada en este documento |

## Qué es real y qué es simulado

Esta tabla es la respuesta honesta a "¿esto funciona de verdad?".

| Parte | Real | Simulado o sin verificar |
| --- | --- | --- |
| Permisos por organización y rol | Real. El filtro ocurre en el servidor y se comprueba buscando los valores en el tráfico (`tests/engine.test.ts`, `scripts/e2e.mjs`) | |
| Tiempo real entre varios dispositivos | Real. SSE, probado con participantes independientes | |
| Identidad | Real pero mínima: un token aleatorio por rol | No hay cuentas ni contraseñas. Quien toma un rol libre es ese rol |
| Choque, compuerta, asignación, desempate, contador | Real. Código determinista con pruebas | |
| Confiabilidad p^n | El cálculo es real | **Es un modelo ilustrativo, no una medición.** Los valores de `reliabilityP` (0,90 a 0,95) vienen de la semilla, no de un benchmark |
| Acta | Real. JSON y Markdown, con la bitácora completa | |
| Entrada por QR desde un teléfono | Real | |
| Agente de rol y mutación por frase | Reales en el deploy, con Claude | Si el modelo falla se usa una respuesta fija, marcada como respaldo (`source: "fallback"` o `"fallback_seed"`) |
| Latencia del modelo | Con Claude en el deploy, una mutación de genoma tarda unos 10 segundos (medido con `scripts/stress-llm.mjs`) | Es la medición de una corrida, no un promedio. Los turnos de agente no tienen cifra registrada |
| Modelo local en el Spark | El código existe | **Sin verificar contra el Spark y sin medir latencia** |
| "Ningún dato sale a la nube" | Cierto solo en modo local | **El deploy público usa Claude:** los datos sí salen, y la telemetría lo muestra |
| Datos del caso | | **Simulados.** Pacientes, costos, puntajes de gravedad y plazos vienen de `src/lib/genome/seeds.ts`. No son datos de pacientes ni estadísticas |
| Organizaciones | | **Ficticias.** No hay integración con ningún hospital ni sistema clínico |
| Validación con usuarios | | **No se validó** el flujo con personas del área de salud |

## Límites conocidos

- **Estado en memoria de un solo proceso.** Se pierde si el servidor se reinicia y no se reparte entre varios servidores. Las salas `demo` y `demo-cross` se recrean solas, vacías.
- **Render en plan gratis.** El servicio se duerme sin visitas y, al dormirse, pierde las salas.
- **Sin cuentas.** La identidad es un token por rol. Un rol sin conexión por 45 segundos queda libre para otra persona.
- **Protección mínima.** `DELETE /api/rooms/:id` solo pide clave si el servidor define `NEXO_ADMIN_KEY`; `render.yaml` no la define. Cualquiera puede crear salas, pedir turnos del agente y mutar salas comunes: hay topes (una llamada a la vez por rol y por sala, 200 salas), pero no un límite de uso por persona.
- **El acta es pública** para quien conozca el id de la sala. No contiene valores reservados (comprobado en las pruebas).
- **Bitácora con tope.** Guarda hasta 2000 eventos (las decisiones nunca se descartan); por SSE viajan los últimos 80.
- **Cada mensaje lleva la sala completa.** Con el contador corriendo, el servidor proyecta la sala una vez por segundo por cada conexión. Funcionó con 500 conexiones en la prueba local; no se midió en el deploy.
- **La capa entre organizaciones usa siempre las dos semillas.** La mutación por frase solo existe en `single_org`. Una organización tiene como máximo 3 roles.
- **El tachado de valores reservados no detecta paráfrasis.** `redactReserved` atrapa "2400000" y "2.400.000", no "2,4 millones". Solo afecta a valores que el propio rol ya ve.
- **Inyección de instrucciones.** La frase de la mutación y el pedido al agente se limpian (`sanitizeDescription`, `plain`: una línea, sin `<` ni `>`) y van dentro de etiquetas marcadas como datos; el genoma se rechaza si trae HTML o código (`findMarkup`). Reduce el riesgo, no lo elimina. Aun así, el modelo no decide nada: lo peor que puede hacer es redactar una propuesta mala o un genoma que el esquema rechaza.
- **El desempate `geographic` es una aproximación:** el esquema no tiene datos geográficos y usa la necesidad sin cubrir.

Con una semana más: persistir las salas en una base de datos, cuentas reales por persona, repartir los eventos entre varios servidores, medir el modelo local en el Spark y validar el flujo con personas que asignan camas de verdad.

## Pruebas

`npm test` corre 218 pruebas en unos 30 segundos, sin llamar a ningún modelo.

| Archivo | Qué garantiza |
| --- | --- |
| `tests/genome.test.ts` | Las semillas pasan sus esquemas; ids sin tilde; roles referenciados existen; el costo de cada candidato es visible solo para su organización; los textos públicos no citan valores secretos |
| `tests/engine.test.ts` | La vista de `hospital_rural` nunca contiene valores de `clinica_andes` (se serializa a JSON y se buscan). 403 dentro de una organización y entre organizaciones. Choque que aparece y desaparece. Compuerta determinista. Asignación reproducible con desempate. p^n. Contador. Acta completa y sin secretos |
| `tests/store.test.ts` | Token por rol, 409 si el rol está ocupado, 401 en las diez acciones que exigen token, salas fijas, y que el agente recibe solo la vista filtrada |
| `src/agents/__tests__/agents.test.ts` | Telemetría local o nube, cola y topes de tokens; la mutación nunca lanza y siempre entrega un genoma válido; el agente de rol solo le muestra al modelo lo que su rol ve |
| `tests/http.test.ts` | Sirve las rutas reales por HTTP sin Next (`tests/helpers/route-server.ts`) y corre contra ellas `scripts/e2e.mjs` y `scripts/load-test.mjs` |


## Cómo correrlo

Requiere Node 20.

```bash
npm install
cp .env.example .env.local   # elegir modelo local (Ollama) o Claude
npm run dev                  # http://localhost:3000
```

Variables del modelo (`.env.example` trae las tres opciones):

| Variable | Para qué |
| --- | --- |
| `LLM_PROVIDER` | `anthropic` para Claude; cualquier otro valor para un servidor compatible con OpenAI |
| `LLM_MODEL` | Id del modelo |
| `LLM_BASE_URL`, `LLM_API_KEY` | Solo en local: dónde está Ollama |
| `ANTHROPIC_API_KEY`, `LLM_EFFORT` | Solo con Claude |
| `LLM_MAX_CONCURRENT`, `LLM_NO_THINK_BODY`, `LLM_REASONING_HEADROOM` | Opcionales: cola y control de razonamiento |
| `NEXT_PUBLIC_BASE_URL` | Opcional: dirección pública para los códigos QR cuando la pantalla se abre desde `localhost` |
| `NEXO_MAX_ROOMS`, `NEXO_ADMIN_KEY` | Opcionales: tope de salas y clave para `DELETE /api/rooms/:id` |

Sin modelo configurado la sala funciona igual: las reglas no dependen de él, y el agente y la mutación responden con su respaldo.

Comprobaciones:

```bash
npm test                                         # 218 pruebas, sin modelo
npm run lint
node scripts/e2e.mjs http://localhost:3000       # recorrido completo por HTTP
node scripts/e2e.mjs http://localhost:3000 --llm # incluye agente y mutación con modelo
node scripts/load-test.mjs http://localhost:3000 200   # solo contra un servidor local
node scripts/stress-llm.mjs http://localhost:3000      # 4 llamadas al modelo a la vez: latencia, respaldo y cola (cuesta llamadas)
```

Para la demo: abrir `/stage/demo-cross` en la pantalla grande y escanear los códigos QR desde los teléfonos, o abrir `/room/demo-cross` en otras pestañas.
