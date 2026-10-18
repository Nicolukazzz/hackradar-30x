// Proveedores nuevos por confirmar (2026-10-18): alguien que no está en la lista mandó facturas que escalaron por R3
// (llegó por el portal o un enlace de invitación; el resto ya se frena). En vez de marcar «Agregar a la lista» al aprobar
// una factura, una persona responde una sola pregunta: «¿confiar siempre en este proveedor?».
//   Sí → se agrega a la lista con los datos de su factura más reciente (cuenta, NIT, canal) y se aprueban, con `decidir`
//        (límite de quien aprueba y doble firma incluidos), las facturas pendientes que escalaron SOLO por eso (R3, y R11
//        que es su consecuencia). Las que fallaron otra regla siguen escaladas.
//   No → se rechazan todas sus facturas pendientes: si no se confía en quien cobra, ninguna se paga.
// Sin reloj: `ahora` llega inyectado.

import { normalizarNombre } from "@/dominio/normalizar";
import type { Aprobador, Beneficiario, EntradaRegistro, Moneda } from "@/dominio/tipos";
import type { Repositorio } from "@/repositorio/repositorio";

import { extraccionVigente } from "./correcciones";
import { beneficiarioDesde, decidir, decisionAgente, ErrorDecision, estadoHumano } from "./decidir";

/** Reglas que fallan solo porque el proveedor no está en la lista. */
const POR_SER_NUEVO = new Set(["R3", "R11"]);

/** Factura escalada de un proveedor que no está en la lista. */
export type FacturaDeProveedorNuevo = {
  ref_interna: string;
  factura_numero: string | null;
  monto_usd_centavos: number | null;
  moneda_base: Moneda;
  recibido_en: string;
  /** escaló solo por ser nuevo (R3/R11): al confiar se aprueba */
  solo_por_ser_nuevo: boolean;
  otras_reglas: string[];
};

/** Pregunta «¿confiar siempre en este proveedor?» con sus facturas pendientes, agrupadas por nombre. */
export type ProveedorPorConfirmar = {
  /** nombre normalizado: la clave para responder */
  clave: string;
  nombre: string;
  facturas: FacturaDeProveedorNuevo[];
};

/** Respuesta de un admin a la pregunta de un proveedor nuevo. */
export type EntradaConfiar = {
  clave: string;
  respuesta: "si" | "no";
  /** quién responde: sale de la sesión, nunca del body */
  aprobador: Aprobador;
  cuentas?: readonly Aprobador[];
};

/** Proveedor agregado (si fue sí) y cuántas facturas se aprobaron, rechazaron o siguen pendientes por otra regla. */
export type ResultadoConfiar = {
  respuesta: "si" | "no";
  beneficiario: Beneficiario | null;
  aprobadas: number;
  /** quedaron en «1 de 2»: falta la segunda firma */
  primeras_firmas: number;
  rechazadas: number;
  /** siguen escaladas: fallaron otra regla, o quien responde no tiene límite suficiente */
  siguen_pendientes: number;
  entradas: EntradaRegistro[];
};

function pendienteDeProveedorNuevo(registro: readonly EntradaRegistro[], e: EntradaRegistro): boolean {
  if (e.tipo !== "DECISION_AGENTE" || e.decision !== "ESCALAR" || decisionAgente(registro, e.ref_interna) !== e) return false;
  if (!e.reglas_que_fallaron.includes("R3") || !e.beneficiario) return false;
  const { final, firmas } = estadoHumano(registro, e);
  return final === null && firmas.length === 0;
}

/** Proveedores fuera de la lista con facturas escaladas pendientes, el más reciente primero. */
export async function proveedoresPorConfirmar(repo: Repositorio): Promise<ProveedorPorConfirmar[]> {
  const [registro, datos] = await Promise.all([repo.registro(), repo.datosComunes()]);
  const enLista = new Set(datos.beneficiarios.filter((b) => b.estado === "activo").map((b) => normalizarNombre(b.nombre)));
  const grupos = new Map<string, ProveedorPorConfirmar>();
  for (const e of registro) {
    if (!pendienteDeProveedorNuevo(registro, e)) continue;
    const clave = normalizarNombre(e.beneficiario!);
    // Ya se agregó (por otra factura o en Proveedores): no se vuelve a preguntar.
    if (!clave || enLista.has(clave)) continue;
    const g = grupos.get(clave) ?? { clave, nombre: e.beneficiario!, facturas: [] };
    const otras = e.reglas_que_fallaron.filter((r) => !POR_SER_NUEVO.has(r));
    g.facturas.push({
      ref_interna: e.ref_interna,
      factura_numero: e.factura_numero,
      monto_usd_centavos: e.monto_usd_centavos,
      moneda_base: e.moneda_base ?? "USD",
      recibido_en: e.momento,
      solo_por_ser_nuevo: otras.length === 0,
      otras_reglas: otras,
    });
    grupos.set(clave, g);
  }
  const ultima = (g: ProveedorPorConfirmar) => g.facturas.reduce((m, f) => (f.recibido_en > m ? f.recibido_en : m), "");
  return [...grupos.values()].sort((a, b) => ultima(b).localeCompare(ultima(a)));
}

/** Escribe el proveedor nuevo y su CAMBIO_BENEFICIARIOS. En exclusiva: dos personas no lo agregan dos veces. */
async function agregarProveedor(repo: Repositorio, g: ProveedorPorConfirmar, aprobador: Aprobador, ahora: string): Promise<Beneficiario> {
  return repo.enExclusiva(async () => {
    const [registro, datos] = await Promise.all([repo.registro(), repo.datosComunes()]);
    if (datos.beneficiarios.some((b) => normalizarNombre(b.nombre) === g.clave && b.estado === "activo")) {
      throw new ErrorDecision(409, `${g.nombre} ya está en la lista.`);
    }
    // Datos de su factura más reciente (con las correcciones de la persona, si las hubo).
    const reciente = [...g.facturas].sort((a, b) => b.recibido_en.localeCompare(a.recibido_en))[0]!;
    const origen = decisionAgente(registro, reciente.ref_interna);
    if (!origen) throw new ErrorDecision(404, "La factura ya no existe.");
    const b = beneficiarioDesde(origen, await repo.documento(origen.ref_interna), extraccionVigente(registro, origen));
    if (datos.beneficiarios.some((x) => x.id === b.id)) throw new ErrorDecision(409, `Ya hay un proveedor con el id ${b.id}. Revísalo en Proveedores.`);
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
      reglas_version: (await repo.reglasVigentes()).version,
      evaluaciones: [],
      reglas_que_fallaron: [],
      comparaciones: [],
      explicacion: `${aprobador.nombre} decidió confiar siempre en ${b.nombre}: queda en la lista permitida (cuenta •••• ${b.cuenta.ultimos4}). Sus próximas facturas se deciden con las reglas normales.`,
      comentario: null,
      entrada_origen: null,
      extraccion: null,
      sha256: null,
    });
    return b;
  });
}

/** Responde «¿confiar siempre en este proveedor?» para todas sus facturas pendientes a la vez. */
export async function confiarEnProveedor(input: EntradaConfiar, deps: { repo: Repositorio; ahora: string }): Promise<ResultadoConfiar> {
  const { repo, ahora } = deps;
  const g = (await proveedoresPorConfirmar(repo)).find((x) => x.clave === input.clave);
  if (!g) throw new ErrorDecision(404, "No hay facturas pendientes de ese proveedor nuevo.");
  const beneficiario = input.respuesta === "si" ? await agregarProveedor(repo, g, input.aprobador, ahora) : null;

  const entradas: EntradaRegistro[] = [];
  let primeras = 0;
  let sinLimite = 0;
  const comentario =
    input.respuesta === "si" ? `Confiar siempre en ${g.nombre}: se agregó a la lista permitida.` : `No confiar en ${g.nombre}: no está en la lista y no se agrega.`;
  // Sí: solo las que escalaron por ser nuevo. No: todas. En orden de llegada; `decidir` valida cada una (límite, doble firma).
  const cuales = g.facturas.filter((x) => input.respuesta === "no" || x.solo_por_ser_nuevo);
  for (const f of cuales.sort((a, b) => a.recibido_en.localeCompare(b.recibido_en))) {
    try {
      const r = await decidir(
        { ref: f.ref_interna, accion: input.respuesta === "si" ? "aprobar" : "rechazar", comentario, aprobador_id: input.aprobador.id, cuentas: input.cuentas ?? [input.aprobador] },
        deps,
      );
      entradas.push(r.entrada);
      if (r.parcial) primeras++;
    } catch (e) {
      // Supera el límite de quien responde (403), ya la resolvió otra persona (409) o no tiene total (409): sigue pendiente.
      if (!(e instanceof ErrorDecision) || e.estado === 400 || e.estado === 404) throw e;
      if (e.estado === 403) sinLimite++;
    }
  }
  const resueltas = entradas.filter((e) => e.decision !== null);
  return {
    respuesta: input.respuesta,
    beneficiario,
    aprobadas: resueltas.filter((e) => e.decision === "APROBADA_HUMANO").length,
    primeras_firmas: primeras,
    rechazadas: resueltas.filter((e) => e.decision === "RECHAZADA_HUMANO").length,
    siguen_pendientes: g.facturas.length - cuales.length + sinLimite + primeras,
    entradas,
  };
}
