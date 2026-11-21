import { UserRound } from "lucide-react";

/** Rol de quien mira, en la barra superior. */
export function RoleHeaderChip({ title, org }: { title: string; org?: string }) {
  return (
    <span className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white sm:max-w-none">
      <UserRound className="size-4 shrink-0" aria-hidden />
      <span className="truncate">
        {title}
        {org && <span className="font-normal opacity-85 max-sm:hidden"> · {org}</span>}
      </span>
    </span>
  );
}
