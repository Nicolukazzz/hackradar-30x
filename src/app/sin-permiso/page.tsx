import { ShieldAlertIcon, UserPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { salir } from "@/app/entrar/acciones";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NOMBRE_ROL } from "@/lib/auth/permisos";
import { obtenerSesion } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Sin permiso · Agente de cuentas por pagar" };

// Dos casos (#51): la cuenta aún no pertenece a la empresa (le falta una invitación), o su rol no alcanza para
// la sección que abrió.
export default async function PaginaSinPermiso() {
  const sesion = await obtenerSesion();
  const rol = sesion?.rol ?? null;
  const sinEmpresa = rol === null;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Empty className="max-w-md flex-none rounded-2xl border bg-card py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">{sinEmpresa ? <UserPlusIcon /> : <ShieldAlertIcon />}</EmptyMedia>
          <EmptyTitle>{sinEmpresa ? "Tu cuenta aún no pertenece a la empresa" : "Tu rol no tiene acceso a esta sección"}</EmptyTitle>
          <EmptyDescription>
            {sinEmpresa
              ? "Pide a un administrador de Nébula Studio un enlace de invitación y ábrelo con esta cuenta. Hasta entonces no ves facturas ni decisiones."
              : `Entraste como ${NOMBRE_ROL[rol]}. Si necesitas más acceso, pídeselo a un administrador.`}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          {sinEmpresa ? null : (
            <Link href="/" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
              Volver al inicio
            </Link>
          )}
          <form action={salir}>
            <Button type="submit" variant={sinEmpresa ? "outline" : "ghost"} className="h-11 px-4">
              {sinEmpresa ? "Salir y entrar con otra cuenta" : "Salir"}
            </Button>
          </form>
        </EmptyContent>
        {sesion ? <p className="mt-4 text-xs text-muted-foreground">Sesión: {sesion.correo}</p> : null}
      </Empty>
    </main>
  );
}
