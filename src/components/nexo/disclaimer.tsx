// Aviso obligatorio en todas las pantallas. Vive en el layout raíz, arriba, para
// que también se lea en la pantalla proyectada sin desplazarse.
export function Disclaimer() {
  return (
    <p
      role="note"
      className="border-b border-border bg-card px-4 py-1.5 text-center text-xs leading-snug text-muted-foreground"
    >
      Demostración simulada de coordinación organizacional; no constituye diagnóstico ni uso real de datos de pacientes.
    </p>
  );
}
