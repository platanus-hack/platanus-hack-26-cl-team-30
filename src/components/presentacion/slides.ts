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
    do: "Sebastián ya está junto a las 5 personas de primera fila, con el celular desbloqueado.",
  },
  {
    id: "problema",
    time: "0:07–0:27",
    say: "Una organización no es una máquina: es un choque de fuerzas. Un área contra otra, un hospital contra otro. Hoy, dos hospitales que necesitan la misma cama UCI lo arreglan por teléfono: sin regla y sin registro. Y si les ponemos agentes de IA que tiran cada uno para su lado, no obtenemos inteligencia: obtenemos caos más rápido. Es un modelo ilustrativo: diez pasos con 92 % de acierto cada uno dan 43 %.",
    do: "«Lo arreglan por teléfono» es el relato del equipo, no un dato medido: si un juez pregunta, se dice así.",
  },
  {
    id: "solucion",
    time: "0:27–0:42",
    say: "Sculptor sienta a personas y agentes en la misma mesa. Cada persona tiene un agente que la asesora, los agentes negocian a la vista, y la última palabra es de una persona. No se los quiero contar: saquen el celular.",
    do: "A los 0:40 Ramón toca «Abrir la pantalla grande» (abre /stage/demo-cross en otra pestaña del mismo computador). Sebastián: «¡Ustedes cinco!».",
  },
  {
    id: "demo",
    time: "0:42–2:40",
    say: "Unirse: «Escaneen de a uno. La primera es Urgencias de la Clínica; la segunda, su Administración; después Turno y Administración del Hospital Rural. La quinta es el Comité». Posturas: «Su agente les escribió un consejo privado. Elijan su postura: un toque». Debate: «Ahora negocian los agentes. Ningún costo sale de su lado: el servidor ni siquiera se lo envía al otro». Propuesta: «La IA conversa, el código gobierna. Casi empate, 0,52 contra 0,53: desempata la necesidad sin cubrir». Comité: «La última palabra es humana: ¿acepta o rechaza? Su razón ya está escrita». Acta: «Todas las pantallas cambiaron en el mismo segundo, y quedó un acta con la razón».",
    do: "La demo corre en la pestaña de /stage/demo-cross. Espacio pausa el debate y → lo adelanta. Plan B: si a los 15 s falta alguien, Sebastián entra con datos móviles; si alguien no actúa en 20 s, juega el piloto (queda marcado como automático).",
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
    say: "Por eso nos llamamos Sculptor: la galaxia que vemos desde Chile, donde del choque de fuerzas nacen estrellas nuevas. Ustedes cinco acaban de crear el primer mundo. Somos Sculptor.",
    do: "Válvula de escape: si a los 2:40 no hay acta, decir solo «Esa cama fue el primer átomo: el mismo motor sirve para una grúa o un camión. Somos Sculptor».",
  },
  {
    id: "equipo",
    time: "Preguntas · 2:00",
    say: "Preguntas del jurado. Técnicas: Sebastián. Producto: Nahum. Pantalla y flujo: Ramón. Primero la respuesta, después el detalle; si algo no está medido, se dice «no lo medimos».",
    do: "Respuestas corregidas en docs/DEMO_DIA.md, sección (c).",
  },
];

/** Páginas que se pueden mostrar lado a lado en «Desarrollo». Todas son del mismo deploy. */
export const PAGES = [
  { href: "/", label: "Sculptor · portada" },
  { href: "/sculptor", label: "Sculptor · protocolo" },
  { href: "/casos/hospitales", label: "Caso · hospitales" },
  { href: "/casos/construccion", label: "Caso · construcción" },
  { href: "/casos/logistica", label: "Caso · logística" },
  { href: "/marca", label: "Marca" },
] as const;
