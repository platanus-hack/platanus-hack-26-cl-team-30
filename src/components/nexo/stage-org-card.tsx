import { CircleCheck, CircleDashed, Lock, PenLine, Scale, Send, TriangleAlert } from "lucide-react";
import type { ProjectedCandidate, ProjectedOrg } from "@/lib/genome/schema";
import { StatusChip } from "./status-chip";

/**
 * Resumen de una organización para la pantalla grande: tres estados en
 * palabras (límite, firma y caso) y sus datos privados, que no viajan aquí.
 */
export function StageOrgCard({ org, candidate }: { org: ProjectedOrg; candidate?: ProjectedCandidate | null }) {
  const connected = org.roles.filter((role) => role.connected).length;
  const sealed = org.authorityRule.sealedThreshold !== null;
  const gate = org.gate.status;
  const hidden = org.fields.filter((field) => field.redacted);

  return (
    <section className="panel p-5" aria-label={org.orgName}>
      <h2 className="text-xl font-semibold tracking-tight">{org.orgName}</h2>
      <p className="small text-muted-foreground">
        {connected === 0 ? "Nadie conectado todavía" : connected === 1 ? "1 persona conectada" : `${connected} personas conectadas`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {org.conflict.hasConflict ? (
          <StatusChip tone="sign" icon={Scale}>
            Límite en disputa
          </StatusChip>
        ) : (
          <StatusChip tone={sealed ? "done" : "neutral"} icon={sealed ? CircleCheck : CircleDashed}>
            {sealed ? "Límite acordado" : "Sin límite acordado"}
          </StatusChip>
        )}
        {gate === "BLOCKED_HITL_REQUIRED" ? (
          <StatusChip tone="blocked" icon={TriangleAlert}>
            Falta una firma
          </StatusChip>
        ) : gate === "SEALED" ? (
          <StatusChip tone="done" icon={PenLine}>
            Firmado
          </StatusChip>
        ) : gate === "AUTO_EXECUTED_UNSAFE" ? (
          <StatusChip tone="sign" icon={TriangleAlert}>
            Avanzó sin firma
          </StatusChip>
        ) : null}
        {candidate && (
          <StatusChip tone={candidate.submitted ? "done" : "neutral"} icon={candidate.submitted ? Send : CircleDashed}>
            {candidate.submitted ? "Caso presentado" : "Caso sin presentar"}
          </StatusChip>
        )}
      </div>
      {hidden.length > 0 && (
        <>
          <p className="small mt-5 font-medium">Datos que no viajan a esta pantalla</p>
          <ul className="mt-2 space-y-1.5">
            {hidden.map((field) => (
              <li key={field.key} className="shield small flex min-h-10 items-center justify-between gap-3 rounded-xl px-3">
                <span>{field.label}</span>
                <Lock className="size-4 shrink-0" aria-label="No viaja" />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
