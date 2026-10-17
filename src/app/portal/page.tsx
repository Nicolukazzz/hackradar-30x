import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { salir } from "@/app/entrar/acciones";
import { Button } from "@/components/ui/button";
import { obtenerSesion } from "@/lib/auth/sesion";
import { obtenerRepositorio } from "@/repositorio";
import { facturasDelProveedor } from "@/servicios/portal";

import { ListaFacturas } from "./_portal/lista-facturas";
import { SubirYActualizar } from "./_portal/subir-y-actualizar";

// Portal de proveedores (#12): separado del panel interno. Responde una pregunta: "¿qué pasó con mis facturas?".
// Solo rol proveedor (#25). Todo lo que ve sale de su sesión: nunca facturas de otro ni reglas internas.
export default async function PaginaPortal() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/entrar?siguiente=/portal");
  if (sesion.rol !== "proveedor" || !sesion.beneficiario_id) redirect("/sin-permiso");

  const h = await headers();
  const origen = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost"}`;
  const facturas = await facturasDelProveedor(await obtenerRepositorio(), sesion.beneficiario_id, { urlPortal: `${origen}/portal` });

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-col">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Portal de proveedores · Nébula Studio Inc.</span>
            <span className="font-semibold">{sesion.nombre}</span>
          </div>
          <form action={salir}>
            <Button type="submit" variant="outline" className="h-11 px-4">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <main id="contenido" className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
        <section aria-labelledby="titulo-enviar" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 id="titulo-enviar" className="text-2xl font-semibold tracking-tight">
              Envía una factura
            </h1>
            <p className="text-muted-foreground">
              Al subirla recibes al instante un número de referencia y su estado. No necesitas mandarla también por correo.
            </p>
          </div>
          <SubirYActualizar />
        </section>

        <section aria-labelledby="titulo-facturas" className="flex flex-col gap-4">
          <h2 id="titulo-facturas" className="text-lg font-semibold">
            Tus facturas
          </h2>
          <ListaFacturas facturas={facturas} />
        </section>
      </main>
    </div>
  );
}
