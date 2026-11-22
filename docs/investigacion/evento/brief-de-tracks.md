Platanus Hack · Santiago 26 · Brief de tracks
Cinco tracks, una prueba para cada uno
Cada track tiene una esencia, una prueba de una línea para saber si una idea calza, y ejemplos de qué entra y qué no. El equipo elige su track; el encaje se castiga en la evaluación, no en la puerta.

🔧 Hardware
🌍 Physical World
🛡️ AI Security
👥 Multiplayer
🌐 Simulations
Construir un dispositivo
🔧 Hardware
Construye algo que se pueda tocar y que no existía el viernes. El objeto es el producto: electrónica, mecánica o firmware propios, no solo código corriendo en un aparato comprado.

La prueba
Tiene que haber un objeto sobre la mesa de los jueces. Si la demo completa cabe en una pantalla, no es de este track.

Califica
Un wearable armado por el equipo que mide algo del cuerpo y reacciona.
Un robot, brazo o vehículo pequeño con control propio.
Un nodo de sensores con su firmware, aunque los componentes sean comprados.
Un aparato existente intervenido con electrónica nueva que le da otra función.
Un instrumento, control o interfaz física hecha a medida.
No califica
Una app que usa la cámara o los sensores del teléfono.
→ Physical World
Software que comanda un dron o robot comercial sin modificarlo.
→ Physical World
Una Raspberry Pi que solo sirve una página web.
Un render o diseño 3D de un dispositivo sin prototipo que funcione.
Preguntas para partir
¿Qué cosa cotidiana sería mejor si pudiera sentir o moverse?
¿Qué puede hacer un modelo cuando vive dentro de un objeto y no en una nube?
¿Qué herramienta te gustaría tener en la mano y no existe?
Frontera
Con Physical World: aquí el equipo construye el dispositivo; allá usa los que ya existen. Si hay que soldar, cablear o imprimir, es Hardware.

Software que lee o comanda el mundo real
🌍 Physical World
La mayoría del software vive y muere dentro de una pantalla. Este track es solo software, pero su entrada o su salida es el mundo real: percibe lo que pasa afuera o provoca algo ahí.

La prueba
Contacto directo: la entrada es una señal física (cámara, GPS, audio, sensor) o la salida es una orden a algo físico. Una compra o un despacho hecho por otro no cuenta.

Califica
Control inteligente de semáforos que decide con datos reales de tráfico.
Despacho que lee el GPS de una flota en vivo y reasigna rutas o cargas.
Un agente que mira tu despensa con la cámara, detecta qué falta y lo pide.
Visión sobre el video de una bodega, una obra o un campo que decide qué hacer.
Software que comanda un dron, robot o máquina comercial.
No califica
Un "Uber para X": solicitudes, perfiles y un mapa con pines.
Un agente que compra en el supermercado según tu historial.
Agentes que llaman a transportistas, negocian y agendan.
Un modelo del tráfico con datos inventados.
→ Simulations
Un dispositivo armado por el equipo.
→ Hardware
Preguntas para partir
¿Qué entiende un modelo mirando una calle, una bodega o un campo con un teléfono?
¿Qué decisión física (una ruta, un riego, un turno) se sigue tomando a ojo?
¿Qué harías con los sensores que la gente ya lleva encima?
Frontera
Se puede simular lo que no alcanzas a controlar en un fin de semana, pero no lo que percibes: la entrada tiene que venir del mundo real. Se aceptan datos reales grabados y video de la prueba en terreno.

Hacer más seguros los modelos de frontera
🛡️ AI Security
Construye herramientas concretas que hagan que los modelos más avanzados de IA sean más seguros: atácalos para encontrar sus fallas, defiéndelos o mide con rigor qué tan peligrosos pueden ser.

La prueba
El proyecto tiene que atacar, defender o medir un modelo o agente de IA, o usar IA para que el defensor gane. Si la IA es solo el tema de la app, no es de este track.

Cinco líneas de trabajo
AI control. Herramientas que aumenten la visibilidad, el control y la seguridad al correr agentes potencialmente desalineados. Si un modelo está intentando causar daño, ¿cómo lo detectas o lo limitas?
Ver: The Case for AI Control · ControlArena
Guardrails y robustez adversarial. Técnicas o herramientas que hagan a los modelos más robustos frente a la presión humana (jailbreaks, inyecciones). Vale la defensa, por ejemplo mejores clasificadores, o la ofensa: encontrar o evaluar nuevos tipos de ataque.
Cyber evals. Evaluaciones que midan con rigor el uplift que un modelo le da a un humano en tareas de alto riesgo, como la seguridad ofensiva.
Ver: Evals Playbook · Inspect Cyber · Cybench
Interpretabilidad pragmática. Usar las herramientas que hoy permiten leer qué pasa dentro de un modelo (circuit tracing, activation NLAs) para resolver problemas reales de seguridad.
Ver: A Pragmatic Vision for Interpretability
Defensa (def/acc). Herramientas con las que la IA fortalezca más al defensor que al atacante: descubrir y parchar vulnerabilidades de forma autónoma, endurecer sistemas críticos o detectar ataques asistidos por IA (phishing, deepfakes, operaciones de influencia).
Ver: d/acc · los 7 cyber reasoning systems finalistas del AIxCC de DARPA (open source)
Califica
Un monitor que vigila a un agente en un entorno tipo ControlArena y lo frena cuando intenta sabotear su tarea.
Un clasificador de jailbreaks o inyecciones de prompt, medido contra ataques reales.
Un generador automático de ataques que encuentra fallas nuevas en un modelo.
Una eval reproducible que mide cuánto ayuda un modelo a resolver retos de seguridad ofensiva.
Una sonda sobre las activaciones de un modelo que detecta engaño o intención dañina.
Un sistema que encuentra y parcha vulnerabilidades solo, o que detecta phishing o deepfakes generados con IA.
No califica
Agregarle login o cifrado a una app de otro tema.
Un chatbot que responde preguntas sobre seguridad.
Ciberseguridad tradicional donde la IA no ataca, no defiende ni es el blanco.
Un wrapper que solo llama a la API de moderación de un proveedor.
Un benchmark de capacidades generales sin relación con riesgo.
Preguntas para partir
Si el agente que corre en tu máquina quisiera hacer daño, ¿cómo te darías cuenta?
¿Qué ataque a un modelo funciona hoy y nadie ha medido bien?
¿Qué puedes leer dentro de un modelo que no se ve en su respuesta?
¿Qué trabajo de un equipo de seguridad podría hacer un agente esta noche?
Frontera
La seguridad de la IA tiene que ser el producto, no una característica. Una demo fuerte muestra un resultado medible: el ataque funcionando y la defensa deteniéndolo, o una eval con números que antes no existían.

Software que solo tiene sentido con otros
👥 Multiplayer
Casi todo el software con IA está hecho para una persona hablando sola con una máquina. Construye algo que conecte, coordine o ponga a competir a varias personas, o a personas y agentes, en un mismo espacio.

La prueba
El producto tiene que mejorar cuando hay más de una persona usándolo. Si funciona igual de bien con un solo usuario, no es de este track.

Califica
Un espacio de trabajo donde varias personas y agentes editan lo mismo a la vez.
Una herramienta que ayuda a un grupo a decidir algo: un viaje, una casa, un presupuesto.
Una experiencia en vivo donde la audiencia participa y cambia lo que pasa.
Un juego original entre personas, evaluado con la misma rúbrica que el resto.
Contenido que se crea entre varios y no podría hacer uno solo.
No califica
Un asistente personal, por bueno que sea.
Una app individual con un botón de "compartir link".
Una sola persona conversando con muchos agentes.
→ Simulations, si modela algo
Un mundo que corre solo y que nadie juega.
→ Simulations
Preguntas para partir
¿Qué cosa que hoy haces solo sería mejor con otros?
¿Cómo se ve un grupo donde algunos integrantes son agentes?
¿Qué tarea compartida se sigue coordinando mal por chat?
Frontera
No tiene que ser en tiempo real: vale igual lo asincrónico o por turnos, mientras lo que hace uno cambie lo que ve o puede hacer el otro. La demo sí debería mostrar a dos personas usándolo. Los juegos caben, pero un clon entretenido pierde en Originalidad e Impacto.

Modelar algo para aprender de él
🌐 Simulations
Construye un modelo de algo que no puedes probar en la realidad (un mercado, una ciudad, una multitud, una organización) y hazlo correr para descubrir qué pasaría.

La prueba
La simulación tiene que responder una pregunta del tipo "¿qué pasaría si…?". Si nadie aprende nada al correrla, es una animación.

Califica
Usuarios sintéticos que prueban un producto o un precio antes de lanzarlo.
Una población de agentes para ver el efecto de una política en una ciudad.
Un entorno para entrenar o evaluar robots y agentes antes de soltarlos.
Un gemelo digital de una operación para probar escenarios.
Un simulador para practicar algo difícil: una negociación, una emergencia.
No califica
Un juego donde personas juegan entre sí.
→ Multiplayer
Un sistema que lee datos reales y comanda algo en vivo.
→ Physical World
Una proyección que sale de una fórmula o de una planilla.
Una visualización bonita sin un modelo detrás.
Preguntas para partir
¿Qué decisión cara se toma hoy sin poder ensayarla antes?
¿Qué pasa si pones a mil agentes a comportarse como tus clientes?
¿Qué experimento sería imposible o poco ético de hacer con gente real?
Frontera
Con Physical World: modelar el mundo para aprender es Simulations; leerlo o actuar sobre él en vivo es Physical World. Una buena demo muestra un resultado que sorprendió al propio equipo.

Casos frontera
Los casos que más se van a repetir, con el veredicto de una línea para responder rápido en la mesa de mentores.

Idea	Va a	Por qué
Semáforos inteligentes con datos reales de tráfico	Physical World	Entrada real; solo el semáforo es simulado.
La misma idea con ciudad y datos inventados	Simulations	Es un modelo para estudiar, no lee la calle.
Software para un dron comercial	Physical World	Usa un dispositivo que ya existe.
Un dron armado por el equipo	Hardware	El dispositivo es el producto.
Detector de phishing o deepfakes hechos con IA	AI Security	Def/acc: la IA le da ventaja al defensor.
Escáner de vulnerabilidades sin IA en ningún lado	Ninguno limpio	Es ciberseguridad clásica; el track pide que la IA ataque, defienda o sea el blanco.
Juego entre personas	Multiplayer	Varias personas interactuando.
Mundo de agentes que se observa	Simulations	Nadie juega; se aprende del modelo.
Marketplace o "Uber para X"	Ninguno limpio	Lo físico pasa fuera del software. Solo entra a Physical World si el centro es el ruteo o despacho en vivo.
Agentes de oficina para una industria (llamar, agendar, conciliar)	Ninguno limpio	Es software de empresa. Entra a Physical World solo si percibe la operación directamente.
Los dos últimos casos no tienen un track natural en este lineup. Conviene decidir antes del evento qué se les responde a esos equipos.

Cómo se evalúa
La rúbrica cargada para Santiago 26 es la misma para los cinco tracks. El encaje con el track no es un criterio propio: se refleja sobre todo en Originalidad e Impacto.

Criterio	Peso	Qué mira
Originalidad	15	Si sorprende o es la primera idea que se viene a la cabeza.
Ambición	20	Qué tan alto apuntaron para 36 horas.
Ejecución	20	Qué tan pulido y coherente quedó; si los flujos funcionan.
Aspecto técnico	25	Si hay trabajo de ingeniería real o se siente trivial.
Impacto	20	Si entrega valor significativo a alguien.