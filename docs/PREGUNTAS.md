# Preguntas técnicas del jurado

Guía de preparación para quien responde lo técnico en la presentación. Cada respuesta se puede decir en unos 20 segundos y apunta a un archivo y una función del repo.

Los jueces consultan el repositorio con un agente mientras presentamos y luego preguntan por la estructura de la solución, no por líneas de código. El detalle de cada respuesta está en `docs/ARQUITECTURA.md`; el porqué, en `docs/DECISIONES.md`.

## Arquitectura

**1. ¿Cuáles son los componentes y cómo se comunican?**
Cuatro capas. El contrato de datos en `src/lib/genome/schema.ts`; el motor de reglas, puro y sin modelo, en `src/lib/engine/deterministic.ts`; el almacén en `src/lib/store/rooms.ts`, que guarda las salas en memoria, comprueba el token y llama al motor; y las rutas en `src/app/api/rooms/`. El navegador envía acciones por `POST /action` y recibe la sala por SSE en `/events`. Los agentes, en `src/agents/`, llaman al modelo solo a través de `src/lib/llm.ts`.

**2. ¿Qué pasa desde que un usuario hace algo hasta que otro lo ve?**
El navegador envía `POST /api/rooms/:id/action`. `applyAction` (`src/lib/store/rooms.ts`) valida la forma con `ActionSchema`, comprueba el token y llama a la función del motor, por ejemplo `recordCommitteeDecision`. El motor devuelve un estado nuevo, el almacén avisa con `emit`, y cada conexión SSE abierta proyecta la sala para su viewer con `projectStateForOrgAndRole` y la envía. El paso a paso, con archivos, está en `docs/ARQUITECTURA.md`, sección "Flujo de un dato".

**3. ¿Dónde está la parte difícil del proyecto?**
En `src/lib/engine/deterministic.ts`, en dos funciones. `projectStateForOrgAndRole` arma una versión distinta de la misma sala para cada organización y cada rol, con permiso doble. `resolveAllocation` ordena el recurso escaso de forma reproducible, con desempate de equidad. La dificultad no es que funcione una vez, sino que funcione igual con siete viewers distintos a la vez. Eso lo comprueba `tests/engine.test.ts`.

## Agentes y modelos

**4. ¿Cuántos agentes hay y qué hace cada uno?**
Dos. El agente de rol (`runRoleAgentTurn` en `src/agents/role-agent.ts`) propone el siguiente paso para un rol, con una frase y un valor sugerido. El agente de mutación (`mutateGenomeFromPrompt` en `src/agents/mutate-genome.ts`) convierte una frase como "una cooperativa de agua" en el genoma de una organización. Ninguno actúa solo: corren cuando una persona lo pide, y no se llaman entre sí.

**5. ¿Qué decide el modelo y qué decide el código?**
El modelo redacta: el texto de una propuesta y el contenido de un genoma. El código decide todo lo demás: quién ve qué (`canViewField`), si hay choque (`detectRuleConflict`), si la compuerta bloquea (`evaluateGate`), quién recibe la cama (`resolveAllocation`), el contador y el acta. Todo eso está en `src/lib/engine/deterministic.ts`, que no importa la capa de modelos. La sala funciona completa sin modelo.

**6. ¿Qué modelo usan, dónde corre y por qué ese?**
El deploy público usa Claude Opus 5.5 por la API de Anthropic, porque un servidor en internet no puede llegar al Spark, que está en la red local de la sede. En local, la misma capa (`src/lib/llm.ts`, `llmConfig`) habla con Ollama en el DGX Spark. Cambiar de uno a otro es cambiar `LLM_PROVIDER` y `LLM_MODEL`. El modo local está implementado pero no lo hemos verificado contra el Spark ni medido su latencia.

**7. ¿Qué pasa si el modelo se equivoca o inventa algo?**
Tiene poco margen para hacer daño. El agente de rol solo recibe la vista filtrada de su rol, así que no puede revelar lo que no recibió. Su valor sugerido se acota al rango de la regla (`fitSuggestedValue`) y los valores reservados se tachan del texto (`redactReserved`). Si inventa un genoma inválido, o con HTML o código, `OrgGenomeSchema` y `findMarkup` lo rechazan y se usa una semilla. Si no responde, hay un respaldo fijo marcado como tal. Y en ningún caso decide: la decisión es de una persona.

## Tiempo real y colaboración

**8. ¿Cómo funciona la colaboración en tiempo real?**
Con Server-Sent Events (`src/app/api/rooms/[roomId]/events/route.ts`). Cada navegador abre una conexión con su rol y su token. Cuando la sala cambia, el servidor le envía a cada conexión su propia versión filtrada. Mientras el contador corre, envía un mensaje por segundo con el reloj del servidor, así todas las pantallas muestran el mismo tiempo. Las acciones van por `POST` normales.

**9. ¿Qué pasa si dos personas actúan al mismo tiempo sobre lo mismo?**
El servidor las procesa de a una, en orden de llegada. Las funciones del motor son síncronas: reciben un estado y devuelven otro, así que no hay dos escrituras mezcladas. Cada cambio sube `version`. Las decisiones son definitivas: si dos personas deciden la misma compuerta, la segunda recibe 409 `DECISION_SEALED`. Si el agente tarda y el rol cambió de manos mientras tanto (el token vigente ya no es el que pidió el turno), su propuesta se descarta: `runAgent` en `src/lib/store/rooms.ts`.

**10. ¿Con cuántos usuarios simultáneos lo probaron?**
Dos números, y medidos de forma distinta. `scripts/e2e.mjs` corre contra el deploy público con seis participantes independientes, cada uno con su propio SSE: cuatro roles de dos hospitales, el Comité y la pantalla general. Pasó 97 de 97 pasos. `scripts/load-test.mjs` abrió 500 conexiones SSE simultáneas en un notebook: todos los cambios llegaron a todas, con p95 de 52 milisegundos. Esa carga no la medimos contra el deploy.

## Integraciones y honestidad

**11. ¿Con qué sistemas externos se integra?**
Con la API de Anthropic para el modelo del deploy, con Ollama para el modelo local y con Render para el hosting. Nada más: no hay base de datos ni autenticación externa. Los códigos QR se generan en el navegador. No nos conectamos a ningún sistema hospitalario.

**12. ¿Qué es real y qué está simulado en la demo?**
Real: los permisos en el servidor, el tiempo real entre teléfonos, las reglas, la asignación, el acta y el agente con Claude. Simulado: los pacientes, costos y puntajes, que vienen de `src/lib/genome/seeds.ts`, y las organizaciones, que son ficticias. La confiabilidad p^n es un modelo ilustrativo, no una medición. Y el deploy usa la nube: "cero bytes a la nube" vale solo en modo local. La tabla completa está en `docs/ARQUITECTURA.md`.

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
Porque cada una tiene un dato que la otra no puede ver: su costo de cobertura. Si decide una sola, decide con la mitad de la información o exige ver lo que no le corresponde. Nexo ordena los casos sin que ninguna vea el costo de la otra (`canViewCoverageCost` en `src/lib/engine/deterministic.ts`). **Mostrar:** el costo tachado del otro hospital en el panel de niebla.

**18. ¿Por qué esta asignación y no la otra?**
Por una fórmula fija que está en pantalla: 0,5 por gravedad, más 0,3 por urgencia, menos 0,2 por riesgo de demora (`computeTriageScore`). En la semilla los puntajes quedan en 0,52 y 0,53, a menos del margen de empate, así que decide el desempate de equidad: mayor necesidad sin cubrir (`resolveAllocation`). Con los mismos datos, siempre el mismo resultado. **Mostrar:** el tablero de asignación con la fórmula y la explicación.

**19. ¿O es una simulación corriendo sola?**
No. Nada cambia sin una persona: cada acción exige el token de un rol (`applyAction` en `src/lib/store/rooms.ts`), y los agentes solo corren cuando alguien los pide. El Comité es una persona del público que escanea un QR y escribe su razón. **Mostrar:** el QR del Comité y la bitácora, donde cada evento tiene organización y rol.

**20. ¿Permisos reales o teatro?**
Reales. El dato oculto no viaja: `projectStateForOrgAndRole` lo elimina antes de enviar, y llega como `redacted: true` sin la propiedad `value`. El botón "intentar lectura" devuelve un 403 del servidor que queda en la bitácora (`attemptProtectedRead`). Las pruebas buscan los valores secretos en el tráfico de cada viewer. **Mostrar:** DevTools, pestaña Network, el mensaje SSE de un hospital: el costo del otro no está.

**21. ¿Qué hace el modelo y qué hace su código?**
El modelo redacta propuestas y el contenido de una organización nueva. El código decide permisos, choque, compuerta, asignación, contador y acta, en `src/lib/engine/deterministic.ts`, que no llama a ningún modelo. Todo lo que escribe el modelo pasa por un esquema Zod antes de entrar. **Mostrar:** la sala funcionando con el agente en modo respaldo, o la fórmula del tablero.

**22. ¿Qué le da al Comité el poder de veto?**
La regla, y una obligación: la razón. Solo el Comité árbitro puede vetar o sellar la asignación (`recordCommitteeDecision`, `sealAllocation`); cualquier otro rol recibe 403. Sin razón escrita, 400. La razón queda en la bitácora y en el acta, y la decisión no se puede cambiar después. **Mostrar:** el veto con su razón en todas las pantallas y el acta en Markdown.

**23. ¿Cuántas llamadas al modelo corren a la vez?**
Las que permita la cola de `src/lib/llm.ts` (`acquireSlot`): una a la vez en local, para no saturar el Spark, y dos con Claude. Las demás esperan en orden. Solo hay dos tipos de llamada, la propuesta del agente y la mutación; todo lo demás es código. **Mostrar:** la telemetría en pantalla: proveedor, local o nube, cola, latencia y bytes enviados a la nube.

**24. ¿Qué hace esto que Zapier y Excel no resuelven?**
Tres cosas que un flujo fijo o una planilla compartida no dan juntas: cada participante ve una versión distinta de los mismos datos, filtrada en el servidor por organización y rol; el recurso escaso se ordena con una regla auditable y desempate de equidad; y el veto exige una razón que queda en un acta. Todo en vivo, entre varias personas a la vez.

## Cuidado con estas afirmaciones

- **"Cero bytes a la nube"**: solo mostrando el modo local. En el deploy la telemetría dirá "nube" y contará bytes.
- **"La confiabilidad sube con el veto"**: no es exacto. En el motor sube al sellar la regla (de 43% a 96% en la clínica) y, entre organizaciones, cuando el Comité sella la asignación (de 12% a 89%). Una decisión o un veto por sí solos no la cambian. Y es un modelo ilustrativo.
- **Latencia del modelo local**: no está medida. No dar cifras.
- **Cifras del caso**: son de ejemplo, no estadísticas.

## Cómo responder

- Primero la respuesta, después el detalle.
- Si algo está simulado o no se alcanzó a hacer, decirlo. El agente de los jueces lo va a ver en el código de todas formas.
- Si no se sabe la respuesta: "no lo medimos" es mejor que inventar un número.
