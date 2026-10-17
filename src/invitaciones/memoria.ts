// Almacén en memoria: mismas reglas que la base (usar es atómico dentro del proceso).

import { randomUUID } from "node:crypto";

import type { AlmacenInvitaciones } from "./almacen";
import { estadoInvitacion } from "./reglas";
import type { InvitacionProveedor } from "./tipos";

type Fila = InvitacionProveedor & { token_hash: string };

export function crearAlmacenInvitacionesMemoria(): AlmacenInvitaciones {
  const filas: Fila[] = [];

  /** Sin token_hash, como devuelve la base. */
  function publica(f: Fila): InvitacionProveedor {
    const { id, nombre_esperado, correo_esperado, creada_por, creada_en, expira_en, usos_max, usos, revocada_en } = f;
    return { id, nombre_esperado, correo_esperado, creada_por, creada_en, expira_en, usos_max, usos, revocada_en };
  }

  return {
    async listar() {
      return filas.toReversed().map(publica);
    },
    async porId(id) {
      const f = filas.find((x) => x.id === id);
      return f ? publica(f) : null;
    },
    async porHash(token_hash) {
      const f = filas.find((x) => x.token_hash === token_hash);
      return f ? publica(f) : null;
    },
    async crear(nueva) {
      const fila: Fila = { ...nueva, id: randomUUID(), usos: 0, revocada_en: null };
      filas.push(fila);
      return publica(fila);
    },
    async revocar(id, ahora) {
      const f = filas.find((x) => x.id === id);
      if (!f || f.revocada_en !== null) return false;
      f.revocada_en = ahora;
      return true;
    },
    async usar(token_hash, correo, ahora) {
      const f = filas.find((x) => x.token_hash === token_hash);
      if (!f || estadoInvitacion(f, ahora) !== "activa") return { resultado: "invalida", invitacion: null };
      if (f.correo_esperado !== null && f.correo_esperado !== correo.trim().toLowerCase()) return { resultado: "otro_correo", invitacion: null };
      f.usos += 1;
      return { resultado: "ok", invitacion: publica(f) };
    },
  };
}
