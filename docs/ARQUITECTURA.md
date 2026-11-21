# Arquitectura

Documento vivo. Se actualiza en el mismo commit que cambia la arquitectura. Si este documento y el código no coinciden, el código manda y esto es un error que hay que corregir.

**Estado (21 de noviembre de 2026):** el producto funciona de punta a punta y está desplegado en https://team-30-platanus-hack.onrender.com. Todo lo que este documento describe existe en el código; lo que no está verificado o es simulado se marca como tal.

## Resumen

Sculptor es una sala compartida donde varias organizaciones deciden juntas sobre un recurso escaso sin mostrarse sus datos. Cada persona entra con un rol, ve solo lo que su rol y su organización pueden ver, y toma la decisión en tiempo real con las demás. Cada rol tiene un agente de IA emparejado que propone, pero no decide.

- **Quiénes participan a la vez:** los roles de una organización (proponente, aprobador y Comité) y, en la capa entre organizaciones, los roles de dos organizaciones más un Comité árbitro que no pertenece a ninguna.
- **Qué hace el sistema con sus aportes:** el servidor guarda un solo estado por sala y le envía a cada conexión una versión distinta, filtrada por organización y por rol. Las reglas (permisos, choque de autoridad, compuerta, asignación del recurso, contador) son código determinista, sin modelo.
- **Qué entrega:** una decisión tomada por personas, con su razón escrita, y un acta con la bitácora completa.

El ejemplo principal es de salud y usa datos simulados. En `single_org`, una clínica con 3 roles decide sobre una cama UCI. En `cross_org`, 2 hospitales compiten por 1 cama de referencia sin ver el costo del otro, y un Comité que entra por código QR aprueba o veta con una razón.

El mismo esqueleto sirve para otros rubros sin cambiar código ni depender del modelo: hay tres escenarios entre organizaciones en las semillas (catálogo en `src/lib/genome/scenarios.ts`):

| Escenario | Organizaciones | Recurso escaso | Sala fija |
| --- | --- | --- | --- |
| `hospitales` (por defecto) | Clínica Andes y Hospital Rural Valle Sur | Cama UCI de referencia | `demo-cross` |
| `construccion` | Constructora Cordillera y Constructora Litoral Sur | Grúa torre compartida | `demo-construccion` |
| `logistica` | Distribuidora Centro Alimentos y Distribuidora Costa Farma | Camión refrigerado compartido | `demo-logistica` |

Además, una sala de una organización se puede crear desde una frase ("dos áreas de una empresa que se reparten un presupuesto"): el modelo escribe el genoma y, si falla, se usa la semilla más parecida.

## El problema y por qué es multijugador

Esta sección describe el problema que el equipo quiere atacar. Es una hipótesis: no se validó con usuarios reales (ver "Qué es real y qué es simulado").

- **A quién ayuda.** A las personas que deciden juntas sobre un recurso escaso y caro (una cama UCI, una grúa, un camión, un presupuesto) cuando cada una tiene datos que no puede mostrarle a la otra. En el ejemplo principal: Dentro de una clínica, Urgencias conoce la gravedad y Administración el costo. Entre organizaciones, cada hospital conoce el costo de su paciente y no el del otro. Hoy eso se coordina por teléfono, chat y planillas, y después nadie puede explicar por qué se decidió así.
- **Por qué no puede decidir una sola organización.** Por dos razones. Información: cada parte tiene un dato que la otra no puede ver (el costo de cobertura), así que quien decide solo decide con la mitad de los datos o exige ver lo que no le corresponde. Neutralidad: quien arbitra entre dos hospitales no puede ser uno de ellos. Por eso el Comité árbitro tiene su propio `orgId` (`comite_red`) y no ve el costo de nadie (`canViewCoverageCost`).
- **Qué hace que no hacen una planilla compartida ni un flujo automatizado.** Una planilla les muestra a todos lo mismo; un flujo fijo ejecuta pasos sin que nadie decida. Sculptor hace tres cosas a la vez: cada participante recibe una versión distinta de los mismos datos, filtrada en el servidor (`projectStateForOrgAndRole`); el recurso se ordena con una regla visible y reproducible (`resolveAllocation`); y la decisión la toma una persona que deja su razón escrita en un acta (`recordCommitteeDecision`, `buildAuditActa`). Todo en vivo, entre varias personas a la vez.
- **Qué muestra la demo en tres minutos.** Dos hospitales presentan a su paciente sin ver el costo del otro, el tablero ordena con la fórmula a la vista, y una persona del público entra como Comité escaneando un QR y aprueba o veta con una razón. Todas las pantallas cambian a la vez.

## Dónde está la parte difícil

En que una sola sala se vea distinta para cada participante, a la vez y en vivo, sin que nada reservado salga del servidor. `projectStateForOrgAndRole` (`src/lib/engine/deterministic.ts`) arma una versión por viewer con permiso doble (organización y rol); el costo de un candidato además sigue el permiso del campo `coverage_cost` (`canViewCoverageCost`), para que no se cuele por la lista de candidatos; y la pantalla general, que no tiene identidad, solo recibe campos `public`. Encima de eso, `resolveAllocation` tiene que dar el mismo orden siempre, con desempate de equidad, y las llamadas al modelo no pueden pisar cambios que ocurrieron mientras respondía (`runAgent` en `src/lib/store/rooms.ts` compara el token del rol al empezar y al volver). Las pruebas que más esfuerzo concentran son las de la proyección (`tests/engine.test.ts`).

## Dónde mirar

| Si la pregunta es sobre... | Archivo |
| --- | --- |
| Qué datos existen y qué recibe un cliente | `src/lib/genome/schema.ts` |
| Los datos del caso de la demo | `src/lib/genome/seeds.ts` |
| Permisos, compuerta, asignación, p^n, contador, acta | `src/lib/engine/deterministic.ts` |
| Qué acciones existen y su forma | `src/lib/store/actions.ts` |
| Identidad (token por rol), claves de anfitrión y del Comité, salas y aviso de cambios | `src/lib/store/rooms.ts` |
| Los escenarios de otros rubros | `src/lib/genome/scenarios.ts` (catálogo), `src/lib/genome/seeds.ts` (datos) |
| El ensayo automático | `src/lib/engine/autopilot.ts` (guion), `startAutopilot` en `src/lib/store/rooms.ts` |
| Límite de peticiones y controles de anfitrión | `src/lib/store/rate-limit.ts`, `src/lib/store/host.ts` |
| Supabase (formulario de acceso y entrevistas) | `src/lib/supabase/`, `supabase/migrations/` |
| El Comité por WhatsApp o por voz | `src/integrations/` |
| Tiempo real (SSE) | `src/app/api/rooms/[roomId]/events/route.ts` |
| Llamadas a modelos, cola y telemetría | `src/lib/llm.ts` |
| Qué le llega al modelo y qué se hace con su respuesta | `src/agents/role-agent.ts`, `src/agents/mutate-genome.ts` |
| Qué está comprobado | `tests/`, `scripts/e2e.mjs`, `scripts/load-test.mjs`, `scripts/stress-llm.mjs` |
| Las cifras medidas, con cómo y dónde | `docs/MEDICIONES.md` |
| Qué leer primero, en orden | `docs/RECORRIDO.md` |

## Componentes

| Componente | Qué hace | Dónde vive | Tecnología |
| --- | --- | --- | --- |
| Contrato de datos | Esquemas de todo lo que entra y sale: genoma, recurso escaso, estado de sala (`RoomState`, con secretos) y vista del cliente (`ProjectedRoomState`, sin ellos) | `src/lib/genome/schema.ts` | Zod |
| Semillas | Siete organizaciones (`clinica_andes`, `hospital_rural`, `dist_tech`, `constructora_norte`, `constructora_sur`, `distribuidora_centro`, `distribuidora_costa`) y un recurso escaso por escenario, validados al cargar el módulo | `src/lib/genome/seeds.ts` | TypeScript |
| Catálogo de escenarios | Los tres escenarios entre organizaciones con su título y su sala fija. Sin dependencias, lo importa también la interfaz | `src/lib/genome/scenarios.ts` | TypeScript |
| Motor determinista | Todas las reglas. Funciones puras: reciben el estado y el reloj, devuelven un estado nuevo o un rechazo | `src/lib/engine/deterministic.ts` | TypeScript, sin dependencias |
| Guion del ensayo automático | El guion de la demo como datos: cada paso llama a la misma función del motor que usaría una persona. Sin modelo | `src/lib/engine/autopilot.ts` | TypeScript |
| Contrato de acciones | Forma de las 11 acciones (`ActionSchema`) y códigos de error | `src/lib/store/actions.ts` | Zod |
| Almacén de salas | Estado en memoria, token por rol, token de anfitrión y clave del Comité por sala, cuatro salas fijas, sorteo de silla (`joinRandomSeat`), sala de demo (bots administrativos al entrar la primera persona, reinicio solo 2 min después del acta: `startDemoBots`, `scheduleDemoReset`), reinicio, revocación, ensayo automático, aviso de cambios y topes de memoria. No decide reglas: valida, comprueba identidad y delega en el motor | `src/lib/store/rooms.ts`, `src/lib/store/http.ts` (lectura acotada del body) | `Map` y `EventEmitter` de Node |
| Límite de peticiones | Ventana fija por cliente y tipo de petición, más un tope global para lo que llama al modelo. Lee la IP reenviada solo con `TRUST_PROXY=1` | `src/lib/store/rate-limit.ts` | En memoria |
| Controles de anfitrión | Exige el token de anfitrión (`x-host-token`) o la clave de administración (`x-admin-key`) | `src/lib/store/host.ts` | |
| Rutas de la API | Entrada HTTP. Cada ruta aplica su límite de peticiones y llama al almacén | `src/app/api/` | Route Handlers de Next.js |
| Supabase | Guarda las solicitudes de acceso y lee la entrevista publicada. Solo servidor (`import "server-only"`), clave `service_role`. Si falta la configuración o la tabla, degrada sin romper | `src/lib/supabase/` | API REST de Supabase con `fetch` |
| Canales del Comité | WhatsApp (Kapso) y voz (ElevenLabs): el Comité árbitro decide fuera de la web con las mismas acciones | `src/integrations/` | SDK de Kapso; API de ElevenLabs con `fetch` en el servidor y SDK `@elevenlabs/client` en el navegador (conversación de voz del Comité) |
| Capa de modelos | Única puerta a un modelo de lenguaje: dos proveedores, cola, tope de tokens, JSON validado y telemetría | `src/lib/llm.ts` | SDK de Anthropic; `fetch` para el protocolo compatible con OpenAI |
| Agentes | Agente de rol y agente de mutación. Cada uno en su archivo, con su instrucción y su formato de salida | `src/agents/` | Llaman a `chatJson` de la capa de modelos |
| Cliente de sala | Único lugar de la interfaz que habla con `/api/rooms`: abre el SSE, guarda la identidad y envía acciones | `src/lib/client/use-room.ts` | React, `EventSource`, `sessionStorage` |
| Pantallas | Portada (`/`, con los ejemplos de otros rubros, formulario de acceso y entrevista), casos de uso (`/casos/hospitales`, `/casos/construccion` y `/casos/logistica`, con los componentes de `src/components/casos/` y las cifras y nombres del motor), silla de un rol en el celular (`/room/[roomId]`), pantalla general para proyectar (`/stage/[roomId]`) y `/centro`, la demo del panel de vidrio de 21st.dev con sus datos de ejemplo en inglés, sin conexión a las salas: sirve solo como referencia visual | `src/app/`, `src/components/landing/` | Next.js 16 (App Router), React 19, Tailwind 4 |
| Pregúntale al caso | En la pantalla grande, respuestas a preguntas frecuentes sobre la sala (por qué ganó, qué es el desempate, qué no se ve) armadas con el estado proyectado y búsqueda por palabras clave. No llama a ningún modelo | `src/components/stage/ask.ts` | TypeScript |
| Silla del celular | Lo que ve cada rol en su teléfono: al entrar, la tarjeta «Te tocó» (rol, organización, misión y dos chips: qué ve y cuántos datos no); después una tarjeta por turno con un solo botón en la zona del pulgar y tres pestañas (Tu turno, Secretos, Sala). El Comité ve un duelo de dos tarjetas y chips de razón que rellenan un texto editable. Los datos reservados se dibujan como franjas diagonales y el pulso de arriba late en rojo mientras se espera y queda verde y plano al sellar. Qué turno toca lo calcula `seatTurn` (`src/components/nexo/guide.ts`) desde el estado proyectado; las acciones y los permisos son los de siempre  En las salas de demo, los 3 asientos humanos usan otra vista, sin tarjeta de entrada ni pestañas (`demo-view.tsx`; ver «Demo pauteada»). | `src/app/room/[roomId]/room-client.tsx`, `src/components/seat/` | React, CSS propio con la paleta oficial |
| Pantalla grande | Centro de mando que se proyecta. En el paso «Unirse» muestra la galaxia (un canvas 2D sin dependencias: un nodo y una órbita por asiento conectado, contador «N/M conectados» y el código para entrar); después, la «Historia de la decisión» con la galaxia de fondo, que se vuelve verde al sellar. Los asientos salen del estado que llega por el SSE (`stageSeats`), nunca de un simulador. En una sala de demo (`demo` en el estado) muestra 3 asientos de personas, nombrados por su rol y su color («Clínica», «Hospital Rural», «Comité»), y los que juega el piloto automático (`bot`) con un chip «automático»; 4 pasos sin «Límites»; una franja con el turno de cada persona (`turn`, con la cuenta regresiva del plan B si el servidor la manda); el código para entrar mientras quede una silla libre, y «Nueva ronda» al cerrar el acta. No calcula ni oculta nada | `src/components/stage/` (`command-center.tsx`, `galaxy.tsx`, `seats.ts`, `join-view.tsx`, `story.ts`, `story-view.tsx`, `ecg.tsx`) | React, canvas 2D |
| Órganos | Piezas de interfaz que quedan de la primera versión: el grafo vivo, el choque de autoridad, el medidor p^n y la telemetría del modelo. En el celular van plegadas en la pestaña «Sala». No calculan ni ocultan nada | `src/components/organs/` | React |
| Piezas de sala | Guía de turnos (`guide.ts`), códigos QR, avisos de eventos, aviso al Comité, asistente de voz del Comité y aviso de datos simulados | `src/components/nexo/` | React, `qrcode` |
| Deploy | Un servicio Node siempre encendido | `render.yaml` | Render |
| Preparación del Spark | Instala Ollama, lo expone a la red y descarga modelos | `scripts/spark-setup.sh` | Bash |
| Pruebas | Motor, permisos, almacén, seguridad, ensayo, canales del Comité, agentes y API por HTTP (`npm test`); recorrido completo (`scripts/e2e.mjs`), carga de tiempo real (`scripts/load-test.mjs`) y llamadas simultáneas al modelo (`scripts/stress-llm.mjs`) | `tests/`, `src/agents/__tests__/`, `scripts/` | Vitest, Node |
| Migraciones | Tablas `access_requests` y `clinic_interviews`, con RLS activado y sin políticas: solo las lee y escribe el servidor | `supabase/migrations/` | SQL de Postgres |

### Rutas de la API

Todas las rutas de salas tienen límite de peticiones por cliente (ver "Topes" más abajo); al pasarlo responden 429 `RATE_LIMITED` con `Retry-After`.

| Ruta | Qué hace | Archivo |
| --- | --- | --- |
| `POST /api/rooms` | Crea una sala. Body `{ mode: "single_org", seed? }`, `{ mode: "single_org", description }` (sala nueva ya mutada desde una frase; el modelo tiene 15 s y si no, semilla más parecida) o `{ mode: "cross_org", scenario? }` (`hospitales`, `construccion`, `logistica`); con `demo: true`, sala de demo (ver «Sala de demo» más abajo), y `turnMs` fija su plan B (0 lo apaga). Responde `{ roomId, hostToken, committeeKey, mode, scenario?, source?, latencyMs?, orgName? }`. Las dos claves se entregan solo aquí | `src/app/api/rooms/route.ts` |
| `GET /api/rooms/:id/events?orgId=&roleId=&token=` | SSE. Cada mensaje es un `ProjectedRoomState` ya filtrado, con el estado del ensayo automático. Sin token válido entrega la vista general (`stage`) | `src/app/api/rooms/[roomId]/events/route.ts` |
| `POST /api/rooms/:id/seat` | Sorteo de silla, para entrar con un solo código QR sin elegir rol. Body `{ committeeKey?, current?: { orgId, roleId, token } }`. Asigna una silla libre (al azar en las salas normales; por orden de llegada en las de demo: Clínica, Hospital Rural, Comité) y responde `{ ok, seat: { orgId, roleId }, token }`. El Comité solo entra al sorteo con la clave de su QR; con `current` y su token vigente es «sortear otro rol» (toca otra y libera la anterior). Sin sillas libres: 409 `NO_FREE_SEAT`. El enlace del QR único es `/room/<id>` (con `?key=<committeeKey>` si el Comité también se sortea) | `src/app/api/rooms/[roomId]/seat/route.ts` |
| `POST /api/rooms/:id/action` | Única puerta para que una persona cambie una sala. Body `{ type, orgId, roleId, token, ...datos }`. `JOIN_ROLE` al puesto del Comité exige además `committeeKey`. Responde `{ ok: true, ... }` o `{ error, code }` con 400, 401, 403, 404, 409 o 429 | `src/app/api/rooms/[roomId]/action/route.ts` |
| `DELETE /api/rooms/:id` | **Anfitrión** (salvo «Nueva ronda» en una sala de demo con el acta cerrada, que no pide token: `canResetWithoutHost`). Reinicia la sala: vuelve al caso inicial, detiene el ensayo y revoca los tokens de los puestos. Conserva id, token de anfitrión y clave del Comité | `src/app/api/rooms/[roomId]/route.ts` |
| `POST /api/rooms/:id/autopilot` | **Anfitrión.** Body `{ action?: "start" \| "stop", stepMs?, withCommittee? }`. Ensayo sin gente: bots en los puestos libres recorren el guion paso a paso | `src/app/api/rooms/[roomId]/autopilot/route.ts` |
| `POST /api/rooms/:id/revoke` | **Anfitrión.** Body `{ orgId, roleId }`. Libera un puesto y revoca su token | `src/app/api/rooms/[roomId]/revoke/route.ts` |
| `POST /api/rooms/:id/mutate` | **Anfitrión.** Reemplaza la organización de una sala `single_org` sin nadie adentro por una generada desde una frase. Responde `{ ok, source, latencyMs }` | `src/app/api/rooms/[roomId]/mutate/route.ts` |
| `POST /api/rooms/:id/host` | Entrega `{ hostToken, committeeKey }` de una sala **fija**. Con `NEXO_ADMIN_KEY` exige `x-admin-key`; sin ella, solo fuera de producción. Una sala creada con `POST /api/rooms` responde 403 | `src/app/api/rooms/[roomId]/host/route.ts` |
| `GET /api/rooms/:id/acta?format=json\|md` | Acta de la decisión con la bitácora completa | `src/app/api/rooms/[roomId]/acta/route.ts` |
| `POST /api/rooms/:id/committee` | **Anfitrión.** Body `{ channels?: ("whatsapp" \| "call")[] }`. Avisa al Comité árbitro por WhatsApp y/o lo llama el asistente de voz | `src/app/api/rooms/[roomId]/committee/route.ts` |
| `POST /api/rooms/:id/committee/voice` | Body `{ committeeKey }`. Conversación de voz con el asistente del Comité desde el navegador; exige la clave del Comité | `src/app/api/rooms/[roomId]/committee/voice/route.ts` |
| `POST /api/integrations/kapso/webhook` | Respuestas del Comité por WhatsApp. Verifica la firma HMAC (`X-Webhook-Signature`) antes de leer el cuerpo | `src/app/api/integrations/kapso/webhook/route.ts` |
| `POST /api/integrations/voice/tool` | Las dos herramientas del asistente de voz (`brief` y `decide`). Exige el secreto compartido en `x-nexo-secret` | `src/app/api/integrations/voice/tool/route.ts` |
| `GET /api/integrations/status` | Qué canales del Comité están configurados. No expone claves | `src/app/api/integrations/status/route.ts` |
| `POST /api/access-requests` | Body `{ name, email, organization, message? }`. Guarda la solicitud en Supabase. `{ ok: true }`, 400 o 503 `STORAGE_UNAVAILABLE` | `src/app/api/access-requests/route.ts` |
| `GET /api/interviews` | `{ interview: { name, role, organization, answers: [{ key, question, answer }], publishedAt } \| null, available }`. Sin Supabase o sin tabla, `interview: null` | `src/app/api/interviews/route.ts` |
| `GET /api/ping` | 200 si el servidor está vivo. Lo usa Render | `src/app/api/ping/route.ts` |
| `GET /api/health` | Dice si el modelo configurado responde | `src/app/api/health/route.ts` |

### Las 11 acciones

Definidas en `ActionSchema` (`src/lib/store/actions.ts`). El almacén (`applyAction` en `src/lib/store/rooms.ts`) las reparte hacia el motor.

| Acción | Quién puede | Función del motor |
| --- | --- | --- |
| `JOIN_ROLE` | Cualquiera, si el rol está libre. Entrega el token. El puesto del Comité exige además la clave del QR (`committeeKey`); sin ella, 403 `COMMITTEE_KEY_REQUIRED` | `markRoleJoined` |
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

### Piezas de la silla del celular

| Pieza | Archivo en `src/components/seat/` | Qué muestra |
| --- | --- | --- |
| Armazón | `seat-shell.tsx` | Quién soy, el reloj de espera, el pulso ECG (rojo al esperar, verde plano al sellar), la zona del pulgar y las tres pestañas |
| Revelación | `reveal-card.tsx` | «Te tocó <rol>», organización, misión y dos chips; botón «Entrar a mi silla» y, si llegó por sorteo, «Sortear otro rol» |
| Elegir silla | `seat-picker.tsx` | Lista de sillas libres u ocupadas cuando el enlace no trae rol y no se sorteó |
| Tu turno | `turn-view.tsx` | Una tarjeta por turno: acordar el límite, firmar, presentar el caso, el duelo del Comité, esperar o resuelto |
| Razón | `reason-field.tsx` | Chips de un toque que rellenan la razón editable (obligatoria) |
| Secretos | `secrets-view.tsx` | Lo que ve el rol y lo oculto como franjas; «Ver» pide el dato y, si el servidor lo niega, muestra «Este dato nunca llegó a tu celular» |
| Sala | `room-view.tsx` | Paso actual, quién está conectado, el agente del rol, la voz del Comité y, plegados, la regla y el grafo |
| Cálculos de vista | `screen.ts` | Por qué espera, qué datos llegaron, sillas de la sala. Solo lee el estado proyectado |

De `src/components/organs/` quedan `living-graph-organ.tsx` (grafo vivo), `allocation-conflict-organ.tsx` (choque de autoridad y sello de la regla), `reliability-meter.tsx` (medidor p^n) y `telemetry-readout.tsx` (dónde corre el modelo y cuántos bytes salieron). El resto de los órganos de la primera versión se borró al rehacer el celular.

## Sala de demo: 3 personas y 3 toques

Para que alguien que no conoce Sculptor pueda jugar la demo entre organizaciones. Las tres salas fijas entre organizaciones (`demo-cross`, `demo-construccion`, `demo-logistica`) son salas de demo; una sala nueva lo es si se crea con `POST /api/rooms { mode: "cross_org", demo: true }`. Los modos completos siguen igual en las demás salas.

- **3 asientos humanos:** quien presenta el caso en cada organización (Jefatura de Urgencias y Médico Jefe de Turno en hospitales) y el Comité. El sorteo del QR único (`drawableSeats` en `src/lib/store/rooms.ts`) reparte solo esos tres, y en la demo el Comité entra al sorteo SIN la clave de su QR (en el deploy la pantalla grande de una sala fija no tiene la clave). `JOIN_ROLE` directo al Comité sigue pidiendo la clave. La lista manual del celular muestra solo los dos que presentan.
- **Bots administrativos:** al entrar la primera persona, `startDemoBots` sienta un bot del piloto automático en el aprobador de cada organización y corre `buildDemoBotScript` (`src/lib/engine/autopilot.ts`): sellan el límite y firman la compuerta, un paso cada 0,9 s, con las mismas funciones del motor que usaría una persona. Quien presenta no espera a los bots: puede presentar de inmediato (`submitCandidate` no depende de la compuerta).
- **Celular:** en la demo, quien presenta no ve el límite ni la firma (`seatTurn` en `src/components/nexo/guide.ts`), su misión es una frase sin jerga (`mission` en `src/components/seat/screen.ts`) y la pestaña «Sala» muestra los 4 pasos de la demo: Unirse, Casos, Comité y Acta (`demoStep`). Tras una ronda nueva, un teléfono viejo no recupera su silla: vuelve a la tarjeta de sorteo (`shouldRecoverSeat` en `src/lib/client/use-room.ts`).
- **Reloj:** `stakes.elapsedMs` cuenta desde que entra la primera persona (`RoomState.clockStartedAt`, que arranca `markRoleJoined` y nunca un bot). Vale para todas las salas.
- **Nueva ronda:** el reinicio del anfitrión (`DELETE /api/rooms/:id`, botón «Nueva ronda» de la pantalla grande) deja la sala limpia: sin bots, reloj en 0 y la próxima persona vuelve a traer a los bots. Además, una sala de demo con el acta cerrada se reinicia sola tras 2 minutos sin acciones (`scheduleDemoReset`); las conexiones abiertas no cuentan como actividad. Con el acta cerrada, `DELETE /api/rooms/:id` no pide token en una sala de demo (`canResetWithoutHost`), para que el siguiente grupo pueda jugar en el deploy sin la clave de administración. El reinicio borra la ronda (decisiones y bitácora): el acta hay que descargarla antes.
- **Demo pauteada:** los asientos se reparten por orden de llegada (1.º Clínica, 2.º Hospital Rural, 3.º Comité). El motor calcula los asientos y el turno (`demoSeats` y `demoTurn` en `src/lib/engine/deterministic.ts`) y los proyecta como `seatOrder`, `seatLabel` y `turn`. El almacén anota cuándo empieza cada turno (`syncDemoTurn`) y, si la persona no actúa en `turnTimeoutMs` (20 s; `NEXO_DEMO_TURN_MS`, `0` lo apaga), el piloto juega por ella (`playTurnAutomatically`), con `modo: "automático"` en el acta. El celular de esos 3 asientos usa `src/components/seat/demo-view.tsx`: «Eres la Clínica» en grande, un botón cuando le toca y «Espera: le toca al…» cuando no.
- **Cómo se ve un bot:** ver `docs/DECISIONES.md`, «Marca de los asientos bot».

## Modelo de datos

- **Genoma de una organización** (`OrgGenomeSchema`): hasta 3 roles (`role_a`, `role_b`, `role_c`), entre 4 y 8 campos con visibilidad, una regla de autoridad y un caso vivo. Cada campo declara `visibleToOrgIds` y `visibleToRoleIds`.
- **Recurso escaso** (`SharedScarcitySchema`): una regla de asignación con pesos, margen de empate y desempate; de 2 a 4 candidatos, cada uno con su `coverageCost` secreto; y un árbitro (`ArbiterSchema`) con su propio `orgId` (`comite_red` en la semilla).
- **Estado de sala** (`RoomStateSchema`): los genomas, el recurso, jugadores conectados, decisiones humanas, bitácora, telemetría y versión. Contiene todos los secretos y nunca sale del servidor.
- **Vista del cliente** (`ProjectedRoomStateSchema`): lo único que viaja por el SSE. Los campos ocultos llegan como `{ redacted: true, reason: "RBAC_SERVER_FILTERED" }`, sin la propiedad `value`. Trae además los valores derivados que calcula el motor: `conflict`, `gate`, `reliability`, `allocation`, `stakes`.
- **Secretos de la sala:** el token de cada rol (`RoomRecord.tokens`), el token de anfitrión (`hostToken`) y la clave del Comité (`committeeKey`) viven en el almacén, fuera de `RoomState`. Por eso ninguna vista ni el acta pueden contenerlos (lo comprueba `tests/security.test.ts`).
- **Escenario y ensayo:** `RoomState.scenarioId` dice con qué escenario se abrió una sala entre organizaciones. El estado del ensayo automático (`autopilot`: si corre, paso, total, último paso y puestos de bots) lo agrega el almacén a cada mensaje SSE; no es parte del estado del motor.

## Flujo de un dato, de punta a punta

Ejemplo: una persona del público escanea el QR del Comité y veta la asignación de la cama. Todas las pantallas cambian.

0. **La sala.** Quien presenta crea la sala con `POST /api/rooms` (`{ mode: "cross_org", scenario: "hospitales" }`) y recibe `hostToken` y `committeeKey`. `useRoom` (`src/lib/client/use-room.ts`) los guarda en `localStorage` para la pantalla grande.
1. **El QR.** La pantalla grande (`src/components/stage/command-center.tsx`) dibuja el código con `roleJoinUrl` (`src/components/nexo/public-url.ts`): `/room/<id>?orgId=comite_red&roleId=role_c&key=<committeeKey>`. Sin la clave en el enlace, nadie puede tomar ese puesto.
2. **Entrar.** `src/app/room/[roomId]/room-client.tsx` lee `orgId`, `roleId` y `key` del enlace y llama a `join` de `useRoom`, que envía `POST /api/rooms/<id>/action` con `{ type: "JOIN_ROLE", orgId, roleId, committeeKey }`.
3. **Identidad.** La ruta aplica el límite de peticiones (`rateLimited`) y llama a `applyAction` (`src/lib/store/rooms.ts`). La función `join` comprueba la clave del Comité en tiempo constante (403 `COMMITTEE_KEY_REQUIRED` y un `AUTH_FAILED` en la bitácora si falta), genera un token aleatorio (`randomBytes(24)`), lo guarda y llama a `markRoleJoined` del motor, que agrega el evento `QR_JOINED`. El token vuelve en la respuesta y el navegador lo guarda en `sessionStorage`.
4. **Conexión en vivo.** `useRoom` abre un `EventSource` a `/api/rooms/<id>/events?orgId=comite_red&roleId=role_c&token=...`. La ruta (`events/route.ts`) llama a `resolveViewer` (compara el token en tiempo constante) y a `projectRoom`, que usa `projectStateForOrgAndRole` del motor. El Comité recibe la sala sin el costo de ningún hospital.
5. **La decisión.** El Comité toca un chip de razón o la escribe en `src/components/seat/reason-field.tsx`, dentro del duelo de `src/components/seat/turn-view.tsx`, y presiona «Vetar». La vista llama a `act("COMMITTEE_VETO", { reason })`.
6. **Validación.** En `applyAction`: `ActionSchema.safeParse` revisa la forma (400 si falla), `isKnownActor` revisa que el rol exista (404) y `tokenMatches` revisa el token (401).
7. **La regla.** `recordCommitteeDecision` (`src/lib/engine/deterministic.ts`) comprueba que quien actúa es el árbitro (403 si no), que hay razón (400 `REASON_REQUIRED`) y que hay una asignación propuesta (409). Agrega la decisión a `decisions`, vuelve a ordenar sin el caso vetado (`resolveRoomAllocation`) y escribe los eventos `HITL_VETOED` y `ALLOCATION_PROPOSED`. `commit` sube la versión.
8. **Aviso.** `settle` guarda el estado nuevo y llama a `emit(roomId)`.
9. **Difusión.** Cada conexión SSE abierta está suscrita (`subscribe`). Su función `send` vuelve a resolver quién mira, proyecta la sala para ese viewer y escribe un mensaje `data:`. Cada conexión recibe su propia versión filtrada.
10. **Las otras pantallas.** En cada navegador, `useRoom` recibe el mensaje y React vuelve a dibujar: el duelo del Comité muestra al nuevo recomendado y la pantalla grande cambia su «Historia de la decisión».
11. **El acta.** `GET /api/rooms/<id>/acta?format=md` llama a `getActa`, que usa `buildAuditActa` y `renderActaMarkdown` del motor.

Si el Comité decide por WhatsApp o por voz, cambian solo los pasos 1 a 5: el canal toma el puesto con la misma clave y envía la misma acción (ver "Canales externos del Comité").

## Agentes

Hay dos agentes propios y un asistente externo. Cada agente propio vive en su archivo, con su instrucción y su formato de salida a la vista. Ninguno actúa por su cuenta: responden cuando una persona lo pide, y lo que cambia en la sala lo decide el motor.

| Agente | Archivo | Entrada | Salida | Modelo | Qué decide el código y no el modelo |
| --- | --- | --- | --- | --- | --- |
| Agente de rol | `src/agents/role-agent.ts` (`runRoleAgentTurn`) | La vista ya filtrada de un rol (`ProjectedRoomState`) y un pedido opcional de la persona | `{ proposalText, suggestedValue, attemptedFieldRead, latencyMs, source }` | El configurado en `LLM_MODEL`, vía `chatJson`. Tope de 140 tokens, razonamiento reducido, plazo de 12 s | Qué datos entran al prompt (solo los que el rol ve). La instrucción pide un máximo de 45 palabras; si el modelo se pasa, el código corta en 79 (`limitWords`, `MAX_WORDS`). `suggestedValue` acotado al rango de la regla. `attemptedFieldRead` solo vale si es un campo oculto de la vista. Los valores reservados se tachan del texto (`redactReserved`). Si el modelo falla, propuesta fija marcada "Respaldo sin modelo" |
| Agente de mutación | `src/agents/mutate-genome.ts` (`mutateGenomeFromPrompt`) | Una frase de hasta 400 caracteres, limpiada con `sanitizeDescription` | `{ genome, source: "llm" \| "fallback_seed", latencyMs }` | El mismo, vía `chatJson`. Tope de 900 tokens, plazo de 25 s (15 s cuando crea una sala nueva desde una frase, `NEW_ROOM_MUTATION_TIMEOUT_MS`) | Toda la estructura (`normalizeGenome`): ids de rol, quién propone y quién aprueba, colores, clasificación de cada campo, rangos. `OrgGenomeSchema` decide si el resultado se usa. `findLeakedSecret` rechaza textos públicos que citen un valor reservado y `findMarkup` rechaza HTML o código. Si falla dos veces, se usa la semilla más parecida (`pickClosestSeed`) |
| Asistente de voz del Comité (externo) | Prompt y herramientas en `src/integrations/elevenlabs.ts` (`ensureCommitteeAgent`) | La conversación con quien preside el Comité, por teléfono o en el navegador | Llama a dos herramientas de nuestro servidor: `consultar_caso` y `registrar_decision` | **Corre dentro de ElevenLabs** (voz `eleven_flash_v2_5`; el modelo de conversación no se fija en el código, lo pone ElevenLabs). Es la única excepción a "todo modelo pasa por `src/lib/llm.ts`" | El resumen que lee lo arma el servidor con la vista del Comité (`buildCommitteeBrief`). La decisión la aplica `decideAsCommittee` con las acciones de siempre; razón obligatoria. El asistente no puede ver ni cambiar nada más |

Detalles que importan:

- **El agente hereda los permisos del rol.** `runAgent` (`src/lib/store/rooms.ts`) le pasa a `runRoleAgentTurn` el resultado de `projectRoom(roomId, actor)`: lo mismo que recibe el navegador de esa persona. Un valor oculto nunca llega al prompt porque nunca salió del motor.
- **El agente propone; no decide.** `applyAgentProposal` del motor solo hace dos cosas. Primera: si quien pidió es el proponente, el valor sugerido pasa en ese mismo momento a ser el valor propuesto del caso, sin otra confirmación, y la compuerta se reevalúa (puede quedar bloqueada o abierta). Segunda: si el agente declaró un campo que no puede ver, queda un 403 en la bitácora. No existe camino para que una propuesta firme una compuerta, selle una asignación o cambie una regla: eso exige una persona con el rol que corresponde y una razón.
- **El texto de la propuesta no entra a la bitácora.** Vuelve solo en la respuesta HTTP a quien la pidió.
- **El Comité árbitro no tiene agente.** `runAgent` responde 409.
- **No hay orquestación entre agentes.** Los agentes no se llaman entre sí ni corren en bucle.
- **El ensayo automático no usa agentes ni modelo.** Sus pasos llaman directo a las funciones del motor (`src/lib/engine/autopilot.ts`); los pasos de agente se omiten para que sea reproducible.

## Modelos

| Uso | Modelo | Dónde corre | Estado |
| --- | --- | --- | --- |
| Deploy público | `claude-opus-5-5` (`render.yaml`) | API de Anthropic, en la nube | En uso. `GET /api/health` del deploy responde "Claude disponible". Una mutación de genoma tarda unos 10 segundos (medido con `scripts/stress-llm.mjs`, ver `docs/MEDICIONES.md`) |
| Local | El de `LLM_MODEL`, servido por Ollama con el protocolo compatible con OpenAI. `scripts/spark-setup.sh` descarga `gpt-oss:20b` y `qwen3:32b` | NVIDIA DGX Spark de 128 GB o un notebook | Implementado y probado contra un servidor simulado. **Sin verificar contra el Spark:** falta confirmar endpoint, id del modelo y cómo se apaga el razonamiento. **Latencia sin medir** |

**Por qué Claude y por qué ese modelo.** Claude, porque el deploy corre en internet y no puede llegar al Spark, que está en la red local de la sede. El id `claude-opus-5-5` es el valor por defecto de `llmConfig` y el que fija `render.yaml`. El repo no registra una comparación con un modelo más chico o más rápido: con unos 10 segundos por mutación, esa comparación está pendiente (`docs/PENDIENTES.md`). Cambiar de modelo es cambiar `LLM_MODEL`, sin tocar código.

`LLM_PROVIDER` elige el camino (`llmConfig` en `src/lib/llm.ts`): `anthropic` usa el SDK oficial; cualquier otro valor usa `fetch` contra `LLM_BASE_URL`. Qué agrega la capa:

- **Cola** (`acquireSlot`): por defecto 1 llamada a la vez en local y 2 en Claude. `LLM_MAX_CONCURRENT` lo cambia.
- **JSON validado** (`chatJson`): extrae el objeto, lo valida y, si falla, reintenta una vez mostrándole el error al modelo.
- **Llamadas rápidas** (`thinking: false`): en Claude baja `effort` a `low`. En local mezcla en la petición lo que diga `LLM_NO_THINK_BODY`; el nombre del parámetro depende del servidor y no está verificado.
- **Respaldo de Claude:** el parámetro `fallbacks` hace que la API reintente en otro modelo si el primero declina.
- **Telemetría veraz** (`getTelemetry`): `provider` es `local` solo si el host es de la máquina o de una red privada (`isLocalHost`). `bytesSentToCloud` cuenta el cuerpo de cada petición enviada a un host de nube; queda en 0 únicamente cuando todo se habló con un host local. Viaja en cada mensaje SSE y la muestran la pestaña «Sala» del celular (`src/components/organs/telemetry-readout.tsx`, dentro de `src/components/seat/room-view.tsx`) y la pantalla general.

En el deploy público los datos del caso que el rol puede ver sí salen hacia Anthropic. "Ningún dato sale de la red" vale solo en modo local.

## Integraciones externas

| Servicio | Para qué | Estado |
| --- | --- | --- |
| API de Anthropic | Modelo de lenguaje del deploy público | Real, en uso |
| Ollama (protocolo compatible con OpenAI) | Modelo de lenguaje local | Implementado. Probado con un servidor simulado en `src/agents/__tests__/agents.test.ts`. Sin verificar contra el Spark |
| Render | Hosting del servidor público | Real, plan gratis |
| Supabase | Solicitudes de acceso y entrevistas de la portada. Las salas no usan base de datos | Implementado y probado con `fetch` simulado (`tests/supabase.test.ts`). **Las tablas todavía no están creadas** en el proyecto: hasta entonces el formulario responde 503 y la entrevista no aparece, sin romper la página |
| Kapso (WhatsApp) | El Comité recibe el caso con botones Aprobar / Vetar y responde la razón por escrito | Implementado. Probado con pruebas unitarias sin llamar al servicio (`tests/integrations.test.ts`). Necesita sus variables en el servidor |
| ElevenLabs (voz) y Twilio | Asistente de voz del Comité, en el navegador o por llamada telefónica | Implementado. Probado con pruebas unitarias sin llamar al servicio. La llamada telefónica depende de un número de Twilio vinculado en ElevenLabs |

No hay autenticación externa. Los códigos QR se generan en el navegador con la librería `qrcode`; no pasan por ningún servicio. Sculptor no se conecta a ningún sistema hospitalario, de construcción ni de logística.

### Canales externos del Comité

El Comité árbitro de una sala entre organizaciones puede decidir sin abrir la web. Los dos canales están en `src/integrations/` y no tienen reglas propias: `committee-channel.ts` toma el puesto del Comité con `JOIN_ROLE` y la clave del Comité de la sala (la misma del QR), y aplica la decisión con `ALLOCATION_SEAL` (aprobar) o `COMMITTEE_VETO` (vetar), con razón obligatoria. Permisos, bitácora y acta funcionan igual; la razón queda con el canal anotado ("vía WhatsApp", "vía llamada de voz"). El resumen que recibe el Comité lo arma `buildCommitteeBrief` solo con `projectRoom` para el rol del Comité, así que un canal externo nunca recibe un dato reservado. Si una persona ya tiene el puesto desde la web, el canal no lo toma (409).

- **WhatsApp con Kapso** (`kapso.ts`). El anfitrión pide `POST /api/rooms/:id/committee` con `channels: ["whatsapp"]`. Kapso envía al número del Comité (`NEXO_COMMITTEE_PHONE`) el caso con dos botones; si está `KAPSO_TEMPLATE_NAME`, lo envía como plantilla aprobada de WhatsApp (idioma `KAPSO_TEMPLATE_LANG`, por defecto `es`), que es lo que permite escribirle a un número que no ha conversado antes. La respuesta llega a `POST /api/integrations/kapso/webhook`, que verifica la firma HMAC del cuerpo crudo (`verifyKapsoWebhookSignature`, secreto `KAPSO_WEBHOOK_SECRET`) antes de leerlo. El botón deja la decisión pendiente; el siguiente mensaje de texto del mismo número es la razón, y recién entonces se registra. Solo se aceptan mensajes del número asociado a la sesión.
- **Voz con ElevenLabs** (`elevenlabs.ts`). Un agente de ElevenLabs conversa en español con quien preside el Comité: por llamada saliente (`channels: ["call"]`, vía el número de Twilio vinculado en ElevenLabs, `ELEVENLABS_PHONE_NUMBER_ID`) o desde el navegador (`POST /api/rooms/:id/committee/voice` con la clave del Comité, que devuelve una URL firmada). El agente tiene dos herramientas webhook hacia `POST /api/integrations/voice/tool`, protegidas por un secreto compartido en el encabezado `x-nexo-secret` (`NEXO_CHANNEL_SECRET`): `consultar_caso` devuelve el resumen y `registrar_decision` aplica la decisión con la razón dicha por la persona. La instrucción del agente le pide repetir la decisión y la razón y esperar confirmación antes de registrarla; eso depende del modelo de ElevenLabs, mientras que la razón obligatoria la exige el motor. Si `ELEVENLABS_AGENT_ID` falta, el agente se crea la primera vez.
- **Notas de voz informativas** (`voice-notes.ts`, apagadas salvo `NEXO_VOICE_NOTES=1`). Evento de la sala → resumen corto armado con la vista filtrada del Comité (`projectRoom` con su rol: nunca un dato reservado) → texto a voz de ElevenLabs (`POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=opus_48000_64`, modelo `eleven_multilingual_v2`) → se sube a los medios de WhatsApp con el SDK de Kapso (`media.upload`) y se envía con `messages.sendAudio`. Si el audio viene en contenedor OGG (empieza con «OggS») va como nota de voz (`voice: true`); si no, se pide MP3 y va como audio normal. Dos eventos: (a) el caso, unos 20 s, cuando llega al Comité (al tocar un botón, o al enviar el caso si la conversación ya estaba abierta); (b) el acta, cuando el Comité sella, por WhatsApp (webhook) o desde la web (la ruta de acciones llama a `sendActaAfterWebSeal` si a esa sala se le envió el caso por WhatsApp). Respeta la ventana de 24 h de WhatsApp: solo se envía si el Comité escribió o tocó un botón en las últimas 24 h (`noteInbound`, `windowOpen`); si no, se omite sin error. El texto usa el recurso, las organizaciones y las etiquetas del escenario (pacientes, obras o cargas), no frases de hospital. El audio solo informa: decidir sigue siendo con botón y razón escrita.
- **Sesiones.** Cada canal guarda su sesión (token del puesto, número, decisión pendiente) en memoria del proceso, con vencimiento de 30 minutos.
- **Qué canales hay.** `GET /api/integrations/status` lo dice, para que la interfaz muestre solo los que funcionan.

## Colaboración en tiempo real

**Transporte.** Cada navegador abre una conexión de eventos (SSE) a `/api/rooms/:id/events`. Las acciones van por `POST` normales. El servidor envía la sala completa en cada mensaje, no diferencias.

**Una vista por viewer.** En cada envío, `send` (`events/route.ts`) vuelve a resolver quién mira con `resolveViewer` y proyecta con `projectStateForOrgAndRole`. El dato oculto no se esconde en el navegador: no se envía. Si el token deja de ser válido (el rol se liberó o la sala se reinició), la misma conexión pasa a recibir la vista general sin reconectar.

**Permiso doble.** `canViewField` exige que la organización del viewer esté en `visibleToOrgIds` y que su rol esté en `visibleToRoleIds`. El costo de cobertura de un candidato usa `canViewCoverageCost`: solo lo recibe su organización y, dentro de ella, solo los roles que pueden ver el campo `coverage_cost`. La pantalla general no tiene identidad (la recibe cualquiera que conozca la sala, y de ella sale el acta), así que solo recibe campos clasificados `public` que además ven todas las organizaciones y todos los roles. Un campo `restricted` que ven los tres roles de la clínica sigue siendo interno.

**Pulso.** Mientras el contador corre (`isStakesRunning`), cada conexión recibe un mensaje por segundo con el reloj del servidor. Con la decisión sellada, uno cada 15 segundos para mantener viva la conexión.

**Presencia.** Un rol aparece conectado si su conexión dio señal de vida hace menos de 45 segundos (`PRESENCE_TTL_MS`). Pasado ese tiempo sin conexión, otra persona puede tomar el rol y el token anterior deja de servir.

**Dos personas a la vez.** Node ejecuta el código de a una acción por vez, y cada función del motor es síncrona: recibe un estado y devuelve otro. No hay dos escrituras simultáneas. Cada cambio sube `version`. Las únicas acciones que esperan (`RUN_ROLE_AGENT` y la mutación) llaman al modelo y aplican su resultado sobre el estado que exista al volver; si el rol cambió de manos (el token vigente ya no es el que pidió el turno) o la sala se reinició mientras tanto, se descarta (`runAgent` en `src/lib/store/rooms.ts`). La mutación solo se permite en una sala sin personas conectadas; si ya hay alguien, responde 409 `ROOM_IN_USE`, para que nadie pueda reiniciar una sesión ajena. Hay una sola llamada al modelo a la vez por rol y una sola mutación a la vez por sala; repetir el botón responde 409 `BUSY`.

**Decisiones definitivas.** Una compuerta decidida o una asignación sellada no se pueden cambiar: el motor responde 409 `DECISION_SEALED`.

**Anfitrión y Comité.** Al crear una sala, el almacén emite dos secretos que solo recibe quien la creó (adaptado de los commits `b22928c` y `fbe8a4f` de la versión de Ramón):

- **Token de anfitrión** (`hostToken`, encabezado `x-host-token`): habilita los controles de la pantalla grande: reiniciar, ensayo automático, liberar un puesto, mutar y avisar al Comité por sus canales externos. Sin él, 403 `HOST_ONLY`. La clave de administración (`NEXO_ADMIN_KEY`, encabezado `x-admin-key`) también sirve.
- **Clave del Comité** (`committeeKey`): va dentro del QR del Comité. Es la única forma de tomar el puesto del árbitro (o del Comité de la clínica en `single_org`). La dirección interna de cada organización en `cross_org` no la necesita.
- **Salas fijas.** Nadie las creó, así que nadie tiene sus claves. `POST /api/rooms/:id/host` las entrega con la clave de administración o, sin ella, solo fuera de producción. En el deploy público, para presentar se crea una sala nueva y quien la crea recibe sus controles.
- **Revocación.** Un token deja de servir al hacer `LEAVE_ROLE`, cuando el anfitrión libera el puesto (`POST /revoke`), cuando otra persona toma un puesto abandonado y cuando se reinicia la sala.

**Ensayo automático** (`src/lib/engine/autopilot.ts`, `startAutopilot`). El anfitrión lo lanza para ensayar sin gente. Un bot toma cada puesto del guion que no tenga a una persona y los pasos corren uno tras otro (por defecto cada 1,5 s): el proponente pide más autoridad, el aprobador de la otra organización intenta leer el costo ajeno (403), los aprobadores sellan sus reglas, uno contrapropone y otro aprueba con razón, cada organización presenta su caso y, si nadie tiene el puesto del Comité, un bot firma la asignación. Cada paso llama a la misma función del motor que usaría una persona, con las mismas reglas. Si una persona toma un puesto a mitad del ensayo, su paso se salta. Todo queda en la bitácora con eventos `AUTOPILOT` y las entradas de los bots llevan `bot: true`, y cada decisión del piloto lleva `automatic: true` (en el estado, en la bitácora y en la sección «Decisiones automáticas» del acta): no se presenta como si lo hubiera hecho una persona.

**Topes de memoria** (`src/lib/store/rooms.ts`), para que un deploy público no se llene:

| Tope | Valor | Al llegar |
| --- | --- | --- |
| Salas creadas por `POST /api/rooms` | 200 (`NEXO_MAX_ROOMS`) | Sale la sala sin conexiones con más tiempo inactiva; si todas tienen gente, 503 `ROOM_LIMIT` |
| Sala común sin conexiones ni actividad | 2 horas | Se borra |
| Sala fija usada y sin conexiones ni actividad | 15 minutos | Vuelve a su semilla, para que el siguiente visitante no encuentre un caso ya decidido |
| Conexiones SSE | 200 por sala, 1000 en total | 503 `TOO_MANY_CONNECTIONS` |
| Body de una petición | 8000 caracteres (`src/lib/store/http.ts`) | 400 |
| Peticiones por cliente y por minuto (`src/lib/store/rate-limit.ts`) | Crear sala 30; mutar 6 (más un tope global de 20 para todo el servidor); acciones 600; conexiones SSE 300; acta 60; controles de anfitrión 60; solicitudes de acceso 5; entrevistas 120 | 429 `RATE_LIMITED` con `Retry-After`. La IP se lee de `X-Forwarded-For` (último salto) solo con `TRUST_PROXY=1`; sin eso, todos comparten un mismo límite |
| Razón de una decisión | 500 caracteres (`REASON_MAX_LENGTH`) | 400 |
| Bitácora | 2000 eventos; los intentos sin token (`AUTH_FAILED`) tienen cupo propio de 300 | Se descartan primero los eventos de rutina más antiguos. Las decisiones y su rastro nunca se descartan, y el acta declara cuántos eventos se perdieron (`auditLogDropped`) |

**Reconexión.** Si la conexión cae, `useRoom` la reabre con espera creciente (de 1 a 10 segundos). Si el servidor se reinició, intenta recuperar el rol una vez.

**Probado.**

| Qué | Cómo | Resultado |
| --- | --- | --- |
| Recorrido completo con participantes independientes, cada uno con su SSE | `node scripts/e2e.mjs <url>` | La versión anterior pasó 97 de 97 pasos contra el deploy público (21 de noviembre). La versión actual (con escenario de construcción ensayado por el piloto automático, sala nueva desde una frase y rechazo del Comité sin clave) pasa completa contra las rutas locales en `npm test`; **no se ha corrido contra el deploy** |
| Carga | `node scripts/load-test.mjs`, 10 cambios | 500 conexiones SSE simultáneas en una sala: todos los cambios llegaron a todas, p95 de 52 ms. Medido en un notebook contra las rutas sin Next; la salida completa está en `docs/MEDICIONES.md`. Se midió antes del tope actual de 200 conexiones por sala: hoy esa corrida recibiría 503 desde la conexión 201. **No se midió contra el deploy** |
| Detector de fugas | `tests/http.test.ts` levanta un servidor que cuela un costo en el SSE | El recorrido falla, como debe |
| Llamadas al modelo a la vez | `node scripts/stress-llm.mjs <url>`: lanza a la vez 1 mutación de genoma y 3 turnos de agente (uno por rol), y lee la cola desde la telemetría del SSE | Contra el deploy (Claude en la nube), el 21 de noviembre: la mutación tardó unos 10 segundos (ver `docs/MEDICIONES.md`). Los tres turnos de agente declararon un campo oculto que necesitaban (`attemptedFieldRead`) y los tres quedaron como `RBAC_DENIED` en la bitácora. Es el comportamiento esperado: la instrucción del agente le pide nombrar un dato que no puede ver, y el servidor registra el intento sin entregar el valor. La latencia de los turnos de agente no quedó registrada en este documento |

## Qué es real y qué es simulado

Esta tabla es la respuesta honesta a "¿esto funciona de verdad?".

| Parte | Real | Simulado o sin verificar |
| --- | --- | --- |
| Permisos por organización y rol | Real. El filtro ocurre en el servidor y se comprueba buscando los valores en el tráfico (`tests/engine.test.ts`, `scripts/e2e.mjs`) | |
| Tiempo real entre varios dispositivos | Real. SSE, probado con participantes independientes | |
| Identidad | Real pero mínima: un token aleatorio por rol, un token de anfitrión por sala y una clave del Comité dentro de su QR | No hay cuentas ni contraseñas. Quien toma un rol libre (que no sea el Comité) es ese rol |
| Límite de peticiones | Real, en memoria | **Sin verificar en Render** que el último salto de `X-Forwarded-For` sea la IP del cliente. Si no lo es, todos comparten un límite: protege igual, más grueso |
| Otros rubros (construcción, logística) | Reales en el código: mismo motor, mismas pruebas | **Datos ficticios**, como los de salud |
| Ensayo automático | Real: mismas funciones del motor que una persona | **Lo hacen bots, no personas.** Queda marcado como ensayo en la bitácora (`AUTOPILOT`, `bot: true` en la entrada) y sus decisiones con `automatic: true`, en una sección aparte del acta. Es para ensayar; en las salas de demo el mismo piloto juega los roles administrativos y el plan B |
| Comité por WhatsApp (Kapso) | Implementado: envío con botones, webhook con firma HMAC, mismas acciones | **Probado solo con pruebas unitarias, sin llamar a Kapso** (`tests/integrations.test.ts`). Necesita las variables de Kapso en el servidor |
| Comité por voz (ElevenLabs) | Implementado: agente con dos herramientas protegidas por secreto compartido | **Probado solo con pruebas unitarias, sin llamar a ElevenLabs.** La llamada telefónica depende de un número de Twilio vinculado en ElevenLabs. El modelo de conversación corre dentro de ElevenLabs |
| Notas de voz por WhatsApp (ElevenLabs + Kapso) | Implementado: resumen desde la vista del Comité, texto a voz, subida de medios y envío, ventana de 24 h | **Probado solo con dobles, sin llamar a ElevenLabs ni a Kapso** (`tests/voice-notes.test.ts`). No está verificado que el Opus de ElevenLabs llegue en OGG (la referencia de la API no lo dice); si no, se envía MP3 como audio normal. Apagado salvo `NEXO_VOICE_NOTES=1` |
| Formulario de acceso y entrevistas (Supabase) | Implementado, con degradación si falta Supabase | **Las tablas no están creadas todavía.** Probado con `fetch` simulado (`tests/supabase.test.ts`). La entrevista que se muestra es la que el equipo publique a mano |
| Choque, compuerta, asignación, desempate, contador | Real. Código determinista con pruebas | |
| Confiabilidad p^n | El cálculo es real | **Es un modelo ilustrativo, no una medición.** Los valores de `reliabilityP` (0,90 a 0,95) vienen de la semilla, no de un benchmark |
| Acta | Real. JSON y Markdown, con la bitácora completa | |
| Entrada por QR desde un teléfono | Real | |
| Agente de rol y mutación por frase | Reales en el deploy, con Claude | Si el modelo falla se usa una respuesta fija, marcada como respaldo (`source: "fallback"` o `"fallback_seed"`) |
| Lecturas denegadas que provoca el agente | El rechazo es real: el motor responde 403 y lo registra | **El intento lo induce el diseño.** La instrucción del agente (`buildInstruction` en `src/agents/role-agent.ts`) le pide nombrar el dato oculto que le faltaría, para demostrar en vivo que el permiso se aplica en el servidor. No es un intento espontáneo de acceso |
| Latencia del modelo | Con Claude en el deploy, una mutación de genoma tarda unos 10 segundos (medido con `scripts/stress-llm.mjs`) | Es la medición de una corrida, no un promedio. Los turnos de agente no tienen cifra registrada |
| Modelo local en el Spark | El código existe | **Sin verificar contra el Spark y sin medir latencia** |
| "Ningún dato sale a la nube" | Cierto solo en modo local | **El deploy público usa Claude:** los datos sí salen, y la telemetría lo muestra |
| Datos del caso | | **Simulados.** Pacientes, obras, cargas, costos, puntajes y plazos vienen de `src/lib/genome/seeds.ts`. No son datos reales ni estadísticas |
| Organizaciones | | **Ficticias.** No hay integración con ningún hospital, constructora, distribuidora ni sistema externo |
| Validación con usuarios | | **No se validó** el flujo con personas del área de salud |

## Límites conocidos

- **Textos públicos del caso.** El título, resumen y `stakesLabel` de cada organización viajan a todas las organizaciones. `tests/genome.test.ts` verifica que en las semillas no repitan ningún valor de un campo no público. Un genoma generado por el modelo pasa por `findLeakedSecret`, que es menos estricto: valores cortos o parafraseados podrían pasar.
- **Orden de llegada.** Las acciones no llevan la versión que vio quien actúa; gana la que llega primero.
- **Fórmula de prioridad.** `computeTriageScore` resta el riesgo por demora, tal como lo especificó el plan. Clínicamente podría esperarse lo contrario; está anotado en `docs/PENDIENTES.md`.

- **Estado en memoria de un solo proceso.** Se pierde si el servidor se reinicia y no se reparte entre varios servidores. Las cuatro salas fijas se recrean solas, vacías y con claves nuevas. Las sesiones de los canales del Comité y las ventanas del límite de peticiones también viven en memoria.
- **Render en plan gratis.** El servicio se duerme sin visitas y, al dormirse, pierde las salas.
- **Sin cuentas.** La identidad es un token por rol. Un rol sin conexión por 45 segundos queda libre para otra persona.
- **Protección.** Los controles de la pantalla grande exigen el token de anfitrión y el Comité exige la clave de su QR (en las salas de demo, a propósito, el sorteo da el asiento del Comité sin clave y «Nueva ronda» no pide token con el acta cerrada; ver `docs/DECISIONES.md`). Cualquiera puede crear salas y pedir turnos del agente en la sala que ocupa, dentro del límite por cliente. El límite cuenta por IP solo si `TRUST_PROXY=1` y el proxy pone la IP real; si no, es un límite compartido. Quien tenga el enlace del QR del Comité (por ejemplo, una foto de la pantalla) puede tomar ese puesto mientras esté libre.
- **El acta es pública** para quien conozca el id de la sala. No contiene valores reservados (comprobado en las pruebas).
- **Bitácora con tope.** Guarda hasta 2000 eventos (las decisiones nunca se descartan); por SSE viajan los últimos 80.
- **Cada mensaje lleva la sala completa.** Con el contador corriendo, el servidor proyecta la sala una vez por segundo por cada conexión. Funcionó con 500 conexiones en la prueba local; no se midió en el deploy.
- **La capa entre organizaciones usa escenarios fijos.** Hay tres (hospitales, construcción, logística), todos de dos organizaciones. La mutación por frase solo existe en `single_org`. Una organización tiene como máximo 3 roles.
- **Los canales externos del Comité solo existen en salas entre organizaciones** y su sesión vive 30 minutos en memoria. Las rutas del webhook y de las herramientas de voz no tienen límite de peticiones propio: las protege la firma HMAC y el secreto compartido.
- **El tachado de valores reservados no detecta paráfrasis.** `redactReserved` atrapa "2400000" y "2.400.000", no "2,4 millones". Solo afecta a valores que el propio rol ya ve.
- **Inyección de instrucciones.** La frase de la mutación y el pedido al agente se limpian (`sanitizeDescription`, `plain`: una línea, sin `<` ni `>`) y van dentro de etiquetas marcadas como datos; el genoma se rechaza si trae HTML o código (`findMarkup`). Reduce el riesgo, no lo elimina. Aun así, el modelo no decide nada: lo peor que puede hacer es redactar una propuesta mala o un genoma que el esquema rechaza.
- **El desempate `geographic` es una aproximación:** el esquema no tiene datos geográficos y usa la necesidad sin cubrir.
- **El plazo del agente incluye la espera en cola.** `AGENT_TIMEOUT_MS` (12 s) cuenta desde que se pide el turno. Con la cola llena (2 llamadas a la vez con Claude), un turno puede caer al respaldo sin haber llegado al modelo.
- **Orden de llegada, sin versión.** Las acciones no llevan la versión de la sala que vio quien actúa: gana la primera que llega. Las decisiones definitivas (409 `DECISION_SEALED`) evitan que una segunda decisión pise a la primera.
- **`committeeVeto` es declarativo.** `AllocationRuleSchema` lo exige en `true`, pero el motor no lo lee: el veto del Comité árbitro siempre está disponible.
- **El Comité puede vetar en cadena** hasta que quede un solo candidato; al último no lo puede vetar.

## Qué haríamos con una semana más

Nada de esto existe hoy.

- Persistir las salas en una base de datos, para que sobrevivan a un reinicio y se repartan entre varios servidores.
- Cuentas reales por persona en vez de un token por rol.
- Medir el modelo local en el Spark y comparar Claude con un modelo más rápido.
- Validar el flujo y los pesos de la fórmula con personas que asignan camas de verdad, incluido el signo del riesgo por demora.
- Escenarios entre organizaciones generados desde una frase, con el mismo esquema y la misma validación que la mutación de una organización.

## Pruebas

`npm test` corre todas las pruebas sin llamar a ningún modelo ni a ningún servicio externo (más de 350 casos; algunos se generan por semilla con `it.each`, así que hay más casos que bloques `it(` en el código). Las pruebas HTTP tardan unos 20 segundos porque esperan pulsos reales del contador.

| Archivo | Qué garantiza |
| --- | --- |
| `tests/genome.test.ts` | Las semillas pasan sus esquemas; ids sin tilde; roles referenciados existen; en los tres escenarios, el costo de cada candidato es visible solo para su organización y los textos públicos no citan valores secretos |
| `tests/engine.test.ts` | La vista de `hospital_rural` nunca contiene valores de `clinica_andes` (se serializa a JSON y se buscan). 403 dentro de una organización y entre organizaciones. Choque que aparece y desaparece. Compuerta determinista. Asignación reproducible con desempate. p^n. Contador. Acta completa y sin secretos |
| `tests/store.test.ts` | Token por rol, 409 si el rol está ocupado, 401 en las diez acciones que exigen token, las cuatro salas fijas, reinicio que conserva id y claves, y que el agente recibe solo la vista filtrada |
| `tests/security.test.ts` | Clave del QR del Comité (403 sin ella), controles de anfitrión (403 `HOST_ONLY`), salas fijas cerradas en producción, revocación de tokens, límite de peticiones con y sin `TRUST_PROXY`, ensayo automático en los tres escenarios (llega al final, salta el puesto de una persona, se detiene al reiniciar), sala nueva desde una frase con 15 s de plazo, y que ninguna clave aparece en vistas ni acta |
| `tests/supabase.test.ts` | El formulario de acceso y la entrevista degradan sin Supabase o sin tabla (503 o `null`, nunca un error), validan el formulario, no revelan correos repetidos y la clave `service_role` solo viaja al servidor de Supabase |
| `tests/voice-notes.test.ts` | Notas de voz: apagadas sin `NEXO_VOICE_NOTES=1`, se omiten fuera de la ventana de 24 h, el texto sale de la vista del Comité sin costos y sirve para otros escenarios, OGG como nota de voz y MP3 como respaldo, un error no rompe el canal, y el webhook envía el caso al tocar un botón y el acta al sellar |
| `tests/integrations.test.ts` | Los canales del Comité toman el puesto con su clave y el resumen no trae datos reservados; 409 si una persona ya lo tiene; razón obligatoria; botones y mensajes de WhatsApp; firma HMAC del webhook; herramientas de voz sin secreto no responden |
| `src/agents/__tests__/agents.test.ts` | Telemetría local o nube, cola y topes de tokens; la mutación nunca lanza y siempre entrega un genoma válido; el agente de rol solo le muestra al modelo lo que su rol ve |
| `tests/demo.test.ts` | Sala de demo: el sorteo reparte solo 3 asientos, los aprobadores pasan a bots al entrar la primera persona y sellan y firman solos, `role.bot` en la vista, el reloj parte en 0 hasta que entra alguien, «Nueva ronda» y el reinicio solo a los 2 minutos del acta, y que una sala normal no cambia |
| `tests/demo-phone.test.ts` | Celular en la sala de demo: tras «Nueva ronda» o el reinicio automático, el teléfono viejo recibe la vista general y no recupera su silla (fuera de la demo sí), y la pestaña «Sala» avanza por los 4 pasos de la demo |
| `tests/seat.test.ts` | Sorteo de silla (`POST /api/rooms/:id/seat`): nunca entrega una silla ocupada (409 `NO_FREE_SEAT` al llenarse), el Comité solo entra con la clave de su QR, la silla sorteada recibe solo lo que ve ese rol (403 al pedir un dato ajeno) y «sortear otro rol» libera la anterior e invalida su token |
| `tests/stage.test.ts` | Los asientos de la pantalla grande salen del estado proyectado (dos por organización y el Comité), un asiento solo aparece conectado si esa persona entró, el paso «Unirse» dura mientras falta alguien que trabaja el caso, y los candados dicen una o dos palabras |
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
| `LLM_MODEL` | Id del modelo. Si falta, el código usa `claude-opus-5-5` con Claude y `gpt-oss:20b` en local; `.env.example` propone `llama3.2:3b` para probar en un notebook |
| `LLM_BASE_URL`, `LLM_API_KEY` | Solo en local: dónde está Ollama |
| `ANTHROPIC_API_KEY`, `LLM_EFFORT` | Solo con Claude |
| `LLM_MAX_CONCURRENT`, `LLM_NO_THINK_BODY`, `LLM_REASONING_HEADROOM` | Opcionales: cola y control de razonamiento |
| `NEXT_PUBLIC_BASE_URL` | Opcional: dirección pública para los códigos QR cuando la pantalla se abre desde `localhost` |
| `NEXO_DEMO_TURN_MS` | Opcional: plan B de la demo pauteada, en ms (por defecto 20 000; `0` lo apaga) |
| `NEXO_MAX_ROOMS`, `NEXO_ADMIN_KEY` | Opcionales: tope de salas y clave de administración (controles de anfitrión de cualquier sala y de las salas fijas en producción) |
| `TRUST_PROXY`, `NEXO_RATE_LIMITS` | `TRUST_PROXY=1` detrás de un proxy, para limitar por IP del cliente. `NEXO_RATE_LIMITS=off` apaga los límites (solo pruebas de carga locales) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Opcionales: formulario de acceso y entrevistas. La clave `service_role` es solo de servidor |
| `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`, `KAPSO_TEMPLATE_NAME`, `KAPSO_TEMPLATE_LANG` | Opcionales: Comité por WhatsApp (las dos últimas, para enviar con plantilla aprobada) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID` | Opcionales: Comité por voz (el número es el de Twilio vinculado en ElevenLabs) |
| `NEXO_VOICE_NOTES`, `ELEVENLABS_VOICE_ID` | Opcionales: `NEXO_VOICE_NOTES=1` activa las notas de voz informativas por WhatsApp; `ELEVENLABS_VOICE_ID` cambia la voz |
| `NEXO_COMMITTEE_PHONE`, `NEXO_PUBLIC_BASE_URL`, `NEXO_CHANNEL_SECRET` | Opcionales: número del Comité, URL pública para las herramientas de voz y secreto compartido de esas herramientas |

Sin modelo configurado la sala funciona igual: las reglas no dependen de él, y el agente y la mutación responden con su respaldo.

Comprobaciones:

```bash
npm test                                         # todas las pruebas, sin modelo
npm run lint
node scripts/e2e.mjs http://localhost:3000       # recorrido completo por HTTP
node scripts/e2e.mjs http://localhost:3000 --llm # incluye agente y mutación con modelo
node scripts/load-test.mjs http://localhost:3000 200   # solo contra un servidor local
node scripts/stress-llm.mjs http://localhost:3000      # 4 llamadas al modelo a la vez: latencia, respaldo y cola (cuesta llamadas)
```

Para la demo: crear una sala desde la portada (así quien presenta recibe los controles y el QR del Comité con su clave), abrir su pantalla general en la pantalla grande y escanear los códigos QR desde los teléfonos. Para ensayar sin gente, usar el ensayo automático desde la pantalla grande. En desarrollo, las salas fijas (`/stage/demo-cross`, `/stage/demo-construccion`, `/stage/demo-logistica`) también entregan sus controles.
