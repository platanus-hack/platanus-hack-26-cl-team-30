# QA de la demo: 5 novatos en navegadores reales

Prueba de la demo con negociación entre agentes (ronda 20) jugada como la jugarían 5 personas que nunca la vieron. El script está en `scripts/novato-demo.mjs`. A diferencia de `scripts/e2e.mjs` (HTTP, sin navegador), usa navegadores reales con Playwright y mira lo que se ve en cada pantalla.

## Qué hace

1. Abre la pantalla grande (1440 px) en `/stage/demo-cross`, que crea una sala nueva con código propio. Ese navegador queda como anfitrión.
2. Lee el QR único de la pantalla grande (con `BarcodeDetector`; si el navegador no lo trae, arma el enlace con el código grande que se ve).
3. Hace entrar a 5 personas, de a una y en el orden de los asientos, cada una en su propio contexto de navegador (celular de 390 px, sin almacenamiento compartido).
4. Cada persona mira su celular y toca el botón que ve: su postura (la primera opción de su agente) y, el Comité, Aceptar o Rechazar. Nadie toca antes de que se capture su pantalla de esa fase, y cada persona mira su botón 2 s antes de tocarlo.
5. Espera la negociación sin acelerarla, para medir el ritmo real. Con `--rapido` aprieta «Siguiente» del narrador.

Registra por persona y por fase el título que ve (el texto visible más grande), las palabras de la pantalla, si hay que desplazarse, los botones a la vista, los toques y la duración de cada fase. Deja una captura por fase y por pantalla, más `informe.md` e `informe.json`, en la carpeta que se le pasa.

## Cuándo falla

- **Atasco:** una pantalla queda igual más de 60 s antes del acta (los números de las cuentas regresivas no cuentan como cambio). Corta la prueba.
- **Dato reservado a la vista:** en un celular o en la pantalla grande se lee un valor reservado. Los valores salen de las semillas (`src/lib/genome/seeds.ts`): todo campo que no es público y el costo de cobertura de cada candidato, escritos de varias formas (`2400000`, `2.400.000`, `2,4 millones`, `45/50`, `45 de 50`, `140 km`). A cada celular se le buscan solo los que su organización y su rol no pueden ver; a la pantalla grande y al Comité, todos. La fuga queda anotada con su captura y la prueba sigue, para que el informe quede completo.
- **La demo no llega al acta** dentro del tope (900 s por defecto).

Sale con 0 si pasó, 1 si falló y 2 si no pudo empezar.

## Uso

```
node scripts/novato-demo.mjs <url> <carpeta> [--rapido] [--iniciar] [--comite aceptar|rechazar]
     [--atasco 60] [--limite 900] [--pausa-entrada 1500] [--lectura 2000] [--headed]
     [--grabar <carpeta>] [--final 8]
```

Con `--grabar <carpeta>` la misma corrida queda en video: la pantalla grande a 1920x1080 y cada celular a 390x844, en modo oscuro, un `.webm` por pantalla más `grabacion.json`. Ahí está cuándo empezó cada video, qué silla tiene cada celular y cuándo empezó cada fase. Al grabar, cada persona toca la postura «Recomendado» por su agente en vez de la primera, un círculo blanco marca cada toque y cada página lleva una baliza de sincronía de 8 px en la esquina inferior derecha (su gris dice el segundo del reloj; ver `SYNC_BEACON`). `scripts/video-respaldo.mjs` une esos videos en el video de respaldo de la demo (`docs/DEMO_DIA.md`, «Video de respaldo»).

Con `--iniciar` entran solo 2 personas y el narrador toca «Iniciar» en la pantalla grande: los 3 asientos libres los toma un bot y el Comité lo decide el plan B. La prueba revisa que el contador diga «2/5 personas» antes y «2/5 personas · 3 automáticos» después, y guarda `iniciar-1-antes.png` e `iniciar-2-despues.png`. El 22 de noviembre de 2026, contra un build local de la rama `demo-iniciar`, pasaron `--iniciar` (acta a los 83,3 s, 1 toque del narrador y 1 por persona) y `--rapido` (acta a los 52 s), sin fugas ni atascos.

Contra un build local: `npm run build`, después `npx next start -p <puerto>` y la prueba contra `http://localhost:<puerto>`. Si se rehace el build con el servidor andando, la pantalla grande no abre la sala (el script lo avisa): hay que reiniciar el servidor.

Playwright no es dependencia del repo. El script busca `playwright` instalado, después `PLAYWRIGHT_PATH` (carpeta del paquete) y después la caché de npx. Si no hay ninguno: `npm i --no-save playwright@1.63 && npx playwright install chromium`.

Los selectores que dependen de las vistas de la ronda 20 están juntos en `SEL`, al inicio del script, marcados `[R20]`.

## Informe de ejemplo

Corrida a ritmo real (`node scripts/novato-demo.mjs http://localhost:3520 <carpeta>`) contra un build local del 21 de noviembre de 2026, con la fuga de «Gravedad N/50» ya corregida. El modelo local no respondía en esa máquina, así que los 4 argumentos del debate son el texto de respaldo («de respaldo: 4»). Ese mismo día también pasaron el modo `--rapido` (acta a los 33,8 s, 7 toques de «Siguiente») y `--comite rechazar` (VETO, acta a los 67,7 s), los dos sin fugas ni atascos.

### Demo de novatos: PASÓ

- Servidor: http://localhost:3520
- Modo: ritmo real, sin adelantar · Comité: aceptar
- Duración total: 73.9 s
- Sala: HADVD (código HADVD) · pausa entre mensajes: 7000 ms
- Mensajes: 10 (position 4, argument 4, proposal 1, system 1) · de respaldo: 4
- Posturas automáticas: ninguna
- Decisión: APPROVE «Se acepta la propuesta por equidad.»

#### Duración de cada fase

| Fase | Empieza (s) | Dura (s) |
|---|---:|---:|
| Unirse | 0 | 13.9 |
| Posturas | 13.9 | 7.7 |
| Debate | 21.6 | 28 |
| Propuesta | 49.6 | 14 |
| Comité | 63.6 | 4.7 |
| Acta | 68.3 | — |

#### Toques por persona

| Persona | Asiento | Entró en (s) | Toques |
|---|---|---:|---:|
| pantalla | pantalla grande | — | 0 |
| persona-1 | Clínica · Urgencias | 0.3 | 1 |
| persona-2 | Clínica · Administración | 0.3 | 1 |
| persona-3 | Hospital Rural · Turno | 0.4 | 1 |
| persona-4 | Hospital Rural · Administración | 0.4 | 1 |
| persona-5 | Comité | 0.4 | 1 |

#### Qué ve cada pantalla en cada fase

Título = el texto visible más grande. Palabras = todas las de la pantalla. ↕ = hay que desplazarse.

##### Pantalla grande

| Fase | Título | px | Palabras | Botones |
|---|---|---:|---:|---|
| Unirse | HADVD | 223 | 53 | Ver registro · Cambiar a modo oscuro · Pregúntale a Sculptor |
| Posturas | Cada persona da su postura. | 60 | 60 | Ver registro · Cambiar a modo oscuro · Pausa · Siguiente · Pregúntale a Sculptor |
| Debate | escribiendo… | 22 | 59 | Ver registro · Cambiar a modo oscuro · Pausa · Siguiente · Pregúntale a Sculptor |
| Propuesta | Administración de Clínica: respaldamos el pedido. Nuestros costos siguen reservados. | 30 | 106 ↕ | Ver registro · Cambiar a modo oscuro · Pausa · Siguiente · Pregúntale a Sculptor |
| Comité | 27/50 | 78 | 64 | Ver registro · Cambiar a modo oscuro · Pregúntale a Sculptor |
| Acta | 27/50 | 78 | 64 ↕ | Ver registro · Cambiar a modo oscuro · Nueva demo · Pregúntale a Sculptor |
| done-final | 27/50 | 78 | 64 ↕ | Ver registro · Cambiar a modo oscuro · Nueva demo · Pregúntale a Sculptor |

##### Persona 1 (Clínica · Urgencias)

| Fase | Título | px | Palabras | Botones |
|---|---|---:|---:|---|
| entrada | Eres la Clínica | 41 | 69 | Cambiar a modo oscuro · Pedir la cama ahora · Pedir, pero aceptar otra salida · Ceder si el otro caso pesa más |
| Posturas | Eres la Clínica | 41 | 69 | Cambiar a modo oscuro · Pedir la cama ahora · Pedir, pero aceptar otra salida · Ceder si el otro caso pesa más |
| Debate | Eres la Clínica | 41 | 32 | Cambiar a modo oscuro |
| Propuesta | Eres la Clínica | 41 | 78 | Cambiar a modo oscuro |
| Comité | 0,53 | 42 | 51 | Cambiar a modo oscuro |
| Acta | Eres la Clínica | 41 | 39 | Cambiar a modo oscuro · Descargar el acta |
| done-final | Eres la Clínica | 41 | 39 | Cambiar a modo oscuro · Descargar el acta |

##### Persona 2 (Clínica · Administración)

| Fase | Título | px | Palabras | Botones |
|---|---|---:|---:|---|
| entrada | Eres la Clínica | 41 | 61 | Cambiar a modo oscuro · Respaldar el pedido · Respaldar con tope de costo · No comprometer presupuesto |
| Posturas | Eres la Clínica | 41 | 61 | Cambiar a modo oscuro · Respaldar el pedido · Respaldar con tope de costo · No comprometer presupuesto |
| Debate | Eres la Clínica | 41 | 32 | Cambiar a modo oscuro |
| Propuesta | Eres la Clínica | 41 | 78 | Cambiar a modo oscuro |
| Comité | 0,53 | 42 | 51 | Cambiar a modo oscuro |
| Acta | Eres la Clínica | 41 | 39 | Cambiar a modo oscuro · Descargar el acta |
| done-final | Eres la Clínica | 41 | 39 | Cambiar a modo oscuro · Descargar el acta |

##### Persona 3 (Hospital Rural · Turno)

| Fase | Título | px | Palabras | Botones |
|---|---|---:|---:|---|
| entrada | Eres el Hospital Rural | 41 | 70 | Cambiar a modo oscuro · Pedir la cama ahora · Pedir, pero aceptar otra salida · Ceder si el otro caso pesa más |
| Posturas | Eres el Hospital Rural | 41 | 70 | Cambiar a modo oscuro · Pedir la cama ahora · Pedir, pero aceptar otra salida · Ceder si el otro caso pesa más |
| Debate | Eres el Hospital Rural | 41 | 33 | Cambiar a modo oscuro |
| Propuesta | Eres el Hospital Rural | 41 | 79 | Cambiar a modo oscuro |
| Comité | 0,53 | 42 | 51 | Cambiar a modo oscuro |
| Acta | Eres el Hospital Rural | 41 | 39 | Cambiar a modo oscuro · Descargar el acta |
| done-final | Eres el Hospital Rural | 41 | 39 | Cambiar a modo oscuro · Descargar el acta |

##### Persona 4 (Hospital Rural · Administración)

| Fase | Título | px | Palabras | Botones |
|---|---|---:|---:|---|
| entrada | Eres el Hospital Rural | 41 | 62 | Cambiar a modo oscuro · Respaldar el pedido · Respaldar con tope de costo · No comprometer presupuesto |
| Posturas | Eres el Hospital Rural | 41 | 62 | Cambiar a modo oscuro · Respaldar el pedido · Respaldar con tope de costo · No comprometer presupuesto |
| Debate | Eres el Hospital Rural | 41 | 33 | Cambiar a modo oscuro |
| Propuesta | Eres el Hospital Rural | 41 | 79 | Cambiar a modo oscuro |
| Comité | 0,53 | 42 | 51 | Cambiar a modo oscuro |
| Acta | Eres el Hospital Rural | 41 | 39 | Cambiar a modo oscuro · Descargar el acta |
| done-final | Eres el Hospital Rural | 41 | 39 | Cambiar a modo oscuro · Descargar el acta |

##### Persona 5 (Comité)

| Fase | Título | px | Palabras | Botones |
|---|---|---:|---:|---|
| entrada | Eres el Comité | 41 | 55 | Cambiar a modo oscuro |
| Posturas | Eres el Comité | 41 | 55 | Cambiar a modo oscuro |
| Debate | Eres el Comité | 41 | 33 | Cambiar a modo oscuro |
| Propuesta | Eres el Comité | 41 | 79 | Cambiar a modo oscuro |
| Comité | Eres el Comité | 41 | 34 | Cambiar a modo oscuro · Razón: por equidad · Rechazar · Aceptar |
| Acta | Eres el Comité | 41 | 39 | Cambiar a modo oscuro · Recibir resumen por WhatsApp · Descargar el acta |
| done-final | Eres el Comité | 41 | 39 | Cambiar a modo oscuro · Recibir resumen por WhatsApp · Descargar el acta |

#### Línea de tiempo

- 0.7 s: Sala nueva: HADVD
- 0.9 s: QR leído: http://localhost:3520/room/HADVD
- 2.4 s: Persona 1 (Clínica · Urgencias) entró en 0.3 s
- 5.3 s: Persona 2 (Clínica · Administración) entró en 0.3 s
- 8.3 s: Persona 3 (Hospital Rural · Turno) entró en 0.4 s
- 11.2 s: Persona 4 (Hospital Rural · Administración) entró en 0.4 s
- 13.9 s: ── Fase: Posturas
- 14.1 s: Persona 5 (Comité) entró en 0.4 s
- 16.9 s: Las 5 personas entraron
- 19.1 s: Persona 4 (Hospital Rural · Administración) toca «Respaldar el pedido» (su postura)
- 19.1 s: Persona 2 (Clínica · Administración) toca «Respaldar el pedido» (su postura)
- 19.1 s: Persona 1 (Clínica · Urgencias) toca «Pedir la cama ahora» (su postura)
- 19.1 s: Persona 3 (Hospital Rural · Turno) toca «Pedir la cama ahora» (su postura)
- 21.6 s: ── Fase: Debate
- 49.6 s: ── Fase: Propuesta
- 63.6 s: ── Fase: Comité
- 68.3 s: Persona 5 (Comité) toca «Aceptar» (decisión del Comité)
- 68.3 s: ── Fase: Acta
