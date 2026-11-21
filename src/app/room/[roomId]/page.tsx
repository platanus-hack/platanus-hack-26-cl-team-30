import { Suspense } from "react";
import RoomClient from "./room-client";

// La sala depende de datos del enlace y de una conexión en vivo, así que se
// carga dentro de Suspense y todo lo interactivo vive en el componente cliente.
export default function RoomPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-muted-foreground">Cargando sala…</main>}>
      <RoomClient />
    </Suspense>
  );
}
