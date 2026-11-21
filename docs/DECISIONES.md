# Decisiones técnicas

Una entrada por decisión importante, la más reciente arriba. Sirve para responder "¿por qué lo hicieron así y no de otra forma?".

Formato de cada entrada:

- **Decisión:** qué elegimos.
- **Alternativa descartada:** qué otra cosa consideramos.
- **Por qué:** la razón, en una o dos líneas.
- **Costo:** qué perdemos con esta elección.

---

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

- **Decisión:** el recurso escaso lo ordena una fórmula fija, `S = w_sev·gravedad + w_time·urgencia − w_delay·riesgo por demora` (`computeTriageScore`). Si los dos mejores puntajes difieren en menos que `tieEpsilon`, decide el desempate de equidad de la regla; por defecto gana quien tiene mayor necesidad sin cubrir (`resolveAllocation`). Empate total: orden alfabético del caso.
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

## El agente propone; nunca cambia el estado por su cuenta

- **Decisión:** el agente de rol (`src/agents/role-agent.ts`) recibe la vista ya filtrada de su rol y devuelve un texto y un valor sugerido. Solo corre cuando la persona del rol lo pide (`RUN_ROLE_AGENT`). `applyAgentProposal` del motor limita el efecto: a lo más cambia el valor propuesto del caso, si quien pidió es el proponente.
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
