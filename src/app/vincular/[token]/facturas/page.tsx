import { FileTextIcon, ReceiptTextIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { fechaHora } from "@/app/_componentes";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { relojSistema } from "@/lib/reloj-sistema";
import { cn } from "@/lib/utils";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { COOKIE_PROVEEDOR, sesionValida } from "@/vinculos/acceso";
import { enlaceActivo, misEnvios, type EstadoEnvio } from "@/vinculos/servicio";

import { CuentaProveedor, SubirFacturas } from "./subir";

export const metadata: Metadata = { title: "Ingrese sus facturas · Portal de proveedores", referrer: "no-referrer" };

// Portal del proveedor (#85), paso 2: subir facturas y ver en qué van. Sin cookie válida vuelve a pedir correo y código.

const ESTADO: Record<EstadoEnvio, { texto: string; clase: string }> = {
  en_revision: { texto: "En revisión", clase: "bg-escalada text-escalada-foreground" },
  aprobada: { texto: "Aprobada", clase: "bg-pagada text-pagada-foreground" },
  no_se_pagara: { texto: "No se pagará", clase: "bg-frenada text-frenada-foreground" },
  no_es_factura: { texto: "No es factura", clase: "bg-muted text-muted-foreground" },
};

export default async function PaginaFacturasProveedor({ params }: PageProps<"/vincular/[token]/facturas">) {
  const { token } = await params;
  const ahora = relojSistema().ahora();
  const enlace = await enlaceActivo(await obtenerAlmacenEnlaces(), token, ahora);
  if (!enlace || !sesionValida((await cookies()).get(COOKIE_PROVEEDOR)?.value, enlace.id, enlace.codigo_hash, ahora)) redirect(`/vincular/${token}`);

  const repo = await obtenerRepositorio();
  const [envios, datos] = await Promise.all([misEnvios(repo, enlace), repo.datosComunes()]);

  return (
    <div className="min-h-svh bg-background">
      {/* Barra superior: a la izquierda para quién factura, a la derecha la cuenta (y cerrar sesión), como en cualquier web. */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-sidebar text-sidebar-foreground" aria-hidden>
              <ReceiptTextIcon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{datos.empresa.nombre}</span>
              <span className="text-xs text-muted-foreground">Portal de proveedores</span>
            </span>
          </div>
          <CuentaProveedor token={token} nombre={enlace.nombre} correo={enlace.correo} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight">Ingrese sus facturas</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Agrega una o varias facturas en PDF o como foto, revisa la lista y pulsa Enviar. El agente revisa cada una al instante y aquí ves en qué va.
          </p>
        </div>

        <section className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6" aria-label="Subir factura">
          <SubirFacturas token={token} />
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="titulo-envios">
          <h2 id="titulo-envios" className="text-lg font-semibold tracking-tight">
            Tus facturas
          </h2>
          {envios.length === 0 ? (
            <Empty className="rounded-2xl border bg-card py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>Todavía no has enviado facturas</EmptyTitle>
                <EmptyDescription>Cuando subas una, aparece aquí con su estado.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col divide-y rounded-2xl border bg-card">
              {envios.map((e) => (
                <li key={e.ref_interna} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{e.nombre_archivo}</span>
                    <span className="text-[13px] text-muted-foreground">
                      <span className="font-mono tabular-nums">{e.ref_interna}</span> · {fechaHora(e.recibido_en)}
                    </span>
                    <span className="text-[13px] text-muted-foreground">{e.mensaje}</span>
                  </span>
                  <Badge className={cn("flex-none", ESTADO[e.estado].clase)}>{ESTADO[e.estado].texto}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
