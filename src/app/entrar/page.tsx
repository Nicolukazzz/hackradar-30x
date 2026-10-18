import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioEntrar } from "@/app/entrar/formulario-entrar";
import { FirmaQuadra } from "@/components/quadra";
import { obtenerSesion } from "@/lib/auth/sesion";
import { iniciales } from "@/lib/iniciales";
import { obtenerEmpresa } from "@/app/_datos/empresa";

// no-referrer: la URL puede traer `siguiente=/unirse/<token>` (invitación); no se manda a ningún otro sitio.
export const metadata: Metadata = { title: "Entrar", referrer: "no-referrer" };

/**
 * Inicio de sesión del panel (#81). Quien entra ve primero a su empresa (monograma y nombre, editables en Ajustes);
 * el producto solo firma al pie (#152).
 */
export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const sesion = await obtenerSesion();
  if (sesion) redirect("/");

  const [{ siguiente }, empresa] = await Promise.all([searchParams, obtenerEmpresa()]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background px-4 py-12">
      <header className="flex flex-col items-center gap-4 text-center">
        {empresa ? (
          <span
            aria-hidden
            className="flex size-14 items-center justify-center rounded-[16px] bg-sidebar text-lg font-semibold text-sidebar-foreground shadow-sm"
          >
            {iniciales(empresa.nombre)}
          </span>
        ) : null}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{empresa?.nombre ?? "Cuentas por pagar"}</h1>
          <p className="max-w-sm text-balance text-muted-foreground">
            {empresa ? "Cuentas por pagar. " : null}Decide qué facturas pagar, frenar o escalar, dentro de las reglas de la empresa.
          </p>
        </div>
      </header>

      <FormularioEntrar siguiente={typeof siguiente === "string" ? siguiente : ""} />

      <FirmaQuadra />
    </main>
  );
}
