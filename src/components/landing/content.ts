// Textos y listas editables de la landing. Cambia el texto aquí, no en los componentes.

export const TEAM = [
  { name: "Ramón Molina", short: "Ramón", github: "rm004607" },
  { name: "Nahum Mateo Díaz López", short: "Nahum", github: "nadilopoff" },
  { name: "Sebastián Vargas Webster", short: "Sebastián", github: "iswebster1401" },
] as const;

export const STORY = [
  "Somos Ramón, Nahum y Sebastián. Llegamos a Platanus Hack 26 con una pregunta del track Multiplayer: ¿qué decisión compartida se sigue coordinando mal por chat?",
  "La respuesta fue incómoda. Las decisiones que más cuestan, como una cama, una grúa, un camión o un presupuesto, se toman por WhatsApp y planillas entre personas que no pueden mostrarse todos sus datos.",
  "Usamos las 36 horas en construir el lugar donde esa decisión se toma entre varios, a la vista de todos y con registro de quién firmó y por qué.",
];

/**
 * Otros rubros donde aplica lo mismo. Son ejemplos ilustrativos, no clientes.
 * Los que tienen scenario abren su sala fija (ver src/lib/genome/scenarios.ts).
 */
export const OTHER_EXAMPLES = [
  {
    icon: "construction",
    scenario: "construccion",
    who: "Dos constructoras",
    resource: "una grúa torre para el jueves",
    privateData: "El atraso real de cada obra y lo que les cuesta cada día de multa.",
  },
  {
    icon: "truck",
    scenario: "logistica",
    who: "Dos distribuidoras",
    resource: "el único camión refrigerado disponible",
    privateData: "El margen de cada pedido y qué cliente están por perder.",
  },
  {
    icon: "wallet",
    scenario: null,
    who: "Dos áreas de una empresa",
    resource: "el presupuesto que queda del trimestre",
    privateData: "Los sueldos y contratos de cada equipo.",
  },
] as const;

/** Patrocinadores de Platanus Hack 26: Santiago, según hack.platan.us/26-cl. */
export const SPONSORS = [
  { name: "Anthropic", file: "anthropic.svg", ratio: 1024.2 / 115 },
  { name: "Buk", file: "buk.svg", ratio: 56 / 24 },
  { name: "ElevenLabs", file: "elevenlabs.svg", ratio: 694 / 90 },
  { name: "Vercel", file: "vercel.svg", ratio: 2048 / 407 },
  { name: "Render", file: "render.svg", ratio: 110 / 21 },
  { name: "Kairos", file: "kairos.svg", ratio: 7725.9 / 1508.4 },
  { name: "Kapso", file: "kapso.svg", ratio: 8240 / 2597 },
  { name: "CChC", file: "cchc.svg", ratio: 61 / 13 },
  { name: "AgendaPro", file: "agendapro.svg", ratio: 7212.31 / 1083.18 },
  { name: "Copec", file: "copec.svg", ratio: 6984.37 / 1464.36 },
  { name: "Lici", file: "lici.svg", ratio: 1874.76 / 879.21 },
  { name: "Imperio 3D", file: "imperio3d.svg", ratio: 1430.39 / 360.54 },
  { name: "Startuplab.01", file: "startuplab01.svg", ratio: 2560.16 / 1178.87 },
  { name: "T3C", file: "t3c.svg", ratio: 953.93 / 176.9 },
] as const;

/** Preguntas de la entrevista a quien dirige una clínica. Las claves se guardan en la base: no renombrar. */
export const INTERVIEW_QUESTIONS = [
  { key: "q_today", question: "Cuando hay una sola cama UCI y dos pacientes, ¿cómo se decide hoy quién la recibe?" },
  { key: "q_channel", question: "¿Por dónde pasa esa conversación: teléfono, WhatsApp, planillas, correo?" },
  { key: "q_missing", question: "¿Qué dato de otra institución necesitas para decidir y casi nunca te llega a tiempo?" },
  { key: "q_private", question: "¿Qué dato tuyo no podrías compartir con otra institución, aunque ayudara a decidir?" },
  { key: "q_trust", question: "Si decidiera una regla conocida y un comité que firma con su razón, ¿qué te daría confianza y qué te preocuparía?" },
] as const;
