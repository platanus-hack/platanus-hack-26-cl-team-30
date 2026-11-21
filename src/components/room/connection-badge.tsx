import type { ConnectionStatus } from "./use-room-events";

const labels: Record<ConnectionStatus, { text: string; dot: string }> = {
  connecting: { text: "conectando…", dot: "bg-amber-500" },
  connected: { text: "en vivo", dot: "bg-emerald-500" },
  reconnecting: { text: "reconectando…", dot: "bg-amber-500 animate-pulse" },
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const { text, dot } = labels[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground" role="status">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {text}
    </span>
  );
}
