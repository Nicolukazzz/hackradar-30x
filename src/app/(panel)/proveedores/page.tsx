import { LinkIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";

import { Tarjeta, TarjetaEncabezado, TarjetaPie } from "@/app/_componentes";
import { obtenerProveedores } from "@/app/_datos/proveedores";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { CrearEnlace } from "./_proveedores/crear-enlace";
import { ListaEnlaces } from "./_proveedores/lista";

export const metadata: Metadata = { title: "Proveedores · Agente de cuentas por pagar" };

// Proveedores (#85): enlaces de un solo uso para que un proveedor vincule el correo desde el que manda sus facturas
// y reciba su id de conexión. La app no envía correos: el enlace se comparte por el medio que ya usan.
export default async function ProveedoresPage() {
  const { enlaces, beneficiarios, crear } = await obtenerProveedores();
  const activos = enlaces.filter((e) => e.estado === "activo").length;
  const vinculados = enlaces.filter((e) => e.estado === "usado").length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Correo de facturación</span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Proveedores</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Crea un enlace y pásaselo al proveedor por WhatsApp, llamada o el medio que ya usan. Al abrirlo escribe el correo desde el que manda
            sus facturas y recibe su id de conexión. Desde ahí, lo que llegue de ese correo queda a su nombre.
          </p>
        </div>
        <CrearEnlace beneficiarios={beneficiarios} permiso={crear} />
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
              ? `${activos} ${activos === 1 ? "activo" : "activos"} · ${vinculados} ${vinculados === 1 ? "correo vinculado" : "correos vinculados"}. Cada enlace sirve una vez y vence en 7 días.`
              : "Cada enlace sirve una sola vez y vence en 7 días."
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
              <EmptyDescription>Usa Crear enlace para un proveedor de la lista o para uno nuevo.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <TarjetaPie className="flex items-start gap-2">
          <ShieldCheckIcon className="mt-0.5 size-4 flex-none text-pagada-punto" aria-hidden />
          <span>
            Solo un administrador crea enlaces. Para un proveedor de la lista, el correo vinculado hace que sus facturas cumplan R11 (remitente
            verificado); todas las demás reglas siguen igual. Para un proveedor nuevo, el correo solo queda registrado: sus facturas se escalan
            (R3) hasta que una persona lo agregue a la lista. Un correo que ya es de otro proveedor no se puede vincular.
          </span>
        </TarjetaPie>
      </Tarjeta>
    </>
  );
}
