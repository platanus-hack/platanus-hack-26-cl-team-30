import type { HumanDecision, ProjectedCandidate, ProjectedOrg } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { DecisionForm, type DecisionOption } from "./decision-form";
import { GATE_LABEL, formatTime, formatValue, type OrganResult } from "./format";
import { OrganFrame } from "./organ-frame";

type Props = {
  org: ProjectedOrg;
  /** Candidato de esta organización al recurso escaso (solo en salas inter-org). */
  candidate?: ProjectedCandidate | null;
  /** Última decisión humana sobre la compuerta de esta organización. */
  decision?: HumanDecision | null;
  /** Título del rol que tomó esa decisión. */
  decisionRoleTitle?: string;
  /** true si quien mira puede decidir la compuerta (aprobador o Comité de la organización). */
  canDecide?: boolean;
  onDecision?: (decision: "APPROVE" | "VETO" | "COUNTER_PROPOSE", reason: string, counterValue?: number) => Promise<OrganResult>;
};

const DECISION_LABEL: Record<HumanDecision["decision"], string> = {
  APPROVE: "Aprobado",
  VETO: "Vetado",
  COUNTER_PROPOSE: "Contrapropuesta",
};

/**
 * Órgano 2. El caso vivo de una organización: qué se propone, dónde está el
 * umbral y en qué estado quedó la compuerta. El estado de la compuerta lo
 * calcula el servidor (org.gate); aquí solo se dibuja.
 */
export function DynamicCaseCardOrgan({ org, candidate, decision, decisionRoleTitle, canDecide = false, onDecision }: Props) {
  const { gate, authorityRule: rule, liveCase } = org;
  const span = rule.max - rule.min || 1;
  const at = (value: number) => `${Math.min(100, Math.max(0, ((value - rule.min) / span) * 100))}%`;
  const blocked = gate.status === "BLOCKED_HITL_REQUIRED";
  const pendingRole = org.roles.find((role) => role.id === gate.pendingApproverRoleId);

  const options: DecisionOption[] = [
    { id: "APPROVE", label: "Aprobar", tone: "approve" },
    { id: "VETO", label: "Vetar", tone: "veto" },
    {
      id: "COUNTER_PROPOSE",
      label: "Contraproponer",
      tone: "neutral",
      value: {
        label: "Si contrapropones, el valor que aceptarías",
        min: rule.min,
        max: gate.effectiveThreshold,
        unit: rule.unit,
        initial: gate.effectiveThreshold,
      },
    },
  ];

  return (
    <OrganFrame title={liveCase.title} aside={org.orgName}>
      <div className="space-y-4">
        <p className="max-w-[62ch] text-sm leading-relaxed">{liveCase.summary}</p>
        <p className="text-sm text-muted-foreground">{liveCase.stakesLabel}</p>

        {/* Barra: valor propuesto frente al umbral. A la derecha del umbral se necesita una firma. */}
        <div>
          <div className="mb-7 flex items-baseline justify-between gap-3 text-sm">
            <span>{rule.metricLabel}</span>
            <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              {formatValue(rule.min, rule.unit)} a {formatValue(rule.max, rule.unit)}
            </span>
          </div>
          <div className="relative h-3 rounded-sm bg-muted">
            <div className="hatch-bleed absolute inset-y-0 right-0 rounded-r-sm" style={{ left: at(gate.effectiveThreshold) }} />
            <div className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-foreground" style={{ left: at(gate.effectiveThreshold) }} />
            <div
              className={cn("absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card", gate.crossesThreshold ? "bg-bleed" : "bg-calm")}
              style={{ left: at(gate.proposedValue) }}
            />
            <span
              className={cn("absolute -top-6 -translate-x-1/2 text-xs font-semibold whitespace-nowrap tabular-nums", gate.crossesThreshold ? "text-bleed" : "text-calm")}
              style={{ left: `clamp(2.5rem, ${at(gate.proposedValue)}, calc(100% - 2.5rem))` }}
            >
              Propuesto {formatValue(gate.proposedValue, rule.unit)}
            </span>
            <span
              className="absolute top-5 -translate-x-1/2 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
              style={{ left: `clamp(2.5rem, ${at(gate.effectiveThreshold)}, calc(100% - 2.5rem))` }}
            >
              Umbral {formatValue(gate.effectiveThreshold, rule.unit)}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "mt-8 rounded-md border px-3 py-2 text-sm",
            blocked && "border-bleed/50 bg-bleed-soft",
            gate.status === "SEALED" && "border-calm/50 bg-calm-soft",
            gate.status === "AUTO_EXECUTED_UNSAFE" && "border-clash/50 bg-clash-soft",
            gate.status === "OPEN" && "border-border bg-muted/50",
          )}
        >
          <p className={cn("font-semibold", blocked && "text-bleed", gate.status === "SEALED" && "text-calm", gate.status === "AUTO_EXECUTED_UNSAFE" && "text-clash")}>
            {GATE_LABEL[gate.status]}
          </p>
          {/* Con decisión humana, la razón ya se cita abajo; el mensaje del motor la repetiría. */}
          {!(decision && gate.status === "SEALED") && <p className="mt-0.5">{gate.message}</p>}
          {blocked && pendingRole && <p className="mt-0.5 text-muted-foreground">Decide: {pendingRole.title}.</p>}
        </div>

        {candidate && <CandidateSummary candidate={candidate} />}

        {decision && (
          <figure className="border-l-2 border-role-violet pl-3">
            <figcaption className="text-xs text-muted-foreground">
              {DECISION_LABEL[decision.decision]}
              {decision.counterValue !== undefined ? ` en ${formatValue(decision.counterValue, rule.unit)}` : ""} por {decisionRoleTitle ?? decision.byRoleId},{" "}
              {formatTime(decision.ts)}
            </figcaption>
            <blockquote className="mt-1 font-serif text-base leading-relaxed italic">«{decision.reason}»</blockquote>
          </figure>
        )}

        {canDecide && blocked && org.conflict.hasConflict && (
          <p className="rounded-md border border-clash/50 bg-clash-soft px-3 py-2 text-sm">
            Para decidir, primero hay que sellar la regla: quién puede autorizar hasta dónde todavía está en disputa.
          </p>
        )}

        {canDecide && blocked && !org.conflict.hasConflict && onDecision && (
          <DecisionForm
            prompt={`Te toca decidir: ${formatValue(gate.proposedValue, rule.unit)} supera el umbral de ${formatValue(gate.effectiveThreshold, rule.unit)}.`}
            options={options}
            onDecide={(id, reason, value) => onDecision(id as "APPROVE" | "VETO" | "COUNTER_PROPOSE", reason, value)}
          />
        )}
      </div>
    </OrganFrame>
  );
}

function CandidateSummary({ candidate }: { candidate: ProjectedCandidate }) {
  const rows: [string, number][] = [
    ["Gravedad clínica", candidate.clinicalSeverityScore],
    ["Urgencia de tiempo", candidate.timeCriticality],
    ["Riesgo por demora", candidate.delayRiskScore],
    ["Necesidad sin cubrir", candidate.unmetNeedScore],
  ];
  const cost = candidate.coverageCost;
  return (
    <div className="border-t border-border pt-3">
      <p className="text-sm font-semibold">
        {candidate.patientLabel} <span className="font-normal text-muted-foreground">(caso {candidate.caseId}, sin datos de identidad)</span>
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="h-1.5 rounded-sm bg-muted">
              <div className="h-full rounded-sm bg-foreground" style={{ width: `${value * 100}%` }} />
            </dd>
            <dd className="text-right tabular-nums">{value.toLocaleString("es-CL", { minimumFractionDigits: 2 })}</dd>
          </div>
        ))}
        <div className="contents">
          <dt className="text-muted-foreground">Costo de cobertura</dt>
          {typeof cost === "number" ? (
            <dd className="col-span-2 text-right font-semibold tabular-nums">{formatValue(cost, "CLP")}</dd>
          ) : (
            <dd className="col-span-2 flex items-center justify-end gap-2">
              <span className="redaction inline-block h-3.5 w-16" aria-hidden />
              <span className="text-xs whitespace-nowrap text-muted-foreground">no se envió aquí</span>
            </dd>
          )}
        </div>
      </dl>
    </div>
  );
}
