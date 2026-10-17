import type { EventoAuditoria } from "@/lib/auth/guardia";

/** Una línea JSON por evento de acceso (stdout → logs de Railway). Sin correos, tokens ni datos de facturas. */
export function auditar(evento: EventoAuditoria): void {
  console.info(JSON.stringify({ auditoria: "auth", momento: new Date().toISOString(), ...evento }));
}
