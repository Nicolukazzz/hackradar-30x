// Contexto base para probar una regla aislada: FAC-1041 de Ana María Gómez (pasa todo).
// Cada test cambia solo lo que necesita con `ctx({ ... })` / `conExt({ ... })`.

import { cargarDatosComunes, type DatosComunes, reglasVersion, tasasDelPeriodo } from "@/dominio/cargar";
import { normalizarNombre } from "@/dominio/normalizar";
import type { Beneficiario, Campo, DocumentoRecibido, EvaluacionRegla, Extraccion, IdRegla } from "@/dominio/tipos";
import type { ContextoRegla } from "@/reglas/contexto";
import { procesarLote, type ResultadoLote } from "@/reglas/motor";
import { estadoInicial } from "@/reglas/presupuesto";

import { cargarGolden } from "./escenario";

export const AHORA = "2026-10-16T09:24:00-05:00";

export function campo<T>(valor: T | null, confianza = 1): Campo<T> {
  return { valor, confianza, fuente: "parser" };
}

let datos: DatosComunes | undefined;
export async function datosComunes(): Promise<DatosComunes> {
  datos ??= await cargarDatosComunes();
  return datos;
}

export function beneficiario(d: DatosComunes, nombre: string): Beneficiario {
  const b = d.beneficiarios.find((x) => normalizarNombre(x.nombre) === normalizarNombre(nombre));
  if (!b) throw new Error(`sin beneficiario ${nombre}`);
  return b;
}

export function extBase(): Extraccion {
  return {
    es_factura: campo(true),
    beneficiario_nombre: campo("Ana María Gómez"),
    numero: campo("FAC-1041"),
    monto_total: campo({ centavos: 840000000, moneda: "COP" }),
    fecha_emision: campo("2026-10-10"),
    fecha_vencimiento: campo("2026-10-25"),
    cuenta_destino_ultimos4: campo("3021"),
    concepto: campo("Diseño de producto — octubre"),
    referencia_acuerdo: campo("CT-AMG"),
    idioma: "es",
    texto_crudo: "CUENTA DE COBRO N.º FAC-1041",
    senales_llm: { instrucciones_sospechosas: [] },
    proveedor_llm: "ninguno",
  };
}

export function docBase(): DocumentoRecibido {
  return {
    canal: "portal",
    remitente: { tipo: "portal", valor: "ana.gomez" },
    recibido_en: "2026-10-16T09:14:02-05:00",
    adjuntos: [{ nombre: "FAC-1041.pdf", mime: "application/pdf" }],
    ref_interna: "INT-2026-000001",
    sha256: "a".repeat(64),
    formato: "pdf",
    beneficiario_remitente_id: "ben-ana-maria-gomez",
  };
}

type Cambios = Partial<Omit<ContextoRegla, "ext" | "doc">> & { ext?: Partial<Extraccion>; doc?: Partial<DocumentoRecibido> };

/** Contexto completo; si cambia el nombre del beneficiario en `ext`, se vuelve a buscar en la lista. */
export function ctx(d: DatosComunes, cambios: Cambios = {}): ContextoRegla {
  const reglas = cambios.reglas ?? reglasVersion(d, 7);
  const ext = { ...extBase(), ...cambios.ext };
  const nombre = ext.beneficiario_nombre.valor;
  const ben = nombre ? (d.beneficiarios.find((b) => normalizarNombre(b.nombre) === normalizarNombre(nombre)) ?? null) : null;
  const historial = cambios.historial ?? [];
  return {
    reglas,
    tasas: tasasDelPeriodo(d, "2026-10"),
    beneficiario: ben,
    total_permitidos: 14,
    historial,
    presupuesto: estadoInicial(historial, reglas, "2026-10"),
    ahora: AHORA,
    ...cambios,
    ext,
    doc: { ...docBase(), ...cambios.doc },
  };
}

let lote: Promise<{ lote: ResultadoLote; numeros: (string | null)[] }> | undefined;
/** Resultado del lote demo (golden), para los casos "del lote que dispara la regla". */
export function loteDemo() {
  lote ??= cargarGolden("lote-demo-oct").then((g) => ({
    lote: procesarLote(g.docs, { datos: g.datos, reglas: g.reglas, historial: g.escenario.historial, ahora: g.escenario.config.ahora }),
    numeros: g.docs.map((x) => x.ext.numero.valor),
  }));
  return lote;
}

/** Evaluación de una regla para la n-ésima factura del lote demo con ese número. */
export async function delLote(numero: string, id: IdRegla, n = 0): Promise<EvaluacionRegla> {
  const { lote: l, numeros } = await loteDemo();
  const indices = numeros.flatMap((x, i) => (x === numero ? [i] : []));
  const i = indices[n];
  if (i === undefined) throw new Error(`sin ${numero} en el lote`);
  const e = l.resultados[i]!.evaluaciones.find((x) => x.id === id);
  if (!e) throw new Error(`sin ${id}`);
  return e;
}
