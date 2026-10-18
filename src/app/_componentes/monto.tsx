import { formatearBase } from "@/dominio/dinero";
import type { Dinero, Moneda } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// Montos siempre con formatear() de dinero.ts (§6) en Geist Mono con cifras tabulares.
// <Monto dinero={{ centavos: 840000000, moneda: "COP" }} /> → COP 8.400.000
// <Monto usd={744405} /> → USD 7.444,05 · <Monto usd={744405} sinCodigo /> → 7.444,05
// `usd` es un monto en la moneda base; `moneda` la dice (#86, por defecto USD): <Monto usd={x} moneda="COP" />.
// Sin monto (null: extracción fallida, R1) → "—" con texto para lector de pantalla.

type Props = { className?: string } & (
  | { dinero: Dinero | null; usd?: never; sinCodigo?: never }
  | { usd: number | null; dinero?: never; sinCodigo?: boolean; moneda?: Moneda }
);

function texto(p: Props): string | null {
  const d = p.dinero !== undefined ? p.dinero : p.usd === null ? null : { centavos: p.usd, moneda: p.moneda ?? "USD" };
  if (d === null || !Number.isSafeInteger(d.centavos) || d.centavos < 0) return null;
  const t = formatearBase(d.centavos, d.moneda);
  return p.sinCodigo ? t.slice(d.moneda.length + 1) : t;
}

export function Monto(props: Props) {
  const t = texto(props);
  return (
    <span className={cn("font-mono whitespace-nowrap tabular-nums", props.className)}>
      {t ?? (
        <>
          <span aria-hidden>—</span>
          <span className="sr-only">sin monto</span>
        </>
      )}
    </span>
  );
}
