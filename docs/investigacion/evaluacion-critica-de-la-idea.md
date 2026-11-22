> Evaluación crítica de la idea, pedida a un modelo de IA en el rol de jurado técnico y socio de Platanus, **antes de construir**. Se conserva tal cual porque explica varias decisiones del producto; qué se hizo con cada hallazgo está en `docs/PROCESO.md` (sección «Qué cambió por la evaluación crítica»).

# Evaluación — "Esqueleto Organizacional Metamórfico" · Track 👥 Multiplayer
*(Rol: jurado técnico + socio VC de Platanus. Sin adulación. Ponderaciones exactas de esta edición: `[ponderación exacta no provista]` — evalúo cada pilar 1–10 con evidencia del planteamiento.)*

---

## 1. Veredicto de Track Fit (👥 Multiplayer)

**Veredicto: EN RIESGO (pasa en papel, se puede romper en vivo).**

**Prueba eliminatoria ("mejora con más de una persona"):** en diseño, **PASA**. La evidencia está en Acto 1: *"cada persona que entra muta el esqueleto en vivo para todos (cambia la topología del grafo, los paneles visibles de cada jugador)"* y la **detección de conflictos en vivo** (Comercial vs. Finanzas) que *requiere* ≥2 humanos para existir. Eso es coordinación real, no un botón de compartir link. ✅

**Auditoría punto por punto de las trampas "No califica":**

| Trampa | ¿Cae? | Evidencia |
|---|---|---|
| Single-player + "compartir link" (QR cosmético) | **RIESGO** | El QR "como nuevo rol (Directorio/Auditor)" solo califica si *cambia el grafo* al entrar. Si es observador pasivo, es un espectador, no un jugador. |
| **Una persona con muchos agentes → Simulations** | **RIESGO ALTO** | El planteamiento está *desequilibrado hacia agentes*: "ecosistema", "organismo vivo", "evolución", agentes por rol que "negocian en paralelo". Con 1 humano operando y un enjambre de agentes que *mutan solos*, un juez lo clasifica como **Simulations** ("un mundo que corre solo"). |
| Un mundo que corre solo (Simulations) | **RIESGO ALTO** | *"el indicador p^n se recalcula al instante y el esqueleto vuelve a mutar en vivo"* — si la mutación ocurre *sin* input humano, es simulación, no multiplayer. |

**Punto exacto donde rompe frente al juez:** el momento en que 2 humanos deben operar a la vez. Si en la demo uno *rellena su rol* y el otro *mira a su agente trabajar*, es **2 jugadores solitarios + agentes**, no coordinación. **Blindaje:** toda mutación del esqueleto debe ser *disparada por un humano y visible para el otro en el mismo segundo*; los agentes solo *proponen* y el **código determinista** decide. Si el "organismo" se mueve solo, pierden el track.

---

## 2. Scorecard Crítico (1–10) · `[ponderación exacta no provista]`

| Pilar | Nota | Justificación (evidencia) | Cambio para llegar a 9–10 |
|---|---|---|---|
| **1. Track Fit (Multiplayer real)** | **7** | Pasa la prueba por la mutación colectiva + conflictos en vivo. Pone puntos la asimetría RBAC y el riesgo de leerse como Simulations. | Que en la demo 2+ humanos *causen* cada cambio mutuamente; eliminar toda mutación autónoma del "organismo". |
| **2. Originalidad** | **7** | El marco "genoma organizacional + metamorfosis + p^n en vivo" es distinto. Pone puntos: "esqueleto determinista + agentes + HITL" es un patrón conocido (citan la lección Klarna), y "multiplayer B2B" no es novedad en sí. | Hacer visible la pieza que ningún otro equipo puede mostrar: **agentes emparejados por rol con RBAC real + compuerta determinista en rojo**. Eso sí es nuevo en demo. |
| **3. Impacto (dolor real + startup)** | **6** | Dolor real y medible (gobernanza, silos, coordinación por WhatsApp/Excel) y tesis sólida. **Pero** Platanus declaró "no nos interesa el negocio"; el impacto se mide por *efecto en el mundo*, y un OS interno B2B es abstracto en una demo de 3 min. El marco "88% de pilotos" es marketing, no impacto demostrable en sala. | Cambiar el pitch de "por qué es una gran empresa" a **un caso concreto en pantalla** (una licitación que se apruebe/vete en vivo). Mostrar el efecto, no la tesis. |
| **4. Ejecución / Demo 36 h** | **3** | **Sobre-diseñado.** Alcance: genoma de 5 parámetros + metamorfosis de UI + RBAC + Fog of War + conflictos + p^n en vivo + agentes por rol + 2 actos. Eso no se estabiliza en 36 h para una demo fluida. El propio "adaptive_ui_modules" (UI que cambia de forma por organización y rol) es el mayor riesgo de demo rota. | Recortar a **un esqueleto fijo de 3 roles + 1 flujo** con RBAC y 1 compuerta. La "metamorfosis infinita" pasa a un *toggle con 2 estados pre-dibujados*, no UI generativa. |
| **5. Tecnología / Complejidad (GB10 real)** | **6** | Arquitectura determinista (no-prompt) + agentes + inferencia 100% local en DGX Spark 128 GB es técnicamente fuerte y casi exclusivo en la sala. Pone puntos: **1 solo nodo + Qwen 3.8 + modo thinking + agentes simultáneos = cuello de botella de latencia** en una demo en vivo. | Probar concurrencia *antes* de la demo; fijar 1–2 llamadas de razonamiento a la vez; desactivar thinking para todo lo de alta frecuencia. |

**Lectura del jurado/VC:** la idea tiene **techo alto** (Originalidad + Tecnología), pero su **nota más baja es Ejecución (3/10)**, que es la que define si llega a la final. En 36 h, esto es una apuesta: o recortan brutalmente y la demo es *fluida*, o van a lo "completo" y la demo *se rompe en vivo*.

---

## 3. Fortalezas (Ventajas Ganadoras) — máx. 5

| # | Fortaleza | Por qué importa a un jurado de Platanus | Cómo hacerla visible en 3 min |
|---|---|---|---|
| 1 | **Esqueleto determinista en código** (no el prompt decide) | Diferencia real: responde a la objeción "¿es un chatbot con RBAC?" | En la demo, la compuerta **se bloquea en rojo por el código**, y el jurado *cambia el parámetro* y el resultado cambia de forma predecible. |
| 2 | **HITL + agente emparejado por rol con RBAC** | Casi nadie muestra agentes *limitados por permisos* en vivo; es demostrable y memorable | El agente de Ventas intenta leer costo/margen → **se niega en pantalla**; el agente de Finanzas sí lo ve. Contraste en 10 s. |
| 3 | **IA soberana en DGX Spark 128 GB (on-premise)** | Recurso diferencial (pocos equipos lo tienen) + responde al freno #1 (fuga de datos) sin nubes | Mostrar el proceso corriendo local (puerto/ps del GB10) y el dato confidencial **nunca sale de la máquina**. |
| 4 | **Indicador p^n en vivo** (0.95^10 ≈ 59.8%) | "Wow" cuantitativo, verificable y que *reacciona* a cada acción humana → refuerza multiplayer | Cada regla añadida/quitada por un humano **mueve el número en pantalla** y el jurado ve la confiabilidad subir/bajar en vivo. |
| 5 | **Fog of War / visibilidad asimétrica** | Hace *tangible* el multiplayer: lo que veo ≠ lo que ves | Dos pantallas lado a lado: el mismo evento, **datos distintos según rol**. Es la imagen que gana Originalidad. |

---

## 4. Puntos Críticos y Riesgos Mortales (mayor → menor severidad)

| Sev. | Riesgo (evidencia) | Mitigación concreta |
|---|---|---|
| **CRÍTICO** | **Latencia/concurrencia en 1 nodo GB10.** "Modelo LLM principal Qwen 3.8" + agentes por rol "negociando en paralelo" + modo *thinking*. En una demo en vivo, 3 agentes razonando a la vez sobre un solo ARM64 = respuestas de 5–15 s, demo se percibe muerta. | (1) **1–2 llamadas de razonamiento concurrentes máximas**, con cola; (2) **desactivar thinking** (Qwen3 tiene toggle de razonamiento) para estructura/clasificación/validación → latencia sub-segundo; (3) pensar *solo* en el nodo coordinador y en resolución de conflictos; (4) test de concurrencia grabado antes de la demo. *Nombres exactos de parámetros de thinking: NO VERIFICADO — confirmar contra el runtime Ollama del GB10.* |
| **CRÍTICO** | **Over-engineering en 36 h.** `adaptive_ui_modules` ("interfaz que cambia de forma según la organización y el rol") + "metamorfosis" continua. Es la pieza más frágil y la que más puede romperse en vivo. | Congelar la UI a **2 estados pre-diseñados** (Esqueleto Base → Organismo) conmutados por un evento, no generativos. La "metamorfosis" se *narra* como capacidad, no se *genera* en vivo. |
| **ALTO** | **Confusión cognitiva en el pitch.** 2 pantallas + agentes + RBAC + p^n + jerarquía: si el jurado no entiende en 20 s qué están viendo, pierden Originalidad e Impacto por percepción. | **Una historia, un evento, dos roles.** Nada de mostrar el genoma completo. El jurado ve: 2 personas → 1 choque de reglas → 1 bloqueo en rojo → 1 aprobación → p^n cambia. |
| **ALTO** | **Acto 1 se come el tiempo / parece formulario.** El onboarding "define rol, decisiones, RBAC, qué se coordina mal por chat" puede ser 2 personas llenando forms = se siente single-player y lenta. | **Semilla de rubro precargada** (Distribuidora B2B) → cada humano solo *confirma/ajusta* 2 campos. Acto 1 en ≤45 s. El tiempo va al Acto 2 (la magia). |
| **ALTO** | **Riesgo de re-clasificación a Simulations.** El léxico "organismo/evolución/metamorfosis" + agentes autónomos invita al juez a decir "esto modela una empresa (Simulations)". | En el pitch, 2 humanos son **los que deciden**; cada mutación se *atribuye a un humano* ("cuando Finanzas quita el veto, el p^n sube"). Eliminar lenguaje de "el sistema evoluciona solo". |
| **MEDIO** | **RBAC como teatro.** Si los permisos son strings en el prompt y no *enforcement* en código, el agente del juez o el jurado técnico lo detectan en una pregunta ("¿qué impide al agente de Ventas leer el margen?"). | RBAC aplicado **en la capa de datos** (Supabase RLS / filtro en el retrieval), no en el prompt. Demo: intento real de lectura denegado por el sistema, no por el modelo. |
| **MEDIO** | **Sobrepeso en tesis de negocio** (88% pilotos, 3.6% ROI, "potencial startup"). Platanus declaró no puntuar el negocio; ese tiempo de pitch roba a Originalidad/Impacto demostrable. | Cortar la tesis a 1 línea. Mover ese tiempo a **mostrar el efecto concreto** del flujo en pantalla. |

---

## 5. Interrogatorio del Jurado Escéptico (5 preguntas ácidas)

1. **"¿Qué impide *en código* que el agente de Ventas acceda al margen de Finanzas? Muéstrenmelo."**
   - *Debilidad que busca:* RBAC de fachada (aplicado en el prompt, no en el sistema).
   - *Qué debe mostrar el producto:* consola/requisición real donde el intento de lectura **falla por RLS en Supabase**, con stack visible; no "el modelo dijo que no".

2. **"¿Esto no es un simulacro de una empresa corriendo solo, con un enjambre de agentes? ¿Dónde están las personas?"**
   - *Debilidad que busca:* clasificación a **Simulations** / single-player con agentes.
   - *Qué debe mostrar:* el jurado **toma el rol de Directorio por QR** y su decisión *cambia* el p^n y los paneles de los otros dos en vivo. Sin humano, el sistema no se mueve.

3. **"¿Por qué confiar en que el 'esqueleto determinista' no es solo otro prompt largo que a veces falla?"**
   - *Debilidad que busca:* la "determinismo" no es real; el LLM está decidiendo.
   - *Qué debe mostrar:* el juez **altera un umbral** (piso de descuento) y el bloqueo rojo cambia **de forma idéntica cada vez**; mostrar la regla en código (no texto).

4. **"¿Cuántas llamadas al LLM concurrentes están corriendo ahora mismo, y cuántas aguanta ese GB10 antes de que esto se congele en la demo?"**
   - *Debilidad que busca:* cuello de botella de latencia/concurrencia (nodo único, thinking activo).
   - *Qué debe mostrar:* medidor en pantalla (colas, tokens/s, ms por llamada) con **colapso evitado por la cola**; un test de estrés ya grabado.

5. **"¿Qué es lo que hace esto que una simple regla en Excel + un workflow de Zapier no resuelve ya?"**
   - *Debilidad que busca:* que el núcleo es trivial (reglas + IF) y el LLM es decorativo.
   - *Qué debe mostrar:* el **resolviendo de conflictos** (Comercial vs. Finanzas) que requiere razonamiento + el **recálculo de p^n** dependiente del grafo — cosas que un workflow fijo no cubre — y la negociación multi-agente que el Excel no puede.

---

## 6. Plan de Recorte y Optimización para Ganar en 36 h

**Qué CORTAR sin piedad:**
- **`adaptive_ui_modules` generativa** → reemplazar por **2 estados de UI pre-dibujados** (Base → Organismo).
- **"Metamorfosis infinita"** → queda como *storytelling*; la ejecución es un conmutador.
- **Más de 3 roles** en la demo (Ventas · Finanzas · 1 más). El resto se menciona, no se implementa.
- **QR como rol genérico** → solo 1 rol extra opcional (Directorio), usado *solo si sobra tiempo*.
- **Toda la tesis de negocio/mercado** en el pitch → 1 línea.
- **Múltiples rubros de semilla** → 1 rubro precargado (Distribuidora B2B).

**MVP mínimo ganador (núcleo técnico exacto) — lo que DEBE ser real:**
1. **Grafo de 3 roles** con jerarquía y **1 compuerta determinista en código** (piso de descuento) — real, no prompt.
2. **RBAC aplicado en datos** (Supabase RLS) — 1 dato confidencial (margen) oculto para Ventas, visible para Finanzas. **Demo de denegación real.**
3. **1 conflicto en vivo** (Comercial propone 15% vs. piso de Finanzas) → **bloqueo rojo** + alerta al humano de Finanzas.
4. **Aprobación/veto humano** que recalcula **p^n en pantalla**.
5. **1 agente por rol** emparejado con el RBAC (proponen; no deciden).
- *Simplificable sin perder impacto:* la "metamorfosis" de UI, el número de agentes, la variedad de eventos (1 evento basta: licitación con descuento agresivo).

**Configuración recomendada de Qwen 3.8 en el GB10 (para demo):**
| Componente | Modo | Por qué |
|---|---|---|
| Nodo **coordinador / resolución de conflictos** | **Razonamiento ALTO (thinking ON)** | Rara vez, 1 llamada; vale la latencia extra |
| **Validación de reglas / RBAC** | **Determinista en código** (sin LLM) | Sub-segundo, 100% reproducible → es el "wow" técnico |
| **Estructuración de inputs / clasificación** | **Thinking OFF** | Alta frecuencia, necesita latencia sub-segundo en vivo |
| **Concurrencia** | **1–2 llamadas razonando a la vez** + cola para el resto | Evita el colapso del nodo único ARM64 |
*Parámetros exactos del toggle de thinking en el runtime (Ollama/GB10): NO VERIFICADO — validar contra la versión instalada antes de bloquear.*

**Guion Demo 3 min (0:00–3:00) — 2+ personas en vivo:**
- **0:00–0:15** Gancho: *"La caja de una empresa muere en el medio, entre Ventas y Finanzas."*
- **0:15–0:35** **Acto 1 comprimido:** Ventas y Finanzas (2 dispositivos) confirman su rol sobre la semilla "Distribuidora B2B". p^n aparece (~59.8%).
- **0:35–0:50** **Choque en vivo:** Ventas declara "descuento hasta 15%"; Finanzas "sobre 5% requiere firma". El sistema **ilumina el conflicto**.
- **0:50–1:20** **Fog of War:** pantalla split — el agente de Ventas **intenta leer el margen → se deniega en pantalla**; Finanzas lo ve. *(RBAC real, la imagen que gana.)*
- **1:20–1:50** **Acto 2:** entra la licitación. El esqueleto **bloquea en rojo** (compuerta determinista) y alerta a Finanzas.
- **1:50–2:10** **HITL:** un **jurado (por QR, rol Directorio)** aprueba/contrapropone → **p^n sube en vivo** y los paneles de los otros 2 cambian.
- **2:10–2:45** **Cierre técnico:** "todo corrió local en el DGX Spark, 128 GB; los datos nunca salieron." + "el bloqueo es código, no prompt."
- **2:45–3:00** Impacto: *"menos caja muerta, y cada agente con permisos reales."*

**Línea de jurado/VC (cero adulación):** la idea tiene techo para Originalidad y Tecnología, pero **hoy el riesgo #1 es morir de alcance**. Con el recorte de la sección 6 y el demo guion de arriba, pasa de "ambicioso pero frágil" a "fluido y memorable". Sin el recorte, la probabilidad de que la demo se congele o parezca un simulacro es **ALTA** y eso es lo que decide la final.