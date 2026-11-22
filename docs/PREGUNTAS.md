# Preguntas técnicas del jurado

Guía de preparación para quien responde lo técnico en la presentación. Cada respuesta se puede decir en unos 20 segundos y apunta a un archivo y una función del repo.

Los jueces consultan el repositorio con un agente mientras presentamos y luego preguntan por la estructura de la solución, no por líneas de código. El detalle de cada respuesta está en `docs/ARQUITECTURA.md`; el porqué, en `docs/DECISIONES.md`.

## Arquitectura

**1. ¿Cuáles son los componentes y cómo se comunican?**
Cuatro capas. El contrato de datos en `src/lib/genome/schema.ts`; el motor de reglas, puro y sin modelo, en `src/lib/engine/deterministic.ts`; el almacén en `src/lib/store/rooms.ts`, que guarda las salas en memoria, comprueba el token y llama al motor; y las rutas en `src/app/api/rooms/`. El navegador envía acciones por `POST /action` y recibe la sala por SSE en `/events`; quien llega con el QR único pide antes una silla en `POST /seat` (al azar en las salas normales; por orden de llegada en las de demo: Clínica, Hospital Rural, Comité), que entrega el mismo token que `JOIN_ROLE`. En las salas de demo, cada cambio de estado también actualiza el turno (`syncDemoTurn`). Los agentes, en `src/agents/`, llaman al modelo solo a través de `src/lib/llm.ts`.

**2. ¿Qué pasa desde que un usuario hace algo hasta que otro lo ve?**
El navegador envía `POST /api/rooms/:id/action`. `applyAction` (`src/lib/store/rooms.ts`) valida la forma con `ActionSchema`, comprueba el token y llama a la función del motor, por ejemplo `recordCommitteeDecision`. El motor devuelve un estado nuevo, el almacén avisa con `emit`, y cada conexión SSE abierta proyecta la sala para su viewer con `projectStateForOrgAndRole` y la envía. El paso a paso, con archivos, está en `docs/ARQUITECTURA.md`, sección "Flujo de un dato".

**3. ¿Dónde está la parte difícil del proyecto?**
En `src/lib/engine/deterministic.ts`, en dos funciones. `projectStateForOrgAndRole` arma una versión distinta de la misma sala para cada organización y cada rol, con permiso doble. `resolveAllocation` ordena el recurso escaso de forma reproducible, con desempate de equidad. La dificultad no es que funcione una vez, sino que funcione igual con siete viewers distintos a la vez. Eso lo comprueba `tests/engine.test.ts`.

## Agentes y modelos

**4. ¿Cuántos agentes hay y qué hace cada uno?**
Tres propios y un asistente externo. El agente de negociación (`writeNegotiationLine` en `src/agents/negotiation-agent.ts`) es el de la demo: hay uno por persona; en el celular le explica qué decide y le dice «Te recomiendo X, porque…» (la postura recomendada la calcula el código con lo que ese rol ya ve) y en la pantalla grande la defiende con una frase. El orden, las fases y la propuesta los pone el código, y si el agente tarda más de 6 s o escribe un dato reservado, se publica un texto de respaldo. El agente de rol (`runRoleAgentTurn` en `src/agents/role-agent.ts`) propone el siguiente paso para un rol, con una frase y un valor sugerido. El agente de mutación (`mutateGenomeFromPrompt` en `src/agents/mutate-genome.ts`) convierte una frase como "una cooperativa de agua" en el genoma de una organización. Ninguno cambia la sala por su cuenta. El tercero es el asistente de voz del Comité, un agente de ElevenLabs que solo explica el caso y transcribe la decisión que dicta la persona, por dos herramientas de nuestro servidor (`src/integrations/elevenlabs.ts`). Su modelo corre en ElevenLabs: es la única excepción a la capa de modelos, y está anotada en `docs/DECISIONES.md`.

**5. ¿Qué decide el modelo y qué decide el código?**
El modelo redacta: el texto de una propuesta y el contenido de un genoma. El código decide todo lo demás: quién ve qué (`canViewField`), si hay choque (`detectRuleConflict`), si la compuerta bloquea (`evaluateGate`), quién recibe la cama (`resolveAllocation`), el contador y el acta. Todo eso está en `src/lib/engine/deterministic.ts`, que no importa la capa de modelos. La sala funciona completa sin modelo.

**6. ¿Qué modelo usan, dónde corre y por qué ese?**
El deploy público usa Claude Opus 5.5 por la API de Anthropic, porque un servidor en internet no puede llegar al Spark, que está en la red local de la sede. En local, la misma capa (`src/lib/llm.ts`, `llmConfig`) habla con Ollama en el DGX Spark. Cambiar de uno a otro es cambiar `LLM_PROVIDER` y `LLM_MODEL`. Con Claude, una mutación tarda unos 10 segundos (`docs/MEDICIONES.md`). No comparamos Opus con un modelo más chico: si lo preguntan, decirlo. El modo local está implementado pero no lo hemos verificado contra el Spark ni medido su latencia.

**7. ¿Qué pasa si el modelo se equivoca o inventa algo?**
Tiene poco margen para hacer daño. El agente de rol solo recibe la vista filtrada de su rol, así que no puede revelar lo que no recibió. Su valor sugerido se acota al rango de la regla (`fitSuggestedValue`) y los valores reservados se tachan del texto (`redactReserved`). Si inventa un genoma inválido, o con HTML o código, `OrgGenomeSchema` y `findMarkup` lo rechazan y se usa una semilla. Si no responde, hay un respaldo fijo marcado como tal. Y en ningún caso decide: la decisión es de una persona.

## Tiempo real y colaboración

**8. ¿Cómo funciona la colaboración en tiempo real?**
Con Server-Sent Events (`src/app/api/rooms/[roomId]/events/route.ts`). Cada navegador abre una conexión con su rol y su token. Cuando la sala cambia, el servidor le envía a cada conexión su propia versión filtrada. Mientras el contador corre, envía un mensaje por segundo con el reloj del servidor, así todas las pantallas muestran el mismo tiempo. Las acciones van por `POST` normales.

**9. ¿Qué pasa si dos personas actúan al mismo tiempo sobre lo mismo?**
El servidor las procesa de a una, en orden de llegada. Las funciones del motor son síncronas: reciben un estado y devuelven otro, así que no hay dos escrituras mezcladas. Cada cambio sube `version`. Las decisiones son definitivas: si dos personas deciden la misma compuerta, la segunda recibe 409 `DECISION_SEALED`. Si el agente tarda y el rol cambió de manos mientras tanto (el token vigente ya no es el que pidió el turno), su propuesta se descarta: `runAgent` en `src/lib/store/rooms.ts`.

**10. ¿Con cuántos usuarios simultáneos lo probaron?**
Dos números, y medidos de forma distinta. `scripts/e2e.mjs` corre con seis participantes independientes, cada uno con su propio SSE: cuatro roles de dos hospitales, el Comité y la pantalla general. Con la versión actual pasa 142 de 142 pasos contra el deploy público (22 de noviembre, 01:57), y además `scripts/novato-demo.mjs` jugó la demo con 5 navegadores contra el deploy, a ritmo real, sin fugas. `scripts/load-test.mjs` abrió 500 conexiones SSE simultáneas en un notebook: todos los cambios llegaron a todas, con p95 de 52 milisegundos. Esa carga no la medimos contra el deploy.

## Integraciones y honestidad

**11. ¿Con qué sistemas externos se integra?**
Con Anthropic para el modelo del deploy, Ollama para el modelo local y Render para el hosting. Opcionales: Supabase para el formulario de acceso y las entrevistas de la portada (las salas no usan base de datos), Kapso para que el Comité decida por WhatsApp (con plantilla aprobada si está `KAPSO_TEMPLATE_NAME`) y ElevenLabs con Twilio para que decida por voz (en el navegador, con el SDK `@elevenlabs/client`). Con `NEXO_VOICE_NOTES=1`, ElevenLabs también convierte a voz un resumen del caso y el acta, y Kapso lo envía como nota de voz por WhatsApp (`src/integrations/voice-notes.ts`). Kapso y ElevenLabs se probaron en vivo contra los servicios reales: el Comité decidió por WhatsApp de punta a punta y le llegó la nota de voz del caso (`docs/MEDICIONES.md`). Las pruebas automáticas, en cambio, los reemplazan por dobles para correr sin claves ni costo; la plantilla para escribirle a cualquier número sigue en revisión en Meta; las tablas de Supabase aún no están creadas. No nos conectamos a ningún sistema hospitalario.

**12. ¿Qué es real y qué está simulado en la demo?**
Real: los permisos en el servidor, el tiempo real entre teléfonos, las reglas, la asignación, el acta, la clave del QR del Comité en las salas normales (en las de demo no se pide, a propósito) y el agente con Claude. Simulado: los pacientes, obras, cargas, costos y puntajes, que vienen de `src/lib/genome/seeds.ts`, y las organizaciones, que son ficticias. El ensayo automático, los roles administrativos de la demo y el plan B por tiempo los juega el piloto automático: sus decisiones quedan con `automatic: true` y van en una sección aparte del acta. WhatsApp y las notas de voz se probaron en vivo contra Kapso y ElevenLabs (el Comité aprobó por WhatsApp y quedó en el acta «vía WhatsApp»); la llamada telefónica no, porque depende de un número de Twilio. La confiabilidad p^n es un modelo ilustrativo, no una medición. Y el deploy usa la nube: "cero bytes a la nube" vale solo en modo local. La tabla completa está en `docs/ARQUITECTURA.md`.

**13. ¿Qué se rompería con diez veces más carga?**
Primero, el pulso: cada conexión proyecta la sala completa una vez por segundo mientras el contador corre. En local aguantó 500 conexiones con p95 de 52 milisegundos, pero el deploy es un solo proceso en el plan gratis de Render, y no lo medimos ahí. Hay topes para que no se caiga (200 conexiones por sala, 1000 en total, 200 salas en `src/lib/store/rooms.ts`): pasado eso, el servidor responde 503 en vez de colapsar. Segundo, el estado vive en la memoria de ese proceso: no se reparte entre servidores y se pierde al reiniciar. Tercero, la cola del modelo: una o dos llamadas a la vez.

## Decisiones

**14. ¿Por qué eligieron esta tecnología y no otra?**
SSE y estado en memoria, porque no dependen de ningún servicio externo y funcionan igual en el deploy y en una red local sin internet. Render y no Vercel, porque el tiempo real necesita un proceso siempre vivo. Un genoma JSON validado con Zod y no una interfaz generada, porque un JSON se puede validar antes de que toque la sala. Cada decisión, con su costo, está en `docs/DECISIONES.md`.

**15. ¿Qué harían distinto con una semana más?**
Guardar las salas en una base de datos para que sobrevivan a un reinicio y se repartan entre servidores. Cuentas reales por persona en vez de un token por rol. Medir el modelo local en el Spark. Y, sobre todo, mostrarle el flujo a personas que asignan camas de verdad, para validar los pesos de la fórmula, que hoy son de ejemplo.

## Preguntas del jurado escéptico

Las nueve preguntas de la sección 11 del plan, con lo que hay que mostrar en pantalla además de decir.

**16. ¿A quién ayuda en tres minutos?**
A dos equipos que necesitan la misma cama UCI y no pueden decidir juntos, porque ninguno puede ver los datos del otro. En la demo, dos hospitales presentan a su paciente, el tablero ordena con una regla visible y el Comité decide desde un teléfono. **Mostrar:** la pantalla general de `demo-cross` con el contador corriendo. Los casos son simulados.

**17. ¿Por qué no puede decidir una sola organización?**
Porque cada una tiene un dato que la otra no puede ver: su costo de cobertura. Si decide una sola, decide con la mitad de la información o exige ver lo que no le corresponde. Sculptor ordena los casos sin que ninguna vea el costo de la otra (`canViewCoverageCost` en `src/lib/engine/deterministic.ts`). **Mostrar:** en una sala normal (no de demo), la pestaña «Secretos» del celular: el costo del otro hospital es una barra de franjas, y «Ver» responde «Este dato nunca llegó a tu celular». En la sala de demo los 3 asientos no tienen pestañas; ahí se ve en la pantalla grande, con el candado sobre el costo de cada hospital.

**18. ¿Por qué esta asignación y no la otra?**
Por una fórmula fija que está en pantalla: 0,5 por gravedad, más 0,3 por urgencia, menos 0,2 por riesgo de demora (`computeTriageScore`). En la semilla los puntajes quedan en 0,52 (Paciente A) y 0,53 (Paciente B). La diferencia es menor que el margen de empate (0,02), así que `resolveAllocation` aplica el desempate de equidad: mayor necesidad sin cubrir, 0,9 contra 0,4. Gana B, que también ganaba por puntaje: aquí el desempate confirma, no da vuelta el resultado. Cuando el de mejor puntaje tiene menos necesidad, sí lo da vuelta (lo prueba `tests/engine.test.ts`). Con los mismos datos, siempre el mismo resultado. **Mostrar:** en la pantalla grande, las tarjetas con el puntaje de cada caso y «Pregúntale al caso». En una sala normal, además, el duelo del Comité en su celular con «¿Por qué?»; en la de demo el Comité solo ve «¿Aceptas o rechazas?» y la propuesta.

**19. ¿O es una simulación corriendo sola?**
En las salas normales, no: cada acción exige el token de un rol (`applyAction` en `src/lib/store/rooms.ts`) y los agentes solo corren cuando alguien los pide. El Comité es una persona que escanea su QR (con su clave) y escribe su razón. En las salas de demo hay tres excepciones, todas a la vista y marcadas: los dos roles administrativos los juegan bots (`role.bot`) que sellan el límite y firman; si la persona del turno no actúa en 20 s, el plan B presenta su caso o, si es el Comité, acepta la propuesta de la regla (`playTurnAutomatically`); y el Comité entra sin clave y elige una razón precargada. Esas decisiones quedan con `automatic: true`, con «modo: automático» en la bitácora y en una sección aparte del acta (preguntas 27 y 33). **Mostrar:** el QR del Comité y la bitácora, donde cada evento tiene organización y rol.

**20. ¿Permisos reales o teatro?**
Reales. El dato oculto no viaja: `projectStateForOrgAndRole` lo elimina antes de enviar, y llega como `redacted: true` sin la propiedad `value`. El botón «Ver» de la pestaña «Secretos» (en las salas normales; los asientos de demo no tienen pestañas) devuelve un 403 del servidor que queda en la bitácora (`attemptProtectedRead`). Las pruebas buscan los valores secretos en el tráfico de cada viewer. **Mostrar:** DevTools, pestaña Network, el mensaje SSE de un hospital: el costo del otro no está.

**21. ¿Qué hace el modelo y qué hace su código?**
El modelo redacta propuestas y el contenido de una organización nueva. El código decide permisos, choque, compuerta, asignación, contador y acta, en `src/lib/engine/deterministic.ts`, que no llama a ningún modelo. Todo lo que escribe el modelo pasa por un esquema Zod antes de entrar. **Mostrar:** la sala funcionando con el agente en modo respaldo, o la fórmula del tablero.

**22. ¿Qué le da al Comité el poder de veto?**
La regla, y una obligación: la razón. Solo el Comité árbitro puede vetar o sellar la asignación (`recordCommitteeDecision`, `sealAllocation`); cualquier otro rol recibe 403. Sin razón escrita, 400. La razón queda en la bitácora y en el acta, y la decisión no se puede cambiar después. **Mostrar:** en la sala de demo, «Rechazar» en el celular del Comité (con la razón precargada, que cambia con un toque): con dos candidatos, el recurso va al otro de una vez y el acta lo dice; en una sala normal, «Vetar» con un chip de razón, y el Comité vuelve a decidir sobre el nuevo orden. Luego el cambio en todas las pantallas y el acta en Markdown.

**23. ¿Cuántas llamadas al modelo corren a la vez?**
Las que permita la cola de `src/lib/llm.ts` (`acquireSlot`): una a la vez en local, para no saturar el Spark, y dos con Claude. Las demás esperan en orden. Solo hay dos tipos de llamada, la propuesta del agente y la mutación; todo lo demás es código. **Mostrar:** la telemetría en la pantalla grande (vista Acta) o, en una sala normal, en la pestaña «Sala» del celular («¿Qué recibe y dónde corre?»): proveedor, local o nube, cola, latencia y bytes enviados a la nube.

**24. ¿Qué hace esto que Zapier y Excel no resuelven?**
Tres cosas que un flujo fijo o una planilla compartida no dan juntas: cada participante ve una versión distinta de los mismos datos, filtrada en el servidor por organización y rol; el recurso escaso se ordena con una regla auditable y desempate de equidad; y el veto exige una razón que queda en un acta. Todo en vivo, entre varias personas a la vez.

## Generalidad, seguridad y canales

**25. ¿Esto sirve solo para hospitales?**
No. Los hospitales son el ejemplo principal. El mismo motor corre tres escenarios entre organizaciones sin cambiar código ni depender del modelo: dos hospitales y una cama, dos constructoras y una grúa, dos distribuidoras y un camión (`src/lib/genome/scenarios.ts` y `seeds.ts`, con las mismas pruebas). Y una frase crea una sala nueva de cualquier organización: el modelo escribe el genoma y, si tarda más de 15 segundos o falla, se usa la semilla más parecida. **Mostrar:** la sala fija `demo-construccion`, donde el desempate de equidad le da la grúa a la obra con menor puntaje.

**26. ¿Cualquiera puede entrar como Comité o reiniciar la sala?**
No. Quien crea la sala recibe dos claves que no salen en ninguna vista. El token de anfitrión habilita reiniciar, el ensayo automático, liberar un puesto y avisar al Comité por WhatsApp o voz; sin él, 403. La clave del Comité va dentro de su QR: sin ella, 403 `COMMITTEE_KEY_REQUIRED` y queda en la bitácora (`join` en `src/lib/store/rooms.ts`). El sorteo de silla del QR único (`POST /api/rooms/:id/seat`, `joinRandomSeat`) tampoco es un atajo: sin esa clave el Comité no entra al sorteo, y nunca entrega una silla ocupada (`tests/seat.test.ts`). Además hay límite de peticiones por cliente (`src/lib/store/rate-limit.ts`). Límite honesto: quien tenga una foto del QR puede entrar mientras el puesto esté libre, y un puesto sin señal durante 45 s cuenta como libre. Y en las salas de demo, a propósito, el Comité sale en el sorteo sin clave y «Nueva ronda» no pide token una vez cerrada el acta, para que la demo no se trabe en el deploy (ver `docs/DECISIONES.md`). Ese reinicio, y el automático a los 2 minutos, borran la ronda: hay que descargar el acta antes. Las salas normales mantienen la clave.

**27. ¿El ensayo automático no es justamente una simulación corriendo sola?**
Es para ensayar, no para la demo, y lo dice. Solo lo lanza el anfitrión. Los bots toman los puestos libres y cada paso llama a la misma función del motor que usaría una persona, con las mismas reglas: el intento de leer el costo ajeno también da 403. Todo queda con eventos `AUTOPILOT`; la entrada de cada bot lleva `bot: true` y cada decisión del piloto lleva `automatic: true` (en el estado, en la bitácora y en la sección «Decisiones automáticas» del acta) (`src/lib/engine/autopilot.ts`, `src/lib/engine/deterministic.ts`). Si una persona toma un puesto, su paso se salta. No usa el modelo. En las salas de demo, el mismo piloto juega los dos roles administrativos (límite y firma) y, con el plan B, también el turno de una persona que no actúa en 20 s; sus asientos de bot quedan marcados (`role.bot`) hasta el acta.

**28. ¿El Comité puede decidir sin abrir la web?**
Sí, por WhatsApp o por voz (`src/integrations/`). Por WhatsApp (Kapso) recibe el caso con botones Aprobar y Vetar (como plantilla aprobada si está configurada) y escribe la razón; el webhook verifica una firma HMAC. Por voz, un agente de ElevenLabs lo llama por teléfono vía Twilio, o conversa en el navegador, y usa dos herramientas protegidas por un secreto compartido. Ambos canales usan las mismas acciones que la web (`JOIN_ROLE` con la clave del Comité, `ALLOCATION_SEAL` o `COMMITTEE_VETO` con razón), y el resumen se arma solo con la vista del Comité, así que nunca reciben un dato reservado. Con `NEXO_VOICE_NOTES=1`, además recibe por WhatsApp el caso y el acta en notas de voz, solo informativas y solo dentro de la ventana de 24 h (pregunta 34). Y en la sala de demo, quien hace de Comité en el celular puede tocar «Recibir resumen por WhatsApp»: se abre WhatsApp con «Hola, soy el Comité de la sala <código>», y al decidir le llega el acta (`src/integrations/committee-summary.ts`). En las pruebas automáticas Kapso y ElevenLabs se reemplazan por dobles; además se probaron en vivo el 21 de noviembre: el caso llegó con los botones, el Comité tocó Aprobar, escribió su razón y el acta quedó «vía WhatsApp» en 103 s, y llegó la nota de voz del caso (`docs/MEDICIONES.md`). Falta la plantilla (en revisión en Meta) y la llamada telefónica (sin Twilio).

**29. ¿Dónde guardan datos de personas?**
Solo las solicitudes de acceso y las entrevistas de la portada, en Supabase, escritas por el servidor con la clave `service_role` (que nunca llega al navegador) en tablas con RLS sin políticas (`supabase/migrations/`). Si Supabase no está, la portada sigue y el formulario dice que por ahora no puede guardar. Las salas no se guardan en ninguna base: viven en memoria.

**30. ¿La galaxia de la pantalla grande muestra datos reales o es una animación?**
Datos reales, dibujados. `stageSeats` (`src/components/stage/seats.ts`) lee del estado que llega por el SSE qué roles están conectados, y `galaxy.tsx` enciende un nodo y una órbita por cada uno; el contador «N/M conectados» sale de la misma lista. No hay teclas ni simulador: si nadie entra, la esfera no se arma. Al sellar el Comité se vuelve verde. Lo comprueba `tests/stage.test.ts`.

**31. ¿En la demo hay bots haciéndose pasar por personas?**
No. En una sala de demo juegan 3 personas (quien presenta cada caso y el Comité) y los roles administrativos los toma el piloto automático (`src/lib/engine/autopilot.ts`), con las mismas funciones del motor que usaría una persona. El servidor marca esos asientos con `bot`, la pantalla grande los muestra con el chip «automático» y sus decisiones quedan con `automatic: true`, en la sección «Decisiones automáticas» del acta. Lo mismo vale para el plan B: si juega el turno de una persona, firma con su asiento, pero la decisión queda marcada como automática y nunca aparece entre las humanas (pregunta 33). Los modos completos, sin bots, siguen existiendo.

## Preguntas técnicas difíciles (ensayo final)

**32. En las salas de demo el Comité entra sin clave. ¿No es un agujero de seguridad?**
Es una excepción deliberada y acotada a las salas de demo (`state.demo`). Ahí el sorteo del QR único reparte los 3 asientos humanos por orden de llegada y el tercero es el Comité, sin clave (`drawableSeats` y `joinRandomSeat` en `src/lib/store/rooms.ts`). Lo que sigue protegido: `JOIN_ROLE` directo al Comité pide la clave, una silla es de una sola persona (409 `NO_FREE_SEAT`), la razón es obligatoria, la decisión no se puede cambiar, y el reinicio sin token solo vale con el acta cerrada (`canResetWithoutHost`). Lo que no protege: no sabemos quién es la persona; cualquiera con el QR (o con el id de una sala fija) puede tomar un asiento libre; y apenas se cierra el acta cualquiera puede empezar otra ronda. Se acepta porque son datos simulados y la sala existe para mostrar el producto (`docs/DECISIONES.md`, «En la demo, el Comité entra sin clave…»). Las salas normales mantienen la clave.

**33. ¿Qué pasa si el bot juega por un humano? ¿Puede hacerse pasar por una persona?**
Solo en las salas de demo, y queda marcado. Los bots administrativos juegan su propio asiento (`role.bot`). El plan B, si la persona del turno no actúa en 20 s (`NEXO_DEMO_TURN_MS`), juega el asiento de esa persona (`playTurnAutomatically` en `src/lib/store/rooms.ts`): solo puede presentar ese caso o, como Comité, aceptar la propuesta de la regla; nunca veta ni elige a otro. La acción lleva `modo: "automático"` en la bitácora, la decisión lleva `automatic: true` y la razón empieza con «Automático (plan B)», y el acta la pone en «Decisiones automáticas», separada de las humanas (`renderActaMarkdown` en `src/lib/engine/deterministic.ts`; `tests/demo.test.ts`). Firma con el asiento de la persona, pero nunca se presenta como decisión de una persona.

**34. ¿Cómo evitan que las notas de voz de WhatsApp filtren un dato reservado?**
El texto se arma solo con la vista proyectada del Comité (`projectRoom` con su rol), la misma que vería en su pantalla, que no trae ningún costo (`caseVoiceText` y `actaVoiceText` en `src/integrations/voice-notes.ts`). Usa recurso, organizaciones, etiquetas de los casos y puntajes, con un tope de palabras. Solo se envía al número del Comité, solo con `NEXO_VOICE_NOTES=1` y solo dentro de la ventana de 24 h de WhatsApp. Las pruebas buscan los costos en el texto (`tests/voice-notes.test.ts`). Lo que sí sale de la red es ese texto (a ElevenLabs), el audio (a Kapso y Meta) y, en el acta, la razón que escribió el Comité.

**35. ¿Qué corre en la nube y qué no?**
En el deploy, todo el servidor corre en Render. Van a la nube: el modelo del agente y de la mutación (Claude), que recibe la vista filtrada de un rol (incluidos los datos propios de ese rol) y la frase de mutación; la voz del Comité y las notas de voz (ElevenLabs), con el resumen que ve el Comité; WhatsApp (Kapso y Meta), con el resumen, el audio y la razón; y Supabase, con el formulario de acceso. No sale de la red: el motor, los permisos, la asignación, el acta y los QR (que se dibujan en el navegador). En modo local el modelo corre en el Spark y no sale de la red, y la telemetría muestra el proveedor real y los bytes enviados (`src/lib/llm.ts`, `getTelemetry`).

**36. ¿Cómo escala?**
Un solo proceso con todo en memoria (`globalThis` en `src/lib/store/rooms.ts`): salas, tokens, sesiones de los canales y el límite de peticiones. Topes: 200 salas creadas por usuarios, 200 conexiones SSE por sala y 1000 en total, bitácora acotada por sala y dos llamadas al modelo a la vez (`src/lib/llm.ts`). Mientras el contador corre, cada conexión recibe la sala completa una vez por segundo: lo primero que se satura es la CPU y el ancho de banda de Render gratis (ya vimos mensajes que tardaron hasta 3 s, `docs/MEDICIONES.md`). Varias instancias romperían el SSE y el estado; un reinicio borra las salas. Para escalar: persistencia y un bus compartido (por ejemplo, Redis), enviar solo los cambios y subir de plan.

## Negociación entre agentes (ronda 20)

**37. ¿Los agentes negocian de verdad o es un guion?**
Los textos son de verdad: los redacta el modelo para cada rol, leyendo lo que ya dijeron los otros. El orden de los turnos y la propuesta no: los pone el código (`src/lib/engine/negotiation.ts` y `resolveRoomAllocation`). Así la propuesta es la misma con o sin modelo. Si el modelo no responde en 6 s, sale un texto de respaldo, marcado `fallback: true`; sin modelo configurado, todos salen así.

**38. ¿Cómo evitan que un agente diga el costo del otro hospital en la pantalla grande?**
De dos formas. El agente solo recibe la vista proyectada de su rol, así que el costo ajeno no está en su prompt. Además, antes de publicar, `containsReserved` busca en el texto cada valor reservado de la sala, también escrito como «2,4 millones» o «23 de 50». Si aparece uno, se publica el respaldo. Está probado en `tests/negotiation.test.ts` y en el recorrido `scripts/e2e.mjs`.

**39. ¿Y si alguien no elige su postura?**
A los 60 s de entrar la primera persona, un bot ocupa los asientos vacíos y pone la primera opción, marcada como automática en la pantalla y en el acta. El narrador puede adelantar ese plazo o pausar la negociación.

## Cuidado con estas afirmaciones

- **"Cero bytes a la nube"**: solo mostrando el modo local. En el deploy la telemetría dirá "nube" y contará bytes.
- **"La confiabilidad sube con el veto"**: no es exacto. En el motor sube al sellar la regla (de 43% a 96% en la clínica) y, entre organizaciones, cuando el Comité sella la asignación (de 12% a 89%). Una decisión o un veto por sí solos no la cambian. Y es un modelo ilustrativo.
- **Latencia del modelo local**: no está medida. No dar cifras.
- **Cifras del caso**: son de ejemplo, no estadísticas.
- **"El Comité decide por teléfono"**: no está probado; la llamada necesita un número de Twilio. **Por WhatsApp sí**: se probó en vivo contra Kapso y ElevenLabs el 21 de noviembre (`docs/MEDICIONES.md`). Para escribirle a un número que no ha escrito antes hace falta la plantilla, que sigue en revisión: usar el botón «Recibir resumen por WhatsApp».
- **"Nadie puede entrar como Comité"**: sin la clave no. Con una foto del QR, sí, mientras el puesto esté libre.
- **"El asistente de voz pasa por nuestra capa de modelos"**: no. Corre en ElevenLabs; es la excepción anotada.

## Cómo responder

- Primero la respuesta, después el detalle.
- Si algo está simulado o no se alcanzó a hacer, decirlo. El agente de los jueces lo va a ver en el código de todas formas.
- Si no se sabe la respuesta: "no lo medimos" es mejor que inventar un número.
