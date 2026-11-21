import type { ProjectedOrg, ProjectedRole, ProjectedRoomState } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { ACCENT, GATE_LABEL, formatValue, isRoleViewer } from "./format";
import { OrganFrame } from "./organ-frame";
import { ReliabilityMeter } from "./reliability-meter";

type Props = {
  room: ProjectedRoomState;
  /** "stage": más alto y con letra grande para proyectar. */
  size?: "stage" | "default";
  /** Oculta el medidor p^n cuando la pantalla ya lo muestra en otro lugar. */
  hideMeter?: boolean;
};

type Point = { x: number; y: number };
type Edge = { from: Point; to: Point; tone: "quiet" | "bleed" | "calm" | "violet" | "ink"; dashed?: boolean; flowing?: boolean; thick?: boolean };

const TONE: Record<Edge["tone"], string> = {
  quiet: "var(--border)",
  bleed: "var(--bleed)",
  calm: "var(--calm)",
  violet: "var(--role-violet)",
  ink: "var(--foreground)",
};

/**
 * Órgano 1. Grafo vivo de la sala: roles con su agente, quién está conectado,
 * el choque de autoridad, la compuerta y, en salas inter-org, el recurso escaso
 * al centro con el Comité encima. Las posiciones son fijas y las decide este
 * código; el contenido (títulos, estados) viene del estado proyectado.
 *
 * Las aristas son un SVG que ocupa todo el marco (coordenadas 0 a 100) y los
 * nodos son HTML encima, para que el texto no se achique en el teléfono.
 */
export function LivingGraphOrgan({ room, size = "default", hideMeter = false }: Props) {
  const stage = size === "stage";
  const cross = room.mode === "cross_org" && !!room.scarcity;
  const reliability = room.crossOrgReliability ?? room.orgs[0]?.reliability;

  return (
    <OrganFrame
      title="Quién decide con quién"
      aside={`${room.connectedPlayers.length} ${room.connectedPlayers.length === 1 ? "persona conectada" : "personas conectadas"}`}
    >
      <div className={cn("relative w-full", cross ? (stage ? "h-[34rem]" : "h-[27rem]") : stage ? "h-[31rem]" : "h-80")}>
        {cross ? <CrossOrgGraph room={room} stage={stage} /> : room.orgs[0] && <SingleOrgGraph room={room} org={room.orgs[0]} stage={stage} />}
      </div>
      {!hideMeter && reliability && (
        <div className="mt-4 border-t border-border pt-4">
          <ReliabilityMeter reliability={reliability} scope={cross ? "entre las organizaciones" : undefined} size={size} />
        </div>
      )}
    </OrganFrame>
  );
}

// --- Una organización: proponente y aprobador abajo, Comité arriba, caso al centro ---

function SingleOrgGraph({ room, org, stage }: { room: ProjectedRoomState; org: ProjectedOrg; stage: boolean }) {
  const rule = org.authorityRule;
  const proposer = org.roles.find((role) => role.id === rule.proposerRoleId);
  const approver = org.roles.find((role) => role.id === rule.approverRoleId);
  const others = org.roles.filter((role) => role.id !== rule.proposerRoleId && role.id !== rule.approverRoleId);
  const center: Point = { x: 50, y: 47 };
  const spots = new Map<string, Point>();
  if (proposer) spots.set(proposer.id, { x: 19, y: 86 });
  if (approver) spots.set(approver.id, { x: 81, y: 86 });
  others.forEach((role, index) => spots.set(role.id, { x: others.length === 1 ? 50 : 30 + index * 40, y: 12 }));

  const blocked = org.gate.status === "BLOCKED_HITL_REQUIRED";
  const sealed = org.gate.status === "SEALED";
  const edges: Edge[] = org.roles.map((role) => {
    const pending = blocked && org.gate.pendingApproverRoleId === role.id;
    return { from: spots.get(role.id)!, to: center, tone: pending ? "bleed" : sealed ? "calm" : "quiet", flowing: pending, dashed: pending, thick: pending };
  });
  if (proposer && approver) {
    edges.push({
      from: spots.get(proposer.id)!,
      to: spots.get(approver.id)!,
      tone: org.conflict.hasConflict ? "bleed" : rule.sealedThreshold !== null ? "calm" : "quiet",
      dashed: org.conflict.hasConflict,
      flowing: org.conflict.hasConflict,
      thick: true,
    });
  }

  return (
    <>
      <EdgeLayer edges={edges} />
      {proposer && approver && (
        <EdgeLabel at={{ x: 50, y: 86 }} tone={org.conflict.hasConflict ? "bleed" : rule.sealedThreshold !== null ? "calm" : "quiet"} stage={stage}>
          {org.conflict.hasConflict
            ? `choque de ${formatValue(Math.abs(org.conflict.delta), rule.unit)}`
            : rule.sealedThreshold !== null
              ? `regla sellada en ${formatValue(rule.sealedThreshold, rule.unit)}`
              : "sin choque"}
        </EdgeLabel>
      )}
      <CenterNode at={center} stage={stage} tone={blocked ? "bleed" : sealed ? "calm" : "ink"} title={org.liveCase.title} status={GATE_LABEL[org.gate.status]} />
      {org.roles.map((role) => (
        <RoleNode
          key={role.id}
          role={role}
          at={spots.get(role.id)!}
          stage={stage}
          mine={isRoleViewer(room.viewer) && room.viewer.orgId === org.orgId && room.viewer.roleId === role.id}
          mustSign={blocked && org.gate.pendingApproverRoleId === role.id}
          wide
        />
      ))}
    </>
  );
}

// --- Varias organizaciones: una columna por organización, recurso al centro, Comité arriba ---

function CrossOrgGraph({ room, stage }: { room: ProjectedRoomState; stage: boolean }) {
  const scarcity = room.scarcity!;
  const allocation = room.allocation;
  const resource: Point = { x: 50, y: 62 };
  const committee: Point = { x: 50, y: 12 };
  const columns = room.orgs.map((_, index) => (room.orgs.length === 1 ? 16 : 16 + (index * 68) / (room.orgs.length - 1)));
  const rows = [34, 60, 86];
  const sealed = allocation?.status === "SEALED";

  const edges: Edge[] = [];
  room.orgs.forEach((org, column) => {
    const x = columns[column];
    const rule = org.authorityRule;
    // Espina de la organización: une sus roles de arriba abajo.
    edges.push({ from: { x, y: rows[0] }, to: { x, y: rows[Math.min(org.roles.length, rows.length) - 1] }, tone: org.conflict.hasConflict ? "bleed" : "quiet", dashed: org.conflict.hasConflict, flowing: org.conflict.hasConflict });
    const candidate = scarcity.candidates.find((entry) => entry.orgId === org.orgId);
    const proposerIndex = org.roles.findIndex((role) => role.id === (candidate?.proposerRoleId ?? rule.proposerRoleId));
    if (candidate && proposerIndex >= 0) {
      const wins = allocation?.winnerOrgId === org.orgId;
      const submitted = allocation?.ranking.some((entry) => entry.caseId === candidate.caseId) ?? false;
      edges.push({
        from: { x, y: rows[proposerIndex] },
        to: resource,
        tone: wins ? (sealed ? "calm" : "ink") : submitted && !sealed ? "bleed" : "quiet",
        dashed: !wins,
        flowing: submitted && !sealed && !wins,
        thick: wins,
      });
    }
  });
  edges.push({ from: committee, to: resource, tone: "violet", dashed: !sealed, thick: true });

  const winner = allocation?.ranking.find((entry) => entry.caseId === allocation.winnerCaseId);
  const resourceStatus = !allocation || allocation.status === "PENDING" ? "sin asignar" : sealed ? `asignada a ${winner?.patientLabel ?? "un caso"}` : `propuesta para ${winner?.patientLabel ?? "un caso"}`;
  const arbiterMine = isRoleViewer(room.viewer) && room.viewer.orgId === scarcity.arbiter.orgId;

  return (
    <>
      <EdgeLayer edges={edges} />
      {room.orgs.map((org, column) => (
        <div key={org.orgId}>
          <p
            className={cn("absolute line-clamp-2 w-[31%] -translate-x-1/2 text-center leading-tight font-semibold font-stretch-[108%]", stage ? "text-base" : "text-xs")}
            style={{ left: `${columns[column]}%`, top: "2%" }}
          >
            {org.orgName}
          </p>
          {org.conflict.hasConflict && (
            <EdgeLabel at={{ x: columns[column], y: (rows[0] + rows[1]) / 2 }} tone="bleed" stage={stage}>
              choque
            </EdgeLabel>
          )}
          {org.roles.slice(0, rows.length).map((role, index) => (
            <RoleNode
              key={role.id}
              role={role}
              at={{ x: columns[column], y: rows[index] }}
              stage={stage}
              mine={isRoleViewer(room.viewer) && room.viewer.orgId === org.orgId && room.viewer.roleId === role.id}
              mustSign={org.gate.status === "BLOCKED_HITL_REQUIRED" && org.gate.pendingApproverRoleId === role.id}
            />
          ))}
        </div>
      ))}

      {/* Comité árbitro: no pertenece a ninguna organización y entra por código QR. */}
      <div
        className={cn(
          "absolute w-[34%] max-w-64 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-role-violet bg-violet-soft px-2 py-1.5 text-center",
          arbiterMine && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
        )}
        style={{ left: `${committee.x}%`, top: `${committee.y}%` }}
      >
        <p className={cn("leading-tight font-semibold", stage ? "text-lg" : "text-xs")}>{scarcity.arbiter.title}</p>
        <p className={cn("flex items-center justify-center gap-1.5 text-muted-foreground", stage ? "text-sm" : "text-[0.7rem]")}>
          <Presence connected={scarcity.arbiter.connected} color="var(--role-violet)" />
          {scarcity.arbiter.connected ? "conectado" : "entra por código QR"}
          {arbiterMine && ", eres tú"}
        </p>
      </div>

      <CenterNode at={resource} stage={stage} tone={sealed ? "calm" : allocation?.status === "PROPOSED" ? "ink" : "bleed"} title={scarcity.rule.resourceLabel} status={resourceStatus} />
    </>
  );
}

// --- Piezas ---------------------------------------------------------------------

function EdgeLayer({ edges }: { edges: Edge[] }) {
  return (
    <svg aria-hidden className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {edges.map((edge, index) => (
        <line
          key={index}
          x1={edge.from.x}
          y1={edge.from.y}
          x2={edge.to.x}
          y2={edge.to.y}
          stroke={TONE[edge.tone]}
          strokeWidth={edge.thick ? 2.5 : 1.5}
          strokeDasharray={edge.dashed ? "7 5" : undefined}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className={edge.flowing ? "edge-flow" : undefined}
        />
      ))}
    </svg>
  );
}

function EdgeLabel({ at, tone, stage, children }: { at: Point; tone: "bleed" | "calm" | "quiet"; stage: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border bg-card px-1.5 py-0.5 leading-tight font-semibold whitespace-nowrap",
        stage ? "text-sm" : "text-[0.7rem]",
        tone === "bleed" && "border-bleed text-bleed",
        tone === "calm" && "border-calm text-calm",
        tone === "quiet" && "border-border text-muted-foreground",
      )}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
    >
      {children}
    </span>
  );
}

function CenterNode({ at, tone, title, status, stage }: { at: Point; tone: "bleed" | "calm" | "ink"; title: string; status: string; stage: boolean }) {
  return (
    <div
      className={cn(
        "absolute w-[36%] max-w-72 -translate-x-1/2 -translate-y-1/2 rounded-md px-2.5 py-2 text-center text-white",
        tone === "bleed" && "bg-bleed",
        tone === "calm" && "bg-calm",
        tone === "ink" && "bg-foreground",
      )}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
    >
      <p className={cn("leading-tight font-semibold", stage ? "text-lg" : "text-xs")}>{title}</p>
      <p className={cn("leading-tight opacity-90", stage ? "text-base" : "text-[0.7rem]")}>{status}</p>
    </div>
  );
}

function Presence({ connected, color }: { connected: boolean; color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full border"
      style={{ borderColor: color, background: connected ? color : "transparent" }}
    />
  );
}

function RoleNode({ role, at, stage, mine, mustSign, wide }: { role: ProjectedRole; at: Point; stage: boolean; mine: boolean; mustSign: boolean; wide?: boolean }) {
  const accent = ACCENT[role.accentColor];
  return (
    <div
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border bg-card py-1.5 pr-2 pl-3",
        wide ? "w-[36%] max-w-64" : "w-[31%] max-w-60",
        mustSign ? "border-bleed" : "border-border",
        mine && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
      )}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", accent.bg)} />
      <p className={cn("line-clamp-2 leading-tight font-semibold", stage ? "text-base" : "text-xs")}>{role.title}</p>
      <p className={cn("truncate text-muted-foreground", stage ? "text-sm" : "text-[0.7rem]")}>con {role.agentName}</p>
      <p className={cn("flex items-center gap-1.5", stage ? "text-sm" : "text-[0.7rem]", mustSign ? "font-semibold text-bleed" : "text-muted-foreground")}>
        <Presence connected={role.connected} color={accent.stroke} />
        {mustSign ? "debe firmar" : role.connected ? "conectado" : "libre"}
        {mine && ", eres tú"}
      </p>
    </div>
  );
}
