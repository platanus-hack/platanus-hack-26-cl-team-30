import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "done" | "sign" | "blocked" | "neutral" | "brand";

const TONES: Record<Tone, string> = {
  done: "bg-calm-soft text-calm",
  sign: "bg-clash-soft text-clash",
  blocked: "bg-bleed-soft text-bleed",
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-ink",
};

/** Estado con color, icono y palabras: nunca solo color. */
export function StatusChip({ tone, icon: Icon, children, className }: { tone: Tone; icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", TONES[tone], className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </span>
  );
}
