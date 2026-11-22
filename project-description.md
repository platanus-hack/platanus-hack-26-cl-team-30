# Sculptor

**Dos hospitales necesitan la misma cama UCI. Quien decide no tiene los datos del otro.**

> Demostración simulada de coordinación organizacional. Los pacientes, costos y puntajes son datos de ejemplo. No constituye diagnóstico ni uso real de datos de pacientes, y no es una herramienta clínica.

## El problema

Las decisiones más caras de una organización (una cama, un traslado, una firma) se coordinan por chat y planillas. Cada área tiene datos que no puede compartir: Urgencias conoce la gravedad, Administración conoce el costo. Cuando además el recurso es escaso y lo piden dos organizaciones, nadie puede explicar después por qué lo recibió una y no la otra.

## Qué hace

Sculptor es una sala compartida donde varias personas deciden a la vez, cada una desde su rol:

- **Cada rol ve solo lo suyo.** El servidor filtra los datos por organización y por rol antes de enviarlos. Lo reservado no llega al navegador de quien no debe verlo, y pedirlo desde la silla devuelve un 403 que queda registrado.
- **Las decisiones se ven en vivo.** Lo que una persona hace llega a las pantallas de las demás por una conexión abierta, sin recargar.
- **El recurso escaso se asigna con una regla visible.** Un puntaje calculado por código ordena a los candidatos y desempata por equidad.
- **Un Comité tiene la última palabra.** Entra escaneando un código QR y aprueba o veta. La razón es obligatoria.
- **Todo queda en una bitácora** que se puede exportar como acta.

## Cómo se usa en la demo

1. Cinco personas del público escanean un QR: por cada hospital, quien presenta el caso y su Administración, y al final el Comité. Ningún hospital ve el costo de cobertura del otro.
2. Cada una elige su postura con un toque. Su agente le recomienda una, usando solo lo que su rol puede ver.
3. Los agentes de cada hospital argumentan en la pantalla grande sin citar datos reservados. La propuesta no la escriben ellos: la calcula una regla visible y desempata por equidad.
4. El Comité acepta o rechaza con una razón. Todas las pantallas cambian y queda un acta.

Si alguien no actúa a tiempo, el sistema juega su turno y lo marca como automático en el acta.

## Qué hace el código y qué hace la IA

| Código determinista, sin modelo | Modelo de lenguaje |
| --- | --- |
| Permisos por organización y por rol | Redactar el consejo y el argumento de cada agente en la negociación, y la propuesta del agente de cada rol. Cada uno solo recibe los datos que su rol puede ver |
| Detección de conflicto de autoridad y bloqueo de la decisión | Generar el contenido de una organización nueva (títulos, etiquetas, valores), que se valida antes de usarse |
| Puntaje, orden y desempate de la asignación | |
| Bitácora y acta | |

El modelo nunca decide quién recibe el recurso, y los agentes nunca firman, sellan ni vetan. En las organizaciones de la demo, quién ve qué lo fija el código; en una organización generada desde una frase, el modelo propone esa lista y el código la acota antes de aplicarla.

El modelo puede correr en un equipo local (NVIDIA DGX Spark; implementado, sin verificar contra el Spark), sin que los datos salgan de la red, o en la nube con Claude. El deploy público usa Claude. La aplicación muestra cuál de los dos está en uso.
