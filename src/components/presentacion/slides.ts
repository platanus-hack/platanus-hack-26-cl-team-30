// Contenido de la presentación de 3:00. Sigue el orden que pidió la charla del
// evento («Cómo hacer un buen demo»): saludo y una línea, problema (~20 s),
// solución y ambición (~20 s), demo en vivo (~2 min) y cierre. Las frases salen
// del guion corregido de docs/DEMO_DIA.md: nada de lo que se dice contradice el repo.
// En pantalla va solo lo que se dice; el resto vive en las notas del orador (tecla N).

export type Slide = {
  id: string;
  /** Tramo del reloj de 3:00 al que pertenece (mm:ss–mm:ss). */
  time: string;
  /** Qué dice Nahum, palabra por palabra (notas del orador). */
  say: string;
  /** Qué hace Ramón en la pantalla y Sebastián con el público. */
  do?: string;
};

export const SLIDES: Slide[] = [
  {
    id: "hola",
    time: "0:00–0:07",
    say: "Hola, soy Nahum, del equipo 30. Esto es Sculptor: organizaciones que deciden juntas sin mostrarse sus datos.",
    do: "Sebastián ya está junto a los 3 jueces, que tienen el celular desbloqueado y saben que escanean a la vez.",
  },
  {
    id: "problema",
    time: "0:07–0:27",
    say: "Una organización no es una máquina: es un choque de fuerzas. Dos hospitales necesitan la misma cama UCI, y ninguno puede mostrarle sus datos al otro: no pueden decidir juntos, y después nadie puede explicar por qué ganó uno. Y hoy metemos agentes de IA en medio. Si cada agente tira para su lado, no obtenemos inteligencia: obtenemos caos más rápido. En un modelo simple, diez pasos con 92 % de acierto cada uno dan 43 %.",
    do: "Sale de docs/DEMO_DIA.md (narrativa, frases 1 y 2) y de pⁿ (docs/DECISIONES.md). Sin estadística externa: el caso de los dos hospitales es el de la demo (datos simulados) y, si un juez pregunta por el 43 %, es un modelo ilustrativo que calcula el motor.",
  },
  {
    id: "solucion",
    time: "0:27–0:45",
    say: "Sculptor sienta a personas y agentes en la misma mesa. Cada persona tiene un agente que la asesora, los agentes negocian a la vista, y la última palabra es de una persona. Lo que está en juego es quién recibe la última cama, y queda un acta que explica por qué. Saquen el celular.",
    do: "Al terminar la frase Ramón toca «Ahora ustedes» (o →): pasa a la lámina en vivo, con la pantalla grande y su QR a la izquierda. Sebastián se acerca a la mesa de los jueces.",
  },
  {
    id: "demo",
    time: "0:45–2:40",
    say: "Unirse: «Ustedes tres escaneen: el primero es la Clínica, el segundo el Hospital Rural y el tercero el Comité. Las dos Administraciones las juega un bot, y queda marcado». Posturas: «Clínica y Hospital Rural: su agente les escribió un consejo privado. Elijan su postura: un toque. Comité: toque \"Recibir resumen por WhatsApp\" y envíe el mensaje». Debate: «Ahora negocian los agentes. Ningún costo sale de su lado: el servidor ni siquiera se lo envía al otro». Propuesta: «Los agentes conversan, el código gobierna. Casi empate, 0,52 contra 0,53: desempata la necesidad sin cubrir». Comité: «La última palabra es humana: ¿acepta o rechaza? Su razón ya está escrita». Acta: «Todas las pantallas cambiaron a la vez, sin recargar, y quedó un acta con la razón. Tres personas, cinco agentes, una decisión que nadie podía tomar solo».",
    do: "Izquierda: la pantalla grande real (código y QR). Derecha: la galaxia, que enciende dos nodos por persona conectada, converge en el debate y, al sellarse el acta, se aleja hasta NGC 253. `P` pausa o reanuda el debate, `S` adelanta un paso y `B` abre una sala nueva. Con los 3 adentro, Ramón toca «Iniciar» en la pantalla grande (un clic dentro de ella): las dos Administraciones quedan como «automático». Plan B: si a los 15 s falta alguien, Sebastián entra con datos móviles; si alguien no actúa en 20 s, juega el piloto (queda marcado como automático).",
  },
  {
    id: "desarrollo",
    time: "2:40–2:50",
    say: "Esa cama fue solo el primer átomo. El mismo motor ya corre para dos constructoras y una grúa, y para dos distribuidoras y un camión.",
    do: "Si el reloj está justo, se salta esta lámina: el cierre va igual. En preguntas, esta lámina sirve para mostrar las dos webs.",
  },
  {
    id: "cierre",
    time: "2:50–3:00",
    say: "Por eso nos llamamos Sculptor: la galaxia que vemos desde Chile, donde del choque de fuerzas nacen estrellas nuevas. Ustedes tres acaban de crear el primer mundo. Sculptor: donde el caos aprende a evolucionar.",
    do: "Válvula de escape: si a los 2:40 no hay acta, decir solo «Esa cama fue el primer átomo: el mismo motor sirve para una grúa o un camión. Sculptor: donde el caos aprende a evolucionar». Desde la lámina en vivo, un clic en el planeta hace el salto a velocidad luz hacia la lámina siguiente.",
  },
  {
    id: "equipo",
    time: "Preguntas · 2:00",
    say: "Preguntas del jurado. Técnicas: Sebastián. Producto: Nahum. Pantalla y flujo: Ramón. Primero la respuesta, después el detalle; si algo no está medido, se dice «no lo medimos».",
    do: "Respuestas corregidas en docs/DEMO_DIA.md, sección (c).",
  },
  {
    id: "gracias",
    time: "Después de las preguntas",
    say: "Gracias.",
    do: "Se deja en pantalla al terminar. La palabra se arma con píxeles que salen de una galaxia y, 4 s después, los mismos píxeles forman el logo de Sculptor. El mouse los empuja y vuelven a su lugar.",
  },
];

/** Páginas que se pueden mostrar lado a lado en «Desarrollo». Todas son del mismo deploy. */
export const PAGES = [
  { href: "/", label: "Sculptor · protocolo" },
  { href: "/casos/hospitales", label: "Caso · hospitales" },
  { href: "/casos/construccion", label: "Caso · construcción" },
  { href: "/casos/logistica", label: "Caso · logística" },
  { href: "/marca", label: "Marca" },
] as const;
