import { UserCheckIcon } from "lucide-react";

import { PantallaPendiente } from "@/components/pantalla-pendiente";

// Aprobaciones pendientes (especificación §13.3). La pantalla real la construye #6.
export default function AprobacionesPage() {
  return (
    <PantallaPendiente
      contexto="Octubre 2026"
      titulo="Aprobaciones pendientes"
      icono={UserCheckIcon}
      vacioTitulo="No hay facturas esperando tu decisión"
      vacioDescripcion="Cuando el agente escale una factura, aparecerá aquí con la explicación y el plazo para responder."
    />
  );
}
