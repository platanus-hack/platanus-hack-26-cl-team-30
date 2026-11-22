# Presentación

La presentación del domingo es una página de la app: **`/presentacion`**. Sigue el orden que pidió la charla del evento («Cómo hacer un buen demo»): saludo con nombre y una línea, problema en unos 20 s, solución en unos 20 s, demo en vivo de unos 2 minutos y cierre. Las frases salen del guion corregido de [`../DEMO_DIA.md`](../DEMO_DIA.md).

| # | Lámina | Tramo | Qué se muestra |
| --- | --- | --- | --- |
| 1 | Hola | 0:00–0:07 | Nombre, una línea y el equipo |
| 2 | Problema | 0:07–0:27 | 1 cama UCI, 2 hospitales; pⁿ de agentes solos (modelo ilustrativo, calculado por el motor) |
| 3 | Solución | 0:27–0:42 | «Los agentes conversan. El código gobierna.» y el botón que abre la pantalla grande |
| 4 | En vivo | 0:42–2:40 | Las 6 fases de la demo; la demo corre en `/stage/demo-cross` |
| 5 | Desarrollo | 2:40–2:50 | Dos páginas del mismo deploy lado a lado que bajan solas, sección por sección, con una pausa en cada una (por defecto la portada `/` y `/sculptor`; cada panel tiene un selector y se detiene con el mouse encima) y el stack |
| 6 | Cierre | 2:50–3:00 | NGC 253, «Somos Sculptor» |
| 7 | Equipo | Preguntas | Foto, nombres y roles mientras responden |

Teclas: `→` o clic avanza, `←` retrocede, `1`–`7` salta, `T` inicia o pausa el reloj de 3:00 (se pone lima a los 2:40 y rojo a los 3:00), `R` lo reinicia, `N` muestra las notas del orador con lo que dice Nahum y lo que hacen Ramón y Sebastián, `F` pantalla completa.

Todo va en modo oscuro: la charla avisó que el modo claro se quema en el proyector. Las páginas dentro de «Desarrollo» siguen el modo del computador; si el proyector está en modo claro, la portada `/` se ve clara.

En la lámina 4: `P` pausa o reanuda el debate, `S` adelanta un paso y `B` abre una sala nueva (ronda nueva). La sala se abre en `PRESENTACION_DEMO_URL` si está definido (por ejemplo `https://nexo-og8m.onrender.com`), para que el QR sea escaneable aunque la presentación corra en localhost; si no, en el mismo servidor de la presentación. Ese deploy tiene que tener la versión de la ronda 20: con una versión anterior la sala sigue el flujo viejo (Límites, Casos, Comité) y no la negociación que cuenta el guion.

El deck anterior del equipo sigue en `/pitch/index.html` como respaldo.
