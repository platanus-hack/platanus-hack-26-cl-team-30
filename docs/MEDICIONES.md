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

## Lo que no está medido

- Latencia del modelo local en el DGX Spark.
- Latencia de los turnos de agente con Claude.
- Carga en el deploy.
- Ensayos con personas y teléfonos reales en la red de la sede.
