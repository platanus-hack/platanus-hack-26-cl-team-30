# Decisiones técnicas

Una entrada por decisión importante, la más reciente arriba. Sirve para responder "¿por qué lo hicieron así y no de otra forma?".

Formato de cada entrada:

- **Decisión:** qué elegimos.
- **Alternativa descartada:** qué otra cosa consideramos.
- **Por qué:** la razón, en una o dos líneas.
- **Costo:** qué perdemos con esta elección.

---

## Permisos aplicados en el servidor, no en el navegador ni en el prompt

- **Decisión:** el servidor arma un paquete distinto por rol (`projectForRole`) y elimina los valores que ese rol no puede ver.
- **Alternativa descartada:** enviar todo y ocultarlo en la interfaz, o pedirle al modelo que no revele ciertos datos.
- **Por qué:** lo que no se envía no se puede filtrar. Se puede comprobar mirando el tráfico de red del navegador.
- **Costo:** cada cambio se proyecta una vez por conexión.

## Estado de salas en memoria y eventos SSE

- **Decisión:** las salas viven en memoria del servidor y los cambios se envían por Server-Sent Events.
- **Alternativa descartada:** base de datos con suscripciones en tiempo real, o WebSockets.
- **Por qué:** no requiere configurar ningún servicio externo, funciona igual en el deploy y en una red local sin internet, y SSE basta porque los clientes solo necesitan recibir; las acciones van por peticiones normales.
- **Costo:** el estado se pierde al reiniciar y no se reparte entre varios servidores.

## Una sola capa de modelos con dos proveedores

- **Decisión:** todo el código llama a `src/lib/llm.ts`; nadie habla con un proveedor directamente. Adentro hay dos caminos, elegidos con `LLM_PROVIDER`:
  - `anthropic`: Claude con el SDK oficial de Anthropic. Usa `fallbacks` (si el modelo declina, la API reintenta sola en un modelo de respaldo) y `effort` configurable con `LLM_EFFORT`. Es lo que usa el deploy público.
  - cualquier otro valor: protocolo de chat compatible con OpenAI, que es lo que expone Ollama en el Spark o en un notebook (`LLM_BASE_URL`, `LLM_API_KEY`).
- **Alternativa descartada:** usar solo el modelo local del Spark, o llamar al SDK de cada proveedor donde se necesite.
- **Por qué:** el deploy público corre en internet y no puede llegar al Spark, que está en la red local de la sede. Con una sola capa, pasar de uno a otro es cambiar variables de entorno (`LLM_PROVIDER`, `LLM_MODEL` y las del proveedor), sin tocar código. Si el Spark falla en la demo, el cambio toma segundos.
- **Costo:** hay dos caminos de código que probar, las respuestas pueden diferir entre modelos y las funciones exclusivas de Claude (fallbacks, effort) no existen en el camino local.

## Render para el deploy público

- **Decisión:** el servidor público corre en Render como un proceso Node siempre encendido, descrito en `render.yaml`.
- **Alternativa descartada:** Vercel.
- **Por qué:** la colaboración en tiempo real necesita un proceso que se mantenga vivo y comparta estado entre conexiones. Las funciones de Vercel no lo garantizan.
- **Costo:** el deploy sale de un repo personal espejo, porque Render no puede conectarse al repo de la organización.

## Chequeo de vida separado del chequeo del modelo

- **Decisión:** `/api/ping` responde 200 siempre que el servidor esté arriba; `/api/health` además revisa el modelo.
- **Alternativa descartada:** usar `/api/health` como chequeo de la plataforma.
- **Por qué:** si el proveedor del modelo falla, la plataforma no debe sacar el servidor de rotación; la app puede seguir mostrando datos.
- **Costo:** ninguno relevante.

## Respuestas en streaming como texto plano

- **Decisión:** la ruta de chat devuelve texto plano en streaming.
- **Alternativa descartada:** reenviar al navegador los eventos crudos del proveedor.
- **Por qué:** el navegador no necesita conocer el formato de ningún proveedor y la interfaz queda simple.
- **Costo:** no se transmiten metadatos como el conteo de tokens.
