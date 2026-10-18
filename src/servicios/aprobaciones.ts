// GET /api/aprobaciones (§12, pantalla §13.3): facturas escaladas que esperan a una persona.

import { formatearBase, monedaBase } from "@/dominio/dinero";
import { normalizarNombre } from "@/dominio/normalizar";
import { instante } from "@/dominio/reloj";
import type { Aprobador, Canal, Dinero, EntradaRegistro, Formato, IdRegla, Moneda } from "@/dominio/tipos";
import { canalAVincular, decisionAgente, estadoHumano } from "@/aprobaciones/decidir";
import type { Repositorio } from "@/repositorio/repositorio";

import { descripcionBeneficiario } from "./comun";
import { asignacionDe, type AsignacionEscalada } from "./facturas";

export type TarjetaAprobacion = {
  ref_interna: string;
  factura_numero: string | null;
  canal: Canal;
  formato: Formato;
  recibido_en: string;
  beneficiario: string | null;
  /** "Colombia · contratista" · "nuevo" */
  beneficiario_detalle: string;
  monto_original: Dinero | null;
  monto_usd_centavos: number | null;
  /** #129: confianza con la que se leyó el total (monto_usd null = dudoso o sin leer) */
  monto_confianza: number | null;
  tasa_usada: string | null;
  reglas_que_fallaron: IdRegla[];
  comparaciones: string[];
  /** "Por qué se escaló" (explicación §7 del agente) */
  explicacion: string;
  /** "Si apruebas" */
  si_apruebas: string;
  /** "{n} de 11 reglas cumplen o no aplican" */
  reglas_ok: number;
  reglas_total: number;
  asignacion: AsignacionEscalada | null;
  requiere_doble_aprobacion: boolean;
  firmas: { aprobador_id: string; nombre: string; momento: string }[];
  /** falló R3: se puede agregar el beneficiario a la lista al aprobar */
  puede_agregar_a_lista: boolean;
  /** #86: moneda de `monto_usd_centavos` (la base con la que se decidió) */
  moneda_base: Moneda;
  /** #110: proveedor conocido que escribió desde un canal no vinculado: se puede vincular al aprobar */
  canal_a_vincular: { tipo: "correo" | "telegram"; valor: string } | null;
};

export type RespuestaAprobaciones = {
  pendientes: TarjetaAprobacion[];
  reservado_usd: number;
  aprobadores: Aprobador[];
  doble_aprobacion_desde_usd: number;
  /** #86: moneda de reservado y doble aprobación (la de las reglas vigentes) */
  moneda_base: Moneda;
};

export type OrdenAprobaciones = "vencimiento" | "monto";

function siApruebas(usd: number | null, beneficiario: string | null, reglas: IdRegla[], moneda: Moneda): string {
  const monto = usd === null ? "el monto de la factura" : formatearBase(usd, moneda);
  const a = beneficiario ?? "este beneficiario";
  const extra = [
    reglas.includes("R4") ? "a una cuenta que no es la registrada" : null,
    reglas.includes("R3") ? "a alguien que no está en la lista permitida" : null,
  ].filter(Boolean);
  const riesgo = extra.length ? ", " + extra.join(" y ") : "";
  return `Se paga ${monto} a ${a}${riesgo}. La reserva pasa a pagado y queda en el registro con tu comentario.`;
}

export async function obtenerAprobaciones(repo: Repositorio, orden: OrdenAprobaciones = "vencimiento"): Promise<RespuestaAprobaciones> {
  const [registro, datos, reglas, esc] = await Promise.all([repo.registro(), repo.datosComunes(), repo.reglasVigentes(), repo.escenario()]);
  const importadas = new Set(registro.slice(0, esc?.entradas_importadas ?? 0).map((e) => e.id));
  const decididoEn = (id: string, momento: string) => (esc && !importadas.has(id) ? esc.config.ahora : momento);
  const porNombre = new Map(datos.beneficiarios.map((b) => [normalizarNombre(b.nombre), b]));

  const origenes = new Map<string, EntradaRegistro>();
  const pendientes: TarjetaAprobacion[] = registro
    // Si una ref se reprocesó, manda su última decisión del agente (la que firma decidir.ts): una tarjeta por ref.
    .filter((e) => e.tipo === "DECISION_AGENTE" && e.decision === "ESCALAR" && decisionAgente(registro, e.ref_interna) === e)
    .map((e) => ({ e, h: estadoHumano(registro, e) }))
    .filter(({ h }) => h.final === null)
    .map(({ e, h }) => {
      origenes.set(e.ref_interna, e);
      const b = e.beneficiario ? (porNombre.get(normalizarNombre(e.beneficiario)) ?? null) : null;
      const ok = e.evaluaciones.filter((x) => x.resultado === "CUMPLE" || x.resultado === "NO_APLICA").length;
      return {
        ref_interna: e.ref_interna,
        factura_numero: e.factura_numero,
        canal: e.canal,
        formato: e.formato,
        recibido_en: e.momento,
        beneficiario: e.beneficiario,
        beneficiario_detalle: descripcionBeneficiario(b, null),
        monto_original: e.monto_original,
        monto_usd_centavos: e.monto_usd_centavos,
        monto_confianza: e.extraccion?.monto_total.confianza ?? null,
        tasa_usada: e.tasa_usada,
        reglas_que_fallaron: e.reglas_que_fallaron,
        comparaciones: e.comparaciones,
        explicacion: e.explicacion,
        si_apruebas: siApruebas(e.monto_usd_centavos, e.beneficiario, e.reglas_que_fallaron, e.moneda_base ?? "USD"),
        moneda_base: e.moneda_base ?? "USD",
        reglas_ok: ok,
        reglas_total: e.evaluaciones.length,
        asignacion: asignacionDe(e, datos.aprobadores, decididoEn(e.id, e.momento)),
        requiere_doble_aprobacion: e.monto_usd_centavos !== null && e.monto_usd_centavos >= reglas.aprobacion.doble_aprobacion_desde_usd,
        firmas: h.firmas,
        puede_agregar_a_lista: e.reglas_que_fallaron.includes("R3"),
        canal_a_vincular: null,
      };
    });
  // #110: solo las que fallaron por R11 con R3 cumplido necesitan su documento (quién escribió).
  await Promise.all(
    pendientes.map(async (t) => {
      const origen = origenes.get(t.ref_interna);
      if (!origen?.reglas_que_fallaron.includes("R11") || origen.reglas_que_fallaron.includes("R3")) return;
      const c = canalAVincular(origen, await repo.documento(t.ref_interna));
      t.canal_a_vincular = c ? { tipo: c.tipo, valor: c.valor } : null;
    }),
  );

  const plazo = (t: TarjetaAprobacion) => (t.asignacion ? instante(t.asignacion.responder_antes_de) : Number.MAX_SAFE_INTEGER);
  pendientes.sort((a, b) =>
    orden === "monto" ? (b.monto_usd_centavos ?? 0) - (a.monto_usd_centavos ?? 0) || plazo(a) - plazo(b) : plazo(a) - plazo(b) || (b.monto_usd_centavos ?? 0) - (a.monto_usd_centavos ?? 0),
  );

  return {
    pendientes,
    reservado_usd: reglas.presupuesto.contar_escalado_como_reservado ? pendientes.reduce((s, t) => s + (t.monto_usd_centavos ?? 0), 0) : 0,
    aprobadores: datos.aprobadores,
    doble_aprobacion_desde_usd: reglas.aprobacion.doble_aprobacion_desde_usd,
    moneda_base: monedaBase(reglas),
  };
}
