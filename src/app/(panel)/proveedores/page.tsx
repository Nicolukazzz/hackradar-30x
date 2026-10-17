import { BuildingIcon, LinkIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";

import { Tarjeta, TarjetaEncabezado, TarjetaPie } from "@/app/_componentes";
import { obtenerProveedores } from "@/app/_datos/proveedores";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { AsistenteProveedor } from "./_proveedores/asistente-proveedor";
import { CrearEnlace } from "./_proveedores/crear-enlace";
import { ListaEnlaces } from "./_proveedores/lista";
import { ListaProveedores } from "./_proveedores/lista-proveedores";

export const metadata: Metadata = { title: "Proveedores · Agente de cuentas por pagar" };

// Proveedores (#107): a quién puede pagar el agente (nombre, NIT, cuenta, canales, lo acordado). Debajo, los portales
// (#85): enlace + correo + código para que un proveedor suba sus facturas sin cuenta. La app no envía correos.
export default async function ProveedoresPage() {
  const { proveedores, enlaces, crear } = await obtenerProveedores();
  const activos = enlaces.filter((e) => e.estado === "activo").length;
  const proveedoresActivos = proveedores.filter((p) => p.estado === "activo").length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Lista permitida</span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Proveedores</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            El agente solo paga a los proveedores de esta lista, a la cuenta registrada y por lo acordado. Una factura de alguien que no está aquí
            espera a una persona, que puede agregarlo al aprobarla.
          </p>
        </div>
        <AsistenteProveedor permiso={crear} />
      </header>

      <Tarjeta as="section" aria-labelledby="titulo-proveedores">
        <TarjetaEncabezado
          id="titulo-proveedores"
          titulo={
            <span className="flex items-center gap-2">
              <BuildingIcon className="size-[18px]" aria-hidden />
              Proveedores
            </span>
          }
          descripcion={proveedores.length > 0 ? `${proveedoresActivos} de ${proveedores.length} activos.` : "Agrega a quién le pagas: nombre, identificación fiscal y cuenta."}
        />
        {proveedores.length > 0 ? (
          <ListaProveedores proveedores={proveedores} permiso={crear} />
        ) : (
          <Empty className="border-t py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BuildingIcon />
              </EmptyMedia>
              <EmptyTitle>Aún no hay proveedores</EmptyTitle>
              <EmptyDescription>Usa Nuevo proveedor. Mientras la lista esté vacía, toda factura espera a una persona.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Tarjeta>

      <Tarjeta as="section" aria-labelledby="titulo-enlaces">
        <TarjetaEncabezado
          id="titulo-enlaces"
          titulo={
            <span className="flex items-center gap-2">
              <LinkIcon className="size-[18px]" aria-hidden />
              Portal de proveedores
            </span>
          }
          descripcion={
            enlaces.length > 0
              ? `${activos} ${activos === 1 ? "activo" : "activos"}. Cada enlace vence en 30 días; el código se puede cambiar cuando quieras.`
              : "Cada enlace vence en 30 días; el código se puede cambiar cuando quieras."
          }
        >
          <CrearEnlace permiso={crear} />
        </TarjetaEncabezado>
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
