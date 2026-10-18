// Proveedores reales (#107): la empresa crea y edita a quién puede pagar el agente. Cada cambio queda en el registro
// como CAMBIO_BENEFICIARIOS (quién, cuándo y qué cambió). Los canales (correos) son únicos entre proveedores: si dos
// compartieran un correo, R11 no sabría quién escribe.

import { z } from "zod";

import { formatear } from "@/dominio/dinero";
import { MonedaSchema } from "@/dominio/esquemas";
import { normalizarIdentificacion, normalizarNombre, slug, sinPuntoDoble } from "@/dominio/normalizar";
import type { Acuerdo, Aprobador, Beneficiario, EntradaRegistro } from "@/dominio/tipos";
import type { Repositorio } from "@/repositorio/repositorio";

export class ErrorProveedor extends Error {
  constructor(
    readonly estado: 400 | 403 | 404 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorProveedor";
  }
}

const textoCorto = (max: number) => z.string().trim().min(1).max(max);

/** Lo que se escribe en el asistente. El servidor arma el resto (id, cuenta enmascarada, palabras clave). */
export const EntradaProveedorSchema = z.strictObject({
  nombre: z.string().trim().min(2, "El nombre necesita al menos 2 letras.").max(120),
  identificacion_fiscal: z.string().trim().max(40).nullable(),
  pais: z.string().trim().regex(/^[A-Z]{2}$/, "País: código de 2 letras (CO, MX, US…)."),
  tipo: z.enum(["contratista", "proveedor"]),
  categoria: z.string().trim().max(60).nullable(),
  cuenta: z.strictObject({
    tipo: z.enum(["CLABE", "cuenta", "PIX", "CBU", "ACH"]),
    banco: textoCorto(80),
    ultimos4: z.string().regex(/^\d{4}$/, "Cuenta: escribe los últimos 4 dígitos."),
  }),
  correos: z.array(z.email("Hay un correo que no es válido.").transform((c) => c.toLowerCase())).max(10),
  /** centavos USD; null = el límite mensual por defecto de las reglas */
  limite_mensual_usd: z.int().positive().nullable(),
  acuerdo: z
    .strictObject({
      referencia: textoCorto(40),
      concepto: textoCorto(120),
      monto: z.strictObject({ centavos: z.int().positive(), moneda: MonedaSchema }),
    })
    .nullable(),
  estado: z.enum(["activo", "inactivo"]),
});
export type EntradaProveedor = z.infer<typeof EntradaProveedorSchema>;

const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "y", "para", "por", "en", "mensual", "servicio", "servicios"]);

/** Un acuerdo de una sola línea: la referencia es también el código, así R5 la encuentra por referencia o por concepto. */
function acuerdoDe(a: NonNullable<EntradaProveedor["acuerdo"]>): Acuerdo {
  const palabras = [...new Set(normalizarNombre(a.concepto).toLowerCase().split(/\s+/))].filter((p) => p.length > 2 && !PALABRAS_VACIAS.has(p));
  return {
    tipo: "contrato_mensual",
    referencia: a.referencia,
    descripcion: a.concepto,
    lineas: [{ codigo: a.referencia, concepto: a.concepto, palabras_clave: palabras.length > 0 ? palabras : [a.concepto.toLowerCase()], monto: a.monto }],
  };
}

/** Nombre, NIT y correos no pueden repetirse con otro proveedor. */
function validarUnicos(b: Beneficiario, otros: readonly Beneficiario[]): void {
  const nombre = normalizarNombre(b.nombre);
  const igualNombre = otros.find((o) => normalizarNombre(o.nombre) === nombre);
  if (igualNombre) throw new ErrorProveedor(409, sinPuntoDoble(`Ya existe un proveedor llamado ${igualNombre.nombre}.`));
  if (b.identificacion_fiscal) {
    const nit = normalizarIdentificacion(b.identificacion_fiscal);
    const igualNit = otros.find((o) => o.identificacion_fiscal && normalizarIdentificacion(o.identificacion_fiscal) === nit);
    if (igualNit) throw new ErrorProveedor(409, sinPuntoDoble(`La identificación ${b.identificacion_fiscal} ya es de ${igualNit.nombre}.`));
  }
  for (const correo of b.canales.correos) {
    const dueno = otros.find((o) => o.canales.correos.includes(correo));
    if (dueno) throw new ErrorProveedor(409, sinPuntoDoble(`El correo ${correo} ya está vinculado a ${dueno.nombre}.`));
  }
}

function idNuevo(nombre: string, existentes: readonly Beneficiario[]): string {
  const base = `ben-${slug(nombre) || "proveedor"}`;
  let id = base;
  for (let n = 2; existentes.some((b) => b.id === id); n++) id = `${base}-${n}`;
  return id;
}

function armar(id: string, e: EntradaProveedor, previo: Beneficiario | null): Beneficiario {
  return {
    id,
    nombre: e.nombre,
    identificacion_fiscal: e.identificacion_fiscal || null,
    pais: e.pais,
    categoria: e.categoria || "general",
    tipo: e.tipo,
    cuenta: { tipo: e.cuenta.tipo, banco: e.cuenta.banco, numero_enmascarado: `•••• ${e.cuenta.ultimos4}`, ultimos4: e.cuenta.ultimos4 },
    acuerdo: e.acuerdo ? acuerdoDe(e.acuerdo) : null,
    limite_mensual_usd: e.limite_mensual_usd,
    estado: e.estado,
    // Telegram y portal se vinculan con sus enlaces (#13, #85): editar no los toca.
    canales: { correos: [...new Set(e.correos)], telegram_chat_id: previo?.canales.telegram_chat_id ?? null, portal_usuario: previo?.canales.portal_usuario ?? null },
  };
}

/** Frases de lo que cambió, para el registro. */
function cambios(antes: Beneficiario, despues: Beneficiario): string[] {
  const r: string[] = [];
  if (antes.nombre !== despues.nombre) r.push(`nombre «${antes.nombre}» → «${despues.nombre}»`);
  if ((antes.identificacion_fiscal ?? null) !== (despues.identificacion_fiscal ?? null)) r.push(`identificación ${antes.identificacion_fiscal ?? "sin registrar"} → ${despues.identificacion_fiscal ?? "sin registrar"}`);
  if (antes.cuenta.ultimos4 !== despues.cuenta.ultimos4 || antes.cuenta.banco !== despues.cuenta.banco) r.push(`cuenta •••• ${antes.cuenta.ultimos4} (${antes.cuenta.banco}) → •••• ${despues.cuenta.ultimos4} (${despues.cuenta.banco})`);
  if (antes.canales.correos.join() !== despues.canales.correos.join()) r.push(`correos: ${despues.canales.correos.join(", ") || "ninguno"}`);
  if (antes.limite_mensual_usd !== despues.limite_mensual_usd) r.push("límite mensual");
  if (JSON.stringify(antes.acuerdo) !== JSON.stringify(despues.acuerdo)) r.push(despues.acuerdo ? `acuerdo ${despues.acuerdo.referencia} (${formatear(despues.acuerdo.lineas[0]!.monto)})` : "sin acuerdo");
  if (antes.estado !== despues.estado) r.push(despues.estado === "activo" ? "reactivado" : "desactivado");
  if (antes.pais !== despues.pais || antes.tipo !== despues.tipo || antes.categoria !== despues.categoria) r.push("país, tipo o categoría");
  return r;
}

async function registrar(repo: Repositorio, b: Beneficiario, explicacion: string, autor: Aprobador, ahora: string): Promise<EntradaRegistro> {
  const entrada: EntradaRegistro = {
    id: await repo.siguienteIdRegistro(Number(ahora.slice(0, 4))),
    momento: ahora,
    actor: { tipo: "humano", aprobador_id: autor.id, nombre: autor.nombre },
    tipo: "CAMBIO_BENEFICIARIOS",
    ref_interna: `CONFIG-PROVEEDOR-${b.id}`,
    factura_numero: null,
    beneficiario: b.nombre,
    canal: "carga_manual",
    formato: "xml",
    monto_original: null,
    monto_usd_centavos: null,
    tasa_usada: null,
    decision: null,
    reglas_version: (await repo.reglasVigentes()).version,
    evaluaciones: [],
    reglas_que_fallaron: [],
    comparaciones: [],
    explicacion,
    comentario: null,
    entrada_origen: null,
    extraccion: null,
    sha256: null,
  };
  await repo.agregarEntrada(entrada);
  return entrada;
}

export async function listarProveedores(repo: Repositorio): Promise<Beneficiario[]> {
  const { beneficiarios } = await repo.datosComunes();
  return [...beneficiarios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function crearProveedor(repo: Repositorio, crudo: unknown, autor: Aprobador, ahora: string): Promise<Beneficiario> {
  const e = leer(crudo);
  return repo.enExclusiva(async () => {
    const existentes = (await repo.datosComunes()).beneficiarios;
    const b = armar(idNuevo(e.nombre, existentes), e, null);
    validarUnicos(b, existentes);
    await repo.guardarBeneficiario(b);
    const nit = b.identificacion_fiscal ? ` (${b.identificacion_fiscal})` : "";
    await registrar(repo, b, `${autor.nombre} creó al proveedor ${b.nombre}${nit} con la cuenta •••• ${b.cuenta.ultimos4} en ${b.cuenta.banco}.`, autor, ahora);
    return b;
  });
}

export function editarProveedor(repo: Repositorio, id: string, crudo: unknown, autor: Aprobador, ahora: string): Promise<Beneficiario> {
  const e = leer(crudo);
  return repo.enExclusiva(async () => {
    const existentes = (await repo.datosComunes()).beneficiarios;
    const antes = existentes.find((b) => b.id === id);
    if (!antes) throw new ErrorProveedor(404, "Ese proveedor no existe.");
    const despues = armar(id, e, antes);
    validarUnicos(despues, existentes.filter((b) => b.id !== id));
    const lista = cambios(antes, despues);
    if (lista.length === 0) return antes;
    try {
      await repo.actualizarBeneficiario(despues);
    } catch (err) {
      throw new ErrorProveedor(409, err instanceof Error ? err.message : "No se pudo guardar el proveedor.");
    }
    await registrar(repo, despues, `${autor.nombre} editó a ${despues.nombre}: ${lista.join("; ")}.`, autor, ahora);
    return despues;
  });
}

function leer(crudo: unknown): EntradaProveedor {
  const r = EntradaProveedorSchema.safeParse(crudo);
  if (!r.success) throw new ErrorProveedor(400, r.error.issues[0]?.message ?? "Datos del proveedor inválidos.");
  return r.data;
}
