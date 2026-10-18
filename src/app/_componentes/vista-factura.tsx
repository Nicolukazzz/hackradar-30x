
import type { Campo, CampoRequerible, Dinero, EntradaRegistro, Extraccion } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

import { fechaCorta } from "./formato";
import { Monto } from "./monto";
import { PildoraDecision } from "./pildora-decision";

// Vista de factura (#119): lo que el agente leyó, como una hoja. Cada dato dice si se leyó bien, si quedó con dudas o
// si falta, y abajo qué no se cumplió, en palabras. Sustituye al JSON del registro: nadie lee JSON.

type Estado = "leido" | "dudoso" | "falta" | "opcional";

type Fila = { clave: CampoRequerible | "monto_total" | "subtotal" | "impuestos"; etiqueta: string; campo: Campo<unknown> | undefined; mostrar: (v: unknown) => React.ReactNode };

const fecha = (v: unknown) => fechaCorta(`${String(v)}T12:00:00`);
const dinero = (v: unknown) => <Monto dinero={v as Dinero} />;

function filas(ext: Extraccion): Fila[] {
  return [
    { clave: "beneficiario_nombre", etiqueta: "Proveedor", campo: ext.beneficiario_nombre, mostrar: String },
    { clave: "identificacion_fiscal", etiqueta: "NIT / identificación", campo: ext.identificacion_fiscal, mostrar: String },
    { clave: "numero", etiqueta: "Número de factura", campo: ext.numero, mostrar: (v) => <span className="font-mono">{String(v)}</span> },
    { clave: "concepto", etiqueta: "Concepto", campo: ext.concepto, mostrar: String },
    { clave: "fecha_emision", etiqueta: "Fecha de emisión", campo: ext.fecha_emision, mostrar: fecha },
    { clave: "fecha_vencimiento", etiqueta: "Vence", campo: ext.fecha_vencimiento, mostrar: fecha },
    { clave: "cuenta_destino_ultimos4", etiqueta: "Cuenta destino", campo: ext.cuenta_destino_ultimos4, mostrar: (v) => <span className="font-mono">•••• {String(v)}</span> },
    { clave: "referencia_acuerdo", etiqueta: "Referencia (OC, contrato)", campo: ext.referencia_acuerdo, mostrar: (v) => <span className="font-mono">{String(v)}</span> },
    { clave: "subtotal", etiqueta: "Subtotal", campo: ext.subtotal, mostrar: dinero },
    { clave: "impuestos", etiqueta: "Impuestos", campo: ext.impuestos, mostrar: dinero },
    { clave: "monto_total", etiqueta: "Total", campo: ext.monto_total, mostrar: dinero },
  ];
}

function estadoDe(f: Fila, requeridos: readonly CampoRequerible[], minima: number): Estado {
  const vacio = !f.campo || f.campo.valor === null || f.campo.valor === "";
  const exigido = f.clave === "monto_total" || (requeridos as readonly string[]).includes(f.clave);
  if (vacio) return exigido ? "falta" : "opcional";
  return f.campo!.confianza >= minima ? "leido" : "dudoso";
}

// #131: marcas tipográficas en vez de íconos de círculo (se veían genéricos): un punto para lo leído y una etiqueta
// corta solo donde hay algo que mirar.
const MARCA: Record<Estado, { punto: string; texto: string }> = {
  leido: { punto: "bg-pagada-punto", texto: "Leído" },
  dudoso: { punto: "bg-escalada-punto", texto: "Con dudas" },
  falta: { punto: "bg-frenada-punto", texto: "Falta" },
  opcional: { punto: "bg-muted-foreground/40", texto: "No viene" },
};

function Marca({ estado }: { estado: Estado }) {
  return <span aria-hidden title={MARCA[estado].texto} className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", MARCA[estado].punto)} />;
}

export function VistaFactura({
  entrada,
  requeridos,
  confianzaMinima,
}: {
  entrada: EntradaRegistro;
  requeridos: readonly CampoRequerible[];
  confianzaMinima: number;
}) {
  const ext = entrada.extraccion;
  const lista = ext ? filas(ext).map((f) => ({ ...f, estado: estadoDe(f, requeridos, confianzaMinima) })) : [];
  // Los opcionales que no vienen no se muestran: solo hacen ruido.
  const visibles = lista.filter((f) => f.estado !== "opcional");
  const faltan = lista.filter((f) => f.estado === "falta" || f.estado === "dudoso");
  const fallidas = entrada.evaluaciones.filter((e) => e.resultado === "FALLA" || e.resultado === "INDETERMINADO");

  return (
    <div className="flex flex-col gap-4">
      {/* La hoja */}
      <div className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
        <div className="flex items-start justify-between gap-3 border-b border-dashed border-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">Factura</span>
            <span className="truncate text-[17px] font-semibold">{entrada.beneficiario ?? "Proveedor sin identificar"}</span>
            <span className="font-mono text-[13px] text-muted-foreground">{entrada.factura_numero ?? entrada.ref_interna}</span>
          </div>
          {entrada.decision ? <PildoraDecision decision={entrada.decision} /> : null}
        </div>

        {ext && ext.es_factura.valor !== false ? (
          <dl className="flex flex-col">
            {visibles.map((f) => (
              <div key={f.clave} className={cn("flex items-start gap-3 px-5 py-2.5 text-sm not-last:border-b not-last:border-subtle", f.clave === "monto_total" && "bg-superficie-2")}>
                <Marca estado={f.estado} />
                <span className="sr-only">{MARCA[f.estado].texto}: </span>
                <dt className="w-[42%] shrink-0 text-muted-foreground">{f.etiqueta}</dt>
                <dd className={cn("min-w-0 flex-1 text-right break-words", f.clave === "monto_total" && "font-semibold")}>
                  {f.estado === "falta" ? <span className="text-frenada-foreground">No se leyó</span> : f.mostrar(f.campo!.valor)}
                  {f.estado === "dudoso" ? <span className="ml-2 rounded-full bg-escalada px-1.5 py-0.5 text-[11px] font-medium text-escalada-foreground">Con dudas</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">{ext ? "El documento no parece una factura: no se leyeron datos de pago." : "Esta entrada no trae datos leídos."}</p>
        )}
      </div>

      {/* Leyenda corta */}
      {ext && visibles.length > 0 ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(["leido", "dudoso", "falta"] as const).map((e) => (
            <span key={e} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-1.5 rounded-full", MARCA[e].punto)} />
              {MARCA[e].texto}
            </span>
          ))}
        </p>
      ) : null}

      {/* Qué falta */}
      {faltan.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-escalada-suave px-4 py-3.5 ring-1 ring-escalada-borde">
          <span className="text-sm font-semibold text-escalada-foreground">Qué falta confirmar</span>
          <ul className="flex flex-col gap-1 text-sm text-escalada-foreground">
            {faltan.map((f) => (
              <li key={f.clave}>
                {f.etiqueta}: {f.estado === "falta" ? "no se pudo leer" : `se leyó con dudas (${Math.round((f.campo?.confianza ?? 0) * 100)} %)`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Qué no se cumplió */}
      {fallidas.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-border">
          <span className="text-sm font-semibold">{entrada.decision === "FRENAR" ? "Por qué no se paga" : "Por qué necesita a una persona"}</span>
          <ul className="flex flex-col gap-2">
            {fallidas.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 text-sm">
                <span className="font-medium">{e.nombre}</span>
                <span className="text-[13px] text-muted-foreground">{e.comparacion}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : entrada.decision === "PAGAR" ? (
        <p className="flex items-center gap-2.5 rounded-2xl bg-pagada px-4 py-3 text-sm text-pagada-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-pagada-punto" />
          Cumplió todas las reglas: pagada.
        </p>
      ) : null}
    </div>
  );
}
