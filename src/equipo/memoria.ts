// Almacén en memoria para tests: mismas reglas que la base (último admin, aceptación atómica).

import { randomUUID } from "node:crypto";

import type { Reloj } from "@/dominio/reloj";
import type { Rol } from "@/lib/auth/permisos";

import type { AlmacenEquipo } from "./almacen";
import { estadoInvitacion, validarCambio, validarQuitar } from "./reglas";
import type { Invitacion, Miembro, ResultadoAceptar } from "./tipos";

type Cuenta = { usuario_id: string; nombre: string; correo: string; activo: boolean };
type FilaInvitacion = Invitacion & { empresa_id: string; token_hash: string };
type FilaMiembro = { empresa_id: string; usuario_id: string; rol: Rol; limite_aprobacion_usd: number | null; desde: string };

export type AlmacenEquipoMemoria = AlmacenEquipo & {
  /** Simula una cuenta creada en /entrar (perfil). */
  agregarCuenta(c: Omit<Cuenta, "activo"> & { activo?: boolean }): void;
  /** Membresía directa (como el script del primer admin). Si ya es miembro, cambia su rol sin validar. */
  agregarMiembro(empresa_id: string, usuario_id: string, rol: Rol, limite_aprobacion_usd?: number | null): void;
};

export function crearAlmacenEquipoMemoria(reloj: Reloj): AlmacenEquipoMemoria {
  const cuentas = new Map<string, Cuenta>();
  const membresias: FilaMiembro[] = [];
  const invitaciones: FilaInvitacion[] = [];

  function miembrosDe(empresa_id: string): Miembro[] {
    return membresias
      .filter((m) => m.empresa_id === empresa_id)
      .map((m) => {
        const c = cuentas.get(m.usuario_id);
        return {
          usuario_id: m.usuario_id,
          nombre: c?.nombre ?? "",
          correo: c?.correo ?? "",
          rol: m.rol,
          limite_aprobacion_usd: m.limite_aprobacion_usd,
          activo: c?.activo ?? false,
          desde: m.desde,
        };
      });
  }

  /** Sin empresa_id ni token_hash, como devuelve la base. */
  function publica(fila: FilaInvitacion): Invitacion {
    const { id, rol, limite_aprobacion_usd, correo_esperado, creada_por, creada_en, expira_en, usos_max, usos, revocada_en } = fila;
    return { id, rol, limite_aprobacion_usd, correo_esperado, creada_por, creada_en, expira_en, usos_max, usos, revocada_en };
  }

  return {
    agregarCuenta(c) {
      cuentas.set(c.usuario_id, { activo: true, ...c });
    },
    agregarMiembro(empresa_id, usuario_id, rol, limite_aprobacion_usd = null) {
      const previa = membresias.find((m) => m.empresa_id === empresa_id && m.usuario_id === usuario_id);
      if (previa) Object.assign(previa, { rol, limite_aprobacion_usd });
      else membresias.push({ empresa_id, usuario_id, rol, limite_aprobacion_usd, desde: reloj.ahora() });
    },
    async miembros(empresa_id) {
      return miembrosDe(empresa_id);
    },
    async invitaciones(empresa_id) {
      return invitaciones
        .filter((i) => i.empresa_id === empresa_id)
        .toReversed()
        .map(publica);
    },
    async invitacionPorHash(empresa_id, token_hash) {
      const i = invitaciones.find((x) => x.empresa_id === empresa_id && x.token_hash === token_hash);
      return i ? publica(i) : null;
    },
    async crearInvitacion(empresa_id, nueva) {
      const fila: FilaInvitacion = { ...nueva, empresa_id, id: randomUUID(), usos: 0, revocada_en: null };
      invitaciones.push(fila);
      return publica(fila);
    },
    async revocarInvitacion(empresa_id, id, ahora) {
      const i = invitaciones.find((x) => x.empresa_id === empresa_id && x.id === id);
      if (!i || i.revocada_en !== null) return false;
      i.revocada_en = ahora;
      return true;
    },
    async aceptarInvitacion(token_hash, usuario_id, correo): Promise<ResultadoAceptar> {
      const i = invitaciones.find((x) => x.token_hash === token_hash);
      if (!i || estadoInvitacion(i, reloj.ahora()) !== "activa") return "invalida";
      if (i.correo_esperado !== null && i.correo_esperado !== correo.trim().toLowerCase()) return "otro_correo";
      if (membresias.some((m) => m.empresa_id === i.empresa_id && m.usuario_id === usuario_id)) return "ya_miembro";
      membresias.push({ empresa_id: i.empresa_id, usuario_id, rol: i.rol, limite_aprobacion_usd: i.limite_aprobacion_usd, desde: reloj.ahora() });
      i.usos += 1;
      return "aceptada";
    },
    async cambiarMiembro(empresa_id, usuario_id, rol, limite_aprobacion_usd) {
      validarCambio(miembrosDe(empresa_id), usuario_id, { rol, limite_aprobacion_usd });
      const m = membresias.find((x) => x.empresa_id === empresa_id && x.usuario_id === usuario_id);
      if (m) Object.assign(m, { rol, limite_aprobacion_usd });
    },
    async quitarMiembro(empresa_id, usuario_id) {
      validarQuitar(miembrosDe(empresa_id), usuario_id);
      const i = membresias.findIndex((x) => x.empresa_id === empresa_id && x.usuario_id === usuario_id);
      if (i >= 0) membresias.splice(i, 1);
    },
  };
}
