# Sculptor

**Dos hospitales necesitan la misma cama UCI. Quien decide no tiene los datos del otro.**

> Demostración simulada de coordinación organizacional. Los pacientes, costos y puntajes son datos de ejemplo. No constituye diagnóstico ni uso real de datos de pacientes, y no es una herramienta clínica.

## El problema

Las decisiones más caras de una organización (una cama, un traslado, una firma) se coordinan por chat y planillas. Cada área tiene datos que no puede compartir: Urgencias conoce la gravedad, Administración conoce el costo. Cuando además el recurso es escaso y lo piden dos organizaciones, nadie puede explicar después por qué lo recibió una y no la otra.

## Qué hace

Sculptor es una sala compartida donde varias personas deciden a la vez, cada una desde su rol:

- **Cada rol ve solo lo suyo.** El servidor filtra los datos por organización y por rol antes de enviarlos. Lo reservado no llega al navegador de quien no debe verlo, y un intento de leerlo devuelve un 403 que queda registrado.
- **Las decisiones se ven al instante.** Lo que una persona hace cambia en el mismo segundo la pantalla de las demás.
- **El recurso escaso se asigna con una regla visible.** Un puntaje calculado por código ordena a los candidatos y desempata por equidad.
- **Un Comité tiene la última palabra.** Entra escaneando un código QR y aprueba o veta. La razón es obligatoria.
- **Todo queda en una bitácora** que se puede exportar como acta.

## Cómo se usa en la demo

1. Una clínica con tres roles: Jefatura de Urgencias, Dirección Administrativa y Comité Ético. Urgencias propone autorizar una cama UCI; la propuesta cruza el umbral que Administración puede aprobar sola, y la decisión queda bloqueada hasta que alguien firme.
2. Entra un segundo hospital que necesita la misma cama. Cada hospital presenta su caso sin ver el costo de cobertura del otro.
3. El tablero muestra el orden de los candidatos y la regla que lo produjo.
4. Alguien del público escanea el QR, entra como Comité y aprueba o veta con una razón. Todas las pantallas cambian a la vez.

## Qué hace el código y qué hace la IA

| Código determinista, sin modelo | Modelo de lenguaje |
| --- | --- |
| Permisos por organización y por rol | Redactar la propuesta del agente de cada rol, que solo recibe los datos que su rol puede ver |
| Detección de conflicto de autoridad y bloqueo de la decisión | Generar el contenido de una organización nueva (títulos, etiquetas, valores), que se valida antes de usarse |
| Puntaje, orden y desempate de la asignación | |
| Bitácora y acta | |

El modelo nunca decide quién recibe el recurso ni quién puede ver qué. Los agentes no actúan solos: toda decisión la dispara una persona.

El modelo puede correr en un equipo local (NVIDIA DGX Spark), sin que los datos salgan de la red, o en la nube con Claude. El deploy público usa Claude. La aplicación muestra cuál de los dos está en uso.
