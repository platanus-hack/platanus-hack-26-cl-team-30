# Preguntas del bot de los jueces (ensayo del 22 de noviembre)

Ensayo para la ronda de preguntas. Tres revisores sin contexto leyeron la rama `main` (commit `4a06eab`), cada uno con un rol: **T** (juez técnico: arquitectura y seguridad), **IA** (juez de IA: qué hace el modelo y qué es real) y **E** (juez escéptico: afirmaciones de README y docs que el código no respalde). Cada uno escribió sus 10 preguntas más difíciles. Cada respuesta de abajo se verificó leyendo el código, no los docs.

Las 30 preguntas se reducen a **20 temas**, porque varios jueces llegaron a lo mismo por caminos distintos. Al lado de cada tema dice qué preguntas lo cubren (por ejemplo, IA-1). Están agrupadas por tema y ordenadas por probabilidad: primero lo que el bot va a preguntar casi seguro.

**⚠️** = la respuesta es incómoda. Debajo va cómo decirla con honestidad. Regla general: el bot ya leyó el código. Negar algo que está en el código cuesta más que admitirlo y explicar por qué se hizo así.

## Antes de presentar (recomendaciones)

1. **Medir cuántas frases escribe Claude.** Correr `node scripts/e2e.mjs https://team-30-platanus-hack.onrender.com --llm` y anotar la línea «N de 4 con texto de respaldo». Sin eso, la respuesta a la pregunta 2 es «no lo medimos».
2. **Descargar el acta de la demo en vivo** (`/api/rooms/<código>/acta?format=md`) antes de que la sala se reinicie (2 minutos después de sellar). Ahí se ve qué mensajes fueron respaldo.
3. **No decir:** «de la negociación sale la decisión», «ningún agente cambia el estado», «el modelo nunca decide quién ve qué», «validado con usuarios», «en el mismo segundo» (en Render se midieron hasta 3 s).
4. **Sí decir, con cifras medidas** (`docs/MEDICIONES.md`): 516 pruebas sin modelo en 17 archivos; 142 de 142 pasos del recorrido contra el deploy; Comité por WhatsApp probado en vivo contra Kapso, 103 s de punta a punta.

## Índice de las 30 preguntas

| Juez | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IA | 1 | 2 | 3 | 12 | 11 | 14 | 10 | 13 | 4 | 7 |
| T | 5 | 8 | 18 | 1 y 2 | 13 | 17 | 10 | 19 | 16 | 20 |
| E | 1 | 6 | 11 | 8 | 2 | 5 | 9 | 7 | 15 | 14 |

Cada celda es el número de tema de este documento. Ejemplo: la pregunta 4 del juez de IA se responde en el tema 12.

---

## A. La IA y la negociación entre agentes

### 1. ¿La negociación cambia quién recibe la cama? ⚠️ · IA-1, T-4, E-1

> «Si borro el debate y las llamadas a Claude, ¿qué cambia en la propuesta? Si las cuatro personas eligen la postura contraria, ¿cambia el ganador?»

**Respuesta (20 s):** No cambia el ganador, y es a propósito. La propuesta la calcula una regla fija con puntajes públicos; las posturas y el debate cambian lo que dicen los agentes, no el puntaje. Lo que sí decide una persona es el final: el Comité acepta o rechaza, y rechazar le da la cama al otro hospital. La IA conversa y el código decide, para que la asignación sea reproducible y se pueda auditar.

**Respaldo:** `src/lib/store/rooms.ts` → `proposalTick` (presenta los casos sin mirar posturas). `src/lib/engine/negotiation.ts` → `positionOptions` (comentario: «no cambia el puntaje») y `proposalLine`. `src/lib/engine/deterministic.ts` → `resolveAllocation`. Con las semillas, el ganador está fijado de antemano (0,52 contra 0,53, desempata la necesidad sin cubrir; `src/lib/genome/seeds.ts`).

**Cómo decirlo:** no defender que «negocian» en el sentido de que llegan a un acuerdo. Si el bot cita `src/integrations/guide-status.ts` («la regla calculó una propuesta con el resultado del debate»), admitir que ese texto está mal.

### 2. ¿Cuántas frases de la demo escribió Claude? ⚠️ · IA-2, T-4, E-5

> «En la demo que vimos, ¿cuántos consejos y argumentos fueron del modelo y cuántos texto fijo? ¿Hay una sola corrida registrada con Claude escribiendo el debate?»

**Respuesta (20 s):** No lo tenemos medido. Cada frase tiene 6 segundos, cola incluida; si el modelo no llega, se publica un texto de respaldo escrito por nosotros, marcado `fallback: true`. La pantalla no los distingue, pero el acta sí: cada mensaje de respaldo dice «(texto de respaldo)». Las corridas registradas en el repo fueron sin modelo. Si quieren, abrimos el acta de esta demo ahora.

**Respaldo:** `src/lib/store/rooms.ts` → `writeNegotiationText` (plazo de 6 s, respaldo) y `getActa` (marca en el acta). `src/lib/llm.ts` → `acquireSlot` (2 llamadas a la vez con Claude). `docs/MEDICIONES.md`, sección «Negociación entre agentes»: medida «sin modelo configurado». Los «5 novatos» de `docs/QA_DEMO.md` son 5 navegadores de Playwright, no personas.

**Cómo decirlo:** si se corrió el paso 1 de «Antes de presentar», dar la cifra. Si no, «no lo medimos» y ofrecer el acta.

### 3. ¿Qué es un «agente» en Sculptor? ⚠️ · IA-3

> «Dicen "cinco personas, cinco agentes". ¿Cuántos llaman a un modelo y qué aporta el modelo si la recomendación ya la calculó el código?»

**Respuesta (20 s):** Cuatro llaman al modelo, uno por cada silla de hospital. Cada agente es una llamada con la vista ya filtrada de su rol y redacta una frase: el consejo privado al celular y el argumento público. No tiene herramientas ni memoria, y no decide. La postura que recomienda la calcula el código con lo que ese rol ve; el modelo la explica en palabras simples. El del Comité es un texto armado por código.

**Respaldo:** `src/agents/negotiation-agent.ts` → `writeNegotiationLine` (una llamada a `chatJson`). `src/lib/engine/negotiation.ts` → `positionPrompt` (la recomendación y su razón). `src/components/seat/agent-text.ts` → `committeeBrief` y `AGENT_INTRO` (textos fijos, sin modelo). `src/lib/store/rooms.ts` → `onNegotiationJoin` (consejo fijo del Comité).

**Cómo decirlo:** «agente» aquí significa un redactor por rol que hereda los permisos de su rol, no un sistema autónomo. La frase «ahora me conecto con los agentes de los demás» es un texto de la interfaz: no hay conexión entre agentes.

### 4. ¿Cómo evaluaron el modelo? ¿Por qué Opus? ⚠️ · IA-9

> «De las 516 pruebas, ¿cuántas usan un modelo real? ¿Tasa de genomas válidos, latencia p95, costo por demo? ¿Por qué Opus 5.5 para una frase de 18 palabras?»

**Respuesta (20 s):** Ninguna prueba llama a un modelo real: corren con dobles, a propósito, para que sean reproducibles y gratis. No hicimos evaluaciones de calidad. Lo que sí probamos es que una salida mala no rompe nada: esquema Zod, filtro de datos reservados, plazo y respaldo. Opus es el valor por defecto y no lo comparamos con uno más chico; cambiarlo es una variable de entorno.

**Respaldo:** `tests/negotiation.test.ts` y otros (`vi.mock("../src/agents")`). `src/agents/__tests__/agents.test.ts` (servidor OpenAI simulado). `src/lib/llm.ts` → `anthropicParams`: en Opus el razonamiento no se apaga, así que el tope real es 140 + 1024 tokens; `thinking: false` fuerza esfuerzo `low` aunque `render.yaml` diga `medium`. Única latencia registrada: unos 10 s por mutación, una corrida sin salida guardada (`docs/MEDICIONES.md`).

**Cómo decirlo:** separar con claridad «pruebas del sistema» (516, sin modelo) de «evaluación del modelo» (no hay).

## B. Permisos e identidad

### 5. ¿Qué impide que una persona tome las sillas de los dos hospitales? ⚠️ · T-1, E-6

> «Desde otra pestaña, ¿qué me impide sentarme en Administración de la Clínica y leer sus 2.400.000? ¿Qué ata a una persona a una organización?»

**Respuesta (20 s):** Hoy, nada. No hay cuentas: la identidad es un token por silla, y con el código de la sala cualquiera puede sentarse en una silla libre de cualquier organización, también en dos. Lo que garantizamos es otra cosa: cada silla recibe solo lo de su rol, filtrado en el servidor, y lo comprobamos buscando los valores en el tráfico de cada viewer. Atar personas a organizaciones necesita cuentas; es lo primero que haríamos.

**Respaldo:** `src/lib/store/rooms.ts` → `join` (solo el Comité exige clave), `joinRandomSeat` (no identifica al cliente). `src/lib/engine/deterministic.ts` → `projectStateForOrgAndRole`, `canViewCoverageCost`. `tests/engine.test.ts` (busca valores ajenos en el JSON de cada vista).

**Cómo decirlo:** «el permiso protege la silla, no a la persona». Es la limitación más importante del sistema; mejor decirla primero.

### 6. ¿Qué dato reservado entra en la fórmula? ⚠️ · E-2

> «Dicen que nadie puede decidir solo porque cada hospital tiene un dato que el otro no ve. ¿Qué dato reservado usa la regla?»

**Respuesta (20 s):** Ninguno, en las tres semillas. La regla usa gravedad, urgencia, riesgo por demora y necesidad sin cubrir, que son públicos. El costo reservado solo entraría con el desempate `coverage_gap`, que el motor tiene y ninguna semilla usa; en ese caso se compara dentro del servidor y hacia afuera sale solo el orden. Hoy el sistema protege que el costo no se vea, no lo usa para decidir.

**Respaldo:** `src/lib/engine/deterministic.ts` → `computeTriageScore`, `tieBreakKey`. `src/lib/genome/seeds.ts` → `equityTieBreak: "worst_unmet_need"` en los tres escenarios.

**Cómo decirlo:** admitirlo sin rodeos. Se puede agregar que el motor ya soporta usar el costo sin revelarlo (`coverage_gap`), pero no presentarlo como lo que se ve en la demo.

### 7. ¿El «403 registrado» es real? · IA-10, E-8

> «Si pido el SSE del otro hospital con mi token, ¿hay 403 en la bitácora? ¿Los intentos de ver datos ajenos los hizo alguien?»

**Respuesta (20 s):** El filtro es real: el dato oculto no viaja. El 403 queda registrado cuando una silla pide un dato ajeno con el botón «Ver» y cuando el agente de rol declara un dato que le falta, porque su instrucción se lo pide para mostrar el control. Si alguien pide el SSE con un token ajeno, recibe la vista general sin el dato: no hay 403 ni registro, pero tampoco hay fuga.

**Respaldo:** `src/lib/engine/deterministic.ts` → `attemptProtectedRead`, `applyAgentProposal`. `src/agents/role-agent.ts` → `buildInstruction` (pide nombrar un dato oculto). `src/lib/store/rooms.ts` → `resolveViewer` (token inválido → vista `stage`). El botón «Ver» no está en las salas de demo.

**Cómo decirlo:** los 403 del agente son una demostración inducida por diseño, y ya está escrito así en `docs/ARQUITECTURA.md`. El «92 % de acierto» de la portada es un ejemplo ilustrativo, no una medición.

## C. «Nada se mueve sin una persona»

### 8. ¿Qué se mueve sin una persona en la demo? ⚠️ · T-2, E-4

> «Si hago POST a /start sin clave y nadie entra, ¿qué pasa? ¿Quién firma si el Comité no toca en 20 s? ¿Quién presenta el caso de la Clínica en la negociación?»

**Respuesta (20 s):** En las salas de demo hay excepciones documentadas: «Iniciar» sin clave sienta bots en las sillas vacías, el plan B juega el turno de quien no actúa en 20 s y el temporizador presenta los casos. Las decisiones automáticas van con `automatic: true` y en una sección aparte del acta. Sin ninguna persona, la ronda llega al turno del Comité y se detiene: el plan B solo corre si entró alguien. Fuera de la demo, nada se mueve sin una persona.

**Respaldo:** `src/lib/store/rooms.ts` → `startDemo`, `playTurnAutomatically`, `proposalTick`. `src/lib/engine/deterministic.ts` → `demoTurn` (exige `clockStartedAt`, que solo pone una persona) y `renderActaMarkdown` («Decisiones automáticas»). `docs/DECISIONES.md`.

**Cómo decirlo:** admitir la excepción no marcada. Cuando la persona eligió su postura, el temporizador presenta su caso a su nombre, con `{ via: "negociación" }` y sin `automatic`, aunque haya elegido «Ceder». No es una decisión (la propuesta y el sello siguen aparte), pero la bitácora se lo atribuye a ese rol.

### 9. ¿El Comité decide de verdad en la demo? ⚠️ · E-7

> «¿El Comité puede escribir su razón? ¿Qué le recomienda su agente? ¿Qué pasa si no hace nada?»

**Respuesta (20 s):** En la sala de demo el Comité elige con un toque entre cuatro razones escritas y su «agente», que es texto armado por código, le recomienda aceptar. Lo diseñamos así para que una persona del público decida en un toque. El motor exige razón y el acta guarda quién decidió, cuándo y por qué. Si no toca en 20 s, se acepta solo y queda marcado como automático. En una sala normal la razón se escribe libre.

**Respaldo:** `src/components/seat/demo-view.tsx` → `DEMO_REASONS`. `src/components/seat/agent-text.ts` → `committeeBrief`. `src/lib/engine/deterministic.ts` → `recordCommitteeDecision` (`REASON_REQUIRED`). `src/components/seat/reason-field.tsx` (razón editable en salas normales).

**Cómo decirlo:** la demo prioriza que alguien sin contexto decida en segundos; el poder de decidir está, la deliberación está simplificada.

### 10. Por voz, ¿quién sella: la persona o el modelo de ElevenLabs? ⚠️ · IA-7, T-7

> «Por el canal de voz, un modelo que ustedes no eligen llama a `registrar_decision`. ¿Qué verifica el servidor, no el prompt, para saber que una persona lo dijo?»

**Respuesta (20 s):** Solo un secreto compartido. La confirmación en voz alta es una instrucción del prompt del agente de ElevenLabs, no un control del servidor. Por eso no lo usamos en la demo: la conversación por voz y la llamada no se probaron en vivo. El canal probado en vivo es WhatsApp, donde la persona toca un botón y escribe la razón. En voz, la razón obligatoria la exige igual el motor.

**Respaldo:** `src/app/api/integrations/voice/tool/route.ts` → `authorized` (secreto en `x-nexo-secret`). `src/integrations/committee-channel.ts` → `decideAsCommittee`, `getOnlyVoiceSession` (si no llega el id, usa la única sesión de voz de todo el servidor). `src/integrations/elevenlabs.ts` → `PROMPT` (pasos 5 y 6). El modelo de conversación lo pone ElevenLabs: el código no lo fija.

**Cómo decirlo:** es la excepción documentada a la capa de modelos; presentarlo como canal experimental. Además, la herramienta de la guía (solo lectura) usa el mismo secreto que la que sella.

## D. Qué decide el modelo

### 11. En una organización generada, ¿quién escribe los permisos? ⚠️ · IA-5, E-3

> «En una sala creada desde una frase, ¿quién decide qué rol ve cada dato y los umbrales: el código o Claude? ¿Dónde escribo esa frase en la app?»

**Respuesta (20 s):** El modelo propone quién ve cada dato, los límites y el valor de p. El código fija ids, roles, colores y rangos, acota lo demás, lo valida con Zod y rechaza HTML o secretos citados; los permisos los aplica el motor. Así que «el modelo nunca decide quién ve qué» vale para las semillas, no para la mutación. Hoy la mutación solo se llama por la API, sin botón.

**Respaldo:** `src/agents/mutate-genome.ts` → `normalizeGenome` (usa `visibleToRoleIds` del modelo y deriva la clasificación), `validateGenome`, `findLeakedSecret`, `findMarkup`. `src/app/api/rooms/route.ts` (`description`) y `src/app/api/rooms/[roomId]/mutate/route.ts`. `mutateRoom` de `src/lib/client/use-room.ts` no tiene llamadores.

**Cómo decirlo:** separar «definir» (lo propone el modelo) de «aplicar» (siempre el código). No mostrar los rubros de la portada «desde una frase» como algo que la demo hace en vivo.

### 12. ¿Un número del modelo abre o cierra la compuerta? ⚠️ · IA-4 (y parte de T-3)

> «El proponente no puede escribir su valor: solo pedírselo al modelo. Si Claude devuelve 30 en vez de 60, la compuerta queda abierta sin firma. ¿Quién decidió?»

**Respuesta (20 s):** Sí, y está documentado. El agente del proponente sugiere un número; el motor lo acota al rango de la regla y lo usa como valor propuesto, y eso puede dejar la compuerta abierta o bloqueada. Nunca firma, sella ni veta. La pantalla avisa «Su valor reemplaza tu propuesta». Con más tiempo, la persona confirmaría el número antes de aplicarlo. No está en la demo de cinco personas.

**Respaldo:** `src/lib/engine/deterministic.ts` → `applyAgentProposal`, `evaluateGate`. `src/agents/role-agent.ts` → `fitSuggestedValue`. `src/components/seat/room-view.tsx` (aviso). `docs/ARQUITECTURA.md`, «El agente propone; no decide».

**Cómo decirlo:** no repetir «ningún agente cambia el estado» (lo dice la portada, `src/components/sculptor/content.ts`); el código muestra lo contrario en este caso.

### 13. ¿El filtro impide que un agente diga un dato reservado? ⚠️ · IA-8, T-5

> «¿Por qué el prompt del argumento público incluye el costo propio? ¿Qué pasa si Claude escribe "dos millones y medio" o "Vacunas y sueros"?»

**Respuesta (20 s):** El filtro busca cifras, también escritas como «2,4 millones» o «23 de 50», y si encuentra una publica el respaldo. No atrapa números en palabras ni secretos de texto como «Vacunas y sueros»: ahí la defensa es la instrucción del modelo. Lo correcto sería no mandarle al modelo los valores reservados cuando escribe en público; no lo alcanzamos a hacer. El dato de la otra organización nunca llega al prompt.

**Respaldo:** `src/lib/engine/negotiation.ts` → `containsReserved` (ignora valores con menos de 3 dígitos). `src/agents/negotiation-agent.ts` → `buildUserMessage` (pone los campos visibles del rol marcados «(reservado)»). `tests/negotiation.test.ts` prueba solo costos numéricos. `src/agents/role-agent.ts` → `redactReserved`.

**Cómo decirlo:** distinguir las dos barreras. Entre organizaciones es estructural (el dato no llega al prompt); dentro del propio rol depende del filtro y de la instrucción.

### 14. ¿La telemetría dice la verdad? ⚠️ · IA-6, E-10

> «La pantalla dice "Local: nada sale de la red". ¿De qué dato observado sale? ¿Cuenta lo que mandan a ElevenLabs y WhatsApp? ¿Corrió alguna vez en el Spark?»

**Respuesta (20 s):** Muestra la configuración real, no una cifra fija: si `LLM_BASE_URL` es de una red privada dice local; con Claude dice nube y cuenta los bytes que enviamos al modelo. No cuenta lo que va a ElevenLabs ni a WhatsApp, y el nombre del modelo es el configurado. En el deploy dice nube, que es lo cierto. El modo local está implementado pero no lo verificamos contra el Spark.

**Respaldo:** `src/lib/llm.ts` → `getTelemetry`, `llmEndpoint`, `isLocalHost`, `countSentBytes`. `src/components/organs/telemetry-readout.tsx`. `docs/ARQUITECTURA.md`, «Modelos».

**Cómo decirlo:** «dice la verdad sobre la capa de modelos, no sobre todo el tráfico». No afirmar nada del Spark.

## E. Validación y afirmaciones

### 15. ¿TopSol es una validación? ⚠️ · E-9

> «La lámina 3 dice "Un caso real · TopSol… pudimos organizar todo". Su arquitectura dice que no validaron con usuarios. ¿Cuál es cierta?»

**Actualizado el 22 de noviembre:** la lámina de TopSol se sacó de la presentación (commit `c6578c7`). El bot solo llega a esta pregunta si lee el historial de git o si alguien lo menciona; la respuesta sigue valiendo.

**Respuesta (20 s):** Las dos, cada una a su escala. No validamos el caso de salud ni la decisión entre organizaciones. Lo de TopSol es el testimonio de una empresa que probó el sistema para priorizar su presupuesto anual; los audios no están en el repo y las salas no guardan historial. No lo presentamos como validación del producto, sino como una señal de que el problema existe fuera de salud.

**Respaldo:** commit `c6578c7` (se saca la lámina). `.gitignore` (`/public/presentacion/validacion/`). `docs/ARQUITECTURA.md`, «Qué es real y qué es simulado» (fila «Validación con usuarios»).

**Cómo decirlo:** la barra de la portada decía «Ejemplo real» y enlazaba a `/casos/logistica`, que usa datos simulados. Se corrigió el 22 de noviembre a «Ver un caso» (`src/components/sculptor/chrome.tsx`). Si el bot lo encuentra en el historial, admitir que la etiqueta estaba mal.

## F. Robustez, abuso y acta

### 16. ¿Se puede botar la demo con un script? ⚠️ · T-9

> «Con el código de sala en el proyector, ¿cuántas líneas de curl necesito para que los celulares reciban 503 o 429?»

**Respuesta (20 s):** Pocas, y lo sabemos: los topes protegen el servidor por recurso, no por persona. 200 conexiones anónimas llenan una sala, y si Render no pone la IP real en `X-Forwarded-For`, todos comparten el límite de peticiones. Para la demo usamos una sala con código nuevo, creada en el momento. La defensa de verdad son cuentas y límites por identidad.

**Respaldo:** `src/lib/store/rooms.ts` → `openConnection` (200 por sala, 1000 en total), `sweepRooms`. `src/lib/store/rate-limit.ts` → `clientKey`. `render.yaml` (plan gratis, `TRUST_PROXY=1` sin verificar). La carga de 500 conexiones se midió en un notebook, sin Next y antes del tope (`docs/MEDICIONES.md`).

### 17. ¿El acta es íntegra y duradera? ⚠️ · T-6

> «Si mando 2000 acciones denegadas, ¿sigue en el acta mi primer 403? ¿Dónde está el acta tres minutos después de sellar?»

**Respuesta (20 s):** Las decisiones y su rastro nunca se descartan; los 403 y los cambios de regla sí, al pasar 2000 eventos, y el acta dice cuántos se perdieron. El acta se arma en memoria al pedirla, sin firma, y en la sala de demo se borra con el reinicio dos minutos después de sellar: hay que descargarla antes. Para que sea un registro de verdad faltan persistencia y un encadenamiento con hash.

**Respaldo:** `src/lib/engine/deterministic.ts` → `PROTECTED_AUDIT_TYPES`, `trimAudit`, `buildAuditActa`. `src/lib/store/rooms.ts` → `scheduleDemoReset`, `canResetWithoutHost`.

### 18. ¿La compuerta bloquea algo entre organizaciones? ⚠️ · T-3

> «Con la compuerta de un hospital en BLOCKED_HITL_REQUIRED, ¿qué acción deja de poder ejecutarse? ¿Por qué Urgencias puede sellar sola la regla en modo autónomo?»

**Respuesta (20 s):** Entre organizaciones la compuerta se muestra pero no bloquea la asignación: presentar el caso y la decisión del Comité no la leen. Es la capa de una organización, que en la demo juegan bots. Y el sello de la regla lo puede hacer una sola de las partes, también en modo autónomo. Es un hueco real del motor. En la sala de una clínica sí bloquea, porque ahí la decisión es la firma de la compuerta.

**Respaldo:** `src/lib/engine/deterministic.ts` → `submitCandidate`, `recordCommitteeDecision` (no leen la compuerta), `sealRule` (proponente o aprobador, acepta `gateMode`), `recordGateDecision`.

### 19. ¿El Comité por WhatsApp funciona con varias salas? ⚠️ · T-8

> «El número del Comité es uno para todo el servidor. Si otro crea una sala y dispara el aviso antes, ¿a qué sala va la razón que escribe el Comité?»

**Respuesta (20 s):** El canal está pensado para un Comité y una sala a la vez: un número por servidor, y la razón escrita se aplica a la sesión más reciente de ese número. Así lo probamos en vivo: una sala, 103 segundos desde que se abrió el caso hasta el sello. Para varias salas hay que asociar la razón al mismo id de sesión que ya lleva el botón.

**Respaldo:** `src/integrations/committee-channel.ts` → `getSessionByPhone`. `src/app/api/integrations/kapso/webhook/route.ts`. `src/integrations/kapso.ts` → `verifyWebhook` (firma HMAC). `docs/MEDICIONES.md`, «Canales del Comité contra los servicios reales».

**Cómo decirlo:** además, el canal toma la silla del Comité sin conexión SSE, así que a los 45 s otra persona podría tomarla.

### 20. ¿Hay presupuesto o tope para las llamadas al modelo? ⚠️ · T-10

> «¿Cuántas llamadas a Opus por minuto puede provocar un anónimo, y qué le pasa a la sala que presentan si otra llena la cola?»

**Respuesta (20 s):** Solo la mutación tiene tope global. Los turnos de agente y las frases de la negociación comparten la cola de dos llamadas de todo el servidor, sin largo máximo. Si otra sala la llena, la nuestra publica textos de respaldo y la demo sigue, porque ninguna regla depende del modelo. No hay presupuesto de gasto; es lo siguiente que pondríamos.

**Respaldo:** `src/lib/store/rate-limit.ts` → `GLOBAL_LIMITS` (solo `mutate`). `src/lib/llm.ts` → `acquireSlot`. `src/lib/store/rooms.ts` → `onNegotiationJoin`, `startSpeaker` (una llamada por consejo y por argumento).

---

## Qué se corrigió en los docs durante este ensayo

Solo se tocaron documentos; el código (`src/`) y `CLAUDE.md` quedan iguales.

- `README.md`: Supabase. La portada actual no usa el formulario ni la entrevista.
- `docs/ARQUITECTURA.md`: dos asistentes externos, no uno. Tope real de tokens y esfuerzo `low`. En la mutación, el modelo propone quién ve qué. Límites de la telemetría. Las posturas no cambian el puntaje y la marca de respaldo solo está en el acta. La razón del Comité en la demo. El temporizador presenta los casos sin `automatic`. Qué eventos se pueden descartar de la bitácora. La identidad protege la silla. La compuerta no bloquea entre organizaciones. El filtro no cubre secretos de texto. Sin tope global para agente y negociación. Límites de los canales del Comité. Lo reservado no entra en la regla. TopSol. Render en plan gratis. Notas de voz con `eleven_v3`. Rutas y archivos de prueba que faltaban. 516 pruebas.
- `docs/PREGUNTAS.md`: respuestas 4, 5, 7, 20, 21, 23, 26, 33, 37 y 38, y la lista «Cuidado con estas afirmaciones».
- `docs/MEDICIONES.md`, `docs/RESULTADOS.md` y `docs/DEMO_DIA.md`: 516 pruebas en 17 archivos. Ninguna llama a un modelo real.
- `docs/DECISIONES.md`: Render en plan gratis, no «siempre encendido».
- `docs/PENDIENTES.md`: i4 resuelto (142 de 142), «Nexo» resuelto y una sección nueva con lo que encontró este ensayo.
- `project-description.md`, en un commit aparte: describía la demo vieja de 3 personas y decía «toda decisión la dispara una persona» y «el modelo nunca decide quién puede ver qué».

**Corregido después, el 22 de noviembre:** la portada (`src/components/sculptor/content.ts`) ya no dice «Ningún agente cambia el estado» ni «en el mismo segundo», y la cifra del recorrido pasó de «97/97» a «142/142» (`docs/MEDICIONES.md`); «500 conexiones» sigue, con «en un notebook» al lado. `chrome.tsx` dice «Ver un caso» en vez de «Ejemplo real». El texto de la guía (`src/integrations/guide-status.ts` y `GUIDE_PROMPT`) y `CLAUDE.md` («permisos… sin modelo») se corrigen en la rama `guia-al-dia`.
