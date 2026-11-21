# team-30 · Platanus Hack 26 Santiago

Repo oficial del equipo 30 en Platanus Hack 26: Santiago ft. Buk. Track: **Multiplayer**. El hacking termina el domingo 22 de noviembre a las 09:30 y las presentaciones son de 11:00 a 14:00.

## Equipo

- **Ramón Molina** (@rm004607): producto web. Pantallas, rutas de la API y tablas de Supabase.
- **Sebastián Vargas** (@iswebster1401): agente e infraestructura. Modelos, Spark, integraciones y deploy. Decide qué se corta cuando falta tiempo.
- **Nahum Díaz** (@nadilopoff): negocio y pitch. Usuarios reales, finanzas y relato.

La idea del proyecto todavía no está decidida.

@AGENTS.md

## Prioridades

1. Una demo que funcione en vivo vale más que código limpio. Un solo flujo completo antes que varias funciones a medias.
2. Cambios chicos y desplegables. Si algo toma más de una hora, buscar el atajo.
3. Responder y comentar en español.

## Stack

- Next.js (App Router, `src/`), TypeScript, Tailwind y shadcn/ui. Componentes nuevos con `npx shadcn@latest add <nombre>`.
- Supabase para base de datos y auth. Cliente en `src/lib/supabase.ts`. Toda tabla lleva RLS.
- Deploy público en Render (`render.yaml`), desde un repo personal espejo.
- Voz con ElevenLabs si la idea lo pide. La API key vive solo en el servidor.

## Regla de modelos

Toda llamada a un modelo pasa por `src/lib/llm.ts`. No llamar a un proveedor directo desde otra parte del código. `LLM_PROVIDER=anthropic` usa Claude con el SDK oficial; cualquier otro valor usa el protocolo compatible con OpenAI (Ollama). Pasar del Spark a la nube es cambiar variables de entorno.

- El Spark es un NVIDIA DGX Spark de 128 GB con Ollama en el puerto 11434. Es ARM64: no instalar ni compilar cosas en él sin revisar que exista build para esa arquitectura.
- El deploy público no puede llegar al Spark por IP local. Para la demo desplegada se usa Claude.

## Comandos

- `npm run dev`: servidor local en http://localhost:3000
- `npm run build` y `npm run lint`: correr antes de cada deploy
- `GET /api/health`: dice si el modelo y Supabase están configurados

## Documentación técnica

Los jueces revisan este repositorio con un agente de IA mientras el equipo presenta, y después hacen preguntas sobre la estructura de la solución. Por eso la documentación se mantiene al día durante todo el desarrollo, no al final.

- `docs/ARQUITECTURA.md`: componentes, flujo de un dato, agentes, modelos, integraciones y qué es real o simulado.
- `docs/DECISIONES.md`: por qué se eligió cada cosa y qué se descartó.
- `docs/PREGUNTAS.md`: preguntas probables del jurado con respuestas de 20 segundos.

Reglas para cualquier cambio:

1. Si un cambio agrega, quita o modifica un componente, un agente, una integración o el flujo de datos, actualizar `docs/ARQUITECTURA.md` en el mismo commit.
2. Si se toma una decisión técnica entre dos alternativas, agregar una entrada en `docs/DECISIONES.md`.
3. Si un cambio responde o altera una pregunta de `docs/PREGUNTAS.md`, actualizar la respuesta.
4. Cada agente vive en su propio archivo bajo `src/agents/`, con su instrucción y su formato de salida a la vista.
5. Lo simulado se marca como simulado en el código y en la tabla de "Qué es real y qué es simulado". Nunca presentar algo simulado como real.
6. La documentación describe lo que existe. No escribir lo que se planea como si ya estuviera hecho.

## Entrega

- Completar `platanus-hack-project.jsonc` (nombre, resumen, descripción y URL del deploy) y `project-description.md` antes de enviar.
- El logo debe ser un PNG de 1000x1000 de máximo 500 KB.
- El README debe ser corto y directo. Lo escribe una persona del equipo.
- Vercel no puede conectarse a este repo de la organización. El deploy sale de un repo personal espejo; el README explica cómo configurar el doble `push`.
