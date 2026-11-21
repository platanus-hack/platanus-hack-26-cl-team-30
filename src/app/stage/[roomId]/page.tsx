import { Suspense } from "react";
import StageClient from "./stage-client";

// Pantalla para proyectar. Depende de una conexión en vivo, así que todo lo
// interactivo vive en el componente cliente, dentro de Suspense.
export default function StagePage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-muted-foreground">Cargando la pantalla general…</main>}>
      <StageClient />
    </Suspense>
  );
}
