"use client";

import { CheckIcon, PencilIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { BarraConfianza, fechaCorta } from "@/app/_componentes";
import { useCorrecciones } from "@/app/_componentes/correcciones";
import { leerUsd } from "@/app/(panel)/_reglas/numeros";
import type { CampoCorregible, Correcciones } from "@/aprobaciones/correcciones";
import { formatear } from "@/dominio/dinero";
import type { Dinero, Moneda } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// «Datos extraídos» con corrección en línea (#129). Cada fila: etiqueta · valor · lápiz · barra de confianza. Los lápices
// van todos en la misma columna, justo a la izquierda de la barra. Corregir un dato no decide nada: la corrección viaja
// con la aprobación o el rechazo y queda en el registro.

export type TipoDato = "texto" | "mono" | "fecha" | "dinero" | "cuenta";

export type FilaDato = {
  etiqueta: string;
  /** campo que se puede corregir; null = solo lectura (p. ej. el hito) */
  clave: CampoCorregible | null;
  tipo: TipoDato;
  valor: string | Dinero | null;
  confianza: number;
  /** moneda para un monto sin leer (la de la factura o la base) */
  moneda: Moneda;
  total?: boolean;
};

function mostrar(tipo: TipoDato, v: string | Dinero | null): React.ReactNode {
  if (v === null || v === "") return null;
  if (tipo === "dinero") return <span className="font-mono whitespace-nowrap tabular-nums">{formatear(v as Dinero)}</span>;
  if (tipo === "fecha") return fechaCorta(v as string);
  if (tipo === "cuenta") return <span className="font-mono">•••• {v as string}</span>;
  if (tipo === "mono") return <span className="font-mono">{v as string}</span>;
  return v as string;
}

/** Texto inicial del campo de edición. */
function crudo(tipo: TipoDato, v: string | Dinero | null): string {
  if (v === null) return "";
  if (tipo === "dinero") return formatear(v as Dinero).replace(/^[A-Z]+ /, "");
  return v as string;
}

/** Lo escrito → valor corregido, o un mensaje de error. */
function leer(f: FilaDato, texto: string): { ok: true; valor: string | Dinero } | { ok: false; error: string } {
  const t = texto.trim();
  if (f.tipo === "dinero") {
    const centavos = leerUsd(t);
    if (centavos === null || centavos <= 0) return { ok: false, error: "Escribe un monto, por ejemplo 3.367,20" };
    const moneda = f.valor && typeof f.valor === "object" ? f.valor.moneda : f.moneda;
    return { ok: true, valor: { centavos, moneda } };
  }
  if (f.tipo === "fecha") return /^\d{4}-\d{2}-\d{2}$/.test(t) ? { ok: true, valor: t } : { ok: false, error: "Elige una fecha" };
  if (f.tipo === "cuenta") return /^\d{4}$/.test(t) ? { ok: true, valor: t } : { ok: false, error: "Los últimos 4 dígitos" };
  return t.length > 0 ? { ok: true, valor: t } : { ok: false, error: "No puede quedar vacío" };
}

function Fila({ f }: { f: FilaDato }) {
  const { correcciones, fijar, editable } = useCorrecciones();
  const corregido = f.clave ? (correcciones[f.clave] as string | Dinero | undefined) : undefined;
  const actual = corregido ?? f.valor;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const prefijo = f.tipo === "dinero" ? (actual && typeof actual === "object" ? actual.moneda : f.moneda) : null;

  function abrir() {
    setTexto(crudo(f.tipo, actual));
    setError(null);
    setEditando(true);
  }
  function guardar() {
    if (!f.clave) return;
    const r = leer(f, texto);
    if (!r.ok) return setError(r.error);
    fijar(f.clave, r.valor as Correcciones[typeof f.clave]);
    setEditando(false);
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[96px_minmax(0,1fr)_36px] items-center gap-x-3 gap-y-1.5 px-6 py-3 sm:grid-cols-[96px_minmax(0,1fr)_36px_88px]",
        // El total se separa con una línea punteada negra a lo ancho de la tabla.
        f.total ? "border-t-2 border-dotted border-foreground" : "border-t border-subtle",
      )}
    >
      <dt className={cn("text-[13px]", f.total ? "font-semibold text-foreground" : "text-muted-foreground")}>{f.etiqueta}</dt>
      <dd className={cn("min-w-0 text-sm break-words", f.total ? "text-base font-semibold" : "font-medium")}>
        {editando ? (
          <form
            className="flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              guardar();
            }}
          >
            <span className="flex items-center gap-1.5">
              {prefijo ? <span className="font-mono text-xs text-muted-foreground">{prefijo}</span> : null}
              <input
                autoFocus
                type={f.tipo === "fecha" ? "date" : "text"}
                inputMode={f.tipo === "dinero" || f.tipo === "cuenta" ? "decimal" : undefined}
                maxLength={f.tipo === "cuenta" ? 4 : 200}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Escape" && setEditando(false)}
                aria-label={`Corregir ${f.etiqueta.toLowerCase()}`}
                aria-invalid={error ? true : undefined}
                className={cn(
                  "h-9 w-full min-w-0 rounded-[8px] border border-borde-fuerte bg-card px-2 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  (f.tipo === "dinero" || f.tipo === "mono" || f.tipo === "cuenta") && "font-mono",
                )}
              />
            </span>
            {error ? <span className="text-xs font-normal text-frenada-foreground">{error}</span> : null}
          </form>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            {mostrar(f.tipo, actual) ?? <span className="font-normal text-escalada-foreground">No se pudo leer</span>}
            {corregido !== undefined ? <span className="rounded-full bg-link/10 px-2 py-0.5 text-[11px] font-medium text-link">Corregido</span> : null}
          </span>
        )}
      </dd>
      {/* Columna fija de lápices: todos alineados, a la izquierda de la barra. */}
      <dd className="flex justify-center">
        {editable && f.clave ? (
          editando ? (
            <span className="flex flex-col gap-1">
              <button type="button" onClick={guardar} aria-label="Guardar corrección" className="flex size-8 items-center justify-center rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90">
                <CheckIcon className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setEditando(false)} aria-label="Cancelar" className="flex size-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted">
                <XIcon className="size-4" aria-hidden />
              </button>
            </span>
          ) : corregido !== undefined ? (
            <button
              type="button"
              onClick={() => f.clave && fijar(f.clave, undefined)}
              aria-label={`Deshacer corrección de ${f.etiqueta.toLowerCase()}`}
              title="Deshacer corrección"
              className="flex size-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcwIcon className="size-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={abrir}
              aria-label={`Corregir ${f.etiqueta.toLowerCase()}`}
              title="Corregir"
              className="flex size-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <PencilIcon className="size-4" aria-hidden />
            </button>
          )
        ) : null}
      </dd>
      <dd className="col-span-3 sm:col-span-1">
        {corregido !== undefined ? (
          <span className="block text-right text-xs font-medium text-link">Por ti</span>
        ) : (
          <BarraConfianza campo={f.etiqueta} valor={f.confianza} />
        )}
      </dd>
    </div>
  );
}

export function TablaDatos({ filas }: Readonly<{ filas: FilaDato[] }>) {
  return (
    <dl>
      {filas.map((f) => (
        <Fila key={f.etiqueta} f={f} />
      ))}
    </dl>
  );
}
