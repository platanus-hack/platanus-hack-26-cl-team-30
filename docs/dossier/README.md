# Dossier de Sculptor

[`SCULPTOR_Dossier_Completo_Platanus_Hack_26.pdf`](SCULPTOR_Dossier_Completo_Platanus_Hack_26.pdf): el dossier del producto escrito por el equipo durante la hackathon (identidad, principios, arquitectura, guion del pitch y respuestas al jurado).

El PDF se escribió antes de varias rondas de cambios. Donde no coincide con el código, **vale el código** y la documentación de `docs/`. Esta tabla lista las diferencias revisadas el 21 de noviembre de 2026 por la noche, con el código de la ronda 20.

## Fe de erratas

| El dossier dice | Lo que hay en el repo |
| --- | --- |
| Rutas `/brief`, `/allocate`, `/agent`, `/join`, `/state` y `/stream` | No existen. El SSE es `GET /api/rooms/:id/events`; unirse, presentar un caso y decidir pasan por `POST /action`. También hay `/seat`, `/acta`, `/autopilot`, `/committee`, `/host`, `/negotiation`, `/revoke` y `/mutate` (`src/app/api/rooms/[roomId]/`) |
| Acciones `slider`, `gate`, `consensus`, `mode` y `reset` | Las 11 acciones están en `src/lib/store/actions.ts` (`JOIN_ROLE`, `UPDATE_AUTHORITY_SLIDER`, `SEAL_RULE`, `SUBMIT_CANDIDATE`, `ALLOCATION_SEAL`, `COMMITTEE_VETO`, etc.) |
| 7 órganos (`DynamicCaseCardOrgan`, `FogOfWarPanelOrgan`, …) | Quedan `LivingGraphOrgan`, `AllocationConflictOrgan` y `TelemetryReadout` en `src/components/organs/`. El resto se reemplazó por la silla del celular (`src/components/seat/`) y la pantalla grande (`src/components/stage/`) |
| Gesto de deslizar arriba o abajo (`SwipeDecisionCard`), `CrossStagePitch` y `preparePitchDemoCross` | No existen. El celular usa botones; en las salas de demo el Comité acepta con la razón precargada (`src/components/seat/demo-view.tsx`) |
| La sala `demo-cross` arranca con los candidatos ya presentados y dos 403 registrados | La sala fija arranca limpia desde la semilla |
| 10 jugadores (5 sillas × 2 copilotos) | La demo de la ronda 20 es de 5 personas, una por silla: un rol ocupado responde 409 `ROLE_TAKEN` |
| El QR del Comité es `/room/demo-cross?org=comite_red&role=role_c` | En las salas de demo hay un QR único que reparte las sillas por orden de llegada, incluido el Comité. Fuera de la demo, sin la clave del Comité el servidor responde 403 |
| `computeChainReliability`, `resolveAllocationTie`, `buildAllocationExportMarkdown` y `sanitizePublicBriefing` | Se llaman `computeReliabilityPn` / `computeCrossOrgReliabilityPn`, `resolveAllocation`, `buildAuditActa` + `renderActaMarkdown`, y `redactReserved` / `limitWords` |
| `frozenElapsedSeconds` y `startedAtMs` | El reloj usa `caseOpenedAt`, `elapsedMs` y `timeToDecisionMs` |
| Agente en modo rápido y profundo, propuesta de menos de 80 palabras validada por Zod | No hay modos. La instrucción pide 45 palabras y el código corta en 79 (`limitWords`), sin Zod |
| 43,4 % → 96,1 % y 12,3 % → 89,4 % | Correcto, y lo calcula el motor. Entre organizaciones sale de p = 0,92 en 10 pasos y p = 0,90 en 12 pasos (no p = 0,91), y sube al sellar la asignación, no con el veto. No existe el «91 % al sellar el consenso» |
| El desempate por equidad propone al Hospital Rural (puntajes 0,52 y 0,53) | El desempate se aplica (0,53 contra 0,52, diferencia menor que ε = 0,02), pero el Hospital Rural ya iba primero por puntaje: la equidad lo confirma, no lo da vuelta (`docs/PREGUNTAS.md`) |
| 216 tests, 97/97 pasos E2E y p50 de 13,8 ms con 30 a 60 SSE | Hoy son 507 pruebas. El 97/97 fue contra una versión anterior del deploy, y las latencias medidas son las de `docs/MEDICIONES.md` (por ejemplo, 500 conexiones con p95 de 51,5 ms en un notebook) |
| 60.000 estrellas a 60 FPS | Es la simulación del pitch (`docs/diseno/nahum/resultado_orbital_live.html`), no la app. Lo medido son 60 FPS en la pantalla grande con un M4 |
| «Nunca devuelve HTTP 500» | Sin verificar. Hay respaldos sin modelo, pero no una garantía en todas las rutas |
| Archivos en `Downloads/` | El guion, el deck interactivo, el prototipo móvil y la simulación orbital están en `docs/diseno/nahum/`. Son prototipos del pitch, no parte de la app |
