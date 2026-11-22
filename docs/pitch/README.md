# Presentación

**Cómo abrirla:** `scripts/presentacion.sh` (o un ícono que lo llame). Si el servidor de la presentación no está andando lo levanta en segundo plano (`next start` en el puerto 47530; la primera vez hace el build) y abre `/presentacion` en una ventana propia de Chrome, a pantalla completa. También está publicada en el deploy: `https://team-30-platanus-hack.onrender.com/presentacion`.

La presentación del domingo es una página de la app: **`/presentacion`**. Sigue el orden que pidió la charla del evento («Cómo hacer un buen demo»): saludo con nombre y una línea, problema en unos 20 s, solución en unos 20 s, demo en vivo de unos 2 minutos y cierre. Las frases salen del guion corregido de [`../DEMO_DIA.md`](../DEMO_DIA.md).

| # | Lámina | Tramo | Qué se muestra |
| --- | --- | --- | --- |
| 1 | Hola | 0:00–0:07 | Nombre, una línea y el equipo |
| 2 | Problema | 0:07–0:27 | Una organización es un choque de fuerzas; pⁿ de agentes que tiran cada uno para su lado (modelo ilustrativo, calculado por el motor) |
| 3 | ¿Y tiene posibilidad? | 0:27–0:50 | Un caso real (TopSol): el audio del problema, el audio después de probarlo (los dos a 1,5×) y la captura del chat, sin editar |
| 4 | Solución | 0:50–1:02 | «Los agentes conversan. El código gobierna.» y el botón que pasa a la demo |
| 5 | En vivo | 1:02–2:45 | La pantalla grande real con su QR y, al lado, el planeta 3D sin textos (solo el logo): dos nodos por persona que entra, convergencia en el debate y, con el acta, alejamiento hasta la galaxia. Un clic en el planeta hace un salto a velocidad luz hacia la lámina siguiente |
| 6 | Desarrollo | 2:45–2:52 | La landing `/` y el caso de logística `/casos/logistica` lado a lado, bajando solas de corrido |
| 7 | Cierre | 2:52–3:00 | «SCULPTOR \| Donde el caos aprende a evolucionar» |
| 8 | Equipo | Preguntas | Foto, nombres y roles (AI Product Strategist, Software Engineer, AI Engineer) mientras responden |

Teclas: `→` o clic avanza, `←` retrocede, `1`–`8` salta, `T` inicia o pausa el reloj de 3:00 (se pone lima a los 2:40 y rojo a los 3:00), `R` lo reinicia, `N` muestra las notas del orador con lo que dice Nahum y lo que hacen Ramón y Sebastián, `F` pantalla completa.

Todo va en modo oscuro: la charla avisó que el modo claro se quema en el proyector. Las páginas dentro de «Desarrollo» siguen el modo del computador; si el proyector está en modo claro, la portada `/` se ve clara.

En la lámina 5: `P` pausa o reanuda el debate, `S` adelanta un paso y `B` abre una sala nueva (ronda nueva). Con `PRESENTACION_DEMO_SALA` (por ejemplo `CSCGZ`) la lámina usa esa sala fija; si ya no existe (las salas viven en memoria y se pierden al reiniciar el servidor), abre una nueva. Si no, la sala se abre en `PRESENTACION_DEMO_URL` si está definido (por ejemplo `https://nexo-og8m.onrender.com`), para que el QR sea escaneable aunque la presentación corra en localhost; si no, en el mismo servidor de la presentación. Ese deploy tiene que tener la versión de la ronda 20: con una versión anterior la sala sigue el flujo viejo (Límites, Casos, Comité) y no la negociación que cuenta el guion.

El deck anterior del equipo sigue en `/pitch/index.html` como respaldo.

Los audios y la captura de la lámina 3 (`public/presentacion/validacion/`) no están en el repo: son de una persona externa y se publican solo con su permiso. Sin esos archivos la lámina muestra los reproductores vacíos.
