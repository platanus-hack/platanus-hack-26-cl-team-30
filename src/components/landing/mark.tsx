/**
 * El símbolo de Nexo: dos organizaciones se cruzan y lo único que comparten
 * queda en la intersección.
 */
export function Mark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M20 9.6a13 13 0 0 1 0 20.8a13 13 0 0 1 0-20.8Z" fill="var(--brand-soft)" />
      <circle cx="14" cy="20" r="12" fill="none" stroke="var(--brand)" strokeWidth="2.5" />
      <circle cx="26" cy="20" r="12" fill="none" stroke="var(--brand-ink)" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="3.5" fill="var(--clash)" />
    </svg>
  );
}

/** Logotipo: símbolo y nombre. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span className="text-xl font-semibold tracking-tight">Nexo</span>
    </span>
  );
}
