import { Suspense } from "react";
import type { Viewport } from "next";
import RoomClient from "./room-client";

// La silla ocupa toda la pantalla del celular, también bajo la muesca y la barra
// de inicio: con viewport-fit=cover los botones de abajo respetan el área segura.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#cfeae3" },
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
  ],
};

// Silla de un jugador. Depende del enlace y de una conexión en vivo, así que
// todo lo interactivo vive en el componente cliente, dentro de Suspense.
export default function RoomPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-muted-foreground">Cargando la sala…</main>}>
      <RoomClient />
    </Suspense>
  );
}
