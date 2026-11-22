// Textos de la landing de Sculptor en un solo lugar. Salen de los principios del
// repo (CLAUDE.md) y del guion de la demo (docs/DEMO_DIA.md). Las cifras NO van aquí: las calcula
// el motor en data.ts o vienen de docs/MEDICIONES.md.

export const HERO = {
  kicker: ["Protocolo", "NGC 253", "PH26"],
  title: "Un agente solo es ruido.",
  accent: "Deliberar juntos es poder.",
  body: "Sculptor es un esqueleto organizacional multijugador: personas y agentes emparejados por rol deciden en tiempo real sobre lo que cuesta. Cada quien ve solo lo que su rol permite, y nada se sella sin una persona.",
  motto: ["Los agentes conversan y proponen.", "El código gobierna.", "La persona decide y sella."],
} as const;

export const ORIGIN = {
  kicker: "[01] El problema",
  title: "Una organización es un choque de fuerzas.",
  body: "Un área contra otra, un hospital contra otro. Cuando necesitan el mismo recurso, no pueden decidir juntas: cada una tiene datos que no puede mostrarle a la otra. Y si a esa tensión le sumamos agentes de IA que tiran cada uno para su lado, no obtenemos inteligencia: obtenemos caos más rápido.",
  channels: ["Área contra área", "Urgencia contra presupuesto", "Hospital contra hospital", "Agente contra agente"],
  name: {
    title: "¿Por qué Sculptor?",
    body: "Por la Galaxia del Escultor, NGC 253, visible desde el cielo austral de Chile. Antes se llamó «Cupo» y «Nexo».",
  },
} as const;

export const PRINCIPLES = [
  {
    title: "Los agentes conversan. El código gobierna.",
    body: "El modelo solo produce contenido: un genoma JSON o una propuesta corta. Roles, permisos, umbrales y asignaciones son código determinista, validado con Zod antes de usarse.",
  },
  {
    title: "Nada se mueve sin una persona.",
    body: "Ningún agente cambia el estado ni sella por su cuenta. Cada cambio nace de una acción humana y llega a todas las pantallas en el mismo segundo.",
  },
  {
    title: "El secreto no viaja por la red.",
    body: "El servidor filtra por organización y rol antes de enviar cada evento y antes de armar el prompt del agente. Intentar leer un dato ajeno devuelve 403 y queda en la bitácora.",
  },
  {
    title: "Soberano o en la nube, y lo dice.",
    body: "Una sola capa de modelos: hoy Claude en la nube; un modelo local en un NVIDIA DGX Spark es cambiar variables de entorno. La telemetría muestra cuál corrió y si fue local o nube.",
  },
] as const;

export const RELIABILITY = {
  kicker: "[03] La matemática",
  title: "Diez agentes con 92 % de acierto no dan 92 %.",
  body: "En una cadena autónoma de n pasos, el éxito compuesto es pⁿ. Una compuerta humana en cada paso deja pasar solo el error que también se le escapa a la persona.",
  formulaAuto: "P_auto = pⁿ",
  formulaHybrid: "P_híbrido = (1 − (1 − p)·(1 − h))ⁿ",
  note: "Modelo ilustrativo, calculado por el mismo motor de la sala con las semillas de la demo.",
} as const;

export const EXAMPLE = {
  kicker: "[04] Un ejemplo, no el límite",
  title: "Dos hospitales, una cama UCI.",
  body: "La clínica es una aplicación del protocolo. Cada hospital defiende a su paciente con su agente, sin ver el costo del otro. Una fórmula a la vista ordena los casos; si quedan empatados, desempata por equidad. El Comité aprueba o veta, siempre con una razón.",
  hidden: "Costo de cobertura",
  disclaimer: "Datos simulados. No es una herramienta clínica.",
} as const;

export const MARKET = {
  kicker: "[05] El mercado",
  title: "Mismo esqueleto, otro genoma.",
  body: "La interfaz no se reprograma por industria: cambia el genoma JSON y las mismas piezas gobiernan otra deliberación. Infraestructura B2B, en la nube o en las instalaciones del cliente.",
  sectors: [
    { name: "Salud", case: "Una cama UCI entre dos hospitales.", status: "En la demo" },
    { name: "Construcción", case: "Una grúa torre para dos obras el mismo día.", status: "En la demo" },
    { name: "Logística", case: "El único camión refrigerado para dos distribuidoras.", status: "En la demo" },
    { name: "Ventas B2B", case: "Un descuento corporativo con margen confidencial.", status: "Genoma listo" },
    { name: "RR.HH.", case: "Calibraciones, bonos y promociones sin filtrar bandas salariales.", status: "Desde una frase" },
    { name: "Banca", case: "Aprobaciones entre riesgo, comercial y comité.", status: "Desde una frase" },
    { name: "Minería", case: "Turnos, equipos y presupuesto entre faenas.", status: "Desde una frase" },
  ],
  statusNote: "«En la demo»: escenario entre organizaciones que se juega hoy. «Genoma listo»: semilla validada en el repo. «Desde una frase»: el modelo genera el genoma de una organización nueva y el código lo valida antes de usarlo.",
} as const;

export const ORBITAL = {
  kicker: "[06] Del átomo a la galaxia",
  title: "Primero una cama. Después, miles de organizaciones.",
  body: "La simulación que usamos en el pitch: baja por la sección y recorre sus nueve etapas, desde el primer nodo en el Polo Sur hasta la galaxia NGC 253.",
  hint: "← → para recorrer a mano",
} as const;

export const MEASURED = {
  kicker: "[07] Medido, no prometido",
  title: "Cifras con cómo y dónde.",
  items: [
    { value: "500", label: "conexiones en vivo a la vez", detail: "p95 de 51,5 ms. En un notebook, sin red de por medio." },
    { value: "97/97", label: "pasos del recorrido completo", detail: "Seis participantes contra el deploy en Render, sin modelo. Versión del 21 de noviembre." },
    { value: "60", label: "cuadros por segundo", detail: "Pantalla grande con la galaxia, Apple M4 con GPU." },
  ],
  source: "Fuente: docs/MEDICIONES.md. Si una cifra no está ahí, no está medida.",
} as const;

export const HACK = {
  kicker: ["20 – 22 de noviembre", "2026", "Santiago", "CHL"],
  title: "De cero a producto en 36 horas.",
  body: "Platanus Hack 26 ft. Buk: equipos que llegan con una idea y se van con algo funcionando. Elegimos el track Multiplayer: varias personas, a la vez, decidiendo sobre algo que cuesta.",
  facts: [
    { value: "36", label: "horas" },
    { value: "30", label: "equipo" },
    { value: "3", label: "personas" },
    { value: "1", label: "protocolo" },
  ],
  track: "Track Multiplayer",
} as const;

export const TEAM = [
  { name: "Ramón Molina", role: "Producto web", detail: "Pantallas y rutas de la API. En la demo, opera la pantalla grande.", handle: "rm004607" },
  { name: "Sebastián Vargas", role: "Agente e infraestructura", detail: "Modelos, Spark, integraciones y deploy. En la demo, guía al público.", handle: "iswebster1401" },
  { name: "Nahum Díaz", role: "Negocio y pitch", detail: "Usuarios reales, finanzas y relato. En la demo, la voz.", handle: "nadilopoff" },
] as const;

export const CLOSING = "Con Sculptor, el recurso deja de esperar.";
