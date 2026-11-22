# Guion de la demo en vivo (ronda 20)

Pitch de 3:30 con una demo en vivo de unos 90 s: 5 personas del público, cada una con su agente, deciden quién se queda con la última cama UCI. El narrador guía en voz alta y llama a cada persona por su **rol** («Urgencias de la Clínica», «Comité»), nunca por número. Las personas no leen: escuchan y aprietan. La versión para imprimir está al final.

## Lo que hay que saber antes de subir

- **Sala:** `team-30-platanus-hack.onrender.com/stage/demo-cross` abre una sala nueva cada vez, con su propio código de 5 caracteres (sin 0/O ni 1/I) y su QR. «Nueva demo», al cerrar el acta, abre otra. Un código no se reutiliza.
- **Ábrela desde el computador del proyector.** «Pausa» y «Siguiente» solo aparecen en el navegador que creó la sala (atajos: espacio y flecha derecha). El deck tiene el botón en la lámina 3.
- **Sillas por orden de llegada:** 1 Clínica · Urgencias, 2 Clínica · Administración, 3 Hospital Rural · Turno, 4 Hospital Rural · Administración, 5 Comité. Las sillas vacías las juega un bot, marcado «automático».
- **Cada celular tiene su agente:** le escribe un consejo privado y le ofrece 3 posturas, a un toque. La postura cambia lo que defiende su agente, no el puntaje.
- **La IA escribe, el código decide:** los mensajes los redacta Claude con la vista de su rol. Si tarda más de 6 s o escribe un dato reservado, se publica un texto de respaldo fijo. La propuesta y los puntajes salen del motor, nunca del modelo.
- **Las cifras (motor y semillas):** Clínica 0,52 y Hospital Rural 0,53. La diferencia (0,01) es menor que el margen de 0,02: casi empate, y desempata la mayor necesidad sin cubrir, a favor del Hospital Rural. En la pantalla grande, la tarjeta de la propuesta muestra ese mismo puntaje en escala de 1 a 50 (Clínica 26, Hospital Rural 27) y la gravedad de cada caso con candado: es un dato reservado de cada organización y nadie la dice en voz alta. El costo no entra en la cuenta.
- **Ritmo:** un mensaje cada 7 s (`NEXO_NEGOTIATION_STEP_MS`). Desde la última postura hasta el turno del Comité pasan unos 44 s (`docs/MEDICIONES.md`).

## La demo, segundo a segundo (90 s)

| Tiempo | Paso | Narrador (palabra por palabra) | Quién aprieta | Pantalla grande |
|---|---|---|---|---|
| 0:00–0:15 | Unirse | «Necesito cinco personas. Escaneen este código. La primera es Urgencias de la Clínica; la segunda, su Administración. Después, Turno y Administración del Hospital Rural. La quinta es el Comité.» | Nadie: escanean | Código gigante, QR y «N de 5 personas conectadas». |
| 0:15–0:30 | Posturas | «Cada uno tiene un agente en su celular, y ya les escribió un consejo. Elijan su postura: un toque.» | Las 4 organizaciones: **su postura** | Cada asiento se enciende con su color y su postura. |
| 0:30–1:05 | Debate | «Ahora negocian los agentes. Cada uno defiende a su organización, pero ningún costo sale de su celular.» | Nadie | Un mensaje cada 7 s, con «escribiendo…». La Clínica habla desde la izquierda y el Hospital Rural desde la derecha. |
| 1:05–1:15 | Propuesta | «La propuesta no la escribe la IA: la calcula la regla. 0,52 contra 0,53, casi empate. Gana quien tiene más necesidad sin cubrir: el Hospital Rural.» | Nadie | «Hospital Rural recibiría el recurso. La calculó el código, no un agente.» |
| 1:15–1:25 | Comité | «Comité: ¿acepta o rechaza? Su razón ya está escrita.» | Comité: **Aceptar** o **Rechazar** | «Comité: ¿aceptas o rechazas?», con la cuenta regresiva de 20 s. |
| 1:25–1:30 | Acta | «Listo. Todas las pantallas cambiaron en el mismo segundo, y quedó el acta. Comité: toque "Recibir resumen por WhatsApp".» | Comité: **WhatsApp** | «Listo: Hospital Rural recibe el recurso» y la razón del Comité. |

**Si el Comité rechaza:** la cama va a la Clínica en ese mismo toque. El narrador dice: «El Comité rechazó la propuesta: la cama va a la Clínica, y su razón queda en el acta». No se agrega tiempo.

**WhatsApp del Comité** (mientras el narrador pasa a la lámina 4): el botón abre WhatsApp con «Hola, soy el Comité de la sala <código>» ya escrito. La persona lo envía y le llegan el resumen del acta en texto y una nota de voz. El botón solo aparece después de decidir. Necesita Kapso y ElevenLabs configurados en el servidor; si no responde, no se menciona.

## Plan B

| Si pasa esto | Qué hacer |
|---|---|
| Alguien no escanea | A los 15 s, alguien del equipo escanea con datos móviles y toma la silla libre. Las sillas que sigan vacías las juega un bot, marcado «automático». |
| Alguien no elige postura | Repetir una vez, por su rol: «Turno del Hospital Rural, elija su postura». Si sigue sin elegir, **Siguiente** (→): un bot pone las posturas que faltan, marcadas «automático». Sin eso, la sala espera hasta 60 s desde la primera entrada. |
| El debate va muy rápido para explicar | **Pausa** (espacio) y reanudar. **Siguiente** (→) adelanta un mensaje. |
| El modelo tarda o escribe un dato reservado | Nada: el servidor publica el texto de respaldo de ese rol. |
| El Comité no aprieta | Repetir una vez. A los 20 s decide el plan B, y el acta dice «Decisión automática: nadie decidió a tiempo». El narrador: «Se acabó el tiempo: lo decidió el sistema, y queda escrito que no fue una persona». |
| No aparecen Pausa ni Siguiente | La sala se abrió desde otro navegador. Abrir `/stage/demo-cross` en el computador del proyector: sale un código nuevo y hay que escanear de nuevo. |
| Entra una sexta persona | Su celular dice que no quedan sillas. «Ya estamos los cinco.» |
| Falla el wifi | Computador del proyector con internet compartido de un celular. El público usa sus datos: el QR apunta al deploy público. |
| Render está lento o dormido | Cinco minutos antes, abrir `/api/health` y `/stage/demo-cross`. Si igual no carga, seguir con las láminas: la 5 muestra 0,52 contra 0,53. |

## El pitch completo (3:30)

Deck: `public/pitch/index.html` (se abre en `/pitch/index.html`; `F` pantalla completa, flechas o espacio para avanzar, `N` notas). Duración objetivo 3:15, con 15 s de colchón.

**T−10 min:** abrir `/api/health`; abrir `/stage/demo-cross` y confirmar que el deploy trae la ronda 20 (código gigante y 5 asientos); probar un QR con datos móviles.

| Tiempo | Lámina | Narrador |
|---|---|---|
| 0:00–0:15 | 1 · Gancho | «Hay una cama UCI. (pausa) Dos hospitales la necesitan. (pausa) Y nadie puede ver los datos del otro. Mientras nadie decide, el reloj corre.» |
| 0:15–0:35 | 2 · Problema | «Hoy esto se arregla por WhatsApp: sin regla y sin registro. Y dejar a los agentes de IA solos lo empeora: diez pasos que aciertan el 92 % terminan bien solo el 43 % de las veces.» (espacio) «Con una persona que firma, sube al 96 %. Es un modelo ilustrativo.» |
| 0:35–0:50 | 3 · Ahora ustedes | «Sculptor: cinco personas, cada una con su agente, deciden juntas sin mostrar sus datos. Saquen el celular.» (clic en «Abrir la pantalla grande») |
| 0:50–2:20 | Demo en vivo | El guion de 90 s de arriba. |
| 2:20–2:35 | 4 · Esqueleto | «No es una app de camas. El mismo motor sirve para dos constructoras y una grúa, o para una sala armada desde una frase.» |
| 2:35–2:55 | 5 · Ingeniería | «La IA escribe; el código decide. Los agentes conversan, pero la regla, los permisos y el acta son código, con más de 500 pruebas sin modelo. El deploy usa Claude en la nube; en la sede, un modelo local en el Spark, y la pantalla dice cuál.» |
| 2:55–3:15 | 6 · Cierre | «Esto solo funciona con más de una persona: nadie tiene los datos para decidir solo. (pausa) Con Sculptor, el recurso deja de esperar.» (silencio) |

Cambios respecto del guion anterior: la demo pasa de 3 a 5 personas con sus agentes y una negociación a la vista; la lámina 3 ya no tiene QR (el código cambia en cada demo y aparece en la pantalla grande); se quitaron la prueba de lectura ajena de la lámina 3 y los textos de apoyo de la lámina 2; la gravedad se muestra de 1 a 50 como en la pantalla grande; las pruebas pasan de 429 a más de 500.

---

## Versión para imprimir (una página)

**SCULPTOR · DEMO EN VIVO · 90 s** — abrir `team-30-platanus-hack.onrender.com/stage/demo-cross` **desde el computador del proyector**.

**Antes:** `/api/health` · confirmar 5 asientos y código gigante · QR con datos móviles.

1. **Unirse (15 s)** — «Necesito cinco personas. Escaneen este código. Primera: Urgencias de la Clínica. Segunda: su Administración. Después, Turno y Administración del Hospital Rural. Quinta: el Comité.»
2. **Posturas (15 s)** — «Su agente ya les escribió un consejo. Elijan su postura: un toque.»
3. **Debate (35 s)** — «Negocian los agentes. Cada uno defiende a su organización, pero ningún costo sale de su celular.»
4. **Propuesta (10 s)** — «No la escribe la IA: la calcula la regla. 0,52 contra 0,53. Gana la necesidad: Hospital Rural.»
5. **Comité (10 s)** — «Comité: ¿acepta o rechaza? Su razón ya está escrita.»
6. **Acta (5 s)** — «Todas las pantallas cambiaron, y quedó el acta. Comité: toque "Recibir resumen por WhatsApp".»

**Si rechaza:** «La cama va a la Clínica, y su razón queda en el acta.»

**Controles:** espacio = Pausa · → = Siguiente.

**Plan B**
- No escanean → alguien del equipo entra con datos móviles.
- No elige postura → repetir una vez por su rol; después →.
- El Comité no aprieta → a los 20 s decide el sistema, marcado «automático».
- Sin Pausa ni Siguiente → reabrir `/stage/demo-cross` en el proyector (código nuevo).
- Falla el wifi → internet compartido de un celular.
- Render no carga → seguir con las láminas.

**Cifras:** 0,52 contra 0,53 · margen 0,02 · gana el Hospital Rural por necesidad · en pantalla 26 contra 27 de 50 · la gravedad es reservada: no se dice · el costo no entra · 7 s por mensaje · plan B a los 20 s · más de 500 pruebas.
