import type { IdRegla } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// «Por qué esperan» (#131): las facturas pendientes agrupadas por la causa que pide a una persona, en una barra apilada.
// Dice de un vistazo qué tipo de trabajo hay: verificar proveedores, aprobar montos altos o confirmar datos.

type Causa = { id: string; etiqueta: string; color: string; reglas: IdRegla[] };

const CAUSAS: Causa[] = [
  { id: "verificar", etiqueta: "Proveedor sin verificar", color: "bg-escalada-punto", reglas: ["R3", "R11"] },
  { id: "monto", etiqueta: "Monto sobre el límite", color: "bg-link", reglas: ["R9", "R8", "R6"] },
  { id: "datos", etiqueta: "Datos por confirmar", color: "bg-frenada-punto", reglas: ["R1"] },
];

/** La causa principal de una factura: la primera que coincide en el orden de CAUSAS; si ninguna, «Otra revisión». */
export function causaDe(reglas: readonly IdRegla[]): string {
  return CAUSAS.find((c) => c.reglas.some((r) => reglas.includes(r)))?.id ?? "otra";
}

export function PorQueEsperan({ pendientes }: Readonly<{ pendientes: { reglas_que_fallaron: IdRegla[] }[] }>) {
  const total = pendientes.length;
  const filas = [...CAUSAS, { id: "otra", etiqueta: "Otra revisión", color: "bg-muted-foreground/50", reglas: [] }]
    .map((c) => ({ ...c, n: pendientes.filter((p) => causaDe(p.reglas_que_fallaron) === c.id).length }))
    .filter((c) => c.n > 0);

  return (
    <section aria-labelledby="por-que" className="flex h-full flex-col gap-3 rounded-[18px] bg-card p-5 ring-1 ring-border">
      <h2 id="por-que" className="text-[13px] text-muted-foreground">
        Por qué esperan
      </h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Nada espera una decisión.</p>
      ) : (
        <>
          <div role="img" aria-label={filas.map((f) => `${f.etiqueta}: ${f.n}`).join(", ")} className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {filas.map((f) => (
              <span key={f.id} className={cn("h-full first:rounded-l-full last:rounded-r-full", f.color)} style={{ width: `${(f.n / total) * 100}%` }} />
            ))}
          </div>
          <dl className="flex flex-col gap-1.5">
            {filas.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 text-[13px]">
                <dt className="flex items-center gap-2 text-texto-3">
                  <span aria-hidden className={cn("size-2 rounded-full", f.color)} />
                  {f.etiqueta}
                </dt>
                <dd className="font-mono font-medium tabular-nums">{f.n}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
