# Guion de la demo en vivo

Demo pauteada de Sculptor para el pitch de 3:30. El narrador guía en voz alta y llama a cada persona por su **rol**: **Clínica**, **Hospital Rural** y **Comité**. Las personas no leen: escuchan y aprietan. En ninguna pantalla aparece un número de jurado; cada persona es su rol y su color.

Integra el guion de Nahum (`docs/diseno/nahum/guion_pitch_3m30_platanus.md`) con lo que existe hoy: nombre Sculptor, demo de 3 personas, sin el paso del límite y con las cifras del repo. La versión para imprimir está al final.

## Cómo funciona la sala de demo

- Sala: `https://team-30-platanus-hack.onrender.com/stage/demo-cross` (pantalla grande). El QR de la pantalla y el de la lámina 3 del deck abren `/room/demo-cross`.
- Los asientos se reparten por orden de llegada: la 1.ª persona es la **Clínica** (Urgencias de la Clínica Andes), la 2.ª el **Hospital Rural** (Turno del Hospital Valle Sur) y la 3.ª el **Comité**.
- Los cargos administrativos de cada hospital los juega el piloto automático. En la pantalla grande aparecen pequeños, con el chip «automático».
- La pantalla grande muestra una franja con el turno: «Clínica: presenta a tu paciente», «Hospital Rural: presenta a tu paciente», «Comité: ¿aceptas o rechazas?».
- En el celular, cada persona ve su rol en grande y un solo botón cuando le toca: **Presentar**, o **Aceptar** / **Rechazar**. El Comité trae una razón ya escrita; tocándola cambia por otra.
- **Plan B automático:** si a la persona que le toca no aprieta, el servidor juega ese turno solo cuando se acaba la cuenta regresiva (20 s por defecto, `NEXO_DEMO_TURN_MS`). En el acta queda marcado como automático. La cuenta se ve en la franja.
- Al cerrar el acta aparece **Nueva ronda**, que cualquiera puede apretar en la sala de demo. La sala también se reinicia sola 2 minutos después del acta si no hay actividad.

Las cifras son las del motor con las semillas: Clínica 0,52, Hospital Rural 0,53, diferencia 0,01 menor que el margen de 0,02, empate y desempate por necesidad sin cubrir a favor del Hospital Rural. El costo no entra en la cuenta.

## La demo, segundo a segundo (unos 70 s)

| Tiempo | Narrador (palabra por palabra) | Quién aprieta | Qué cambia en la pantalla grande |
|---|---|---|---|
| 0:00–0:12 | «Necesito tres personas. Saquen el celular y escaneen este código. La primera en entrar es la Clínica, la segunda el Hospital Rural y la tercera el Comité.» | Nadie todavía: escanean | «Unirse»: el contador sube de 0/3 a 3/3. Cada asiento («Clínica», «Hospital Rural», «Comité») se enciende con su color y aparece un nodo en la galaxia. |
| 0:12–0:24 | «Clínica: usted tiene un paciente grave y compite contra el Hospital Rural por la última cama UCI. Apriete Presentar.» | Clínica: **Presentar** | La franja dice «Clínica: presenta a tu paciente» y su tarjeta se resalta. Al apretar, aparece su puntaje: **0,52**. |
| 0:24–0:38 | «Hospital Rural, su turno: apriete Presentar.» (cuando aparece el puntaje) «Ninguno ve el costo del otro: la regla ordena solo con lo clínico. 0,52 contra 0,53: casi empate, y gana quien más necesita.» | Hospital Rural: **Presentar** | La franja pasa a «Hospital Rural: presenta a tu paciente». Al apretar, aparece **0,53** con la estrella de propuesto. |
| 0:38–0:55 | «Comité: la regla propone al Hospital Rural. ¿Acepta o rechaza? Su razón ya está escrita; tóquela si quiere otra.» | Comité: **Aceptar** o **Rechazar** | La franja dice «Comité: ¿aceptas o rechazas?» con la cuenta regresiva. Si rechaza, la cama va al otro hospital en ese mismo toque. |
| 0:55–1:10 | «Listo. En el mismo segundo, todas las pantallas cambiaron. El pulso se volvió verde y quedó el acta: quién decidió, cuándo y por qué.» | Nadie | «Listo: Hospital Rural recibe el recurso». El pulso rojo pasa a una línea verde y plana, el reloj se detiene y aparece «Nueva ronda». |

Si el Comité rechaza, la asignación se sella en ese mismo toque a favor del otro hospital (la Clínica). El narrador dice: «El Comité rechazó la propuesta de la regla: la cama va a la Clínica, y la razón queda en el acta». No se agrega tiempo.

## Plan B

| Si pasa esto | Qué hacer |
|---|---|
| Alguien no aprieta | Nada: el narrador repite una vez la instrucción («Clínica, apriete Presentar»). Si se acaba la cuenta regresiva, el servidor juega el turno solo y lo marca como automático. El narrador lo dice: «Se acabó el tiempo: el sistema lo jugó por ella, y queda escrito en el acta». |
| Nadie escanea en 10 s | Un integrante del equipo escanea desde su celular con datos móviles y toma la silla libre. El plan B automático necesita que al menos una persona haya entrado. |
| Entra una cuarta persona | Su celular dice que no quedan sillas. El narrador sigue: «Ya tenemos a los tres». |
| Falla el wifi de la sala | Pasar el computador del proyector a la conexión compartida de un celular. Los jurados usan sus datos móviles: el QR apunta al deploy público, no a la red local. |
| Render está lento o dormido | Cinco minutos antes, abrir `/api/health` y `/stage/demo-cross` para despertarlo. Si igual no carga, seguir con las láminas: la 3 muestra el duelo 0,52 contra 0,53 y el dato sellado. |
| La sala quedó con una ronda anterior | Apretar «Nueva ronda» en el acta, o esperar 2 minutos: se reinicia sola. |

## El pitch completo (3:30)

Deck: `public/pitch/index.html` (se abre en `/pitch/index.html`, `F` para pantalla completa, flechas o espacio para avanzar). Duración objetivo 3:20, con 10 s de colchón.

**Antes de subir (T−10 min):** abrir `/api/health` y `/stage/demo-cross` en el deploy; en la pantalla grande, si queda una ronda anterior, apretar «Nueva ronda»; probar el QR con datos móviles.

| Tiempo | Lámina | Narrador |
|---|---|---|
| 0:00–0:15 | 1 · Gancho | «Hay una cama UCI. (pausa) Dos hospitales la necesitan. (pausa) Y quien decide no puede ver los datos del otro. Mientras nadie decide, el reloj sigue corriendo.» |
| 0:15–0:35 | 2 · El problema | «Hoy esto se coordina por WhatsApp: información partida, sin una regla que todos vean y sin registro. Y dejar a agentes de IA solos lo empeora: en un modelo ilustrativo, diez pasos que aciertan el 92 % terminan bien solo el 43 % de las veces.» (Espacio) «Con una persona que firma, sube al 96 %.» |
| 0:35–0:50 | 3 · Demo | «Por eso hicimos Sculptor: varias organizaciones deciden juntas y cada una ve solo lo suyo.» (Espacio) «Si alguien pide un dato ajeno, el servidor lo rechaza y queda en el acta. Ahora ustedes: saquen el celular.» (abrir la pantalla grande) |
| 0:50–2:00 | Demo en vivo | El guion de 70 s de arriba. |
| 2:00–2:20 | 4 · El esqueleto | «No es una app de camas. Es un esqueleto: el mismo motor sirve para dos constructoras y una grúa, o para una sala armada desde una frase. La IA propone el contenido; la interfaz y las reglas son siempre las mismas.» |
| 2:20–2:45 | 5 · Ingeniería | «La IA escribe; el código decide. Permisos, regla y acta son código, con 429 pruebas que corren sin modelo, y 200 conexiones a la vez medidas: cada una recibe solo lo suyo. El deploy usa Claude en la nube; en la sede, un modelo local en el Spark. La pantalla siempre dice cuál está activo.» |
| 2:45–3:15 | 6 · Cierre | «Esto solo funciona con más de una persona: nadie tiene los datos para decidir solo. (pausa) Cualquier recurso escaso, entre cualquier grupo de organizaciones. Con Sculptor, el recurso deja de esperar.» (silencio) |

Cambios respecto del guion de Nahum: el nombre es Sculptor; la demo es de 3 personas del público y no hay operadores con laptops; se quitó el choque de límite (82 % contra 60 %) porque en la demo lo hacen los roles automáticos; se quitó «cero bytes a la nube» (el deploy usa Claude); las cifras son 429 pruebas y 200 conexiones medidas (`docs/MEDICIONES.md`); sin RBAC, Zod ni Genoma en lo que se dice.

---

## Versión para imprimir (una página)

**SCULPTOR · DEMO EN VIVO · 70 s** — Sala `team-30-platanus-hack.onrender.com/stage/demo-cross`

**Antes:** abrir `/api/health` y `/stage/demo-cross`. Si hay una ronda anterior: «Nueva ronda».

1. **Unirse (12 s)** — «Necesito tres personas. Escaneen este código. La primera es la Clínica, la segunda el Hospital Rural y la tercera el Comité.» → Pantalla: 0/3 → 3/3.
2. **Clínica (12 s)** — «Clínica: compite contra el Hospital Rural por la última cama UCI. Apriete Presentar.» → Aparece 0,52.
3. **Hospital Rural (14 s)** — «Hospital Rural, su turno: apriete Presentar.» → Aparece 0,53. «Nadie ve el costo del otro. Casi empate: gana quien más necesita.»
4. **Comité (17 s)** — «Comité: la regla propone al Hospital Rural. ¿Acepta o rechaza? Su razón ya está escrita.» → Aceptar o Rechazar.
5. **Acta (15 s)** — «Todas las pantallas cambiaron en el mismo segundo. El pulso está verde y quedó el acta: quién decidió, cuándo y por qué.»

**Si rechaza:** «El Comité rechazó la propuesta: la cama va a la Clínica, y la razón queda en el acta.» (sin tiempo extra)

**Plan B**
- No aprieta → repetir una vez. A los 20 s el sistema juega solo y lo marca «automático».
- Nadie escanea → alguien del equipo escanea con datos móviles.
- Falla el wifi → proyector con internet compartido de un celular; los jurados con sus datos.
- Render lento → seguir con la lámina 3 del deck.

**Cifras:** 0,52 contra 0,53 · margen 0,02 · gana Hospital Rural por necesidad · el costo no entra · 429 pruebas · 200 conexiones medidas · deploy con Claude en la nube.
