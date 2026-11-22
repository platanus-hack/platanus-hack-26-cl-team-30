// Textos y listas editables de la landing. Cambia el texto aquí, no en los componentes.

/**
 * El héroe de la portada: un titular en dos voces (la segunda va en serif itálica)
 * y las escenas del dibujo. Siempre dos organizaciones, sus datos reservados (solo
 * el nombre del dato, nunca el valor) y una sola cosa que escasea.
 */
export const HERO = {
  title: "Comparte la decisión,",
  accent: "no tus datos.",
} as const;

export const HERO_SCENES = [
  { a: "Clínica Andes", b: "Hospital Rural", resource: "1 cama UCI", icon: "bed", tag: "El ejemplo", data: ["Costo", "Ocupación", "Pacientes"] },
  { a: "Constructora Norte", b: "Constructora Sur", resource: "1 grúa torre", icon: "construction", data: ["Atraso", "Multas", "Margen"] },
  { a: "Distribuidora Centro", b: "Distribuidora Costa", resource: "1 camión refrigerado", icon: "truck", data: ["Margen", "Clientes", "Rutas"] },
  { a: "Ventas", b: "Operaciones", resource: "1 presupuesto", icon: "wallet", data: ["Sueldos", "Contratos", "Metas"] },
] as const;

export const TEAM = [
  { name: "Ramón Molina", short: "Ramón", github: "rm004607" },
  { name: "Nahum Mateo Díaz López", short: "Nahum", github: "nadilopoff" },
  { name: "Sebastián Vargas Webster", short: "Sebastián", github: "iswebster1401" },
] as const;

/** La historia del equipo, en una pregunta y tres números. */
export const ORIGIN = {
  question: "¿Qué decisión compartida se sigue coordinando mal por chat?",
  stats: [
    { value: "3", label: "amigos" },
    { value: "36", label: "horas" },
    { value: "3", label: "rubros de ejemplo" },
  ],
} as const;

/**
 * Otros rubros donde aplica lo mismo. Son ejemplos ilustrativos, no clientes.
 * Los que tienen scenario abren su sala fija (ver src/lib/genome/scenarios.ts).
 */
export const OTHER_EXAMPLES = [
  {
    icon: "construction",
    scenario: "construccion",
    who: "Dos constructoras",
    resource: "una grúa torre",
    privateData: "Atraso y multas",
  },
  {
    icon: "truck",
    scenario: "logistica",
    who: "Dos distribuidoras",
    resource: "un camión refrigerado",
    privateData: "Margen y clientes",
  },
  {
    icon: "wallet",
    scenario: null,
    who: "Dos áreas de una empresa",
    resource: "un presupuesto",
    privateData: "Sueldos y contratos",
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

/**
 * Preguntas de la entrevista a quien dirige una clínica, en su versión corta para
 * la portada. Las claves se guardan en la base: no renombrar. El texto completo
 * que se guarda con cada respuesta está en src/lib/supabase/interviews.ts.
 */
export const INTERVIEW_QUESTIONS = [
  { key: "q_today", question: "Una cama UCI y dos pacientes: ¿cómo se decide hoy?" },
  { key: "q_channel", question: "¿Por dónde pasa esa conversación?" },
  { key: "q_missing", question: "¿Qué dato ajeno necesitas y casi nunca llega a tiempo?" },
  { key: "q_private", question: "¿Qué dato tuyo no podrías compartir?" },
  { key: "q_trust", question: "Regla conocida y comité que firma: ¿qué te da confianza y qué te preocupa?" },
] as const;
