import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { COOKIE_PROVEEDOR, sesionValida } from "@/vinculos/acceso";
import { enlaceActivo } from "@/vinculos/servicio";
import { MENSAJE_INVALIDO } from "@/vinculos/tipos";

import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Portal de proveedores", referrer: "no-referrer" };

// Portal del proveedor (#85), paso 1. Página pública: el proveedor escribe el correo y el código que le pasó la
// empresa; si coinciden pasa a «Ingrese sus facturas». Un enlace inexistente, vencido o revocado muestra lo mismo.
export default async function PaginaEntrarProveedor({ params }: PageProps<"/vincular/[token]">) {
  const { token } = await params;
  const ahora = relojSistema().ahora();
  const enlace = await enlaceActivo(await obtenerAlmacenEnlaces(), token, ahora);

  if (!enlace) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
        <Empty className="max-w-md flex-none rounded-2xl border bg-card py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon />
            </EmptyMedia>
            <EmptyTitle>Enlace no disponible</EmptyTitle>
            <EmptyDescription>{MENSAJE_INVALIDO}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    );
  }
  // Con sesión vigente no se vuelve a pedir el código.
  if (sesionValida((await cookies()).get(COOKIE_PROVEEDOR)?.value, enlace.id, enlace.codigo_hash, ahora)) redirect(`/vincular/${token}/facturas`);

  const empresa = (await (await obtenerRepositorio()).datosComunes()).empresa.nombre;
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <FormularioEntrar token={token} empresa={empresa} />
    </main>
  );
}
