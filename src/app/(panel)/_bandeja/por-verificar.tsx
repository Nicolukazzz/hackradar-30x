import { ArrowRightIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";

import { Monto, Tarjeta, hora } from "@/app/_componentes";
import type { PorVerificar } from "@/servicios/verificar";

// Arriba de la Bandeja (llama la atención): facturas que esperan porque no se reconoce a quien cobra o desde dónde
// escribió. «Verificar» abre la factura con la casilla de agregar al proveedor o vincular el canal ya marcada.

function quien(p: PorVerificar): string {
  const r = p.remitente;
  if (!r) return "remitente desconocido";
  if (r.tipo === "telegram") return `Telegram (chat ${r.valor})`;
  if (r.tipo === "portal") return "el portal";
  return r.valor;
}

function motivo(p: PorVerificar): string {
  const nombre = p.beneficiario ?? "Quien cobra";
  return p.motivo === "proveedor_nuevo"
    ? `${nombre} no está en tus proveedores · escribió desde ${quien(p)}`
    : `${nombre} escribió desde ${quien(p)}, que no está vinculado a su perfil`;
}

export function PorVerificarCaja({ filas }: { readonly filas: PorVerificar[] }) {
  if (filas.length === 0) return null;
  return (
    <Tarjeta as="section" aria-labelledby="verificar" className="ring-2 ring-escalada-punto/60">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5 pb-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-full bg-escalada text-escalada-foreground">
            <ShieldAlertIcon className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 id="verificar" className="text-[17px] font-semibold tracking-tight">
              {filas.length === 1 ? "1 factura de alguien sin verificar" : `${filas.length} facturas de remitentes sin verificar`}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              No se pagan solas. Verifica quién es: al aprobar puedes agregarlo a tus proveedores o vincular su correo, y las próximas pasan directo.
            </p>
          </div>
        </div>
      </div>
      <ul className="flex flex-col">
        {filas.map((p) => (
          <li key={p.ref_interna} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-subtle px-6 py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium break-words">
                {p.factura_numero ?? p.ref_interna} · <Monto usd={p.monto_usd_centavos} moneda={p.moneda_base} />
              </span>
              <span className="text-[13px] break-words text-muted-foreground">
                {motivo(p)} · {hora(p.recibido_en)}
              </span>
            </div>
            <Link
              href={`/facturas/${encodeURIComponent(p.ref_interna)}?verificar=1#decidir`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Verificar
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
