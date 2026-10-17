// R2 No es duplicada (§4.3). Si falla, frena.

import Decimal from "decimal.js";

import { normalizarNombre, normalizarNumeroFactura } from "@/dominio/normalizar";

import { evaluacion } from "./catalogo";
import { afectado, type ContextoRegla, montoUsd, SIN_DATO } from "./contexto";
import { diasEntre, esFechaValida, fechaDe, fechaLegible, horaDe } from "./fechas";
import { type FacturaVigente, facturasVigentes } from "./libro";

type Criterio = "archivo" | "numero" | "hito" | "parecida";

/** "pagada 09:14:10" el mismo día de `ahora`; si no, con fecha: "pagada 08/10/2026 09:30:00". */
function cuando(f: FacturaVigente, ahora: string): string {
  const estado = f.estado === "pagada" ? "pagada" : "escalada, pendiente";
  const dia = fechaDe(f.momento) === fechaDe(ahora) ? "" : `${fechaLegible(fechaDe(f.momento))} `;
  return `${estado} ${dia}${horaDe(f.momento)}, ${f.id}`;
}

export function r02Duplicado(ctx: ContextoRegla) {
  const { ext, doc, reglas, ahora } = ctx;
  const nombre = ext.beneficiario_nombre.valor;
  if (!nombre || afectado(ctx, "beneficiario_nombre")) return evaluacion("R2", "NO_APLICA", SIN_DATO);

  const dup = reglas.duplicados;
  const ben = normalizarNombre(nombre);
  const previas = facturasVigentes(ctx.historial).filter((f) => f.beneficiario === ben);
  const numero = ext.numero.valor && !afectado(ctx, "numero") ? normalizarNumeroFactura(ext.numero.valor) : null;
  const emision =
    ext.fecha_emision.valor && !afectado(ctx, "fecha_emision") && esFechaValida(ext.fecha_emision.valor) ? ext.fecha_emision.valor : null;
  const usd = montoUsd(ctx);
  const hito = ext.hito_numero?.valor ?? null;
  const registradaHace = (f: FacturaVigente) => diasEntre(fechaDe(f.momento), fechaDe(ahora));
  const dias = (f: FacturaVigente) => (emision && f.fecha_emision && esFechaValida(f.fecha_emision) ? diasEntre(f.fecha_emision, emision) : null);

  const criterios: [Criterio, (f: FacturaVigente) => boolean][] = [
    ["archivo", (f) => doc.sha256 !== "" && f.sha256 === doc.sha256],
    // La fecha de emisión la escribe quien cobra: también cuenta cuándo se registró la previa, que no controla.
    ["numero", (f) => numero !== null && f.numero_normalizado === numero && ((dias(f) ?? 0) <= dup.ventana_dias || registradaHace(f) <= dup.ventana_dias)],
    ["hito", (f) => hito !== null && f.hito === hito && f.estado === "pagada"],
    [
      "parecida",
      (f) => {
        const d = dias(f);
        if (usd === null || d === null || d > dup.tolerancia_fecha_dias) return false;
        return new Decimal(f.usd_centavos - usd).abs().lte(new Decimal(usd).times(dup.tolerancia_monto_pct).div(100));
      },
    ],
  ];

  for (const [criterio, coincide] of criterios) {
    const f = previas.find(coincide);
    if (!f) continue;
    const datos = { criterio, coincide_con: f.id, factura_previa: f.numero, momento_previo: f.momento, estado_previo: f.estado, hito };
    const texto: Record<Criterio, string> = {
      archivo: `mismo archivo (sha256) que ${f.numero ?? f.ref_interna} (${cuando(f, ahora)})`,
      numero: `mismo emisor + número ${f.numero} (${cuando(f, ahora)})`,
      hito: `hito ${hito} ya pagado con ${f.numero} (${cuando(f, ahora)})`,
      parecida: `monto ±${dup.tolerancia_monto_pct}% y fecha ±${dup.tolerancia_fecha_dias} días de ${f.numero} (${cuando(f, ahora)})`,
    };
    return evaluacion("R2", "FALLA", texto[criterio], datos);
  }

  const recientes = emision ? previas.filter((f) => (dias(f) ?? 0) <= dup.ventana_dias).length : previas.length;
  const palabra = recientes === 1 ? "factura" : "facturas";
  const texto =
    recientes === 0
      ? `sin facturas de este emisor en ${dup.ventana_dias} días`
      : `${recientes} ${palabra} de este emisor en ${dup.ventana_dias} días, ninguna coincide`;
  return evaluacion("R2", "CUMPLE", texto, { previas_en_ventana: recientes });
}
