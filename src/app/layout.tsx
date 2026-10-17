import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { obtenerEmpresa } from "@/app/_datos/empresa";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const DESCRIPCION = "Decide qué facturas pagar, frenar o escalar, dentro de las reglas de la empresa.";

// El título lleva el nombre de la empresa (#84), que se edita en Ajustes.
export async function generateMetadata(): Promise<Metadata> {
  const empresa = await obtenerEmpresa();
  return { title: empresa ? `Agente de cuentas por pagar · ${empresa.nombre}` : "Agente de cuentas por pagar", description: DESCRIPCION };
}

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
