import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Una sola dirección para todo: «/» es la página de Sculptor; estas rutas cortas
  // llevan a lo demás. /sculptor se mantiene por los links que ya circulan (sus
  // imágenes en public/sculptor/ siguen sirviéndose igual).
  async redirects() {
    return [
      { source: "/sculptor", destination: "/", permanent: false },
      { source: "/demo", destination: "/stage/demo-cross", permanent: false },
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
