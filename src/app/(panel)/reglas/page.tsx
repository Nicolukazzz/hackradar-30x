import { obtenerReglasConSimulacion } from "@/app/_datos/reglas";
import { formatear, formatearUsd } from "@/dominio/dinero";
import type { Beneficiario } from "@/dominio/tipos";
import { descripcionBeneficiario } from "@/servicios/comun";

import { EditorReglas, type FilaBeneficiario } from "../_reglas/editor";

// Reglas de pago (especificación §13.4, prototipo pantalla 4). Lee en el servidor (reglas vigentes +
// simulación inicial) y edita en el cliente. #49: sin roles, cualquier cuenta puede guardar; cuando
// vuelvan (#51) "Guardar como v{n}" queda solo para `puede(sesion, 'editar_reglas')`.

function fila(b: Beneficiario, limiteDefault: number): FilaBeneficiario {
  const lineas = b.acuerdo?.lineas ?? [];
  return {
    id: b.id,
    nombre: b.nombre,
    detalle: descripcionBeneficiario(b, null),
    cuenta: `${b.cuenta.tipo === "cuenta" ? "" : `${b.cuenta.tipo} `}•••• ${b.cuenta.ultimos4}`,
    acuerdo: b.acuerdo ? `${b.acuerdo.referencia} · ${b.acuerdo.descripcion}` : "Sin acuerdo",
    monto: lineas.length === 0 ? "—" : lineas.map((l) => formatear(l.monto) + (l.hitos_total ? ` × ${l.hitos_total}` : "")).join(" + "),
    limite: `USD ${formatearUsd(b.limite_mensual_usd ?? limiteDefault)}`,
    activo: b.estado === "activo",
  };
}

export default async function ReglasPage() {
  const r = await obtenerReglasConSimulacion();
  return (
    <EditorReglas
      // key: tras guardar, el editor arranca de cero con la versión nueva.
      key={r.vigente.version}
      vigente={r.vigente}
      historial={r.historial}
      simulacionInicial={r.simulacion}
      usoTasas={r.uso_tasas}
      aprobadores={r.aprobadores}
      beneficiarios={r.beneficiarios.map((b) => fila(b, r.vigente.limites.mensual_por_beneficiario_default_usd))}
    />
  );
}
