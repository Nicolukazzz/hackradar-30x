import { describe, expect, it } from "vitest";
import type { z } from "zod";

import {
  AprobadoresSchema,
  BeneficiarioSchema,
  BeneficiariosSchema,
  ConfigEscenarioSchema,
  DineroSchema,
  DocumentoEntranteSchema,
  EmpresaSchema,
  EntradaRegistroSchema,
  EsperadoDocumentoSchema,
  EvaluacionReglaSchema,
  ExtraccionPlanaSchema,
  ExtraccionSchema,
  MetaDocumentoSchema,
  ReglasSchema,
  TablaTasasSchema,
} from "@/dominio/esquemas";
import type {
  Aprobador,
  Beneficiario,
  ConfigEscenario,
  Dinero,
  DocumentoEntrante,
  Empresa,
  EntradaRegistro,
  EsperadoDocumento,
  EvaluacionRegla,
  Extraccion,
  ExtraccionPlana,
  MetaDocumento,
  Reglas,
  TablaTasas,
} from "@/dominio/tipos";

// ---------------------------------------------------------------------------
// Chequeo en compilación: cada esquema produce EXACTAMENTE su tipo de tipos.ts.
// Si alguien cambia uno sin el otro, `npm run typecheck` falla aquí.
// ---------------------------------------------------------------------------
/** Aplana intersecciones (A & B) para comparar formas, no la manera de escribirlas. */
type Plano<T> = T extends object ? { [K in keyof T]: T[K] } : T;
type Igual<A, B> = (<T>() => T extends Plano<A> ? 1 : 2) extends <T>() => T extends Plano<B> ? 1 : 2 ? true : false;
const igual = <A, B>(ok: Igual<A, B>) => ok;

igual<z.infer<typeof DineroSchema>, Dinero>(true);
igual<z.infer<typeof EmpresaSchema>, Empresa>(true);
igual<z.infer<typeof TablaTasasSchema>, TablaTasas>(true);
igual<z.infer<typeof ReglasSchema>, Reglas>(true);
igual<z.infer<typeof BeneficiarioSchema>, Beneficiario>(true);
igual<z.infer<typeof AprobadoresSchema>, Aprobador[]>(true);
igual<z.infer<typeof DocumentoEntranteSchema>, DocumentoEntrante>(true);
igual<z.infer<typeof MetaDocumentoSchema>, MetaDocumento>(true);
igual<z.infer<typeof ExtraccionSchema>, Extraccion>(true);
igual<z.infer<typeof EvaluacionReglaSchema>, EvaluacionRegla>(true);
igual<z.infer<typeof EntradaRegistroSchema>, EntradaRegistro>(true);
igual<z.infer<typeof ExtraccionPlanaSchema>, ExtraccionPlana>(true);
igual<z.infer<typeof EsperadoDocumentoSchema>, EsperadoDocumento>(true);
igual<z.infer<typeof ConfigEscenarioSchema>, ConfigEscenario>(true);

const reglasBase = (): Reglas => ({
  version: 7,
  editada_por: "Laura Méndez",
  editada_en: "2026-10-14T16:20:00-05:00",
  limites: {
    pago_automatico_usd: 300000,
    maximo_absoluto_usd: 1500000,
    mensual_por_beneficiario_default_usd: 300000,
    tolerancia_acordado_pct: 2,
  },
  presupuesto: { periodo: "mensual", monto_usd: 6000000, contar_escalado_como_reservado: true },
  duplicados: { ventana_dias: 45, tolerancia_monto_pct: 1, tolerancia_fecha_dias: 7 },
  extraccion: { confianza_minima: 0.9 },
  aprobacion: { doble_aprobacion_desde_usd: 1000000 },
  activas: { R1: true, R2: true, R3: true, R4: true, R5: true, R6: true, R7: true, R8: true, R9: true, R10: true, R11: true },
});

describe("ReglasSchema", () => {
  it("acepta las reglas v7 de la especificación", () => {
    expect(ReglasSchema.safeParse(reglasBase()).success).toBe(true);
  });

  it("permite desactivar R5 y R8", () => {
    const r = reglasBase();
    r.activas.R5 = false;
    r.activas.R8 = false;
    expect(ReglasSchema.safeParse(r).success).toBe(true);
  });

  it.each(["R1", "R2", "R3", "R4", "R6", "R7", "R9", "R10", "R11"] as const)("no permite desactivar %s", (id) => {
    const r = reglasBase();
    r.activas[id] = false;
    expect(ReglasSchema.safeParse(r).success).toBe(false);
  });

  it("rechaza un límite automático mayor que el máximo absoluto", () => {
    const r = reglasBase();
    r.limites.pago_automatico_usd = 1600000;
    expect(ReglasSchema.safeParse(r).success).toBe(false);
  });

  it("rechaza montos con decimales (dinero siempre en centavos enteros)", () => {
    const r = reglasBase();
    r.limites.pago_automatico_usd = 3000.5;
    expect(ReglasSchema.safeParse(r).success).toBe(false);
  });

  it("es estricto: un campo de más es error", () => {
    expect(ReglasSchema.safeParse({ ...reglasBase(), extra: 1 }).success).toBe(false);
  });

  it("guardas de seguridad: confianza mínima ≥ 50 % y tolerancia de lo acordado ≤ 50 %", () => {
    const base = reglasBase();
    expect(ReglasSchema.safeParse({ ...base, extraccion: { confianza_minima: 0 } }).success).toBe(false);
    expect(ReglasSchema.safeParse({ ...base, extraccion: { confianza_minima: 0.5 } }).success).toBe(true);
    expect(ReglasSchema.safeParse({ ...base, limites: { ...base.limites, tolerancia_acordado_pct: 51 } }).success).toBe(false);
    expect(ReglasSchema.safeParse({ ...base, limites: { ...base.limites, tolerancia_acordado_pct: 50 } }).success).toBe(true);
  });
});

describe("BeneficiariosSchema", () => {
  const ben = (id: string, correo: string): Beneficiario => ({
    id,
    nombre: id,
    pais: "CO",
    categoria: "x",
    tipo: "proveedor",
    cuenta: { tipo: "cuenta", banco: "Banco Cafetal", numero_enmascarado: "•••• 1234", ultimos4: "1234" },
    acuerdo: null,
    limite_mensual_usd: null,
    estado: "activo",
    canales: { correos: [correo], telegram_chat_id: null, portal_usuario: null },
  });

  it("rechaza ids repetidos", () => {
    expect(BeneficiariosSchema.safeParse([ben("a", "a@x.example"), ben("a", "b@x.example")]).success).toBe(false);
  });

  it("rechaza un mismo correo vinculado a dos beneficiarios (R11 sería ambiguo)", () => {
    expect(BeneficiariosSchema.safeParse([ben("a", "c@x.example"), ben("b", "C@x.example")]).success).toBe(false);
  });

  it("rechaza últimos 4 que no son 4 dígitos", () => {
    const b = ben("a", "a@x.example");
    b.cuenta.ultimos4 = "12a4";
    expect(BeneficiarioSchema.safeParse(b).success).toBe(false);
  });
});

describe("EsperadoDocumentoSchema", () => {
  const base: EsperadoDocumento = {
    documento: "documentos/001-x.pdf",
    ref_esperada: "INT-2026-000001",
    decision: "PAGAR",
    reglas_que_fallan: [],
    asignado_a: null,
    responder_antes_de: null,
    trampa: [],
    motivo: "ok",
    extraccion_esperada: {
      es_factura: true,
      beneficiario_nombre: "X",
      numero: "1",
      monto_total: { centavos: 100, moneda: "USD" },
      fecha_emision: "2026-10-01",
      fecha_vencimiento: "2026-10-10",
      cuenta_destino_ultimos4: "1234",
      concepto: "c",
      idioma: "es",
    },
  };

  it("acepta un PAGAR limpio", () => {
    expect(EsperadoDocumentoSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza un PAGAR con reglas que fallan", () => {
    expect(EsperadoDocumentoSchema.safeParse({ ...base, reglas_que_fallan: ["R9"] }).success).toBe(false);
  });

  it("exige asignado y plazo en ESCALAR", () => {
    expect(EsperadoDocumentoSchema.safeParse({ ...base, decision: "ESCALAR", reglas_que_fallan: ["R9"] }).success).toBe(false);
  });
});
