# Día de la demo · domingo 22 de noviembre

Plan para mañana: 3:00 exactos de demo y luego 2:00 de preguntas, solo de los jueces. Esta versión une dos guiones:

- la demo en vivo de 5 personas de `docs/GUION_DEMO.md`, que es lo que corre en la app;
- el guion de Nahum («SCULPTOR — Guion de Práctica en Vivo», PDF de 3:00), del que se toman la apertura «choque de fuerzas», el giro «la cama fue solo el primer átomo», la frase «la IA conversa, el código gobierna», el cierre con la galaxia NGC 253 y la válvula de escape.

Reemplaza el pitch de 3:30 de `docs/GUION_DEMO.md`: la charla oficial dice que son 3 minutos exactos y que a los 3:00 se corta el micrófono.

Rúbrica: originalidad 15 %, ambición 20 %, ejecución 20 %, técnica 25 %, impacto 20 %. Mientras presentamos, los jueces leen el repo. Por eso nada de lo que se dice puede contradecir el código.

Regla de este documento: toda cifra sale del repo. Lo que no está en el repo dice **«por verificar»**.

---

## Lo que NO se dice ni se muestra

El PDF describe piezas que solo existen en los prototipos de diseño (`docs/diseno/nahum/`), no en la app. Si se nombran, un juez que lea el repo no las va a encontrar.

| El PDF dice | Lo que hay en la app | Fuente |
|---|---|---|
| Pantalla dividida, «punto en el Polo Sur», alejamiento a sistema solar y a galaxia de 34.000 estrellas | Una galaxia en canvas que enciende un nodo por cada persona conectada y se pone verde al cerrar. Las escenas de alejamiento se descartaron a propósito | `docs/DECISIONES.md` (galaxia de la pantalla grande), `src/components/stage/galaxy.tsx` |
| El Juez 3 desliza la tarjeta hacia arriba o hacia abajo | Botones **Aceptar** y **Rechazar**, con la razón precargada | `src/components/seat/demo-view.tsx` |
| Botón «Espiar rival (403)» en el celular | En la sala de demo no existe. El «Ver» con 403 está en las salas normales, en la pestaña Secretos | `docs/PREGUNTAS.md` (17 y 20) |
| «Toquen el botón de su Agente» | Cada persona elige una **postura** entre 3, con un toque. Su agente ya le escribió un consejo | `docs/ARQUITECTURA.md` («Negociación entre agentes») |
| «3 jueces + 2 bots, el Juez 3 es el Comité» | Los asientos se reparten por orden de llegada y el **Comité es el 5.º** | `demoSeats` en `src/lib/engine/deterministic.ts` |
| 80 tests · 60 SSE | **507 pruebas** · **500 conexiones con p95 de 51,5 ms, en local**. 60 es solo la prueba chica de cada `npm test` | `npx vitest run` (ver abajo), `docs/MEDICIONES.md` |
| «7 órganos del esqueleto» | Los órganos apilados se reemplazaron por la silla del celular | `docs/DECISIONES.md` («La silla del celular reemplaza a los órganos apilados») |
| «Cero hola, somos el equipo 30» | La charla pide empezar con el nombre y una frase | Charla «Cómo hacer un buen demo» |

**Cifras que sí se pueden decir:** 507 pruebas sin modelo (`npx vitest run`: 507 de 507, sábado 21 a las 22:18, sobre una copia local; repetir sobre la rama final) · 500 conexiones con p95 de 51,5 ms en local · 0,52 contra 0,53 · margen de 0,02 · necesidad sin cubrir de 0,9 contra 0,4 · 7 s por mensaje · 6 s por agente · plan B a los 20 s · tres escenarios con el mismo motor.

**No decir:** «cero bytes a la nube» (solo vale en modo local, y el modo local no está verificado contra el Spark) · «Dell GB10» (`CLAUDE.md` dice NVIDIA DGX Spark) · una latencia del Spark o de Claude por frase (no están medidas) · «aislamiento criptográfico» (es un permiso por rol en el servidor) · «los pesos se acuerdan antes de deliberar» (la fórmula está fija en el código) · «webhooks o conector con Buk» (no existen).

---

## (a) La narrativa en 5 frases

1. Una organización no es una máquina: es un choque de fuerzas, dentro de ella y con otras organizaciones.
2. Cuando varias necesitan el mismo recurso escaso, como una cama UCI, no pueden decidir juntas: cada una tiene datos que no puede mostrarle a la otra.
3. Con Sculptor, cada persona entra con su rol y un agente que la asesora, y los agentes negocian a la vista sin que ningún dato reservado salga del servidor hacia el otro lado.
4. Los agentes conversan, el código gobierna: la propuesta sale de una regla determinista, y una persona del Comité la acepta o la rechaza con una razón que queda en el acta.
5. La cama es solo el primer átomo: el mismo motor ya corre para una grúa y un camión, y una frase arma una organización nueva.

---

## (b) Guion de 3:00 · Opción A (recomendada): 5 personas del público

### Quién hace qué

| Persona | Rol en la demo |
|---|---|
| **Nahum** | Narra todo. Es la única voz durante los 3:00. |
| **Ramón** | Opera la pantalla grande desde el computador del proyector: deck, `/stage/demo-cross`, **Pausa** (espacio) y **Siguiente** (→). |
| **Sebastián** | Está con el público: elige a las 5 personas, ayuda a quien no entra y activa el plan B. En las preguntas responde lo técnico. |

### Antes de empezar a hablar (no cuenta en los 3:00)

- La lámina 1 de la presentación ya está en pantalla completa (`/presentacion`, tecla `F`; notas del orador con `N` y reloj de 3:00 con `T`). El deck anterior sigue en `/pitch/index.html` como respaldo.
- La lámina 4 (en vivo) trae la pantalla grande real a la izquierda y la galaxia a la derecha. Pasar una vez por la lámina 4 antes de empezar: ahí se abre la sala y su QR, y queda abierta aunque se vuelva a la lámina 1. No recargar la página después: la pantalla grande abriría otra sala.
- En otra pestaña del **mismo computador** ya está abierta `/stage/demo-cross`, con su código y su QR. Pausa y Siguiente solo funcionan en el navegador que creó la sala.
- Sebastián tiene a 5 personas elegidas en primera fila, con el celular desbloqueado. Les dice antes: «Escaneen de a uno cuando yo los apunte».

### Segundo a segundo

| Tiempo | Bloque | Nahum dice | Pantalla grande (Ramón) | Sebastián |
|---|---|---|---|---|
| 0:00–0:07 | **Nombre y una frase** | «Hola, soy Nahum, del equipo 30. Esto es Sculptor: organizaciones que deciden juntas sin mostrarse sus datos.» | Lámina 1: logo de la galaxia y «1 cama UCI esperando · 2 vidas en riesgo». | Junto a las 5 personas. |
| 0:07–0:27 | **Problema (20 s)** | «Una organización no es una máquina: es un choque de fuerzas. Un área contra otra, un hospital contra otro. Cuando necesitan el mismo recurso, no pueden decidir juntas: cada una tiene datos que no puede mostrarle a la otra. Y hoy metemos agentes de IA en medio de esa tensión. Si cada agente tira para su lado, no obtenemos inteligencia: obtenemos caos más rápido. En un modelo simple, diez pasos con 92 % de acierto cada uno dan 43 %.» | Lámina 2: «Una organización es un choque de fuerzas» y el 43 % de pⁿ rotulado «modelo ilustrativo». | — |
| 0:27–0:42 | **Solución (15 s)** | «Sculptor sienta a personas y agentes en la misma mesa. Cada persona tiene un agente que la asesora, los agentes negocian a la vista, y la última palabra es de una persona. No se los quiero contar: saquen el celular.» | Lámina 3, «Ahora ustedes». A los 0:40, clic en «Abrir la pantalla grande»: aparecen el código gigante y el QR. | Levanta la mano: «¡Ustedes cinco!» |
| 0:42–1:00 | **Demo · Unirse (18 s)** | «Escaneen de a uno. La primera persona es Urgencias de la Clínica; la segunda, su Administración. Después, Turno y Administración del Hospital Rural. La quinta es el Comité.» Mientras escanean: «Fíjense en la galaxia: cada punto es una persona que acaba de entrar.» | Código, QR y «N de 5 personas conectadas». La galaxia enciende un nodo por persona. | Apunta a cada persona en orden. Si a los 15 s falta alguien, entra él con datos móviles. |
| 1:00–1:15 | **Demo · Posturas (15 s)** | «Su agente ya les escribió un consejo privado: solo lo ve cada uno. Elijan su postura: un toque.» | Cada asiento se enciende con su color y su postura. | Repite en voz baja, por rol, a quien no aprieta. |
| 1:15–2:00 | **Demo · Debate (~45 s)** | A los 1:20: «Ahora negocian los agentes. Cada uno defiende a su organización.» A los 1:40: «Ningún costo sale de su lado: el servidor ni siquiera se lo envía al otro, y si un agente intenta escribir uno, el servidor lo tapa.» | Un mensaje cada 7 s, con «escribiendo…». La Clínica habla a la izquierda y el Hospital Rural a la derecha. Si Nahum necesita aire: espacio para pausar. Si va lento: →. | Mira el reloj. A los 1:55 le hace la seña «propuesta» a Ramón. |
| 2:00–2:12 | **Demo · Propuesta (12 s)** | «Los agentes conversan, el código gobierna. La propuesta no la escribe la IA: la calcula una regla. Casi empate, 0,52 contra 0,53. Desempata la necesidad sin cubrir: el Hospital Rural.» | Tarjeta «Hospital Rural recibiría el recurso. La calculó el código, no un agente». En escala de 1 a 50: 26 contra 27. | — |
| 2:12–2:25 | **Demo · Comité (13 s)** | «Pero la última palabra es humana. Comité: ¿acepta o rechaza? Su razón ya está escrita.» | «Comité: ¿aceptas o rechazas?», con la cuenta regresiva de 20 s. | Junto al Comité. |
| 2:25–2:40 | **Demo · Acta (15 s)** | «Todas las pantallas cambiaron en el mismo segundo, y quedó un acta con la razón. Cinco personas, cinco agentes, una decisión que nadie podía tomar solo.» Si se probó esa mañana: «Comité, toque "Recibir resumen por WhatsApp"». | «Listo: Hospital Rural recibe el recurso», con la razón del Comité. La galaxia se pone verde. | Acerca el celular del Comité al micrófono si llega la nota de voz. |
| 2:40–3:00 | **Giro y cierre (20 s)** | «Esa cama fue solo el primer átomo. El mismo motor ya corre para dos constructoras y una grúa, y para dos distribuidoras y un camión. Por eso nos llamamos Sculptor: la galaxia que vemos desde Chile, donde del choque de fuerzas nacen estrellas nuevas. Ustedes cinco acaban de crear el primer mundo. Sculptor: donde el caos aprende a evolucionar.» | Se queda la galaxia verde del acta. | — |

**Si el Comité rechaza:** «El Comité rechazó: la cama va a la Clínica, y su razón queda en el acta.» Se dice en el mismo tiempo; no se agrega nada.

**Válvula de escape (del PDF):** si a los 2:40 todavía no hay acta, Nahum dice solo «Esa cama fue el primer átomo: el mismo motor sirve para una grúa o un camión. Sculptor: donde el caos aprende a evolucionar», y termina antes de los 3:00.

### Notas del guion

- **Caso real (lámina 3, «¿Y tiene posibilidad?»).** Un audio de TopSol con su problema (no saben qué priorizar en el presupuesto anual) y otro después de recibir el acceso, a 1,5×. La captura y los audios se muestran como llegaron, con su hora real (madrugada del 22 de noviembre): no se edita la hora. Agrega unos 23 s; la demo pasa a 1:02–2:45.
- **De dónde sale el problema.** De la narrativa de este documento (frases 1 y 2), de «Por qué no puede decidir una sola organización» en `docs/ARQUITECTURA.md` y de pⁿ (`docs/DECISIONES.md`, «p^n como modelo ilustrativo»). No se usa ninguna estadística externa: el repo no tiene una con fuente. Se sacó «lo arreglan por teléfono» porque es un relato que nadie validó con personas que asignan camas.
- **La cifra p^n de la lámina 2** (43,4 % → 96,1 %) es un modelo ilustrativo y no un dato del mundo (`docs/DECISIONES.md`, «p^n como modelo ilustrativo»). Si se deja en la lámina, Nahum dice «es un modelo ilustrativo». Si no, se saca.
- **Duración del debate: por verificar.** El repo mide unos 44 s desde la última postura hasta el turno del Comité, con la pausa por defecto de 7 s (`docs/MEDICIONES.md`, ronda 20). Si en el deploy dura más, Ramón aprieta → durante el debate. Se mide en el ensayo 1.
- **«La galaxia que vemos desde Chile»:** NGC 253 está en la constelación del Escultor, en el cielo austral. Es una galaxia con mucha formación de estrellas. El cierre la usa como metáfora; no dar cifras de la galaxia.
- **La skill de pitch frente a la charla:** la skill Hackathon Pitch Builder propone abrir con un gancho y cerrar con un *ask*. La charla pide un saludo con nombre y nada que vender. Seguimos la charla: el gancho va después del nombre, y el cierre muestra ambición en lugar de pedir algo.

### Opción B: los 3 jueces juegan

Más memorable, pero más frágil. Se usa solo si sale limpia en el ensayo 2.

- **El problema:** los asientos se reparten por orden de llegada (Clínica · Urgencias, Clínica · Administración, Hospital Rural · Turno, Hospital Rural · Administración, Comité). Si escanean solo 3 jueces, el tercero queda en Turno del Hospital Rural, no en el Comité.
- **Orden obligatorio:** Juez 1 → Sebastián → Juez 2 → una persona aliada del público → Juez 3. Así los jueces quedan en Urgencias de la Clínica, Turno del Hospital Rural y el Comité. Sebastián apunta a cada uno y nadie escanea antes de su turno.
- **Cambios al guion:** en Unirse, Nahum dice «Juez 1, usted es Urgencias de la Clínica…» y nombra a cada uno. Unirse sube a unos 25 s; se recorta lo mismo en el debate apretando → una vez.
- **Riesgos:** dos personas escanean a la vez y el Comité queda en otro asiento. Un juez prefiere seguir leyendo el repo. Un juez sin señal. En los tres casos se pasa a la opción A con el público, sin comentarlo.
- **Sebastián no puede atender el plan B mientras ocupa un asiento.** En la opción B, Ramón cubre el plan B desde la pantalla grande.

---

## (c) Preguntas del jurado, corregidas

Juntan las 12 técnicas de la versión anterior con las 16 del PDF de Nahum. Donde el PDF decía algo que el repo no respalda, la respuesta está corregida y lo dice. Cada respuesta dura unos 20 s. Las técnicas las responde Sebastián; las de producto, Nahum; las de pantalla y flujo, Ramón. La regla: primero la respuesta, después el detalle. Si algo no está medido, se dice «no lo medimos».

### Nivel 1 · Las obvias

**1. ¿Qué es real y qué es simulado?**
Son reales los permisos en el servidor, el tiempo real entre celulares, la regla, la asignación, el acta y los agentes con Claude. Son simulados los pacientes, los costos, los puntajes y las organizaciones. Los asientos vacíos los juega un bot marcado «automático», con `automatic: true` y en una sección aparte del acta. WhatsApp y voz están implementados, pero solo probados sin llamar a los servicios.
→ `docs/ARQUITECTURA.md` («Qué es real y qué es simulado»), `src/lib/engine/autopilot.ts`
*Corrige al PDF:* no hubo 403 en el celular ni deslizamiento en esta demo.

**2. ¿Por qué es Multiplayer y no una simulación de agentes?**
Porque ningún agente cambia la sala por su cuenta. Los agentes redactan, pero la propuesta la calcula el código, y nada se cierra sin que una persona del Comité acepte o rechace con una razón. Cada toque cambia todas las pantallas en el mismo segundo.
→ `CLAUDE.md` (principio 2), `src/lib/store/rooms.ts` (`applyAction`)

**3. ¿Por qué empezar con salud?**
Porque es el caso más tenso: dos organizaciones sin datos compartidos, datos reservados que no pueden mostrarse, urgencia y un tercero que decide. El mismo motor ya corre para una grúa y un camión, con las mismas pruebas.
→ `src/lib/genome/scenarios.ts`, `src/lib/genome/seeds.ts`

**4. ¿Por qué no Slack, WhatsApp o Zapier?**
En un canal compartido, todos ven todo. Aquí cada persona recibe una versión distinta de los mismos datos, filtrada en el servidor por organización y rol. Zapier automatiza pasos fijos. Sculptor ordena el recurso con una regla auditable, con desempate de equidad, y el veto exige una razón que queda en un acta.
→ `docs/PREGUNTAS.md` (24)

### Nivel 2 · Ingeniería, seguridad e IA

**5. ¿Cómo garantizan que un hospital no vea los datos reservados del otro?**
El dato no viaja. El servidor arma una vista distinta para cada organización y cada rol, y borra el valor antes de enviarlo: llega como `redacted: true`, sin el campo `value`. Una lectura ajena devuelve 403 y queda en la bitácora. Las pruebas buscan los valores secretos en el tráfico de cada participante.
→ `src/lib/engine/deterministic.ts` (`projectStateForOrgAndRole`, `attemptProtectedRead`), `tests/engine.test.ts`

**6. ¿Qué impide hacerle *prompt injection* a un agente para sacarle el costo del rival?**
Que el costo del rival nunca entra en su prompt: el agente recibe solo la vista proyectada de su rol. Además, antes de publicar, el servidor busca cada valor reservado en el texto, también escrito como «2,4 millones» o «23 de 50». Si aparece uno, se publica un texto de respaldo.
→ `src/agents/negotiation-agent.ts`, `src/lib/store/rooms.ts` (`writeNegotiationText`, `containsReserved`), `tests/negotiation.test.ts`

**7. ¿Qué hace la IA y qué no?**
La IA redacta: los argumentos, el consejo privado de cada persona y el genoma de una organización nueva. El código decide todo lo demás: permisos, orden de turnos, propuesta, asignación, plan B y acta. El motor no importa la capa de modelos, así que la sala funciona completa sin modelo.
→ `src/lib/engine/deterministic.ts`, `src/lib/llm.ts`, `docs/DECISIONES.md` («El agente propone y no decide»)

**8. ¿Los agentes negocian de verdad o es un guion?**
Los textos son de verdad: el modelo los escribe para cada rol, leyendo lo que ya dijeron los otros. El orden de los turnos y la propuesta los pone el código, a propósito: con o sin modelo, la propuesta es la misma.
→ `src/lib/engine/negotiation.ts`, `src/agents/negotiation-agent.ts`

**9. ¿Por qué ganó el Hospital Rural?**
Por una fórmula fija: 0,5 por gravedad, más 0,3 por urgencia, menos 0,2 por riesgo de demora. Quedó 0,52 contra 0,53. La diferencia es menor que el margen de empate (0,02), así que desempata la mayor necesidad sin cubrir: 0,9 contra 0,4. Con los mismos datos, siempre sale lo mismo. El costo no entra en la cuenta.
→ `src/lib/engine/deterministic.ts` (`computeTriageScore`, `resolveAllocation`)

**10. ¿Qué pasa si el modelo falla, se demora o genera un genoma roto?**
Cada agente tiene 6 s. Si no responde o escribe un dato reservado, sale un texto de respaldo marcado `fallback: true`, y la propuesta no cambia. Si una frase genera un genoma inválido, o con HTML o código, Zod y `findMarkup` lo rechazan y se usa la semilla más parecida. El modelo nunca genera interfaz.
→ `src/lib/genome/schema.ts`, `src/agents/mutate-genome.ts`, `src/lib/store/rooms.ts`
*Corrige al PDF:* no decir «cero errores 500», porque no está medido.

**11. ¿Y si se cae el wifi?**
El QR apunta al deploy público, así que el público entra con sus datos móviles. El computador del proyector usa internet compartido desde un celular. Si Render no carga, mostramos el video de respaldo. No probamos la demo en la red de la sede: está anotado como no medido.
→ `docs/GUION_DEMO.md` (Plan B), `docs/MEDICIONES.md` («Lo que no está medido»)

**12. ¿Cómo manejan la concurrencia? ¿Cómo escala?**
El servidor procesa las acciones de a una, en orden de llegada. El motor es síncrono y cada cambio sube la versión. Si dos personas deciden lo mismo, la segunda recibe 409. En un notebook abrimos 500 conexiones en tiempo real: todos los cambios llegaron a todas, con p95 de 51,5 ms. En el deploy no lo medimos. Hoy es un solo proceso en memoria, con topes de 200 conexiones por sala, 1000 en total y 200 salas. Para crecer: persistencia y un bus compartido, como Redis.
→ `docs/MEDICIONES.md`, `src/lib/store/rooms.ts`, `docs/PREGUNTAS.md` (9 y 36)
*Corrige al PDF:* eran 500 conexiones, no 60, y son 507 pruebas, no 80.

**13. ¿Dónde corre el modelo? ¿Qué datos salen a la nube?**
Toda llamada pasa por una sola capa, `src/lib/llm.ts`. En el deploy usamos Claude, así que sí salen datos: la vista de cada rol va a Claude, y el resumen del Comité va a ElevenLabs y a WhatsApp. El modo local con Ollama en el DGX Spark está implementado, pero no lo verificamos contra el Spark ni medimos su latencia. La telemetría muestra el proveedor real.
→ `src/lib/llm.ts` (`getTelemetry`), `docs/PENDIENTES.md`, `docs/PREGUNTAS.md` (35)
*Corrige al PDF:* nada de «100 % local en el Dell GB10», «Qwen» ni «bytesSentToCloud: 0» en el deploy.

**14. En la demo el Comité entra sin clave. ¿No es un agujero?**
Es una excepción deliberada, y solo existe en las salas de demo, para que la demo no se trabe. En las salas normales el Comité necesita la clave que va dentro de su QR; sin ella recibe 403. La razón es obligatoria (400 sin ella) y la decisión no se puede cambiar. Lo que no sabemos es quién es la persona: no hay cuentas.
→ `docs/DECISIONES.md` («En la demo, el Comité entra sin clave…»), `src/lib/store/rooms.ts` (`joinRandomSeat`)

### Nivel 3 · Producto (menos probables: es una demo, no un pitch)

No hay clientes, precios ni validación con usuarios en el repo. Se responde con honestidad y en corto.

**15. ¿Quién pagaría por esto?**
Por verificar: no lo validamos con clientes. Nuestra hipótesis son los comités que deciden con información sensible entre partes, como camas, crédito o compras. Hoy existen tres escenarios y la creación desde una frase; el siguiente paso es mostrárselo a quienes asignan camas de verdad.
→ `docs/ARQUITECTURA.md` («Qué haríamos con una semana más»)
*Corrige al PDF:* no decir «cobramos SaaS…» como si existiera un modelo de negocio, ni presentar `dist_tech` como un caso B2B vendido: es una semilla de ejemplo.

**16. Si sirve para todo, ¿no queda sin foco?**
El motor es general. Cada caso es un genoma JSON validado con las mismas reglas. Abrir un rubro nuevo es escribir un genoma, no cambiar el motor: así se hicieron la grúa y el camión.
→ `src/lib/genome/scenarios.ts`, `src/lib/genome/schema.ts`

**17. ¿Cómo se integra con Buk, SAP o Salesforce?**
Hoy no se integra con ninguno. Lo que sí existe: entra un genoma JSON y sale un acta en JSON y Markdown (`/api/rooms/:id/acta`), que otro sistema podría leer. Una integración sería el siguiente paso.
→ `src/app/api/rooms/[roomId]/acta/route.ts`
*Corrige al PDF:* no existen webhooks ni un conector con Buk.

**18. ¿Por qué dos organizaciones rivales entrarían a la misma sala?**
Porque no tienen que confiar en la otra, sino en reglas visibles: sus datos reservados se filtran en el servidor y la fórmula está en el código. Si no quieren mandar datos a la nube, el diseño permite un modelo local, pero eso aún no está verificado.
→ `src/lib/engine/deterministic.ts`, `src/lib/llm.ts`

### Nivel 4 · Escépticas

**19. ¿No agregan fricción humana cuando todos quieren automatizar?**
En decisiones de alto riesgo, la persona es el freno. Aquí la persona no repite trabajo: recibe la propuesta ya calculada y decide con un toque, con una razón obligatoria. El modelo p^n de la lámina lo ilustra, pero es un modelo ilustrativo, no una medición.
→ `docs/DECISIONES.md` («p^n como modelo ilustrativo»)

**20. ¿Quién define los pesos de la fórmula? ¿Y si una organización no está de acuerdo?**
Hoy los pesos están fijos en el código y son de ejemplo: 0,5, 0,3 y 0,2. Por eso existe el Comité: puede rechazar, con una razón que queda en el acta. Validar los pesos con personas que asignan camas es lo primero que haríamos.
→ `computeTriageScore` en `src/lib/engine/deterministic.ts`, `docs/PREGUNTAS.md` (15)
*Corrige al PDF:* los pesos no «se acuerdan y se sellan antes de deliberar».

**21. ¿Qué impide que OpenAI, Anthropic o Microsoft lo copien?**
Opinión del equipo, sin datos. Un proveedor de modelos tiende a juntar los datos en su nube. Sculptor es una capa entre organizaciones: los permisos y las reglas son nuestros y no dependen del modelo. Hoy cambiar de proveedor es cambiar dos variables de entorno.
→ `src/lib/llm.ts`
*Corrige al PDF:* no decir «aislamiento criptográfico».

**22. ¿Qué harían con 30 días más?**
Tres cosas: guardar las salas en una base de datos con un bus compartido, para que sobrevivan a reinicios y se repartan entre servidores; cuentas reales por persona en vez de un token por rol; y probar el flujo con personas que asignan camas, para validar los pesos.
→ `docs/ARQUITECTURA.md` («Qué haríamos con una semana más»)

---

## (d) Plan B y lista de chequeo

### Si se cae la demo

| Falla | Qué hacemos | Quién |
|---|---|---|
| Render no carga o la sala no aparece | Ramón cambia a la pestaña del **video de respaldo**, que se graba en el ensayo 2 (todavía no existe). Nahum narra encima con el mismo guion: «Esto lo grabamos a las siete con cinco personas; así se ve». | Ramón y Nahum |
| No escanean, o falta alguien a los 15 s | Sebastián entra con datos móviles. Las sillas que sigan vacías las juega un bot marcado «automático». | Sebastián |
| Nadie del público quiere subir | 2 personas aliadas de otro equipo ya avisadas, más los celulares del equipo. Por verificar: conseguirlas antes de las 9:00. | Sebastián |
| Opción B: un juez no quiere o no tiene señal | Se pasa a la opción A con el público, sin comentarlo. | Sebastián |
| Alguien no elige postura | Se repite una vez por su rol. Después, → pone las posturas que faltan, marcadas «automático». | Ramón |
| El debate va lento o rápido | Espacio pausa; → adelanta un mensaje. | Ramón |
| El modelo tarda | Nada: sale el texto de respaldo y la propuesta es la misma. Nahum puede decir «incluso sin el modelo, el código gobierna». | — |
| El Comité no aprieta | A los 20 s decide el plan B. Nahum: «Se acabó el tiempo: lo decidió el sistema, y queda escrito que no fue una persona». | Nahum |
| Son los 2:40 y no hay acta | Válvula de escape: el cierre corto. | Nahum |
| No llega el WhatsApp o la nota de voz | No se menciona. Se pasa directo al cierre. | Nahum |
| Falla el wifi de la sede | El computador usa internet compartido de un celular. El público usa sus datos. | Sebastián |
| Hay que mostrar un celular en la pantalla | Duplicar el iPhone en el Mac: con Duplicación del iPhone (macOS 15 o posterior) o con QuickTime → «Nueva grabación de película» → elegir el iPhone por cable. Por verificar en el Mac del proyector en el ensayo 5. | Ramón |

**Datos de respaldo:** la sala fija `demo-construccion` corre otro escenario si `demo-cross` queda trabada. Con el acta cerrada, «Nueva demo» abre otra sala con un código nuevo.

**Riesgo por verificar:** 5 celulares en el mismo wifi pueden compartir una IP. El límite de peticiones por IP no está verificado detrás de Render (`docs/ARQUITECTURA.md`, «Límite de peticiones»). Hay que probarlo en el ensayo 2 con 5 celulares en el wifi de la sede.

### Lista de chequeo, 10 minutos antes

1. [ ] `GET /api/health` en el deploy responde, y el modelo también.
2. [ ] Abrir `/stage/demo-cross` **en el computador del proyector**: debe mostrar el código gigante, el QR y 5 asientos. Pausa y Siguiente deben estar visibles.
3. [ ] Escanear el QR con un celular **con datos móviles**, entrar y salir. Después abrir una sala nueva y limpia.
4. [ ] El deck está en la lámina 1, en pantalla completa y en modo oscuro. La lámina 2 tiene el dato con su fuente, o no tiene cifra.
5. [ ] El video de respaldo está abierto en una pestaña, en pausa y en el segundo 0.
6. [ ] El hotspot del celular de Sebastián está encendido, con nombre y clave a mano.
7. [ ] Si el WhatsApp sigue en el guion: el Comité de prueba tiene sesión iniciada y ya mandó «Hola» al número de Kapso para abrir la ventana de 24 h. Si no responde, se saca del guion.
8. [ ] Brillo de los celulares de apoyo al máximo, sin modo ahorro y con el sonido activado para la nota de voz.
9. [ ] Hay un cronómetro visible para Nahum: un celular en la mano o el reloj del deck (tecla `N`).
10. [ ] Las 5 personas están elegidas, en primera fila, con el celular desbloqueado y saben que escanean de a una. Está decidido si va la opción A o la B.

---

## (e) Plan de ensayos, de 6:00 a 9:00

La charla dice que a partir del 3.er o 4.º ensayo empieza a fluir, y que con 6 sale muy bien. A las **9:00 se cierran los repositorios**: los cambios de código y de docs terminan antes.

| Hora | Qué | Cronometrar | Qué corregir |
|---|---|---|---|
| 6:00–6:30 | **Narrativa.** Nahum se aprende las 5 frases y busca la cifra del problema con su fuente. Sebastián confirma que el deploy trae la ronda 20 y corre `node scripts/e2e.mjs <url-del-deploy>`. | — | Cifra con fuente, o la frase sin número. Resultado del e2e anotado en `docs/MEDICIONES.md`. |
| 6:30–6:45 | **Ensayo 1, en seco.** Los 3 solos, con 5 celulares del equipo. | Cada bloque contra la tabla de (b). **Medir cuánto dura el debate en el deploy.** | Si el debate dura más de 45 s: decidir cuántas veces aprieta → Ramón. Cortar toda frase que pase su tiempo. |
| 7:00–7:20 | **Ensayo 2, grabado: es el video de respaldo.** 5 personas de otro equipo, en el wifi de la sede. Probar también la opción B con 3 de ellas haciendo de jueces. | Los 3:00 completos, con A y con B. | El video queda guardado en el Mac del proyector y en un celular. **Elegir A o B:** B solo si el Comité quedó bien asignado a la primera. Revisar si 5 celulares en el mismo wifi chocan con el límite por IP. |
| 7:30–7:50 | **Ensayo 3, con fallas provocadas.** El Comité no aprieta, alguien no escanea, se corta el wifi a la mitad y a los 2:40 no hay acta. | Que cada plan B entre sin pasar los 3:00. | Que Sebastián y Ramón actúen sin mirarse. Nahum practica las frases de rescate y la válvula de escape. |
| 8:00–8:20 | **Ensayo 4, completo, más preguntas.** Otra persona hace de jurado y elige 4 preguntas de (c) al azar. | 3:00 de demo y 2:00 de preguntas. | Respuestas de más de 20 s. Toda respuesta que no nombre un archivo. Toda respuesta que use una cifra del PDF viejo (80, 60, GB10, cero bytes). En las láminas, sacar el texto que no se dice en voz alta. |
| 8:30–8:45 | **Ensayo 5, con el equipo de verdad.** El Mac del proyector, si lo dejan, o el que se va a conectar. Probar la duplicación del iPhone y el modo oscuro en el proyector. | 3:00. | Letra legible desde el fondo. Pausa y Siguiente en ese navegador. |
| 8:50–9:00 | **Ensayo 6, liviano.** Solo voz y cronómetro, sin celulares. | 3:00. | Nada nuevo. |
| 9:00–9:30 | Preparación en el escenario: la lista de chequeo de (d). | — | — |
