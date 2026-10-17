import { LinkIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";

import { Tarjeta, TarjetaEncabezado, TarjetaPie } from "@/app/_componentes";
import { obtenerProveedores } from "@/app/_datos/proveedores";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { CrearEnlace } from "./_proveedores/crear-enlace";
import { ListaEnlaces } from "./_proveedores/lista";

export const metadata: Metadata = { title: "Proveedores · Agente de cuentas por pagar" };

// Proveedores (#85): un portal por proveedor (enlace + su correo + un código) para que suba sus facturas sin cuenta.
// La app no envía correos: el admin comparte el enlace y el código por el medio que ya usan.
export default async function ProveedoresPage() {
  const { enlaces, crear } = await obtenerProveedores();
  const activos = enlaces.filter((e) => e.estado === "activo").length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Portal de proveedores</span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Proveedores</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Crea un enlace con el nombre y el correo del proveedor y un código. Pásale el enlace y el código por WhatsApp, llamada o el medio que
            ya usan: entra con su correo y el código, y sube sus facturas. Cada factura la decide el agente con las mismas reglas.
          </p>
        </div>
        <CrearEnlace permiso={crear} />
      </header>

      <Tarjeta as="section" aria-labelledby="titulo-enlaces">
        <TarjetaEncabezado
          id="titulo-enlaces"
          titulo={
            <span className="flex items-center gap-2">
              <LinkIcon className="size-[18px]" aria-hidden />
              Enlaces
            </span>
          }
          descripcion={
            enlaces.length > 0
              ? `${activos} ${activos === 1 ? "activo" : "activos"}. Cada enlace vence en 30 días; el código se puede cambiar cuando quieras.`
              : "Cada enlace vence en 30 días; el código se puede cambiar cuando quieras."
          }
        />
        {enlaces.length > 0 ? (
          <ListaEnlaces enlaces={enlaces} puedeRevocar={crear.ok} />
        ) : (
          <Empty className="border-t py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LinkIcon />
              </EmptyMedia>
              <EmptyTitle>Aún no hay enlaces</EmptyTitle>
              <EmptyDescription>Usa Crear enlace con el nombre y el correo del proveedor.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <TarjetaPie className="flex items-start gap-2">
          <ShieldCheckIcon className="mt-0.5 size-4 flex-none text-pagada-punto" aria-hidden />
          <span>
            Solo un administrador crea enlaces y cambia códigos. Para entrar hacen falta el enlace, el correo y el código, con pocos intentos por
            minuto. Lo que sube un proveedor de la lista con su correo registrado sigue las reglas normales; un proveedor nuevo se escala (R3, R11)
            hasta que una persona lo agregue a la lista.
          </span>
        </TarjetaPie>
      </Tarjeta>
    </>
  );
}
