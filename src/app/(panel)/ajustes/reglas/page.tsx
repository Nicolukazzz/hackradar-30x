import { VolverAjustes } from "@/app/_componentes/ajustes";
import { exigirMiembro } from "@/app/_datos/sesion";
import { obtenerReglasConSimulacion } from "@/app/_datos/reglas";
import { permisoPara } from "@/lib/auth/permisos";

import { ReglasPorPasos } from "../../_reglas/por-pasos";

// Reglas de pago (§13.4, #87, #119): una lista estilo iPhone; cada sección se edita en su propio diálogo, se prueba
// contra el set de facturas de prueba y se guarda como versión nueva. Cualquiera puede ver y probar; guardar es de
// `puede(sesion, 'editar_reglas')` (POST /api/reglas lo exige igual en el servidor). Proveedores y aprobadores ya no
// están aquí: viven en Proveedores y en Ajustes → Equipo.
export default async function ReglasPage() {
  // Puerta propia: obtenerReglasConSimulacion no la tiene y una petición RSC directa se salta el layout.
  const sesion = await exigirMiembro();
  const r = await obtenerReglasConSimulacion();
  return (
    <>
      <div className="mx-auto w-full max-w-[640px]">
        <VolverAjustes />
      </div>
      <ReglasPorPasos
        // key: tras guardar, arranca de cero con la versión nueva.
        key={r.vigente.version}
        vigente={r.vigente}
        historial={r.historial}
        simulacionInicial={r.simulacion}
        permisoGuardar={permisoPara(sesion, "editar_reglas")}
      />
    </>
  );
}
