# Recorrido guiado

Diez archivos, en orden, para entender Nexo sin leer todo el repo. Cada uno trae la función que conviene abrir primero. El detalle completo está en `docs/ARQUITECTURA.md`.

La idea en una línea: un solo estado por sala vive en el servidor, un motor de reglas sin modelo lo cambia, y cada persona recibe por SSE una versión filtrada para su organización y su rol.

## Los diez archivos

| # | Archivo | Por qué importa | Función clave |
| --- | --- | --- | --- |
| 1 | `src/lib/genome/schema.ts` | El contrato de datos. Separa el estado del servidor, que tiene los secretos (`RoomStateSchema`), de lo único que viaja al navegador, sin ellos (`ProjectedRoomStateSchema`). Cada campo declara qué organizaciones y qué roles lo ven | `OrgGenomeSchema` (con sus validaciones de coherencia) |
| 2 | `src/lib/genome/seeds.ts` | Los datos simulados de la demo: la clínica, el hospital rural, una distribuidora y la cama escasa. Se validan al cargar el módulo | `getInitialCrossOrgRoom` |
| 3 | `src/lib/engine/deterministic.ts` (permisos) | Dónde se decide quién ve qué. Es la única salida de estado hacia un cliente: lo que un viewer no puede ver se elimina aquí y no viaja | `projectStateForOrgAndRole`, que usa `canViewField` y `canViewCoverageCost` |
| 4 | `src/lib/engine/deterministic.ts` (reglas) | Las reglas, todas sin modelo y como funciones puras: choque de autoridad, compuerta, asignación con desempate de equidad, decisión del Comité, contador y acta | `resolveAllocation` y `recordCommitteeDecision` |
| 5 | `src/lib/store/actions.ts` | Las 11 acciones que acepta el servidor, con su forma exacta y sus códigos de error | `ActionSchema` |
| 6 | `src/lib/store/rooms.ts` | El almacén: salas en memoria, token por rol, salas fijas `demo` y `demo-cross`, topes de memoria y aviso de cambios. No decide reglas: valida, comprueba la identidad y delega en el motor | `applyAction` (y `resolveViewer` para el token) |
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

## Si tienes más tiempo

| Archivo | Para qué |
| --- | --- |
| `src/agents/mutate-genome.ts` (`mutateGenomeFromPrompt`) | Cómo una frase se convierte en una organización: el modelo escribe el contenido, `normalizeGenome` fija la estructura y el esquema decide si entra |
| `src/lib/client/use-room.ts` (`useRoom`) | El único lugar de la interfaz que habla con la API: abre el SSE, guarda el token y envía acciones |
| `src/app/room/[roomId]/room-client.tsx` y `src/app/stage/[roomId]/stage-client.tsx` | La estación de un rol y la pantalla para proyectar |
| `src/components/organs/` | Los siete órganos de interfaz. Dibujan el estado proyectado; no calculan ni ocultan nada |
| `scripts/e2e.mjs` | Prueba de punta a punta por HTTP: varios participantes independientes, cada uno con su SSE, recorren las dos salas |
| `docs/DECISIONES.md` | Por qué se eligió cada cosa y qué se descartó |
| `docs/PREGUNTAS.md` | Preguntas probables del jurado con respuestas cortas |
