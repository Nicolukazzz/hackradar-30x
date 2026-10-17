import { LinkIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";

import { Tarjeta, TarjetaEncabezado, TarjetaPie } from "@/app/_componentes";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { obtenerAlmacenInvitaciones } from "@/invitaciones";
import { listarInvitaciones } from "@/invitaciones/servicio";
import { relojSistema } from "@/lib/reloj-sistema";

import { InvitarProveedor } from "./_proveedores/invitar";
import { ListaInvitaciones } from "./_proveedores/lista";

export const metadata: Metadata = { title: "Proveedores nuevos · Agente de cuentas por pagar" };

// Proveedores nuevos (#28): enlaces con código único para que alguien fuera de la lista mande su factura.
// Cualquier miembro del equipo puede crearlos: lo que llega por un enlace siempre lo decide una persona.
export default async function ProveedoresPage() {
  const invitaciones = await listarInvitaciones(await obtenerAlmacenInvitaciones(), relojSistema().ahora());
  const activas = invitaciones.filter((i) => i.estado === "activa").length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Beneficiarios fuera de la lista</span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Proveedores nuevos</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Comparte un enlace con código único para que un proveedor o contratista que aún no está en la lista mande su factura. Llega a la misma
            bandeja y siempre se escala: una persona decide si se paga y si se agrega a la lista.
          </p>
        </div>
        <InvitarProveedor />
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
          descripcion={activas > 0 ? `${activas} ${activas === 1 ? "activo" : "activos"}. Vencen solos y se pueden revocar.` : "Cada enlace vence solo y se puede revocar."}
        />
        {invitaciones.length > 0 ? (
          <ListaInvitaciones invitaciones={invitaciones} />
        ) : (
          <Empty className="border-t py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LinkIcon />
              </EmptyMedia>
              <EmptyTitle>Aún no hay enlaces</EmptyTitle>
              <EmptyDescription>Usa Invitar proveedor y comparte el enlace por correo, WhatsApp o el medio que prefieras.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <TarjetaPie className="flex items-start gap-2">
          <ShieldCheckIcon className="mt-0.5 size-4 flex-none text-pagada-punto" aria-hidden />
          <span>
            El enlace prueba que quien envía tiene el código y es dueño de su correo, no que sea quien cobra. Por eso la regla R11 (remitente
            verificado) nunca se cumple por enlace: todo se escala. Al aprobar con «Agregar a la lista», su correo queda vinculado y sus próximas
            facturas por correo siguen el camino normal.
          </span>
        </TarjetaPie>
      </Tarjeta>
    </>
  );
}
