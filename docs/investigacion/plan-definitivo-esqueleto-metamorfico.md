# Plan DEFINITIVO — Esqueleto Organizacional Metamórfico
## Coordinación Multiplayer de decisiones críticas (intra-org + inter-org)
### Platanus Hack 26 · Track 👥 Multiplayer
### Stack: Next.js 15 + TypeScript · IA 100% soberana en Dell Pro Max GB10 (NVIDIA DGX Spark, 128 GB) · Qwen local

---

## 0. Resumen ejecutivo

Un **sistema operativo organizacional multiplayer y metamórfico** que:
1. **Muta** a la medida de CUALQUIER organización (genoma JSON → "órganos LEGO" deterministas).
2. **Coordina decisiones críticas** entre personas + agentes emparejados por rol, con **RBAC real (Fog of War) aplicado en servidor**.
3. **Asigna un recurso crítico escaso entre organizaciones** con **asimetría de información** y **algoritmo determinista auditable**, arbitrado por un **Comité (QR) con veto y razón**.
4. Corre **100% local** en el GB10 (`0 bytes a la nube`) y **sobrevive a la caída de red** gracias al motor determinista.

**El "wow" es la mutabilidad. El corazón es el multiplayer. La demo es un caso con stake humano. El impacto es un recurso que deja de esperar.**

**Scorecard objetivo (rúbrica: Orig 15 · Amb 20 · Ejec 20 · Téc 25 · Imp 20):**

| Pilar (peso) | Suelo (1 clínica) | Con capa inter-org |
|---|---|---|
| Originalidad (15) | 8.5 | **9.0** |
| Ambición (20) | 8.0 | **9.5** |
| Ejecución (20) | 7.5 | **8.0** |
| Aspecto técnico (25) | 8.5 | **9.0** |
| Impacto (20) | 8.0 | **9.5** |
| **Total ponderado** | **8.10** | **≈ 9.00** |

> **Regla de oro:** el **9 depende de que la capa inter-org estabilice**. Si no, la **regla de corte** regresa al suelo (1 clínica, 3 roles) = **8.10 sólido**. Nunca presentamos algo que no corra.

---

## 1. Principios que no se negocian

- **La mutabilidad es real:** el LLM **solo genera un Genoma JSON validado con Zod**; **nunca** genera HTML/JSX. La **estructura** (roles, jerarquía, compuertas, RBAC, p^n) es **código determinista**; solo el **contenido** (títulos, etiquetas, valores, persona de agente) viene del LLM.
- **Anti-Simulations:** los agentes **nunca** mutan el esqueleto solos. Toda mutación, conflicto, asignación, veto y cambio de `p^n` es **disparado por un humano** y cambia en el mismo segundo lo que ve el otro.
- **RBAC de verdad (no teatro):** el dato oculto **no viaja** por la red; se filtra **en servidor** por `orgId` + `roleId`.
- **Demo con stake:** empieza y termina con **2+ personas** decidiendo sobre algo que **cuesta** (vida / dinero / tiempo).
- **Soberanía:** LLM solo por `localhost` vía VPN al GB10; `bytesSentToCloud: 0` visible.

---

## 2. Arquitectura de datos (Zod) — contracto completo

> Todo lo que produce Qwen pasa por `safeParse`. Nada sin validar llega a la UI ni al prompt de agente.

### 2.1 Campos con visibilidad (Fog of War)
```ts
import { z } from "zod";

export const RoleVisibilityFieldSchema = z.object({
  key: z.string(),                      // "net_margin_pct" | "coverage_cost" | "triage_criticality"
  label: z.string(),                    // "Margen Neto Real (%)" | "Costo de cobertura"
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  ownerOrgId: z.string(),               // org dueña del dato (cross-org)
  ownerRoleId: z.string(),              // rol dueño dentro de la org
  visibleToOrgIds: z.array(z.string()), // RBAC CROSS-ORG: solo estas orgs lo reciben
  visibleToRoleIds: z.array(z.string()),// RBAC INTRA-ORG: solo estos roles
  classification: z.enum(["public", "restricted", "secret"]),
});
```

### 2.2 Regla de autoridad (compuerta determinista)
```ts
export const AuthorityRuleSchema = z.object({
  id: z.string(),
  metricKey: z.string(),                // "discount_pct" | "transfer_coverage_pct"
  metricLabel: z.string(),
  unit: z.string(),                     // "%", "USD", "horas"
  min: z.number(),
  max: z.number(),
  proposerRoleId: z.string(),
  proposerLimit: z.number(),            // slider del proponente
  approverRoleId: z.string(),
  approverLimit: z.number(),            // slider del aprobador
  sealedThreshold: z.number().nullable(), // null mientras haya choque sin resolver
  gateMode: z.enum(["deterministic_hitl", "agent_autonomous"]),
});
```

### 2.3 Definición de rol
```ts
export const RoleDefinitionSchema = z.object({
  id: z.enum(["role_a", "role_b", "role_c"]),
  orgId: z.string(),                    // de qué org es el rol
  title: z.string(),                    // "Jefatura de Urgencias"
  shortTag: z.string(),                 // "URGENCIAS"
  accentColor: z.enum(["emerald", "amber", "violet"]),
  agentName: z.string(),                // "Agente Triaje"
  agentPersona: z.string(),             // acotada al rol + RBAC
  objective: z.string(),                // incentivo (crea tensión con el otro rol)
  painPoint: z.string(),                // qué se coordina mal hoy por WhatsApp/Excel
  reliabilityP: z.number().min(0.7).max(0.999),
  isQrOptional: z.boolean().default(false), // true para role_c (Comité QR)
});
```

### 2.4 Caso vivo (stake)
```ts
export const LiveCaseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  triggeredMetricKey: z.string(),
  proposedValue: z.number(),            // cruza umbral → dispara compuerta
  stepCountN: z.number().int().min(3).max(15), // n para p^n
  stakesLabel: z.string(),              // "$2.4M CLP · 1 vida · cierre 18:00"
});
```

### 2.5 Genoma de organización
```ts
export const OrgGenomeSchema = z.object({
  orgId: z.string(),
  orgName: z.string(),
  industry: z.string(),
  orgStyle: z.string(),
  roles: z.array(RoleDefinitionSchema).min(2).max(3),
  fields: z.array(RoleVisibilityFieldSchema).min(4).max(8),
  authorityRule: AuthorityRuleSchema,
  liveCase: LiveCaseSchema,
});
```

### 2.6 Recurso escaso compartido (CAPA inter-org)
```ts
export const OrgCandidateSchema = z.object({
  orgId: z.string(),
  caseId: z.string(),
  patientLabel: z.string(),             // "Paciente A" (des-identificado)
  clinicalSeverityScore: z.number().min(0).max(1),
  timeCriticality: z.number().min(0).max(1),
  delayRiskScore: z.number().min(0).max(1),
  coverageCost: z.number(),              // SECRETO de la org
  coverageCostVisibleToOrgs: z.array(z.string()), // SOLO su org
  proposerRoleId: z.string(),
});

export const AllocationRuleSchema = z.object({
  id: z.string(),
  resourceLabel: z.string(),            // "Cama/derivacion de referencia #1"
  resourceQuantity: z.literal(1),       // ESCASO
  weights: z.object({                    // determinista + auditable (NO LLM)
    severity: z.number(),
    timeCriticality: z.number(),
    delayRisk: z.number(),
  }),
  equityTieBreak: z.enum(["worst_unmet_need", "coverage_gap", "geographic"]),
  committeeVeto: z.literal(true),
});

export const SharedScarcitySchema = z.object({
  resource: z.string(),
  rule: AllocationRuleSchema,
  candidates: z.array(OrgCandidateSchema).min(2).max(4),
  deadlineLabel: z.string(),
  stakesLabel: z.string(),              // "1 recurso · 2 orgs · N vidas en riesgo"
});
```

### 2.7 Estado de sala + audit trail
```ts
export const AuditEventSchema = z.object({
  ts: z.number(),                       // server-clock (ms)
  type: z.enum(["MUTATION","CONFLICT_DETECTED","RULE_SEALED","RBAC_DENIED",
                "GATE_BLOCKED","HITL_APPROVED","HITL_VETOED","COUNTER_PROPOSED",
                "QR_JOINED","ALLOCATION_PROPOSED","ALLOCATION_SEALED","STAKES_CONTAINED"]),
  orgId: z.string().optional(),
  roleId: z.string().optional(),
  detail: z.record(z.unknown()),
});

export const RoomStateSchema = z.object({
  roomId: z.string(),
  mode: z.enum(["single_org", "cross_org"]),
  orgGenomes: z.array(OrgGenomeSchema),
  scarcity: SharedScarcitySchema.nullable(),
  connectedPlayers: z.array(z.object({ orgId: z.string(), roleId: z.string(), heartbeatMs: z.number() })),
  gateStatus: z.enum(["OPEN","BLOCKED_HITL_REQUIRED","AUTO_EXECUTED_UNSAFE","SEALED"]),
  allocationStatus: z.enum(["PENDING","PROPOSED","SEALED"]).nullable(),
  auditLog: z.array(AuditEventSchema),
  telemetry: z.object({
    modelName: z.string(), endpointHost: z.string(), bytesSentToCloud: z.literal(0),
    queueDepth: z.number(), lastLatencyMs: z.number(), tokensPerSec: z.number(),
  }),
  caseOpenedAt: z.number(),
  decisionSealedAt: z.number().nullable(),
});
```

### 2.8 Semillas pre-validadas (fallback + arranque 1-clic)
```jsonc
// SEMILLA 1 — SUELO (1 clínica) — hero por defecto
{
  "orgId": "clínica_andes",
  "orgName": "Clínica de Alta Complejidad Andes",
  "industry": "Salud",
  "orgStyle": "Jerarquica asistencial con control de cobertura",
  "roles": [
    { "id":"role_a","orgId":"clínica_andes","title":"Jefatura de Urgencias","shortTag":"URGENCIAS",
      "accentColor":"emerald","agentName":"Agente Triaje",
      "agentPersona":"Prioriza por gravedad y propone accion clinica. Sin acceso a costo/cobertura.",
      "objective":"Cubrir al paciente ANTES de 18:00.","painPoint":"Se pierde tiempo pidiendo permiso de costo por WhatsApp.",
      "reliabilityP":0.92,"isQrOptional":false },
    { "id":"role_b","orgId":"clínica_andes","title":"Direccion Administrativa","shortTag":"GESTION",
      "accentColor":"amber","agentName":"Agente Cobertura",
      "agentPersona":"Cruza costo/contrato. PROTEGE el secreto financiero.",
      "objective":"No exceder cupo sin firma del Comite.","painPoint":"Bloquea a ultima hora sin ver la gravedad.",
      "reliabilityP":0.92,"isQrOptional":false },
    { "id":"role_c","orgId":"clínica_andes","title":"Comite Etico / Dir. Medica","shortTag":"ETICO",
      "accentColor":"violet","agentName":"Agente Auditoria Etica",
      "agentPersona":"Veta o aprueba decisiones que cruzan el umbral, con razon auditable.",
      "objective":"Decision etica + financiera, auditada.","painPoint":"Sin visibilidad real-time de la decision.",
      "reliabilityP":0.95,"isQrOptional":true }
  ],
  "fields": [
    { "key":"triage_criticality","label":"Gravedad clinica","value":"18/40","unit":"pts",
      "ownerOrgId":"clínica_andes","ownerRoleId":"role_a","visibleToOrgIds":["clínica_andes"],
      "visibleToRoleIds":["role_a"],"classification":"secret" },
    { "key":"icu_beds_available","label":"Camas UCI disponibles","value":"1","unit":"cama",
      "ownerOrgId":"clínica_andes","ownerRoleId":"role_a","visibleToOrgIds":["clínica_andes"],
      "visibleToRoleIds":["role_a","role_b","role_c"],"classification":"restricted" },
    { "key":"coverage_cost","label":"Costo de cobertura UCI","value":"2400000","unit":"CLP",
      "ownerOrgId":"clínica_andes","ownerRoleId":"role_b","visibleToOrgIds":["clínica_andes"],
      "visibleToRoleIds":["role_b"],"classification":"secret" },
    { "key":"insurance_contract_cap","label":"Tope de contrato","value":"3100000","unit":"CLP",
      "ownerOrgId":"clínica_andes","ownerRoleId":"role_b","visibleToOrgIds":["clínica_andes"],
      "visibleToRoleIds":["role_b","role_c"],"classification":"restricted" },
    { "key":"deadline_window","label":"Ventana de cierre","value":"18:00","unit":"hoy",
      "ownerOrgId":"clínica_andes","ownerRoleId":"role_b","visibleToOrgIds":["clínica_andes"],
      "visibleToRoleIds":["role_a","role_b","role_c"],"classification":"public" }
  ],
  "authorityRule": {
    "id":"rule_transfer_icu","metricKey":"transfer_coverage_pct","metricLabel":"Cobertura sin firma del Comite",
    "unit":"%","min":0,"max":100,"proposerRoleId":"role_a","proposerLimit":100,
    "approverRoleId":"role_b","approverLimit":60,"sealedThreshold":null,"gateMode":"deterministic_hitl"
  },
  "liveCase": {
    "title":"Paciente critico: cama UCI + derivacion","summary":"Urgencias quiere autorizar YA; Gestion exige firma si supera el umbral.",
    "triggeredMetricKey":"transfer_coverage_pct","proposedValue":82,"stepCountN":10,
    "stakesLabel":"1 vida en riesgo · $2.4M CLP de cobertura · cierre 18:00"
  }
}
```
```jsonc
// SEMILLA 2 — CAPA inter-org (2 orgs + 1 recurso escaso)
{
  "resource": "Cama de referencia UCI (derivacion)",
  "rule": {
    "id":"alloc_ref_icu","resourceLabel":"Cama/derivacion de referencia #1","resourceQuantity":1,
    "weights":{"severity":0.5,"timeCriticality":0.3,"delayRisk":0.2},
    "equityTieBreak":"worst_unmet_need","committeeVeto":true
  },
  "candidates": [
    { "orgId":"clínica_andes","caseId":"A1","patientLabel":"Paciente A",
      "clinicalSeverityScore":0.9,"timeCriticality":0.8,"delayRiskScore":0.85,
      "coverageCost":2400000,"coverageCostVisibleToOrgs":["clínica_andes"],"proposerRoleId":"role_a" },
    { "orgId":"hospital_rural","caseId":"B1","patientLabel":"Paciente B",
      "clinicalSeverityScore":0.8,"timeCriticality":0.9,"delayRiskScore":0.7,
      "coverageCost":1600000,"coverageCostVisibleToOrgs":["hospital_rural"],"proposerRoleId":"role_a" }
  ],
  "deadlineLabel":"Ventana de derivacion 18:00 (hoy)",
  "stakesLabel":"1 recurso · 2 organizaciones · 2 vidas en riesgo · $4.0M CLP en juego"
}
```
```jsonc
// SEMILLA 3 — Distribuidora B2B (suelo alternativo, no-clínico)
{ "orgId":"dist_tech","orgName":"Distribuidora Tech B2B","roles":["Comercial","Finanzas","Directorio"],
  "conflict":"descuento max autonomo vs margen neto secreto","resource":"stock compartido",
  "stakesLabel":"$X en margen · 1 pedido urgente" }
```
> **Nota de datos:** todas las cifras de stake son **del caso** (parten de la semilla, ajustables). **No** son estadísticas de mercado. Si se cita algún dato externo, etiquetarlo como *"asunción de ejemplo"*.

---

## 3. Motor determinista (columna vertebral, 0 ms, sin LLM)

Archivo: `src/lib/engine/deterministic.ts` — 100% TypeScript, reproducible, testeado.

| Función | Comportamiento (evidencia) |
|---|---|
| `detectRuleConflict(rule)` | `hasConflict = proposerLimit > approverLimit && sealedThreshold === null` + delta exacto + mensaje para arista roja. |
| `evaluateGate(genome, proposedValue)` | cruza umbral y `gateMode==="deterministic_hitl"` → `BLOCKED_HITL_REQUIRED` (rojo) al `approverRoleId`; `agent_autonomous` → `AUTO_EXECUTED_UNSAFE` (penaliza p^n). |
| `computeReliabilityPn(genome)` | autónomo: `p^n` (ej. `0.92^10 ≈ 43%`); híbrido (compuerta + HITL + Comité): salta a ≈96%, **fórmula auditable**. |
| `computeCrossOrgReliabilityPn(graph)` | mismo en la **cadena cross-org** (más pasos → más riesgo autónomo → mayor recuperación con HITL). |
| `computeTriageScore(candidate, weights)` | `S = w_sev·sev + w_time·time − w_delay·delayRisk`. |
| `resolveAllocation(scarcity, scores)` | asigna al mayor `S`; si `|S_a − S_b| < ε` → **`equityTieBreak`** (peor necesidad sin cubrir). **Regla auditable.** |
| `projectStateForOrgAndRole(state, orgId, roleId)` | **RBAC doble**: elimina `value` de campos cuyo `visibleToOrgIds`/`visibleToRoleIds` no incluyen al viewer → `{ redacted:true, reason:"RBAC_SERVER_FILTERED" }`. **El dato no viaja.** |
| `computeSharedStakesCounter(state, nowTs)` | `nowTs` = **reloj de servidor**. `BLEEDING` (pacientes esperando) → `CONTAINED` al `ALLOCATION_SEALED`. Proyecta: vidas en riesgo / valor en juego / ventana restante. **0 ms.** |
| `attemptProtectedRead(state, requesterOrgId, roleId, fieldKey)` | registra **`403 RBAC_DENIED`** (timestamp + org + rol + regla) → `auditLog`. |
| `recordCommitteeDecision(decision, reason)` | veto/aprobación con **razón obligatoria** → `auditLog` + `Acta`. |
| `buildAuditActa(roomState)` | genera `acta.json`/`acta.md` con el `auditLog` completo (exportable). |

> **Responde al juez técnico:** "¿es trivial?" → **RBAC entre organizaciones + algoritmo de asignación determinista con tie-break de equidad + p^n en grafo cross-org + veto con razón auditable NO es un prompt.**

---

## 4. Gateway soberano para Qwen (GB10)

Archivo: `src/lib/qwen-client.ts`
- **Doble modo:** `QWEN_API_MODE=openai` (`/v1/chat/completions`) o `ollama` (`/api/chat`).
- **Cola estricta `LLMQueue`:** `QWEN_MAX_CONCURRENT=1` (máx 2). Mide y publica en vivo: `status`, `queueDepth`, `lastLatencyMs`, `tokensPerSec`, `modelName`, `endpointHost` (`localhost→GB10 128GB`), `bytesSentToCloud:0`.
- **Control de thinking:** en llamadas rápidas (genoma + turnos de agente) → **thinking OFF** (`enable_thinking:false` / `think:false`) y limpia bloques `<think>` antes de parsear JSON. `max_tokens`: 900 genoma / 140 agente. Thinking **ON** solo en botón explícito *"Auditoría Profunda"*.
  - *Nombres exactos del toggle y del `model` ID: **NO VERIFICADO** — validar contra el runtime Ollama/GB10 antes de bloquear.*
- **Solo 1 llamada LLM es "héroe"** (la propuesta de un agente). Choque/contador/RBAC/p^n/asignación = **deterministas a 0 ms**.
- **Funciones:**
  1. `mutateGenomeFromPrompt(desc) → { genome, source:"qwen_gb10"|"fallback_seed", latencyMs }` — 1 frase → `OrgGenome` validado; si falla → **reparación o fallback a semilla** (nunca error 500).
  2. `runRoleAgentTurn(sanitizedView, ctx) → { proposalText, suggestedValue, attemptedFieldRead, latencyMs }` — el agente usa **solo** `sanitizedView` (prueba de que hereda el RBAC).

---

## 5. Estado multiplayer + API (SSE por org/rol)

**Store:** `src/lib/store/rooms.ts` — `Map<roomId, RoomState>` + `EventEmitter` para SSE instantáneo. Snapshot a disco JSON opcional (sobrevive reinicios).

> **Arquitectura de tiempo real:** estado en memoria en el servidor Next.js; **proyección RBAC distinta por cada `orgId`/`roleId`** vía SSE. Inspeccionar el Network tab de la org 1: los campos privados de la org 2 **nunca viajaron**.

**Rutas:**
- `POST /api/rooms` — crea sala (semilla o frase libre; modo `single_org` | `cross_org`).
- `POST /api/rooms/[id]/mutate` — dispara **mutación** vía Qwen (o semilla) + broadcast inmediato.
- `GET /api/rooms/[id]/events?orgId=..&roleId=..|stage` — **SSE** con estado **ya proyectado por RBAC** + `telemetry` del GB10 + `stakes_tick` (cada ~1 s).
- `POST /api/rooms/[id]/action` — **única puerta mutadora** (validada por el motor):
  - `JOIN_ROLE` (humano en `role_a/b`; `role_c` por QR → muta el grafo + puede vetar).
  - `UPDATE_AUTHORITY_SLIDER` → detecta choque a 0 ms + actualiza `p^n`.
  - `TOGGLE_FIELD_SECRET` → re-proyecta RBAC al instante.
  - `SEAL_RULE` → consensus de la compuerta (`deterministic_hitl` vs `agent_autonomous`).
  - `RUN_ROLE_AGENT` → propuesta bajo RBAC; si cruza umbral → compuerta roja.
  - `TEST_RBAC_BREACH` → la demo del **`403`** intra- y cross-org.
  - `HITL_DECISION` (`APPROVE|VETO|COUNTER_PROPOSE`) → actualiza caso/compuerta/`p^n`.
  - `SUBMIT_CANDIDATE` / `ALLOCATION_SEAL` (cross-org) → `resolveAllocation` + `STAKES_CONTAINED`.
  - `COMMITTEE_VETO` (con **razón**) → `auditLog` + `Acta`.

---

## 6. Órganos de UI ("LEGO" deterministas e indestructibles)

| # | Órgano | Función en la demo |
|---|---|---|
| 1 | `LivingGraphOrgan` (cross-org) | nodos de roles + agentes emparejados + **Comité (QR)** + **recurso escaso al centro** + arista de conflicto roja + medidor `p^n` (autónomo vs híbrido) |
| 2 | `DynamicCaseCardOrgan` | caso de cada org (Paciente A/B) + barra `proposedValue` vs compuerta |
| 3 | `FogOfWarPanelOrgan` | datos autorizados en claro + `███ [org]_RBAC_DENIED` + botón "Intentar lectura con mi Agente" → dispara `403` real |
| 4 | `AllocationConflictOrgan` | sliders por rol + banner **Choque** + consenso 1-clic + alternar Determinista/Autónomo (cae `p^n` al instante) |
| 5 | `RoleAgentPanelOrgan` | agente del rol + permisos heredados + propuesta en vivo + **telemetría GB10** (`0 B cloud · ms · cola`) |
| 6 | `SharedStakesCounterOrgan` | **contador compartido** (pacientes esperando) `BLEEDING→CONTAINED` + "latido" (motion) que se calma al asignar |
| 7 | **`AllocationBoardOrgan`** | **rank cross-org** + **tie-break de equidad** + **veto del Comité (razón)** + **Acta exportable** |

**Regla de recorte:** 1, 3, 6, 7 = núcleo. 2, 4, 5 fuertes. **El contador (6) puede plegarse en (1)** si falta tiempo (no es bloqueante).

**Rutas de app:**
- `/` — entrada + disparador de mutación (1 frase + semillas + "Modo Escenario").
- `/room/[id]` — estación de jugador (org + rol), 5/6 órganos filtrados por RBAC.
- `/stage/[id]` — **vista de demo**: split de las orgs + grafo + `p^n` + contador + **QR del Comité** + telemetría GB10 + Acta.

---

## 7. Características técnicas OBLIGATORIAS (checklist de verificación)

- [ ] **RBAC doble (cross-org + intra-org) server-side:** `value`/`coverageCost` de una org **no viaja** al HTTP de la otra (DevTools → Network).
- [ ] **`403 RBAC_DENIED` auditable** intra- y cross-org (ts + org + rol + regla) en **consola de auditoría**.
- [ ] **Algoritmo de asignación determinista** reproducible + **tie-break de equidad** visible.
- [ ] **`p^n`** intra- y cross-org que sube al sellar + HITL + veto.
- [ ] **`computeSharedStakesCounter`** `BLEEDING→CONTAINED`, 0 ms, reloj de servidor.
- [ ] **Comité (QR) con veto + razón obligatoria** → `auditLog`.
- [ ] **Zod + fallback** (genomas + `SharedScarcity`); fallo → semilla, sin error 500.
- [ ] **Soberanía GB10** (`bytesSentToCloud:0`) + **fallo de VPN = escena de resiliencia** (el motor sigue asignando).
- [ ] **Concurrencia** `maxConcurrent=1`; **1 sola llamada LLM "héroe"**.
- [ ] **Latencia** (a PROBAR con `stress:gb10`): mutación < 6 s, turno de agente < 3 s. **No prometer cifras sin benchmark.**
- [ ] **QR del Comité MUTA el grafo** (nodo + veto) → no es espectador (blinda "no califica: compartir link").
- [ ] **Disclaimer** médico visible: *"Demostración simulada de coordinación organizacional; no constituye diagnóstico ni uso real de datos de pacientes."*
- [ ] **Acta de decisión auditada** exportable (JSON/MD).

---

## 8. Paso a paso — 36 horas (SUELO + CAPA)

| Bloque | Horas | Hito DEMOSTRABLE | Alcance |
|---|---|---|---|
| **B1** Cimientos | 0–5 h | Next 15 + Zod (genoma + `SharedScarcity`) + semilla héroe + `qwen-client` + `stress:gb10` corriendo | Suelo |
| **B2** Motor determinista | 5–12 h | RBAC (intra+cross-org), `403`, `computeTriageScore`, `resolveAllocation`, `p^n`, `StakesCounter` + **tests en verde** | Suelo |
| **B3** Órganos núcleo + 2 orgs | 12–20 h | 2 orgs en SSE; **asignación cross-org** + `403` cross-org + contador compartido | Suelo→Capa |
| **B4** Comité QR + Board + Acta | 20–28 h | QR del Comité (veto+razón) + `AllocationBoardOrgan` + **Acta auditada** + telemetría + fallback | Capa |
| **B5** Stress + ensayo | 28–36 h | **Caída de VPN** (sigue asignando) + **5 ensayos cronometrados** + 3 orgs libres mutadas sin error | Ambos |

**Ruta crítica (si falla, la demo muere):** B1 (qwen+cola) → B2 (RBAC + asignación) → B3 (2 orgs sincronizadas). El **Comité/Board/Acta (B4)** es la capa de Ambición: si no estabiliza → **regreso al suelo (1 clínica) = 8.10**.

**Reglas de corte ("si a la hora X no existe Y, se elimina Z"):**
1. **h20**: no hay 2 orgs con RBAC cross-org + `403` real → **elimino la 2.ª org** (suelo: 1 clínica, 3 roles).
2. **h26**: no hay `resolveAllocation` + tie-break reproducible → **asignación por 1 métrica** (solo `severity`) con regla visible.
3. **h28**: no hay QR del Comité → el **Comité lo opera un humano del equipo** (se conserva multiplayer+veto).
4. **h30**: contador inestable → se **pliega** en `LivingGraphOrgan`.
5. **h34**: no hay 2 demos exitivas seguidas → **congelar** y repetir solo la versión mínima (2 orgs, 1 recurso, 1 `403`, 1 veto, contador plegado).

---

## 9. Guion de DEMO — 3:00 (inter-org, 2+ personas en vivo)

- **0:00–0:08** *Gancho:* "Hay 1 cama de referencia. 2 hospitales la necesitan. Y el que decide NO tiene el dato del otro."
- **0:08–0:22** *Mutabilidad (Originalidad):* "Nombra cualquier org…" → 1 mutación → "…y cuando 2 compiten por lo escaso, el esqueleto pasa a coordinarlas."
- **0:22–0:55** *Acto 1 (intra-org):* en cada org, choque de autoridad + **Fog of War** (`███ costo` RBAC_DENIED para la otra org).
- **0:55–1:15** *Escasez + asimetría (Ambición/Impacto):* entra el **recurso único**; 2 orgs presentan su candidato; **contador compartido tickeando** (pacientes en ambas esperando).
- **1:15–1:40** *Asignación determinista (Técnico):* **Board** con **rank cross-org** + **tie-break de equidad** — regla visible y reproducible.
- **1:40–2:05** *Comité (QR) — beat multiplayer fuerte:* **jurado escanea QR → entra como Comité Ético → veto/aprobación con razón** → contador **se detiene** + `p^n` salta (≈43%→≈96%).
- **2:05–2:35** *Cierre técnico:* "Todo corrió local en el GB10 (128 GB), 0 bytes a la nube. La asignación es código, no un prompt." (opcional: apagar VPN 3 s → el motor sigue asignando).
- **2:35–3:00** *Impacto:* "Cualquier recurso crítico, entre cualquier grupo de organizaciones: el lugar donde coordinan con información asimétrica y la decisión es transparente y auditable. El recurso deja de esperar."

---

## 10. PITCH (narrativa completa para los 3 min + réplicas)

**Elevator (10 s):** *"El lugar donde varias organizaciones, con información que no pueden compartir, deciden juntas —de forma transparente y auditable— sobre lo que sí importa."*

**Bloque 1 — Problema (20 s):** Las decisiones críticas más caras (una cama, un traslado, un stock, una firma) se toman por chat/Excel, con **información asimétrica** y **sin trazabilidad**. El que decide no tiene el dato del otro; y cuando hay escasez, nadie sabe quién debe recibirlo primero.

**Bloque 2 — Por qué IA no basta (20 s):** Los agentes autónomos colapsan por probabilidad compuesta (`p^n`). No se necesita "un bot mágico": se necesita un **esqueleto determinista en código + agentes especializados por rol + frenos humanos**. (La lección de las empresas AI-driven.)

**Bloque 3 — Lo nuestro (30 s):** un esqueleto que **muta a cualquier org** y **coordina entre orgs**; **RBAC real** (el dato no viaja); **asignación determinista auditable**; **accountability del Comité**. **Todo 100% local (GB10), 0 bytes a la nube.**

**Bloque 4 — Demo (≈90 s):** ver §9.

**Bloque 5 — Impacto + cierre (30 s):** *"Cualquier recurso crítico, entre cualquier grupo: aquí se decide con información asimétrica, de forma transparente, y el recurso deja de esperar. Eso no es una app; es el lugar donde las organizaciones dejan de perder lo que cuesta."*

**Réplicas listas (del §11).**

---

## 11. Preguntas del jurado escéptico → qué muestra **la pantalla** (no el discurso)

| Pregunta ácida | Debilidad que busca | Qué muestra el producto |
|---|---|---|
| *"¿A quién ayuda en 3 min?"* | Impacto difuso/B2B | **2 orgs + 1 recurso que salva vidas** + contador compartido |
| *"¿Por qué no puede decidir UNA org?"* | Single-org | **Asimetría cross-org:** el dato del otro es **esencial** |
| *"¿Por qué esta asignación y no la otra?"* | "LLM arbitrario" | **Rank + tie-break determinista y auditable** en el Board |
| *"¿O es una simulación corriendo sola?"* | Simulations | 2+ humanos **deciden**; el Comité (QR) **veta con razón** |
| *"¿RBAC real o teatro?"* | RBAC de fachada | `403` **server-side** + DevTools: el dato **no está en el HTTP** |
| *"¿Qué hace el LLM vs. tu código?"* | "prompt que falla" | **Zod + motor determinista:** asignación/RBAC/contador en código; solo contenido por LLM |
| *"¿Qué da al Comité el poder de veto?"* | accountability | **Razón obligatoria → `auditLog` + Acta exportable** |
| *"¿Cuántas llamadas al LLM corren a la vez?"* | cuello de botella GB10 | **telemetría** (cola, ms, tokens/s) + 1 llamada "héroe" |
| *"¿Qué hace esto que Zapier + Excel no resuelven?"* | núcleo trivial | **asignación cross-org con equidad + RBAC entre orgs + veto auditado** (un workflow fijo no lo cubre) |

---

## 12. Modificaciones extra de valor (baratas, ya integradas)

1. **Algoritmo de equidad** (tie-break `worst_unmet_need`): "no gana la que más puede pagar" → +Impacto +Originalidad (justicia, no solo eficiencia).
2. **Acta de decisión auditada exportable** → +Técnico (gobernanza real) + evidencia.
3. **Razón obligatoria del veto** → **accountability** (no es "un botón de aprobar").
4. **Semántica visual "latido"** (rojo=esperando / verde=asignado) en el contador compartido — memorable y coherente.
5. **Demo de resiliencia** (VPN cae → el motor sigue asignando) → convierte tu mayor riesgo en **punto a favor de Técnico**.
6. **`tiempo a asignación`** como 2.ª métrica cuantitativa junto al `p^n`.
7. **Pacientes des-identificados** ("Paciente A") + **disclaimer** → credibilidad médica sin exposición real.
8. **Comité Ético** como `role_c` (QR): el veto del jurado pasa de "aprobación administrativa" a **decisión con peso moral**.

---

## 13. Open Questions (confirmar ANTES de bloquear)

1. **Endpoint de Qwen en `localhost`:** URL/puerto + formato (Ollama `:11434` vs OpenAI-compatible `:8000/v1`) + **`model` ID exacto** → **NO VERIFICADO**.
2. **Toggle exacto de thinking** + `max_tokens` (genoma 900 / agente 140) → **NO VERIFICADO**.
3. **Red para el QR del Comité:** Wi-Fi local/hotspot o túnel (Cloudflare/ngrok) → laptop conectada por VPN al GB10. (Define si el veto es por celular real o lo opera un humano.)
4. **Marca + carpeta:** p. ej. *Nexo / Morfos / Púlsar*; propongo `C:\Users\nahum\metamorfosis` (no tocar `minga`).
5. **Confirmar nº de orgs en vivo:** 2 orgs = mínimo del concepto; la 2.ª org por **QR/celular** o por **2.ª laptop**.

---

## 14. Plan de verificación

**Automático:**
```powershell
npm run typecheck
npm run build
npm test            # computeSharedStakesCounter, resolveAllocation, RBAC cross-org, p^n, Acta
npm run stress:gb10 # cola + latencia + Zod
```
- `projectStateForOrgAndRole("hospital_rural", …)` **nunca** incluye `coverageCost` de `clínica_andes`.
- `attemptProtectedRead` (intra + cross-org) → **`403 RBAC_DENIED`** siempre.
- `resolveAllocation` reproducible + **tie-break** correcto ante empate.
- `computeReliabilityPn` / `computeCrossOrgReliabilityPn` suben al sellar + HITL + veto.
- `computeSharedStakesCounter` `BLEEDING→CONTAINED` (reproducible).
- `buildAuditActa` genera `auditLog` completo tras el veto/aprobación.

**Manual (pre-escenario):**
1. Mutar 3 orgs libres (< 8 s) sin error de consola.
2. DevTools: `coverageCost` de una org **no existe** en el SSE de la otra.
3. 2 orgs → `403` cross-org + asignación determinista + tie-break visible.
4. QR del Comité → veto con razón → `p^n` + contador + Board + Acta en todas las pantallas.
5. Caída de VPN → semilla + motor determinista completan la demo.

---

## 15. Veredicto

Se **conserva la esencia** (mutabilidad + RBAC real + motor determinista + soberanía GB10) y se **apunta al 9/10** escalando el multiplayer a **coordinación inter-org de un recurso crítico**, con **RBAC entre organizaciones**, **asignación determinista auditable** y **accountability del Comité**. **Suelo garantizado (1 clínica) = 8.10**; **con la capa inter-org estable = ≈ 9.00**. La diferencia la gana **Ambición (20 pts)**, que era el pilar menos aprovechado — y se gana **reutilizando el mismo motor**, no agregando superficie.
