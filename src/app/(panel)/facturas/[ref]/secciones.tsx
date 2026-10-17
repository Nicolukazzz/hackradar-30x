import { BarraConfianza, Monto, PildoraResultado, Tarjeta, TarjetaEncabezado, TarjetaPie, fechaCorta, hora } from "@/app/_componentes";
import type { HitoLineaTiempo, RespuestaFactura } from "@/app/_datos/facturas";
import type { Dinero, IdRegla } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// Secciones de la traza (§13.2) que no tienen interacción: datos extraídos, reglas y línea de tiempo.

type CampoVista = { etiqueta: string; valor: React.ReactNode; confianza: number | null };

function campos(f: RespuestaFactura): CampoVista[] {
  const ext = f.extraccion;
  if (!ext) return [];
  const fecha = (v: string | null) => (v ? fechaCorta(v) : null);
  const dinero = (d: Dinero | null) => (d ? <Monto dinero={d} /> : null);
  const lista: CampoVista[] = [
    { etiqueta: "Beneficiario", valor: ext.beneficiario_nombre.valor, confianza: ext.beneficiario_nombre.confianza },
    { etiqueta: "Número", valor: ext.numero.valor ? <span className="font-mono">{ext.numero.valor}</span> : null, confianza: ext.numero.confianza },
    { etiqueta: "Monto", valor: dinero(ext.monto_total.valor), confianza: ext.monto_total.confianza },
    { etiqueta: "Emisión", valor: fecha(ext.fecha_emision.valor), confianza: ext.fecha_emision.confianza },
    { etiqueta: "Vencimiento", valor: fecha(ext.fecha_vencimiento.valor), confianza: ext.fecha_vencimiento.confianza },
    {
      etiqueta: "Cuenta destino",
      valor: ext.cuenta_destino_ultimos4.valor ? <span className="font-mono">•••• {ext.cuenta_destino_ultimos4.valor}</span> : null,
      confianza: ext.cuenta_destino_ultimos4.confianza,
    },
    { etiqueta: "Concepto", valor: ext.concepto.valor, confianza: ext.concepto.confianza },
  ];
  if (ext.subtotal?.valor) lista.push({ etiqueta: "Subtotal", valor: dinero(ext.subtotal.valor), confianza: ext.subtotal.confianza });
  if (ext.impuestos?.valor) lista.push({ etiqueta: "Impuestos", valor: dinero(ext.impuestos.valor), confianza: ext.impuestos.confianza });
  if (ext.referencia_acuerdo?.valor) {
    const hito = ext.hito_numero?.valor ? ` · hito ${ext.hito_numero.valor}` : "";
    lista.push({ etiqueta: "Acuerdo", valor: <span className="font-mono">{ext.referencia_acuerdo.valor + hito}</span>, confianza: ext.referencia_acuerdo.confianza });
  }
  return lista;
}

export function DatosExtraidos({ f }: { f: RespuestaFactura }) {
  const lista = campos(f);
  return (
    <Tarjeta as="section" aria-labelledby="ext">
      <TarjetaEncabezado id="ext" titulo="Datos extraídos" descripcion="Umbral de confianza: 90%" />
      {lista.length === 0 ? (
        <p className="border-t border-border px-6 py-5 text-sm text-muted-foreground">No se pudieron extraer datos de este documento.</p>
      ) : (
        <dl>
          {lista.map((c) => (
            <div key={c.etiqueta} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1.5 border-t border-subtle px-6 py-3 sm:grid-cols-[130px_minmax(0,1fr)_120px]">
              <dt className="text-[13px] text-muted-foreground">{c.etiqueta}</dt>
              <dd className="text-sm font-medium break-words">{c.valor ?? <span className="font-normal text-escalada-foreground">No se pudo leer</span>}</dd>
              <dd className="col-span-2 sm:col-span-1">
                <BarraConfianza campo={c.etiqueta} valor={c.confianza ?? 0} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Tarjeta>
  );
}

function lista(ids: IdRegla[]): string {
  if (ids.length <= 1) return ids.join("");
  return `${ids.slice(0, -1).join(", ")} y ${ids.at(-1)}`;
}

/** "Resultado: Escalar · fallaron R3, R10 y R11, ninguna regla de frenar falló" */
function resultado(f: RespuestaFactura): { decision: string; detalle: string } {
  const { entrada, evaluaciones } = f;
  const frenan = evaluaciones.filter((e) => e.si_falla === "FRENAR" && e.resultado === "FALLA").map((e) => e.id);
  const fallan = entrada.reglas_que_fallaron;
  switch (entrada.decision) {
    case "PAGAR":
      return { decision: "Pagar", detalle: "todas las reglas cumplen o no aplican" };
    case "FRENAR": {
      const otras = fallan.filter((x) => !frenan.includes(x));
      const tambien = otras.length > 0 ? "; también falló " + lista(otras) : "";
      return { decision: "Frenar", detalle: `falló ${lista(frenan)} (regla de frenar)${tambien}` };
    }
    case "ESCALAR":
      return { decision: "Escalar", detalle: `${fallan.length > 1 ? "fallaron" : "falló"} ${lista(fallan)}, ninguna regla de frenar falló` };
    default:
      return { decision: "No es factura", detalle: "no entra a las reglas de pago" };
  }
}

export function TrazaReglas({ f }: { f: RespuestaFactura }) {
  const r = resultado(f);
  return (
    <Tarjeta as="section" aria-labelledby="traza">
      <TarjetaEncabezado id="traza" titulo="Traza de reglas" descripcion="En el orden en que se evaluaron. Código determinista: el modelo solo extrae, no decide." />
      {f.evaluaciones.length === 0 ? (
        <p className="border-t border-border px-6 py-5 text-sm text-muted-foreground">No se evaluaron reglas de pago: el documento no es una factura.</p>
      ) : (
        <ol>
          {f.evaluaciones.map((e) => {
            const falla = e.resultado === "FALLA" || e.resultado === "INDETERMINADO";
            const frena = e.resultado === "FALLA" && e.si_falla === "FRENAR";
            return (
              <li
                key={e.id}
                className={cn(
                  "grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-t border-subtle px-6 py-3 sm:grid-cols-[44px_minmax(0,1fr)_auto]",
                  falla && (frena ? "bg-frenada/40" : "bg-escalada/40"),
                )}
              >
                <span className="font-mono text-[13px] font-semibold">{e.id}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{e.nombre}</span>
                  <span className="font-mono text-xs break-words text-texto-3">{e.comparacion}</span>
                </span>
                <PildoraResultado resultado={e.resultado} siFalla={e.si_falla} className="col-start-2 justify-self-start sm:col-start-3 sm:justify-self-end" />
              </li>
            );
          })}
        </ol>
      )}
      <TarjetaPie className="flex flex-col gap-1">
        <span>
          <strong className="font-semibold text-foreground">Resultado: {r.decision}</strong> · {r.detalle}
        </span>
        {f.observaciones.map((o) => (
          <span key={o}>Observación (no decide): {o.charAt(0).toLowerCase() + o.slice(1)}</span>
        ))}
      </TarjetaPie>
    </Tarjeta>
  );
}

const PUNTO: Record<HitoLineaTiempo["tono"], string> = {
  neutro: "bg-[#a7b1ac]",
  pagada: "bg-pagada-punto",
  frenada: "bg-frenada-punto",
  escalada: "bg-escalada-punto",
  humana: "bg-primary",
  pendiente: "border-2 border-escalada-punto bg-card",
};

export function LineaDeTiempo({ hitos }: { hitos: HitoLineaTiempo[] }) {
  return (
    <Tarjeta as="section" aria-labelledby="tl" className="px-6 py-5">
      <h2 id="tl" className="mb-4 text-[17px] font-semibold tracking-tight">
        Línea de tiempo
      </h2>
      <ol className="flex flex-col">
        {hitos.map((h, i) => (
          <li key={`${h.titulo}-${i}`} className="grid grid-cols-[16px_minmax(0,1fr)] gap-3">
            <span className="flex flex-col items-center">
              <span aria-hidden className={cn("mt-1 size-3 shrink-0 rounded-full", PUNTO[h.tono])} />
              {i < hitos.length - 1 ? <span aria-hidden className="w-px flex-1 bg-border" /> : null}
            </span>
            <span className="flex flex-col gap-0.5 pb-4">
              <span className="font-mono text-xs text-muted-foreground">{h.momento ? hora(h.momento, true) : "Ahora"}</span>
              <span className="text-sm font-semibold">{h.titulo}</span>
              <span className="text-[13px] leading-snug text-texto-3">{h.texto}</span>
            </span>
          </li>
        ))}
      </ol>
    </Tarjeta>
  );
}
