// Ajustes → Datos de la empresa (#84): leer y guardar nombre, jurisdicción y países. Cada cambio queda en el
// registro (CAMBIO_EMPRESA), igual que un cambio de reglas: el registro explica quién cambió qué y cuándo.

import { describirCambio, type CambiosEmpresaParciales } from "@/empresa/datos";
import type { Aprobador, Empresa, EntradaRegistro } from "@/dominio/tipos";
import type { Repositorio } from "@/repositorio/repositorio";

export async function guardarEmpresa(
  repo: Repositorio,
  cambios: CambiosEmpresaParciales,
  autor: Pick<Aprobador, "id" | "nombre">,
  ahora: string,
): Promise<{ empresa: Empresa; entrada: EntradaRegistro | null }> {
  return repo.enExclusiva(async () => {
    const antes = await repo.empresa();
    const despues: Empresa = { ...antes, ...cambios };
    const explicacion = describirCambio(antes, despues, autor.nombre);
    if (!explicacion) return { empresa: antes, entrada: null };
    const empresa = await repo.guardarEmpresa({ nombre: despues.nombre, jurisdiccion: despues.jurisdiccion, paises_operacion: despues.paises_operacion });
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
    return { empresa, entrada };
  });
}
