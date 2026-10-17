// Aviso a quien aprueba cuando el agente escala una factura (#68, especificación §8 paso 8).
// Plantilla en código desde la entrada del registro, sin LLM: dice quién cobra, cuánto, por qué se
// escaló, a quién se asignó, para cuándo y dónde decidir. Puro: sin I/O ni reloj.

import { formatearUsd } from "@/dominio/dinero";
import type { Aprobador, EntradaRegistro } from "@/dominio/tipos";
import { firmantes } from "@/equipo/servicio";
import type { Miembro } from "@/equipo/tipos";
import { fechaDe, fechaLegible } from "@/reglas/fechas";
import { asignacionDe } from "@/servicios/facturas";

export type Aviso = {
  ref_interna: string;
  asunto: string;
  texto: string;
  /** el plazo es hoy a las 18:00 (§10) */
  urgente: boolean;
};

export type OpcionesAviso = {
  /** aprobadores del dataset (§10): a quién asigna el motor */
  aprobadores: readonly Aprobador[];
  /** hora en que decidió el motor (la del lote en la demo) */
  decidido_en: string;
  /** enlace a la traza de la factura */
  enlace: string;
};

const momentoLegible = (iso: string) => `${fechaLegible(fechaDe(iso))} ${iso.slice(11, 16)}`;

export function armarAviso(e: EntradaRegistro, o: OpcionesAviso): Aviso {
  const asignacion = asignacionDe(e, o.aprobadores, o.decidido_en);
  const monto = e.monto_usd_centavos === null ? "monto por confirmar" : `USD ${formatearUsd(e.monto_usd_centavos)}`;
  const urgente = asignacion?.urgente ?? false;
  const asunto = `${urgente ? "Urgente · " : ""}Escalada: ${e.factura_numero ?? e.ref_interna} · ${e.beneficiario ?? "beneficiario sin leer"} · ${monto}`;

  const lineas = [
    "El agente escaló una factura y espera la decisión de una persona.",
    "",
    e.explicacion,
    "",
    ...(e.comparaciones.length ? ["Reglas que no se cumplieron:", ...e.comparaciones.map((c) => `  · ${c}`), ""] : []),
    `Referencia interna: ${e.ref_interna}`,
    ...(asignacion
      ? [
          `Asignada a: ${asignacion.aprobador.nombre} (${asignacion.aprobador.rol})`,
          `Responder antes de: ${momentoLegible(asignacion.responder_antes_de)}${urgente ? " (urgente)" : ""}`,
        ]
      : []),
    "",
    `Decidir: ${o.enlace}`,
    "",
    "El agente no pagó esta factura: espera a que alguien con permiso de aprobar la apruebe o la rechace en el panel.",
  ];
  return { ref_interna: e.ref_interna, asunto, texto: lineas.join("\n"), urgente };
}

/**
 * A quién avisar: los miembros que hoy pueden firmar (§10, `firmantes`) y cuyo límite cubre el monto.
 * Sin monto confiable, a todos los firmantes. Si nadie lo cubre, a los admins activos. Sin correos repetidos.
 */
export function destinatarios(miembros: readonly Miembro[], monto_usd_centavos: number | null): Miembro[] {
  const pueden = firmantes(miembros);
  const cubren = pueden.filter((m) => monto_usd_centavos === null || m.limite_aprobacion_usd === null || m.limite_aprobacion_usd >= monto_usd_centavos);
  const elegidos = cubren.length ? cubren : pueden.filter((m) => m.rol === "admin");
  const vistos = new Set<string>();
  return elegidos.filter((m) => {
    const correo = m.correo.trim().toLowerCase();
    if (!correo || vistos.has(correo)) return false;
    vistos.add(correo);
    return true;
  });
}
