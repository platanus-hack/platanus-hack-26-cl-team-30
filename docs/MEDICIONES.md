# Mediciones

Cifras medidas, con cómo y dónde se midieron. Las cifras de `docs/ARQUITECTURA.md` y `docs/PREGUNTAS.md` salen de aquí. Si una cifra no está en este archivo, no está medida.

## Tiempo real: muchas conexiones SSE a la vez

- **Qué:** `scripts/load-test.mjs`. Crea una sala, sienta al proponente y al aprobador, abre N conexiones SSE (repartidas entre proponente, aprobador y pantalla general), y el proponente mueve su límite 10 veces cada 200 ms. Mide, por cambio, cuántas conexiones lo recibieron y con qué latencia (desde que se envía la acción hasta que llega el mensaje).
- **Dónde:** en un notebook (macOS), contra las rutas reales de `src/app/api/` servidas sin Next por `tests/helpers/route-server.ts`. Cliente y servidor en la misma máquina, sin red de por medio.
- **Cuándo:** 21 de noviembre de 2026, madrugada.
- **Qué no mide:** el deploy en Render, la red de la sede ni el enrutador de Next. `scripts/load-test.mjs` se niega a correr contra un host público sin `--allow-remote`.

| Conexiones | Sala | Cambios recibidos por todas | p50 | p95 | Máximo |
| --- | --- | --- | --- | --- | --- |
| 50 | `single_org` | 10 de 10 | 11,3 ms | 15,3 ms | 18,1 ms |
| 200 | `single_org` | 10 de 10 | 21,1 ms | 36,7 ms | 42,6 ms |
| 500 | `single_org` | 10 de 10 | 38,3 ms | 51,5 ms | 58,6 ms |
| 200 | `cross_org` | 5 de 5 | 27,1 ms | 41,8 ms | 45,1 ms |

En las cuatro corridas, cada conexión recibió solo la vista que pidió. Con 500 conexiones llegaron 6500 mensajes en 2 segundos, contando el pulso del contador.

Desde entonces el servidor agregó un tope de 200 conexiones por sala (`MAX_CONNECTIONS_PER_ROOM` en `src/lib/store/rooms.ts`). La corrida de 500 conexiones en una sola sala hoy recibiría 503 `TOO_MANY_CONNECTIONS` a partir de la conexión 201.

`tests/http.test.ts` repite una versión chica en cada `npm test`: 60 conexiones y 5 cambios.

## Recorrido de punta a punta contra el deploy

- **Qué:** `scripts/e2e.mjs`, sin `--llm`. Seis participantes independientes en la sala `cross_org`, cada uno con su SSE (cuatro roles de dos hospitales, el Comité y la pantalla general), más los recorridos `single_org` y de otra organización. Cada paso imprime OK o FALLA.
- **Dónde:** contra https://team-30-platanus-hack.onrender.com, desde un notebook.

| Fecha | Resultado | Nota |
| --- | --- | --- |
| 21 de noviembre | 97 de 97 | Con la versión desplegada en ese momento |
| 21 de noviembre, mañana (informado por el orquestador) | 3 de 4 corridas con 97 de 97 | En la cuarta, algunos mensajes SSE tardaron hasta 3 segundos en llegar desde Render gratis |
| 21 de noviembre, más tarde | 93 de 97 | El script ya exigía que la pantalla general reciba solo campos `public`, regla que estaba en el código local pero no en el deploy. No es un error del motor: hay que repetirlo después de desplegar |

## Llamadas al modelo a la vez

- **Qué:** `scripts/stress-llm.mjs`. Lanza a la vez 1 mutación de genoma y 3 turnos de agente (uno por rol) y lee la cola desde la telemetría del SSE.
- **Dónde:** contra el deploy, con Claude (`claude-opus-5-5`) en la nube.
- **Cuándo:** 21 de noviembre de 2026. Resultado informado por el orquestador del equipo; la salida completa no quedó guardada en el repo.

| Medida | Resultado |
| --- | --- |
| Latencia de la mutación de genoma | Unos 10 segundos |
| Turnos de agente | Los tres declararon un campo oculto que necesitaban (`attemptedFieldRead`) y los tres quedaron como `RBAC_DENIED` en la bitácora. Es lo esperado: la instrucción del agente le pide nombrar un dato que no puede ver, y el servidor registra el intento sin entregar el valor |
| Latencia de los turnos de agente | No registrada |

## Cuadros por segundo de la pantalla grande con la galaxia

- **Qué:** cuadros por segundo de `/stage` durante 4 segundos, contados con `requestAnimationFrame` desde Playwright, con una sala `cross_org` manejada por HTTP (entradas reales por `JOIN_ROLE` y SSE). Se compara contra la vista «Ranking», que no dibuja la galaxia.
- **Dónde:** un notebook Apple M4 (macOS), Chromium 1243 de Playwright con ventana y GPU (ANGLE Metal), 1440×900 a escala 2, contra `next dev` en la misma máquina.
- **Cuándo:** 21 de noviembre de 2026.
- **Qué no mide:** un notebook sin GPU dedicada o más antiguo, ni el proyector de la sede. No se midió en otro equipo.

| Vista | Cuadros por segundo | Peor cuadro |
| --- | --- | --- |
| «Unirse», galaxia protagonista, 2 de 5 conectados | 60 | 18 ms |
| Historia, galaxia de fondo, 4 de 5 conectados | 60 | 18 ms |
| Historia sellada, galaxia verde | 60 | 18 ms |
| «Ranking», sin galaxia (línea base) | 60 | 18 ms |

Sin GPU (Chromium sin ventana, con render por software) la misma página dio entre 39 y 42 cuadros por segundo con la galaxia; la línea base sin galaxia en ese modo no quedó medida, así que esa cifra no dice cuánto cuesta la galaxia. Con `prefers-reduced-motion` la galaxia no anima: dibujó 0 cuadros en 2 segundos sin cambios y 1 cuadro por cada entrada.

## Texto en la silla del celular, antes y después de la ronda 8

Palabras visibles en cada pantalla principal (`document.body.innerText`, contando solo palabras con letras o números) y cuánto hay que desplazarse. Medido con Playwright en 390 × 844, modo claro, sala `cross_org` del escenario hospitales recorrida de punta a punta, en un notebook contra `npm run dev`, el 21 de noviembre. Antes: commit `e7833b7`; después: la silla de `src/components/seat/`. El modo oscuro da las mismas cifras.

| Pantalla | Antes (palabras) | Después (palabras) | Desplazamiento después |
| --- | --- | --- | --- |
| Entrada sin rol (elegir silla) | 180 | 54 | 0 px |
| Revelación «Te tocó» | no existía | 50 | 0 px |
| Urgencias: acordar el límite | 122 | 49 | 0 px |
| Comité esperando | 109 | 37 | 0 px |
| Gestión: firmar | 145 | 47 | 0 px |
| Urgencias: presentar el caso | 113 | 53 | 0 px |
| Urgencias esperando | 106 | 36 | 0 px |
| Comité decide (duelo) | 184 | 66 | 0 px |
| Comité: resuelto | 109 | 61 | 0 px |
| Urgencias: resuelto | 111 | 62 | 0 px |
| Pestaña Secretos (Urgencias) | no existía | 106 | 52 px |
| Pestaña Sala (Urgencias) | no existía | 99 | 163 px |

Las palabras incluyen la barra superior, las pestañas y el aviso de demostración.

## Toques en la sala de demo (ronda 9)

> Medición de la ronda 9, ya superada: desde la ronda 12 (demo pauteada) no hay tarjeta «Te tocó» ni «Entrar a mi silla», y el Comité acepta con la razón precargada. En la ronda 12 se midieron 3 toques en total por ronda (Presentar, Presentar y Aceptar) con 3 navegadores contra `next start`, en claro y en oscuro.

Recorrido de `demo-cross` con 3 celulares (Playwright, 390 × 844) y la pantalla grande (1440 × 900), contra `npm run dev` en un notebook, el 21 de noviembre, en claro y en oscuro (mismas cifras).

| Persona | Toques | Cuáles |
| --- | --- | --- |
| Clínica (Jefatura de Urgencias) | 2 | «Entrar a mi silla», «Presentar a Paciente A» |
| Hospital Rural (Médico Jefe de Turno) | 2 | «Entrar a mi silla», «Presentar a Paciente B» |
| Comité | 3 | «Entrar a mi silla», chip de razón «Equidad», «Aprobar y asignar» |

Los toques que deciden algo son 3 (dos presentaciones y la aprobación); los otros 4 son las tres entradas a la silla y el chip de razón del Comité. Los bots sellaron y firmaron en menos de 4 segundos desde la primera entrada. El reloj de la pantalla grande marcó 00:00 antes de que entrara alguien y «Decidido en 00:21» al cerrar (antes contaba desde que se creó la sala). `scripts/e2e.mjs` comprueba los mismos 3 toques en su recorrido «sala de demo».

## Negociación entre agentes con 5 personas (ronda 20)

Recorrido con 5 celulares (Playwright, 390 × 844, claro y oscuro) contra `next start` en un notebook el 21 de noviembre, con `NEXO_NEGOTIATION_STEP_MS=2500` y **sin modelo configurado**, así que todos los textos fueron el respaldo (`fallback: true`).

| Cifra | Valor |
| --- | --- |
| Toques por persona | 1: la postura de cada uno de los 4 asientos de organización, y «Aceptar» del Comité con la razón precargada |
| Desde la última postura hasta el turno del Comité | 15 s: 2,5 s de pausa, 4 argumentos y 2 pasos de propuesta, cada uno de 2,5 s. Con la pausa por defecto (7 s), unos 44 s |
| Desbordes horizontales en los 5 celulares | 0, en las 4 fases y en claro y oscuro |
| Datos reservados en mensajes publicados | 0 (`tests/negotiation.test.ts` y el recorrido de `scripts/e2e.mjs`) |

No está medido cuánto tarda Claude en escribir cada frase ni cuántas veces cae al respaldo en el deploy.

## Peso de las imágenes de `public/` (JPG y PNG a WebP)

- **Qué:** bytes en disco de las 26 imágenes convertidas, antes y después. Fotos y capturas con `cwebp -q 80 -m 6 -metadata none`; logos con `-q 90 -alpha_q 100`. Ninguna pasaba de 2000 px de ancho, así que no se redujo ninguna.
- **Dónde:** en un notebook (macOS), rama `imagenes-webp`, con `stat` sobre cada archivo.
- **Cuándo:** 22 de noviembre de 2026, madrugada.

| Grupo | Archivos | Antes | Después | Baja |
| --- | --- | --- | --- | --- |
| Capturas de `public/casos/` | 21 | 2.701 KB | 1.217 KB | 55 % |
| Fotos de `public/sculptor/equipo/` | 3 | 1.187 KB | 859 KB | 28 % |
| Logos de `public/brand/` | 2 | 145 KB | 28 KB | 81 % |
| **Total** | **26** | **4.033 KB** | **2.104 KB** | **48 %** |

1 KB = 1.000 bytes.

Es el peso del archivo de origen. Las páginas piden estas imágenes por `next/image`, que las vuelve a comprimir al ancho de cada pantalla; no se midió el tiempo de carga en el deploy.

## Pruebas automáticas

- **Qué:** `npm test` (Vitest, sin modelo).
- **Dónde:** en un notebook (macOS), rama `docs` (ronda 20 más la landing de Sculptor).
- **Cuándo:** 21 de noviembre de 2026, noche.

| Archivos de prueba | Pruebas | Resultado |
| --- | --- | --- |
| 16 | 507 | 507 pasan |

Borradores anteriores del pitch citaban 216 y 80 pruebas; la cifra vigente es esta. Antes de la ronda 20 eran 415 en 11 archivos.

## Lo que no está medido

- Cuadros por segundo de la pantalla grande en un equipo distinto del notebook M4 (por ejemplo, el que se conecte al proyector).

- Latencia del modelo local en el DGX Spark.
- Latencia de los turnos de agente con Claude.
- Carga en el deploy.
- Ensayos con personas y teléfonos reales en la red de la sede.
