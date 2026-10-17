// Almacén en memoria: mismas reglas que la base (usar es atómico dentro del proceso).

import { randomUUID } from "node:crypto";

import type { AlmacenEnlaces } from "./almacen";
import { estadoEnlace } from "./reglas";
import type { EnlaceProveedor } from "./tipos";

type Fila = EnlaceProveedor & { token_hash: string };

export function crearAlmacenEnlacesMemoria(): AlmacenEnlaces {
  const filas: Fila[] = [];

  /** Sin token_hash, como devuelve la base. */
  function publica(f: Fila): EnlaceProveedor {
    const { id, beneficiario_id, nombre, creado_por, creado_en, expira_en, revocado_en, usado_en, correo, conexion_id } = f;
    return { id, beneficiario_id, nombre, creado_por, creado_en, expira_en, revocado_en, usado_en, correo, conexion_id };
  }

  return {
    async listar() {
      return filas.toReversed().map(publica);
    },
    async porHash(token_hash) {
      const f = filas.find((x) => x.token_hash === token_hash);
      return f ? publica(f) : null;
    },
    async crear(nuevo) {
      const fila: Fila = { ...nuevo, id: randomUUID(), revocado_en: null, usado_en: null, correo: null, conexion_id: null };
      filas.push(fila);
      return publica(fila);
    },
    async revocar(id, ahora) {
      const f = filas.find((x) => x.id === id);
      if (!f || f.revocado_en !== null || f.usado_en !== null) return false;
      f.revocado_en = ahora;
      return true;
    },
    async usar(token_hash, correo, conexion_id, ahora) {
      const f = filas.find((x) => x.token_hash === token_hash);
      if (!f || estadoEnlace(f, ahora) !== "activo") return null;
      Object.assign(f, { usado_en: ahora, correo: correo.trim().toLowerCase(), conexion_id });
      return publica(f);
    },
  };
}
