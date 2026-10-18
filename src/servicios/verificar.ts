// «Por verificar» (Bandeja): facturas escaladas que esperan a una persona porque quien cobra no está en la lista (R3) o
// escribió desde un correo o chat no vinculado (R11). Al verificarlas, el admin aprueba y agrega al proveedor o vincula
// el canal (#110), así las próximas no vuelven a escalar por lo mismo.

import { decisionAgente, estadoHumano } from "@/aprobaciones/decidir";
import { normalizarNombre } from "@/dominio/normalizar";
import type { DocumentoRecibido, Moneda } from "@/dominio/tipos";
import type { Repositorio } from "@/repositorio/repositorio";

import { registroEnBaseDeHoy } from "./comun";

export type PorVerificar = {
  ref_interna: string;
  factura_numero: string | null;
  beneficiario: string | null;
  /** quién la mandó: correo, chat de Telegram o usuario del portal */
  remitente: DocumentoRecibido["remitente"] | null;
  /**
   * proveedor_nuevo: no está en la lista (R3) · agregado_despues: no estaba cuando llegó la factura, pero ya está (#149)
   * · remitente_no_vinculado: proveedor conocido, canal nuevo (R11)
   */
  motivo: "proveedor_nuevo" | "agregado_despues" | "remitente_no_vinculado";
  monto_usd_centavos: number | null;
  moneda_base: Moneda;
  recibido_en: string;
};

export async function porVerificar(repo: Repositorio): Promise<PorVerificar[]> {
  // #86: montos en la moneda base de hoy.
  const registro = await registroEnBaseDeHoy(repo);
  const pendientes = registro.filter(
    (e) =>
      e.tipo === "DECISION_AGENTE" &&
      e.decision === "ESCALAR" &&
      decisionAgente(registro, e.ref_interna) === e &&
      estadoHumano(registro, e).final === null &&
      (e.reglas_que_fallaron.includes("R3") || e.reglas_que_fallaron.includes("R11")),
  );
  const datos = await repo.datosComunes();
  const enLista = new Set(datos.beneficiarios.filter((b) => b.estado === "activo").map((b) => normalizarNombre(b.nombre)));
  const motivo = (e: (typeof pendientes)[number]): PorVerificar["motivo"] => {
    if (!e.reglas_que_fallaron.includes("R3")) return "remitente_no_vinculado";
    return e.beneficiario && enLista.has(normalizarNombre(e.beneficiario)) ? "agregado_despues" : "proveedor_nuevo";
  };
  const filas = await Promise.all(
    pendientes.map(async (e): Promise<PorVerificar> => {
      const doc = await repo.documento(e.ref_interna);
      return {
        ref_interna: e.ref_interna,
        factura_numero: e.factura_numero,
        beneficiario: e.beneficiario,
        remitente: doc?.remitente ?? null,
        motivo: motivo(e),
        monto_usd_centavos: e.monto_usd_centavos,
        moneda_base: e.moneda_base ?? "USD",
        recibido_en: e.momento,
      };
    }),
  );
  // Lo más reciente primero: es lo que la persona acaba de ver llegar.
  return filas.sort((a, b) => b.recibido_en.localeCompare(a.recibido_en));
}

/** Para el aviso «llegó una factura nueva»: cuántas decisiones del agente hay y cuál es la última. */
export async function novedades(repo: Repositorio): Promise<{ total: number; ultima: string | null }> {
  const decisiones = await repo.registro({ tipo: ["DECISION_AGENTE"] });
  return { total: decisiones.length, ultima: decisiones.at(-1)?.ref_interna ?? null };
}
