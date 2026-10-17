import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";

import { configBuzonDesdeEntorno } from "@/canales/correo/buzon";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { vistaEnlace } from "@/vinculos/servicio";
import { MENSAJE_INVALIDO } from "@/vinculos/tipos";

import { FormularioVincular } from "./formulario";

export const metadata: Metadata = { title: "Vincular correo de facturación", referrer: "no-referrer" };

// Enlace de proveedor (#85). Página pública: el proveedor no tiene cuenta. Escribe el correo desde el que manda sus
// facturas y recibe su id de conexión. Un enlace inexistente, vencido, usado o revocado muestra la misma página.
export default async function PaginaVincular({ params }: PageProps<"/vincular/[token]">) {
  const { token } = await params;
  const vista = await vistaEnlace(await obtenerAlmacenEnlaces(), await obtenerRepositorio(), token, relojSistema().ahora());

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      {vista ? (
        <FormularioVincular token={token} vista={vista} buzon={configBuzonDesdeEntorno()?.usuario ?? null} />
      ) : (
        <Empty className="max-w-md flex-none rounded-2xl border bg-card py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon />
            </EmptyMedia>
            <EmptyTitle>Enlace no disponible</EmptyTitle>
            <EmptyDescription>{MENSAJE_INVALIDO}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </main>
  );
}
