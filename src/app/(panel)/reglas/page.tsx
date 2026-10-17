import { SlidersHorizontalIcon } from "lucide-react";

import { PantallaPendiente } from "@/components/pantalla-pendiente";

// Reglas de pago (especificación §13.4). La pantalla real la construye #6.
export default function ReglasPage() {
  return (
    <PantallaPendiente
      contexto="Versión 7"
      titulo="Reglas de pago"
      icono={SlidersHorizontalIcon}
      vacioTitulo="Las reglas aún no están cargadas"
      vacioDescripcion="Aquí podrás ajustar límites, presupuesto y beneficiarios, y simular antes de guardar."
    />
  );
}
