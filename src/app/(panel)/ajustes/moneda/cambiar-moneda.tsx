"use client";

import { ArrowRightIcon, BanknoteIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { SelectorOpciones } from "@/app/_componentes/invitacion";
import { llamar } from "@/app/_componentes/llamar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { MONEDAS, type Moneda } from "@/dominio/tipos";
import type { PermisoUI } from "@/lib/auth/permisos";
import type { FilaConversion, VistaPreviaMoneda } from "@/servicios/moneda";

// Cambiar la moneda base (#86), en 3 pasos: elegir → ver qué se convierte y con qué tasa → confirmar. Nada cambia hasta
// el último paso; el servidor vuelve a calcular la conversión al confirmar.

type Paso = 1 | 2 | 3;

export function CambiarMoneda({ actual, permiso }: Readonly<{ actual: Moneda; permiso: PermisoUI }>) {
  const router = useRouter();
  const opciones = MONEDAS.filter((m) => m !== actual).map((m) => ({ value: m, label: m }));
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>(1);
  const [nueva, setNueva] = useState<string>(opciones[0]?.value ?? "COP");
  const [vista, setVista] = useState<VistaPreviaMoneda | null>(null);
  const [entiendo, setEntiendo] = useState(false);
  const [ocupado, iniciar] = useTransition();

  if (!permiso.ok) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Boton variante="secundaria" disabled>
          <BanknoteIcon aria-hidden />
          Cambiar moneda base
        </Boton>
        <span className="max-w-[260px] text-right text-[13px] text-muted-foreground">{permiso.motivo}</span>
      </div>
    );
  }

  function verVistaPrevia() {
    iniciar(async () => {
      try {
        setVista(await llamar<VistaPreviaMoneda>(`/api/empresa/moneda?a=${encodeURIComponent(nueva)}`, "GET"));
        setPaso(2);
      } catch (e) {
        toast.error("No se pudo preparar el cambio", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  function confirmar() {
    iniciar(async () => {
      try {
        await llamar("/api/empresa/moneda", "POST", { moneda: nueva });
        toast.success(`La moneda base ahora es ${nueva}`, { description: "Límites convertidos y cambio registrado." });
        setAbierto(false);
        router.refresh();
      } catch (e) {
        toast.error("No se cambió la moneda", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  function cambiarAbierto(a: boolean) {
    setAbierto(a);
    if (!a) {
      setPaso(1);
      setVista(null);
      setEntiendo(false);
    }
  }

  const titulo = { 1: "¿A qué moneda?", 2: "Esto se convierte", 3: "Confirma el cambio" }[paso];
  const descripcion = {
    1: `Hoy todo está en ${actual}. Elige la moneda en la que quieres ver límites y presupuesto.`,
    2: vista ? `Con la tasa del día: ${vista.tasa} (${vista.fuente ?? "sin fuente"}, ${vista.fecha ?? "sin fecha"}). Se redondea a unidades.` : "",
    3: `Desde ahora las facturas se comparan en ${nueva}. Lo ya pagado este periodo se convierte con la tasa del día al sumar el presupuesto.`,
  }[paso];

  return (
    <>
      <Boton variante="secundaria" onClick={() => setAbierto(true)}>
        <BanknoteIcon aria-hidden />
        Cambiar moneda base
      </Boton>
      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="gap-5 p-6 sm:max-w-lg">
          <DialogHeader>
            <span className="text-xs text-muted-foreground">Paso {paso} de 3</span>
            <DialogTitle className="text-lg">{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>

          {paso === 1 ? (
            <Field>
              <FieldLabel htmlFor="moneda-nueva">Moneda base nueva</FieldLabel>
              <SelectorOpciones id="moneda-nueva" opciones={opciones} valor={nueva} onCambio={setNueva} />
            </Field>
          ) : null}

          {paso === 2 && vista ? (
            <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
              <Tabla titulo="Reglas de pago" filas={vista.reglas} />
              {vista.proveedores.length > 0 ? <Tabla titulo="Límite mensual de proveedores" filas={vista.proveedores} /> : null}
              {vista.aprobadores.length > 0 ? <Tabla titulo="Límite de aprobación" filas={vista.aprobadores} /> : null}
            </div>
          ) : null}

          {paso === 3 ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-[10px] bg-superficie-2 px-3.5 py-3 text-sm leading-relaxed">
              <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} className="mt-1 size-[18px] flex-none accent-primary" />
              <span>
                Entiendo que los límites quedan en <strong className="font-semibold">{nueva}</strong> como en la vista previa, que se guarda una versión nueva de las
                reglas y que el cambio queda en el registro con mi nombre.
              </span>
            </label>
          ) : null}

          <Pie
            paso={paso}
            ocupado={ocupado}
            nueva={nueva}
            listo={entiendo}
            alVolver={() => setPaso((p) => (p - 1) as Paso)}
            alAvanzar={paso === 1 ? verVistaPrevia : () => setPaso(3)}
            alConfirmar={confirmar}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Pie(p: Readonly<{ paso: Paso; ocupado: boolean; nueva: string; listo: boolean; alVolver: () => void; alAvanzar: () => void; alConfirmar: () => void }>) {
  const icono = p.ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <BanknoteIcon aria-hidden />;
  return (
    <DialogFooter className="-mx-6 -mb-6 px-6">
      {p.paso > 1 ? (
        <Boton variante="secundaria" onClick={p.alVolver} disabled={p.ocupado}>
          Atrás
        </Boton>
      ) : null}
      {p.paso < 3 ? (
        <Boton variante="primaria" onClick={p.alAvanzar} disabled={p.ocupado}>
          {p.paso === 1 ? "Ver qué cambia" : "Continuar"}
        </Boton>
      ) : (
        <Boton variante="primaria" onClick={p.alConfirmar} disabled={!p.listo || p.ocupado}>
          {icono}
          {p.ocupado ? "Cambiando…" : `Cambiar a ${p.nueva}`}
        </Boton>
      )}
    </DialogFooter>
  );
}

function Tabla({ titulo, filas }: Readonly<{ titulo: string; filas: FilaConversion[] }>) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold">{titulo}</h3>
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
