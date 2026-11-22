# Decisiones técnicas

Una entrada por decisión importante, la más reciente arriba. Sirve para responder "¿por qué lo hicieron así y no de otra forma?".

Formato de cada entrada:

- **Decisión:** qué elegimos.
- **Alternativa descartada:** qué otra cosa consideramos.
- **Por qué:** la razón, en una o dos líneas.
- **Costo:** qué perdemos con esta elección.

---

## La guía es un segundo agente de ElevenLabs que solo ve lo público

- **Decisión:** «Sculptor · Guía» es un agente de ElevenLabs separado del asistente del Comité (`src/integrations/guide-agent.ts`). Explica qué es Sculptor y guía la demo en una o dos frases, con trato de usted. Su única herramienta, `estado_sala`, devuelve una frase armada con la vista general de la sala (la misma de la pantalla grande), así que nunca lleva un dato reservado. En la web se abre por voz o por texto con una URL firmada (`POST /api/guide/voice`) y el SDK `@elevenlabs/client`, que ya usaba el Comité.
- **Alternativa descartada:** reutilizar el agente del Comité, o un chat propio con `src/lib/llm.ts`.
- **Por qué:** el agente del Comité registra decisiones; la guía no debe poder hacer eso, así que no comparte herramientas. Voz y texto en el mismo agente, sin otro canal, y sin dependencias nuevas.
- **Costo:** como el asistente del Comité, el modelo de conversación corre dentro de ElevenLabs y es una excepción a «todo pasa por `src/lib/llm.ts`». No decide nada ni lee datos reservados.

## Un solo tema para toda la app, en data-theme de <html>

- **Decisión:** el tema claro u oscuro es uno para toda la app: `data-theme` en `<html>`, fijado por un script en el `<head>` antes de pintar (lo elegido en `localStorage`, clave `sculptor:theme`, o la preferencia del sistema). Cada pantalla tiene el mismo botón (`ThemeToggle`) y lo lee con `useTheme()`. El deck estático repite el script.
- **Alternativa descartada:** que cada pantalla guardara su propio tema (la pantalla grande tenía `nexo:stage-theme` y partía en oscuro), o un proveedor de React que lo aplicara después de cargar.
- **Por qué:** la elección se comparte entre páginas y pestañas, y como el atributo está antes del primer pintado no hay destello blanco en oscuro. Un proveedor de React lo aplicaría tarde.
- **Costo:** el `<html>` lleva `suppressHydrationWarning`, porque el servidor no sabe el tema; el ícono del botón se corrige al montar.

## Los componentes de 21st.dev se adaptan con CSS y GSAP, sin framer-motion

- **Decisión:** las cuatro piezas elegidas de 21st.dev (`docs/diseno/21st/`) se reescribieron para las páginas de caso: tipografía cinética y foco con CSS (`kinetic-hero.tsx`), rayos SVG animados con CSS (`how-beam.tsx`), marco 3D con GSAP ScrollTrigger (`stage-scroll.tsx`) y bento oscuro con CSS (`seen-bento.tsx`). Con `prefers-reduced-motion` todo queda quieto y completo. Los íconos son de lucide: sin logos de terceros, tampoco el de WhatsApp. La captura de la pantalla grande de cada caso es real: una sala de demo de ese escenario jugada hasta el paso Comité (`public/casos/`).
- **Alternativa descartada:** agregar framer-motion (`motion`), que usan los cuatro originales.
- **Por qué:** GSAP ya estaba instalado y lo usa la portada; una dependencia más pesa en el bundle y suma otra forma de animar.
- **Costo:** si cambia mucho la pantalla grande, hay que volver a sacar las tres capturas.

## Páginas de caso de uso con el mismo armado y cifras del motor

- **Decisión:** `/casos/hospitales`, `/casos/construccion` y `/casos/logistica` se arman con los mismos componentes de `src/components/casos/`: el texto de cada caso es un objeto (`CaseStudy`, en `content.ts`) y las cifras (puntajes y qué ve cada rol) las calcula `caseView` (`data.ts`) en el servidor, proyectando la sala de demo del escenario con el mismo motor. Los nombres de cada organización salen de `demoSeats`, así que son los mismos que la gente ve en la demo de ese rubro («Cordillera», «Litoral Sur»…). Cada página abre la sala de demo fija de su escenario y enlaza a las otras dos.
- **Alternativa descartada:** escribir la página de los hospitales a mano, con los puntajes y los candados copiados.
- **Por qué:** así las cifras no se desactualizan y lo que se muestra como reservado es exactamente lo que el servidor no envía a ese rol. La portada general es de Ramón; esta página solo la enlaza una vez.
- **Costo:** la tabla de «qué ve cada uno» muestra dos datos por organización (el costo primero), no todos.

## Demo pauteada: la pantalla le habla a cada persona por su rol, y el turno lo decide el servidor

- **Decisión:** en las salas de demo, la pantalla grande muestra una franja gigante con el turno («Clínica: presenta a tu paciente», «Comité: ¿aceptas o rechazas?»), resalta el asiento o la tarjeta de esa persona y, si el servidor la manda, la cuenta regresiva del plan B. Cada persona es su rol y su color: «Clínica», «Hospital Rural», «Comité». El orden de llegada (`seatOrder`) y el nombre corto (`seatLabel`) viajan en el estado, igual que el turno (`turn`); la pantalla los lee en `demoTurn` (`src/components/stage/story.ts`) y los dibuja en `turn-band.tsx`. Mientras falta gente, el turno es de la primera silla libre: «Clínica: escanea el QR». El guion del narrador está en `docs/GUION_DEMO.md`.
- **Alternativa descartada:** numerar a las personas («Jurado 1, 2, 3»), o que la pantalla calcule su propia cuenta regresiva de 20 s.
- **Por qué:** quien juega no lee; escucha al narrador, que lo llama por su rol, y ve ese mismo rol en pantalla. Un número no le dice qué es. La cuenta regresiva solo tiene sentido si al llegar a 0 pasa algo, y eso lo hace el servidor (juega el turno y lo marca como automático); una cuenta local mentiría.
- **Costo:** sin un servidor que mande `turn`, la pantalla deduce el turno pero no muestra cuenta regresiva.

## La pantalla grande lee de la sala qué asientos juega un bot y si es de demo

- **Decisión:** el estado proyectado trae `demo` (la sala es de demo: 3 personas) y, por asiento, `bot` (`role.bot` y `scarcity.arbiter.bot`: lo tiene un bot del piloto automático, y cuenta como conectado toda la ronda). La pantalla grande los lee en `stageSeats` e `isDemoRoom` (`src/components/stage/seats.ts`). Si `bot` no viene, usa `autopilot.botSeats` mientras el ensayo corre.
- **Alternativa descartada:** deducirlo en el navegador: por el id de la sala (`demo-*`) o porque el ensayo juega a quienes aprueban.
- **Por qué:** quién es una persona y quién es un bot lo sabe el servidor, que es quien sienta a los bots. Si el navegador lo adivinara, una sala propia de demo o un ensayo a medias se verían mal, y la pantalla podría mostrar como persona a un bot.
- **Costo:** dos campos más en cada mensaje SSE. Un servidor anterior a este cambio no manda `demo`, y la pantalla lo trata como sala completa.

## La demo es de 3 personas y 4 pasos; los modos completos siguen

- **Decisión:** en una sala de demo, la pantalla grande muestra solo 3 asientos de personas, grandes («Clínica · Urgencias», «Hospital Rural · Turno», «Comité»), y los aprobadores, pequeños y con el chip «automático». Los pasos son Unirse → Casos → Comité → Acta: «Límites» desaparece porque los límites y las firmas internas los hace el piloto automático, y la frase de abajo nunca los pide. «Unirse» termina cuando entran los dos que presentan. Al cerrar el acta, el anfitrión tiene un botón grande «Nueva ronda» (el mismo reinicio de siempre, `DELETE /api/rooms/:id`).
- **Alternativa descartada:** simplificar todas las salas, o esconder los aprobadores sin decir que son bots.
- **Por qué:** una persona que no conoce la demo no entendía el paso «Acuerden el límite» ni por qué hacían falta 5 personas. Con 3 personas y 3 toques se entiende sola. Mostrar a los bots, con su chip, evita presentar como persona lo que hace el piloto automático.
- **Costo:** en la demo no se ve el choque de autoridad dentro de cada hospital. Sigue en las salas completas (las que no son de demo) y en la bitácora.

## La galaxia de la pantalla grande se dibuja con los asientos reales, en canvas 2D

- **Decisión:** `src/components/stage/galaxy.tsx` porta el prototipo de Nahum (`docs/diseno/nahum/resultado_orbital_live.html`) a un componente React con canvas 2D y sin dependencias. Cada asiento que el SSE marca como conectado (`stageSeats`, `src/components/stage/seats.ts`) enciende un nodo, una órbita de su color y su región de la esfera. Es un solo canvas detrás del contenido: protagonista en el paso «Unirse» y fondo tenue después.
- **Alternativa descartada:** llevar el prototipo tal cual, con sus atajos de teclado, su simulador de entradas y las escenas de sistema solar y galaxia espiral; o usar una librería 3D.
- **Por qué:** en la pantalla nada se mueve sin una persona. Un nodo que aparece con una tecla mostraría gente que no está. El canvas 2D alcanza para una esfera con pocos nodos y no suma peso al bundle.
- **Costo:** se perdieron las escenas de alejamiento del prototipo (sistema solar, cúmulo y espiral), que solo existían como relato del pitch. Con `prefers-reduced-motion` la galaxia no gira: se dibuja un cuadro cada vez que cambia un asiento.

## El paso «Unirse» dura hasta que entran quienes trabajan el caso

- **Decisión:** `roomStarted` (`src/components/stage/story.ts`) da por iniciada la sala cuando están conectados todos los asientos que no son del Comité, o cuando la bitácora ya trae trabajo sobre el caso (una regla sellada, un caso presentado, una firma o el ensayo automático). Hasta entonces la pantalla grande muestra «Unirse», y lo mantiene 2,6 segundos más para que se vea la esfera armada.
- **Alternativa descartada:** lo anterior: salir de «Unirse» apenas entraba la primera persona.
- **Por qué:** con la regla anterior el contador no alcanzaba a crecer en pantalla. El Comité no cuenta porque entra más tarde, con su propio código.
- **Costo:** si alguien se desconecta antes de que pase algo en la sala, la pantalla vuelve a «Unirse». Es una regla de presentación en el navegador; el motor no la conoce.

## La pantalla grande y la portada dicen poco: lo demás va detrás de «¿Por qué?»

- **Decisión:** en `/stage` y en la portada cada pantalla lleva un título de hasta 6 palabras y, como mucho, una frase de apoyo de hasta 12. Las explicaciones se pliegan detrás de «¿Por qué?» (`<details>`) o se quitaron. Los datos reservados se muestran con una o dos palabras y una barra de franjas diagonales en vez del valor. Hay un solo aviso de demostración simulada, en el pie.
- **Alternativa descartada:** mantener los párrafos explicativos a la vista.
- **Por qué:** el mentor lo dijo así: «bombardean con texto todo, eso no aporta». Una pantalla proyectada se lee en cinco segundos desde lejos.
- **Costo:** quien no despliega «¿Por qué?» no lee, por ejemplo, la razón del desempate. La bitácora completa, con sus códigos, sigue en «Ver registro» y en el acta.

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

- **Decisión:** el ensayo (`src/lib/engine/autopilot.ts`) es el guion de la demo como datos. Cada paso llama a la función del motor que usaría una persona, desde el puesto que corresponde. Los bots solo toman puestos libres y todo queda marcado (`AUTOPILOT`, `bot: true` en la entrada de cada bot, y `automatic: true` en cada decisión del piloto, que el acta lista aparte). Es control de anfitrión. Adaptado del `autopilot.ts` de Ramón.
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

- **Decisión:** para adaptar Sculptor a otra organización, el modelo escribe solo un objeto JSON con contenido (nombres de roles, datos, caso). El código fija la estructura (`normalizeGenome` en `src/agents/mutate-genome.ts`) y `OrgGenomeSchema` (`src/lib/genome/schema.ts`) decide si se usa. La interfaz (la silla del celular en `src/components/seat/` y la pantalla grande en `src/components/stage/`) es código fijo que dibuja cualquier genoma válido.
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

- **Decisión:** las salas viven en memoria del servidor (`Map` en `src/lib/store/rooms.ts`) y los cambios se envían por Server-Sent Events. Las cuatro salas fijas (`demo`, `demo-cross`, `demo-construccion` y `demo-logistica`) se recrean solas desde la semilla.
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

## Sorteo de silla en una ruta propia, no como acción

- **Decisión:** el QR único de la sala abre `/room/<id>` sin rol, y el celular pide `POST /api/rooms/:id/seat`. El servidor elige una silla libre (al azar en las salas normales, donde el Comité solo entra con la clave del QR; por orden de llegada en las de demo, donde el Comité entra sin clave, ver más abajo) y entrega su token, igual que `JOIN_ROLE`.
- **Por qué:** una acción de `/action` exige `orgId` y `roleId` de quien actúa, y el recién llegado todavía no tiene. Agregarla como acción número 12 obligaba a volver opcional ese par en todo el contrato. En una ruta aparte, el contrato de las 11 acciones y sus pruebas quedan igual.
- **Descartado:** sortear en el navegador y llamar a `JOIN_ROLE`. Dos personas que escanean a la vez sorteaban la misma silla y una recibía 409; en el servidor el sorteo y la reserva son un solo paso.
- **Límite conocido:** «Sortear otro rol» solo se ofrece a quien llegó por sorteo; quien entró por el QR de un rol puede salir desde la pestaña «Sala».

## La silla del celular reemplaza a los órganos apilados

- **Decisión:** el teléfono muestra una tarjeta por turno, un botón abajo y tres pestañas (`src/components/seat/`). Los órganos que se apilaban (caso, niebla, contador, tablero, agente) se borraron; el grafo y el choque de autoridad quedan plegados en «Sala».
- **Por qué:** el mentor dijo que la pantalla «bombardea con texto». La pantalla del Comité pasó de 184 a 66 palabras visibles y ningún turno necesita desplazarse en 390 × 844.
- **Descartado:** recortar el texto de los órganos existentes. Cada uno repetía su contexto y juntos seguían sin caber en una pantalla.

## Marca de los asientos bot y de la sala de demo

- **Decisión:** el estado de la sala guarda los asientos que juega un bot en `RoomState.botSeats` (lista de `{ orgId, roleId }`). Lo escribe el motor: `markRoleJoined` con `{ bot: true }` agrega el asiento, y una persona que entra a ese asiento (o `markRoleLeft`) lo quita. La vista que viaja por el SSE lo proyecta por asiento: `orgs[].roles[].bot` y `scarcity.arbiter.bot` (boolean). Un asiento bot cuenta como `connected: true` toda la ronda. La sala de demo se marca con `RoomState.demo`, que viaja como `room.demo` (boolean). La pantalla grande lee esos tres campos; `room.autopilot` (paso actual, total, `botSeats`) sigue disponible para mostrar el avance del piloto.
- **Por qué:** la marca vive en el estado y no solo en el piloto automático porque el piloto termina sus pasos en unos segundos, y los bots deben seguir viéndose como bots (y conectados) hasta el acta. Al estar en el motor, sirve igual para la sala de demo y para el ensayo automático del anfitrión, y queda en la bitácora con `bot: true`.
- **Descartado:** marcar los bots solo con `autopilot.botSeats`. Desaparecía la marca cuando el piloto se detenía y no distinguía un asiento que después tomó una persona.

## Demo de 3 personas con bots en los roles administrativos

- **Decisión:** en las salas de demo, las personas solo presentan los casos y el Comité decide; el límite y la firma de cada organización los hacen bots del piloto automático, que arrancan al entrar la primera persona. El reloj de espera cuenta desde esa primera persona, y la sala se reinicia con «Nueva ronda» o sola 2 minutos después del acta.
- **Por qué:** Ramón pidió que la demo la pueda hacer gente que no la conoce. Probándola como novato, Sebastián encontró que hacían falta 5 personas, que el paso de límite y firma no se entendía y que el reloj de la sala fija marcaba casi 2 horas (contaba desde que se creó la sala).
- **Descartado:** borrar el paso de límite y firma. Es la regla de autoridad del suelo y sigue completo en las salas normales y en la sala de una clínica; en la demo lo juegan bots a la vista.
- **Tras una ronda, los teléfonos viejos no recuperan su silla.** Decisión de Sebastián: prioridad a que el siguiente grupo pueda jugar. Fuera de la demo, una pestaña que pierde su token (por ejemplo, porque el servidor se reinició) vuelve a tomar su silla sola; en una sala de demo no (`shouldRecoverSeat` en `src/lib/client/use-room.ts`): tras «Nueva ronda» o el reinicio automático, el teléfono vuelve a «Elige tu silla» con «Sortear mi rol» y el aviso «Empezó una ronda nueva». Descartado: recuperar la silla y liberarla a los 45 s sin señal, porque un teléfono con la página abierta nunca la soltaba.

## En la demo, el Comité entra sin clave y «Nueva ronda» no pide token tras el acta

- **Decisión:** en las salas de demo, el sorteo del QR único reparte también el asiento del Comité sin la clave de su QR (desde la ronda 12, por orden de llegada: el tercero es el Comité). Y con el acta cerrada, `DELETE /api/rooms/:id` («Nueva ronda») funciona sin token de anfitrión (`canResetWithoutHost` en `src/lib/store/rooms.ts`). En las salas normales todo sigue igual: el Comité solo con la clave y el reinicio solo con el token.
- **Por qué:** en una prueba con 3 celulares contra el deploy, el tercero vio «No quedan sillas libres» y la demo quedó trabada en «Falta: el Comité decide». En producción, una sala fija no entrega su token ni la clave del Comité sin `NEXO_ADMIN_KEY` (`POST /api/rooms/demo-cross/host` responde 403), así que la pantalla grande no podía mostrar el QR del Comité ni reiniciar la sala.
- **Riesgo:** cualquiera que escanee el QR único de una sala de demo puede terminar siendo el Comité y decidir la asignación, y cualquiera puede empezar una ronda nueva apenas se cierra el acta, aunque el grupo quiera seguir mirando el resultado. Se acepta porque las salas de demo tienen datos simulados y son para mostrar el producto, no para decidir nada real. Lo que no cambia: antes del acta nadie sin token puede reiniciar (una ronda en curso no se puede borrar), `JOIN_ROLE` directo al Comité sigue pidiendo la clave, y cada decisión sigue exigiendo una razón y queda en el acta.
- **Descartado:** definir `NEXO_ADMIN_KEY` en Render y abrir la pantalla grande con esa clave. Es lo correcto para un despliegue serio y sigue disponible, pero obliga a quien presenta a tener y escribir la clave en el momento, y si falla la demo se traba igual.

## Demo pauteada: asientos por orden de llegada, el rol en grande y plan B a los 20 s

- **Decisión:** en las salas de demo el narrador guía en voz alta y quien juega no lee. Los asientos se reparten por orden de llegada, no al azar: 1.º la Clínica (quien presenta el primer caso), 2.º el Hospital Rural (el segundo) y 3.º el Comité. El servidor proyecta, solo en la demo, `seatOrder` (orden fijo, para el narrador; no se muestra como número), `seatLabel` (el nombre corto que se muestra: «Clínica», «Hospital Rural», «Comité») y `turn` (a quién le toca, con `remainingMs` y `totalMs`). El celular muestra «Eres la Clínica» en grande con su color, una sola línea, y cuando no es su turno solo «Espera: le toca al Hospital Rural»; cuando le toca, un botón enorme. El Comité ve «¿Aceptas o rechazas?» con una razón precargada («por equidad») que cambia con un toque; la razón sigue siendo obligatoria y queda en el acta tal como la eligió. Si la persona del turno no actúa en 20 s, el piloto juega por ella (plan B): presenta el caso, o el Comité acepta la propuesta de la regla, y queda en el acta con `modo: "automático"` y una razón que empieza con «Automático (plan B)».
- **Por qué:** Sebastián quiere que en el pitch el narrador llame a cada juez por su rol («usted es la Clínica», «Comité, ¿acepta o rechaza?») y que la demo nunca se detenga porque alguien no encontró el botón. No se muestra «Jurado 1/2/3»: la identidad de cada persona es su rol y su color.
- **Configuración:** `NEXO_DEMO_TURN_MS` cambia el plazo (por defecto 20 000; `0` apaga el plan B). Una sala nueva puede pedir otro plazo con `POST /api/rooms { mode: "cross_org", demo: true, turnMs }`. En las salas normales no hay orden de llegada, ni turno ni plan B.
- **Riesgo:** con el plan B, una decisión del Comité puede tomarla el piloto si la persona no responde a tiempo. Se acepta porque es una sala de demo con datos simulados; la decisión automática queda marcada como tal: `automatic: true` en la decisión, `modo: "automático"` en la bitácora y una sección «Decisiones automáticas» del acta, separada de las humanas. Firma con el asiento de la persona, pero nunca se presenta como si la hubiera tomado ella.
- **Descartado:** obligar el orden en el servidor (rechazar que el Hospital Rural presente antes que la Clínica). El orden lo guía el celular; el servidor sigue aceptando cualquier acción válida, que es lo que ya prueban las demás pruebas.

## Notas de voz por WhatsApp: solo informan, dentro de la ventana de 24 h

- **Decisión:** con `NEXO_VOICE_NOTES=1`, el Comité recibe por WhatsApp dos audios cortos: el caso cuando le llega (además de los botones) y el acta cuando se sella. El texto se arma con la misma vista filtrada que vería el Comité en su pantalla (`projectRoom`), ElevenLabs lo convierte a voz y Kapso lo sube y lo envía (`src/integrations/voice-notes.ts`). El audio no decide nada: la decisión sigue siendo con botón y razón escrita, por las mismas acciones que la web.
- **Por qué:** idea de Sebastián para que quien decide escuche el caso sin leer, en cualquier rubro. Por eso el texto usa los datos del escenario (recurso, organizaciones, «Paciente A», «Obra A» o «Carga A») y no frases de hospital.
- **Ventana de 24 h:** fuera de una conversación abierta, WhatsApp solo permite plantillas aprobadas. El audio se envía solo si el Comité escribió o tocó un botón en las últimas 24 h; si no, se omite sin error. Con un número de producción y plantilla, el audio del caso llega cuando el Comité toca un botón.
- **Formato:** se pide Opus a ElevenLabs (`opus_48000_64`). Si llega en contenedor OGG va como nota de voz; si no, se pide MP3 y va como audio normal. La referencia de la API no dice el contenedor del Opus, por eso se revisan los primeros bytes en vez de suponerlo.
- **Descartado:** servir el audio desde nuestro servidor con un enlace temporal. Se prefirió subirlo al endpoint de medios de WhatsApp (vía Kapso): no hay que exponer una ruta pública con archivos ni limpiar nada después.
- **Riesgo:** sin probar contra los servicios reales (ElevenLabs y Kapso) desde este equipo; solo con dobles. Un fallo de cualquiera de los dos se registra y el canal de WhatsApp sigue funcionando sin audio.

## Las decisiones del piloto automático se marcan y van aparte en el acta

- **Decisión:** toda decisión que toma el piloto automático (bots del ensayo o de la demo, y el plan B por tiempo) lleva `automatic: true` en `HumanDecision`, `automatic: true` y `modo: "automático"` en el evento de la bitácora, y el acta Markdown la lista en «Decisiones automáticas», separada de «Decisiones humanas» (`renderActaMarkdown`).
- **Por qué:** el ensayo final del agente de los jueces encontró que esas decisiones quedaban como decisiones humanas, sin marca, y que el acta las mezclaba con las de las personas. Eso contradecía el principio de no presentar nunca algo simulado como real.

## En la demo, «Rechazar» asigna el recurso al otro en un solo paso

- **Decisión:** en las salas de demo con dos candidatos, el veto del Comité sella la asignación al otro caso de una vez. La razón sigue siendo obligatoria y queda una sola decisión del Comité (el VETO); el acta agrega «El Comité rechazó la propuesta de la regla; el recurso va a <otro>».
- **Por qué:** Sebastián lo jugó con Ramón y Nahum: con dos candidatos, vetar obligaba a decidir dos veces sobre algo que ya era obvio. En las salas normales el veto se mantiene como antes (saca al propuesto y el Comité vuelve a decidir), porque con más candidatos o reglas reales no hay un «otro» evidente.

## El acta por WhatsApp para el Comité del celular, abriendo la conversación con wa.me

- **Decisión:** el celular del Comité ofrece «Recibir resumen por WhatsApp», que abre WhatsApp con «Hola, soy el Comité de la sala <código>» ya escrito. Ese mensaje abre la ventana de 24 h y el webhook asocia el número a la sala; al decidir le llega el acta (texto y nota de voz). Alternativa: escribir el número a mano, con el token del Comité. Si hay plantilla aprobada, se usa primero.
- **Por qué:** fuera de una conversación abierta, WhatsApp solo deja enviar plantillas aprobadas por Meta, y la aprobación podía no llegar a tiempo para la demo. Si la persona escribe primero, se le puede responder en texto y audio sin plantilla.
- **Privacidad:** el número vive solo en la memoria del servidor durante la ronda; un reinicio de la sala lo olvida. Nunca entra al estado de la sala, así que no viaja a ninguna pantalla (`tests/committee-summary.test.ts` lo comprueba).
- **Riesgo:** quien conozca el código de una sala puede asociar su número y recibir el acta de esa sala. El acta no trae datos reservados (sale de la vista del Comité), así que se acepta en las salas de demo.

## Negociación entre agentes: contrato de datos (ronda 20)

- **Decisión:** la demo pasa a 5 personas (Clínica·Urgencias, Clínica·Administración, Hospital Rural·Turno, Hospital Rural·Administración y Comité, por orden de llegada; los asientos vacíos los juega un bot marcado como automático). Cada persona tiene un agente que la asesora en su celular y le pide su postura con un toque. Después, los agentes negocian a la vista en la pantalla grande, solo en texto, y de ahí sale la propuesta que el Comité acepta o rechaza. La IA escribe, el código decide: los mensajes los redacta Claude (`src/agents/negotiation-agent.ts`, por `src/lib/llm.ts`) con la vista proyectada de su rol, y antes de publicarse se revisan buscando los valores reservados; si aparece uno, o si el modelo tarda más de 6 s, se publica el texto de respaldo determinista de ese rol y fase (`fallback: true`). La propuesta y los puntajes salen del motor (`resolveAllocation`), nunca del modelo.
- **Contrato que lee la pantalla grande** (en `ProjectedRoomState`, campos nuevos):

```ts
roomCode: string; // código de la sala: 4 a 6 caracteres legibles (sin 0/O ni 1/I), p. ej. "K7QMP". Las salas fijas conservan su id.
negotiation?: {
  phase: "positions" | "debate" | "proposal" | "decision" | "done";
  paused: boolean;
  nextAt: number | null; // reloj del servidor (ms) del próximo paso; con serverNowTs se calcula el desfase. null si está en pausa o espera a una persona.
  stepMs: number;        // pausa entre mensajes (6–8 s, configurable)
  typing: { orgId: string; roleId: string; agentLabel: string } | null; // agente que «está escribiendo» el próximo mensaje
  positions: Array<{ orgId: string; roleId: string; seatLabel: string; position: string | null; automatic: boolean }>;
  messages: Array<{
    id: string;
    orgId: string;
    roleId: string;
    agentLabel: string; // «Agente de Urgencias · Clínica»
    text: string;
    kind: "advice" | "position" | "argument" | "proposal" | "system";
    ts: number;
    fallback?: boolean; // true si es el texto de respaldo (el modelo tardó o el texto traía un dato reservado)
  }>;
  myOptions?: Array<{ id: string; label: string }>; // solo para el celular de ese rol, en la fase positions
  myPosition?: string | null;                        // solo para el celular de ese rol
} | null;
```

- **Quién ve qué:** los mensajes `advice` viajan solo al celular de su rol (la proyección los filtra en el servidor); el resto es público. `myOptions` y `myPosition` solo van a su rol.
- **Fases:** `positions` (consejo privado y postura de cada uno; termina cuando las 4 posturas de las organizaciones están puestas, o al vencer el plazo, y entonces un bot pone las que faltan, con `automatic: true`) → `debate` (un argumento por agente, uno cada `stepMs`) → `proposal`, en dos momentos: primero «la regla está calculando» (`typing` con la regla, sin mensaje `proposal`, `allocation.status` aún `PENDING`); después se presentan los casos, llega el mensaje `proposal` armado por el código con el resultado del motor y la fase SIGUE en `proposal` un paso más (`typing: null`, `nextAt = ahora + stepMs`) para que la pantalla muestre la propuesta. «La propuesta llegó» se lee de `allocation.status === "PROPOSED"` con `allocation.ranking` no vacío, no del texto → `decision` (el Comité acepta o rechaza; sigue el plan B de 20 s) → `done`.
- **Asientos:** en la negociación son 5, con `seatOrder` 1 a 5 y `seatLabel` «Clínica · Urgencias», «Clínica · Administración», «Hospital Rural · Turno», «Hospital Rural · Administración», «Comité».
- **Acciones:** `SET_POSITION { optionId }` (una persona, un toque, en la fase `positions`). Controles del narrador (anfitrión): `POST /api/rooms/:id/negotiation` con `x-host-token` y `{ action: "pause" | "resume" | "advance" }` (las tres de la consigna: NEGOTIATION_PAUSE, NEGOTIATION_RESUME y NEGOTIATION_ADVANCE).
- **Ejemplo** (lo que recibe la pantalla grande en mitad del debate):

```json
{
  "roomCode": "K7QMP",
  "negotiation": {
    "phase": "debate", "paused": false, "nextAt": 1795300012000, "stepMs": 7000,
    "typing": { "orgId": "hospital_rural", "roleId": "role_a", "agentLabel": "Agente de Turno · Hospital Rural" },
    "positions": [
      { "orgId": "clinica_andes", "roleId": "role_a", "seatLabel": "Clínica · Urgencias", "position": "Pedir la cama ahora", "automatic": false },
      { "orgId": "clinica_andes", "roleId": "role_b", "seatLabel": "Clínica · Administración", "position": "Respaldar el pedido", "automatic": true }
    ],
    "messages": [
      { "id": "m3", "orgId": "clinica_andes", "roleId": "role_a", "agentLabel": "Agente de Urgencias · Clínica", "text": "Nuestro paciente es el más grave y no puede esperar el traslado.", "kind": "argument", "ts": 1795300005000 }
    ]
  }
}
```

- **Por qué:** Sebastián jugó la demo y era demasiado rápida y mecánica: nadie veía cómo actuaban los agentes. Con la negociación a la vista se entiende que cada organización defiende lo suyo sin mostrar sus datos, y que la decisión la toman la regla y una persona.


## Un valor reservado no puede coincidir con un número público (ronda 20)

Al pasar la gravedad a la escala de 1 a 50, el campo reservado `triage_criticality` quedó en 45/50 y 40/50: justo el puntaje público de gravedad (`clinicalSeverityScore` 0,9 y 0,8) multiplicado por 50. El servidor nunca envió el valor a un visor ajeno, pero la pantalla grande calculaba «Gravedad N/50» desde el puntaje público y mostraba exactamente el dato reservado. Lo encontró la prueba de QA de p4 (`scripts/novato-demo.mjs`).

- **Elegido:** valores reservados proporcionales a los originales (18/40 → **23/50**, 22/40 → **28/50**), que no salen de ningún número público, y una prueba (`tests/negotiation.test.ts`) que abre el SSE real de la pantalla, del Comité y de cada rol ajeno hasta la fase de propuesta. Falla si llega el valor, y también si `round(clinicalSeverityScore × 50)` o `round(score × 50)` lo igualan. La pantalla grande muestra el puntaje compuesto de la regla y la etiqueta pública del caso, nunca una «Gravedad N/50».
- **Descartado:** dejar de enviar `clinicalSeverityScore` y el desglose `ranking[].terms`. Son la parte pública de la regla: sin ellos el Comité no puede ver por qué ganó un caso.

## Animaciones de la landing de Sculptor con GSAP, sin librerías nuevas

- **Decisión:** la landing de Sculptor (`/sculptor`) usa solo GSAP, que ya estaba en el repo: timeline para la intro, ScrollTrigger para el scroll y SplitText para los títulos. El logo se dibuja como un SVG con una celda por píxel (`galaxy-data.ts`, muestreado una vez desde el PNG) para poder mover cada píxel.
- **Alternativas descartadas:** Motion (framer-motion), Lenis para el scroll suave, Lottie o Rive para la intro y una escena de Three.js o Spline. Todas son gratuitas, pero suman una dependencia o un archivo exportado que hay que mantener aparte del código.
- **Por qué:** GSAP es gratuito con todos sus plugins desde 2025 y la portada ya lo usa con la misma regla (`src/components/landing/gsap.ts`): con movimiento reducido no corre nada y la página queda completa. Un SVG por celdas pesa menos que un video o un Lottie y comparte el dibujo entre la intro, el hero y la barra.
- **Costo:** la intro dura unos 6 segundos. Un clic o una tecla la acelera; con movimiento reducido o sin JavaScript no aparece.
- **Fondo de partículas:** WebGL2 escrito a mano (`atmosphere.tsx`, unas 5.000 estrellas en un solo `drawArrays`) en vez de Three.js. Para puntos con brillo aditivo bastan dos shaders cortos y no se suma una dependencia de ~150 KB. Sin WebGL2 no hay fondo y la página sigue igual.
- **Simulación orbital:** se incrustó el HTML del pitch en un iframe del mismo dominio en vez de portarlo a React. Portarlo eran horas; el iframe deja que el scroll recorra sus etapas por `window.__ORBITAL__` sin tocar el archivo. Costo: depende de Three.js en jsDelivr y de un video en CloudFront.

## La presentación es una página de la app, no un archivo de diapositivas

- **Decisión:** las láminas del domingo viven en `/presentacion` (`src/components/presentacion/`), con el guion de cada lámina en `slides.ts` y las notas del orador en la misma página.
- **Por qué:** la lámina del problema muestra pⁿ calculado por el motor, y «Desarrollo» muestra dos páginas reales del mismo deploy lado a lado; un PPT tendría capturas y cifras escritas a mano que se desactualizan. Además sigue la marca y el modo oscuro de la landing, como pidió la charla del evento.
- **Descartado:** seguir con el deck `public/pitch/index.html` como deck principal. Queda como respaldo; la nueva presentación agrega el saludo con nombre que pidió la charla, las notas del orador y el reloj de 3:00.
- **Limpieza de documentos:** se sacaron del repo los borradores del pitch que describían piezas que la app no tiene (deslizar la tarjeta, «7 órganos», «80 tests», «0 bytes a la nube» con el deploy, 10 jugadores con copilotos): el dossier en PDF, el guion en PDF, el deck «Cupo», el guion de 3:30, el kit de UX y los decks interactivos de `docs/diseno/nahum/`. Lo vigente es `docs/DEMO_DIA.md`.
- **La galaxia de la demo lee el SSE de la sala, no una base de datos.** Las salas viven en la memoria del servidor; Supabase solo guarda el formulario de acceso y las entrevistas. La presentación abre `GET /api/rooms/:id/events` sin credenciales (vista «stage», lo que todos pueden ver) y traduce `connectedPlayers`, `negotiation.phase` y `allocationStatus` a la galaxia. Las etapas de alejamiento (sistema solar, cúmulo y galaxia) son una metáfora visual del pitch, no datos de la sala.
- **Presentación local con la sala en un deploy público.** Si la presentación corre en un notebook, el QR de una sala local apunta a `localhost` y los celulares no lo pueden abrir. Con `PRESENTACION_DEMO_URL` la sala se abre en el deploy público: la pantalla grande se muestra desde ahí y sus eventos llegan por tres rutas puente del servidor (`/api/presentacion/sala`, `…/events` y `…/negotiation`), porque el navegador no puede leer el SSE de otro dominio. Las rutas solo hablan con esa URL fija, nunca con una que mande el cliente. Descartado: abrir CORS en el deploy (cambia la superficie pública de la API) y un túnel local (depende de la red de la sede).
- **El planeta de la demo solo se mueve con la sala.** La simulación orbital del pitch agrega un nodo con cada clic y trae títulos, contadores y controles: podía mostrar personas que no entraron. En la lámina en vivo se esconde toda su interfaz, el iframe no recibe clics y solo la mueve el SSE de la sala; el clic sobre el panel lo toma la presentación para el salto a la lámina siguiente.


## El agente del celular recomienda una postura que calcula el código

- **Decisión:** en la demo con negociación, el celular habla como «Tu agente»: se presenta («antes trabajaba solo, con tus datos; ahora me conecto con los agentes de los demás sin mostrarles lo tuyo»), traduce la postura a una pregunta concreta de su rol («¿Cuánto autorizas sin pedir firma?», con la cifra propia de cada respuesta) y dice «Te recomiendo X, porque…». La persona entrega una decisión cualitativa; su agente llega con los datos listos. Al Comité, su agente le resume la propuesta (puntajes públicos y si hubo desempate) y le recomienda aceptar, con la razón precargada que corresponde.
- **Por qué:** al escanear el QR, Sebastián no entendió qué le pedía el celular ni para qué servía. El valor del pitch es que el agente que antes trabajaba solo ahora se conecta con los de los demás, y eso tiene que leerse en cada pantalla.
- **Cómo se mantiene el principio «el código decide»:** la recomendación la calcula `positionPrompt` (`src/lib/engine/negotiation.ts`) con datos que ese rol ya ve; el modelo solo redacta el «porque», y si falla queda el texto de respaldo. El resumen del Comité lo arma `committeeBrief` (`src/components/seat/agent-text.ts`) sin modelo. La postura sigue sin cambiar el puntaje y el Comité sigue decidiendo.
- **Datos reservados:** las cifras de Administración (su costo, su presupuesto, el porcentaje sin firma de su regla) viajan solo en `myOptions` y en el consejo de ese rol; la etiqueta pública de cada postura no lleva cifras. Las pruebas de fugas de `tests/negotiation.test.ts` y `scripts/novato-demo.mjs` lo revisan.
- **Descartado:** una pantalla aparte de presentación del agente antes de las posturas. Agregaba un toque y cambiaba el flujo que muestran las páginas de caso; la presentación quedó como una línea dentro de la tarjeta «Tu agente».

## «Iniciar» de la demo sin clave de anfitrión, solo en el paso Unirse

- **Decisión:** la pantalla grande de una sala de demo con negociación muestra un botón «Iniciar» en el paso Unirse. Lo puede tocar cualquiera, sin token de anfitrión (`POST /api/rooms/:id/start`, `startDemo` en `src/lib/store/rooms.ts`): los asientos sin persona los toma un bot del piloto automático, marcado como automático (`bot: true`, postura `automatic: true`, `AUTOPILOT { via: "iniciar" }` en la bitácora), y la negociación arranca. Junto al código de la sala hay un contador grande «N/5» que solo cuenta personas; los bots van aparte («· 3 automáticos», `peopleCount` en `src/components/stage/negotiation.ts`).
- **Por qué:** con menos de 5 personas el narrador tenía que esperar los 60 s del plazo de posturas, o tener el token de anfitrión para «Siguiente». En el deploy la sala fija no entrega el token sin `NEXO_ADMIN_KEY` (ver «En la demo, el Comité entra sin clave…»), y presentar con 2 o 3 personas del público es lo normal.
- **Riesgo y límite:** cualquiera con la pantalla grande abierta puede iniciar la ronda antes de que lleguen todos. Se acepta porque solo vale mientras nadie dio su postura (`isJoining`): no adelanta un debate, no reinicia una ronda en curso y no toca el acta (409 `ROUND_STARTED`). Lo dispara una persona y los bots quedan marcados como automáticos, igual que el plan B, así que no rompe «nada se mueve sin una persona». Un bot que no es el Comité no decide nada: solo pone la primera postura de su rol.
- **Descartado:** pedir el token de anfitrión (en el deploy la pantalla grande de la sala fija no lo tiene) y reutilizar «Siguiente» del narrador (también es solo del anfitrión y en otras fases adelanta el debate, que sí debe quedar protegido).
