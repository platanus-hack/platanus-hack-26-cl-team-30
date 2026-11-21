# Preguntas técnicas del jurado

Guía de preparación para quien responde lo técnico en la presentación. Cada respuesta se puede decir en unos 20 segundos y apunta a un archivo y una función del repo.

Los jueces consultan el repositorio con un agente mientras presentamos y luego preguntan por la estructura de la solución, no por líneas de código. El detalle de cada respuesta está en `docs/ARQUITECTURA.md`; el porqué, en `docs/DECISIONES.md`.

## Arquitectura

**1. ¿Cuáles son los componentes y cómo se comunican?**
Cuatro capas. El contrato de datos en `src/lib/genome/schema.ts`; el motor de reglas, puro y sin modelo, en `src/lib/engine/deterministic.ts`; el almacén en `src/lib/store/rooms.ts`, que guarda las salas en memoria, comprueba el token y llama al motor; y las rutas en `src/app/api/rooms/`. El navegador envía acciones por `POST /action` y recibe la sala por SSE en `/events`; quien llega con el QR único pide antes una silla al azar en `POST /seat`, que entrega el mismo token que `JOIN_ROLE`. Los agentes, en `src/agents/`, llaman al modelo solo a través de `src/lib/llm.ts`.

**2. ¿Qué pasa desde que un usuario hace algo hasta que otro lo ve?**
El navegador envía `POST /api/rooms/:id/action`. `applyAction` (`src/lib/store/rooms.ts`) valida la forma con `ActionSchema`, comprueba el token y llama a la función del motor, por ejemplo `recordCommitteeDecision`. El motor devuelve un estado nuevo, el almacén avisa con `emit`, y cada conexión SSE abierta proyecta la sala para su viewer con `projectStateForOrgAndRole` y la envía. El paso a paso, con archivos, está en `docs/ARQUITECTURA.md`, sección "Flujo de un dato".

**3. ¿Dónde está la parte difícil del proyecto?**
En `src/lib/engine/deterministic.ts`, en dos funciones. `projectStateForOrgAndRole` arma una versión distinta de la misma sala para cada organización y cada rol, con permiso doble. `resolveAllocation` ordena el recurso escaso de forma reproducible, con desempate de equidad. La dificultad no es que funcione una vez, sino que funcione igual con siete viewers distintos a la vez. Eso lo comprueba `tests/engine.test.ts`.

## Agentes y modelos

**4. ¿Cuántos agentes hay y qué hace cada uno?**
Dos propios y un asistente externo. El agente de rol (`runRoleAgentTurn` en `src/agents/role-agent.ts`) propone el siguiente paso para un rol, con una frase y un valor sugerido. El agente de mutación (`mutateGenomeFromPrompt` en `src/agents/mutate-genome.ts`) convierte una frase como "una cooperativa de agua" en el genoma de una organización. Ninguno actúa solo: corren cuando una persona lo pide, y no se llaman entre sí. El tercero es el asistente de voz del Comité, un agente de ElevenLabs que solo explica el caso y transcribe la decisión que dicta la persona, por dos herramientas de nuestro servidor (`src/integrations/elevenlabs.ts`). Su modelo corre en ElevenLabs: es la única excepción a la capa de modelos, y está anotada en `docs/DECISIONES.md`.

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
Dos números, y medidos de forma distinta. `scripts/e2e.mjs` corre con seis participantes independientes, cada uno con su propio SSE: cuatro roles de dos hospitales, el Comité y la pantalla general. La versión anterior pasó 97 de 97 pasos contra el deploy público; la actual, que suma el escenario de construcción, la sala desde una frase y el rechazo del Comité sin clave, pasa completa contra las rutas locales y falta correrla contra el deploy. `scripts/load-test.mjs` abrió 500 conexiones SSE simultáneas en un notebook: todos los cambios llegaron a todas, con p95 de 52 milisegundos. Esa carga no la medimos contra el deploy.

## Integraciones y honestidad

**11. ¿Con qué sistemas externos se integra?**
Con Anthropic para el modelo del deploy, Ollama para el modelo local y Render para el hosting. Opcionales: Supabase para el formulario de acceso y las entrevistas de la portada (las salas no usan base de datos), Kapso para que el Comité decida por WhatsApp (con plantilla aprobada si está `KAPSO_TEMPLATE_NAME`) y ElevenLabs con Twilio para que decida por voz (en el navegador, con el SDK `@elevenlabs/client`). Los tres opcionales están probados solo con pruebas unitarias, sin llamar a los servicios, y las tablas de Supabase aún no están creadas. No nos conectamos a ningún sistema hospitalario.

**12. ¿Qué es real y qué está simulado en la demo?**
Real: los permisos en el servidor, el tiempo real entre teléfonos, las reglas, la asignación, el acta, la clave del QR del Comité y el agente con Claude. Simulado: los pacientes, obras, cargas, costos y puntajes, que vienen de `src/lib/genome/seeds.ts`, y las organizaciones, que son ficticias. El ensayo automático lo hacen bots y queda marcado en la bitácora. WhatsApp y voz están implementados pero probados solo sin llamar a los servicios; la llamada telefónica además depende de un número de Twilio. La confiabilidad p^n es un modelo ilustrativo, no una medición. Y el deploy usa la nube: "cero bytes a la nube" vale solo en modo local. La tabla completa está en `docs/ARQUITECTURA.md`.

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
A dos equipos que necesitan la misma cama UCI y hoy la piden por teléfono y WhatsApp, sin ver el caso del otro. En la demo, dos hospitales presentan a su paciente, el tablero ordena con una regla visible y el Comité decide desde un teléfono. **Mostrar:** la pantalla general de `demo-cross` con el contador corriendo. Los casos son simulados.

**17. ¿Por qué no puede decidir una sola organización?**
Porque cada una tiene un dato que la otra no puede ver: su costo de cobertura. Si decide una sola, decide con la mitad de la información o exige ver lo que no le corresponde. Nexo ordena los casos sin que ninguna vea el costo de la otra (`canViewCoverageCost` en `src/lib/engine/deterministic.ts`). **Mostrar:** en el celular, la pestaña «Secretos»: el costo del otro hospital es una barra de franjas, y «Ver» responde «Este dato nunca llegó a tu celular».

**18. ¿Por qué esta asignación y no la otra?**
Por una fórmula fija que está en pantalla: 0,5 por gravedad, más 0,3 por urgencia, menos 0,2 por riesgo de demora (`computeTriageScore`). En la semilla los puntajes quedan en 0,52 (Paciente A) y 0,53 (Paciente B). La diferencia es menor que el margen de empate (0,02), así que `resolveAllocation` aplica el desempate de equidad: mayor necesidad sin cubrir, 0,9 contra 0,4. Gana B, que también ganaba por puntaje: aquí el desempate confirma, no da vuelta el resultado. Cuando el de mejor puntaje tiene menos necesidad, sí lo da vuelta (lo prueba `tests/engine.test.ts`). Con los mismos datos, siempre el mismo resultado. **Mostrar:** el duelo del Comité en su celular (puntajes y el recomendado), «¿Por qué?» con la explicación, y en la pantalla grande «Pregúntale al caso».

**19. ¿O es una simulación corriendo sola?**
No. Nada cambia sin una persona: cada acción exige el token de un rol (`applyAction` en `src/lib/store/rooms.ts`), y los agentes solo corren cuando alguien los pide. El Comité es una persona del público que escanea un QR (con su clave) y escribe su razón. Con el QR único de la sala, el servidor sortea una silla libre (`POST /api/rooms/:id/seat`), pero igual la pide una persona al escanear. La única excepción es el ensayo automático, que lanza el anfitrión para ensayar y queda marcado como tal (pregunta 27). **Mostrar:** el QR del Comité y la bitácora, donde cada evento tiene organización y rol.

**20. ¿Permisos reales o teatro?**
Reales. El dato oculto no viaja: `projectStateForOrgAndRole` lo elimina antes de enviar, y llega como `redacted: true` sin la propiedad `value`. El botón «Ver» de la pestaña «Secretos» devuelve un 403 del servidor que queda en la bitácora (`attemptProtectedRead`). Las pruebas buscan los valores secretos en el tráfico de cada viewer. **Mostrar:** DevTools, pestaña Network, el mensaje SSE de un hospital: el costo del otro no está.

**21. ¿Qué hace el modelo y qué hace su código?**
El modelo redacta propuestas y el contenido de una organización nueva. El código decide permisos, choque, compuerta, asignación, contador y acta, en `src/lib/engine/deterministic.ts`, que no llama a ningún modelo. Todo lo que escribe el modelo pasa por un esquema Zod antes de entrar. **Mostrar:** la sala funcionando con el agente en modo respaldo, o la fórmula del tablero.

**22. ¿Qué le da al Comité el poder de veto?**
La regla, y una obligación: la razón. Solo el Comité árbitro puede vetar o sellar la asignación (`recordCommitteeDecision`, `sealAllocation`); cualquier otro rol recibe 403. Sin razón escrita, 400. La razón queda en la bitácora y en el acta, y la decisión no se puede cambiar después. **Mostrar:** «Vetar» en el celular del Comité (con un chip de razón), el cambio en todas las pantallas y el acta en Markdown.

**23. ¿Cuántas llamadas al modelo corren a la vez?**
Las que permita la cola de `src/lib/llm.ts` (`acquireSlot`): una a la vez en local, para no saturar el Spark, y dos con Claude. Las demás esperan en orden. Solo hay dos tipos de llamada, la propuesta del agente y la mutación; todo lo demás es código. **Mostrar:** la telemetría en la pestaña «Sala» del celular («¿Qué recibe y dónde corre?») o en la pantalla grande: proveedor, local o nube, cola, latencia y bytes enviados a la nube.

**24. ¿Qué hace esto que Zapier y Excel no resuelven?**
Tres cosas que un flujo fijo o una planilla compartida no dan juntas: cada participante ve una versión distinta de los mismos datos, filtrada en el servidor por organización y rol; el recurso escaso se ordena con una regla auditable y desempate de equidad; y el veto exige una razón que queda en un acta. Todo en vivo, entre varias personas a la vez.

## Generalidad, seguridad y canales

**25. ¿Esto sirve solo para hospitales?**
No. Los hospitales son el ejemplo principal. El mismo motor corre tres escenarios entre organizaciones sin cambiar código ni depender del modelo: dos hospitales y una cama, dos constructoras y una grúa, dos distribuidoras y un camión (`src/lib/genome/scenarios.ts` y `seeds.ts`, con las mismas pruebas). Y una frase crea una sala nueva de cualquier organización: el modelo escribe el genoma y, si tarda más de 15 segundos o falla, se usa la semilla más parecida. **Mostrar:** la sala fija `demo-construccion`, donde el desempate de equidad le da la grúa a la obra con menor puntaje.

**26. ¿Cualquiera puede entrar como Comité o reiniciar la sala?**
No. Quien crea la sala recibe dos claves que no salen en ninguna vista. El token de anfitrión habilita reiniciar, el ensayo automático, liberar un puesto y avisar al Comité por WhatsApp o voz; sin él, 403. La clave del Comité va dentro de su QR: sin ella, 403 `COMMITTEE_KEY_REQUIRED` y queda en la bitácora (`join` en `src/lib/store/rooms.ts`). El sorteo de silla del QR único (`POST /api/rooms/:id/seat`, `joinRandomSeat`) tampoco es un atajo: sin esa clave el Comité no entra al sorteo, y nunca entrega una silla ocupada (`tests/seat.test.ts`). Además hay límite de peticiones por cliente (`src/lib/store/rate-limit.ts`). Límite honesto: quien tenga una foto del QR puede entrar mientras el puesto esté libre.

**27. ¿El ensayo automático no es justamente una simulación corriendo sola?**
Es para ensayar, no para la demo, y lo dice. Solo lo lanza el anfitrión. Los bots toman los puestos libres y cada paso llama a la misma función del motor que usaría una persona, con las mismas reglas: el intento de leer el costo ajeno también da 403. Todo queda con eventos `AUTOPILOT` y las entradas de los bots marcadas `bot: true` (`src/lib/engine/autopilot.ts`). Si una persona toma un puesto, su paso se salta. No usa el modelo.

**28. ¿El Comité puede decidir sin abrir la web?**
Sí, por WhatsApp o por voz (`src/integrations/`). Por WhatsApp (Kapso) recibe el caso con botones Aprobar y Vetar (como plantilla aprobada si está configurada) y escribe la razón; el webhook verifica una firma HMAC. Por voz, un agente de ElevenLabs lo llama por teléfono vía Twilio, o conversa en el navegador, y usa dos herramientas protegidas por un secreto compartido. Ambos canales usan las mismas acciones que la web (`JOIN_ROLE` con la clave del Comité, `ALLOCATION_SEAL` o `COMMITTEE_VETO` con razón), y el resumen se arma solo con la vista del Comité, así que nunca reciben un dato reservado. Están probados con pruebas unitarias, sin llamar a los servicios.

**29. ¿Dónde guardan datos de personas?**
Solo las solicitudes de acceso y las entrevistas de la portada, en Supabase, escritas por el servidor con la clave `service_role` (que nunca llega al navegador) en tablas con RLS sin políticas (`supabase/migrations/`). Si Supabase no está, la portada sigue y el formulario dice que por ahora no puede guardar. Las salas no se guardan en ninguna base: viven en memoria.

**30. ¿La galaxia de la pantalla grande muestra datos reales o es una animación?**
Datos reales, dibujados. `stageSeats` (`src/components/stage/seats.ts`) lee del estado que llega por el SSE qué roles están conectados, y `galaxy.tsx` enciende un nodo y una órbita por cada uno; el contador «N/M conectados» sale de la misma lista. No hay teclas ni simulador: si nadie entra, la esfera no se arma. Al sellar el Comité se vuelve verde. Lo comprueba `tests/stage.test.ts`.

## Cuidado con estas afirmaciones

- **"Cero bytes a la nube"**: solo mostrando el modo local. En el deploy la telemetría dirá "nube" y contará bytes.
- **"La confiabilidad sube con el veto"**: no es exacto. En el motor sube al sellar la regla (de 43% a 96% en la clínica) y, entre organizaciones, cuando el Comité sella la asignación (de 12% a 89%). Una decisión o un veto por sí solos no la cambian. Y es un modelo ilustrativo.
- **Latencia del modelo local**: no está medida. No dar cifras.
- **Cifras del caso**: son de ejemplo, no estadísticas.
- **"El Comité decide por WhatsApp o por teléfono"**: está implementado, pero solo probado sin llamar a Kapso ni a ElevenLabs. Decirlo en vivo solo si se probó antes con las variables configuradas. La llamada necesita un número de Twilio.
- **"Nadie puede entrar como Comité"**: sin la clave no. Con una foto del QR, sí, mientras el puesto esté libre.
- **"El asistente de voz pasa por nuestra capa de modelos"**: no. Corre en ElevenLabs; es la excepción anotada.

## Cómo responder

- Primero la respuesta, después el detalle.
- Si algo está simulado o no se alcanzó a hacer, decirlo. El agente de los jueces lo va a ver en el código de todas formas.
- Si no se sabe la respuesta: "no lo medimos" es mejor que inventar un número.
