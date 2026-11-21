# Decisiones técnicas

Una entrada por decisión importante, la más reciente arriba. Sirve para responder "¿por qué lo hicieron así y no de otra forma?".

Formato de cada entrada:

- **Decisión:** qué elegimos.
- **Alternativa descartada:** qué otra cosa consideramos.
- **Por qué:** la razón, en una o dos líneas.
- **Costo:** qué perdemos con esta elección.

---

## Dos proveedores de modelo detrás de la misma capa

- **Decisión:** `src/lib/llm.ts` soporta Claude con el SDK oficial de Anthropic y modelos locales con el protocolo compatible con OpenAI. `LLM_PROVIDER` elige cuál.
- **Alternativa descartada:** usar solo el modelo local del Spark.
- **Por qué:** el deploy público corre en internet y no puede llegar al Spark, que está en la red local de la sede. El mismo código debe funcionar en ambos lugares.
- **Costo:** hay dos caminos de código que probar, y las respuestas pueden diferir entre modelos.

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

## Una sola capa para hablar con modelos

- **Decisión:** todo el código llama a `src/lib/llm.ts`, que habla el protocolo de chat compatible con OpenAI.
- **Alternativa descartada:** usar el SDK de cada proveedor directamente donde se necesite.
- **Por qué:** permite pasar de un modelo local en el Spark a uno en la nube cambiando tres variables de entorno, sin tocar código. Si el Spark falla durante la demo, el cambio toma segundos.
- **Costo:** no usamos funciones exclusivas de un proveedor.

## Respuestas en streaming como texto plano

- **Decisión:** la ruta de chat devuelve texto plano en streaming.
- **Alternativa descartada:** reenviar al navegador los eventos crudos del proveedor.
- **Por qué:** el navegador no necesita conocer el formato de ningún proveedor y la interfaz queda simple.
- **Costo:** no se transmiten metadatos como el conteo de tokens.
