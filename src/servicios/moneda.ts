// Cambiar la moneda base (#86): límites, presupuesto, doble firma, límites mensuales de proveedores y límites de
// aprobación se convierten con la tasa del día. Orden pensado para fallar hacia seguro: primero la versión nueva de
// reglas (en la moneda nueva), luego proveedores y aprobadores, y al final la empresa. Mientras reglas y tasas estén en
// monedas distintas, el motor escala todo; nunca paga con límites en otra moneda.

import { convertirLimite, formatearBase, formatearTasa, monedaBase } from "@/dominio/dinero";
import type { Aprobador, EntradaRegistro, Moneda, Reglas } from "@/dominio/tipos";
import type { AlmacenEquipo } from "@/equipo/almacen";
import { EMPRESA_ID } from "@/equipo/tipos";
import type { Rol } from "@/lib/auth/permisos";
import type { Repositorio } from "@/repositorio/repositorio";
import { sinConfigurar } from "@/reglas/sin-configurar";

import { guardarReglas, sinVersion } from "./reglas";

export class ErrorMoneda extends Error {
  constructor(
    readonly estado: 400 | 403 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorMoneda";
  }
}

export type FilaConversion = { concepto: string; antes: string; despues: string };

export type VistaPreviaMoneda = {
  actual: Moneda;
  nueva: Moneda;
  /** "1 USD = 3.182,78 COP" */
  tasa: string;
  fecha: string | null;
  fuente: string | null;
  reglas: FilaConversion[];
  proveedores: FilaConversion[];
  aprobadores: FilaConversion[];
};

type Plan = {
  actual: Moneda;
  nueva: Moneda;
  tasa: string;
  vista: VistaPreviaMoneda;
  reglas: Reglas;
  proveedores: { id: string; limite: number }[];
  aprobadores: { usuario_id: string; rol: Rol; limite: number }[];
};

/** Arma todo el cambio sin escribir nada (vista previa y validación son la misma función). */
async function planear(repo: Repositorio, equipo: AlmacenEquipo, nueva: Moneda): Promise<Plan> {
  const [empresa, vigentes, datos, miembros] = await Promise.all([repo.empresa(), repo.tasasVigentes(), repo.datosComunes(), equipo.miembros(EMPRESA_ID)]);
  const actual = empresa.moneda_base;
  if (nueva === actual) throw new ErrorMoneda(400, `La moneda base ya es ${actual}.`);
  if (!vigentes || vigentes.tabla.base !== actual) throw new ErrorMoneda(409, "No hay tasas del día de la moneda actual: no se puede convertir con seguridad. Intenta más tarde.");
  const tasa = vigentes.tabla.tasas[nueva];
  if (!tasa) throw new ErrorMoneda(409, `La fuente de tasas no tiene ${nueva}.`);

  const reglasActuales = datos.reglas.vigente;
  if (monedaBase(reglasActuales) !== actual && !sinConfigurar(reglasActuales)) {
    throw new ErrorMoneda(409, `Las reglas vigentes están en ${monedaBase(reglasActuales)} y la empresa en ${actual}: guarda primero las reglas.`);
  }
  const c = (centavos: number) => convertirLimite(centavos, tasa);
  const l = reglasActuales.limites;
  const reglas: Reglas = {
    ...reglasActuales,
    moneda: nueva,
    limites: { ...l, pago_automatico_usd: c(l.pago_automatico_usd), maximo_absoluto_usd: c(l.maximo_absoluto_usd), mensual_por_beneficiario_default_usd: c(l.mensual_por_beneficiario_default_usd) },
    presupuesto: { ...reglasActuales.presupuesto, monto_usd: c(reglasActuales.presupuesto.monto_usd) },
    aprobacion: { doble_aprobacion_desde_usd: c(reglasActuales.aprobacion.doble_aprobacion_desde_usd) },
  };
  const fila = (concepto: string, antes: number, despues: number): FilaConversion => ({ concepto, antes: formatearBase(antes, actual), despues: formatearBase(despues, nueva) });
  const proveedores = datos.beneficiarios.filter((b) => b.limite_mensual_usd !== null).map((b) => ({ b, limite: c(b.limite_mensual_usd!) }));
  const aprobadores = miembros.filter((m) => m.limite_aprobacion_usd !== null).map((m) => ({ m, limite: c(m.limite_aprobacion_usd!) }));
  const tasaTexto = formatearTasa(nueva, vigentes.tabla)?.slice(nueva.length + 1) ?? tasa;

  return {
    actual,
    nueva,
    tasa,
    reglas,
    proveedores: proveedores.map(({ b, limite }) => ({ id: b.id, limite })),
    aprobadores: aprobadores.map(({ m, limite }) => ({ usuario_id: m.usuario_id, rol: m.rol, limite })),
    vista: {
      actual,
      nueva,
      tasa: `1 ${actual} = ${tasaTexto} ${nueva}`,
      fecha: vigentes.fecha,
      fuente: vigentes.fuente,
      reglas: [
        fila("Pago automático (R9)", l.pago_automatico_usd, reglas.limites.pago_automatico_usd),
        fila("Máximo por pago (R6)", l.maximo_absoluto_usd, reglas.limites.maximo_absoluto_usd),
        fila("Mensual por proveedor (R8)", l.mensual_por_beneficiario_default_usd, reglas.limites.mensual_por_beneficiario_default_usd),
        fila("Presupuesto del periodo (R7)", reglasActuales.presupuesto.monto_usd, reglas.presupuesto.monto_usd),
        fila("Dos aprobaciones desde", reglasActuales.aprobacion.doble_aprobacion_desde_usd, reglas.aprobacion.doble_aprobacion_desde_usd),
      ],
      proveedores: proveedores.map(({ b, limite }) => fila(b.nombre, b.limite_mensual_usd!, limite)),
      aprobadores: aprobadores.map(({ m, limite }) => fila(m.nombre, m.limite_aprobacion_usd!, limite)),
    },
  };
}

export async function vistaPreviaMoneda(repo: Repositorio, equipo: AlmacenEquipo, nueva: Moneda): Promise<VistaPreviaMoneda> {
  return (await planear(repo, equipo, nueva)).vista;
}

export async function cambiarMonedaBase(
  repo: Repositorio,
  equipo: AlmacenEquipo,
  nueva: Moneda,
  autor: Aprobador,
  ahora: string,
): Promise<{ version: number | null; entrada: EntradaRegistro }> {
  if (!autor.principal) throw new ErrorMoneda(403, "Solo un administrador puede cambiar la moneda base.");
  const plan = await planear(repo, equipo, nueva);
  // 1. Reglas nuevas en la moneda nueva (si ya había reglas guardadas; la versión 0 se queda sin guardar).
  const reglasActuales = await repo.reglasVigentes();
  let version: number | null = null;
  if (!sinConfigurar(reglasActuales)) version = (await guardarReglas(repo, sinVersion(plan.reglas), autor, ahora)).version;
  // 2 y 3. Límites de proveedores y de aprobadores.
  return repo.enExclusiva(async () => {
    const datos = await repo.datosComunes();
    for (const p of plan.proveedores) {
      const b = datos.beneficiarios.find((x) => x.id === p.id);
      if (b) await repo.actualizarBeneficiario({ ...b, limite_mensual_usd: p.limite });
    }
    for (const a of plan.aprobadores) await equipo.cambiarMiembro(EMPRESA_ID, a.usuario_id, a.rol, a.limite, ahora);
    // 4. Al final la empresa: desde aquí las tasas del día salen en la moneda nueva.
    const empresa = await repo.empresa();
    await repo.guardarEmpresa({ nombre: empresa.nombre, jurisdiccion: empresa.jurisdiccion, paises_operacion: empresa.paises_operacion, moneda_base: nueva });
    const partes = [
      version === null ? "las reglas aún no estaban guardadas (quedan sugeridas en la moneda nueva al guardar la versión 1)" : `guardó la versión ${version} de las reglas con los límites convertidos`,
      plan.proveedores.length > 0 ? `${plan.proveedores.length} proveedor(es) con su límite mensual convertido` : null,
      plan.aprobadores.length > 0 ? `${plan.aprobadores.length} aprobador(es) con su límite convertido` : null,
    ].filter(Boolean);
    const entrada: EntradaRegistro = {
      id: await repo.siguienteIdRegistro(Number(ahora.slice(0, 4))),
      momento: ahora,
      actor: { tipo: "humano", aprobador_id: autor.id, nombre: autor.nombre },
      tipo: "CAMBIO_EMPRESA",
      ref_interna: `CONFIG-EMPRESA-${empresa.id.toUpperCase()}`,
      factura_numero: null,
      beneficiario: null,
      canal: "carga_manual",
      formato: "xml",
      monto_original: null,
      monto_usd_centavos: null,
      tasa_usada: null,
      decision: null,
      reglas_version: version ?? reglasActuales.version,
      evaluaciones: [],
      reglas_que_fallaron: [],
      comparaciones: [],
      explicacion: `${autor.nombre} cambió la moneda base de ${plan.actual} a ${nueva} con la tasa ${plan.vista.tasa} (${plan.vista.fuente ?? "sin fuente"}, ${plan.vista.fecha ?? "sin fecha"}): ${partes.join("; ")}.`,
      comentario: null,
      entrada_origen: null,
      extraccion: null,
      sha256: null,
    };
    await repo.agregarEntrada(entrada);
    return { version, entrada };
  });
}
