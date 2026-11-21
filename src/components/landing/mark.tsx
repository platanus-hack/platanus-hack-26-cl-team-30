import { SculptorLogo } from "@/components/brand/sculptor-logo";

/**
 * Marca de Sculptor en los encabezados: el logo oficial, el cubo isométrico
 * (src/components/brand/sculptor-logo.tsx), sin animación. La animación grande
 * (SculptorGlassReveal) es solo para la landing general.
 *
 * La cara superior del cubo es marfil: en modo claro se perdería sobre el fondo,
 * así que lleva un contorno muy suave en tinta. En oscuro casi no se nota.
 */
export function Mark({ size = 32, className, title }: { size?: number; className?: string; title?: string; bare?: boolean }) {
  return (
    <span
      className={["inline-flex shrink-0", className].filter(Boolean).join(" ")}
      style={{ filter: "drop-shadow(0 0 0.6px rgb(36 64 58 / 0.6)) drop-shadow(0 1px 1px rgb(36 64 58 / 0.18))" }}
      title={title}
    >
      <SculptorLogo size={size} />
    </span>
  );
}

/** Logotipo: marca y nombre. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span className="text-xl font-semibold tracking-tight">Sculptor</span>
    </span>
  );
}
