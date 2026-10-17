import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioEntrar } from "@/app/entrar/formulario-entrar";
import { obtenerSesion } from "@/lib/auth/sesion";

// no-referrer: la URL puede traer `siguiente=/unirse/<token>` (invitación); no se manda a ningún otro sitio.
export const metadata: Metadata = { title: "Entrar · Agente de cuentas por pagar", referrer: "no-referrer" };

export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const sesion = await obtenerSesion();
  if (sesion) redirect("/");

  const { siguiente } = await searchParams;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background px-4 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Nébula Studio Inc.</span>
        <h1 className="text-3xl font-semibold tracking-tight">Agente de cuentas por pagar</h1>
        <p className="max-w-sm text-balance text-muted-foreground">
          Decide qué facturas pagar, frenar o escalar, dentro de las reglas de la empresa.
        </p>
      </header>

      <FormularioEntrar siguiente={typeof siguiente === "string" ? siguiente : ""} />
    </main>
  );
}
