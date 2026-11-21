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
- Deploy en Vercel.
- Voz con ElevenLabs si la idea lo pide. La API key vive solo en el servidor.

## Regla de modelos

Toda llamada a un modelo pasa por `src/lib/llm.ts`. No llamar a un proveedor directo desde otra parte del código. El módulo habla el protocolo compatible con OpenAI y se configura con `LLM_BASE_URL`, `LLM_API_KEY` y `LLM_MODEL`, así que pasar del Spark a la nube es cambiar `.env.local`.

- El Spark es un NVIDIA DGX Spark de 128 GB con Ollama en el puerto 11434. Es ARM64: no instalar ni compilar cosas en él sin revisar que exista build para esa arquitectura.
- En Vercel no se puede llegar al Spark por IP local. Para la demo desplegada se usa la nube, o un túnel hacia el Spark.

## Comandos

- `npm run dev`: servidor local en http://localhost:3000
- `npm run build` y `npm run lint`: correr antes de cada deploy
- `GET /api/health`: dice si el modelo y Supabase están configurados

## Entrega

- Completar `platanus-hack-project.jsonc` (nombre, resumen, descripción y URL del deploy) y `project-description.md` antes de enviar.
- El logo debe ser un PNG de 1000x1000 de máximo 500 KB.
- El README debe ser corto y directo. Lo escribe una persona del equipo.
- Vercel no puede conectarse a este repo de la organización. El deploy sale de un repo personal espejo; el README explica cómo configurar el doble `push`.
