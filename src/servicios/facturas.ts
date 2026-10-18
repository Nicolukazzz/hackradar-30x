// GET /api/facturas/:ref (§12, pantalla §13.2 Traza): entrada del agente, documento, extracción,
// reglas evaluadas, línea de tiempo y decisiones humanas.

import { formatearBase } from "@/dominio/dinero";
import { instante } from "@/dominio/reloj";
import { normalizarNombre } from "@/dominio/normalizar";
import type { Aprobador, Beneficiario, DocumentoRecibido, EntradaRegistro, EvaluacionRegla, Extraccion } from "@/dominio/tipos";
import { decisionAgente, estadoHumano } from "@/aprobaciones/decidir";
import { detectarInstrucciones } from "@/reglas/inyeccion";
import { asignarAprobador, responderAntesDe } from "@/reglas/asignacion";
import { CAMPOS_OBLIGATORIOS } from "@/reglas/contexto";
import { observaciones } from "@/reglas/explicar";
import type { Repositorio } from "@/repositorio/repositorio";

import { estadoActual, nombrePais, registroEnBaseDeHoy, type EstadoFactura } from "./comun";

export type HitoLineaTiempo = {
  momento: string | null;
  titulo: string;
  texto: string;
  tono: "neutro" | "pagada" | "frenada" | "escalada" | "humana" | "pendiente";
};

export type AsignacionEscalada = {
  aprobador: Pick<Aprobador, "id" | "nombre" | "rol" | "iniciales">;
  responder_antes_de: string;
  /** el plazo es hoy a las 18:00 (§10) */
  urgente: boolean;
};

export type ResumenReglas = { version: number; cumplen: number; no_aplican: number; frenan: number; escalan: number };

export type RespuestaFactura = {
  entrada: EntradaRegistro;
  documento: (Omit<DocumentoRecibido, "adjuntos"> & { adjuntos: { nombre: string; mime: string }[] }) | null;
  extraccion: Extraccion | null;
  evaluaciones: EvaluacionRegla[];
  estado: EstadoFactura;
  /** ESCALAR pendiente: a quién y para cuándo */
  asignacion: AsignacionEscalada | null;
  /** ESCALAR pendiente: USD reservados del presupuesto */
  reservado_usd: number | null;
  resumen: ResumenReglas;
  observaciones: string[];
  /** fragmentos de instrucciones dirigidas al agente (R10), para resaltarlos en el visor */
  instrucciones_detectadas: string[];
  /** la línea completa de cada hallazgo de R10, para citarla en el aviso "Instrucción embebida" */
  instrucciones_lineas: string[];
  /** "1 de 2" mientras falte la segunda firma */
  /** "1 de 2" mientras falte la segunda firma. `cubre`: el límite de quien firmó alcanza el monto (§10). */
  firmas: { aprobador_id: string; nombre: string; momento: string; cubre: boolean }[];
  requiere_doble_aprobacion: boolean;
  beneficiario_registrado: Pick<Beneficiario, "id" | "nombre" | "pais" | "tipo" | "categoria"> & { pais_nombre: string | null } | null;
  decisiones_humanas: EntradaRegistro[];
  linea_tiempo: HitoLineaTiempo[];
};

const DESCRIPCION_CANAL: Record<string, string> = {
  correo: "Correo a cuentas@nebula.example",
  portal: "Subida al portal de proveedores",
  telegram: "Mensaje de Telegram",
  whatsapp: "Mensaje de WhatsApp",
  carga_manual: "Cargada a mano por el equipo de finanzas",
};

function textoRecepcion(doc: DocumentoRecibido | null, e: EntradaRegistro): string {
  const canal = DESCRIPCION_CANAL[e.canal] ?? e.canal;
  const adjunto = doc?.adjuntos[0];
  if (!adjunto) return `${canal} con los datos en el texto.`;
  let tipo = adjunto.nombre;
  if (adjunto.mime.startsWith("image/")) tipo = "una foto";
  else if (adjunto.mime === "application/pdf") tipo = "PDF adjunto";
  return `${canal} con ${tipo}.`;
}

/** Resumen "v7 · 8 cumplen, 3 escalan" (§13.2). */
export function resumirReglas(evaluaciones: readonly EvaluacionRegla[], version: number): ResumenReglas {
  const falla = (si: "FRENAR" | "ESCALAR") => evaluaciones.filter((x) => x.si_falla === si && x.resultado === "FALLA").length;
  return {
    version,
    cumplen: evaluaciones.filter((x) => x.resultado === "CUMPLE").length,
    no_aplican: evaluaciones.filter((x) => x.resultado === "NO_APLICA").length,
    frenan: falla("FRENAR"),
    // INDETERMINADO siempre escala (§4.2)
    escalan: falla("ESCALAR") + evaluaciones.filter((x) => x.resultado === "INDETERMINADO").length,
  };
}

/**
 * A quién se escaló y para cuándo, recalculado con las mismas funciones del motor (§10).
 * `decidido_en` = el `ahora` con que decidió el motor (el del lote); el registro guarda la hora de llegada.
 */
export function asignacionDe(e: EntradaRegistro, aprobadores: readonly Aprobador[], decidido_en: string = e.momento): AsignacionEscalada | null {
  if (e.decision !== "ESCALAR") return null;
  const id = asignarAprobador(e.evaluaciones, e.monto_usd_centavos, aprobadores);
  const a = aprobadores.find((x) => x.id === id);
  if (!a) return null;
  const base = instante(decidido_en) > instante(e.momento) ? decidido_en : e.momento;
  const plazo = responderAntesDe(e.extraccion?.fecha_vencimiento.valor ?? null, base);
  return {
    aprobador: { id: a.id, nombre: a.nombre, rol: a.rol, iniciales: a.iniciales },
    responder_antes_de: plazo,
    // §10: si el plazo ya pasó o es hoy, queda "hoy 18:00" y se marca urgente.
    urgente: plazo.slice(0, 10) === base.slice(0, 10) && plazo.slice(11, 16) === "18:00",
  };
}

/** Hora con la que decidió el motor: la del lote (escenario) para entradas del lote, la propia para el historial importado. */
export async function decididoEn(repo: Repositorio, e: EntradaRegistro): Promise<string> {
  const esc = await repo.escenario();
  if (!esc) return e.momento;
  const registro = await repo.registro();
  const importada = registro.slice(0, esc.entradas_importadas).some((x) => x.id === e.id);
  return importada ? e.momento : esc.config.ahora;
}

function confianzaMinima(ext: Extraccion | null): number | null {
  if (!ext) return null;
  return Math.min(...CAMPOS_OBLIGATORIOS.map((k) => ext[k].confianza));
}

const TITULO_HUMANA: Record<string, string> = { APROBADA_HUMANO: "Aprobada por persona", RECHAZADA_HUMANO: "Frenada por persona" };

function hitoExtraccion(e: EntradaRegistro, hayInstrucciones: boolean): HitoLineaTiempo {
  const ext = e.extraccion;
  const minima = confianzaMinima(ext);
  let texto = "No se pudieron extraer datos.";
  if (minima !== null) {
    const leidos = CAMPOS_OBLIGATORIOS.filter((k) => ext?.[k].valor !== null).length;
    texto = `${leidos} campos, confianza mínima ${Math.floor(minima * 100)}%.`;
    if (hayInstrucciones) texto += " El texto se trató como dato, no como orden.";
  }
  return { momento: e.momento, titulo: "Datos extraídos", texto, tono: "neutro" };
}

function hitoReglas(e: EntradaRegistro, r: ResumenReglas): HitoLineaTiempo {
  const partes = [`${r.cumplen + r.no_aplican} cumplen o no aplican`];
  if (r.frenan) partes.push(`${r.frenan} frenan`);
  if (r.escalan) partes.push(`${r.escalan} escalan`);
  const fallaron = e.reglas_que_fallaron.length ? ` (${e.reglas_que_fallaron.join(", ")}).` : ".";
  return { momento: e.momento, titulo: `Reglas evaluadas (v${e.reglas_version})`, texto: partes.join(" · ") + fallaron, tono: "neutro" };
}

function hitoDecision(e: EntradaRegistro, quien: string): HitoLineaTiempo {
  if (e.decision === "PAGAR") return { momento: e.momento, titulo: "Pagada", texto: "Cumple todas las reglas: el agente la aprobó solo.", tono: "pagada" };
  if (e.decision === "FRENAR") return { momento: e.momento, titulo: "Frenada", texto: "No se paga. Para pagarla hay que corregir la factura y volver a enviarla.", tono: "frenada" };
  if (e.decision === "RECHAZADA_NO_FACTURA") return { momento: e.momento, titulo: "No es una factura", texto: "Se registró y no entra a las reglas de pago.", tono: "neutro" };
  // Sin total confiable no hay qué reservar (#149): antes decía «el monto reservados».
  const texto =
    e.monto_usd_centavos === null
      ? "Sin un total confiable no se reserva presupuesto: una persona debe confirmar el monto."
      : `${formatearBase(e.monto_usd_centavos, e.moneda_base ?? "USD")} reservados del presupuesto del periodo.`;
  return { momento: e.momento, titulo: `Escalada a ${quien}`, texto, tono: "escalada" };
}

/** Recibida → datos extraídos → reglas → decisión del agente → decisiones humanas → (esperando). */
function lineaDeTiempo(x: {
  e: EntradaRegistro;
  documento: DocumentoRecibido | null;
  resumen: ResumenReglas;
  instrucciones: string[];
  humanas: EntradaRegistro[];
  pendiente: boolean;
  quien: string;
}): HitoLineaTiempo[] {
  const linea: HitoLineaTiempo[] = [
    { momento: x.e.momento, titulo: "Factura recibida", texto: textoRecepcion(x.documento, x.e), tono: "neutro" },
    hitoExtraccion(x.e, x.instrucciones.length > 0),
    hitoReglas(x.e, x.resumen),
    hitoDecision(x.e, x.quien),
    ...x.humanas.map((h): HitoLineaTiempo => ({
      momento: h.momento,
      titulo: (h.decision && TITULO_HUMANA[h.decision]) ?? "Primera firma (1 de 2)",
      texto: h.explicacion,
      tono: "humana",
    })),
  ];
  if (x.pendiente) linea.push({ momento: null, titulo: "Esperando decisión humana", texto: "Nada se paga hasta que una persona responda.", tono: "pendiente" });
  return linea;
}

/**
 * `cuentas`: carga los miembros del equipo que hoy pueden firmar (#51), los mismos que recibe `decidir()`.
 * Solo se llama si hay firmas parciales. Sin ella, `firmas[].cubre` solo reconoce a los de data/aprobadores.json.
 */
export async function obtenerFactura(
  repo: Repositorio,
  ref: string,
  cuentas: () => Promise<readonly Aprobador[]> = async () => [],
): Promise<RespuestaFactura | null> {
  // #86: montos en la moneda base de hoy (una decisión tomada antes de cambiar la moneda se muestra convertida).
  const [registro, datos, documento] = await Promise.all([registroEnBaseDeHoy(repo), repo.datosComunes(), repo.documento(ref)]);
  const e = decisionAgente(registro, ref);
  if (!e) return null;
  const [vigentes, deSuVersion] = await Promise.all([repo.reglasVigentes(), repo.reglasVersion(e.reglas_version)]);
  const reglas = deSuVersion ?? vigentes;
  const { humanas, final, firmas } = estadoHumano(registro, e);
  const { estado } = estadoActual(registro, e);
  const pendiente = e.decision === "ESCALAR" && !final;
  const cuando = await decididoEn(repo, e);
  const asignada = asignacionDe(e, datos.aprobadores, cuando);
  const asignacion = pendiente ? asignada : null;
  const resumen = resumirReglas(e.evaluaciones, e.reglas_version);
  const ext = e.extraccion;
  const textos = [documento?.asunto, documento?.texto_mensaje, ext?.texto_crudo].filter((t): t is string => Boolean(t));
  // El mismo detector que usa R10 en el motor: la traza resalta exactamente lo que hizo fallar la regla.
  const hallazgos = textos.flatMap((t) => detectarInstrucciones(t));
  const instrucciones = [...new Set(hallazgos.map((h) => h.fragmento))];
  // La línea completa donde apareció cada hallazgo, tal como la devuelve el detector (sin re-dividir ni re-normalizar).
  const lineas = [...new Set(hallazgos.map((h) => h.linea.trim()).filter(Boolean))];
  const b = e.beneficiario ? datos.beneficiarios.find((x) => normalizarNombre(x.nombre) === normalizarNombre(e.beneficiario ?? "")) : undefined;

  const quien = asignada?.aprobador.nombre ?? "una persona";
  const firmantes = firmas.length > 0 ? [...datos.aprobadores, ...(await cuentas())] : datos.aprobadores;
  const linea = lineaDeTiempo({ e, documento, resumen, instrucciones, humanas, pendiente, quien });

  return {
    entrada: e,
    documento: documento ? { ...documento, adjuntos: documento.adjuntos.map(({ nombre, mime }) => ({ nombre, mime })) } : null,
    extraccion: ext,
    evaluaciones: e.evaluaciones,
    estado,
    asignacion,
    reservado_usd: pendiente ? e.monto_usd_centavos : null,
    resumen,
    observaciones: e.decision === "RECHAZADA_NO_FACTURA" ? [] : observaciones(e.monto_usd_centavos, reglas, { fecha: ext?.fecha_vencimiento.valor ?? null, ahora: e.momento }),
    instrucciones_detectadas: instrucciones,
    instrucciones_lineas: lineas,
    firmas: firmas.map((f) => {
      const a = firmantes.find((x) => x.id === f.aprobador_id);
      const usd = e.monto_usd_centavos;
      return { ...f, cubre: a !== undefined && usd !== null && (a.limite_usd === null || usd <= a.limite_usd) };
    }),
    // Con las reglas VIGENTES: son las que usa decidir() al aprobar, no las de cuando se escaló.
    requiere_doble_aprobacion: e.monto_usd_centavos !== null && e.monto_usd_centavos >= vigentes.aprobacion.doble_aprobacion_desde_usd,
    beneficiario_registrado: b ? { id: b.id, nombre: b.nombre, pais: b.pais, tipo: b.tipo, categoria: b.categoria, pais_nombre: nombrePais(b.pais) } : null,
    decisiones_humanas: humanas,
    linea_tiempo: linea,
  };
}
