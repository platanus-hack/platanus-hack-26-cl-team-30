/**
 * Marca de Sculptor: una «S» de un solo trazo, como tallada, y un punto de
 * arcilla que marca lo único que se comparte. Sin imágenes externas: es un SVG
 * con los tokens de la paleta (docs/DISENO.md), así sigue al modo claro u oscuro.
 *
 * `bare`: solo el trazo, en currentColor, para ponerlo sobre un fondo propio
 * (el círculo lima del encabezado de la pantalla grande).
 */
const S_PATH = "M26.5 13.2c-1.5-1.7-3.8-2.7-6.4-2.7-3.9 0-6.6 2.2-6.6 5.2 0 6.9 13.1 3.9 13.1 10.7 0 3.2-2.8 5.3-6.7 5.3-2.7 0-5.1-1.1-6.6-2.9";

export function Mark({ size = 32, className, title, bare = false }: { size?: number; className?: string; title?: string; bare?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {!bare && <rect x="1" y="1" width="38" height="38" rx="12" fill="var(--brand-ink)" />}
      <path d={S_PATH} fill="none" stroke={bare ? "currentColor" : "var(--background)"} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="29.5" cy="29.5" r="2.6" fill={bare ? "currentColor" : "var(--clash)"} />
    </svg>
  );
}

/** Logotipo: marca y nombre. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span className="text-xl font-semibold tracking-tight">Sculptor</span>
    </span>
  );
}
