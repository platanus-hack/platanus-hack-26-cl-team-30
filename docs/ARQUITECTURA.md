# Arquitectura

Documento vivo. Se actualiza en el mismo commit que cambia la arquitectura. Si este documento y el código no coinciden, el código manda y esto es un error que hay que corregir.

**Estado:** base del proyecto. La idea final todavía no está decidida, así que las secciones marcadas "por completar" están vacías a propósito.

## Resumen

_Por completar: cinco líneas. Qué problema resuelve, quiénes participan a la vez, qué hace el sistema con sus aportes y qué resultado entrega._

## Componentes

| Componente | Qué hace | Dónde vive | Tecnología |
| --- | --- | --- | --- |
| App web | Interfaz y rutas del servidor | `src/app/` | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| Capa de modelos | Única puerta de entrada a cualquier modelo de lenguaje | `src/lib/llm.ts` | Protocolo de chat compatible con OpenAI |
| Ruta de chat | Respuesta del modelo en streaming | `src/app/api/chat/route.ts` | Route Handler con `ReadableStream` |
| Ruta de estado | Informa si el modelo y la base están disponibles | `src/app/api/health/route.ts` | Route Handler |
| Cliente de datos | Acceso a la base desde el navegador | `src/lib/supabase.ts` | Supabase |

_Por completar: agentes, tiempo real, almacenamiento y cualquier componente nuevo._

## Flujo de un dato, de punta a punta

_Por completar: seguir un solo aporte de un usuario desde que entra hasta que otro usuario ve el resultado, nombrando el archivo que interviene en cada paso._

## Agentes

Una fila por agente. Cada agente vive en su propio archivo.

| Agente | Archivo | Entrada | Salida | Modelo | Qué decide el código y no el modelo |
| --- | --- | --- | --- | --- | --- |
| _Por completar_ | | | | | |

## Modelos

| Uso | Modelo | Dónde corre | Por qué ese |
| --- | --- | --- | --- |
| Desarrollo | Configurable por `LLM_MODEL` | Notebook, Spark o nube | La capa de modelos cambia de proveedor editando tres variables de entorno |

El Spark es un NVIDIA DGX Spark de 128 GB que sirve modelos con Ollama en el puerto 11434. `scripts/spark-setup.sh` lo deja operativo.

## Integraciones externas

| Servicio | Para qué | Estado |
| --- | --- | --- |
| _Por completar_ | | Real / Simulado |

## Colaboración en tiempo real

_Por completar: cómo se enteran todos los participantes de un cambio, qué pasa si dos actúan a la vez y cuántos participantes simultáneos se probaron._

## Qué es real y qué es simulado

Esta tabla es la respuesta honesta a "¿esto funciona de verdad?".

| Parte | Real | Simulado | Nota |
| --- | --- | --- | --- |
| _Por completar_ | | | |

## Límites conocidos

_Por completar: qué no hace, qué se rompería con más carga y qué haríamos con una semana más._

## Cómo correrlo

```bash
npm install
cp .env.example .env.local   # completar
npm run dev                  # http://localhost:3000
```

`GET /api/health` muestra si el modelo y la base están configurados.
