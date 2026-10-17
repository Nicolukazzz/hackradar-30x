import { FileTextIcon, LinkIcon } from "lucide-react";
import type { Metadata } from "next";

import { fechaHora } from "@/app/_componentes";
import { salir } from "@/app/entrar/acciones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { obtenerAlmacenInvitaciones } from "@/invitaciones";
import { misEnvios, vistaInvitacion, type EstadoEnvio } from "@/invitaciones/servicio";
import { MENSAJE_INVALIDA } from "@/invitaciones/tipos";
import { obtenerSesion } from "@/lib/auth/sesion";
import { relojSistema } from "@/lib/reloj-sistema";
import { cn } from "@/lib/utils";
import { obtenerRepositorio } from "@/repositorio";

import { SubirPorEnlace } from "./subir";

export const metadata: Metadata = { title: "Enviar factura · Nébula Studio Inc.", referrer: "no-referrer" };

// Enlace para proveedores nuevos (#28). Desde #81 un proveedor no puede crear cuenta en /entrar: este flujo lo
// reemplaza #85 (llave por proveedor, sin cuenta). Mientras tanto solo sirve a cuentas que ya existen.
// Un enlace inexistente, vencido, revocado o agotado muestra la misma página.

const ESTADO: Record<EstadoEnvio, { texto: string; clase: string }> = {
  en_revision: { texto: "En revisión", clase: "bg-escalada text-escalada-foreground" },
  aprobada: { texto: "Aprobada", clase: "bg-pagada text-pagada-foreground" },
  no_se_pagara: { texto: "No se pagará", clase: "bg-frenada text-frenada-foreground" },
  no_es_factura: { texto: "No es factura", clase: "bg-muted text-muted-foreground" },
};

function SalirBoton({ texto }: { texto: string }) {
  return (
    <form action={salir}>
      <Button type="submit" variant="ghost" className="h-11 px-4">
        {texto}
      </Button>
    </form>
  );
}

function NoSirve({ mensaje, conSesion }: { mensaje: string; conSesion: boolean }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Empty className="max-w-md flex-none rounded-2xl border bg-card py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LinkIcon />
          </EmptyMedia>
          <EmptyTitle>Este enlace no sirve</EmptyTitle>
          <EmptyDescription>{mensaje}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{conSesion ? <SalirBoton texto="Salir" /> : null}</EmptyContent>
      </Empty>
    </main>
  );
}

export default async function PaginaEnviar({ params }: PageProps<"/enviar/[token]">) {
  const [{ token }, sesion] = await Promise.all([params, obtenerSesion()]);
  const inv = sesion ? await vistaInvitacion(await obtenerAlmacenInvitaciones(), token, relojSistema().ahora()) : null;
  if (!sesion || !inv) return <NoSirve mensaje={MENSAJE_INVALIDA} conSesion={sesion !== null} />;
  if (inv.correo_esperado && inv.correo_esperado !== sesion.correo.toLowerCase()) {
    return <NoSirve mensaje="Este enlace es para otra cuenta. Sal y entra con el correo al que te lo enviaron." conSesion />;
  }

  const envios = await misEnvios(await obtenerRepositorio(), inv.id, sesion.correo);
  const quedan = inv.usos_max - inv.usos;

  return (
    <main className="min-h-svh bg-background px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="text-[13px] text-muted-foreground">Nébula Studio Inc. · cuentas por pagar</span>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance">Envía tu factura</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            {inv.nombre_esperado ? `Hola, ${inv.nombre_esperado}. ` : ""}Sube la factura o cuenta de cobro en PDF o foto. Le asignamos una referencia y una
            persona del equipo de finanzas la revisa antes de cualquier pago.
          </p>
          <p className="text-[13px] text-muted-foreground">
            Envías como <span className="font-medium text-foreground">{sesion.correo}</span> · puedes enviar {quedan === 1 ? "1 factura más" : `${quedan} facturas más`} con este
            enlace · vence el {fechaHora(inv.expira_en)}.
          </p>
        </header>

        {quedan > 0 ? <SubirPorEnlace token={token} /> : null}

        <section aria-labelledby="titulo-envios" className="flex flex-col gap-3">
          <h2 id="titulo-envios" className="text-[17px] font-semibold tracking-tight">
            Tus envíos
          </h2>
          {envios.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-borde-fuerte px-5 py-6 text-center text-sm text-muted-foreground">
              Aún no enviaste nada con este enlace.
            </p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">
              {envios.map((e) => (
                <li key={e.ref_interna} className="flex items-start gap-3 border-subtle px-5 py-4 not-first:border-t">
                  <FileTextIcon className="mt-0.5 size-4 flex-none text-muted-foreground" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold">{e.ref_interna}</span>
                      <Badge className={cn("rounded-full", ESTADO[e.estado].clase)}>{ESTADO[e.estado].texto}</Badge>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {e.nombre_archivo} · {fechaHora(e.recibido_en)}
                    </span>
                    <span className="text-sm text-texto-3">{e.mensaje}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>No compartas este enlace: es personal.</span>
          <SalirBoton texto="Salir" />
        </footer>
      </div>
    </main>
  );
}
