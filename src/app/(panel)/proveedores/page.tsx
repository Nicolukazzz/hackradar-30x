import type { Metadata } from "next";

import { EncabezadoPagina } from "@/app/_componentes";
import { obtenerProveedores } from "@/app/_datos/proveedores";

import { AsistenteProveedor } from "./_proveedores/asistente-proveedor";
import { CrearEnlace } from "./_proveedores/crear-enlace";
import { Directorio } from "./_proveedores/directorio";

export const metadata: Metadata = { title: "Proveedores" };

// Proveedores (#107, #85, #119): una sola lista con a quién puede pagar el agente y quién tiene acceso al portal para
// subir facturas. La app no envía correos: el enlace y el código del portal los comparte el admin.
export default async function ProveedoresPage() {
  const { proveedores, enlaces, crear } = await obtenerProveedores();

  return (
    <>
      <EncabezadoPagina
        titulo="Proveedores"
        descripcion="A quién le paga el agente y quién puede subir facturas por el portal."
        acciones={
          <>
            <CrearEnlace permiso={crear} />
            <AsistenteProveedor permiso={crear} />
          </>
        }
      />
      <Directorio proveedores={proveedores} enlaces={enlaces} permiso={crear} />
    </>
  );
}
