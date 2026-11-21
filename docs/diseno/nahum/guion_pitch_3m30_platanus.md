# Guion Coreografiado (3 min 30 s) — Platanus Hack 26 · Track 👥 Multiplayer

> **Soporte visual:** Abre `pitch_platanus_interactivo.html` en Chrome/Edge y pulsa **`F`** (pantalla completa).  
> **Duración objetivo:** **3:20** (deja **10 segundos** de colchón antes del corte de 3:30).  
> **Regla #1:** Nada de "hola, somos el equipo 30...". Arranca directo en el problema desde el segundo `0:00`.  
> **Nota importante:** Todas las cifras de este libreto están sincronizadas al decimal exacto con el motor real (`src/lib/engine/deterministic.ts` y `src/lib/genome/seeds.ts`): **`0,52` vs `0,53`** (desempate por equidad a favor del **Hospital Rural Valle Sur**), **`43,4% → 96,1%`** (1 clínica) y **`12,3% → 89,4%`** (2 hospitales).

---

## 0. Checklist T−10 Minutos (Antes de Subir al Escenario)

1. **Configurar el deck (`tecla C` en `pitch_platanus_interactivo.html`):**
   - Escribe el **nombre final** elegido (`cupo` o `Nexo`) → actualiza las 6 láminas al instante.
   - Confirma la **URL pública** (ej. `https://team-30-platanus-hack.onrender.com` o tu túnel Cloudflare) → regenera el **QR real** en Lámina 3.
   - Selecciona el **modo honesto** (`Híbrido Render + GB10` o `100% Local GB10`) para que Lámina 5 coincida exacto con la telemetría que muestra la app.
   - Pulsa **`R`** justo antes de empezar para dejar el contador de espera en `00:00` (y **`T`** si quieres ver el reloj de 3:30 en esquina superior derecha).
2. **Despertar y limpiar las pestañas (3 dispositivos):**
   - **Proyector (Nahum):** Pestaña 1 = `pitch_platanus_interactivo.html` en Fullscreen (`F`). Pestaña 2 = `/stage/demo-cross` abierta, con zoom al **110%** y sala fresca (sin decisiones selladas).
   - **Laptop 1 (Ramón — Clínica Andes):** Pestaña abierta en `/room/demo-cross?orgId=clinica_andes&roleId=role_a` (*Urgencias*) y lista la pestaña de `role_b` (*Gestión*) si muestran choque interno.
   - **Laptop 2 (Sebastián — Hospital Rural) + Teléfono Plan B:** Laptop en `/room/demo-cross?orgId=hospital_rural&roleId=role_a` (*Turno*) + **teléfono en 4G/5G ya abierto en `/room/demo-cross?orgId=comite_red&roleId=role_c`** (respaldo invisible por si ningún jurado alcanza a escanear en 10 s).
3. **Prueba real en 4G:** Escanear el QR de Lámina 3 con datos móviles y confirmar que carga en `< 3 s`.

---

## 1. Coreografía de los 3 Integrantes

| Integrante | Rol en Escenario | Qué hace (y qué NO hace) |
| :--- | :--- | :--- |
| **Nahum** *(Narrador)* | Voz principal + ritmo + clicker | **Nunca escribe texto ni pelea con ventanas.** Solo avanza láminas (`→` / `Espacio`), dirige la vista del jurado y marca las señales verbales. |
| **Ramón** *(Operador A)* | Clínica Andes (Urgencias / Gestión) | Dispara el intento de lectura prohibida (`403 RBAC_DENIED`), mueve su slider para generar el choque y dispara su propuesta de agente. |
| **Sebastián** *(Operador B + Plan B)* | Hospital Rural + Comité de respaldo | Opera Hospital Rural en vivo; si a los 10 s de invitar al jurado nadie aparece conectado en el Comité, ejecuta silenciosamente el rol Comité desde su teléfono. |

---

## 2. Guion Palabra por Palabra (0:00 → 3:20)

### 0:00 – 0:15 · LÁMINA 1 — El Gancho *(15 s)*
- **En pantalla:** Titular gigante + pulso ECG rojo latiendo + contador `00:00` corriendo.
- **Acción:** Nahum mira al jurado, respira 1 segundo y habla pausado:
> *"Hay una cama UCI.* *(pausa 1 s)*  
> *Dos hospitales la necesitan.* *(pausa 1 s)*  
> *Y quien tiene que decidir... no puede ver los datos del otro."* *(pausa 1 s)*  
> *"Escuchen ese latido: mientras nadie decide, el reloj sigue corriendo."*

---

### 0:15 – 0:35 · LÁMINA 2 — El Dolor y Por Qué la IA Sola Falla *(20 s)*
- **Acción:** Pulsa `→` a Lámina 2. Habla sobre los 3 puntos de la izquierda; al decir *"acumulan error"*, pulsa **`Espacio`** para animar el salto **`43,4% → 96,1%`**.
> *"Hoy las decisiones más caras de una organización se coordinan por WhatsApp y Excel: información partida, sin una regla que todos vean y sin registro.*  
> *Y meter agentes autónomos solos lo empeora: en un modelo ilustrativo donde cada paso acierta un 92%, diez pasos seguidos caen al **43%** — y entre dos hospitales, al **12%**.*  
> *(pulsa `Espacio` → barra sube en verde a **96,1%**)*  
> *Cuando metes un **freno humano determinista**, la confiabilidad salta al **96%**."*

---

### 0:35 – 0:55 · LÁMINA 3 — Presentación + QR Temprano al Jurado *(20 s)*
- **Acción:** Pulsa `→` a Lámina 3. Al decir *"intenta leer"*, pulsa **`Espacio`** (flashea **`403 RBAC_DENIED`**). Luego señala el QR violeta gigante a la derecha.
> *"Por eso construimos **[Cupo / Nexo]**: una sala multijugador donde varias personas —y sus agentes por rol— deciden a la vez, pero cada uno ve solo sus cartas.*  
> *(pulsa `Espacio` → flashea `403 RBAC_DENIED`)*  
> *Lo tachado no está escondido con CSS: **el servidor nunca lo envía por la red.** Y si un agente lo pide, recibe un `403` directo a la bitácora.*  
> *(señala el QR gigante)*  
> *No nos crean: **saquen su teléfono ahora.** Un jurado va a entrar escaneando este QR como **Comité Ético** y va a tener la última palabra en 60 segundos."*

---

### 0:55 – 2:25 · BLOQUE EN VIVO (`/stage/demo-cross`) *(90 s — El Corazón del Pitch)*
- **Acción:** Nahum hace clic en **`Abrir Escenario en Vivo (/stage/demo-cross) ↗`** (o cambia a Pestaña 2 ya abierta).

#### Golpe 1 (0:55 – 1:25) — Fog of War Real + `403 RBAC_DENIED` *(30 s)*
- **Señal para Ramón:** Nahum dice *"Miren a Clínica Andes y Hospital Rural en vivo"*.
- **Ramón (en su laptop):** hace clic en intentar leer el costo del otro hospital → en pantalla grande aparece el evento **`403 RBAC_DENIED`** en la bitácora en vivo.
> *"Aquí están los dos hospitales en tiempo real, con el contador latiendo con el reloj del servidor.*  
> *Ramón está en Clínica Andes; Sebastián en Hospital Rural. Cada uno tiene su agente heredando sus mismos permisos.*  
> *Miren lo que pasa cuando Ramón intenta que su agente lea el costo de cobertura del otro hospital...* *(pausa 1 s mientras salta el `403` en pantalla)*  
> ***`403 RBAC_DENIED`.** Si abren DevTools Network en esa laptop, ese número simplemente no existe en la respuesta SSE."*

#### Golpe 2 (1:25 – 1:50) — Choque de Autoridad + Fórmula de Equidad *(25 s)*
- **Señal para Ramón y Sebastián:** Nahum dice *"Cuando chocan los límites..."*.
- **Ramón & Sebastián:** muestran la compuerta bloqueada (Urgencias pide `100%`, Gestión aprueba hasta `60%`, propuesta `82%` queda bloqueada en rojo) y dejan visible el **Tablero de Asignación**.
> *"Cuando Urgencias y Gestión chocan en su límite de autoridad, el código detiene la compuerta en rojo hasta que una persona responda.*  
> *Y para repartir la cama única, **no decide la IA**: decide una fórmula fija y visible. Clínica Andes suma **0,52**, Hospital Rural suma **0,53**. Como la diferencia es `0,01` —menor al margen de `0,02`— es empate técnico y entra la **equidad**: gana **Hospital Rural**, el paciente con mayor necesidad sin cubrir. Y el costo de cobertura **jamás entra en la fórmula**."*

#### Golpe 3 (1:50 – 2:25) — El Clímax Multiplayer: El Jurado Decide *(35 s)*
- **Acción:** Nahum mira al jurado que escaneó el QR (en pantalla grande ya sale **`Comité Ético: Conectado`**).
  - *(Si pasan 8–10 segundos y nadie conectó por Wi-Fi, Sebastián activa el Plan B desde su teléfono sin decir nada).*
> *"Ahora la pelota está en manos del jurado que entró por QR como Comité Ético. No ves los costos de ningún hospital. Solo puedes aprobar o vetar... **escribiendo una razón obligatoria**, porque sin razón no hay decisión."*  
> *(espera 4–6 s a que el jurado presione Aprobar o Vetar)*  
> *"Miren la pantalla: **en el mismo segundo**, el pulso rojo se apaga, el contador se detiene en verde, la confiabilidad salta a **89%** y queda un **Acta auditable** lista para descargar en JSON y Markdown."* *(clic rápido opcional mostrando botón de Acta)*

---

### 2:25 – 2:40 · LÁMINA 4 — El Giro: Metamorfosis *(15 s)*
- **Acción:** Vuelve a Pestaña 1 (`pitch_platanus_interactivo.html`), pulsa `→` a Lámina 4, y pulsa **`Espacio`** dos veces mientras habla (`Salud` → `B2B Distribuidora Tech` → `1 Frase Libre`).
> *"Y un punto clave: no hicimos una app solo para camas.*  
> *(pulsa `Espacio` → `B2B Distribuidora Tech`)*  
> *Cambias de escenario y los **mismos 7 órganos fijos** se vuelven una distribuidora B2B negociando descuentos con margen secreto.*  
> *(pulsa `Espacio` → `1 Frase Libre`)*  
> *O escribes una frase libre y el modelo genera el Genoma JSON validado por Zod — sin romper nunca la interfaz ni los permisos."*

---

### 2:40 – 3:00 · LÁMINA 5 — Ingeniería ("La IA escribe. El código decide.") *(20 s)*
- **Acción:** Pulsa `→` a Lámina 5. Elige la frase final según el modo que configuraste con tecla `C`:
> *"Bajo el capó, una regla de oro: **la IA escribe; el código decide.***  
> *El modelo solo propone JSON y redacta desde su vista filtrada. Todo lo crítico —RBAC, `403`, compuertas, equidad y acta— es código determinista puro: **80 tests en verde** y **60 conexiones SSE simultáneas** probadas sin fugas.*  
> - ***(Si corren en modo Híbrido Render + GB10):*** *Hoy el QR público corre en Render con telemetría honesta, y con una sola variable de entorno corre 100% local en nuestro **Dell Pro Max GB10 de 128 GB** con cero bytes a la nube.*  
> - ***(Si corren 100% Local GB10):*** *Todo lo que vieron corrió 100% local en nuestro **Dell Pro Max GB10 de 128 GB**: cero bytes salieron a la nube, y aunque cortemos el modelo, el motor sigue decidiendo."*

---

### 3:00 – 3:20 · LÁMINA 6 — Track Multiplayer & Cierre Silencioso *(20 s)*
- **Acción:** Pulsa `→` a Lámina 6 (la línea ECG ya está **verde y calma**). Baja ligeramente la velocidad de tu voz para el remate final:
> *"La prueba del track Multiplayer es simple: ¿funciona igual con una sola persona? Aquí no. Ninguna persona —ni ningún agente— tiene los datos para decidir sola.*  
> *Dos organizaciones, sus agentes limitados por permisos reales, y ustedes desde el público cambiando el resultado en el mismo segundo.*  
> *(pausa 1 s, mirada firme al jurado)*  
> *Cualquier recurso crítico, entre cualquier grupo de organizaciones. Con **[Cupo / Nexo]**, el recurso deja de esperar."*  
> *(silencio total · sonríe · no digas "eso sería todo")*

---

## 3. Protocolo Plan B (Ley de Murphy en Vivo)

| Qué puede fallar | Reacción instantánea (0 segundos de pánico) |
| :--- | :--- |
| **Nadie escanea el QR en 10 s o falla el Wi-Fi del jurado** | Sebastián ya tiene `/room/demo-cross?orgId=comite_red&roleId=role_c` abierto en su teléfono en 4G. Al ver que pasan 8 s, Nahum dice *"Vamos a mostrar en vivo la vista de Comité desde el teléfono de Sebastián"* y Sebastián aprueba/veta con razón real en 3 s. |
| **El modelo LLM tarda >4 s o se cae el túnel VPN** | No te frenes ni esperes: el motor determinista **no depende del LLM** (`403`, choques, compuerta, ranking `0,52 vs 0,53`, QR, contador y acta corren a `0 ms`). Dilo a tu favor: *"Incluso si el modelo se desconecta, el esqueleto determinista sigue decidiendo."* |
| **Render está frío o lento al abrir** | 5 minutos antes de subir, abran `https://team-30-platanus-hack.onrender.com/api/health` y `/stage/demo-cross` para dejarlo despierto y caliente. |
| **Confusión con el nombre (`cupo` vs `Nexo`)** | Antes de subir, acuerden 1 nombre y actualícenlo con **`tecla C`** en el deck. Si el repo/UI aún dice `Nexo` y eligen `Nexo`, pon `Nexo` en `C` para 100% coherencia visual. |

---

## 4. Respuestas Relámpago de 15 Segundos (Q&A del Jurado)

1. **¿Qué impide realmente que el agente de un hospital lea el costo del otro?**  
   *"Código en servidor, no el prompt. `projectStateForOrgAndRole` en `src/lib/engine/deterministic.ts` elimina el campo antes de serializar el SSE y antes de pasárselo al agente. Si se fuerza la lectura, el endpoint devuelve `403 RBAC_DENIED` y lo deja en la bitácora."*
2. **¿Por qué esto no es *Simulations* (un mundo con agentes corriendo solos)?**  
   *"Porque ningún agente puede mutar el estado ni sellar una compuerta solo. Toda acción —choque, propuesta, aprobación o veto— la dispara una persona real, y los demás la ven en el mismo segundo. Sin humanos conectados, no pasa nada."*
3. **¿Qué hace esto que Excel + Zapier no resuelva?**  
   *"Tres cosas que un flujo rígido no tiene: aislamiento real entre organizaciones que no comparten base de datos, desempate auditable por equidad sin exponer costos privados, y un esqueleto que muta por Genoma JSON + Zod a cualquier estructura organizacional."*
4. **¿Qué es real y qué está simulado?**  
   *"El software de coordinación es 100% real: RBAC en servidor, `403`, SSE en vivo, QR, algoritmo de equidad, reloj de servidor, acta exportable y llamadas al modelo con telemetría honesta. Lo simulado son los pacientes y costos del caso de salud — no es una herramienta clínica — y la fórmula `p^n` es un modelo ilustrativo con supuestos visibles."*
5. **¿Con cuántos usuarios simultáneos lo probaron?**  
   *"Con 60 conexiones SSE simultáneas en `scripts/load-test.mjs` verificando que 5 de 5 cambios llegan a todos sin fugas de secretos entre roles, más 80 tests automatizados en Vitest."*
6. **¿Dónde corre la IA realmente?**  
   *"Todo pasa por una sola capa (`src/lib/llm.ts`): en Render usa Claude para que el QR sea público y en local corre sobre Ollama en nuestro Dell Pro Max GB10 de 128 GB con `bytesSentToCloud: 0`. La telemetría en pantalla siempre muestra la verdad."*
