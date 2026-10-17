import { ScrollTextIcon } from "lucide-react";

import { PantallaPendiente } from "@/components/pantalla-pendiente";

// Registro de decisiones (especificación §13.5). La pantalla real la construye #6.
export default function RegistroPage() {
  return (
    <PantallaPendiente
      contexto="Solo se agrega, nunca se edita"
      titulo="Registro de decisiones"
      icono={ScrollTextIcon}
      vacioTitulo="El registro está vacío"
      vacioDescripcion="Cada decisión del agente y de las personas quedará aquí con su explicación."
    />
  );
}
