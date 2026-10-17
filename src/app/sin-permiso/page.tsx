import { ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { salir } from "@/app/entrar/acciones";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Sin permiso · Agente de cuentas por pagar" };

export default function PaginaSinPermiso() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Empty className="max-w-md flex-none rounded-2xl border bg-card py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Tu usuario no tiene acceso a esta sección</EmptyTitle>
          <EmptyDescription>
            Si crees que es un error, pide a tesorería que revise tu perfil. Si tu cuenta fue desactivada, ya no puedes entrar.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Link href="/" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
            Volver al inicio
          </Link>
          <form action={salir}>
            <Button type="submit" variant="ghost" className="h-11 px-4">
              Salir
            </Button>
          </form>
        </EmptyContent>
      </Empty>
    </main>
  );
}
