import type { Metadata } from "next";

import { VolverAjustes } from "@/app/_componentes/ajustes";
import { exigirMiembro } from "@/app/_datos/sesion";
import { puede } from "@/lib/auth/permisos";
import { obtenerRepositorio } from "@/repositorio";

import { DatosEmpresa } from "./datos";

export const metadata: Metadata = { title: "Datos de la empresa · Ajustes" };

// Ajustes → Datos de la empresa (#84). Cualquier miembro los ve; solo un administrador los cambia.
export default async function EmpresaPage() {
  const sesion = await exigirMiembro();
  const empresa = await (await obtenerRepositorio()).empresa();
  const editable = puede(sesion, "administrar");
  return (
    <>
      <VolverAjustes />
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight">Datos de la empresa</h1>
        <p className="text-[15px] text-muted-foreground">
          {editable
            ? "Toca un dato para cambiarlo. Cada cambio queda en el registro con tu nombre."
            : "Solo un administrador puede cambiar estos datos."}
        </p>
      </header>
      <DatosEmpresa empresa={empresa} editable={editable} />
    </>
  );
}
