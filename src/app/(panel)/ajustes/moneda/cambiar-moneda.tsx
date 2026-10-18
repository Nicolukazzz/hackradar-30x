"use client";

import { ArrowRightIcon, BanknoteIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { SelectorOpciones } from "@/app/_componentes/invitacion";
import { llamar } from "@/app/_componentes/llamar";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { MONEDAS, type Moneda } from "@/dominio/tipos";
import type { PermisoUI } from "@/lib/auth/permisos";
import type { FilaConversion, VistaPreviaMoneda } from "@/servicios/moneda";

// Moneda base en línea (#156): la lista se despliega en la misma tarjeta. Al elegir otra moneda, debajo aparece lo que
// se convierte (con la tasa del día) y la confirmación; nada cambia hasta confirmar, y el servidor vuelve a calcular la
// conversión al aplicar. Sin permiso de administrador se ve la moneda y el motivo, sin lista.

export function MonedaBase({ actual, nombres, permiso }: Readonly<{ actual: Moneda; nombres: Partial<Record<Moneda, string>>; permiso: PermisoUI }>) {
  const router = useRouter();
  const [elegida, setElegida] = useState<Moneda>(actual);
  const [vista, setVista] = useState<VistaPreviaMoneda | null>(null);
  const [entiendo, setEntiendo] = useState(false);
  const [cargando, iniciarCarga] = useTransition();
  const [aplicando, iniciarCambio] = useTransition();

  const etiqueta = (m: Moneda) => (nombres[m] ? `${m} · ${nombres[m]}` : m);
  const opciones = MONEDAS.map((m) => ({ value: m, label: etiqueta(m) }));

  if (!permiso.ok) {
    return (
      <div className="flex flex-col gap-1.5 px-6 pb-6">
        <p className="flex items-baseline gap-3">
          <span className="font-mono text-3xl font-semibold tabular-nums">{actual}</span>
          <span className="text-muted-foreground">{nombres[actual] ?? ""}</span>
        </p>
        <p className="text-[13px] text-muted-foreground">{permiso.motivo}</p>
      </div>
    );
  }

  function elegir(valor: string) {
    const m = valor as Moneda;
    setElegida(m);
    setVista(null);
    setEntiendo(false);
    if (m === actual) return;
    iniciarCarga(async () => {
      try {
        setVista(await llamar<VistaPreviaMoneda>(`/api/empresa/moneda?a=${encodeURIComponent(m)}`, "GET"));
      } catch (e) {
        toast.error("No se pudo preparar el cambio", { description: e instanceof Error ? e.message : undefined });
        setElegida(actual);
      }
    });
  }

  function cancelar() {
    setElegida(actual);
    setVista(null);
    setEntiendo(false);
  }

  function confirmar() {
    iniciarCambio(async () => {
      try {
        await llamar("/api/empresa/moneda", "POST", { moneda: elegida });
        toast.success(`La moneda base ahora es ${elegida}`, { description: "Límites convertidos y cambio registrado." });
        setVista(null);
        setEntiendo(false);
        router.refresh();
      } catch (e) {
        toast.error("No se cambió la moneda", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  const cambiando = elegida !== actual;

  return (
    <div className="flex flex-col gap-5 px-6 pb-6">
      <Field className="max-w-[360px]">
        <FieldLabel htmlFor="moneda-base">Moneda base</FieldLabel>
        <SelectorOpciones id="moneda-base" opciones={opciones} valor={elegida} onCambio={elegir} />
        {cambiando ? null : <FieldDescription>Elige otra moneda para ver qué cambia antes de aplicarlo.</FieldDescription>}
      </Field>

      {cambiando && cargando ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Calculando la conversión a {elegida}…
        </p>
      ) : null}

      {cambiando && vista ? (
        <section aria-label={`Cambio de ${actual} a ${elegida}`} className="flex animate-in flex-col gap-4 border-t border-subtle pt-5 duration-200 fade-in slide-in-from-top-1">
          <div className="flex flex-col gap-1">
            <h3 className="text-[15px] font-semibold">
              Esto pasa a {elegida}
            </h3>
            <p className="text-sm text-muted-foreground">
              Con la tasa del día: {vista.tasa} ({vista.fuente ?? "sin fuente"}, {vista.fecha ?? "sin fecha"}). Se redondea a unidades.
            </p>
          </div>

          <Tabla titulo="Reglas de pago" filas={vista.reglas} />
          {vista.proveedores.length > 0 ? <Tabla titulo="Límite mensual de proveedores" filas={vista.proveedores} /> : null}
          {vista.aprobadores.length > 0 ? <Tabla titulo="Límite de aprobación" filas={vista.aprobadores} /> : null}

          <label className="flex cursor-pointer items-start gap-3 rounded-[10px] bg-superficie-2 px-3.5 py-3 text-sm leading-relaxed">
            <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} className="mt-1 size-[18px] flex-none accent-primary" />
            <span>
              Desde ahora las facturas se comparan en <strong className="font-semibold">{elegida}</strong>. Se guarda una versión nueva de las reglas con estos
              límites y el cambio queda en el registro con mi nombre.
            </span>
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <Boton variante="secundaria" onClick={cancelar} disabled={aplicando}>
              Cancelar
            </Boton>
            <Boton variante="primaria" onClick={confirmar} disabled={!entiendo || aplicando}>
              {aplicando ? <Loader2Icon className="animate-spin" aria-hidden /> : <BanknoteIcon aria-hidden />}
              {aplicando ? "Cambiando…" : `Cambiar a ${elegida}`}
            </Boton>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Tabla({ titulo, filas }: Readonly<{ titulo: string; filas: FilaConversion[] }>) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {filas.map((f) => (
          <li key={f.concepto} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3.5 py-2.5 text-sm">
            <span>{f.concepto}</span>
            <span className="flex items-center gap-2 font-mono text-[13px] tabular-nums">
              <span className="text-muted-foreground">{f.antes}</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="font-semibold">{f.despues}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
