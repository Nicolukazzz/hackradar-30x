// Enlaces de proveedor (#85): la empresa crea un enlace de un solo uso y se lo pasa al proveedor por el medio que ya
// usan (WhatsApp, llamada, correo propio). Quien lo abre escribe el correo desde el que manda sus facturas y recibe un
// id de conexión. Para un beneficiario de la lista, ese correo queda vinculado (R11 cumple); para un proveedor nuevo
// solo queda registrado: sus facturas se escalan (R3) hasta que una persona lo agregue. La app no envía correos.

export type EnlaceProveedor = {
  id: string;
  /** beneficiario de la lista; null = proveedor nuevo */
  beneficiario_id: string | null;
  /** nombre del beneficiario o el que escribió quien creó el enlace */
  nombre: string;
  creado_por: string | null;
  creado_en: string;
  expira_en: string;
  revocado_en: string | null;
  usado_en: string | null;
  /** correo que vinculó el proveedor (solo después de usarlo) */
  correo: string | null;
  /** id de conexión empresa ↔ proveedor (solo después de usarlo), p. ej. PRV-7K3Q-M2XD */
  conexion_id: string | null;
};

export type EstadoEnlace = "activo" | "usado" | "vencido" | "revocado";

export type NuevoEnlace = Pick<EnlaceProveedor, "beneficiario_id" | "nombre" | "creado_por" | "creado_en" | "expira_en"> & { token_hash: string };

export class ErrorVinculo extends Error {
  constructor(
    readonly estado: 400 | 403 | 404 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorVinculo";
  }
}

/** Mismo texto para inexistente, vencido, usado o revocado: no se dice cuál. */
export const MENSAJE_INVALIDO = "Este enlace ya no sirve: venció, ya se usó o lo revocaron. Pide uno nuevo a tu contacto en la empresa.";

/** Mismo texto si el correo es de otro proveedor: no se confirma de quién es. */
export const MENSAJE_CORREO_OCUPADO = "No se pudo vincular este correo. Usa otro o escríbele a tu contacto en la empresa.";
