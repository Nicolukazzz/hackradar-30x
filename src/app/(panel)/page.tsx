import { InboxIcon } from "lucide-react";

import { PantallaPendiente } from "@/components/pantalla-pendiente";

// Bandeja de decisiones (especificación §13.1). La pantalla real la construye #6.
export default function BandejaPage() {
  return (
    <PantallaPendiente
      contexto="Octubre 2026"
      titulo="Bandeja de decisiones"
      icono={InboxIcon}
      vacioTitulo="Aún no hay facturas en este periodo"
      vacioDescripcion="Usa Procesar facturas nuevas para que el agente revise el lote."
    />
  );
}
