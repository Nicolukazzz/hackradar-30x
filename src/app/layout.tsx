import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Agente de cuentas por pagar · Nébula Studio",
  description: "Decide qué facturas pagar, frenar o escalar, dentro de las reglas de la empresa.",
};

// Color de la barra del navegador móvil = cabecera oscura del panel (§15 tinta).
export const viewport: Viewport = { themeColor: "#101614" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
