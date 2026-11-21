# Arquitectura

Documento vivo. Se actualiza en el mismo commit que cambia la arquitectura. Si este documento y el código no coinciden, el código manda y esto es un error que hay que corregir.

**Estado:** la idea está decidida y la base multijugador existe. El motor de decisiones, la capa entre organizaciones y el Comité están en construcción; este documento marca qué existe hoy y qué no.

## Resumen

Nexo (nombre de trabajo) coordina decisiones críticas entre personas y agentes emparejados por rol, dentro de una organización y entre organizaciones que compiten por un recurso escaso. Cada persona entra con un rol y recibe solo los datos que su rol y su organización pueden ver; el resto no sale del servidor. Las reglas (permisos, compuertas, asignación del recurso) son código determinista, sin modelo. El modelo solo redacta contenido. Toda decisión la dispara una persona y queda en una bitácora.

El caso de la demo es de salud, con datos simulados: una clínica con 3 roles decide sobre una cama UCI (suelo), y 2 hospitales compiten por 1 cama de referencia mientras un Comité entra por QR y aprueba o veta con razón (capa inter-org).

| Parte de la idea | Estado hoy |
| --- | --- |
| Salas, roles, token por rol, vista filtrada por rol, bitácora y eventos en tiempo real | Existe (`src/lib/rooms.ts`, `src/app/api/rooms/`) |
| Entrada a un rol por código QR | Existe (`src/app/room/[roomId]/`) |
| Capa de modelos con Claude o modelo local | Existe (`src/lib/llm.ts`) |
| Permisos por organización (`orgId`), además de por rol | En construcción |
| Caso de la clínica: roles reales, compuerta de autoridad y decisión del Comité con razón | En construcción |
| Motor determinista: detección de choque, puntaje y asignación del recurso con desempate por equidad, confiabilidad p^n | En construcción |
| Capa inter-org: 2 hospitales y 1 cama | En construcción |
| Genoma de organización generado por el modelo y validado | En construcción |
| Acta exportable y telemetría del modelo (proveedor, local o nube) | En construcción |

## Componentes

| Componente | Qué hace | Dónde vive | Tecnología |
| --- | --- | --- | --- |
| App web | Interfaz y rutas del servidor | `src/app/` | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| Capa de modelos | Única puerta de entrada a cualquier modelo de lenguaje. Elige proveedor por configuración | `src/lib/llm.ts` | SDK oficial de Anthropic para Claude; protocolo compatible con OpenAI para Ollama |
| Ruta de chat | Respuesta del modelo en streaming | `src/app/api/chat/route.ts` | Route Handler con `ReadableStream` |
| Ruta de estado | Informa si el modelo y la base están disponibles | `src/app/api/health/route.ts` | Route Handler |
| Ruta de vida | Responde 200 si el servidor está arriba; la usa la plataforma de deploy | `src/app/api/ping/route.ts` | Route Handler |
| Deploy | Describe el servicio público | `render.yaml` | Render, servidor Node siempre encendido |
| Núcleo multijugador | Salas, roles, presencia, bitácora y vista distinta por rol | `src/lib/rooms.ts` | TypeScript, estado en memoria del servidor |
| Flujo en tiempo real | Envía a cada conexión la sala ya filtrada para su rol | `src/app/api/rooms/[roomId]/events/route.ts` | Server-Sent Events |
| Puerta de acciones | Única entrada para cambiar una sala; revisa permisos | `src/app/api/rooms/[roomId]/action/route.ts` | Route Handler |
| Pantalla de sala | Entrar con un rol, por botón o código QR, y ver la sala en vivo | `src/app/room/[roomId]/` | React, `qrcode` |
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
| Local y sin internet | Configurable por `LLM_MODEL`, servido por Ollama | Spark o notebook | Los datos no salen de la red local |
| Deploy público | `claude-opus-5-5` | API de Anthropic | El servidor público no puede llegar al Spark, que vive en la red local |

`LLM_PROVIDER` elige entre ambos. Si Claude declina una petición, la API la reintenta en un modelo de respaldo (parámetro `fallbacks`).

El Spark es un NVIDIA DGX Spark de 128 GB que sirve modelos con Ollama en el puerto 11434. `scripts/spark-setup.sh` lo deja operativo.

## Integraciones externas

| Servicio | Para qué | Estado |
| --- | --- | --- |
| API de Anthropic | Modelo de lenguaje en el deploy público | Real |
| Ollama | Modelo de lenguaje local | Real |
| Render | Hosting del servidor público | Real |
| _Por completar_ | | Real / Simulado |

## Colaboración en tiempo real

Cada navegador abre una conexión de eventos (SSE) a `/api/rooms/:id/events?role=...`. Cuando alguien ejecuta una acción, el servidor cambia el estado de la sala y avisa a todas las conexiones, que reciben la sala completa de nuevo.

**Vista por rol.** Antes de enviar, `projectForRole` arma un paquete distinto para cada rol y elimina los valores que ese rol no puede ver. El dato oculto no viaja por la red hacia quien no debe verlo: no se esconde en el navegador, no se envía. La pantalla general ("stage") recibe solo lo que todos los roles pueden ver.

**Acciones.** Todo cambio pasa por `applyAction`, que revisa permisos en el servidor. Un intento de leer o modificar un campo ajeno devuelve 403 y queda en la bitácora.

**Dos personas a la vez.** El servidor procesa las acciones de a una, en el orden en que llegan, y cada cambio aumenta un número de versión.

**Probado.** Tres conexiones simultáneas (dos roles y la pantalla general) sobre una sala. Falta probar con decenas de conexiones.

## Qué es real y qué es simulado

Esta tabla es la respuesta honesta a "¿esto funciona de verdad?".

| Parte | Real | Simulado | Nota |
| --- | --- | --- | --- |
| _Por completar_ | | | |

## Límites conocidos

- El estado de las salas vive en la memoria de un solo proceso: se pierde si el servidor se reinicia y no escala a varios servidores.
- No hay autenticación: quien tiene el enlace de un rol entra como ese rol.


_Por completar: qué no hace, qué se rompería con más carga y qué haríamos con una semana más._

## Cómo correrlo

```bash
npm install
cp .env.example .env.local   # completar
npm run dev                  # http://localhost:3000
```

`GET /api/health` muestra si el modelo y la base están configurados.
