import { Wifi, WifiOff, LoaderCircle } from "lucide-react";
import type { ConnectionStatus } from "@/lib/client/use-room";
import { cn } from "@/lib/utils";

const LABEL: Record<ConnectionStatus, { text: string; tone: string; Icon: typeof Wifi }> = {
  connecting: { text: "Conectando", tone: "text-muted-foreground", Icon: LoaderCircle },
  connected: { text: "En vivo", tone: "text-calm", Icon: Wifi },
  reconnecting: { text: "Reconectando", tone: "text-clash", Icon: WifiOff },
};

export function ConnectionBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  const { text, tone, Icon } = LABEL[status];
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-sm font-medium shadow-[inset_0_0_0_1px_var(--border)]", tone, className)}>
      <Icon className={cn("size-4", status !== "connected" && status === "connecting" && "animate-spin")} aria-hidden />
      {text}
    </span>
  );
}
