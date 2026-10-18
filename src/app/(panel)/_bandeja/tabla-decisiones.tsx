import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Monto, PildoraDecision, Tarjeta, diaMes, etiquetaFormato, hora } from "@/app/_componentes";
import type { FilaBandeja, FiltroDecision, RespuestaBandeja } from "@/app/_datos/bandeja";

import { FiltrosBandeja } from "./filtros";

// Facturas de la Bandeja (#119): una fila por factura con lo justo para decidir si abrirla (quién, cuánto, en qué
// quedó y por qué en una línea). El detalle completo está en la traza.

/**
 * El motivo en corto: la causa principal de la explicación (§7), sin el «Pagada:» / «Frenada:» del inicio, sin las
 * causas extra («Además, …») ni la nota de reserva. No se corta por puntos: «S.A.S.» no termina una frase.
 */
function motivo(f: FilaBandeja): string {
  let t = f.explicacion;
  const dosPuntos = t.indexOf(": ");
  if (dosPuntos > 0 && dosPuntos < 12) t = t.slice(dosPuntos + 2);
  for (const corte of [" Además, ", " Se reservan ", " Monto por decidir"]) {
    const i = t.indexOf(corte);
    if (i > 0) t = t.slice(0, i);
  }
  t = t.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Estado({ f }: { f: FilaBandeja }) {
  // Lo que importa hoy: si una persona ya resolvió la escalada, se ve eso.
  return <PildoraDecision decision={f.estado} />;
}

export function TablaDecisiones({ datos, decision, q }: { datos: RespuestaBandeja; decision: FiltroDecision; q: string }) {
  const { filas, conteos, meses } = datos;
  return (
    <Tarjeta as="section" aria-labelledby="dec" id="decisiones" className="scroll-mt-20 gap-0 overflow-hidden">
      <h2 id="dec" className="sr-only">
        Facturas
      </h2>
      <FiltrosBandeja meses={meses} conteos={conteos} />

      {filas.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-muted-foreground">
          {q || decision !== "todas" || datos.mes_filtrado ? "Ninguna factura coincide con estos filtros." : "Todavía no hay facturas."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col border-t border-border">
          {filas.map((f) => (
            <li key={f.ref_interna} className="border-b border-subtle last:border-b-0">
              <Link
                href={`/facturas/${f.ref_interna}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-4 transition-colors outline-none hover:bg-superficie-2/70 focus-visible:bg-muted md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_minmax(0,2fr)_auto] md:px-6"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-medium">{f.beneficiario ?? "Proveedor sin identificar"}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    <span className="font-mono">{f.factura_numero ?? f.ref_interna}</span> · {etiquetaFormato(f.formato)} · {diaMes(f.recibido_en)}, {hora(f.recibido_en)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-0.5 md:items-start">
                  <span className="text-[15px] font-semibold">
                    <Monto usd={f.monto_usd_centavos} moneda={f.moneda_base} />
                  </span>
                  {f.monto_original && f.monto_original.moneda !== f.moneda_base ? (
                    <span className="text-xs text-muted-foreground">
                      <Monto dinero={f.monto_original} />
                    </span>
                  ) : null}
                </span>
                <span className="col-span-2 md:col-span-1">
                  <Estado f={f} />
                </span>
                <span className="col-span-2 line-clamp-2 text-[13px] leading-snug text-texto-3 md:col-span-1">{motivo(f)}</span>
                <ChevronRightIcon aria-hidden className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
