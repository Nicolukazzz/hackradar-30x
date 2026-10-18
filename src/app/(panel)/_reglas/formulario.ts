// Formulario de reglas (§13.4): texto de la UI ↔ Reglas. Lo usa la pantalla por pasos (#87, #119). Puro: sin React.

import {
  CAMPOS_REQUERIBLES,
  REQUERIDOS_POR_DEFECTO,
  type CampoRequerible,
  type IdRegla,
  type ModoIdentidad,
  type Reglas,
} from "@/dominio/tipos";

import { escribirDecimal, escribirUsd, leerDecimal, leerUsd } from "./numeros";

export const ETIQUETA_REQUISITO: Record<CampoRequerible, string> = {
  beneficiario_nombre: "Nombre de quien cobra",
  numero: "Número de factura",
  fecha_emision: "Fecha de emisión",
  fecha_vencimiento: "Fecha de vencimiento",
  cuenta_destino_ultimos4: "Cuenta destino",
  concepto: "Concepto",
  referencia_acuerdo: "Referencia al acuerdo (OC, contrato)",
  identificacion_fiscal: "NIT o identificación fiscal",
};

export const MODOS_IDENTIDAD: { valor: ModoIdentidad; titulo: string; descripcion: string }[] = [
  { valor: "nombre", titulo: "Por nombre", descripcion: "El nombre de la factura igual al registrado (sin tildes, mayúsculas ni S.A.S.)." },
  { valor: "nombre_y_nit", titulo: "Nombre y NIT", descripcion: "Los dos deben ser del mismo proveedor. Lo más estricto." },
  { valor: "nit", titulo: "Solo NIT", descripcion: "La identificación fiscal manda, aunque el nombre esté escrito distinto." },
];

export type Formulario = {
  automatico: string;
  maximo: string;
  mensual: string;
  tolerancia: string;
  periodo: Reglas["presupuesto"]["periodo"];
  presupuesto: string;
  reservado: boolean;
  ventana: string;
  doble: string;
  activas: Record<IdRegla, boolean>;
  identidad: ModoIdentidad;
  requisitos: CampoRequerible[];
};

export type Errores = Partial<Record<keyof Formulario, string>>;

export function desdeReglas(r: Reglas): Formulario {
  return {
    automatico: escribirUsd(r.limites.pago_automatico_usd),
    maximo: escribirUsd(r.limites.maximo_absoluto_usd),
    mensual: escribirUsd(r.limites.mensual_por_beneficiario_default_usd),
    tolerancia: escribirDecimal(r.limites.tolerancia_acordado_pct),
    periodo: r.presupuesto.periodo,
    presupuesto: escribirUsd(r.presupuesto.monto_usd),
    reservado: r.presupuesto.contar_escalado_como_reservado,
    ventana: String(r.duplicados.ventana_dias),
    doble: escribirUsd(r.aprobacion.doble_aprobacion_desde_usd),
    activas: { ...r.activas },
    identidad: r.identidad?.modo ?? "nombre",
    requisitos: [...(r.requisitos?.obligatorios ?? REQUERIDOS_POR_DEFECTO)],
  };
}

/** Formulario → Reglas candidatas (misma versión base) o errores por campo. */
export function aReglas(f: Formulario, base: Reglas): { reglas: Reglas | null; errores: Errores } {
  const errores: Errores = {};
  const usd = (k: "automatico" | "maximo" | "mensual" | "presupuesto" | "doble") => {
    const v = leerUsd(f[k]);
    if (v === null || v <= 0) errores[k] = "Escribe un monto mayor que 0, por ejemplo 3.000,00.";
    return v ?? 0;
  };
  const automatico = usd("automatico");
  const maximo = usd("maximo");
  const mensual = usd("mensual");
  const presupuesto = usd("presupuesto");
  const doble = usd("doble");
  const tolerancia = leerDecimal(f.tolerancia);
  if (tolerancia === null || tolerancia > 100) errores.tolerancia = "Escribe un porcentaje entre 0 y 100.";
  const ventana = /^\d+$/.test(f.ventana.trim()) ? Number(f.ventana) : null;
  if (ventana === null || ventana < 1 || ventana > 365) errores.ventana = "Escribe un número de días entre 1 y 365.";
  if (!errores.automatico && !errores.maximo && automatico > maximo)
    errores.automatico = `No puede superar el máximo por factura (${escribirUsd(maximo)}).`;
  if (Object.keys(errores).length > 0) return { reglas: null, errores };
  return {
    errores,
    reglas: {
      ...base,
      limites: { pago_automatico_usd: automatico, maximo_absoluto_usd: maximo, mensual_por_beneficiario_default_usd: mensual, tolerancia_acordado_pct: tolerancia ?? 0 },
      presupuesto: { periodo: f.periodo, monto_usd: presupuesto, contar_escalado_como_reservado: f.reservado },
      duplicados: { ...base.duplicados, ventana_dias: ventana ?? base.duplicados.ventana_dias },
      aprobacion: { doble_aprobacion_desde_usd: doble },
      activas: f.activas,
      // Sin cambio respecto a la base, se deja como estaba (las versiones sin `identidad` son "por nombre").
      ...(f.identidad === (base.identidad?.modo ?? "nombre") ? {} : { identidad: { modo: f.identidad } }),
      ...(mismoConjunto(f.requisitos, base.requisitos?.obligatorios ?? REQUERIDOS_POR_DEFECTO)
        ? {}
        : { requisitos: { obligatorios: CAMPOS_REQUERIBLES.filter((c) => f.requisitos.includes(c)) } }),
    },
  };
}

const mismoConjunto = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Igualdad de valores sin importar el orden de las claves (Supabase guarda las reglas en jsonb, que lo cambia). */
function mismoValor(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => mismoValor((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export const iguales = (a: Reglas, b: Reglas) => mismoValor({ ...a, version: 0, editada_por: "", editada_en: "" }, { ...b, version: 0, editada_por: "", editada_en: "" });

/** Huella estable (claves ordenadas) para saber qué valores se simularon. */
export function huellaDe(r: Reglas): string {
  const ordenar = (v: unknown): unknown =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort((a, b) => a.localeCompare(b)).map((k) => [k, ordenar((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(ordenar(r));
}

