import { MailIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";

import { Tarjeta, TarjetaEncabezado } from "@/app/_componentes";
import { VolverAjustes } from "@/app/_componentes/ajustes";
import { exigirMiembro } from "@/app/_datos/sesion";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { obtenerAlmacenEquipo } from "@/equipo";
import { obtenerEquipo } from "@/equipo/servicio";
import { relojSistema } from "@/lib/reloj-sistema";

import { Invitaciones } from "./_equipo/invitaciones";
import { CrearEmpleado } from "./_equipo/invitar";
import { Miembros } from "./_equipo/miembros";

export const metadata: Metadata = { title: "Equipo · Agente de cuentas por pagar" };

// Equipo (#51): quién entra al panel y qué puede hacer. Solo administradores.
export default async function EquipoPage() {
  const sesion = await exigirMiembro("administrar");
  const { miembros, invitaciones } = await obtenerEquipo(await obtenerAlmacenEquipo(), relojSistema().ahora());
  const activas = invitaciones.filter((i) => i.estado === "activa").length;

  return (
    <>
      <VolverAjustes />
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[620px] flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Nébula Studio Inc.</span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Equipo</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Solo entra al panel quien está aquí. Los aprobadores deciden las facturas escaladas hasta su límite; solo un administrador cambia
            reglas o el equipo. El agente nunca paga por encima de las reglas, sin importar quién esté conectado.
          </p>
        </div>
        <CrearEmpleado />
      </header>

      <Tarjeta as="section" aria-labelledby="titulo-miembros">
        <TarjetaEncabezado
          id="titulo-miembros"
          titulo={
            <span className="flex items-center gap-2">
              <UsersIcon className="size-[18px]" aria-hidden />
              Miembros
            </span>
          }
          descripcion={`${miembros.length} ${miembros.length === 1 ? "persona" : "personas"} con acceso`}
        />
        <Miembros miembros={miembros} yo={sesion.usuario_id} />
      </Tarjeta>

      <Tarjeta as="section" aria-labelledby="titulo-invitaciones">
        <TarjetaEncabezado
          id="titulo-invitaciones"
          titulo={
            <span className="flex items-center gap-2">
              <MailIcon className="size-[18px]" aria-hidden />
              Pendientes de activar
            </span>
          }
          descripcion={activas > 0 ? `${activas} sin activar. Cada enlace sirve una vez y vence en 72 horas.` : "Cada enlace sirve una vez y vence en 72 horas."}
        />
        {invitaciones.length > 0 ? (
          <Invitaciones invitaciones={invitaciones} />
        ) : (
          <Empty className="border-t py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MailIcon />
              </EmptyMedia>
              <EmptyTitle>No hay cuentas por activar</EmptyTitle>
              <EmptyDescription>Usa Crear empleado: eliges el rol y le llega un correo para crear su contraseña.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Tarjeta>
    </>
  );
}
