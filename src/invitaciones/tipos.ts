// Invitaciones para proveedores nuevos (#28): un enlace con código único que la empresa comparte por cualquier
// medio para que alguien fuera de la lista de beneficiarios mande su factura. Distintas de las invitaciones del
// equipo (#51, `src/equipo/`): aquí no se crea ninguna membresía, el proveedor nunca ve el panel.

export type InvitacionProveedor = {
  id: string;
  /** a quién se espera ("Estudio Nuevo S.A.S."); solo informativo para quien aprueba */
  nombre_esperado: string | null;
  /** si existe, solo esa cuenta puede enviar por el enlace */
  correo_esperado: string | null;
  creada_por: string | null;
  creada_en: string;
  expira_en: string;
  /** cuántas facturas se pueden enviar con el enlace */
  usos_max: number;
  usos: number;
  revocada_en: string | null;
};

export type EstadoInvitacionProveedor = "activa" | "vencida" | "revocada" | "agotada";

export type NuevaInvitacionProveedor = Omit<InvitacionProveedor, "id" | "usos" | "revocada_en"> & { token_hash: string };

/** Mismos códigos que `public.usar_invitacion_proveedor` (migración 20261017100000). */
export type ResultadoUso = "ok" | "invalida" | "otro_correo";

export class ErrorInvitacion extends Error {
  constructor(
    readonly estado: 400 | 403 | 404 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorInvitacion";
  }
}

/** Mismo texto para inexistente, vencida, revocada o agotada: no se dice cuál de las cuatro. */
export const MENSAJE_INVALIDA = "Este enlace ya no sirve: venció, se usó todas las veces permitidas o lo revocaron. Pide uno nuevo a quien te lo envió.";
