# Recorrido guiado

Diez archivos, en orden, para entender Sculptor sin leer todo el repo. Cada uno trae la función que conviene abrir primero. El detalle completo está en `docs/ARQUITECTURA.md`.

La idea en una línea: un solo estado por sala vive en el servidor, un motor de reglas sin modelo lo cambia, y cada persona recibe por SSE una versión filtrada para su organización y su rol.

## Los diez archivos

| # | Archivo | Por qué importa | Función clave |
| --- | --- | --- | --- |
| 1 | `src/lib/genome/schema.ts` | El contrato de datos. Separa el estado del servidor, que tiene los secretos (`RoomStateSchema`), de lo único que viaja al navegador, sin ellos (`ProjectedRoomStateSchema`). Cada campo declara qué organizaciones y qué roles lo ven | `OrgGenomeSchema` (con sus validaciones de coherencia) |
| 2 | `src/lib/genome/seeds.ts` | Los datos simulados de la demo: tres escenarios entre organizaciones (hospitales y una cama, constructoras y una grúa, distribuidoras y un camión) y una distribuidora suelta. Se validan al cargar el módulo | `getInitialCrossOrgRoom` |
| 3 | `src/lib/engine/deterministic.ts` (permisos) | Dónde se decide quién ve qué. Es la única salida de estado hacia un cliente: lo que un viewer no puede ver se elimina aquí y no viaja | `projectStateForOrgAndRole`, que usa `canViewField` y `canViewCoverageCost` |
| 4 | `src/lib/engine/deterministic.ts` (reglas) | Las reglas, todas sin modelo y como funciones puras: choque de autoridad, compuerta, asignación con desempate de equidad, decisión del Comité, contador y acta | `resolveAllocation` y `recordCommitteeDecision` |
| 5 | `src/lib/store/actions.ts` | Las 12 acciones que acepta el servidor, con su forma exacta y sus códigos de error | `ActionSchema` |
| 6 | `src/lib/store/rooms.ts` | El almacén: salas en memoria, token por rol, token de anfitrión y clave del Comité, salas fijas (`demo`, `demo-cross`, `demo-construccion`, `demo-logistica`), reinicio, ensayo automático, topes de memoria y aviso de cambios. No decide reglas: valida, comprueba la identidad y delega en el motor | `applyAction` (y `resolveViewer` para el token, `startAutopilot` para el ensayo) |
| 7 | `src/app/api/rooms/[roomId]/events/route.ts` | El tiempo real. Cada conexión SSE vuelve a resolver quién mira y envía su propia versión de la sala en cada cambio, y una vez por segundo mientras el contador corre | `GET` (su función interna `send`) |
| 8 | `src/agents/role-agent.ts` | El agente de cada rol. Recibe la misma vista filtrada que el navegador de esa persona, así que hereda sus permisos. Propone; no decide | `runRoleAgentTurn` |
| 9 | `src/lib/llm.ts` | La única puerta a un modelo: Claude o un modelo local, cola de llamadas, JSON validado y telemetría que dice si el modelo es local o de nube | `chatJson` y `getTelemetry` |
| 10 | `tests/engine.test.ts` | La evidencia. Serializa la vista de cada viewer a JSON y busca los valores secretos de la otra organización; comprueba 403, choque, compuerta, asignación, p^n, contador y acta | El bloque `describe("projectStateForOrgAndRole: lo reservado no sale del servidor")` |

## Cómo se conectan

```
navegador ── POST /action ──▶ applyAction (rooms.ts)
                                 │  ActionSchema, token
                                 ▼
                         motor (deterministic.ts) ── devuelve estado nuevo
                                 │
                              emit()
                                 ▼
             cada conexión SSE (events/route.ts)
                 projectStateForOrgAndRole(estado, su viewer)
                                 ▼
navegador ◀── data: ProjectedRoomState (sin los datos que no le corresponden)
```

El agente de rol entra por la misma puerta: `RUN_ROLE_AGENT` llega a `applyAction`, que le pasa a `runRoleAgentTurn` la vista filtrada del rol. Lo que vuelve del modelo lo aplica el motor con `applyAgentProposal`, que solo puede cambiar el valor propuesto del caso.

La negociación entre agentes de la demo sigue el mismo camino: `SET_POSITION` entra por `applyAction`, las reglas están en `src/lib/engine/negotiation.ts` (puras, sin modelo), el texto lo redacta `src/agents/negotiation-agent.ts` y los tiempos, el respaldo de 6 s y el filtro de datos reservados están en `writeNegotiationText` y las funciones vecinas de `src/lib/store/rooms.ts`. La prueba es `tests/negotiation.test.ts`.

## Si tienes más tiempo

| Archivo | Para qué |
| --- | --- |
| `src/agents/mutate-genome.ts` (`mutateGenomeFromPrompt`) | Cómo una frase se convierte en una organización: el modelo escribe el contenido, `normalizeGenome` fija la estructura y el esquema decide si entra |
| `src/lib/client/use-room.ts` (`useRoom`) | El único lugar de la interfaz que habla con la API: abre el SSE, guarda el token y envía acciones |
| `src/app/room/[roomId]/room-client.tsx` y `src/components/seat/` | La silla de cada rol en el celular: en las salas normales, revelación «Te tocó», turno, secretos y sala; en las de demo, `demo-view.tsx` («Eres la Clínica», un botón cuando toca, «Espera: le toca al…») |
| `src/app/stage/[roomId]/stage-client.tsx` y `src/components/stage/` | La pantalla para proyectar |
| `src/components/organs/` | Piezas que quedan de la primera versión (grafo vivo, choque de autoridad, medidor p^n, telemetría). Dibujan el estado proyectado; no calculan ni ocultan nada |
| `scripts/e2e.mjs` | Prueba de punta a punta por HTTP: varios participantes independientes, cada uno con su SSE, recorren las salas de una y de dos organizaciones, un escenario de construcción ensayado con el piloto automático y una sala creada desde una frase, el sorteo de silla, la sala de demo con 3 personas sin clave y el plan B |
| `src/lib/store/rooms.ts` (sala de demo) | `joinRandomSeat` (sorteo y orden de llegada), `startDemoBots` (bots administrativos), `syncDemoTurn` y `playTurnAutomatically` (turno y plan B), `canResetWithoutHost` («Nueva ronda» sin token) |
| `src/lib/engine/autopilot.ts` | El ensayo automático: el guion de la demo como datos, con las mismas funciones del motor |
| `src/lib/store/rate-limit.ts`, `src/lib/store/host.ts` | Límite de peticiones por cliente y controles de anfitrión |
| `src/integrations/committee-channel.ts` | Cómo el Comité decide por WhatsApp o por voz con las mismas acciones que la web |
| `src/app/sculptor/page.tsx` y `src/components/sculptor/` | La landing del protocolo (`/sculptor`). Sus cifras de confiabilidad y del ejemplo las calcula el motor en `data.ts`; los textos viven en `content.ts` |
| `docs/dossier/` | El dossier del producto en PDF y su fe de erratas contra el código (`docs/dossier/README.md`) |
| `docs/DECISIONES.md` | Por qué se eligió cada cosa y qué se descartó |
| `docs/PREGUNTAS.md` | Preguntas probables del jurado con respuestas cortas |
