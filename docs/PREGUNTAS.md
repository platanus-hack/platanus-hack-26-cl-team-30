# Preguntas técnicas del jurado

Guía de preparación para quien responde lo técnico en la presentación. Cada respuesta debe poder decirse en 20 segundos y apuntar a un archivo del repo.

Los jueces consultan el repositorio con un agente mientras presentamos y luego preguntan por la estructura de la solución, no por líneas de código.

## Arquitectura

1. **¿Cuáles son los componentes y cómo se comunican?** → `docs/ARQUITECTURA.md`, sección Componentes. _Respuesta por completar._
2. **¿Qué pasa desde que un usuario hace algo hasta que otro lo ve?** → sección Flujo de un dato. _Por completar._
3. **¿Dónde está la parte difícil del proyecto?** _Por completar: nombrar el archivo._

## Agentes y modelos

4. **¿Cuántos agentes hay y qué hace cada uno?** → sección Agentes. _Por completar._
5. **¿Qué decide el modelo y qué decide el código?** _Por completar._
6. **¿Qué modelo usan, dónde corre y por qué ese?** → sección Modelos. _Por completar._
7. **¿Qué pasa si el modelo se equivoca o inventa algo?** _Por completar._

## Tiempo real y colaboración

8. **¿Cómo funciona la colaboración en tiempo real?** → sección Colaboración en tiempo real. _Por completar._
9. **¿Qué pasa si dos personas actúan al mismo tiempo sobre lo mismo?** _Por completar._
10. **¿Con cuántos usuarios simultáneos lo probaron?** _Por completar: dar el número real._

## Integraciones y honestidad

11. **¿Con qué sistemas externos se integra?** → sección Integraciones. _Por completar._
12. **¿Qué es real y qué está simulado en la demo?** → sección Qué es real y qué es simulado. _Por completar._
13. **¿Qué se rompería con diez veces más carga?** → sección Límites conocidos. _Por completar._

## Decisiones

14. **¿Por qué eligieron esta tecnología y no otra?** → `docs/DECISIONES.md`.
15. **¿Qué harían distinto con una semana más?** _Por completar._

## Cómo responder

- Primero la respuesta, después el detalle.
- Si algo está simulado o no se alcanzó a hacer, decirlo. El agente de los jueces lo va a ver en el código de todas formas.
- Si no se sabe la respuesta: "no lo medimos" es mejor que inventar un número.
