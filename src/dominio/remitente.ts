// Remitentes de envíos por enlace de invitación (#28): `invitacion:<id>:<correo>`. Lo arma el servidor con la sesión
// verificada. Nunca verifica R11 ni se vincula a un beneficiario: el enlace prueba que alguien tiene el código y es
// dueño de un correo, no que sea quien cobra (§4.3 R11).

export const PREFIJO_INVITACION = "invitacion:";

/** Arma el remitente de un envío por invitación. El correo se guarda en minúsculas. */
export function remitenteInvitacion(id: string, correo: string): string {
  return `${PREFIJO_INVITACION}${id}:${correo.trim().toLowerCase()}`;
}

/** true si el remitente viene de un enlace de invitación: R11 nunca lo da por verificado. */
export function esRemitenteInvitacion(valor: string): boolean {
  return valor.trim().toLowerCase().startsWith(PREFIJO_INVITACION);
}

/** Correo verificado que va dentro del remitente (para vincularlo al agregar el beneficiario, §10). */
export function correoDeInvitacion(valor: string): string | null {
  if (!esRemitenteInvitacion(valor)) return null;
  const resto = valor.trim().slice(PREFIJO_INVITACION.length);
  const correo = resto.slice(resto.indexOf(":") + 1).toLowerCase();
  return resto.includes(":") && /^[^\s@:]+@[^\s@:]+\.[^\s@:]+$/.test(correo) ? correo : null;
}
