// Almacén en memoria: mismas reglas que la base (código único, revocar una vez).

import { randomUUID } from "node:crypto";

import type { AlmacenEnlaces } from "./almacen";
import { estadoEnlace } from "./reglas";
import { ErrorCodigoRepetido, type EnlaceConCodigo, type EnlaceProveedor } from "./tipos";

type Fila = EnlaceConCodigo & { token_hash: string };

/** Almacén en memoria con las mismas reglas que la base: código único y revocar una sola vez. */
export function crearAlmacenEnlacesMemoria(): AlmacenEnlaces {
  const filas: Fila[] = [];

  function publico(f: Fila): EnlaceProveedor {
    const { id, nombre, correo, beneficiario_id, creado_por, creado_en, expira_en, revocado_en, codigo_cambiado_en, ultimo_acceso } = f;
    return { id, nombre, correo, beneficiario_id, creado_por, creado_en, expira_en, revocado_en, codigo_cambiado_en, ultimo_acceso };
  }
  function conCodigo(f: Fila): EnlaceConCodigo {
    return { ...publico(f), codigo_hash: f.codigo_hash };
  }

  return {
    async listar() {
      return filas.toReversed().map(publico);
    },
    async porId(id) {
      const f = filas.find((x) => x.id === id);
      return f ? conCodigo(f) : null;
    },
    async porHash(token_hash) {
      const f = filas.find((x) => x.token_hash === token_hash);
      return f ? conCodigo(f) : null;
    },
    async crear(nuevo) {
      if (filas.some((x) => x.codigo_hash === nuevo.codigo_hash)) throw new ErrorCodigoRepetido();
      const fila: Fila = { ...nuevo, id: randomUUID(), revocado_en: null, codigo_cambiado_en: null, ultimo_acceso: null };
      filas.push(fila);
      return publico(fila);
    },
    async revocar(id, ahora) {
      const f = filas.find((x) => x.id === id);
      if (!f || f.revocado_en !== null) return false;
      f.revocado_en = ahora;
      return true;
    },
    async cambiarCodigo(id, codigo_hash, ahora) {
      const f = filas.find((x) => x.id === id);
      if (!f || f.revocado_en !== null) return false;
      if (filas.some((x) => x.id !== id && x.codigo_hash === codigo_hash)) throw new ErrorCodigoRepetido();
      Object.assign(f, { codigo_hash, codigo_cambiado_en: ahora });
      return true;
    },
    async borrar(id, ahora) {
      const i = filas.findIndex((x) => x.id === id);
      if (i < 0 || estadoEnlace(filas[i]!, ahora) === "activo") return false;
      filas.splice(i, 1);
      return true;
    },
    async registrarAcceso(id, ahora) {
      const f = filas.find((x) => x.id === id);
      if (f) f.ultimo_acceso = ahora;
    },
  };
}
