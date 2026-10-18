import { HourglassIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EncabezadoPagina, Indicador, Monto, hora } from "@/app/_componentes";
import { obtenerAprobaciones } from "@/app/_datos/aprobaciones";
import { obtenerVerificacion } from "@/app/_datos/bandeja";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatearUsd } from "@/dominio/dinero";
import { relojSistema } from "@/lib/reloj-sistema";

import { ListaPendientes } from "../_aprobaciones/lista-pendientes";
import { OrdenAprobaciones } from "../_aprobaciones/orden";
import { PorQueEsperan } from "../_aprobaciones/por-que-esperan";

export const metadata: Metadata = { title: "Pendientes · Agente de cuentas por pagar" };

// Pendientes (§13.3; antes «Aprobaciones», #131): las facturas que el agente no decidió solo y esperan a una persona.
// Arriba, lo que ayuda a priorizar: cuántas y por cuánto, qué vence hoy, cuál lleva más tiempo esperando y por qué
// esperan. Debajo, una fila por factura con «Verificar», que abre la factura en su panel de decisión.

/** «hace 3 h» · «hace 2 días». */
function antiguedad(desde: string, ahora: string): { valor: number; unidad: string } {
  const horas = Math.max(0, (Date.parse(ahora) - Date.parse(desde)) / 3_600_000);
  if (horas < 24) return { valor: Math.max(1, Math.round(horas)), unidad: Math.round(horas) <= 1 ? "hora" : "horas" };
  const dias = Math.round(horas / 24);
  return { valor: dias, unidad: dias === 1 ? "día" : "días" };
}

export default async function PendientesPage({ searchParams }: PageProps<"/pendientes">) {
  const sp = await searchParams;
  const orden = sp.orden === "monto" ? "monto" : "vencimiento";
  const [a, verificacion] = await Promise.all([obtenerAprobaciones(orden), obtenerVerificacion()]);
  const vencenHoy = a.pendientes.filter((t) => t.asignacion?.urgente);
  const primeraHoy = vencenHoy[0];
  const masAntigua = [...a.pendientes].sort((x, y) => x.recibido_en.localeCompare(y.recibido_en))[0];
  const espera = masAntigua ? antiguedad(masAntigua.recibido_en, relojSistema().ahora()) : null;
  const aprobadores = a.aprobadores
    .map((p) => `${p.nombre.replace(/\s*\([^)]*\)\s*$/, "")}${p.limite_usd === null ? "" : ` (hasta ${a.moneda_base} ${formatearUsd(p.limite_usd).replace(/,00$/, "")})`}`)
    .join(" · ");

  return (
    <>
      <EncabezadoPagina
        titulo="Pendientes"
        descripcion="Facturas que el agente no pagó solo. Revísalas y decide: lo que decidas queda en el registro con tu comentario."
        acciones={a.pendientes.length > 1 ? <OrdenAprobaciones orden={orden} /> : undefined}
      />

      {a.pendientes.length === 0 ? (
        <Empty className="flex-none rounded-2xl border bg-card py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HourglassIcon />
            </EmptyMedia>
            <EmptyTitle>Nada pendiente</EmptyTitle>
            <EmptyDescription>
              Cuando el agente necesite a una persona, la factura aparece aquí con el motivo y el plazo. Lo ya decidido está en la{" "}
              <Link href="/" className="font-medium text-link hover:underline">
                Bandeja
              </Link>
              .
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador
              tono="atencion"
              etiqueta="Por decidir"
              valor={a.pendientes.length}
              detalle={<Monto usd={a.reservado_usd} moneda={a.moneda_base} />}
              pie="Apartado del presupuesto"
            />
            <Indicador
              tono={vencenHoy.length > 0 ? "urgente" : "neutro"}
              etiqueta="Vencen hoy"
              valor={vencenHoy.length}
              detalle={primeraHoy ? `${primeraHoy.factura_numero ?? primeraHoy.ref_interna}${primeraHoy.asignacion ? `, antes de las ${hora(primeraHoy.asignacion.responder_antes_de)}` : ""}` : "Ninguna"}
              pie={vencenHoy.length > 1 ? `y ${vencenHoy.length - 1} más` : primeraHoy?.beneficiario ?? "Sin urgencias"}
            />
            <Indicador
              etiqueta="Esperando hace"
              valor={espera?.valor ?? 0}
              detalle={espera?.unidad ?? ""}
              pie={masAntigua ? `${masAntigua.factura_numero ?? masAntigua.ref_interna} · ${masAntigua.beneficiario ?? "sin nombre"}` : undefined}
            />
            <PorQueEsperan pendientes={a.pendientes} />
          </section>

          <ListaPendientes pendientes={a.pendientes} porVerificar={verificacion.filas} />
        </>
      )}

      <p className="max-w-[760px] text-[13px] leading-relaxed text-muted-foreground">
        Aprueban: {aprobadores}. Desde <Monto usd={a.doble_aprobacion_desde_usd} moneda={a.moneda_base} /> hacen falta dos personas distintas.
      </p>
    </>
  );
}
