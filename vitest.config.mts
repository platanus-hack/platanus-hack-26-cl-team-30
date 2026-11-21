// Configuración de las pruebas automáticas (npm test).
// El alias "@/" es el mismo de tsconfig.json, para que las pruebas puedan cargar
// módulos de src/ que se importan entre sí con "@/lib/...".
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
});
