import { DownloadIcon, InboxIcon } from "lucide-react";

import { Boton, EncabezadoPagina, Kpi, Monto, porcentajeUi } from "@/app/_componentes";
import { obtenerBandeja, obtenerVerificacion, type FiltroDecision } from "@/app/_datos/bandeja";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { AutoActualizar } from "./_bandeja/auto-actualizar";
import { CargarFactura } from "./_bandeja/cargar-factura";
import { BandejaEnVivo } from "./_bandeja/en-vivo";
import { PorVerificarCaja } from "./_bandeja/por-verificar";
import { Presupuesto } from "./_bandeja/presupuesto";
import { TablaDecisiones } from "./_bandeja/tabla-decisiones";

// Bandeja (§13.1, #119): qué llegó y qué decidió el agente. Se actualiza sola; se filtra por mes, estado y texto.

const FILTROS: readonly FiltroDecision[] = ["todas", "pagar", "frenar", "escalar"];

export default async function BandejaPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const decisionPedida = typeof sp.decision === "string" ? sp.decision : "todas";
  const decision = (FILTROS as readonly string[]).includes(decisionPedida) ? (decisionPedida as FiltroDecision) : "todas";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : undefined;
  const [b, verificacion] = await Promise.all([obtenerBandeja({ decision, q, mes }), obtenerVerificacion()]);
  const { kpis } = b;
  const hayFacturas = b.meses.length > 0;

  const acciones = (
    <>
      <AutoActualizar />
      <Boton variante="secundaria" nativeButton={false} render={<a href="/api/registro/export.csv" download />}>
        <DownloadIcon aria-hidden />
        Exportar
      </Boton>
      <CargarFactura />
    </>
  );

  return (
    <>
      <EncabezadoPagina titulo="Bandeja" descripcion="Las facturas que llegaron y lo que decidió el agente con cada una." acciones={acciones} />
      {/* Se actualiza sola y avisa cuando el agente decide una factura nueva (#125). */}
      <BandejaEnVivo inicial={verificacion.novedades} />
      <PorVerificarCaja filas={verificacion.filas} />

      {!hayFacturas ? (
        <Empty className="flex-none rounded-2xl border bg-card py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay facturas</EmptyTitle>
            <EmptyDescription>Cuando lleguen por correo, Telegram o el portal de proveedores aparecerán aquí solas. También puedes cargar una a mano.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi tono="pagada" etiqueta="Pagadas" valor={kpis.pagadas.n} detalle={<Monto usd={kpis.pagadas.usd_centavos} moneda={b.moneda_base} />} />
            <Kpi tono="frenada" etiqueta="Frenadas" valor={kpis.frenadas.n} detalle={<Monto usd={kpis.frenadas.usd_centavos} moneda={b.moneda_base} />} />
            <Kpi
              tono="escalada"
              etiqueta="Por aprobar"
              valor={kpis.escaladas_pendientes}
              detalle={kpis.escaladas_pendientes > 0 ? "Revisar →" : "Nada pendiente"}
              href={kpis.escaladas_pendientes > 0 ? "/aprobaciones" : undefined}
            />
            <Kpi etiqueta="Decididas solas" valor={porcentajeUi(kpis.total === 0 ? 0 : (kpis.total - kpis.escaladas.n) / kpis.total)} detalle={`${kpis.total - kpis.escaladas.n} de ${kpis.total} sin una persona`} />
          </section>

          <Presupuesto datos={b.presupuesto} mes={b.mes} moneda={b.moneda_base} />

          <TablaDecisiones datos={b} decision={decision} q={q} />
        </>
      )}
    </>
  );
}
