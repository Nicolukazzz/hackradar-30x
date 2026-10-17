import { PlusIcon, ShieldIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  BarraConfianza,
  Boton,
  ChipRegla,
  Kpi,
  Monto,
  PildoraDecision,
  PildoraResultado,
  Tarjeta,
  TarjetaEncabezado,
  TarjetaPie,
} from "@/app/_componentes";

// /_dev/componentes: catálogo de los componentes compartidos de #6 con datos del lote demo (§11.4).
// Solo en desarrollo: en producción responde 404.

export const metadata: Metadata = { title: "Componentes · desarrollo", robots: { index: false } };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

export default function ComponentesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <header className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted-foreground">Solo en desarrollo · src/app/_componentes</span>
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Componentes compartidos</h1>
        <p className="max-w-[640px] text-[15px] leading-relaxed text-muted-foreground">
          Piezas comunes de las 5 pantallas (especificación §13 y §15). Importarlas desde <code className="font-mono text-sm">@/app/_componentes</code>.
        </p>
      </header>

      <Seccion titulo="PildoraDecision">
        <div className="flex flex-wrap gap-2">
          <PildoraDecision decision="PAGAR" />
          <PildoraDecision decision="FRENAR" />
          <PildoraDecision decision="ESCALAR" />
          <PildoraDecision decision="APROBADA_HUMANO" />
          <PildoraDecision decision="RECHAZADA_HUMANO" />
          <PildoraDecision decision="RECHAZADA_NO_FACTURA" />
        </div>
      </Seccion>

      <Seccion titulo="PildoraResultado (traza R1–R11)">
        <div className="flex flex-wrap gap-2">
          <PildoraResultado resultado="CUMPLE" siFalla="ESCALAR" />
          <PildoraResultado resultado="FALLA" siFalla="FRENAR" />
          <PildoraResultado resultado="FALLA" siFalla="ESCALAR" />
          <PildoraResultado resultado="NO_APLICA" siFalla="ESCALAR" />
          <PildoraResultado resultado="INDETERMINADO" siFalla="FRENAR" />
        </div>
      </Seccion>

      <Seccion titulo="ChipRegla">
        <div className="flex flex-wrap gap-2">
          <ChipRegla texto="R9 · 4.500,00 > 3.000,00" />
          <ChipRegla texto="R5 · +44,4% > 2%" />
          <ChipRegla id="R4" texto="9083 ≠ 4471" />
          <ChipRegla id="R3" texto="Beneficiario nuevo" tono="escalar" />
          <ChipRegla id="R10" texto="Instrucciones al agente" tono="escalar" />
          <ChipRegla id="R2" texto="Duplicada" tono="frenar" />
        </div>
      </Seccion>

      <Seccion titulo="Kpi">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
          <Kpi
            tono="destacado"
            icono={<ShieldIcon className="size-4" aria-hidden />}
            etiqueta="Pagos fuera de reglas"
            valor="0"
            detalle="12 de 12 coinciden con la decisión esperada del set de prueba"
          />
          <Kpi etiqueta="Autonomía" valor="66,7%" detalle="8 de 12 decididas sin intervención humana" />
          <Kpi tono="pagada" etiqueta="Pagadas" valor="5" detalle={<Monto usd={744405} />} />
          <Kpi tono="frenada" etiqueta="Frenadas" valor="3" detalle={<><Monto usd={784000} /> sin pagar</>} />
          <Kpi tono="escalada" etiqueta="Escaladas · esperan a una persona" valor="4" detalle="Revisar aprobaciones →" href="/aprobaciones" />
        </div>
      </Seccion>

      <Seccion titulo="Monto">
        <div className="flex flex-wrap gap-6 text-sm">
          <Monto dinero={{ centavos: 840000000, moneda: "COP" }} />
          <Monto dinero={{ centavos: 3800000, moneda: "MXN" }} />
          <Monto dinero={{ centavos: 2200000, moneda: "BRL" }} />
          <Monto usd={227730} />
          <Monto usd={205405} sinCodigo />
        </div>
      </Seccion>

      <Seccion titulo="BarraConfianza (umbral 90 %)">
        <div className="flex max-w-sm flex-col gap-3">
          <BarraConfianza campo="Número" valor={0.99} />
          <BarraConfianza campo="Concepto" valor={0.94} />
          <BarraConfianza campo="Monto" valor={0.72} />
        </div>
      </Seccion>

      <Seccion titulo="Tarjeta + Boton">
        <Tarjeta>
          <TarjetaEncabezado
            id="ejemplo"
            titulo="Decisiones del lote"
            descripcion="En el orden en que el agente las procesó. Montos convertidos a USD con la tasa fija del periodo."
          >
            <Boton variante="secundaria">Exportar registro</Boton>
            <Boton variante="primaria">
              <PlusIcon aria-hidden />
              Procesar facturas nuevas
            </Boton>
          </TarjetaEncabezado>
          <div className="flex flex-wrap gap-2 border-t border-border px-6 py-5">
            <Boton variante="acento">Guardar como v8</Boton>
            <Boton variante="peligro">Rechazar</Boton>
            <Boton variante="fantasma">Deshacer</Boton>
            <Boton variante="primaria" disabled>
              Aprobar USD 2.980,00
            </Boton>
          </div>
          <TarjetaPie>
            <span className="font-semibold text-foreground">Cómo combina las reglas:</span> si falla una regla de frenar → Frenar · si falla una
            regla de escalar → Escalar · si todas cumplen → Pagar · ante cualquier duda → Escalar, nunca Pagar
          </TarjetaPie>
        </Tarjeta>
      </Seccion>
    </>
  );
}
