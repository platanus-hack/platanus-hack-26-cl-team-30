import type { Metadata } from "next";

import { OrbitaClient } from "./orbita-client";

export const metadata: Metadata = { title: "Sculptor · Galaxia" };

// Banco de pruebas de la galaxia en píxeles de la pantalla grande (modos «nemo» y «armado»).
export default function OrbitaPage() {
  return <OrbitaClient />;
}
