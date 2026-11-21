# Decisiones técnicas

Una entrada por decisión importante, la más reciente arriba. Sirve para responder "¿por qué lo hicieron así y no de otra forma?".

Formato de cada entrada:

- **Decisión:** qué elegimos.
- **Alternativa descartada:** qué otra cosa consideramos.
- **Por qué:** la razón, en una o dos líneas.
- **Costo:** qué perdemos con esta elección.

---

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
