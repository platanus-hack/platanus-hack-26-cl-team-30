# Resultados finales

Estado de Sculptor al cierre del sábado 21 de noviembre de 2026. Cada afirmación apunta a dónde se puede comprobar. Lo que no está verificado está al final y en `PENDIENTES.md`.

## Qué funciona

| Qué | Cómo se prueba | Dónde |
| --- | --- | --- |
| **Demo de 5 personas con negociación entre agentes** (ronda 20): cada persona entra por un QR único, elige su postura con un toque, los agentes debaten a la vista, el motor propone y el Comité acepta o rechaza con una razón | Prueba de 5 novatos en navegadores reales: **pasó en 73,9 s**, 1 toque por persona | `docs/QA_DEMO.md`, `scripts/novato-demo.mjs` |
| **El suelo:** una clínica con tres roles, umbral de autoridad, firma y Comité | Pruebas del motor y recorrido por HTTP | `tests/engine.test.ts`, `scripts/e2e.mjs` |
| **Entre organizaciones:** dos hospitales y una cama UCI, orden por puntaje y desempate por equidad | Puntajes 0,52 y 0,53, margen de empate 0,02, calculados por el motor | `src/lib/engine/deterministic.ts`, `tests/engine.test.ts` |
| **Otros rubros con el mismo motor:** grúa entre dos constructoras y camión refrigerado entre dos distribuidoras | Escenarios fijos y páginas de caso | `src/lib/genome/scenarios.ts`, `/casos/*` |
| **Una organización nueva desde una frase:** el modelo escribe el genoma y el código lo valida antes de usarlo | Validación con Zod y detector de fugas | `src/agents/mutate-genome.ts` |
| **Permisos de verdad:** el dato reservado se filtra en el servidor; un intento ajeno da 403 y queda en la bitácora | Pruebas de seguridad | `tests/security.test.ts` |
| **Acta exportable** en Markdown y JSON, con las decisiones automáticas aparte | Ruta del acta | `src/app/api/rooms/[roomId]/acta/` |
| **Telemetría honesta:** dice qué proveedor de modelo corrió y si fue local o nube | Lectura de la telemetría en la pantalla grande | `src/lib/llm.ts` |
| **Landing de Sculptor** (página principal) con intro animada, pⁿ calculado por el motor y la simulación orbital del pitch | Build y navegador | `/`, `src/components/sculptor/` |

## Cifras medidas

Todas salen de `MEDICIONES.md`, con su contexto.

| Cifra | Contexto |
| --- | --- |
| **507 de 507 pruebas** | `npm test` sin modelo, 16 archivos |
| **500 conexiones en vivo, p95 de 51,5 ms** | En un notebook, sin red de por medio y sin pasar por Next |
| **142 de 142 pasos** del recorrido completo | Contra el deploy en Render, con la versión actual (22 de noviembre, 01:57). La prueba de novatos con 5 navegadores también pasó contra el deploy, a ritmo real, sin fugas |
| **60 cuadros por segundo** en la pantalla grande con la galaxia | Apple M4 con GPU |
| **De 184 a 66 palabras** en la pantalla del Comité | Silla del celular, antes y después de la ronda 8 |
| **1 toque por persona** y unos 15 s desde la última postura hasta el turno del Comité | Demo de la ronda 20, con 2,5 s entre mensajes |

## Qué es simulado

- **Los datos del caso:** pacientes, costos, puntajes y plazos vienen de `src/lib/genome/seeds.ts`. No es una herramienta clínica y nadie del área de salud validó el flujo.
- **pⁿ es un modelo ilustrativo:** muestra por qué una compuerta humana sostiene la confiabilidad de una cadena; no es una medición de agentes reales.
- **En la prueba de novatos el modelo no respondió:** los 4 argumentos del debate fueron el texto de respaldo, que el código usa cuando el modelo falla.

## Qué no está verificado

- El modelo local en el NVIDIA DGX Spark y su latencia.
- La latencia de Claude por frase en el deploy.
- La carga en el deploy de Render.
- Un ensayo con teléfonos reales en la red de la sede.
- Los canales del Comité contra los servicios reales: WhatsApp de punta a punta y la nota de voz del caso se probaron en vivo (`docs/MEDICIONES.md`); la llamada telefónica no (falta un número de Twilio) y la plantilla sigue en revisión en Meta.

Detalle y responsables en `PENDIENTES.md`.
