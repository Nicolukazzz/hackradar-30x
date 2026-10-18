"use client";

import { Loader2Icon, PowerIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Beneficiario } from "@/dominio/tipos";

import { llamar } from "../../ajustes/equipo/_equipo/api";

// Activar o desactivar un proveedor de la lista (#107). La lista vive en directorio.tsx (#119).

/** El cuerpo completo que espera PATCH /api/proveedores/:id, con otro estado. */
function conEstado(b: Beneficiario, estado: Beneficiario["estado"]) {
  const linea = b.acuerdo?.lineas[0];
  return {
    nombre: b.nombre,
    identificacion_fiscal: b.identificacion_fiscal ?? null,
    pais: b.pais,
    tipo: b.tipo,
    categoria: b.categoria,
    cuenta: { tipo: b.cuenta.tipo, banco: b.cuenta.banco, ultimos4: b.cuenta.ultimos4 },
    correos: b.canales.correos,
    limite_mensual_usd: b.limite_mensual_usd,
    acuerdo: b.acuerdo && linea ? { referencia: b.acuerdo.referencia, concepto: linea.concepto, monto: linea.monto } : null,
    estado,
  };
}

export function CambiarEstado({ b }: { b: Beneficiario }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const activo = b.estado === "activo";
  function cambiar() {
    iniciar(async () => {
      try {
        await llamar(`/api/proveedores/${b.id}`, "PATCH", conEstado(b, activo ? "inactivo" : "activo"));
        toast.success(activo ? `${b.nombre} desactivado` : `${b.nombre} activo otra vez`);
        router.refresh();
      } catch (e) {
        toast.error("No se cambió el estado", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" className="h-11 gap-1.5 px-3" disabled={ocupado} />}>
        {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <PowerIcon aria-hidden />}
        {activo ? "Desactivar" : "Activar"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{activo ? `¿Desactivar a ${b.nombre}?` : `¿Activar a ${b.nombre}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {activo
              ? "Sus facturas dejarán de pagarse solas: el agente las escalará (R3) hasta que lo actives otra vez. Queda en el registro."
              : "Sus facturas volverán a decidirse con las reglas normales. Queda en el registro."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
          <AlertDialogAction className="h-11" onClick={cambiar}>
            {activo ? "Desactivar" : "Activar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
