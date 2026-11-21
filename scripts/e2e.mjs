#!/usr/bin/env node
// Prueba de punta a punta por HTTP, sin navegador.
//
// Simula a varios participantes independientes: cada uno toma su rol, recibe su
// token y abre su propia conexión SSE. La prueba solo sabe lo que cada
// participante recibe por la red, igual que un navegador real.
//
// Recorridos:
//   single_org  una clínica con 3 roles: choque de autoridad, sello de la regla,
//               compuerta bloqueada, decisión humana y acta.
//   cross_org   dos hospitales y una cama: todo lo anterior por organización, más
//               candidatos, asignación, rechazo del Comité sin la clave del QR,
//               Comité que aprueba o veta con razón y acta.
//   otra org.   una distribuidora (semilla no clínica) y permisos que cambian en vivo.
//   otro rubro  dos constructoras y una grúa, ensayadas por el piloto automático
//               con una persona en un puesto: el bot no lo toca y nada se filtra.
//   sorteo      QR único: POST /api/rooms/:id/seat entrega una silla libre al azar,
//               «sortear otro rol» cambia de silla y libera la anterior, el Comité
//               solo entra con su clave y, sin sillas libres, responde 409.
//   demo        sala de demo (3 personas, 3 toques): el sorteo reparte solo quien
//               presenta en cada organización y el Comité; al entrar la primera
//               persona, bots sellan el límite y firman; el reloj parte en 0;
//               «Nueva ronda» (reinicio del anfitrión) la deja limpia.
//   frase       POST /api/rooms con description crea una sala nueva ya mutada.
//               Intenta el modelo (máximo 15 s) y acepta la semilla de respaldo:
//               el resultado no depende del modelo, pero contra el deploy gasta una
//               llamada a Claude.
// Al terminar cada sala la reinicia con el token de anfitrión (y comprueba que
// sin él el reinicio se rechaza).
//
// En cada paso comprueba además que ningún participante recibió un dato que no
// le corresponde, buscando los valores reservados en el texto crudo de su SSE.
//
// Uso:
//   node scripts/e2e.mjs http://localhost:3000 [--only single|cross] [--llm]
//                        [--committee veto|approve] [--timeout 5000] [--verbose]
//
//   --llm        incluye RUN_ROLE_AGENT y POST /mutate, que llaman al modelo
//                (lento y, en la nube, con costo). Sin esta bandera ningún paso
//                exige que el modelo responda.
//   --committee  qué hace el Comité en la sala cross_org: "veto" (por defecto)
//                veta al ganador propuesto y sella la nueva asignación;
//                "approve" sella la primera propuesta.
//
// Sale con código 0 si todo pasó, 1 si algún paso falló y 2 si no pudo empezar.

import { openStream, parseArgs, request, sleep } from "./lib/client.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const baseUrl = (positional[0] ?? "").replace(/\/$/, "");
const ONLY = typeof flags.only === "string" ? flags.only : null;
const TIMEOUT_MS = Number(flags.timeout ?? 5000);
const WITH_LLM = Boolean(flags.llm);
const COMMITTEE = flags.committee === "approve" ? "APPROVE" : "VETO";
const VERBOSE = Boolean(flags.verbose);

if (!baseUrl || (ONLY && !["single", "cross"].includes(ONLY))) {
  console.error("Uso: node scripts/e2e.mjs <url> [--only single|cross] [--llm] [--committee veto|approve] [--timeout 5000] [--verbose]");
  process.exit(2);
}

// --- Payloads de las acciones --------------------------------------------------
// Único lugar que conoce la forma de cada payload. Debe coincidir con ActionSchema
// en src/lib/store/actions.ts. Lo demás del script usa estos constructores.

const PAYLOADS = {
  slider: (value) => ({ value }),
  toggle: (fieldKey) => ({ fieldKey }),
  seal: (threshold) => ({ threshold, gateMode: "deterministic_hitl" }),
  breach: (targetOrgId, fieldKey) => ({ targetOrgId, fieldKey }),
  hitl: (decision, reason) => ({ decision, reason }),
  candidate: (caseId) => ({ caseId }),
  allocationSeal: (reason) => ({ reason }),
  committeeVeto: (reason) => ({ reason }),
  agent: () => ({}),
};

// --- Reporte -------------------------------------------------------------------

let passed = 0;
const failures = [];
let section = "";

function title(text) {
  section = text;
  console.log(`\n== ${text} ==`);
}

/** Ejecuta un paso e imprime OK o FALLA. Devuelve true si pasó. */
async function step(name, fn) {
  try {
    const note = await fn();
    passed += 1;
    console.log(`  OK     ${name}${note ? `  (${note})` : ""}`);
    return true;
  } catch (error) {
    failures.push({ section, name, message: error?.message ?? String(error) });
    console.log(`  FALLA  ${name}`);
    for (const line of String(error?.message ?? error).split("\n")) console.log(`           ${line}`);
    return false;
  }
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function describeResponse(res) {
  return `HTTP ${res.status} ${res.text.slice(0, 200)}`;
}

/** Comprueba status y código de error de una respuesta { error, code }. */
function expectError(res, status, code) {
  check(res.status === status, `Se esperaba HTTP ${status}${code ? ` ${code}` : ""} y llegó ${describeResponse(res)}`);
  if (code) check(res.data?.code === code, `Se esperaba code "${code}" y llegó ${describeResponse(res)}`);
  check(typeof res.data?.error === "string", `La respuesta de error debe traer { error, code }: ${describeResponse(res)}`);
}

function expectOk(res) {
  check(res.status === 200 && res.data?.ok === true, `Se esperaba { ok: true } y llegó ${describeResponse(res)}`);
}

// --- Participante --------------------------------------------------------------

/** Una persona (o la pantalla general) con su propia conexión SSE. */
class Participant {
  constructor(roomId, label, orgId = null, roleId = null, committeeKey = undefined) {
    this.roomId = roomId;
    this.label = label;
    this.orgId = orgId;
    this.roleId = roleId;
    /** Solo el Comité: la clave que va dentro del QR de la pantalla grande. */
    this.committeeKey = committeeKey;
    this.token = null;
    this.state = null;
    /** Texto crudo de cada mensaje recibido: es lo que de verdad viajó por la red. */
    this.raw = [];
    this.arrivals = [];
    this.waiters = [];
    this.abort = new AbortController();
  }

  get isStage() {
    return this.orgId === null;
  }

  async join() {
    const res = await request(baseUrl, "POST", `/api/rooms/${this.roomId}/action`, { type: "JOIN_ROLE", orgId: this.orgId, roleId: this.roleId, committeeKey: this.committeeKey });
    if (res.ok && typeof res.data?.token === "string") this.token = res.data.token;
    return res;
  }

  async listen() {
    const query = this.isStage ? "" : `?orgId=${encodeURIComponent(this.orgId)}&roleId=${encodeURIComponent(this.roleId)}&token=${encodeURIComponent(this.token ?? "")}`;
    await openStream(
      `${baseUrl}/api/rooms/${this.roomId}/events${query}`,
      (message, at, raw) => {
        this.state = message;
        this.raw.push(raw);
        this.arrivals.push(at);
        this.waiters = this.waiters.filter((waiter) => !waiter.tryResolve(message));
      },
      this.abort,
    );
    return this.state;
  }

  act(type, payload = {}, overrides = {}) {
    return request(baseUrl, "POST", `/api/rooms/${this.roomId}/action`, { type, orgId: this.orgId, roleId: this.roleId, token: this.token, ...payload, ...overrides });
  }

  /** Espera a que llegue por SSE un estado que cumpla el predicado. */
  waitFor(predicate, what, timeoutMs = TIMEOUT_MS) {
    const matches = (state) => {
      try {
        return Boolean(predicate(state));
      } catch {
        return false;
      }
    };
    if (this.state && matches(this.state)) return Promise.resolve(this.state);
    return new Promise((resolve, reject) => {
      const waiter = {
        tryResolve: (state) => {
          if (!matches(state)) return false;
          clearTimeout(timer);
          resolve(state);
          return true;
        },
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== waiter);
        reject(new Error(`${this.label}: en ${timeoutMs} ms no llegó por SSE: ${what}`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  close() {
    this.abort.abort();
  }
}

/** Espera a que TODOS los participantes vean el cambio: eso es lo multijugador. */
function allSee(participants, predicate, what) {
  return Promise.all(participants.map((participant) => participant.waitFor(predicate, what)));
}

// --- Lectura del estado proyectado -----------------------------------------------

const orgOf = (state, orgId) => state.orgs.find((org) => org.orgId === orgId);
const hasAudit = (state, type, match = () => true) => state.auditLog.some((event) => event.type === type && match(event));
const sameViewer = (state, participant) =>
  participant.isStage ? state.viewer === "stage" : state.viewer?.orgId === participant.orgId && state.viewer?.roleId === participant.roleId;

/** Un valor es buscable en texto crudo si es lo bastante largo como para no coincidir por azar. */
const distinctive = (value) => String(value).length >= 4;

/**
 * Reúne los valores reservados que algún participante sí recibió (porque le
 * corresponden), para luego buscarlos en el tráfico de quienes no deben verlos.
 */
function collectSecrets(participants) {
  const secrets = new Map();
  for (const participant of participants) {
    if (!participant.state) continue;
    for (const org of participant.state.orgs) {
      for (const field of org.fields) {
        if (field.redacted === false && field.classification !== "public") {
          secrets.set(`${org.orgId}.${field.key}`, { value: field.value, classification: field.classification, orgId: org.orgId });
        }
      }
    }
    for (const candidate of participant.state.scarcity?.candidates ?? []) {
      if (typeof candidate.coverageCost === "number") {
        secrets.set(`candidato.${candidate.caseId}.coverageCost`, { value: candidate.coverageCost, classification: "secret", orgId: candidate.orgId });
      }
    }
  }
  return secrets;
}

/**
 * Comprueba la niebla de un participante contra todo lo que recibió por SSE.
 * Devuelve la lista de problemas (vacía si no hay fugas).
 */
function findLeaks(participant, secrets) {
  const problems = [];
  const state = participant.state;
  if (!state) return [`${participant.label}: no recibió ningún estado`];
  const traffic = participant.raw.join("\n");
  const visibleFieldValues = new Set();

  for (const org of state.orgs) {
    for (const field of org.fields) {
      const name = `${org.orgId}.${field.key}`;
      if (field.redacted === true) {
        if ("value" in field) problems.push(`${participant.label}: ${name} viene marcado como oculto pero trae "value"`);
        if (field.reason !== "RBAC_SERVER_FILTERED") problems.push(`${participant.label}: ${name} oculto sin reason RBAC_SERVER_FILTERED`);
      } else {
        visibleFieldValues.add(String(field.value));
        // Nadie de fuera de la organización dueña recibe un campo no público.
        // La pantalla general no tiene identidad: solo recibe campos públicos.
        if (field.classification !== "public" && participant.isStage) problems.push(`${participant.label}: la pantalla general recibió ${name} (${field.classification})`);
        if (field.classification !== "public" && !participant.isStage && org.orgId !== participant.orgId) {
          problems.push(`${participant.label}: recibió ${name} (${field.classification}) de otra organización`);
        }
        if (field.classification === "secret" && participant.isStage) problems.push(`${participant.label}: la pantalla general recibió el secreto ${name}`);
      }
    }
  }

  for (const org of state.orgs) {
    for (const field of org.fields) {
      if (field.redacted !== true) continue;
      const secret = secrets.get(`${org.orgId}.${field.key}`);
      if (!secret || !distinctive(secret.value) || visibleFieldValues.has(String(secret.value))) continue;
      if (traffic.includes(String(secret.value))) {
        problems.push(`${participant.label}: el valor oculto de ${org.orgId}.${field.key} (${secret.value}) viajó en su SSE`);
      }
    }
  }

  for (const candidate of state.scarcity?.candidates ?? []) {
    const name = `costo de cobertura del caso ${candidate.caseId}`;
    if (typeof candidate.coverageCost === "number") {
      if (candidate.orgId !== participant.orgId) problems.push(`${participant.label}: recibió el ${name}, que es de ${candidate.orgId}`);
      // Dentro de la organización, el costo solo lo ve quien puede ver el campo coverage_cost.
      const ownCost = orgOf(state, candidate.orgId)?.fields.find((field) => field.key === "coverage_cost");
      if (ownCost?.redacted === true) problems.push(`${participant.label}: su rol no puede ver coverage_cost, pero recibió el ${name} por la lista de candidatos`);
    } else {
      if (candidate.coverageCost?.redacted !== true) problems.push(`${participant.label}: el ${name} no viene ni como número ni como oculto`);
      const secret = secrets.get(`candidato.${candidate.caseId}.coverageCost`);
      if (secret && candidate.orgId !== participant.orgId && traffic.includes(String(secret.value))) {
        problems.push(`${participant.label}: el ${name} (${secret.value}) viajó en su SSE`);
      }
    }
    if ("coverageCostVisibleToOrgs" in candidate) problems.push(`${participant.label}: el candidato ${candidate.caseId} expone coverageCostVisibleToOrgs`);
  }

  // La pantalla general y el árbitro no pertenecen a ninguna organización que compite.
  const belongsToCompetingOrg = state.orgs.some((org) => org.orgId === participant.orgId);
  if (!belongsToCompetingOrg) {
    for (const [name, secret] of secrets) {
      if (distinctive(secret.value) && traffic.includes(String(secret.value))) {
        problems.push(`${participant.label}: el valor reservado ${name} (${secret.value}) viajó en su SSE`);
      }
    }
  }

  if (traffic.includes(participant.token ?? "\u0000sin-token")) problems.push(`${participant.label}: su propio token viajó en el SSE`);
  return problems;
}

function assertNoLeaks(participants) {
  const secrets = collectSecrets(participants);
  const problems = participants.flatMap((participant) => findLeaks(participant, secrets));
  // Ningún token de otro participante aparece en el tráfico de nadie.
  for (const reader of participants) {
    const traffic = reader.raw.join("\n");
    for (const owner of participants) {
      if (owner !== reader && owner.token && traffic.includes(owner.token)) problems.push(`${reader.label}: recibió el token de ${owner.label}`);
    }
  }
  check(problems.length === 0, problems.join("\n"));
  return `${secrets.size} valores reservados, ${participants.reduce((sum, item) => sum + item.raw.length, 0)} mensajes revisados`;
}

// --- Pasos compartidos por los dos recorridos -------------------------------------

/** Token de anfitrión y clave del Comité de cada sala que crea la prueba. */
const hosts = new Map();
const hostHeaders = (roomId) => ({ "x-host-token": hosts.get(roomId)?.hostToken ?? "" });

/**
 * Reinicia una sala creada por la prueba: solo el anfitrión puede, vuelve al
 * caso inicial y los tokens anteriores dejan de servir. La sala se borra sola
 * de la memoria tras un rato sin actividad.
 */
async function discardRoom(roomId, someone = null) {
  if (!roomId) return;
  await step(`reiniciar la sala ${roomId}: sin token de anfitrión 403; con él vuelve al inicio y los tokens dejan de servir`, async () => {
    expectError(await request(baseUrl, "DELETE", `/api/rooms/${roomId}`), 403, "HOST_ONLY");
    const res = await request(baseUrl, "DELETE", `/api/rooms/${roomId}`, undefined, hostHeaders(roomId));
    check(res.status === 200, `DELETE con x-host-token debía responder 200: ${describeResponse(res)}`);
    const acta = await request(baseUrl, "GET", `/api/rooms/${roomId}/acta`);
    check(acta.status === 200 && acta.data.decisions.length === 0, `Tras reiniciar, el acta debía existir sin decisiones: ${describeResponse(acta)}`);
    if (someone?.token) {
      const stale = await someone.act("SEAL_RULE", PAYLOADS.seal(undefined));
      check(stale.status === 401, `Tras reiniciar, un token anterior debía dar 401 y dio ${describeResponse(stale)}`);
    }
  });
}

/** Crea una sala y guarda sus claves de anfitrión. Devuelve el id. */
async function createRoom(mode, extra = {}) {
  const res = await request(baseUrl, "POST", "/api/rooms", { mode, ...extra });
  check(res.ok && typeof res.data?.roomId === "string", `POST /api/rooms { mode: "${mode}" } debía responder { roomId }: ${describeResponse(res)}`);
  check(typeof res.data.hostToken === "string" && typeof res.data.committeeKey === "string", `POST /api/rooms debía entregar hostToken y committeeKey: ${describeResponse(res)}`);
  hosts.set(res.data.roomId, { hostToken: res.data.hostToken, committeeKey: res.data.committeeKey });
  return res.data.roomId;
}

/** Cada rol toma su lugar y abre su SSE. Devuelve los participantes que entraron. */
async function seatEveryone(roomId, stage, seats) {
  const people = [];
  for (const seat of seats) {
    const person = new Participant(roomId, seat.label, seat.orgId, seat.roleId, seat.committee ? hosts.get(roomId)?.committeeKey : undefined);
    const ok = await step(`${seat.label} toma su rol, recibe token y abre su SSE`, async () => {
      const res = await person.join();
      expectOk(res);
      check(typeof person.token === "string" && person.token.length >= 16, `JOIN_ROLE debía responder { ok: true, token }: ${describeResponse(res)}`);
      const state = await person.listen();
      check(sameViewer(state, person), `El SSE debía venir proyectado para ${seat.orgId}/${seat.roleId} y vino para ${JSON.stringify(state.viewer)}`);
      await stage.waitFor((current) => orgOf(current, seat.orgId)?.roles.find((role) => role.id === seat.roleId)?.connected === true, `${seat.label} conectado`);
    });
    if (ok) people.push(person);
  }
  return people;
}

async function identityChecks(roomId, people) {
  const someone = people[0];
  await step("un rol ocupado no se puede tomar de nuevo: 409 ROLE_TAKEN", async () => {
    const res = await request(baseUrl, "POST", `/api/rooms/${roomId}/action`, { type: "JOIN_ROLE", orgId: someone.orgId, roleId: someone.roleId });
    expectError(res, 409, "ROLE_TAKEN");
  });
  await step("una acción con token inválido se rechaza: 401", async () => {
    const res = await someone.act("LEAVE_ROLE", {}, { token: "token-inventado" });
    expectError(res, 401);
  });
  if (people.length > 1) {
    await step("el token de un rol no sirve para actuar como otro: 401", async () => {
      const res = await someone.act("LEAVE_ROLE", {}, { token: people[1].token });
      expectError(res, 401);
    });
  }
  await step("el SSE con token inválido entrega la vista general, no la del rol", async () => {
    const intruder = new Participant(roomId, "intruso", someone.orgId, someone.roleId);
    intruder.token = "token-inventado";
    try {
      const state = await intruder.listen();
      check(state.viewer === "stage", `Sin token válido el viewer debía ser "stage" y fue ${JSON.stringify(state.viewer)}`);
      const problems = findLeaks(Object.assign(intruder, { orgId: null, roleId: null, token: null }), collectSecrets(people));
      check(problems.length === 0, problems.join("\n"));
    } finally {
      intruder.close();
    }
  });
  await step("una acción con forma inválida se rechaza: 400", async () => {
    const res = await someone.act("ACCION_QUE_NO_EXISTE");
    expectError(res, 400);
  });
  await step("una sala que no existe responde 404", async () => {
    const res = await request(baseUrl, "POST", "/api/rooms/sala-que-no-existe/action", { type: "JOIN_ROLE", orgId: someone.orgId, roleId: someone.roleId });
    expectError(res, 404);
    const events = await request(baseUrl, "GET", "/api/rooms/sala-que-no-existe/events");
    check(events.status === 404, `El SSE de una sala inexistente debía dar 404 y dio ${events.status}`);
  });
}

async function fogChecks(everyone, people) {
  await step("cada rol ve sus propios campos, así que la niebla no es ocultar todo", async () => {
    for (const person of people) {
      const own = orgOf(person.state, person.orgId)?.fields.filter((field) => field.ownerRoleId === person.roleId) ?? [];
      const hidden = own.filter((field) => field.redacted !== false);
      check(hidden.length === 0, `${person.label} no recibió sus propios campos: ${hidden.map((field) => field.key).join(", ")}`);
    }
    const anyRedacted = people.some((person) => person.state.orgs.some((org) => org.fields.some((field) => field.redacted === true)));
    check(anyRedacted, "Ningún participante tiene campos ocultos: no hay niebla que comprobar");
  });
  await step("ningún dato reservado viajó hacia quien no debe verlo", async () => assertNoLeaks(everyone));
}

/** Busca un campo que `reader` no ve y que sí existe, dentro de la organización indicada. */
function hiddenFieldFor(reader, orgId) {
  return orgOf(reader.state, orgId)?.fields.find((field) => field.redacted === true && field.classification === "secret");
}

async function breachCheck(everyone, reader, targetOrgId, name) {
  await step(name, async () => {
    const field = hiddenFieldFor(reader, targetOrgId);
    check(field, `${reader.label} no tiene ningún campo secreto oculto en ${targetOrgId} con el que probar`);
    const res = await reader.act("TEST_RBAC_BREACH", PAYLOADS.breach(targetOrgId, field.key));
    expectError(res, 403, "RBAC_DENIED");
    const secret = collectSecrets(everyone).get(`${targetOrgId}.${field.key}`);
    if (secret && distinctive(secret.value)) check(!res.text.includes(String(secret.value)), "La respuesta 403 incluye el valor que estaba negando");
    await allSee(
      everyone,
      (state) => hasAudit(state, "RBAC_DENIED", (event) => event.orgId === reader.orgId && event.roleId === reader.roleId),
      `evento RBAC_DENIED de ${reader.label} en la bitácora`,
    );
    return `campo ${targetOrgId}.${field.key}`;
  });
}

/** Choque de autoridad, sello, compuerta y decisión humana dentro de una organización. */
async function authorityFlow(everyone, people, orgId) {
  const stage = everyone[0];
  const rule = orgOf(stage.state, orgId).authorityRule;
  const proposer = people.find((person) => person.orgId === orgId && person.roleId === rule.proposerRoleId);
  const approver = people.find((person) => person.orgId === orgId && person.roleId === rule.approverRoleId);
  const tag = `[${orgId}]`;
  if (!proposer || !approver) {
    await step(`${tag} proponente y aprobador presentes`, async () => check(false, "Falta el proponente o el aprobador; se omite el flujo de autoridad"));
    return;
  }
  const proposed = orgOf(stage.state, orgId).liveCase.proposedValue;
  // Umbral que deja el valor propuesto por encima: así la compuerta tiene que bloquear.
  const agreed = Math.min(rule.approverLimit, proposed - 1);

  await step(`${tag} sin choque mientras el proponente no pide más de lo que el aprobador permite`, async () => {
    expectOk(await approver.act("UPDATE_AUTHORITY_SLIDER", PAYLOADS.slider(agreed)));
    expectOk(await proposer.act("UPDATE_AUTHORITY_SLIDER", PAYLOADS.slider(agreed)));
    await allSee(everyone, (state) => orgOf(state, orgId).conflict.hasConflict === false, "conflict.hasConflict = false");
  });

  await step(`${tag} el proponente sube su límite y el choque aparece en todas las pantallas`, async () => {
    expectOk(await proposer.act("UPDATE_AUTHORITY_SLIDER", PAYLOADS.slider(rule.max)));
    const states = await allSee(everyone, (state) => orgOf(state, orgId).conflict.hasConflict === true, "conflict.hasConflict = true");
    const conflict = orgOf(states[0], orgId).conflict;
    check(conflict.delta === rule.max - agreed, `conflict.delta debía ser ${rule.max - agreed} y es ${conflict.delta}`);
    await stage.waitFor((state) => hasAudit(state, "CONFLICT_DETECTED", (event) => event.orgId === orgId), "evento CONFLICT_DETECTED");
    return `delta ${conflict.delta}`;
  });

  const unsealedReliability = orgOf(stage.state, orgId).reliability;
  await step(`${tag} con el choque sin resolver nadie puede firmar (409 RULE_NOT_SEALED) y la confiabilidad es la autónoma`, async () => {
    const gate = orgOf(stage.state, orgId).gate;
    const signer = people.find((person) => person.orgId === orgId && (gate.deciderRoleIds ?? []).includes(person.roleId));
    check(signer, "No hay en la sala un rol autorizado a firmar con el que probar");
    expectError(await signer.act("HITL_DECISION", PAYLOADS.hitl("APPROVE", "Intento de firmar con la regla en disputa")), 409, "RULE_NOT_SEALED");
    const reliability = orgOf(stage.state, orgId).reliability;
    check(reliability.currentMode === "autonomous" && reliability.current === reliability.autonomous, `Con choque pendiente debía aplicar el nivel autónomo; aplica "${reliability.currentMode}"`);
    return `${(reliability.current * 100).toFixed(1)}%`;
  });

  await step(`${tag} nadie más puede mover los límites de esta regla`, async () => {
    const third = people.find((person) => person.orgId === orgId && person !== proposer && person !== approver);
    const foreigner = people.find((person) => person.orgId !== orgId);
    check(third || foreigner, "No hay un tercer participante con el que probar");
    const notes = [];
    if (third) {
      const res = await third.act("UPDATE_AUTHORITY_SLIDER", PAYLOADS.slider(rule.min));
      expectError(res, 403, "RBAC_DENIED");
      notes.push(`${third.label}: 403`);
    }
    if (foreigner) {
      // Otra organización, con su propio token, intenta hacerse pasar por el proponente de esta.
      const res = await foreigner.act("UPDATE_AUTHORITY_SLIDER", PAYLOADS.slider(rule.min), { orgId, roleId: rule.proposerRoleId });
      expectError(res, 401, "INVALID_TOKEN");
      notes.push(`${foreigner.label} suplantando: 401`);
    }
    const current = orgOf(stage.state, orgId).authorityRule;
    check(current.proposerLimit === rule.max && current.approverLimit === agreed, "Los límites cambiaron pese al rechazo");
    return notes.join(", ");
  });

  await step(`${tag} al sellar la regla el choque desaparece para todos`, async () => {
    expectOk(await approver.act("SEAL_RULE", PAYLOADS.seal(agreed)));
    await allSee(
      everyone,
      (state) => orgOf(state, orgId).conflict.hasConflict === false && orgOf(state, orgId).authorityRule.sealedThreshold === agreed,
      `sealedThreshold = ${agreed} y sin choque`,
    );
    await stage.waitFor((state) => hasAudit(state, "RULE_SEALED", (event) => event.orgId === orgId), "evento RULE_SEALED");
    return `umbral ${agreed}`;
  });

  if (WITH_LLM) {
    await step(`${tag} el agente del proponente propone y su texto llega solo a quien lo pidió`, async () => {
      const res = await proposer.act("RUN_ROLE_AGENT", PAYLOADS.agent());
      expectOk(res);
      const agent = res.data.agent;
      check(agent && typeof agent.proposalText === "string" && agent.proposalText.length > 0, `RUN_ROLE_AGENT debía responder { agent: { proposalText, ... } }: ${describeResponse(res)}`);
      await stage.waitFor((state) => hasAudit(state, "AGENT_PROPOSED", (event) => event.orgId === orgId), "evento AGENT_PROPOSED", 60000);
      // El agente hereda los permisos del rol: su texto no puede contener lo que el rol no ve.
      for (const field of orgOf(proposer.state, orgId).fields.filter((item) => item.redacted === true)) {
        const secret = collectSecrets(everyone).get(`${orgId}.${field.key}`);
        if (secret && distinctive(secret.value)) check(!res.text.includes(String(secret.value)), `La propuesta del agente contiene ${field.key}, que su rol no puede ver`);
      }
      return `${agent.source}, ${agent.latencyMs} ms`;
    });
  }

  await step(`${tag} el valor propuesto cruza el umbral y la compuerta queda bloqueada esperando a una persona`, async () => {
    const states = await allSee(everyone, (state) => orgOf(state, orgId).gate.status === "BLOCKED_HITL_REQUIRED", "gate.status = BLOCKED_HITL_REQUIRED");
    const gate = orgOf(states[0], orgId).gate;
    check(gate.crossesThreshold === true, "gate.crossesThreshold debía ser true");
    check(gate.effectiveThreshold === agreed, `gate.effectiveThreshold debía ser ${agreed} y es ${gate.effectiveThreshold}`);
    check(typeof gate.pendingApproverRoleId === "string", "gate.pendingApproverRoleId debía indicar quién decide");
    await stage.waitFor((state) => hasAudit(state, "GATE_BLOCKED", (event) => event.orgId === orgId), "evento GATE_BLOCKED");
    return `${gate.proposedValue} > ${gate.effectiveThreshold}, decide ${gate.pendingApproverRoleId}`;
  });

  const gateNow = orgOf(stage.state, orgId).gate;
  const deciderRoleIds = gateNow.deciderRoleIds ?? [rule.approverRoleId];
  const inOrg = people.filter((person) => person.orgId === orgId);
  // Decide el rol pendiente (el Comité, si está en la sala); si no, otro rol autorizado.
  const decider = inOrg.find((person) => person.roleId === gateNow.pendingApproverRoleId) ?? inOrg.find((person) => deciderRoleIds.includes(person.roleId));
  const bystander = inOrg.find((person) => !deciderRoleIds.includes(person.roleId));
  const before = orgOf(stage.state, orgId).reliability;
  if (!decider) {
    await step(`${tag} hay en la sala alguien autorizado a decidir`, async () => check(false, `Ningún participante tiene un rol de ${JSON.stringify(deciderRoleIds)}`));
    return;
  }

  await step(`${tag} una decisión sin razón se rechaza: 400 REASON_REQUIRED`, async () => {
    const res = await decider.act("HITL_DECISION", PAYLOADS.hitl("APPROVE", "   "));
    expectError(res, 400, "REASON_REQUIRED");
  });

  await step(`${tag} quien no tiene autoridad no puede decidir: 403 y queda en la bitácora`, async () => {
    check(bystander, "No hay en la sala un rol sin autoridad con el que probar");
    const res = await bystander.act("HITL_DECISION", PAYLOADS.hitl("APPROVE", "Intento de aprobar sin autoridad"));
    expectError(res, 403, "RBAC_DENIED");
    check(orgOf(stage.state, orgId).gate.status === "BLOCKED_HITL_REQUIRED", "La compuerta cambió pese al rechazo");
    return bystander.label;
  });

  await step(`${tag} ${decider.label} aprueba con razón y todos lo ven`, async () => {
    const reason = `Prueba e2e: aprobado por gravedad clínica (${orgId})`;
    expectOk(await decider.act("HITL_DECISION", PAYLOADS.hitl("APPROVE", reason)));
    const states = await allSee(
      everyone,
      (state) =>
        orgOf(state, orgId).gate.status !== "BLOCKED_HITL_REQUIRED" &&
        orgOf(state, orgId).gate.outcome === "approved" &&
        state.decisions.some((decision) => decision.scope === "gate" && decision.reason === reason && decision.byRoleId === decider.roleId),
      "compuerta aprobada y decisión registrada con su razón",
    );
    await stage.waitFor((state) => hasAudit(state, "HITL_APPROVED", (event) => event.orgId === orgId), "evento HITL_APPROVED");
    return `compuerta ${orgOf(states[0], orgId).gate.status}`;
  });

  await step(`${tag} la confiabilidad no baja tras sellar y decidir, y la híbrida supera a la autónoma`, async () => {
    const after = orgOf(stage.state, orgId).reliability;
    check(after.hybrid > after.autonomous, `hybrid (${after.hybrid}) debía ser mayor que autonomous (${after.autonomous})`);
    check(Math.abs(after.autonomous - after.p ** after.n) < 1e-4, `autonomous debía ser p^n = ${after.p ** after.n} y es ${after.autonomous}`);
    check(after.current >= before.current, `current bajó de ${before.current} a ${after.current}`);
    check(after.currentMode === "hybrid" && after.current === after.hybrid, `Con la regla sellada debía aplicar el nivel híbrido; aplica "${after.currentMode}"`);
    check(after.current > unsealedReliability.current, `Sellar la regla debía subir la confiabilidad: ${unsealedReliability.current} → ${after.current}`);
    return `autónomo ${(after.autonomous * 100).toFixed(1)}% · actual ${(after.current * 100).toFixed(1)}%`;
  });
}

async function tickCheck(stage) {
  await step("mientras el contador corre llega un mensaje al menos cada segundo", async () => {
    check(stage.state.stakes.status === "BLEEDING", `El contador debía estar en BLEEDING y está en ${stage.state.stakes.status}`);
    const firstCount = stage.arrivals.length;
    const firstElapsed = stage.state.stakes.elapsedMs;
    const firstNow = stage.state.serverNowTs;
    // El servidor emite una vez por segundo. Por internet los mensajes llegan con
    // variación, así que se observa una ventana de 4,5 s y se tolera hasta 1,8 s
    // entre dos mensajes: más que eso ya es un pulso perdido.
    await sleep(4500);
    const received = stage.arrivals.slice(firstCount);
    check(received.length >= 3, `En 4,5 s llegaron ${received.length} mensajes; se esperaban al menos 3`);
    const gaps = received.slice(1).map((at, index) => at - received[index]);
    const worst = Math.max(...gaps);
    check(worst <= 1800, `Hubo ${worst.toFixed(0)} ms entre dos mensajes; el contrato pide uno por segundo`);
    check(stage.state.stakes.elapsedMs > firstElapsed && stage.state.serverNowTs > firstNow, "stakes.elapsedMs y serverNowTs debían avanzar con el reloj del servidor");
    return `${received.length} mensajes, mayor espera ${worst.toFixed(0)} ms`;
  });
}

async function actaCheck(roomId, everyone, expectedTypes) {
  const stage = everyone[0];
  let actaJson = null;
  await step("el acta en JSON trae la bitácora completa", async () => {
    const res = await request(baseUrl, "GET", `/api/rooms/${roomId}/acta?format=json`);
    check(res.status === 200 && res.data, `GET acta?format=json debía responder JSON: ${describeResponse(res)}`);
    actaJson = res;
    const log = res.data.auditLog ?? res.data.events ?? res.data.bitacora;
    check(Array.isArray(log), "El acta no trae la bitácora como lista (se buscó auditLog)");
    const types = new Set(log.map((event) => event.type));
    const missing = expectedTypes.filter((type) => !types.has(type));
    check(missing.length === 0, `Al acta le faltan eventos: ${missing.join(", ")}`);
    check(log.length >= stage.state.auditLog.length, `El acta trae ${log.length} eventos y la pantalla general muestra ${stage.state.auditLog.length}`);
    for (const decision of stage.state.decisions) {
      check(res.text.includes(decision.reason), `El acta no incluye la razón de la decisión: "${decision.reason}"`);
    }
    return `${log.length} eventos`;
  });
  let actaMd = null;
  await step("el acta en markdown se descarga y trae las razones de las decisiones", async () => {
    const res = await request(baseUrl, "GET", `/api/rooms/${roomId}/acta?format=md`);
    check(res.status === 200 && res.text.trim().length > 0, `GET acta?format=md debía responder texto: ${describeResponse(res)}`);
    check(res.data === null, "El acta en markdown no debe ser JSON");
    actaMd = res;
    for (const decision of stage.state.decisions) check(res.text.includes(decision.reason), `El acta no incluye la razón: "${decision.reason}"`);
    return `${res.text.length} caracteres`;
  });
  await step("el acta no revela ningún valor secreto", async () => {
    const problems = [];
    for (const [name, secret] of collectSecrets(everyone)) {
      if (secret.classification !== "secret" || !distinctive(secret.value)) continue;
      for (const [format, acta] of [["json", actaJson], ["md", actaMd]]) {
        if (acta?.text.includes(String(secret.value))) problems.push(`El acta (${format}) contiene ${name} = ${secret.value}`);
      }
    }
    for (const person of everyone) {
      if (person.token && [actaJson, actaMd].some((acta) => acta?.text.includes(person.token))) problems.push(`El acta contiene el token de ${person.label}`);
    }
    check(problems.length === 0, problems.join("\n"));
  });
}

// --- Recorrido 1: una organización ------------------------------------------------

async function singleOrgJourney() {
  title("single_org: una clínica, tres roles");
  let roomId;
  if (!(await step("crear sala single_org", async () => `sala ${(roomId = await createRoom("single_org"))}`))) return;

  const stage = new Participant(roomId, "pantalla general");
  const everyone = [stage];
  try {
    const opened = await step("la pantalla general abre su SSE sin token y recibe la vista stage", async () => {
      const state = await stage.listen();
      check(state.viewer === "stage", `viewer debía ser "stage" y es ${JSON.stringify(state.viewer)}`);
      check(state.mode === "single_org" && state.orgs.length === 1, `Se esperaba single_org con 1 organización; llegó ${state.mode} con ${state.orgs.length}`);
      check(state.scarcity === null && state.allocation === null, "single_org no debe traer recurso escaso ni asignación");
      return `${state.orgs[0].orgName}, ${state.orgs[0].roles.length} roles`;
    });
    if (!opened) return;

    const org = stage.state.orgs[0];
    const people = await seatEveryone(roomId, stage, org.roles.map((role) => ({ label: `${role.shortTag} (${role.id})`, orgId: org.orgId, roleId: role.id, committee: role.isQrOptional })));
    everyone.push(...people);
    if (people.length < 2) {
      await step("al menos dos participantes en la sala", async () => check(false, "No entraron suficientes participantes; se omite el resto del recorrido"));
      return;
    }

    await identityChecks(roomId, people);
    await fogChecks(everyone, people);
    const proposer = people.find((person) => person.roleId === org.authorityRule.proposerRoleId) ?? people[0];
    await breachCheck(everyone, proposer, org.orgId, "leer un campo ajeno dentro de la organización: 403 RBAC_DENIED y queda en la bitácora");
    await tickCheck(stage);
    await authorityFlow(everyone, people, org.orgId);

    await step("el contador pasa de BLEEDING a CONTAINED al cerrarse la decisión", async () => {
      const states = await allSee(everyone, (state) => state.stakes.status === "CONTAINED" && state.decisionSealedAt !== null, "stakes.status = CONTAINED");
      check(typeof states[0].stakes.timeToDecisionMs === "number", "stakes.timeToDecisionMs debía quedar fijado al cerrar");
      return `decisión en ${(states[0].stakes.timeToDecisionMs / 1000).toFixed(1)} s`;
    });

    await step("tras todo el recorrido, sigue sin haber fugas en ningún SSE", async () => assertNoLeaks(everyone));
    await actaCheck(roomId, everyone, ["ROLE_JOINED", "RBAC_DENIED", "CONFLICT_DETECTED", "RULE_SEALED", "GATE_BLOCKED", "HITL_APPROVED"]);
  } finally {
    for (const participant of everyone) participant.close();
    await discardRoom(roomId, everyone.find((participant) => !participant.isStage));
  }
}

// --- Recorrido 2: dos organizaciones y un recurso escaso ---------------------------

async function crossOrgJourney() {
  title("cross_org: dos hospitales, una cama, un Comité");
  let roomId;
  if (!(await step("crear sala cross_org", async () => `sala ${(roomId = await createRoom("cross_org"))}`))) return;

  const stage = new Participant(roomId, "pantalla general");
  const everyone = [stage];
  try {
    const opened = await step("la pantalla general abre su SSE y ve dos organizaciones y un recurso", async () => {
      const state = await stage.listen();
      check(state.viewer === "stage", `viewer debía ser "stage" y es ${JSON.stringify(state.viewer)}`);
      check(state.mode === "cross_org" && state.orgs.length >= 2, `Se esperaba cross_org con 2 organizaciones; llegó ${state.mode} con ${state.orgs.length}`);
      check(state.scarcity && state.scarcity.rule.resourceQuantity === 1, "Debía haber un recurso escaso con cantidad 1");
      check(state.scarcity.candidates.length >= 2, "Debía haber al menos dos candidatos");
      check(state.allocation !== null, "cross_org debe traer la vista de asignación");
      return `${state.orgs.map((org) => org.orgId).join(" y ")} compiten por "${state.scarcity.resource}"`;
    });
    if (!opened) return;

    const orgs = stage.state.orgs;
    const arbiterSeat = stage.state.scarcity.arbiter;
    // Entran el proponente y el aprobador de cada organización. El Comité entra después, por QR.
    const seats = orgs.flatMap((org) =>
      [org.authorityRule.proposerRoleId, org.authorityRule.approverRoleId].map((roleId) => ({
        label: `${org.orgId}/${org.roles.find((role) => role.id === roleId)?.shortTag ?? roleId}`,
        orgId: org.orgId,
        roleId,
      })),
    );
    const people = await seatEveryone(roomId, stage, seats);
    everyone.push(...people);
    if (people.length < seats.length) {
      await step("los cuatro participantes en la sala", async () => check(false, "No entraron todos los participantes; se omite el resto del recorrido"));
      return;
    }

    await identityChecks(roomId, people);
    await fogChecks(everyone, people);

    await step("ninguna organización recibió el costo de cobertura ni los campos reservados de la otra", async () => {
      const problems = [];
      for (const person of people) {
        for (const org of person.state.orgs.filter((item) => item.orgId !== person.orgId)) {
          const exposed = org.fields.filter((field) => field.classification !== "public" && field.redacted !== true);
          if (exposed.length) problems.push(`${person.label} ve de ${org.orgId}: ${exposed.map((field) => field.key).join(", ")}`);
        }
        for (const candidate of person.state.scarcity.candidates.filter((item) => item.orgId !== person.orgId)) {
          if (candidate.coverageCost?.redacted !== true) problems.push(`${person.label} ve el costo de cobertura de ${candidate.orgId}`);
        }
      }
      check(problems.length === 0, problems.join("\n"));
      const own = people.filter((person) => person.state.scarcity.candidates.some((candidate) => candidate.orgId === person.orgId && typeof candidate.coverageCost === "number"));
      check(own.length >= orgs.length, "Cada organización debía tener al menos un rol que sí ve su propio costo de cobertura");
    });

    const [orgA, orgB] = orgs;
    const readerB = people.find((person) => person.orgId === orgB.orgId && person.roleId === orgB.authorityRule.approverRoleId);
    const readerA = people.find((person) => person.orgId === orgA.orgId && person.roleId === orgA.authorityRule.proposerRoleId);
    await breachCheck(everyone, readerB, orgA.orgId, `${orgB.orgId} intenta leer un secreto de ${orgA.orgId}: 403 RBAC_DENIED entre organizaciones`);
    await breachCheck(everyone, readerA, orgA.orgId, `dentro de ${orgA.orgId}, un rol intenta leer el secreto de otro: 403 RBAC_DENIED`);

    await tickCheck(stage);
    for (const org of orgs) await authorityFlow(everyone, people, org.orgId);

    await step("cada organización presenta su candidato y todos ven el ranking", async () => {
      for (const candidate of stage.state.scarcity.candidates) {
        const presenter = people.find((person) => person.orgId === candidate.orgId && person.roleId === candidate.proposerRoleId);
        check(presenter, `No hay participante para presentar el caso ${candidate.caseId}`);
        expectOk(await presenter.act("SUBMIT_CANDIDATE", PAYLOADS.candidate(candidate.caseId)));
      }
      const states = await allSee(everyone, (state) => state.allocation.status === "PROPOSED" && state.allocation.ranking.length >= 2, "allocation.status = PROPOSED con ranking");
      const allocation = states[0].allocation;
      const ranking = allocation.ranking;
      check(ranking.every((item, index) => item.rank === index + 1), "El ranking debía venir ordenado por rank 1, 2, ...");
      const weights = states[0].scarcity.rule.weights;
      for (const item of ranking) {
        const candidate = states[0].scarcity.candidates.find((entry) => entry.caseId === item.caseId);
        const expected = weights.severity * candidate.clinicalSeverityScore + weights.timeCriticality * candidate.timeCriticality - weights.delayRisk * candidate.delayRiskScore;
        check(Math.abs(item.score - expected) < 1e-9, `El puntaje de ${item.caseId} debía ser ${expected.toFixed(4)} según la regla visible y es ${item.score}`);
      }
      const gap = Math.abs(ranking[0].score - ranking[1].score);
      check(allocation.tieBreakApplied === gap < allocation.tieEpsilon, `tieBreakApplied (${allocation.tieBreakApplied}) no coincide con la diferencia ${gap.toFixed(4)} y el epsilon ${allocation.tieEpsilon}`);
      if (allocation.tieBreakApplied && allocation.tieBreakRule === "worst_unmet_need") {
        check(ranking[0].unmetNeedScore >= ranking[1].unmetNeedScore, "Con desempate por equidad debía ganar quien tiene mayor necesidad sin cubrir");
      }
      check(allocation.winnerCaseId === ranking[0].caseId, "El ganador debía ser el primero del ranking");
      const signatures = new Set(states.map((state) => JSON.stringify(state.allocation.ranking)));
      check(signatures.size === 1, "No todos los participantes recibieron el mismo ranking");
      await stage.waitFor((state) => hasAudit(state, "CANDIDATE_SUBMITTED"), "evento CANDIDATE_SUBMITTED");
      return `gana ${ranking[0].patientLabel} (${ranking[0].orgId})${allocation.tieBreakApplied ? ", con desempate de equidad aplicado" : ""}`;
    });

    await step("presentar el candidato de otra organización se rechaza: 403", async () => {
      const candidate = stage.state.scarcity.candidates.find((item) => item.orgId === orgA.orgId);
      const res = await readerB.act("SUBMIT_CANDIDATE", PAYLOADS.candidate(candidate.caseId));
      check(res.status === 403, `Se esperaba 403 y llegó ${describeResponse(res)}`);
    });

    await step("sin la clave del QR, o con otra, nadie entra como Comité: 403 COMMITTEE_KEY_REQUIRED", async () => {
      for (const committeeKey of [undefined, "clave-inventada"]) {
        const intruder = new Participant(roomId, "intruso", arbiterSeat.orgId, arbiterSeat.roleId, committeeKey);
        expectError(await intruder.join(), 403, "COMMITTEE_KEY_REQUIRED");
      }
      check(stage.state.scarcity.arbiter.connected === false, "El puesto del Comité apareció ocupado pese al rechazo");
    });

    const committee = new Participant(roomId, `Comité (${arbiterSeat.orgId}/${arbiterSeat.roleId})`, arbiterSeat.orgId, arbiterSeat.roleId, hosts.get(roomId)?.committeeKey);
    const committeeIn = await step("el Comité entra (como por QR), aparece en todas las pantallas y no ve el costo de nadie", async () => {
      expectOk(await committee.join());
      const state = await committee.listen();
      check(sameViewer(state, committee), `El SSE del Comité vino proyectado para ${JSON.stringify(state.viewer)}`);
      everyone.push(committee);
      await allSee(everyone, (current) => current.scarcity.arbiter.connected === true, "scarcity.arbiter.connected = true");
      await stage.waitFor((current) => hasAudit(current, "QR_JOINED"), "evento QR_JOINED");
      const costs = state.scarcity.candidates.filter((candidate) => typeof candidate.coverageCost === "number");
      check(costs.length === 0, `El Comité recibió costos de cobertura: ${costs.map((candidate) => candidate.caseId).join(", ")}`);
      const visible = state.orgs.flatMap((org) => org.fields.filter((field) => field.classification !== "public" && field.redacted !== true).map((field) => `${org.orgId}.${field.key}`));
      check(visible.length === 0, `El Comité recibió campos reservados: ${visible.join(", ")}`);
    });

    await step("un hospital no puede sellar ni vetar la asignación: 403", async () => {
      expectError(await readerA.act("ALLOCATION_SEAL", PAYLOADS.allocationSeal("Intento de sellar sin ser Comité")), 403, "RBAC_DENIED");
      expectError(await readerB.act("COMMITTEE_VETO", PAYLOADS.committeeVeto("Intento de veto sin ser Comité")), 403, "RBAC_DENIED");
      check(stage.state.allocation.status === "PROPOSED" && stage.state.allocation.vetoedCaseIds.length === 0, "La asignación cambió pese al rechazo");
    });

    if (committeeIn) {
      await step("el Comité no puede vetar ni sellar sin dar una razón: 400 REASON_REQUIRED", async () => {
        expectError(await committee.act("COMMITTEE_VETO", PAYLOADS.committeeVeto("  ")), 400, "REASON_REQUIRED");
        expectError(await committee.act("ALLOCATION_SEAL", PAYLOADS.allocationSeal("")), 400, "REASON_REQUIRED");
        check(stage.state.allocation.status === "PROPOSED", "La asignación cambió pese al rechazo");
      });

      if (COMMITTEE === "VETO") {
        await step("el Comité veta al ganador propuesto con razón: el algoritmo reordena sin ese caso y todos lo ven", async () => {
          const vetoed = stage.state.allocation.winnerCaseId;
          const reason = "Prueba e2e: veto por falta de respaldo clínico del traslado";
          expectOk(await committee.act("COMMITTEE_VETO", PAYLOADS.committeeVeto(reason)));
          const states = await allSee(
            everyone,
            (state) => state.allocation.vetoedCaseIds.includes(vetoed) && state.allocation.committeeDecision?.decision === "VETO" && state.allocation.committeeDecision.reason === reason,
            `caso ${vetoed} vetado con su razón`,
          );
          const allocation = states[0].allocation;
          check(allocation.status !== "SEALED", "Una asignación vetada no puede quedar sellada");
          check(allocation.winnerCaseId !== vetoed, "El caso vetado sigue figurando como ganador");
          check(!allocation.ranking.some((item) => item.caseId === vetoed), "El caso vetado sigue en el ranking");
          check(states[0].stakes.status === "BLEEDING", "Con el recurso sin asignar el contador debe seguir en BLEEDING");
          await stage.waitFor((state) => hasAudit(state, "HITL_VETOED", (event) => event.orgId === committee.orgId), "evento HITL_VETOED del Comité");
          return `vetado ${vetoed}; ahora gana ${allocation.winnerCaseId}`;
        });
      }

      const sealReason = "Prueba e2e: el Comité confirma la asignación propuesta por la regla";
      await step("el Comité sella la asignación con razón: el recurso queda asignado y el contador se detiene", async () => {
        const before = stage.state.crossOrgReliability;
        const expectedWinner = stage.state.allocation.winnerCaseId;
        check(expectedWinner, "No hay ganador propuesto que sellar");
        expectOk(await committee.act("ALLOCATION_SEAL", PAYLOADS.allocationSeal(sealReason)));
        const states = await allSee(
          everyone,
          (state) => state.allocation.status === "SEALED" && state.allocationStatus === "SEALED" && state.stakes.status === "CONTAINED",
          "allocation.status = SEALED y stakes.status = CONTAINED",
        );
        const final = states[0];
        check(final.allocation.winnerCaseId === expectedWinner, `Se selló ${final.allocation.winnerCaseId} y el ganador propuesto era ${expectedWinner}`);
        check(final.allocation.winnerOrgId === final.scarcity.candidates.find((item) => item.caseId === expectedWinner)?.orgId, "winnerOrgId no corresponde al caso ganador");
        check(final.decisionSealedAt !== null && typeof final.stakes.timeToDecisionMs === "number", "decisionSealedAt y timeToDecisionMs debían quedar fijados");
        check(final.decisions.some((decision) => decision.scope === "allocation" && decision.decision === "APPROVE" && decision.reason === sealReason), "La aprobación del Comité debía quedar registrada con su razón");
        await stage.waitFor((state) => hasAudit(state, "ALLOCATION_SEALED") && hasAudit(state, "STAKES_CONTAINED"), "eventos ALLOCATION_SEALED y STAKES_CONTAINED");
        const after = final.crossOrgReliability;
        check(after && after.hybrid > after.autonomous, "crossOrgReliability.hybrid debía superar a autonomous");
        check(before.currentMode === "autonomous" && after.currentMode === "hybrid" && after.current > before.current, `Al sellar el Comité, la confiabilidad entre organizaciones debía subir del nivel autónomo al híbrido: ${before.current} (${before.currentMode}) → ${after.current} (${after.currentMode})`);
        return `${expectedWinner} para ${final.allocation.winnerOrgId}; confiabilidad ${(after.autonomous * 100).toFixed(1)}% autónoma, ${(after.current * 100).toFixed(1)}% actual`;
      });

      await step("con la decisión sellada ya no se puede vetar (409 DECISION_SEALED) y el contador no avanza", async () => {
        expectError(await committee.act("COMMITTEE_VETO", PAYLOADS.committeeVeto("Veto tardío")), 409, "DECISION_SEALED");
        const frozen = stage.state.stakes.elapsedMs;
        const winner = stage.state.allocation.winnerCaseId;
        await sleep(1500);
        check(stage.state.stakes.elapsedMs === frozen, `stakes.elapsedMs siguió avanzando (${frozen} → ${stage.state.stakes.elapsedMs})`);
        check(stage.state.allocation.winnerCaseId === winner && stage.state.allocation.status === "SEALED", "La asignación sellada cambió");
      });
    }

    await step("tras todo el recorrido, sigue sin haber fugas en ningún SSE", async () => assertNoLeaks(everyone));
    await actaCheck(roomId, everyone, [
      "ROLE_JOINED",
      "RBAC_DENIED",
      "CONFLICT_DETECTED",
      "RULE_SEALED",
      "GATE_BLOCKED",
      "HITL_APPROVED",
      "CANDIDATE_SUBMITTED",
      "QR_JOINED",
      ...(COMMITTEE === "VETO" ? ["HITL_VETOED"] : []),
      "ALLOCATION_SEALED",
      "STAKES_CONTAINED",
    ]);
  } finally {
    for (const participant of everyone) participant.close();
    await discardRoom(roomId);
  }
}

// --- Recorrido 3: otra organización y permisos que cambian en vivo -----------------

async function otherOrgJourney() {
  title("otra organización: semilla no clínica y un campo que se comparte y se vuelve a reservar");
  await step("crear una sala con un modo que no existe se rechaza: 400", async () => {
    const res = await request(baseUrl, "POST", "/api/rooms", { mode: "modo_inventado" });
    check(res.status === 400, `Se esperaba 400 y llegó ${describeResponse(res)}`);
  });

  let roomId;
  const created = await step("crear sala single_org con la semilla dist_tech", async () => {
    roomId = await createRoom("single_org", { seed: "dist_tech" });
    return `sala ${roomId}`;
  });
  if (!created) return;

  const stage = new Participant(roomId, "pantalla general");
  const everyone = [stage];
  try {
    const opened = await step("el mismo esqueleto sirve a una organización que no es de salud", async () => {
      const state = await stage.listen();
      check(state.orgs.length === 1 && state.orgs[0].orgId === "dist_tech", `Se esperaba la organización dist_tech y llegó ${state.orgs.map((org) => org.orgId).join(", ")}`);
      return `${state.orgs[0].orgName}: ${state.orgs[0].roles.map((role) => role.shortTag).join(", ")}`;
    });
    if (!opened) return;

    const org = stage.state.orgs[0];
    const rule = org.authorityRule;
    const people = await seatEveryone(roomId, stage, [rule.proposerRoleId, rule.approverRoleId].map((roleId) => ({ label: `${org.roles.find((role) => role.id === roleId)?.shortTag} (${roleId})`, orgId: org.orgId, roleId })));
    everyone.push(...people);
    if (people.length < 2) return;
    await fogChecks(everyone, people);

    const [first, second] = people;
    // Un campo secreto de `owner` que `reader` no ve.
    const pick = (owner, reader) => orgOf(reader.state, org.orgId).fields.find((field) => field.ownerRoleId === owner.roleId && field.redacted === true);
    const [owner, reader, field] = pick(first, second) ? [first, second, pick(first, second)] : [second, first, pick(second, first)];
    const found = await step("hay un campo reservado de un rol que el otro no ve", async () => {
      check(field, "Ningún rol tiene un campo reservado oculto para el otro");
      return `${field.key}, de ${owner.label}`;
    });
    if (!found) return;
    const isVisible = (state) => orgOf(state, org.orgId).fields.find((item) => item.key === field.key)?.redacted === false;

    await step("quien no es dueño del campo no puede cambiar su visibilidad: 403", async () => {
      expectError(await reader.act("TOGGLE_FIELD_SECRET", PAYLOADS.toggle(field.key)), 403, "RBAC_DENIED");
      check(!isVisible(reader.state), "El campo quedó visible pese al rechazo");
    });
    await step("el dueño comparte el campo y el otro rol recibe el valor en ese momento", async () => {
      expectOk(await owner.act("TOGGLE_FIELD_SECRET", PAYLOADS.toggle(field.key)));
      const state = await reader.waitFor(isVisible, `${field.key} visible para ${reader.label}`);
      const shared = orgOf(state, org.orgId).fields.find((item) => item.key === field.key);
      const mine = orgOf(owner.state, org.orgId).fields.find((item) => item.key === field.key);
      check(shared.value === mine.value, "El valor compartido no coincide con el del dueño");
    });
    await step("el dueño lo vuelve a reservar y deja de enviarse al otro rol", async () => {
      const seenBefore = reader.raw.length;
      expectOk(await owner.act("TOGGLE_FIELD_SECRET", PAYLOADS.toggle(field.key)));
      await reader.waitFor((state) => !isVisible(state), `${field.key} oculto otra vez para ${reader.label}`);
      const value = String(orgOf(owner.state, org.orgId).fields.find((item) => item.key === field.key).value);
      await sleep(1200);
      const later = reader.raw.slice(seenBefore).filter((raw) => !isVisible(JSON.parse(raw)));
      check(later.length > 0, "No llegaron mensajes posteriores que revisar");
      if (distinctive(value)) check(!later.some((raw) => raw.includes(value)), "El valor siguió viajando después de reservarlo");
      return `${later.length} mensajes posteriores sin el valor`;
    });

    await step("mutar es control de anfitrión (403 sin token), exige una frase (400) y no se permite en una sala que no existe (404)", async () => {
      expectError(await request(baseUrl, "POST", `/api/rooms/${roomId}/mutate`, { description: "Una ferretería de barrio" }), 403, "HOST_ONLY");
      expectError(await request(baseUrl, "POST", `/api/rooms/${roomId}/mutate`, { description: "   " }, hostHeaders(roomId)), 400, "BAD_REQUEST");
      expectError(await request(baseUrl, "POST", "/api/rooms/sala-que-no-existe/mutate", { description: "Una ferretería de barrio" }, hostHeaders(roomId)), 404, "ROOM_NOT_FOUND");
      // Las salas fijas no entregan controles en producción; si este servidor los entrega (desarrollo), no se dejan mutar.
      const claim = await request(baseUrl, "POST", "/api/rooms/demo/host");
      if (claim.status === 200) {
        expectError(await request(baseUrl, "POST", "/api/rooms/demo/mutate", { description: "Una ferretería" }, { "x-host-token": claim.data.hostToken }), 409, "FIXED_ROOM");
        return "salas fijas protegidas con 409 FIXED_ROOM";
      }
      check(claim.status === 403 && claim.data?.code === "HOST_ONLY", `Pedir los controles de "demo" sin clave debía dar 403 HOST_ONLY: ${describeResponse(claim)}`);
      return "este servidor no entrega los controles de las salas fijas";
    });

    if (WITH_LLM) {
      await step("mutar la organización con una frase: responde ok con su origen y nunca un 500", async () => {
        const res = await request(baseUrl, "POST", `/api/rooms/${roomId}/mutate`, { description: "Una cooperativa agrícola que reparte agua de riego entre parceleros" }, hostHeaders(roomId));
        check(res.status !== 500, `POST /mutate respondió 500: ${res.text.slice(0, 200)}`);
        check(res.status === 200 && res.data?.ok === true && ["llm", "fallback_seed"].includes(res.data.source) && typeof res.data.latencyMs === "number", `Debía responder { ok, source, latencyMs }: ${describeResponse(res)}`);
        await stage.waitFor((state) => hasAudit(state, "MUTATION"), "evento MUTATION", 90000);
        check(stage.state.orgs.length >= 1 && stage.state.orgs[0].roles.length >= 2, "Tras mutar, la sala debe seguir teniendo una organización válida");
        return `origen ${res.data.source}, ${res.data.latencyMs} ms, ahora "${stage.state.orgs[0].orgName}"`;
      });
    }
  } finally {
    for (const participant of everyone) participant.close();
    await discardRoom(roomId, everyone.find((participant) => !participant.isStage));
  }
}

// --- Recorrido 4: otro rubro, ensayado por el piloto automático -------------------------

async function scenarioJourney(scenario = "construccion") {
  title(`otro rubro: escenario "${scenario}" ensayado con el piloto automático`);
  let roomId;
  if (!(await step(`crear sala cross_org con el escenario ${scenario}`, async () => `sala ${(roomId = await createRoom("cross_org", { scenario }))}`))) return;

  const stage = new Participant(roomId, "pantalla general");
  const everyone = [stage];
  try {
    const opened = await step("el mismo esqueleto sirve a dos organizaciones que no son hospitales", async () => {
      const state = await stage.listen();
      check(state.mode === "cross_org" && state.scenarioId === scenario, `Se esperaba cross_org con escenario ${scenario}; llegó ${state.mode} / ${state.scenarioId}`);
      check(!state.orgs.some((org) => org.industry === "Salud"), `Ninguna organización debía ser de salud: ${state.orgs.map((org) => org.industry).join(", ")}`);
      check(state.stakes.livesAtRisk === 0, `En este rubro no hay vidas en riesgo y el contador dice ${state.stakes.livesAtRisk}`);
      return `${state.orgs.map((org) => org.orgName).join(" y ")} compiten por "${state.scarcity.resource}"`;
    });
    if (!opened) return;

    // Una persona toma el puesto de quien aprueba en la segunda organización: el piloto no lo toca.
    const second = stage.state.orgs[1];
    const people = await seatEveryone(roomId, stage, [{ label: `${second.orgId}/aprobador`, orgId: second.orgId, roleId: second.authorityRule.approverRoleId }]);
    everyone.push(...people);
    const [person] = people;

    await step("el ensayo automático es control de anfitrión: sin token 403 HOST_ONLY", async () => {
      expectError(await request(baseUrl, "POST", `/api/rooms/${roomId}/autopilot`, { stepMs: 300 }), 403, "HOST_ONLY");
    });

    const started = await step("el anfitrión lanza el ensayo: bots en los puestos libres, todas las pantallas lo ven en vivo", async () => {
      const res = await request(baseUrl, "POST", `/api/rooms/${roomId}/autopilot`, { stepMs: 300 }, hostHeaders(roomId));
      check(res.status === 200 && res.data?.running === true, `POST /autopilot debía responder { ok, running: true }: ${describeResponse(res)}`);
      check(!res.data.botSeats.some((seat) => person && seat.orgId === person.orgId && seat.roleId === person.roleId), "Un bot tomó el puesto que tiene una persona");
      await allSee(everyone, (state) => state.autopilot?.running === true, "autopilot.running = true");
      return `${res.data.steps} pasos, ${res.data.botSeats.length} bots`;
    });
    if (!started) return;

    await step("el ensayo llega al final: la asignación queda sellada y marcada como ensayo en la bitácora", async () => {
      const states = await allSee(everyone, (state) => state.autopilot?.running === false && state.allocation?.status === "SEALED", "autopilot terminado y asignación sellada", 30000);
      const state = states[0];
      check(hasAudit(state, "AUTOPILOT", (event) => event.detail.phase === "end"), "Falta el evento AUTOPILOT de fin");
      check(hasAudit(state, "AUTOPILOT", (event) => event.detail.outcome === "skipped"), "El paso de la persona debía saltarse");
      check(hasAudit(state, "ROLE_JOINED", (event) => event.detail.bot === true), "Las entradas de los bots debían ir marcadas como bot");
      check(!hasAudit(state, "AUTOPILOT", (event) => event.detail.outcome === "failed"), "Algún paso del ensayo falló");
      return `ganó ${state.allocation.winnerCaseId}${state.allocation.tieBreakApplied ? " por desempate de equidad" : ""}`;
    });

    await step("durante todo el ensayo, ningún dato reservado viajó hacia quien no debe verlo", async () => assertNoLeaks(everyone));
    await step("la pantalla general nunca recibió un costo de cobertura", async () => {
      const costs = stage.state.scarcity.candidates.filter((candidate) => typeof candidate.coverageCost === "number");
      check(costs.length === 0, `La pantalla general recibió costos: ${costs.map((candidate) => candidate.caseId).join(", ")}`);
    });
  } finally {
    for (const participant of everyone) participant.close();
    await discardRoom(roomId, everyone.find((participant) => !participant.isStage));
  }
}

// --- Recorrido 5: sala nueva desde una frase ------------------------------------------------

async function mutatedRoomJourney() {
  title("sala nueva desde una frase");
  await step("POST /api/rooms con description crea una sala NUEVA ya mutada, informa su origen y nunca da 500", async () => {
    const res = await request(baseUrl, "POST", "/api/rooms", { mode: "single_org", description: "Dos áreas de una empresa que se reparten un solo presupuesto de marketing" });
    check(res.status !== 500, `POST /api/rooms respondió 500: ${res.text.slice(0, 200)}`);
    check(res.status === 200 && typeof res.data?.roomId === "string", `Debía responder { roomId, ... }: ${describeResponse(res)}`);
    check(["llm", "fallback_seed"].includes(res.data.source) && typeof res.data.latencyMs === "number", `Debía informar source y latencyMs: ${describeResponse(res)}`);
    check(typeof res.data.hostToken === "string" && typeof res.data.committeeKey === "string", "La sala mutada también entrega sus controles");
    hosts.set(res.data.roomId, { hostToken: res.data.hostToken, committeeKey: res.data.committeeKey });
    check(res.data.latencyMs <= 20000, `El plazo del modelo es 15 s y tardó ${res.data.latencyMs} ms`);
    const viewer = new Participant(res.data.roomId, "pantalla de la sala mutada");
    try {
      const state = await viewer.listen();
      check(state.mode === "single_org" && state.orgs.length === 1 && state.orgs[0].roles.length >= 2, "La sala mutada debía traer una organización válida");
      check(state.orgs[0].orgId === res.data.orgId, `La sala trae ${state.orgs[0].orgId} y la respuesta decía ${res.data.orgId}`);
      check(state.connectedPlayers.length === 0, "Una sala nueva nace sin nadie adentro");
      check(hasAudit(state, "MUTATION", (event) => event.detail.source === res.data.source), "Falta el evento MUTATION con su origen");
    } finally {
      viewer.close();
    }
    await request(baseUrl, "DELETE", `/api/rooms/${res.data.roomId}`, undefined, hostHeaders(res.data.roomId));
    return `origen ${res.data.source}${res.data.seedId ? ` (semilla ${res.data.seedId})` : ""}, ${res.data.latencyMs} ms, "${res.data.orgName}"`;
  });
}

// --- Sorteo de silla (QR único) ------------------------------------------------------

/** Pide una silla al azar, como el celular que llega con el QR único de la sala. */
const drawSeat = (roomId, body = {}) => request(baseUrl, "POST", `/api/rooms/${roomId}/seat`, body);
const seatId = (seat) => `${seat?.orgId}/${seat?.roleId}`;

async function seatDrawJourney() {
  title("sorteo de silla: un solo QR para toda la sala");
  let roomId = null;
  const stage = { current: null };
  const people = [];
  try {
    roomId = await createRoom("cross_org");
    stage.current = new Participant(roomId, "pantalla general");
    await stage.current.listen();
    const arbiter = stage.current.state.scarcity.arbiter;
    const playable = stage.current.state.orgs.flatMap((org) => org.roles.filter((role) => !role.isQrOptional).map((role) => `${org.orgId}/${role.id}`));
    let first = null;

    await step("quien llega sin rol recibe una silla libre al azar, con su token, y su SSE viene filtrado para ese rol", async () => {
      const res = await drawSeat(roomId);
      expectOk(res);
      check(playable.includes(seatId(res.data.seat)) && typeof res.data.token === "string" && res.data.token.length >= 16, `El sorteo debía responder { seat, token } con una silla de la sala: ${describeResponse(res)}`);
      first = new Participant(roomId, "primera persona", res.data.seat.orgId, res.data.seat.roleId);
      first.token = res.data.token;
      people.push(first);
      const state = await first.listen();
      check(sameViewer(state, first), `El SSE debía venir proyectado para ${seatId(res.data.seat)} y vino para ${JSON.stringify(state.viewer)}`);
      check(state.orgs.some((org) => org.fields.some((field) => field.redacted)), "La silla sorteada debía recibir datos reservados sin valor, como cualquier rol");
      await stage.current.waitFor((current) => orgOf(current, first.orgId)?.roles.find((role) => role.id === first.roleId)?.connected === true, "la silla sorteada aparece conectada");
      return seatId(res.data.seat);
    });
    if (!first) return;

    await step("«sortear otro rol» entrega una silla distinta, libera la anterior y el token viejo deja de servir", async () => {
      const before = { orgId: first.orgId, roleId: first.roleId, token: first.token };
      const res = await drawSeat(roomId, { current: before });
      expectOk(res);
      check(seatId(res.data.seat) !== seatId(before) && playable.includes(seatId(res.data.seat)), `Debía tocar otra silla y tocó ${describeResponse(res)}`);
      const stale = await first.act("SEAL_RULE", PAYLOADS.seal(undefined));
      check(stale.status === 401, `El token de la silla que se soltó debía dar 401 y dio ${describeResponse(stale)}`);
      await stage.current.waitFor(
        (current) =>
          orgOf(current, before.orgId)?.roles.find((role) => role.id === before.roleId)?.connected === false &&
          orgOf(current, res.data.seat.orgId)?.roles.find((role) => role.id === res.data.seat.roleId)?.connected === true,
        "la silla anterior queda libre y la nueva conectada",
      );
      first.close();
      first.orgId = res.data.seat.orgId;
      first.roleId = res.data.seat.roleId;
      first.token = res.data.token;
      return `${seatId(before)} -> ${seatId(res.data.seat)}`;
    });

    await step("cada silla toca una sola vez; sin la clave del Comité, su puesto nunca sale", async () => {
      const taken = [seatId(first)];
      for (let i = 0; i < playable.length - 1; i++) {
        const res = await drawSeat(roomId);
        expectOk(res);
        taken.push(seatId(res.data.seat));
      }
      check(new Set(taken).size === taken.length, `Se repitió una silla: ${taken.join(", ")}`);
      check([...taken].sort().join() === [...playable].sort().join(), `Debían tocar exactamente las sillas de los roles (${playable.join(", ")}) y tocaron ${taken.join(", ")}`);
      check(!taken.includes(seatId(arbiter)), "El Comité salió en un sorteo sin su clave");
      return `${taken.length} sillas`;
    });

    await step("sin sillas libres responde 409 NO_FREE_SEAT, también al pedir «otro rol», y nadie pierde su silla", async () => {
      expectError(await drawSeat(roomId), 409, "NO_FREE_SEAT");
      expectError(await drawSeat(roomId, { committeeKey: "clave-inventada" }), 409, "NO_FREE_SEAT");
      expectError(await drawSeat(roomId, { current: { orgId: first.orgId, roleId: first.roleId, token: first.token } }), 409, "NO_FREE_SEAT");
      const still = await first.act("TEST_RBAC_BREACH", { targetOrgId: first.orgId, fieldKey: "no_existe" });
      check(still.status !== 401, `Tras el 409 la persona debía conservar su silla y su token: ${describeResponse(still)}`);
    });

    await step("con la clave de su QR, el Comité entra al sorteo y toma el único puesto que queda", async () => {
      const res = await drawSeat(roomId, { committeeKey: hosts.get(roomId).committeeKey });
      expectOk(res);
      check(seatId(res.data.seat) === seatId(arbiter), `Debía tocar el Comité (${seatId(arbiter)}) y tocó ${describeResponse(res)}`);
      await stage.current.waitFor((current) => current.scarcity?.arbiter.connected === true, "el Comité aparece conectado");
    });

    await step("un sorteo con forma inválida se rechaza (400) y en una sala que no existe responde 404", async () => {
      expectError(await drawSeat(roomId, { current: { orgId: "x" } }), 400, "BAD_REQUEST");
      expectError(await drawSeat("sala-que-no-existe"), 404, "ROOM_NOT_FOUND");
    });

    await step("el sorteo queda en el acta como silla asignada al azar", async () => {
      const acta = await request(baseUrl, "GET", `/api/rooms/${roomId}/acta`);
      check(acta.status === 200, `El acta debía responder 200: ${describeResponse(acta)}`);
      const drawn = acta.data.auditLog.filter((event) => (event.type === "ROLE_JOINED" || event.type === "QR_JOINED") && event.detail?.assigned === "random");
      check(drawn.length === playable.length + 2, `Se esperaban ${playable.length + 2} entradas por sorteo en la bitácora y hay ${drawn.length}`);
    });
  } finally {
    stage.current?.close();
    for (const person of people) person.close();
    await discardRoom(roomId);
  }
}

// --- Sala de demo: 3 personas, 3 toques ------------------------------------------------

async function demoJourney() {
  title("sala de demo: 3 personas y 3 toques, los roles administrativos son bots");
  let roomId = null;
  let stage = null;
  const people = [];
  try {
    roomId = await createRoom("cross_org", { demo: true });
    stage = new Participant(roomId, "pantalla general");
    const key = hosts.get(roomId).committeeKey;
    const roleOf = (state, orgId, roleId) => orgOf(state, orgId)?.roles.find((role) => role.id === roleId);

    await step("la sala dice que es de demo, el reloj marca 0 y no hay bots hasta que entra alguien", async () => {
      const state = await stage.listen();
      check(state.demo === true, `La vista debía traer demo: true y trajo ${JSON.stringify(state.demo)}`);
      check(state.stakes.elapsedMs === 0, `Sin nadie adentro el reloj debía marcar 0 y marcó ${state.stakes.elapsedMs} ms`);
      check(state.orgs.every((org) => org.roles.every((role) => role.bot !== true)), "No debía haber bots antes de que entre la primera persona");
    });

    const seats = [];
    await step("el sorteo reparte solo a quien presenta en cada organización; sin la clave del Comité, 409", async () => {
      for (let i = 0; i < 2; i++) {
        const res = await drawSeat(roomId);
        expectOk(res);
        seats.push({ ...res.data.seat, token: res.data.token });
      }
      const ids = seats.map(seatId);
      const presenters = stage.state.scarcity.candidates.map((candidate) => `${candidate.orgId}/${candidate.proposerRoleId}`);
      check([...ids].sort().join() === [...presenters].sort().join(), `Debían tocar ${presenters.join(", ")} y tocaron ${ids.join(", ")}`);
      expectError(await drawSeat(roomId), 409, "NO_FREE_SEAT");
    });

    await step("con la clave del QR, el Comité es el tercer asiento", async () => {
      const res = await drawSeat(roomId, { committeeKey: key });
      expectOk(res);
      const arbiter = stage.state.scarcity.arbiter;
      check(seatId(res.data.seat) === seatId(arbiter), `Debía tocar el Comité y tocó ${describeResponse(res)}`);
      seats.push({ ...res.data.seat, token: res.data.token });
    });

    for (const seat of seats) {
      const person = new Participant(roomId, seatId(seat), seat.orgId, seat.roleId);
      person.token = seat.token;
      await person.listen();
      people.push(person);
    }

    await step("al entrar la primera persona, los roles administrativos son bots y sellan el límite y firman solos", async () => {
      const bots = stage.state.orgs.map((org) => ({ orgId: org.orgId, roleId: org.authorityRule.approverRoleId }));
      await stage.waitFor((state) => bots.every((seat) => roleOf(state, seat.orgId, seat.roleId)?.bot === true && roleOf(state, seat.orgId, seat.roleId)?.connected === true), "los aprobadores aparecen como bots conectados", 10_000);
      await stage.waitFor((state) => state.orgs.every((org) => !org.conflict.hasConflict && org.gate.outcome === "approved"), "los bots sellan el límite y firman", 15_000);
      check(stage.state.stakes.elapsedMs > 0, "Con gente adentro el reloj debía avanzar");
      return `${bots.length} bots`;
    });

    let touches = 0;
    await step("cada hospital presenta a su paciente con un toque (sin pasar por el límite ni la firma)", async () => {
      for (const person of people.filter((entry) => entry.orgId !== stage.state.scarcity.arbiter.orgId)) {
        expectOk(await person.act("SUBMIT_CANDIDATE"));
        touches += 1;
      }
      await allSee([stage, ...people], (state) => state.allocation?.status === "PROPOSED", "los dos casos presentados y la asignación propuesta");
    });

    await step("el Comité aprueba con razón (un toque) y todas las pantallas ven el acta cerrada", async () => {
      const committee = people.find((person) => person.orgId === stage.state.scarcity.arbiter.orgId);
      expectOk(await committee.act("ALLOCATION_SEAL", PAYLOADS.allocationSeal("Mayor necesidad sin cubrir.")));
      touches += 1;
      await allSee([stage, ...people], (state) => state.allocation?.status === "SEALED" && state.stakes.status === "CONTAINED", "asignación sellada");
      const acta = await request(baseUrl, "GET", `/api/rooms/${roomId}/acta`);
      check(acta.status === 200 && acta.data.allocationStatus === "SEALED", `El acta debía quedar sellada: ${describeResponse(acta)}`);
      check(touches === 3, `La demo debía tomar 3 toques y tomó ${touches}`);
      return `${touches} toques`;
    });

    await step("«Nueva ronda»: el reinicio del anfitrión deja la sala de demo limpia, sin bots y con el reloj en 0", async () => {
      const res = await request(baseUrl, "DELETE", `/api/rooms/${roomId}`, undefined, hostHeaders(roomId));
      check(res.status === 200, `DELETE con x-host-token debía responder 200: ${describeResponse(res)}`);
      await stage.waitFor(
        (state) => state.demo === true && state.allocation?.status === "PENDING" && state.stakes.elapsedMs === 0 && state.orgs.every((org) => org.roles.every((role) => role.bot !== true)),
        "sala de demo limpia",
      );
      const again = await drawSeat(roomId);
      expectOk(again);
    });
  } finally {
    stage?.close();
    for (const person of people) person.close();
    await discardRoom(roomId);
  }
}

// --- Salas fijas -------------------------------------------------------------------

async function fixedRooms() {
  title("salas fijas");
  for (const [roomId, mode] of [["demo", "single_org"], ["demo-cross", "cross_org"], ["demo-construccion", "cross_org"], ["demo-logistica", "cross_org"]]) {
    await step(`la sala "${roomId}" existe sin crearla y es ${mode}`, async () => {
      const viewer = new Participant(roomId, `pantalla de ${roomId}`);
      try {
        const state = await viewer.listen();
        check(state.roomId === roomId && state.mode === mode, `Se esperaba ${roomId} en modo ${mode}; llegó ${state.roomId} en modo ${state.mode}`);
        check(state.viewer === "stage", "Sin token la vista debe ser stage");
      } finally {
        viewer.close();
      }
    });
  }
}

// --- Principal -----------------------------------------------------------------------

async function main() {
  console.log(`Prueba de punta a punta contra ${baseUrl}`);
  const ping = await request(baseUrl, "GET", "/api/ping").catch((error) => ({ status: 0, text: String(error?.cause?.code ?? error?.message ?? error) }));
  if (ping.status !== 200) {
    console.error(`El servidor no responde en ${baseUrl}/api/ping (${ping.status || ping.text}). ¿Está levantado?`);
    process.exit(2);
  }

  if (!ONLY) await fixedRooms();
  if (ONLY !== "cross") await singleOrgJourney();
  if (ONLY !== "single") await crossOrgJourney();
  if (!ONLY) await otherOrgJourney();
  if (!ONLY) await scenarioJourney("construccion");
  if (!ONLY) await seatDrawJourney();
  if (!ONLY) await demoJourney();
  if (!ONLY) await mutatedRoomJourney();

  console.log(`\nResultado: ${passed} pasos OK, ${failures.length} con FALLA.`);
  if (failures.length) {
    console.log("Fallas:");
    for (const failure of failures) console.log(`  - [${failure.section}] ${failure.name}${VERBOSE ? `\n      ${failure.message.replaceAll("\n", "\n      ")}` : ""}`);
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`Error inesperado: ${error?.stack ?? error}`);
  process.exit(1);
});
