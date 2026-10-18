// Remitentes por confirmar (2026-10-18): un proveedor de la lista escribió desde un correo, Telegram o WhatsApp que no
// tiene vinculado (R11 falla, R3 cumple). En vez de revisar factura por factura, una persona responde una sola pregunta:
// «¿este remitente es de este proveedor?».
//   Sí → se vincula el canal (CAMBIO_BENEFICIARIOS) y cada factura pendiente de ese remitente se vuelve a evaluar con el
//        motor: si ahora cumple todas las reglas se paga sola; si falla otra, sigue escalada por esa otra razón.
//   No → sus facturas pendientes se rechazan (posible suplantación) con `decidir`, igual que desde la traza.
// Nunca se edita una entrada: la reevaluación agrega otra DECISION_AGENTE para la misma ref y manda la última
// (`decisionAgente`, libro y Bandeja). Sin reloj: `ahora` llega inyectado.

import { esRemitenteInvitacion } from "@/dominio/remitente";
import type { Aprobador, Beneficiario, EntradaRegistro, Moneda } from "@/dominio/tipos";
import { avisarEscaladas } from "@/avisos";
import type { Repositorio } from "@/repositorio/repositorio";
import { procesarLote } from "@/reglas/motor";

import { decidir, decisionAgente, ErrorDecision, estadoHumano } from "./decidir";

export type TipoRemitente = "correo" | "telegram" | "whatsapp";

export type FacturaDelRemitente = {
  ref_interna: string;
  factura_numero: string | null;
  monto_usd_centavos: number | null;
  recibido_en: string;
  /** otras reglas que fallaron además de R11 (si las hay, la factura seguirá escalada tras confirmar) */
  otras_reglas: string[];
};

export type RemitentePorConfirmar = {
  remitente: { tipo: TipoRemitente; valor: string };
  beneficiario_id: string;
  beneficiario: string;
  facturas: FacturaDelRemitente[];
  total_usd_centavos: number;
  moneda_base: Moneda;
};

export type RespuestaRemitente = "si" | "no";

export type EntradaConfirmar = {
  remitente: { tipo: TipoRemitente; valor: string };
  beneficiario_id: string;
  respuesta: RespuestaRemitente;
  /** quién responde: sale de la sesión, nunca del body */
  aprobador: Aprobador;
  /** cuentas que hoy pueden aprobar (para rechazar con `decidir`) */
  cuentas?: readonly Aprobador[];
};

export type ResultadoConfirmar = {
  respuesta: RespuestaRemitente;
  /** decisiones nuevas: reevaluaciones del agente (sí) o rechazos humanos (no) */
  entradas: EntradaRegistro[];
  pagadas: number;
  siguen_escaladas: number;
  frenadas: number;
  rechazadas: number;
};

const valorCanonico = (tipo: TipoRemitente, valor: string) => (tipo === "correo" ? valor.trim().toLowerCase() : valor.trim());
const clave = (tipo: string, valor: string, beneficiario_id: string) => `${tipo}\u0000${valor}\u0000${beneficiario_id}`;

/** Escalada pendiente (última del agente, sin decisión humana ni firmas) que falló R11 con R3 cumpliendo. */
function candidata(registro: readonly EntradaRegistro[], e: EntradaRegistro): string | null {
  if (e.tipo !== "DECISION_AGENTE" || e.decision !== "ESCALAR" || decisionAgente(registro, e.ref_interna) !== e) return null;
  if (!e.reglas_que_fallaron.includes("R11")) return null;
  const { final, firmas } = estadoHumano(registro, e);
  if (final || firmas.length > 0) return null;
  const r3 = e.evaluaciones.find((x) => x.id === "R3");
  return r3?.resultado === "CUMPLE" && typeof r3.datos.beneficiario_id === "string" ? r3.datos.beneficiario_id : null;
}

/** Remitentes no vinculados de proveedores conocidos, con sus facturas pendientes. Lo más reciente primero. */
export async function remitentesPorConfirmar(repo: Repositorio): Promise<RemitentePorConfirmar[]> {
  const [registro, datos] = await Promise.all([repo.registro(), repo.datosComunes()]);
  const grupos = new Map<string, RemitentePorConfirmar>();
  for (const e of registro) {
    const beneficiario_id = candidata(registro, e);
    if (!beneficiario_id) continue;
    const rem = (await repo.documento(e.ref_interna))?.remitente;
    if (!rem || (rem.tipo !== "correo" && rem.tipo !== "telegram" && rem.tipo !== "whatsapp") || esRemitenteInvitacion(rem.valor)) continue;
    // /simular sin confiar en el canal: no es un remitente real que se pueda vincular.
    if (rem.valor.startsWith("no-verificado:")) continue;
    const b = datos.beneficiarios.find((x) => x.id === beneficiario_id);
    if (!b) continue;
    const valor = valorCanonico(rem.tipo, rem.valor);
    const k = clave(rem.tipo, valor, b.id);
    const g = grupos.get(k) ?? { remitente: { tipo: rem.tipo, valor }, beneficiario_id: b.id, beneficiario: b.nombre, facturas: [], total_usd_centavos: 0, moneda_base: e.moneda_base ?? "USD" };
    g.facturas.push({
      ref_interna: e.ref_interna,
      factura_numero: e.factura_numero,
      monto_usd_centavos: e.monto_usd_centavos,
      recibido_en: e.momento,
      otras_reglas: e.reglas_que_fallaron.filter((r) => r !== "R11"),
    });
    g.total_usd_centavos += e.monto_usd_centavos ?? 0;
    grupos.set(k, g);
  }
  const ultima = (g: RemitentePorConfirmar) => g.facturas.reduce((m, f) => (f.recibido_en > m ? f.recibido_en : m), "");
  return [...grupos.values()].sort((a, b) => ultima(b).localeCompare(ultima(a)));
}

function quien(tipo: TipoRemitente, valor: string): string {
  if (tipo === "correo") return `el correo ${valor}`;
  if (tipo === "telegram") return `el chat de Telegram ${valor}`;
  return `el WhatsApp +${valor}`;
}

async function vincular(repo: Repositorio, b: Beneficiario, tipo: TipoRemitente, valor: string, existentes: readonly Beneficiario[]): Promise<void> {
  const dueno = existentes.find(
    (x) =>
      x.id !== b.id &&
      (tipo === "correo" ? x.canales.correos.some((c) => c.toLowerCase() === valor) : tipo === "telegram" ? x.canales.telegram_chat_id === valor : x.canales.whatsapp === valor),
  );
  if (dueno) throw new ErrorDecision(409, `${quien(tipo, valor)} ya está vinculado a ${dueno.nombre}.`);
  if (tipo === "correo") await repo.actualizarBeneficiario({ ...b, canales: { ...b.canales, correos: [...new Set([...b.canales.correos, valor])] } });
  else if (tipo === "telegram") await repo.vincularTelegram(b.id, valor);
  else await repo.vincularWhatsapp(b.id, valor);
}

/** Vuelve a evaluar una factura pendiente con los vínculos de hoy. Sin su propia decisión anterior en el historial. */
async function reevaluar(repo: Repositorio, origen: EntradaRegistro, b: Beneficiario, texto: string, ahora: string): Promise<EntradaRegistro | null> {
  const [doc, datos, reglas, registro] = await Promise.all([repo.documento(origen.ref_interna), repo.datosComunes(), repo.reglasVigentes(), repo.registro()]);
  const ext = origen.extraccion;
  if (!doc || !ext) return null;
  // Sin la propia factura: no es su propio duplicado (R2) ni reserva dos veces su monto (R7, R8).
  const historial = registro.filter((e) => e.ref_interna !== origen.ref_interna);
  const { entradas } = procesarLote([{ doc: { ...doc, beneficiario_remitente_id: b.id }, ext }], { datos, reglas, historial, ahora });
  const nueva = entradas[0];
  if (!nueva) return null;
  const entrada: EntradaRegistro = {
    ...nueva,
    id: await repo.siguienteIdRegistro(Number(ahora.slice(0, 4))),
    entrada_origen: origen.id,
    explicacion: `${nueva.explicacion} Reevaluada: ${texto}.`,
  };
  await repo.agregarEntrada(entrada);
  return entrada;
}

/** Responde «¿este remitente es de este proveedor?» para todas sus facturas pendientes a la vez. */
export async function confirmarRemitente(input: EntradaConfirmar, deps: { repo: Repositorio; ahora: string }): Promise<ResultadoConfirmar> {
  const { repo, ahora } = deps;
  const valor = valorCanonico(input.remitente.tipo, input.remitente.valor);
  const buscar = async () =>
    (await remitentesPorConfirmar(repo)).find((g) => g.remitente.tipo === input.remitente.tipo && g.remitente.valor === valor && g.beneficiario_id === input.beneficiario_id);

  if (input.respuesta === "no") {
    const grupo = await buscar();
    if (!grupo) throw new ErrorDecision(404, "No hay facturas pendientes de ese remitente para ese proveedor.");
    const comentario = `${quien(input.remitente.tipo, valor)} no es de ${grupo.beneficiario}: no se paga (posible suplantación).`;
    const entradas: EntradaRegistro[] = [];
    // `decidir` valida cada una en exclusiva: si otra persona ya la resolvió, se salta esa y se siguen las demás.
    for (const f of grupo.facturas) {
      try {
        const r = await decidir({ ref: f.ref_interna, accion: "rechazar", comentario, aprobador_id: input.aprobador.id, cuentas: input.cuentas ?? [input.aprobador] }, deps);
        entradas.push(r.entrada);
      } catch (e) {
        if (!(e instanceof ErrorDecision && e.estado === 409)) throw e;
      }
    }
    return { respuesta: "no", entradas, pagadas: 0, siguen_escaladas: 0, frenadas: 0, rechazadas: entradas.length };
  }

  const entradas = await repo.enExclusiva(async () => {
    const grupo = await buscar();
    if (!grupo) throw new ErrorDecision(404, "No hay facturas pendientes de ese remitente para ese proveedor.");
    const datos = await repo.datosComunes();
    const b = datos.beneficiarios.find((x) => x.id === grupo.beneficiario_id);
    if (!b || b.estado !== "activo") throw new ErrorDecision(409, "El proveedor ya no está activo en la lista.");
    await vincular(repo, b, input.remitente.tipo, valor, datos.beneficiarios);
    const registro = await repo.registro();
    const primera = decisionAgente(registro, grupo.facturas[0]!.ref_interna)!;
    const texto = `${input.aprobador.nombre} confirmó que ${quien(input.remitente.tipo, valor)} es de ${b.nombre}`;
    await repo.agregarEntrada({
      id: await repo.siguienteIdRegistro(Number(ahora.slice(0, 4))),
      momento: ahora,
      actor: { tipo: "humano", aprobador_id: input.aprobador.id, nombre: input.aprobador.nombre },
      tipo: "CAMBIO_BENEFICIARIOS",
      ref_interna: primera.ref_interna,
      factura_numero: null,
      beneficiario: b.nombre,
      canal: primera.canal,
      formato: primera.formato,
      monto_original: null,
      monto_usd_centavos: null,
      tasa_usada: null,
      decision: null,
      reglas_version: (await repo.reglasVigentes()).version,
      evaluaciones: [],
      reglas_que_fallaron: [],
      comparaciones: [],
      explicacion: `${texto}: sus facturas desde ahí pasan R11. Se volvieron a evaluar ${grupo.facturas.length} pendiente(s).`,
      comentario: null,
      entrada_origen: null,
      extraccion: null,
      sha256: null,
    });
    const nuevas: EntradaRegistro[] = [];
    // En orden de llegada: cada reevaluación ve el presupuesto que dejó la anterior.
    for (const f of [...grupo.facturas].sort((x, y) => x.recibido_en.localeCompare(y.recibido_en))) {
      const origen = decisionAgente(await repo.registro(), f.ref_interna);
      if (!origen) continue;
      if (origen.extraccion?.fecha_emision.valor) await repo.prepararTasas(origen.extraccion.fecha_emision.valor);
      const e = await reevaluar(repo, origen, b, texto, ahora);
      if (e) nuevas.push(e);
    }
    return nuevas;
  });
  // Ya registradas: si alguna sigue escalada (por otra regla), se avisa a quien aprueba. Nunca cambia la decisión.
  avisarEscaladas(entradas, ahora);
  const cuenta = (d: string) => entradas.filter((e) => e.decision === d).length;
  return { respuesta: "si", entradas, pagadas: cuenta("PAGAR"), siguen_escaladas: cuenta("ESCALAR"), frenadas: cuenta("FRENAR"), rechazadas: 0 };
}
