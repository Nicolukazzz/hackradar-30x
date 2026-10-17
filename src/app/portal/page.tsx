import { UploadIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { salir } from "@/app/entrar/acciones";
import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { Button } from "@/components/ui/button";
import { obtenerSesion } from "@/lib/auth/sesion";

// Placeholder del portal de proveedores: #12 lo reemplaza. Solo verifica el rol (issue #25).
export default async function PaginaPortal() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/entrar?siguiente=/portal");
  if (sesion.rol !== "proveedor") redirect("/sin-permiso");

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <PantallaPendiente
        contexto={`Portal de proveedores · ${sesion.nombre}`}
        titulo="Tus facturas"
        icono={UploadIcon}
        vacioTitulo="Pronto podrás subir facturas aquí"
        vacioDescripcion="Mientras tanto, envíalas por correo o Telegram como siempre."
      />
      <form action={salir}>
        <Button type="submit" variant="outline" className="h-11 px-4">
          Salir
        </Button>
      </form>
    </main>
  );
}
