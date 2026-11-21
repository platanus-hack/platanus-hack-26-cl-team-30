import { Suspense } from "react";
import RoomClient from "./room-client";

// Estación de un jugador. Depende del enlace y de una conexión en vivo, así que
// todo lo interactivo vive en el componente cliente, dentro de Suspense.
export default function RoomPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-muted-foreground">Cargando la sala…</main>}>
      <RoomClient />
    </Suspense>
  );
}
