import { DownloadIcon, InboxIcon, ShieldIcon } from "lucide-react";

import { Boton, Kpi, Monto, diaMes, hora, mesAnio, porcentajeUi } from "@/app/_componentes";
import { obtenerBandeja, type FiltroDecision } from "@/app/_datos/bandeja";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { BotonProcesar } from "./_bandeja/boton-procesar";
import { Presupuesto } from "./_bandeja/presupuesto";
import { TablaDecisiones } from "./_bandeja/tabla-decisiones";

// Bandeja de decisiones (especificación §13.1, prototipo pantalla 1).

const FILTROS: readonly FiltroDecision[] = ["todas", "pagar", "frenar", "escalar"];

export default async function BandejaPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const decisionPedida = typeof sp.decision === "string" ? sp.decision : "todas";
  const decision = (FILTROS as readonly string[]).includes(decisionPedida) ? (decisionPedida as FiltroDecision) : "todas";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const b = await obtenerBandeja({ decision, q });
  const { kpis } = b;

  const acciones = (
    <div className="flex flex-wrap items-end gap-2.5">
      <div className="flex flex-col gap-1">
        <label htmlFor="periodo" className="text-xs text-muted-foreground">
          Periodo
        </label>
        <select
          id="periodo"
          defaultValue={b.periodo}
          className="min-h-11 rounded-[10px] border border-borde-fuerte bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value={b.periodo}>{mesAnio(b.periodo)}</option>
        </select>
      </div>
      <Boton variante="secundaria" nativeButton={false} render={<a href="/api/registro/export.csv" download />}>
        <DownloadIcon aria-hidden />
        Exportar registro
      </Boton>
      <BotonProcesar pendientes={b.por_procesar} />
    </div>
  );

  if (kpis.total === 0) {
    return (
      <>
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex max-w-[560px] flex-col gap-1.5">
            <span className="text-[13px] text-muted-foreground">{mesAnio(b.periodo)}</span>
            <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Bandeja de decisiones</h1>
          </div>
          {acciones}
        </header>
        <Empty className="flex-none rounded-2xl border bg-card py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Aún no hay facturas en este periodo</EmptyTitle>
            <EmptyDescription>
              {b.por_procesar > 0
                ? `Llegaron ${b.por_procesar} facturas. Usa Procesar facturas nuevas para que el agente decida cuáles pagar, frenar o escalar.`
                : "Cuando lleguen facturas por correo, Telegram o el portal, aparecerán aquí."}
            </EmptyDescription>
          </EmptyHeader>
          {b.por_procesar > 0 ? (
            <EmptyContent>
              <BotonProcesar pendientes={b.por_procesar} />
            </EmptyContent>
          ) : null}
        </Empty>
      </>
    );
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[560px] flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">
            {mesAnio(b.periodo)}
            {b.procesado_en ? ` · Lote del ${diaMes(b.procesado_en)}` : ""}
          </span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Bandeja de decisiones</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            El agente revisó {kpis.total} facturas{b.procesado_en ? ` a las ${hora(b.procesado_en)}` : ""}. Pagó lo que cumple todas las reglas, frenó lo
            que las rompe y escaló a una persona lo que necesita criterio humano.
          </p>
        </div>
        {acciones}
      </header>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3.5">
        <Kpi
          className="col-span-2 sm:col-span-1"
          tono="destacado"
          icono={<ShieldIcon className="size-4" aria-hidden />}
          etiqueta="Pagos fuera de reglas"
          valor={kpis.pagos_fuera_de_reglas}
          detalle={`${kpis.coinciden} de ${kpis.con_esperado} coinciden con la decisión esperada del set de prueba`}
        />
        <Kpi
          etiqueta="Autonomía"
          valor={porcentajeUi(kpis.autonomia)}
          detalle={`${kpis.autonomas} de ${kpis.total} decididas sin intervención humana`}
        />
        <Kpi tono="pagada" etiqueta="Pagadas" valor={kpis.pagadas.n} detalle={<Monto usd={kpis.pagadas.usd_centavos} />} />
        <Kpi
          tono="frenada"
          etiqueta="Frenadas"
          valor={kpis.frenadas.n}
          detalle={
            <>
              <Monto usd={kpis.frenadas.usd_centavos} /> sin pagar
            </>
          }
        />
        <Kpi
          tono="escalada"
          etiqueta="Escaladas · esperan a una persona"
          valor={kpis.escaladas_pendientes}
          detalle={kpis.escaladas_pendientes > 0 ? "Revisar aprobaciones →" : `Las ${kpis.escaladas.n} ya tienen decisión humana`}
          href="/aprobaciones"
        />
      </section>

      <Presupuesto datos={b.presupuesto} periodo={b.periodo} />

      <TablaDecisiones datos={b} decision={decision} q={q} />
    </>
  );
}
