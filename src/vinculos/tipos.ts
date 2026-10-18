// Portal del proveedor (#85). El admin crea un enlace para un proveedor con su nombre, su correo y un código de 8
// caracteres, y se lo pasa por el medio que ya usan (la app no envía correos). El proveedor abre el enlace, escribe
// ese correo y ese código, y si coinciden entra a «Ingrese sus facturas» para subir PDF o fotos. Lo que sube entra
// por la ingesta única con remitente `{ tipo: 'correo', valor: <correo del enlace> }`: R11 cumple solo si ese correo
// ya es canal del beneficiario que nombra la factura; un proveedor nuevo escala (R3, R11) hasta que alguien lo agregue.

export type EnlaceProveedor = {
  id: string;
  nombre: string;
  /** el correo que escribió el admin; el proveedor debe escribir el mismo */
  correo: string;
  /** beneficiario de la lista que ya tenía ese correo al crear el enlace; null = proveedor nuevo */
  beneficiario_id: string | null;
  creado_por: string | null;
  creado_en: string;
  expira_en: string;
  revocado_en: string | null;
  codigo_cambiado_en: string | null;
  ultimo_acceso: string | null;
};

/** Con el hash del código: solo para verificar en el servidor, nunca sale hacia la pantalla. */
export type EnlaceConCodigo = EnlaceProveedor & { codigo_hash: string };

/** activo: se puede entrar · vencido: pasaron los 30 días · revocado: un admin lo cerró. */
export type EstadoEnlace = "activo" | "vencido" | "revocado";

/** Enlace por crear, con los hashes del token y del código. */
export type NuevoEnlace = Pick<EnlaceProveedor, "nombre" | "correo" | "beneficiario_id" | "creado_por" | "creado_en" | "expira_en"> & {
  token_hash: string;
  codigo_hash: string;
};

/** Operación del portal rechazada; `estado` es el código HTTP. */
export class ErrorVinculo extends Error {
  constructor(
    readonly estado: 400 | 401 | 403 | 404 | 409 | 429,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorVinculo";
  }
}

/** El código ya lo tiene otro enlace (muy raro): se genera otro. */
export class ErrorCodigoRepetido extends Error {}

/** Mismo texto para inexistente, vencido o revocado: no se dice cuál. */
export const MENSAJE_INVALIDO = "Este enlace ya no sirve: venció o lo revocaron. Pide uno nuevo a tu contacto en la empresa.";

/** Mismo texto si falla el correo, el código o los dos: no se dice cuál. */
export const MENSAJE_NO_COINCIDE = "El correo o el código no coinciden. Revisa los datos que te pasó la empresa.";

/** La sesión del proveedor venció: debe volver a entrar con su correo y código. */
export const MENSAJE_SIN_ACCESO = "Tu acceso venció. Vuelve a escribir tu correo y tu código.";
