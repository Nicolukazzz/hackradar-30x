// R5 Cuadra con lo acordado (§4.3). Si falla, frena; si no se puede asociar, escala (INDETERMINADO).

import Decimal from "decimal.js";

import { diferenciaPct, formatear, porcentaje } from "@/dominio/dinero";
import { normalizarNumeroFactura, normalizarTexto } from "@/dominio/normalizar";
import type { Beneficiario, Extraccion, LineaAcuerdo } from "@/dominio/tipos";

import { evaluacion } from "./catalogo";
import { afectado, type ContextoRegla, desactivada, FUERA_DE_LISTA, r3Falla, SIN_DATO, textoDesactivada } from "./contexto";

/** "2" → "2%" · 2.5 → "2,5%" */
export function tolerancia(pct: number): string {
  return `${String(pct).replace(".", ",")}%`;
}

/** Primero por referencia (código de línea, o referencia del acuerdo si tiene una sola línea); si no, por palabras clave. */
export function lineaAcordada(ben: Beneficiario, ext: Extraccion): { linea: LineaAcuerdo | null; motivo: string } {
  const acuerdo = ben.acuerdo;
  if (!acuerdo) return { linea: null, motivo: "no tiene acuerdo registrado" };
  // "oc 121", "OC-121" y "oc_121" son la misma referencia.
  const ref = ext.referencia_acuerdo?.valor ? normalizarNumeroFactura(ext.referencia_acuerdo.valor) : "";
  if (ref) {
    const porCodigo = acuerdo.lineas.filter((l) => normalizarNumeroFactura(l.codigo) === ref);
    if (porCodigo.length === 1 && porCodigo[0]) return { linea: porCodigo[0], motivo: "referencia" };
    if (acuerdo.lineas.length === 1 && acuerdo.referencia.split("/").map(normalizarNumeroFactura).includes(ref) && acuerdo.lineas[0]) {
      return { linea: acuerdo.lineas[0], motivo: "referencia" };
    }
  }
  const concepto = normalizarTexto(ext.concepto.valor ?? "");
  const candidatas = acuerdo.lineas.filter((l) => l.palabras_clave.some((k) => concepto.includes(normalizarTexto(k))));
  if (candidatas.length === 1 && candidatas[0]) return { linea: candidatas[0], motivo: "palabras clave" };
  return {
    linea: null,
    motivo:
      candidatas.length === 0
        ? `ninguna línea de ${acuerdo.referencia} coincide con el concepto`
        : `${candidatas.length} líneas de ${acuerdo.referencia} coinciden con el concepto`,
  };
}

export function r05Acordado(ctx: ContextoRegla) {
  if (desactivada(ctx, "R5")) return evaluacion("R5", "NO_APLICA", textoDesactivada(ctx));
  if (r3Falla(ctx) || ctx.beneficiario === null) return evaluacion("R5", "NO_APLICA", FUERA_DE_LISTA);
  const total = ctx.ext.monto_total.valor;
  if (!total || afectado(ctx, "monto_total")) return evaluacion("R5", "NO_APLICA", SIN_DATO);

  const { linea, motivo } = lineaAcordada(ctx.beneficiario, ctx.ext);
  if (!linea) return evaluacion("R5", "INDETERMINADO", motivo, { motivo });
  const acordado = formatear(linea.monto);
  if (linea.monto.moneda !== total.moneda) {
    const m = `la factura está en ${total.moneda} y ${linea.codigo} está en ${linea.monto.moneda}`;
    return evaluacion("R5", "INDETERMINADO", m, { motivo: m, referencia: linea.codigo, acordado });
  }

  const tol = ctx.reglas.limites.tolerancia_acordado_pct;
  const dif = diferenciaPct(total.centavos, linea.monto.centavos);
  const hito = ctx.ext.hito_numero?.valor;
  const prefijoHito = hito && linea.hitos_total ? `hito ${hito}/${linea.hitos_total} · ` : "";
  const datos = {
    referencia: linea.codigo,
    acordado,
    cobrado: formatear(total),
    diferencia_pct: dif.toDecimalPlaces(4).toNumber(),
    tolerancia_pct: tol,
    eleccion: motivo,
    hito: hito ?? null,
    hitos_total: linea.hitos_total ?? null,
  };
  if (dif.abs().gt(new Decimal(tol))) {
    return evaluacion("R5", "FALLA", `${porcentaje(dif)} > ${tolerancia(tol)} (${linea.codigo} acordó ${acordado})`, datos);
  }
  const cuadre = dif.isZero() ? `coincide ${porcentaje(dif)}` : `${porcentaje(dif)} ≤ ${tolerancia(tol)}`;
  return evaluacion("R5", "CUMPLE", `${prefijoHito}${cuadre} (${linea.codigo} acordó ${acordado})`, datos);
}
