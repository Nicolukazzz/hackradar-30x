import type { Metadata } from "next";

import { VolverAjustes } from "@/app/_componentes/ajustes";
import { exigirMiembro } from "@/app/_datos/sesion";

import { PasosContrasena } from "./pasos";

export const metadata: Metadata = { title: "Cambiar contraseña · Ajustes" };

// Ajustes → Mi perfil → Contraseña (#82).
export default async function ContrasenaPage() {
  const sesion = await exigirMiembro();
  return (
    <>
      <VolverAjustes />
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight">Contraseña</h1>
        <p className="text-[15px] text-muted-foreground">Para cambiarla te pedimos un código que llega a tu correo.</p>
      </header>
      <PasosContrasena correo={sesion.correo} />
    </>
  );
}
