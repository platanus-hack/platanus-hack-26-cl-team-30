# Decisiones técnicas

Una entrada por decisión importante, la más reciente arriba. Sirve para responder "¿por qué lo hicieron así y no de otra forma?".

Formato de cada entrada:

- **Decisión:** qué elegimos.
- **Alternativa descartada:** qué otra cosa consideramos.
- **Por qué:** la razón, en una o dos líneas.
- **Costo:** qué perdemos con esta elección.

---

## Los canales externos del Comité usan las mismas acciones que la web

- **Decisión:** el Comité puede decidir por WhatsApp (Kapso) o por voz (ElevenLabs), pero ambos canales toman el puesto con `JOIN_ROLE` y la clave del Comité, y deciden con `ALLOCATION_SEAL` o `COMMITTEE_VETO` con razón (`src/integrations/committee-channel.ts`). El resumen que reciben se arma con la vista del Comité (`projectRoom`).
- **Alternativa descartada:** una ruta propia por canal que escribiera la decisión directamente en la sala.
- **Por qué:** así no hay un segundo camino hacia el estado: permisos, razón obligatoria, decisiones definitivas, bitácora y acta son los mismos, y un canal externo no puede recibir un dato reservado porque solo ve lo que ve el Comité.
- **Costo:** cada canal mantiene una sesión en memoria (30 minutos) con el token del puesto. Si una persona ya tiene el puesto desde la web, el canal no lo toma.

## El webhook de WhatsApp se verifica con firma y las herramientas de voz con un secreto compartido

- **Decisión:** `POST /api/integrations/kapso/webhook` verifica la firma HMAC del cuerpo crudo (`X-Webhook-Signature`) antes de leerlo y solo acepta mensajes del número asociado a la sesión. `POST /api/integrations/voice/tool` exige el secreto `NEXO_CHANNEL_SECRET` en `x-nexo-secret`, que ElevenLabs envía en cada llamada a la herramienta.
- **Alternativa descartada:** rutas abiertas que confíen en que nadie conoce la URL.
- **Por qué:** esas dos rutas pueden registrar la decisión del Comité. Sin firma o secreto, cualquiera que adivine la URL podría decidir por él.
- **Costo:** hay que configurar el mismo secreto en Kapso o en ElevenLabs y en el servidor. Estas rutas no tienen límite de peticiones propio.

## El asistente de voz corre dentro de ElevenLabs: única excepción a la capa de modelos

- **Decisión:** el asistente de voz del Comité es un agente de ElevenLabs (`ensureCommitteeAgent` en `src/integrations/elevenlabs.ts`). Su modelo de conversación corre en ElevenLabs y no pasa por `src/lib/llm.ts`.
- **Alternativa descartada:** armar la voz nosotros (reconocimiento de voz, modelo por `llm.ts` y síntesis) o no tener voz.
- **Por qué:** una conversación telefónica en tiempo real necesita turnos, interrupciones y llamadas por Twilio que ElevenLabs ya resuelve. El riesgo se acota: el asistente no decide ni ve nada propio; solo tiene dos herramientas de nuestro servidor, una que devuelve el resumen del Comité y otra que registra la decisión que dicta la persona con su razón.
- **Costo:** ese modelo no aparece en nuestra telemetría y no se elige con `LLM_MODEL`. Lo que la persona dice en la llamada pasa por ElevenLabs.

## Clave del Comité dentro de su QR

- **Decisión:** al crear una sala se genera una clave (`committeeKey`) que va dentro del enlace del QR del Comité. `JOIN_ROLE` al puesto del árbitro (o del Comité de la clínica en `single_org`) la exige; sin ella responde 403 `COMMITTEE_KEY_REQUIRED` y lo deja en la bitácora. Adaptado de la versión de Ramón (commit `b22928c`).
- **Alternativa descartada:** que el Comité fuera un rol libre como los demás.
- **Por qué:** el Comité es quien firma. Con el puesto libre, cualquiera que conociera el id de la sala podía tomarlo antes que el jurado.
- **Costo:** quien tenga una foto del QR puede entrar mientras el puesto esté libre. Es una clave de sala, no una cuenta.

## Token de anfitrión para los controles de la pantalla grande

- **Decisión:** quien crea la sala recibe un `hostToken`. Reiniciar, ensayo automático, liberar un puesto, mutar y avisar al Comité por sus canales lo exigen (`x-host-token`); la clave `NEXO_ADMIN_KEY` también sirve. Las salas fijas, que nadie creó, solo entregan sus controles con esa clave o fuera de producción. Adaptado de la versión de Ramón (commit `b22928c`).
- **Alternativa descartada:** la clave de administración opcional para `DELETE`, como estaba antes.
- **Por qué:** el deploy no definía la clave, así que cualquiera podía reiniciar `demo-cross` en plena presentación.
- **Costo:** para presentar en el deploy hay que crear una sala nueva (o configurar `NEXO_ADMIN_KEY`). Si el navegador de quien presenta pierde su almacenamiento, pierde los controles de esa sala.

## Reiniciar devuelve la sala al inicio y conserva sus claves

- **Decisión:** `DELETE /api/rooms/:id` vuelve al caso con que se abrió la sala (semilla, escenario o genoma mutado), detiene el ensayo y revoca los tokens de los puestos, pero conserva el id, el token de anfitrión y la clave del Comité.
- **Alternativa descartada:** borrar la sala, como hacía antes con las salas comunes.
- **Por qué:** para ensayar varias veces seguidas con la misma pantalla y el mismo QR impreso. Las salas inactivas igual se borran solas.
- **Costo:** quien tenga el QR puede volver a entrar como Comité después de un reinicio.

## Límite de peticiones en memoria, con la IP solo si hay un proxy de confianza

- **Decisión:** ventana fija por cliente y tipo de petición, más un tope global para lo que llama al modelo (`src/lib/store/rate-limit.ts`). La IP se lee de `X-Forwarded-For` (último salto) solo con `TRUST_PROXY=1`. Adaptado de la versión de Ramón (commit `fbe8a4f`).
- **Alternativa descartada:** leer siempre `X-Forwarded-For`, o un servicio externo de límites.
- **Por qué:** ese encabezado lo puede escribir cualquiera; sin un proxy que lo sobrescriba, cada petición podría inventar una IP nueva. En memoria basta para un solo proceso, igual que las salas.
- **Costo:** sin `TRUST_PROXY` todos comparten el mismo límite. No está verificado que en Render el último salto sea la IP real del cliente.

## Ensayo automático con las mismas funciones del motor, sin modelo

- **Decisión:** el ensayo (`src/lib/engine/autopilot.ts`) es el guion de la demo como datos. Cada paso llama a la función del motor que usaría una persona, desde el puesto que corresponde. Los bots solo toman puestos libres y todo queda marcado (`AUTOPILOT`, `bot: true`). Es control de anfitrión. Adaptado del `autopilot.ts` de Ramón.
- **Alternativa descartada:** un ensayo que escribiera el estado final directamente, o que usara el agente con el modelo.
- **Por qué:** así el ensayo prueba las reglas de verdad y es reproducible, sin gastar llamadas. Marcarlo evita presentar como decisión humana algo que hizo un bot.
- **Costo:** los pasos de agente se omiten. Si una persona tiene un puesto, su paso se salta y el guion puede no llegar al final hasta que esa persona actúe.

## Escenarios de otros rubros como semillas, no como mutación

- **Decisión:** construcción y logística son escenarios entre organizaciones completos en `src/lib/genome/seeds.ts`, validados con los mismos esquemas y las mismas pruebas que los hospitales, cada uno con su sala fija.
- **Alternativa descartada:** mostrar otros rubros solo con la mutación por frase.
- **Por qué:** la generalidad del producto no puede depender de que el modelo responda bien en vivo. En construcción, además, el desempate de equidad sí da vuelta el resultado (gana la obra con menor puntaje y más necesidad).
- **Costo:** los escenarios son fijos: todos de dos organizaciones y con los mismos pesos de la fórmula.

## La frase crea una sala nueva, con 15 segundos para el modelo

- **Decisión:** `POST /api/rooms` con `{ mode: "single_org", description }` crea una sala nueva ya mutada. Si el modelo tarda más de 15 s, falla o el genoma no pasa el esquema, se usa la semilla más parecida y `source` lo dice.
- **Alternativa descartada:** mutar la sala en uso (`POST /mutate`), que choca con 409 `ROOM_IN_USE` en cuanto alguien entra.
- **Por qué:** una sala nueva nunca pisa la sesión de otras personas, y el plazo evita que la portada quede esperando.
- **Costo:** cada frase deja una sala más en memoria (se borra sola tras 2 horas sin uso). Mutar tiene su propio límite: 6 por minuto por cliente y 20 en todo el servidor.

## Supabase por su API REST, solo desde el servidor y con degradación

- **Decisión:** el formulario de acceso y la entrevista usan la API REST de Supabase con `fetch` (`src/lib/supabase/server.ts`), con la clave `service_role` solo en el servidor (`import "server-only"`). Las tablas tienen RLS activado y ninguna política. Si falta la configuración, la tabla o la red, el formulario responde 503 `STORAGE_UNAVAILABLE` y la entrevista `null`.
- **Alternativa descartada:** el SDK `@supabase/supabase-js`, o leer y escribir desde el navegador con la clave anon.
- **Por qué:** son dos operaciones; `fetch` evita una dependencia. Desde el navegador habría que abrir políticas RLS a cualquiera. La portada no puede romperse porque falte una tabla.
- **Costo:** sin tipos generados de la base. Las salas siguen sin base de datos.

## El modelo escribe un genoma JSON validado, no la interfaz

- **Decisión:** para adaptar Nexo a otra organización, el modelo escribe solo un objeto JSON con contenido (nombres de roles, datos, caso). El código fija la estructura (`normalizeGenome` en `src/agents/mutate-genome.ts`) y `OrgGenomeSchema` (`src/lib/genome/schema.ts`) decide si se usa. La interfaz son siete órganos fijos en `src/components/organs/` que dibujan cualquier genoma válido.
- **Alternativa descartada:** que el modelo genere HTML o JSX a la medida de cada organización.
- **Por qué:** una interfaz generada puede romperse en vivo o saltarse los permisos. Un JSON se puede validar campo por campo antes de que toque la sala, y si no pasa se usa una semilla (`source: "fallback_seed"`). La sala nunca queda sin organización.
- **Costo:** toda organización se expresa con la misma forma: hasta 3 roles, entre 4 y 8 campos, una regla de autoridad y un caso. Lo que no cabe en esa forma no se puede representar.

## La pantalla general solo ve campos `public`

- **Decisión:** la vista `stage` recibe un campo solo si está clasificado `public` y además lo ven todas las organizaciones y todos los roles de la dueña (`canViewField`).
- **Alternativa descartada:** antes recibía cualquier campo que vieran todos los roles, aunque fuera `restricted`.
- **Por qué:** la pantalla general no tiene identidad: cualquiera que conozca el id de la sala puede abrirla, y de ella se arma el acta pública. Un dato interno compartido por los tres roles de una clínica no debe salir a quien no pertenece a ella.
- **Costo:** la pantalla proyectada muestra menos datos; los internos aparecen tachados.

## Topes de memoria en el servidor

- **Decisión:** el almacén limita las salas (200), las conexiones SSE (200 por sala, 1000 en total), el tamaño del body (8000 caracteres), el largo de la razón (500) y la bitácora (2000 eventos, con cupo propio para los intentos sin token). Una sola llamada al modelo a la vez por rol y por sala. Las salas inactivas se borran solas.
- **Alternativa descartada:** sin topes, confiando en que la demo es corta.
- **Por qué:** el deploy es público y el estado vive en memoria: sin topes, cualquiera puede llenarlo o gastar llamadas al modelo repitiendo un botón. Al recortar la bitácora se descartan primero los eventos de rutina, nunca las decisiones.
- **Costo:** con más de 200 salas activas a la vez, crear otra responde 503. El acta declara si se perdieron eventos antiguos (`auditLogDropped`).

## Permiso doble, por organización y por rol, aplicado en el servidor

- **Decisión:** cada campo declara `visibleToOrgIds` y `visibleToRoleIds`. `canViewField` (`src/lib/engine/deterministic.ts`) exige las dos condiciones, y `projectStateForOrgAndRole` arma un paquete distinto para cada viewer, sin la propiedad `value` en lo que no puede ver. Es la única salida de estado hacia un cliente.
- **Alternativa descartada:** enviar todo y ocultarlo en la interfaz, o pedirle al modelo que no revele ciertos datos.
- **Por qué:** lo que no se envía no se puede filtrar. Se comprueba mirando el tráfico de red del navegador, y las pruebas lo hacen: serializan cada vista a JSON y buscan los valores reservados (`tests/engine.test.ts`, `scripts/e2e.mjs`).
- **Costo:** la sala se proyecta una vez por conexión en cada cambio y en cada pulso del contador.

## El costo de un candidato sigue el permiso del campo `coverage_cost`

- **Decisión:** el costo de cobertura de un candidato lo recibe solo su organización y, dentro de ella, solo los roles que pueden ver el campo `coverage_cost` (`canViewCoverageCost`).
- **Alternativa descartada:** el plan original lo hacía visible para toda la organización dueña (`coverageCostVisibleToOrgs`).
- **Por qué:** con el plan original, el rol clínico recibía por la lista de candidatos el mismo costo que el permiso por rol le negaba en el campo. El secreto se filtraba dentro de la propia organización.
- **Costo:** la regla depende de que el genoma tenga un campo con esa clave. Si no existe, el costo lo ve toda la organización dueña.

## Asignación determinista con desempate de equidad

- **Decisión:** el recurso escaso lo ordena una fórmula fija, `S = w_sev·gravedad + w_time·urgencia − w_delay·riesgo por demora` (`computeTriageScore`). Todos los candidatos cuyo puntaje queda a menos de `tieEpsilon` del mejor forman un grupo empatado, y dentro de ese grupo ordena el desempate de equidad de la regla; por defecto gana quien tiene mayor necesidad sin cubrir (`resolveAllocation`). Empate total: orden alfabético del caso. Solo compiten los candidatos presentados y no vetados (`resolveRoomAllocation`).
- **Alternativa descartada:** pedirle al modelo que elija, o asignar por orden de llegada.
- **Por qué:** quien pierde la cama tiene que poder leer por qué. Una fórmula con pesos visibles da siempre el mismo resultado con los mismos datos y se puede auditar. El desempate evita que una diferencia de un centésimo decida, y evita que gane quien puede pagar más.
- **Costo:** los pesos y los puntajes de la semilla son de ejemplo y nadie del área de salud los validó. El desempate `geographic` es una aproximación porque el esquema no tiene datos geográficos. El signo negativo del riesgo por demora viene del plan original y habría que revisarlo con criterio clínico.

## El Comité árbitro es neutral y no ve el costo de nadie

- **Decisión:** en la capa entre organizaciones el Comité tiene su propio `orgId` (`ArbiterSchema`, `comite_red` en la semilla). No está en la lista de visibilidad de ningún campo ni de ningún costo.
- **Alternativa descartada:** que el Comité fuera el `role_c` de una de las organizaciones que compiten.
- **Por qué:** quien arbitra entre dos hospitales no puede pertenecer a uno de ellos ni decidir por costo.
- **Costo:** hay dos tipos de Comité (el de cada organización, que decide su compuerta, y el árbitro, que decide la asignación) y hay que explicar la diferencia.

## Toda decisión humana exige una razón escrita y es definitiva

- **Decisión:** `recordGateDecision` y `recordCommitteeDecision` rechazan con 400 `REASON_REQUIRED` una decisión sin razón. La razón queda en `decisions`, en la bitácora y en el acta. Una decisión tomada no se puede cambiar (409 `DECISION_SEALED`). El Comité árbitro no puede vetar al último candidato.
- **Alternativa descartada:** un botón de aprobar o vetar, sin texto.
- **Por qué:** el veto es poder, y el poder sin explicación no se puede auditar. La razón convierte un clic en una decisión con responsable.
- **Costo:** un paso más para quien decide desde el teléfono, y no hay forma de corregir una decisión equivocada salvo reiniciar la sala.

## p^n como modelo ilustrativo, no como medición

- **Decisión:** `computeReliabilityPn` muestra dos números: `p^n` (una cadena de n pasos hecha solo por agentes) y `(1 − (1 − p)(1 − h))^n` (la misma cadena con compuerta y revisión humana). El nivel vigente es el segundo solo si la regla está sellada en modo `deterministic_hitl`; entre organizaciones, solo cuando el Comité selló la asignación. La fórmula viaja con los números reemplazados y la palabra "ilustrativo".
- **Alternativa descartada:** medir la confiabilidad real de los agentes, o no mostrar ningún número.
- **Por qué:** explica en una cifra por qué no dejamos decidir a un agente solo: 0,92 por paso se vuelve 43% en diez pasos. Medirlo de verdad exige un benchmark que no existe para este caso.
- **Costo:** los valores de `p` (0,90 a 0,95) vienen de la semilla. No se puede presentar como evidencia del rendimiento de ningún modelo.

## El agente propone y no decide

- **Decisión:** el agente de rol (`src/agents/role-agent.ts`) recibe la vista ya filtrada de su rol y devuelve un texto y un valor sugerido. Solo corre cuando la persona del rol lo pide (`RUN_ROLE_AGENT`). `applyAgentProposal` del motor limita el efecto a una sola cosa: si quien pidió es el proponente, el valor sugerido pasa en ese mismo momento a ser el valor propuesto del caso, sin otra confirmación. Eso puede bloquear o abrir la compuerta, pero nunca la firma, nunca sella la asignación y nunca toca una regla.
- **Alternativa descartada:** agentes que negocian entre sí y cierran la decisión.
- **Por qué:** el track es Multiplayer, no simulación. Las personas deciden; el agente les ahorra redactar. Además, un agente que no recibe un dato no lo puede filtrar.
- **Costo:** no hay automatización de punta a punta. Cada paso espera a una persona.

## Motor de reglas puro, separado del almacén

- **Decisión:** `src/lib/engine/deterministic.ts` solo tiene funciones puras: reciben el estado y el reloj (`nowTs`) y devuelven un estado nuevo o un rechazo. `src/lib/store/rooms.ts` guarda el estado, comprueba identidad y avisa a las conexiones.
- **Alternativa descartada:** reglas mezcladas con las rutas y el estado global.
- **Por qué:** un motor puro se prueba sin red, sin reloj y sin modelo, y da el mismo resultado siempre. Las pruebas congelan el estado de entrada para comprobar que el motor no lo modifica.
- **Costo:** cada cambio copia partes del estado en vez de modificarlo en el lugar.

## Token por rol en vez de cuentas

- **Decisión:** `JOIN_ROLE` entrega un token aleatorio de 24 bytes. Toda acción posterior y la conexión SSE lo presentan. Los tokens viven en el almacén, fuera de `RoomState`, y se comparan en tiempo constante (`tokenMatches`).
- **Alternativa descartada:** inicio de sesión con cuentas, o confiar en el `roleId` que envía el navegador.
- **Por qué:** alguien del público tiene que poder entrar como Comité escaneando un QR, sin registrarse. Sin token, cualquiera podría actuar como otro rol cambiando un parámetro.
- **Costo:** no sabemos quién es la persona, solo qué rol tiene. Un rol sin conexión por 45 segundos queda libre para otra persona.

## Estado de salas en memoria y eventos SSE

- **Decisión:** las salas viven en memoria del servidor (`Map` en `src/lib/store/rooms.ts`) y los cambios se envían por Server-Sent Events. Las salas `demo` y `demo-cross` se recrean solas desde la semilla.
- **Alternativa descartada:** base de datos con suscripciones en tiempo real, o WebSockets.
- **Por qué:** no requiere configurar ningún servicio externo y funciona igual en el deploy y en una red local sin internet. SSE basta porque los clientes solo necesitan recibir; las acciones van por peticiones normales. En 36 horas, una dependencia menos que puede fallar en la demo.
- **Costo:** el estado se pierde al reiniciar y no se reparte entre varios servidores.

## Cada mensaje SSE lleva la sala completa

- **Decisión:** cada mensaje es un `ProjectedRoomState` entero. Mientras el contador corre se envía uno por segundo con el reloj del servidor.
- **Alternativa descartada:** enviar solo diferencias, o que cada navegador lleve su propio reloj.
- **Por qué:** un cliente que se conecta tarde o pierde un mensaje queda al día con el siguiente, sin lógica de reparación. Con el reloj del servidor, todas las pantallas muestran el mismo tiempo.
- **Costo:** más bytes por mensaje y una proyección por conexión por segundo. Probado con 500 conexiones en local; no se midió en el deploy.

## Pruebas de la API por HTTP sin levantar Next

- **Decisión:** `tests/helpers/route-server.ts` sirve los Route Handlers reales con un servidor de Node, y `tests/http.test.ts` corre contra él los mismos scripts que se usan contra un servidor de verdad (`scripts/e2e.mjs`, `scripts/load-test.mjs`).
- **Alternativa descartada:** pruebas con navegador, o probar solo funciones sueltas.
- **Por qué:** comprueba lo que de verdad viaja por la red, con varias conexiones SSE a la vez, dentro de `npm test` y en segundos.
- **Costo:** no pasa por el enrutador de Next. Para eso el mismo script se corre contra `npm run dev` o contra el deploy.

## Una sola capa de modelos con dos proveedores

- **Decisión:** todo el código llama a `src/lib/llm.ts`; nadie habla con un proveedor directamente. Adentro hay dos caminos, elegidos con `LLM_PROVIDER`:
  - `anthropic`: Claude con el SDK oficial de Anthropic. Usa `fallbacks` (si el modelo declina, la API reintenta sola en un modelo de respaldo) y `effort` configurable con `LLM_EFFORT`. Es lo que usa el deploy público.
  - cualquier otro valor: protocolo de chat compatible con OpenAI, que es lo que expone Ollama en el Spark o en un notebook (`LLM_BASE_URL`, `LLM_API_KEY`).
- **Alternativa descartada:** usar solo el modelo local del Spark, o llamar al SDK de cada proveedor donde se necesite.
- **Por qué:** el deploy público corre en internet y no puede llegar al Spark, que está en la red local de la sede. Con una sola capa, pasar de uno a otro es cambiar variables de entorno (`LLM_PROVIDER`, `LLM_MODEL` y las del proveedor), sin tocar código. Si el Spark falla en la demo, el cambio toma segundos.
- **Costo:** hay dos caminos de código que probar, las respuestas pueden diferir entre modelos y las funciones exclusivas de Claude (fallbacks, effort) no existen en el camino local.

## La telemetría dice dónde corre el modelo

- **Decisión:** `getTelemetry` (`src/lib/llm.ts`) informa `provider` (`local` o `cloud`), el host y `bytesSentToCloud`, que cuenta lo enviado a un host que no es local. Viaja en cada mensaje SSE.
- **Alternativa descartada:** el plan original fijaba `bytesSentToCloud` en 0 en el esquema.
- **Por qué:** el deploy público usa Claude, así que un 0 fijo sería falso. La pantalla muestra lo que pasa de verdad.
- **Costo:** "0 bytes a la nube" solo se puede decir mostrando el modo local.

## Render para el deploy público

- **Decisión:** el servidor público corre en Render como un proceso Node siempre encendido, descrito en `render.yaml`.
- **Alternativa descartada:** Vercel.
- **Por qué:** la colaboración en tiempo real necesita un proceso que se mantenga vivo y comparta estado entre conexiones. Las funciones de Vercel no lo garantizan.
- **Costo:** el deploy sale de un repo personal espejo, porque Render no puede conectarse al repo de la organización. En el plan gratis el servicio se duerme sin visitas.

## Chequeo de vida separado del chequeo del modelo

- **Decisión:** `/api/ping` responde 200 siempre que el servidor esté arriba; `/api/health` además revisa el modelo.
- **Alternativa descartada:** usar `/api/health` como chequeo de la plataforma.
- **Por qué:** si el proveedor del modelo falla, la plataforma no debe sacar el servidor de rotación; las salas siguen funcionando sin modelo.
- **Costo:** ninguno relevante.

## Vitest para las pruebas

- **Decisión:** Vitest, con el alias `@/` de `tsconfig.json` en `vitest.config.mts`.
- **Alternativa descartada:** el corredor de pruebas que trae Node.
- **Por qué:** entiende TypeScript y los alias sin configuración extra, y permite reemplazar los agentes por dobles para probar el almacén sin llamar a un modelo.
- **Costo:** una dependencia de desarrollo más.
