import type { Metadata } from "next";

import { OrbitaClient } from "./orbita-client";

export const metadata: Metadata = { title: "Sculptor · Órbita" };

// Banco de pruebas de la órbita «relevo» (la gente se conecta a través de Sculptor),
// comparada con la órbita original de la pantalla grande.
export default function OrbitaPage() {
  return <OrbitaClient />;
}
