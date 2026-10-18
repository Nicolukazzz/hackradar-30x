import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { obtenerEmpresa } from "@/app/_datos/empresa";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const DESCRIPCION = "Quadra decide qué facturas pagar, frenar o escalar, dentro de las reglas de la empresa.";

// La pestaña nombra a la empresa (#84, se edita en Ajustes), no al producto (#152): «Pendientes · {empresa}».
// Cada página pone solo su parte; la plantilla agrega la empresa. Sin empresa legible, «Quadra».
export async function generateMetadata(): Promise<Metadata> {
  const empresa = await obtenerEmpresa();
  const nombre = empresa?.nombre ?? "Quadra";
  return {
    title: { default: empresa ? `${nombre} · Cuentas por pagar` : nombre, template: `%s · ${nombre}` },
    applicationName: "Quadra",
    description: DESCRIPCION,
  };
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
