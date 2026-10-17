// Decisión humana sobre una factura escalada (especificación §10).
// Nunca modifica la entrada del agente: agrega una DECISION_HUMANA que apunta a ella.
// Sin reloj: `ahora` llega inyectado.

import { formatearUsd } from "@/dominio/dinero";
import type { Aprobador, Beneficiario, EntradaRegistro } from "@/dominio/tipos";
import type { Repositorio } from "@/repositorio/repositorio";

export type EntradaDecision = {
  ref: string;
  accion: "aprobar" | "rechazar";
  comentario: string;
  /** quién decide: sale de la sesión (o de la elección demo), nunca del body (#25) */
  aprobador_id: string;
  agregar_a_lista?: boolean;
};

export type ResultadoDecision = {
  entrada: EntradaRegistro;
  /** true si fue la primera de dos firmas (queda "1 de 2") */
  parcial: boolean;
  beneficiario_agregado: Beneficiario | null;
};

export class ErrorDecision extends Error {
  constructor(
    readonly estado: 400 | 403 | 404 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorDecision";
  }
}

export const MINIMO_COMENTARIO = 5;

type Firma = { aprobador_id: string; nombre: string; momento: string };

/** Estado humano de una entrada del agente: firmas parciales (1 de 2) y resolución final, si existe. */
export function estadoHumano(registro: readonly EntradaRegistro[], origen: EntradaRegistro) {
  const humanas = registro.filter((e) => e.tipo === "DECISION_HUMANA" && e.entrada_origen === origen.id);
  const final = humanas.find((e) => e.decision === "APROBADA_HUMANO" || e.decision === "RECHAZADA_HUMANO") ?? null;
  const firmas: Firma[] = humanas
    .filter((e) => e.decision === null && e.actor.tipo === "humano")
    .map((e) => (e.actor.tipo === "humano" ? { aprobador_id: e.actor.aprobador_id, nombre: e.actor.nombre, momento: e.momento } : null))
    .filter((f): f is Firma => f !== null);
  return { humanas, final, firmas };
}

/** Última decisión del agente para una ref (si se reprocesó, manda la más nueva). */
export function decisionAgente(registro: readonly EntradaRegistro[], ref: string): EntradaRegistro | null {
  return registro.filter((e) => e.tipo === "DECISION_AGENTE" && e.ref_interna === ref).at(-1) ?? null;
}

function cubre(a: Aprobador, usd: number): boolean {
  return a.limite_usd === null || usd <= a.limite_usd;
}

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** En exclusiva: leer → validar → agregar sin carreras (dos personas decidiendo a la vez sobre la misma factura). */
export async function decidir(input: EntradaDecision, deps: { repo: Repositorio; ahora: string }): Promise<ResultadoDecision> {
  return deps.repo.enExclusiva(() => decidirEnExclusiva(input, deps));
}

async function decidirEnExclusiva(input: EntradaDecision, deps: { repo: Repositorio; ahora: string }): Promise<ResultadoDecision> {
  const { repo, ahora } = deps;
  const [registro, datos, reglas, documento] = await Promise.all([
    repo.registro(),
    repo.datosComunes(),
    repo.reglasVigentes(),
    repo.documento(input.ref),
  ]);

  const origen = decisionAgente(registro, input.ref);
  if (!origen) throw new ErrorDecision(404, `No existe la factura ${input.ref}.`);
  if (origen.decision !== "ESCALAR") {
    throw new ErrorDecision(409, "Solo se decide sobre facturas escaladas. Una factura frenada se corrige y se vuelve a enviar.");
  }
  const { final, firmas } = estadoHumano(registro, origen);
  if (final) {
    const quien = final.actor.tipo === "humano" ? final.actor.nombre : "otra persona";
    throw new ErrorDecision(409, `Esta factura ya fue ${final.decision === "APROBADA_HUMANO" ? "aprobada" : "rechazada"} por ${quien}.`);
  }

  const comentario = input.comentario.trim();
  if (comentario.length < MINIMO_COMENTARIO) {
    throw new ErrorDecision(400, `El comentario es obligatorio (mínimo ${MINIMO_COMENTARIO} caracteres): explica por qué decides así.`);
  }
  const aprobador = datos.aprobadores.find((a) => a.id === input.aprobador_id);
  if (!aprobador) throw new ErrorDecision(403, "Quien decide no está entre los aprobadores de la empresa.");

  const agregar = input.agregar_a_lista === true;
  if (agregar && (input.accion !== "aprobar" || !origen.reglas_que_fallaron.includes("R3"))) {
    throw new ErrorDecision(400, "Agregar a la lista solo es posible al aprobar una factura escalada por beneficiario fuera de la lista (R3).");
  }

  const anio = Number(ahora.slice(0, 4));
  const base = {
    momento: ahora,
    actor: { tipo: "humano" as const, aprobador_id: aprobador.id, nombre: aprobador.nombre },
    tipo: "DECISION_HUMANA" as const,
    ref_interna: origen.ref_interna,
    factura_numero: origen.factura_numero,
    beneficiario: origen.beneficiario,
    canal: origen.canal,
    formato: origen.formato,
    monto_original: origen.monto_original,
    monto_usd_centavos: origen.monto_usd_centavos,
    tasa_usada: origen.tasa_usada,
    reglas_version: reglas.version,
    evaluaciones: [],
    reglas_que_fallaron: origen.reglas_que_fallaron,
    comparaciones: [],
    comentario,
    entrada_origen: origen.id,
    extraccion: null,
    sha256: null,
  };

  if (input.accion === "rechazar") {
    // Rechazar nunca paga: no exige límite. Libera la reserva (§6).
    const entrada: EntradaRegistro = {
      ...base,
      id: await repo.siguienteIdRegistro(anio),
      decision: "RECHAZADA_HUMANO",
      explicacion: `Rechazada por ${aprobador.nombre}: «${comentario}». La reserva volvió al presupuesto.`,
    };
    await repo.agregarEntrada(entrada);
    return { entrada, parcial: false, beneficiario_agregado: null };
  }

  const usd = origen.monto_usd_centavos;
  if (usd === null) {
    throw new ErrorDecision(409, "La factura no tiene un monto confiable (R1): corrige los datos y vuelve a enviarla antes de aprobar.");
  }
  const limite = aprobador.limite_usd === null ? null : `USD ${formatearUsd(aprobador.limite_usd)}`;
  const doble = usd >= reglas.aprobacion.doble_aprobacion_desde_usd;

  let parcial = false;
  let explicacion = `Aprobada por ${aprobador.nombre}: «${comentario}».`;
  if (!doble) {
    if (!cubre(aprobador, usd)) throw new ErrorDecision(403, `Supera tu límite de aprobación (${limite}). Pídele a un aprobador con límite suficiente que la apruebe.`);
  } else if (firmas.length === 0) {
    // Primera firma: puede ser de control (sin límite suficiente) si la segunda sí lo tiene (§10).
    parcial = true;
    explicacion = `Primera aprobación (1 de 2) por ${aprobador.nombre}: «${comentario}». Falta una segunda firma.`;
  } else {
    const primera = firmas[0];
    if (primera?.aprobador_id === aprobador.id) throw new ErrorDecision(409, "La segunda aprobación debe ser de otra persona.");
    const primeraCubre = datos.aprobadores.some((a) => a.id === primera?.aprobador_id && cubre(a, usd));
    if (!cubre(aprobador, usd) && !primeraCubre) {
      throw new ErrorDecision(403, `Supera tu límite de aprobación (${limite}) y la primera firma tampoco lo cubre: al menos una de las dos debe tener límite suficiente.`);
    }
    explicacion = `Aprobada por ${aprobador.nombre} (segunda firma; la primera fue de ${primera?.nombre}): «${comentario}».`;
  }

  // Todo lo que puede fallar al agregar a la lista se valida ANTES de registrar la aprobación.
  let nuevo: Beneficiario | null = null;
  if (agregar) {
    if (parcial) throw new ErrorDecision(400, "El beneficiario se agrega a la lista con la segunda firma, no con la primera.");
    nuevo = beneficiarioDesde(origen, documento);
    if (datos.beneficiarios.some((x) => x.id === nuevo?.id)) throw new ErrorDecision(409, `${nuevo.nombre} ya está en la lista permitida.`);
  }

  const entrada: EntradaRegistro = {
    ...base,
    id: await repo.siguienteIdRegistro(anio),
    decision: parcial ? null : "APROBADA_HUMANO",
    explicacion,
  };
  await repo.agregarEntrada(entrada);
  if (nuevo) await agregarALista(nuevo, origen, entrada, { repo, ahora, aprobador });
  const beneficiario_agregado = nuevo;
  return { entrada, parcial, beneficiario_agregado };
}

/** Beneficiario nuevo con la cuenta de la factura y el canal por el que llegó (§10). Sin escribir nada. */
function beneficiarioDesde(origen: EntradaRegistro, documento: Awaited<ReturnType<Repositorio["documento"]>>): Beneficiario {
  const nombre = origen.beneficiario ?? origen.extraccion?.beneficiario_nombre.valor ?? null;
  const ultimos4 = origen.extraccion?.cuenta_destino_ultimos4.valor ?? null;
  if (!nombre || !ultimos4) throw new ErrorDecision(400, "Sin nombre o cuenta confiables en la factura no se puede agregar a la lista.");
  const rem = documento?.remitente;
  return {
    id: `ben-${slug(nombre)}`,
    nombre,
    pais: "ZZ", // desconocido (ISO 3166 reserva ZZ): completarlo en Reglas
    categoria: "sin clasificar",
    tipo: "proveedor",
    cuenta: { tipo: "cuenta", banco: "sin verificar", numero_enmascarado: `•••• ${ultimos4}`, ultimos4 },
    acuerdo: null, // sin acuerdo, R5 seguirá escalando sus facturas hasta que se registre uno
    limite_mensual_usd: null,
    estado: "activo",
    canales: {
      correos: rem?.tipo === "correo" ? [rem.valor] : [],
      telegram_chat_id: rem?.tipo === "telegram" ? rem.valor : null,
      portal_usuario: rem?.tipo === "portal" ? rem.valor : null,
    },
  };
}

/** Guarda el beneficiario y escribe CAMBIO_BENEFICIARIOS apuntando a la aprobación. */
async function agregarALista(
  b: Beneficiario,
  origen: EntradaRegistro,
  decision: EntradaRegistro,
  { repo, ahora, aprobador }: { repo: Repositorio; ahora: string; aprobador: Aprobador },
): Promise<void> {
  await repo.guardarBeneficiario(b);
  await repo.agregarEntrada({
    id: await repo.siguienteIdRegistro(Number(ahora.slice(0, 4))),
    momento: ahora,
    actor: { tipo: "humano", aprobador_id: aprobador.id, nombre: aprobador.nombre },
    tipo: "CAMBIO_BENEFICIARIOS",
    ref_interna: origen.ref_interna,
    factura_numero: origen.factura_numero,
    beneficiario: b.nombre,
    canal: origen.canal,
    formato: origen.formato,
    monto_original: null,
    monto_usd_centavos: null,
    tasa_usada: null,
    decision: null,
    reglas_version: decision.reglas_version,
    evaluaciones: [],
    reglas_que_fallaron: [],
    comparaciones: [],
    explicacion: `${aprobador.nombre} agregó a ${b.nombre} a la lista permitida (cuenta •••• ${b.cuenta.ultimos4}) al aprobar ${origen.factura_numero ?? origen.ref_interna}.`,
    comentario: decision.comentario,
    entrada_origen: decision.id,
    extraccion: null,
    sha256: null,
  });
}
