import type { NextConfig } from "next";

// Cabeceras de seguridad (issue #25, OWASP ASVS nivel 1).
const cabecerasSeguridad = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
];

// Nadie puede mostrar la app dentro de un iframe (clickjacking)…
const sinMarcos = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];
// …salvo el archivo original de una factura, que la Traza (#6c) muestra en un iframe del mismo sitio. La ruta pone
// su propia CSP (sin scripts, frame-ancestors 'self').
const ARCHIVO = "/api/documentos/:ref/archivo";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Con proxy (src/proxy.ts) Next copia el cuerpo y lo corta en 10 MB por defecto: una factura de 9,9 MB en
    // multipart pasa ese tope y llegaría truncada. 11 MB deja margen; POST /api/documentos corta en 10 MB + 64 KB.
    proxyClientMaxBodySize: "11mb",
  },
  // #83: Reglas y Equipo viven dentro de Ajustes. Los enlaces viejos (correos, marcadores) siguen funcionando.
  async redirects() {
    return [
      { source: "/reglas", destination: "/ajustes/reglas", permanent: false },
      { source: "/equipo", destination: "/ajustes/equipo", permanent: false },
      // #131: «Aprobaciones» pasa a «Pendientes».
      { source: "/aprobaciones", destination: "/pendientes", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: cabecerasSeguridad },
      { source: "/((?!api/documentos/[^/]+/archivo$).*)", headers: sinMarcos },
      { source: ARCHIVO, headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
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
