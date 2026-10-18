"use client";

import { Loader2Icon, PowerIcon, SendIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatear, formatearBase } from "@/dominio/dinero";
import type { Beneficiario } from "@/dominio/tipos";
import { useMonedaBase } from "@/app/_componentes/moneda-base";
import type { PermisoUI } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

import { llamar } from "../../ajustes/equipo/_equipo/api";
import { AsistenteProveedor } from "./asistente-proveedor";

// Lista de proveedores (#107): a quién puede pagar el agente, con su cuenta, sus canales y lo acordado.

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

function CambiarEstado({ b }: { b: Beneficiario }) {
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

export function ListaProveedores({ proveedores, permiso }: { proveedores: Beneficiario[]; permiso: PermisoUI }) {
  const base = useMonedaBase();
  return (
    <div className="overflow-x-auto border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Proveedor</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead>Canales</TableHead>
            <TableHead>Acordado</TableHead>
            <TableHead className="text-right">Límite mensual</TableHead>
            <TableHead>Estado</TableHead>
            {permiso.ok ? <TableHead className="pr-6 text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {proveedores.map((b) => {
            const linea = b.acuerdo?.lineas[0];
            const canales = [...b.canales.correos, ...(b.canales.telegram_chat_id ? ["Telegram"] : []), ...(b.canales.portal_usuario ? ["Portal"] : [])];
            return (
              <TableRow key={b.id} className={cn(b.estado === "inactivo" && "text-muted-foreground")}>
                <TableCell className="pl-6">
                  <div className="font-medium">{b.nombre}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {b.identificacion_fiscal ? <span className="font-mono tabular-nums">{b.identificacion_fiscal}</span> : "Sin identificación fiscal"}
                    {b.pais !== "ZZ" ? ` · ${b.pais}` : ""}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono tabular-nums">•••• {b.cuenta.ultimos4}</span>
                  <div className="text-[13px] text-muted-foreground">{b.cuenta.banco}</div>
                </TableCell>
                <TableCell className="max-w-[240px]">
                  {canales.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {canales.map((c) => (
                        <Badge key={c} variant="outline" className="font-normal">
                          {c === "Telegram" || c === "Portal" ? <SendIcon className="size-3" aria-hidden /> : null}
                          {c}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">Ninguno: sus facturas se escalan (R11)</span>
                  )}
                </TableCell>
                <TableCell>
                  {b.acuerdo && linea ? (
                    <>
                      <span className="font-mono tabular-nums">{formatear(linea.monto)}</span>
                      <div className="text-[13px] text-muted-foreground">
                        {b.acuerdo.referencia} · {linea.concepto}
                      </div>
                    </>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">Sin acuerdo</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{b.limite_mensual_usd === null ? <span className="font-sans text-[13px] text-muted-foreground">El de las reglas</span> : formatearBase(b.limite_mensual_usd, base)}</TableCell>
                <TableCell>
                  <Badge className={b.estado === "activo" ? "bg-pagada text-pagada-foreground" : "bg-muted text-muted-foreground"}>{b.estado === "activo" ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                {permiso.ok ? (
                  <TableCell className="pr-6 text-right whitespace-nowrap">
                    <AsistenteProveedor permiso={permiso} proveedor={b} />
                    <CambiarEstado b={b} />
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
