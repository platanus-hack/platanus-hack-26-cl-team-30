import type { NextConfig } from "next";

// Caché de lo que se sirve desde public/ (por defecto Next manda max-age=0 y el
// navegador vuelve a preguntar por cada imagen en cada visita):
// - Las capturas de public/casos/ se renombran cada vez que cambian (regla de
//   docs/DISENO.md), así que pueden quedar un año sin preguntar.
// - Las demás imágenes (marca, equipo, auspiciadores, láminas) pueden cambiar en su
//   mismo nombre: una semana, y pasado eso se muestra la guardada mientras se
//   revisa si hay una nueva.
// - Los HTML de public/ (el deck y la simulación orbital) no se tocan: cambian seguido.
const YEAR = "public, max-age=31536000, immutable";
const WEEK = "public, max-age=604800, stale-while-revalidate=2592000";
const IMAGE = "[^/]+\\.(?:jpg|jpeg|png|webp|svg)";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  async headers() {
    return [
      // Solo archivos con extensión de imagen: /casos/hospitales y /presentacion son páginas y no se cachean así.
      { source: `/casos/:file(${IMAGE})`, headers: [{ key: "Cache-Control", value: YEAR }] },
      { source: `/:dir(brand|equipo|presentacion|sponsors|sculptor)/:file(${IMAGE})`, headers: [{ key: "Cache-Control", value: WEEK }] },
      { source: `/:dir(brand|presentacion|sculptor)/:sub/:file(${IMAGE})`, headers: [{ key: "Cache-Control", value: WEEK }] },
    ];
  },
  // Una sola dirección para todo: «/» es la página de Sculptor; estas rutas cortas
  // llevan a lo demás. /sculptor se mantiene por los links que ya circulan (sus
  // imágenes en public/sculptor/ siguen sirviéndose igual).
  async redirects() {
    return [
      { source: "/sculptor", destination: "/", permanent: false },
      { source: "/demo", destination: "/stage/demo-cross", permanent: false },
      // La portada del ejemplo (con el diagrama de Venn) se retiró: el ejemplo es /casos/hospitales.
      { source: "/hospitales", destination: "/casos/hospitales", permanent: false },
    ];
  },
  // El deck del pitch es HTML estático en public/pitch/: que /pitch lo abra directo.
  async rewrites() {
    return [{ source: "/pitch", destination: "/pitch/index.html" }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
