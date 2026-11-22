# Proceso: cómo llegamos a Sculptor

Platanus Hack 26 Santiago ft. Buk, track Multiplayer. Del viernes 20 en la noche al domingo 22 a las 09:30. Este documento cuenta el camino: qué ideas evaluamos, qué nos dijo una evaluación crítica, cómo cambió el producto y en qué orden se construyó. Las horas salen del historial de git; las razones, de `docs/DECISIONES.md`.

## 1. Elegir la idea

1. **El track.** Leímos el brief de los cinco tracks ([`investigacion/evento/brief-de-tracks.md`](investigacion/evento/brief-de-tracks.md)) y elegimos Multiplayer: el producto tiene que ser mejor con más de una persona.
2. **Tres ideas con brief propio** ([`investigacion/`](investigacion/)):
   - **Minga**: un agente que junta pymes para comprar con precio de empresa grande.
   - **Homeward**: coordinar el alta hospitalaria para que nadie se quede internado solo porque nadie coordinó su salida.
   - **Esqueleto Organizacional Metamórfico**: varias organizaciones deciden juntas sobre un recurso escaso sin revelarse sus datos. **Es la elegida** y la que se convirtió en Sculptor.
3. **Evaluación crítica antes de construir.** Le pedimos a un modelo de IA que evaluara la idea en el rol de jurado técnico y socio de Platanus, sin adulación ([`investigacion/evaluacion-critica-de-la-idea.md`](investigacion/evaluacion-critica-de-la-idea.md)). La sección 4 de este documento dice qué hicimos con cada hallazgo.
4. **Plan definitivo.** Con eso escribimos el plan v3 ([`investigacion/plan-definitivo-esqueleto-metamorfico.md`](investigacion/plan-definitivo-esqueleto-metamorfico.md) y su versión explicada en PDF): un **suelo** que tiene que funcionar sí o sí (una clínica con tres roles), una **ambición** (dos hospitales que compiten por una cama UCI) y una **regla de corte** (si la ambición no queda estable, se presenta el suelo).

## 2. Línea de tiempo (sábado 21 de noviembre)

| Hora | Hito |
| --- | --- |
| 01:07 | Repo creado desde la plantilla del evento |
| 01:15 | Base del proyecto: Next.js, capa única de modelos (`src/lib/llm.ts`) y Supabase |
| 01:59 | Documentación técnica viva desde el inicio: arquitectura, decisiones y preguntas del jurado |
| 02:17 | Claude como proveedor del deploy público y blueprint de Render |
| 03:21 | Núcleo multijugador: salas, roles, vista por rol y eventos en tiempo real (SSE) |
| 04:04 | Ronda 1: identidad por rol, sala de demo recreable, cola de modelos, agentes tipados y pruebas |
| 04:34 | Motor determinista, salas entre organizaciones y agentes por rol (nombre de trabajo: «Nexo») |
| 05:02 | Ronda 3: endurecimiento de permisos y verificación en navegador |
| 05:11 | Un ensayo con un agente que simulaba a los jueces encontró una fuga de un dato reservado; se corrigió |
| 12:06 | Retomamos después de dormir: mediciones, preguntas y agente de rol |
| 13:42 | Portada, centro de mando, canales del Comité (WhatsApp y voz) |
| 15:44 | Diseño de Nahum y menos texto en toda la demo |
| 17:31 | Demo de 3 personas: bots en los roles administrativos |
| 17:50 | **Nuevo nombre: Sculptor**, logo y pitch con el diseño de Nahum |
| 18:53 | Demo pauteada: asientos por orden de llegada, Comité por el QR único, plan B a los 20 s |
| 19:07 | Notas de voz informativas por WhatsApp (ElevenLabs y Kapso) |
| 19:26 | Logo de cubo («piedra polimórfica») |
| 20:07 | **Logo oficial: la galaxia NGC 253 en píxeles**, reemplaza al cubo |
| 20:37 | Modo claro y oscuro en toda la app; páginas de caso por rubro |
| 22:58 | **Ronda 20: negociación entre agentes con 5 personas**, código de sala único |
| 23:08 | Landing del protocolo (`/sculptor`) y marca |
| 23:13 | Guion fusionado de la demo (3:00) y preguntas del jurado con cifras reales |

## 3. Cómo cambió el producto

**El nombre.** «Cupo» (primer nombre de trabajo), después «Nexo» y al final **Sculptor**, por la Galaxia del Escultor (NGC 253), visible desde el cielo austral de Chile. Los identificadores internos (`NEXO_*`, `src/components/nexo/`) conservan el nombre viejo a propósito: cambiarlos rompería Render y los webhooks.

**La marca** ([`diseno/sculptor/`](diseno/sculptor/)):
- v0: tres nombres con su signo (Cupo, Velo y Quórum), en [`diseno/sculptor/proceso/conceptos-v0-nombres.png`](diseno/sculptor/proceso/conceptos-v0-nombres.png).
- v2: cinco caminos para Sculptor (piedra polimórfica, el corte, NGC 253 en 1 bit, frontera y el golpe), en `conceptos-v2.png`.
- Primero se usó el cubo y después se eligió **la galaxia en píxeles**: datos, no ilustración, y el núcleo lima es la decisión.

**La demo.**
- **Una clínica, tres roles.** Es el suelo del plan.
- **Dos hospitales y una cama.** Es la capa entre organizaciones.
- **Demo de 3 personas con bots.** Para que la pueda jugar gente que no la conoce, los bots hacen el límite y la firma.
- **Demo pauteada.** Asientos por orden de llegada, un QR único y plan B si alguien no actúa.
- **Ronda 20: 5 personas.** Cada una con su agente; los agentes negocian a la vista y el Comité acepta o rechaza con una razón.

**La interfaz.** Los «órganos» apilados de la primera versión se reemplazaron por una silla del celular con una tarjeta por turno: un mentor dijo que la pantalla «bombardea con texto». Pasó de 184 a 66 palabras en la pantalla del Comité (`docs/MEDICIONES.md`).

**La pantalla grande.** La simulación orbital de Nahum (del Polo Sur a la galaxia) quedó como prototipo del pitch, en [`diseno/nahum/`](diseno/nahum/) y en la landing `/sculptor`. En la app se dejó una galaxia en canvas que enciende un nodo por persona conectada (`docs/DECISIONES.md`).

## 4. Qué cambió por la evaluación crítica

| La evaluación advirtió | Qué hicimos | Dónde se ve |
| --- | --- | --- |
| Riesgo de leerse como **Simulations**: un «organismo» que muta solo | Principio 2: nada se mueve sin una persona. Lo que hace el piloto automático en la demo queda marcado como automático y va aparte en el acta | `CLAUDE.md`, `docs/DECISIONES.md` («Las decisiones del piloto automático se marcan…») |
| **Morir de alcance** en 36 horas | Suelo, ambición y regla de corte. El modelo no genera interfaz: solo contenido validado | `CLAUDE.md` (principio 1), `src/lib/genome/schema.ts` |
| **QR cosmético**: un rol que solo mira | El Comité entra por QR y su decisión cambia el estado de todos, con razón obligatoria | `src/lib/engine/deterministic.ts`, `docs/ARQUITECTURA.md` |
| **Impacto abstracto** en una demo de 3 minutos | Un caso concreto con algo en juego: una cama UCI entre dos hospitales | `CLAUDE.md` (principio 4), `docs/DEMO_DIA.md` |
| **RBAC de verdad**, no de pantalla | El servidor filtra por organización y rol antes de enviar; un intento ajeno da 403 y queda en la bitácora | `projectStateForOrgAndRole`, `tests/security.test.ts` |
| Un solo equipo de cómputo podía **colapsar** con llamadas en paralelo | Cola de llamadas en la capa única de modelos | `src/lib/llm.ts` |

La evaluación también proponía Supabase con RLS para los permisos. Se descartó: las salas viven en memoria y el filtro es código del servidor. Supabase quedó solo para el formulario de acceso y las entrevistas (`docs/DECISIONES.md`).

## 5. Cómo trabajamos

- **Roles.**
  - Ramón: producto web (pantallas y rutas de la API).
  - Sebastián: agente e infraestructura (modelos, Spark, integraciones y deploy); decide qué se corta.
  - Nahum: negocio y pitch.
- **Rondas.** El trabajo avanzó en rondas numeradas. Cada ronda terminaba con pruebas, documentación al día y, varias veces, un ensayo con un agente que leía el repo como lo harían los jueces.
- **Agentes de IA como equipo.** Gran parte del código se escribió con agentes de programación. Por eso la documentación se mantuvo viva desde la hora 1: `RECORRIDO`, `ARQUITECTURA`, `DECISIONES`, `MEDICIONES` y `PENDIENTES`.
- **Verdad antes que efecto.** Una cifra que no está en `MEDICIONES.md` no se dice, y el guion del día marca lo que no se debe decir (`DEMO_DIA.md`). Los borradores del pitch que describían piezas que la app no tiene se sacaron del repo.

El estado final está en [`RESULTADOS.md`](RESULTADOS.md).
