import type { ConnectionStatus } from "@/lib/client/use-room";
import { cn } from "@/lib/utils";

const LABEL: Record<ConnectionStatus, { text: string; dot: string }> = {
  connecting: { text: "conectando", dot: "bg-role-amber" },
  connected: { text: "en vivo", dot: "bg-calm" },
  reconnecting: { text: "reconectando", dot: "bg-role-amber animate-pulse" },
};

export function ConnectionBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  const { text, dot } = LABEL[status];
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground", className)}>
      <span aria-hidden className={cn("size-2 rounded-full", dot)} />
      {text}
    </span>
  );
}
