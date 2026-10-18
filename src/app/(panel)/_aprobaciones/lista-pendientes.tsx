import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Monto, MontoDudoso, Tarjeta, hora } from "@/app/_componentes";
import type { TarjetaAprobacion } from "@/servicios/aprobaciones";
import type { PorVerificar } from "@/servicios/verificar";

// Lista de Aprobaciones (#125, #126): una fila por factura que espera una decisión, con el botón «Verificar» que abre la
// factura en el panel de decisión. Antes estaba en la Bandeja como «remitentes sin verificar»; ahora vive aquí y trae
// todas las escaladas pendientes. Las de remitente sin verificar (R3/R11) dicen quién escribió y desde dónde, y abren la
// decisión con «Agregar a la lista» o «Vincular correo» ya marcada (#110); las demás dicen su motivo en una línea.

function quien(p: PorVerificar): string {
  const r = p.remitente;
  if (!r) return "remitente desconocido";
  if (r.tipo === "telegram") return `Telegram (chat ${r.valor})`;
  if (r.tipo === "whatsapp") return `WhatsApp (+${r.valor})`;
  if (r.tipo === "portal") return "el portal";
  return r.valor;
}

function motivoVerificar(p: PorVerificar): string {
  const nombre = p.beneficiario ?? "Quien cobra";
  return p.motivo === "proveedor_nuevo"
    ? `${nombre} no está en tus proveedores · escribió desde ${quien(p)}`
    : `${nombre} escribió desde ${quien(p)}, que no está vinculado a su perfil`;
}

/** La causa principal de la explicación del agente (§7), sin «Escalada:», sin causas extra ni la nota de reserva. */
function motivoCorto(t: TarjetaAprobacion): string {
  let texto = t.explicacion;
  const dosPuntos = texto.indexOf(": ");
  if (dosPuntos > 0 && dosPuntos < 12) texto = texto.slice(dosPuntos + 2);
  for (const corte of [" Además, ", " Se reservan ", " Monto por decidir"]) {
    const i = texto.indexOf(corte);
    if (i > 0) texto = texto.slice(0, i);
  }
  texto = texto.trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function ListaPendientes({ pendientes, porVerificar }: Readonly<{ pendientes: TarjetaAprobacion[]; porVerificar: PorVerificar[] }>) {
  if (pendientes.length === 0) return null;
  const verificar = new Map(porVerificar.map((p) => [p.ref_interna, p]));
  const todasSinVerificar = pendientes.every((t) => verificar.has(t.ref_interna));
  const n = pendientes.length;
  let titulo: string;
  // El número va en la insignia de al lado: el título no lo repite.
  if (todasSinVerificar) titulo = n === 1 ? "De alguien sin verificar" : "De remitentes sin verificar";
  else titulo = n === 1 ? "Espera tu decisión" : "Esperan tu decisión";

  return (
    <Tarjeta as="section" aria-labelledby="pendientes" className="ring-2 ring-escalada-punto/60">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5 pb-3">
        <div className="flex items-start gap-3">
          {/* #131: el número, no un ícono genérico de escudo. */}
          <span aria-hidden className="mt-0.5 flex size-10 flex-none items-center justify-center rounded-[12px] bg-escalada font-mono text-base font-semibold text-escalada-foreground tabular-nums">
            {n}
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 id="pendientes" className="text-[17px] font-semibold tracking-tight">
              {titulo}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              No se pagan solas. Verifica cada una: si es de alguien nuevo, al aprobar puedes agregarlo a tus proveedores o vincular su correo, y las
              próximas pasan directo.
            </p>
          </div>
        </div>
      </div>
      <ul className="flex flex-col">
        {pendientes.map((t) => {
          const v = verificar.get(t.ref_interna);
          const urgente = t.asignacion?.urgente;
          return (
            <li key={t.ref_interna} className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-subtle px-6 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium break-words">
                  {t.factura_numero ?? t.ref_interna} ·{" "}
                  {t.monto_usd_centavos === null ? (
                    <MontoDudoso dinero={t.monto_original} confianza={t.monto_confianza} estimado={t.monto_estimado} />
                  ) : (
                    <span className="text-pagada-foreground">
                      <Monto usd={t.monto_usd_centavos} moneda={t.moneda_base} />
                    </span>
                  )}
                  {urgente ? <span className="ml-2 rounded-full bg-frenada px-2 py-0.5 text-[11px] font-medium text-frenada-foreground">Vence hoy</span> : null}
                </span>
                <span className="text-[13px] break-words text-muted-foreground">
                  {v ? motivoVerificar(v) : `${t.beneficiario ?? "Proveedor sin identificar"} · ${motivoCorto(t)}`} · {hora(t.recibido_en)}
                </span>
              </div>
              <Link
                href={`/facturas/${encodeURIComponent(t.ref_interna)}${v ? "?verificar=1" : ""}#decidir`}
                className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Verificar
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
