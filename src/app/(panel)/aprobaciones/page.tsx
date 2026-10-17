import { UserCheckIcon } from "lucide-react";
import Link from "next/link";

import { Kpi, Monto, hora } from "@/app/_componentes";
import { obtenerAprobaciones } from "@/app/_datos/aprobaciones";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatearUsd } from "@/dominio/dinero";

import { OrdenAprobaciones } from "../_aprobaciones/orden";
import { TarjetaAprobacion } from "../_aprobaciones/tarjeta-aprobacion";

// Aprobaciones pendientes (especificación §13.3, prototipo pantalla 3).
// #49: sin roles, toda cuenta puede decidir (permiso siempre ok). Cuando vuelvan los roles (#51) el
// permiso sale de `puede(sesion, 'aprobar')` y el motivo se muestra al lado de los botones.

export default async function AprobacionesPage({ searchParams }: PageProps<"/aprobaciones">) {
  const sp = await searchParams;
  const orden = sp.orden === "monto" ? "monto" : "vencimiento";
  const a = await obtenerAprobaciones(orden);
  const vencenHoy = a.pendientes.filter((t) => t.asignacion?.urgente);
  const primeraHoy = vencenHoy[0];
  const permiso = { ok: true } as const;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[680px] flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Asignadas a ti y a tu equipo</span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Aprobaciones pendientes</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Estas facturas se salen de alguna regla. El agente no las paga por su cuenta: reserva el monto y espera tu decisión. Lo que decidas queda
            en el registro con tu comentario.
          </p>
        </div>
        {a.pendientes.length > 1 ? <OrdenAprobaciones orden={orden} /> : null}
      </header>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-3.5">
        <Kpi etiqueta="Por decidir" valor={a.pendientes.length} />
        <Kpi etiqueta="Reservado del presupuesto" valor={<Monto usd={a.reservado_usd} className="text-[22px] sm:text-[26px]" />} />
        <Kpi
          className="col-span-2 sm:col-span-1"
          tono={primeraHoy ? "escalada" : "normal"}
          etiqueta="Vence hoy"
          valor={
            <span className="block font-sans text-base leading-snug font-semibold">
              {primeraHoy
                ? `${primeraHoy.factura_numero ?? primeraHoy.ref_interna} · ${primeraHoy.beneficiario ?? "sin nombre"}, ${hora(primeraHoy.asignacion?.responder_antes_de ?? "")}`
                : "Nada vence hoy"}
            </span>
          }
          detalle={vencenHoy.length > 1 ? `y ${vencenHoy.length - 1} más` : undefined}
        />
        <Kpi
          className="col-span-2 sm:col-span-1"
          etiqueta="Aprobadores"
          valor={
            <span className="block font-sans text-sm leading-snug font-medium">
              {a.aprobadores
                .map((p) => `${p.nombre} (${p.rol}${p.limite_usd !== null ? `, hasta USD ${formatearUsd(p.limite_usd).replace(/,00$/, "")}` : ""})`)
                .join(" · ")}
            </span>
          }
        />
      </section>

      {a.pendientes.length === 0 ? (
        <Empty className="flex-none rounded-2xl border bg-card py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserCheckIcon />
            </EmptyMedia>
            <EmptyTitle>No hay facturas esperando tu decisión</EmptyTitle>
            <EmptyDescription>
              Cuando el agente escale una factura, aparecerá aquí con la explicación y el plazo para responder. Lo ya decidido está en el{" "}
              <Link href="/registro?decision=humanas" className="font-medium text-link hover:underline">
                registro
              </Link>
              .
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section aria-label="Facturas escaladas" className="flex flex-col gap-4">
          {a.pendientes.map((t) => (
            <TarjetaAprobacion key={t.ref_interna} t={t} permiso={permiso} />
          ))}
        </section>
      )}

      <p className="max-w-[760px] text-[13px] leading-relaxed text-muted-foreground">
        Montos desde <Monto usd={a.doble_aprobacion_desde_usd} /> requieren dos aprobaciones de personas distintas. Un pago aprobado aquí se registra
        como «Aprobada por persona», con el nombre de quien aprobó, su comentario y la traza original del agente.
      </p>
    </>
  );
}
