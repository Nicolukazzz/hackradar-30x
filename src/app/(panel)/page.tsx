import { DownloadIcon, InboxIcon, ScrollTextIcon } from "lucide-react";
import Link from "next/link";

import { Boton, EncabezadoPagina, Indicador, Monto } from "@/app/_componentes";
import { obtenerBandeja, obtenerVerificacion, type FiltroDecision } from "@/app/_datos/bandeja";
import { obtenerCriteriosExtraccion } from "@/app/_datos/registro";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { AutoActualizar } from "./_bandeja/auto-actualizar";
import { CargarFactura } from "./_bandeja/cargar-factura";
import { BandejaEnVivo } from "./_bandeja/en-vivo";
import { ListaFacturas } from "./_bandeja/lista-facturas";
import { Presupuesto } from "./_bandeja/presupuesto";

// Bandeja (§13.1, #119, #131): una sola pantalla con lo del día a día (qué espera aprobación, qué vence, qué se aprobó y
// qué se frenó), cuánto queda del presupuesto y la lista de facturas con su vista previa. El registro de auditoría
// completo (también cambios de reglas y de proveedores) sigue en /registro, enlazado desde aquí.

const FILTROS: readonly FiltroDecision[] = ["todas", "pagar", "frenar", "escalar"];

export default async function BandejaPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const decisionPedida = typeof sp.decision === "string" ? sp.decision : "todas";
  const decision = (FILTROS as readonly string[]).includes(decisionPedida) ? (decisionPedida as FiltroDecision) : "todas";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : undefined;
  const [b, verificacion, criterios] = await Promise.all([obtenerBandeja({ decision, q, mes }), obtenerVerificacion(), obtenerCriteriosExtraccion()]);
  const { resumen: r } = b;
  const hayFacturas = b.meses.length > 0;
  const moneda = b.moneda_base;

  const acciones = (
    <>
      <AutoActualizar />
      <Boton variante="secundaria" nativeButton={false} render={<Link href="/registro" />}>
        <ScrollTextIcon aria-hidden />
        Registro
      </Boton>
      <Boton variante="secundaria" nativeButton={false} render={<a href="/api/registro/export.csv" download />}>
        <DownloadIcon aria-hidden />
        Exportar
      </Boton>
      <CargarFactura />
    </>
  );

  return (
    <>
      <EncabezadoPagina titulo="Bandeja" descripcion="Las facturas que llegaron, en qué quedó cada una y qué necesita tu atención." acciones={acciones} />
      {/* Se actualiza sola y avisa cuando el agente decide una factura nueva (#125). */}
      <BandejaEnVivo inicial={verificacion.novedades} />

      {hayFacturas ? (
        <>
          <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador
              tono="atencion"
              etiqueta="Por aprobar"
              valor={r.por_aprobar.n}
              detalle={<Monto usd={r.por_aprobar.usd_centavos} moneda={moneda} />}
              pie={r.por_aprobar.n > 0 ? "Esperan tu decisión" : "Nada pendiente"}
              href={r.por_aprobar.n > 0 ? "/pendientes" : undefined}
            />
            <Indicador
              tono={r.vencen_semana.hoy > 0 ? "urgente" : "atencion"}
              etiqueta="Vencen esta semana"
              valor={r.vencen_semana.n}
              detalle={<Monto usd={r.vencen_semana.usd_centavos} moneda={moneda} />}
              pie={r.vencen_semana.hoy > 0 ? `${r.vencen_semana.hoy} vence${r.vencen_semana.hoy === 1 ? "" : "n"} hoy o ya venció` : "Sin urgencias"}
              href={r.vencen_semana.n > 0 ? "/pendientes" : undefined}
            />
            <Indicador
              tono="bien"
              etiqueta="Aprobadas este mes"
              valor={r.aprobadas.n}
              detalle={<Monto usd={r.aprobadas.usd_centavos} moneda={moneda} />}
              pie="Listas para pagar"
            />
            <Indicador
              tono="freno"
              etiqueta="Frenadas"
              valor={r.frenadas.n}
              detalle={<Monto usd={r.frenadas.usd_centavos} moneda={moneda} />}
              pie="Esperan corrección del proveedor"
            />
          </section>

          <Presupuesto datos={b.presupuesto} mes={b.mes} moneda={moneda} />

          <ListaFacturas datos={b} decision={decision} q={q} criterios={criterios} inicial={typeof sp.f === "string" ? sp.f : null} />
        </>
      ) : (
        <Empty className="flex-none rounded-2xl border bg-card py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay facturas</EmptyTitle>
            <EmptyDescription>Cuando lleguen por correo, Telegram o el portal de proveedores aparecerán aquí solas. También puedes cargar una a mano.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
