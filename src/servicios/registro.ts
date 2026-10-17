// GET /api/registro y exportes JSON/CSV (§9, §12, pantalla §13.5). Solo lectura.

import { formatearNumero } from "@/dominio/dinero";
import { normalizarTexto } from "@/dominio/normalizar";
import type { EntradaRegistro } from "@/dominio/tipos";
import type { Repositorio } from "@/repositorio/repositorio";

export type FiltroDecisionRegistro = "todas" | "pagar" | "frenar" | "escalar" | "humanas";

export type DiaRegistro = { fecha: string; entradas: EntradaRegistro[] };

export type RespuestaRegistro = { total: number; total_filtrado: number; dias: DiaRegistro[] };

export async function obtenerRegistro(
  repo: Repositorio,
  f: { decision?: FiltroDecisionRegistro; actor?: "agente" | "humano"; q?: string } = {},
): Promise<RespuestaRegistro> {
  const todas = await repo.registro();
  const q = normalizarTexto(f.q ?? "").trim();
  const pasa = (e: EntradaRegistro) => {
    if (f.actor && e.actor.tipo !== f.actor) return false;
    if (f.decision === "pagar" && e.decision !== "PAGAR") return false;
    if (f.decision === "frenar" && e.decision !== "FRENAR") return false;
    if (f.decision === "escalar" && e.decision !== "ESCALAR") return false;
    if (f.decision === "humanas" && e.tipo !== "DECISION_HUMANA") return false;
    if (q && !normalizarTexto(`${e.id} ${e.ref_interna} ${e.factura_numero ?? ""} ${e.beneficiario ?? ""} ${e.explicacion}`).includes(q)) return false;
    return true;
  };
  // Más nuevas primero; agrupadas por día local del momento (YYYY-MM-DD).
  const filtradas = todas.filter(pasa).sort((a, b) => Date.parse(b.momento) - Date.parse(a.momento));
  const dias: DiaRegistro[] = [];
  for (const e of filtradas) {
    const fecha = e.momento.slice(0, 10);
    const dia = dias.at(-1);
    if (dia?.fecha === fecha) dia.entradas.push(e);
    else dias.push({ fecha, entradas: [e] });
  }
  return { total: todas.length, total_filtrado: filtradas.length, dias };
}

export const COLUMNAS_CSV = [
  "id", "momento", "actor", "ref_interna", "factura_numero", "beneficiario", "monto_original", "moneda",
  "monto_usd", "tasa_usada", "decision", "reglas_que_fallaron", "explicacion", "comentario", "reglas_version",
] as const;

function celda(v: string | number | null): string {
  const t = v === null ? "" : String(v);
  // Evita inyección de fórmulas al abrir en Excel/Sheets (=, +, -, @ al inicio).
  const seguro = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
  return /[",\n\r;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV con las 15 columnas de §9, en orden de inserción. Montos en formato de la UI (es-CO). */
export function registroACsv(entradas: readonly EntradaRegistro[]): string {
  const filas = entradas.map((e) =>
    [
      e.id,
      e.momento,
      e.actor.tipo === "agente" ? "agente" : `${e.actor.nombre} (${e.actor.aprobador_id})`,
      e.ref_interna,
      e.factura_numero,
      e.beneficiario,
      e.monto_original ? formatearNumero(e.monto_original.centavos, !["COP", "CLP"].includes(e.monto_original.moneda)) : null,
      e.monto_original?.moneda ?? null,
      e.monto_usd_centavos === null ? null : formatearNumero(e.monto_usd_centavos),
      e.tasa_usada,
      e.decision,
      e.reglas_que_fallaron.join(" "),
      e.explicacion,
      e.comentario,
      e.reglas_version,
    ]
      .map(celda)
      .join(","),
  );
  return [COLUMNAS_CSV.join(","), ...filas].join("\r\n") + "\r\n";
}
