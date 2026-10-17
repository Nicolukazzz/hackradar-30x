import type { NextConfig } from "next";

// Cabeceras de seguridad (issue #25, OWASP ASVS nivel 1).
const cabecerasSeguridad = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Con proxy (src/proxy.ts) Next copia el cuerpo y lo corta en 10 MB por defecto: una factura de 9,9 MB en
    // multipart pasa ese tope y llegaría truncada. 11 MB deja margen; POST /api/documentos corta en 10 MB + 64 KB.
    proxyClientMaxBodySize: "11mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: cabecerasSeguridad }];
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
