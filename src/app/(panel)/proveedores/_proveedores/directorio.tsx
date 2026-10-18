"use client";

import { ChevronRightIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { fechaCorta, hora } from "@/app/_componentes";
import { BotonRevocar } from "@/app/_componentes/invitacion";
import type { EnlaceConEstado } from "@/app/_datos/proveedores";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Beneficiario } from "@/dominio/tipos";
import type { PermisoUI } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

import { AsistenteProveedor } from "./asistente-proveedor";
import { CrearEnlace } from "./crear-enlace";
import { NuevoCodigo } from "./nuevo-codigo";
import { CambiarEstado } from "./cambiar-estado";

// Proveedores en una sola lista (#119). Antes había dos tablas («Proveedores» y «Portal de proveedores») y no se entendía
// que un proveedor con portal activo no estuviera «en la lista». Ahora cada fila dice dos cosas:
//   1. si el agente puede pagarle solo (En la lista) o la primera factura la decide una persona (Por aprobar);
//   2. si tiene acceso al portal para subir facturas.

type Fila =
  | { tipo: "lista"; b: Beneficiario; portal: EnlaceConEstado | null }
  | { tipo: "nuevo"; enlace: EnlaceConEstado };

type Filtro = "todos" | "lista" | "nuevo";

function filas(proveedores: Beneficiario[], enlaces: EnlaceConEstado[]): Fila[] {
  const activos = enlaces.filter((e) => e.estado === "activo");
  const usados = new Set<string>();
  const deLista: Fila[] = proveedores.map((b) => {
    const correos = b.canales.correos.map((c) => c.toLowerCase());
    const portal = activos.find((e) => e.beneficiario_id === b.id || correos.includes(e.correo)) ?? null;
    if (portal) usados.add(portal.id);
    return { tipo: "lista", b, portal };
  });
  const nuevos: Fila[] = activos.filter((e) => !usados.has(e.id)).map((enlace) => ({ tipo: "nuevo", enlace }));
  return [...nuevos, ...deLista];
}

function EstadoPago({ fila }: { fila: Fila }) {
  if (fila.tipo === "nuevo") return <Badge className="bg-escalada text-escalada-foreground">Por aprobar</Badge>;
  return fila.b.estado === "activo" ? (
    <Badge className="bg-pagada text-pagada-foreground">En la lista</Badge>
  ) : (
    <Badge className="bg-muted text-muted-foreground">Inactivo</Badge>
  );
}

function EstadoPortal({ portal }: { portal: EnlaceConEstado | null }) {
  if (!portal) return <span className="text-[13px] text-muted-foreground">Sin acceso al portal</span>;
  return (
    <span className="flex flex-col gap-0.5 text-[13px]">
      <span className="font-medium text-foreground">Portal activo</span>
      <span className="text-muted-foreground">{portal.ultimo_acceso ? `Entró el ${fechaCorta(portal.ultimo_acceso)}` : "Todavía no entra"}</span>
    </span>
  );
}

/** Borrar para siempre un acceso revocado o vencido (o todos). */
function BorrarAccesos({ ids, texto }: { ids: string[]; texto: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  function borrar() {
    iniciar(async () => {
      const fallidos = (
        await Promise.all(ids.map((id) => fetch(`/api/proveedores/enlaces/${id}?definitivo=1`, { method: "DELETE" }).then((r) => r.ok)))
      ).filter((ok) => !ok).length;
      if (fallidos > 0) toast.error("No se pudieron borrar todos", { description: "Intenta de nuevo." });
      else toast.success(ids.length === 1 ? "Acceso borrado" : `${ids.length} accesos borrados`);
      router.refresh();
    });
  }
  return (
    <Button variant="ghost" className="h-10 gap-1.5 px-3 text-muted-foreground hover:text-frenada-foreground" onClick={borrar} disabled={ocupado}>
      {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <Trash2Icon aria-hidden />}
      {texto}
    </Button>
  );
}

/** Ficha del proveedor (estilo iPhone): al tocar una fila se abre a la derecha con sus datos y todas sus acciones. */
function Ficha({ fila, permiso, onCerrar }: { fila: Fila | null; permiso: PermisoUI; onCerrar: () => void }) {
  const nombre = fila ? (fila.tipo === "lista" ? fila.b.nombre : fila.enlace.nombre) : "";
  const portal = fila ? (fila.tipo === "lista" ? fila.portal : fila.enlace) : null;
  const datos: { etiqueta: string; valor: React.ReactNode }[] = !fila
    ? []
    : fila.tipo === "lista"
      ? [
          { etiqueta: "Identificación fiscal", valor: fila.b.identificacion_fiscal ?? "—" },
          { etiqueta: "Cuenta", valor: <span className="font-mono">•••• {fila.b.cuenta.ultimos4}</span> },
          { etiqueta: "Banco", valor: fila.b.cuenta.banco },
          { etiqueta: "Correos", valor: fila.b.canales.correos.length > 0 ? fila.b.canales.correos.join(", ") : "Ninguno" },
          { etiqueta: "Telegram", valor: fila.b.canales.telegram_chat_id ? "Vinculado" : "No" },
          {
            etiqueta: "Acordado",
            valor: fila.b.acuerdo?.lineas[0] ? `${fila.b.acuerdo.referencia} · ${fila.b.acuerdo.lineas[0].concepto}` : "Sin acuerdo",
          },
        ]
      : [
          { etiqueta: "Correo", valor: fila.enlace.correo },
          { etiqueta: "Acceso creado", valor: fechaCorta(fila.enlace.creado_en) },
        ];
  return (
    <Sheet open={fila !== null} onOpenChange={(a) => !a && onCerrar()}>
      <SheetContent className="w-full gap-5 overflow-y-auto p-6 sm:max-w-md">
        {fila ? (
          <>
            <SheetHeader className="gap-2 p-0">
              <SheetTitle className="text-xl">{nombre}</SheetTitle>
              <SheetDescription render={<div />} className="flex flex-wrap items-center gap-2">
                <EstadoPago fila={fila} />
                <span className="text-[13px] text-muted-foreground">
                  {fila.tipo === "nuevo"
                    ? "Puede enviar facturas; la primera la decide una persona y ahí entra a la lista."
                    : fila.b.estado === "activo"
                      ? "El agente puede pagarle solo si la factura cumple las reglas."
                      : "Desactivado: sus facturas esperan a una persona."}
                </span>
              </SheetDescription>
            </SheetHeader>

            <dl className="flex flex-col overflow-hidden rounded-2xl ring-1 ring-border">
              {datos.map((d) => (
                <div key={d.etiqueta} className="flex items-start justify-between gap-4 px-4 py-3 text-sm not-last:border-b not-last:border-subtle">
                  <dt className="text-muted-foreground">{d.etiqueta}</dt>
                  <dd className="text-right break-words">{d.valor}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-2 rounded-2xl px-4 py-3.5 ring-1 ring-border">
              <span className="text-sm font-medium">Portal de proveedores</span>
              <EstadoPortal portal={portal} />
            </div>

            {permiso.ok ? (
              <div className="flex flex-col gap-1 rounded-2xl p-1.5 ring-1 ring-border [&_button]:w-full [&_button]:justify-start">
                {fila.tipo === "lista" ? <AsistenteProveedor permiso={permiso} proveedor={fila.b} /> : null}
                {portal ? (
                  <>
                    <NuevoCodigo id={portal.id} nombre={nombre} />
                    <BotonRevocar url={`/api/proveedores/enlaces/${portal.id}`} exito="Ya no puede entrar al portal." texto="Quitar acceso al portal" />
                  </>
                ) : fila.tipo === "lista" && fila.b.estado === "activo" ? (
                  <CrearEnlace permiso={permiso} compacto etiqueta="Dar acceso al portal" inicial={{ nombre: fila.b.nombre, correo: fila.b.canales.correos[0] ?? "" }} />
                ) : null}
                {fila.tipo === "lista" ? <CambiarEstado b={fila.b} /> : null}
              </div>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function Directorio({ proveedores, enlaces, permiso }: { proveedores: Beneficiario[]; enlaces: EnlaceConEstado[]; permiso: PermisoUI }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abierta, setAbierta] = useState<string | null>(null);
  const todas = filas(proveedores, enlaces);
  const visibles = todas.filter((f) => filtro === "todos" || f.tipo === filtro);
  const muertos = enlaces.filter((e) => e.estado !== "activo");
  const conteo: Record<Filtro, number> = { todos: todas.length, lista: todas.filter((f) => f.tipo === "lista").length, nuevo: todas.filter((f) => f.tipo === "nuevo").length };
  const opciones: { id: Filtro; texto: string }[] = [
    { id: "todos", texto: "Todos" },
    { id: "lista", texto: "En la lista" },
    { id: "nuevo", texto: "Por aprobar" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Proveedores" className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <div className="flex flex-col gap-3 px-5 pt-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div role="tablist" aria-label="Filtrar proveedores" className="flex w-full rounded-[12px] bg-muted p-1 md:w-auto">
            {opciones.map((o) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={filtro === o.id}
                onClick={() => setFiltro(o.id)}
                className={cn(
                  "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:flex-none",
                  filtro === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.texto}
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{conteo[o.id]}</span>
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">En la lista</span>: el agente puede pagarle solo ·{" "}
            <span className="font-medium text-foreground">Por aprobar</span>: la primera factura la decide una persona
          </p>
        </div>

        {visibles.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-muted-foreground">
            {todas.length === 0 ? "Todavía no hay proveedores. Agrega uno o dale acceso al portal a uno nuevo." : "Ningún proveedor en este grupo."}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col border-t border-border">
            {visibles.map((f) => {
              const clave = f.tipo === "lista" ? f.b.id : f.enlace.id;
              const nombre = f.tipo === "lista" ? f.b.nombre : f.enlace.nombre;
              const detalle =
                f.tipo === "lista"
                  ? [f.b.identificacion_fiscal, `•••• ${f.b.cuenta.ultimos4}`, f.b.canales.correos[0]].filter(Boolean).join(" · ")
                  : f.enlace.correo;
              const portal = f.tipo === "lista" ? f.portal : f.enlace;
              return (
                <li key={clave} className="border-b border-subtle last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setAbierta(clave)}
                    className={cn(
                      "group grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors outline-none hover:bg-superficie-2/70 focus-visible:bg-muted md:grid-cols-[minmax(0,1fr)_128px_190px_16px] md:px-6",
                      f.tipo === "lista" && f.b.estado === "inactivo" && "opacity-70",
                    )}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium">{nombre}</span>
                      <span className="truncate text-[13px] text-muted-foreground">{detalle}</span>
                    </span>
                    <span>
                      <EstadoPago fila={f} />
                    </span>
                    <span className="col-span-2 md:col-span-1">
                      <EstadoPortal portal={portal} />
                    </span>
                    <ChevronRightIcon aria-hidden className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Ficha fila={todas.find((f) => (f.tipo === "lista" ? f.b.id : f.enlace.id) === abierta) ?? null} permiso={permiso} onCerrar={() => setAbierta(null)} />

      {muertos.length > 0 ? (
        <section aria-labelledby="titulo-muertos" className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 md:px-6">
            <h2 id="titulo-muertos" className="text-sm font-medium">
              Accesos que ya no sirven <span className="font-mono text-muted-foreground">{muertos.length}</span>
            </h2>
            {permiso.ok && muertos.length > 1 ? <BorrarAccesos ids={muertos.map((e) => e.id)} texto="Borrar todos" /> : null}
          </div>
          <ul className="flex flex-col border-t border-border">
            {muertos.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 border-b border-subtle px-5 py-3 last:border-b-0 md:px-6">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm">{e.nombre}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {e.correo} · {e.estado === "revocado" ? `revocado el ${fechaCorta(e.revocado_en ?? e.expira_en)}` : `venció el ${fechaCorta(e.expira_en)}, ${hora(e.expira_en)}`}
                  </span>
                </span>
                {permiso.ok ? <BorrarAccesos ids={[e.id]} texto="Borrar" /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
