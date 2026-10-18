"use client";

import {
  AlertTriangleIcon,
  BanknoteIcon,
  CalendarRangeIcon,
  CheckCircle2Icon,
  CopyIcon,
  FileCheckIcon,
  FingerprintIcon,
  GaugeIcon,
  HistoryIcon,
  Loader2Icon,
  PercentIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Boton, fechaCorta, porcentajeUi } from "@/app/_componentes";
import { FilaAjuste, GrupoAjustes } from "@/app/_componentes/ajustes";
import { useMonedaBase } from "@/app/_componentes/moneda-base";
import type { ReporteEvaluacion } from "@/app/_datos/reglas";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CAMPOS_REQUERIBLES, type Reglas } from "@/dominio/tipos";
import type { PermisoUI } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

import { ETIQUETA_REQUISITO, MODOS_IDENTIDAD, aReglas, desdeReglas, huellaDe, iguales, type Errores, type Formulario } from "./formulario";
import { escribirUsd } from "./numeros";

// Reglas de pago por pasos (#87, #119), estilo iPhone: una lista de secciones con su valor actual. Cada fila abre un
// diálogo con 1–3 campos; mientras se edita, el cambio se prueba contra el set de facturas de prueba (POST
// /api/reglas/simular) y solo se puede guardar si no aprobaría ningún pago fuera de reglas. Guardar crea una versión
// nueva (POST /api/reglas, que vuelve a simular en el servidor y responde 409 si no es segura).

type Seccion =
  | "automatico"
  | "maximo"
  | "mensual"
  | "acordado"
  | "presupuesto"
  | "requisitos"
  | "identidad"
  | "duplicados"
  | "doble";

const usd = (centavos: number, moneda: string) => `${moneda} ${escribirUsd(centavos).replace(/,00$/, "")}`;
const PERIODO: Record<Reglas["presupuesto"]["periodo"], string> = { mensual: "al mes", quincenal: "por quincena", trimestral: "por trimestre" };

type Simulacion = { estado: "lista"; r: ReporteEvaluacion; huella: string } | { estado: "cargando" } | { estado: "error"; mensaje: string };

/** Prueba `reglas` contra el set de prueba 400 ms después del último cambio. */
function useSimulacion(reglas: Reglas | null, activa: boolean): Simulacion | null {
  const [sim, setSim] = useState<Simulacion | null>(null);
  const huella = reglas ? huellaDe(reglas) : null;
  useEffect(() => {
    if (!activa || !reglas || !huella) return;
    const control = new AbortController();
    const t = setTimeout(async () => {
      setSim({ estado: "cargando" });
      try {
        const res = await fetch("/api/reglas/simular", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reglas), signal: control.signal });
        const datos = (await res.json().catch(() => ({}))) as ReporteEvaluacion & { error?: string };
        if (!res.ok) throw new Error(datos.error ?? "No se pudo probar.");
        setSim({ estado: "lista", r: datos, huella });
      } catch (e) {
        if (!control.signal.aborted) setSim({ estado: "error", mensaje: e instanceof Error ? e.message : "No se pudo probar." });
      }
    }, 400);
    return () => {
      clearTimeout(t);
      control.abort();
    };
    // `reglas` cambia de identidad en cada render; `huella` resume su valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella, activa]);
  return sim && sim.estado === "lista" && sim.huella !== huella ? { estado: "cargando" } : sim;
}

/** Resultado de la prueba en una línea: lo único que hay que mirar antes de guardar. */
function ResultadoPrueba({ sim }: { sim: Simulacion | null }) {
  if (!sim || sim.estado === "cargando")
    return (
      <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        Probando con las facturas de prueba…
      </p>
    );
  if (sim.estado === "error")
    return (
      <p className="flex items-center gap-2 rounded-xl bg-frenada px-4 py-3 text-sm text-frenada-foreground">
        <AlertTriangleIcon className="size-4" aria-hidden />
        {sim.mensaje}
      </p>
    );
  const { r } = sim;
  if (r.pagos_indebidos > 0)
    return (
      <p className="flex items-start gap-2 rounded-xl bg-frenada px-4 py-3 text-sm text-frenada-foreground">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        Con este cambio el agente pagaría {r.pagos_indebidos === 1 ? "1 factura" : `${r.pagos_indebidos} facturas`} que no debía. No se puede guardar.
      </p>
    );
  return (
    <p className="flex items-start gap-2 rounded-xl bg-pagada px-4 py-3 text-sm text-pagada-foreground">
      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      Seguro: ningún pago fuera de reglas. Decide solo el {porcentajeUi(r.autonomia)} de las facturas de prueba.
    </p>
  );
}

function CampoUsd({ id, etiqueta, valor, onCambio, error, ayuda }: { id: string; etiqueta: string; valor: string; onCambio: (v: string) => void; error?: string; ayuda?: string }) {
  const moneda = useMonedaBase();
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-muted-foreground">{moneda}</span>
        <Input id={id} inputMode="decimal" autoFocus value={valor} onChange={(e) => onCambio(e.target.value)} aria-invalid={error ? true : undefined} className="h-12 pl-14 font-mono text-lg tabular-nums" />
      </div>
      {error ? <FieldError>{error}</FieldError> : ayuda ? <FieldDescription>{ayuda}</FieldDescription> : null}
    </Field>
  );
}

function Interruptor({ id, titulo, descripcion, activo, onCambio }: { id: string; titulo: string; descripcion: string; activo: boolean; onCambio: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-border hover:bg-superficie-2">
      <Checkbox id={id} checked={activo} onCheckedChange={(v) => onCambio(v === true)} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="text-[13px] text-muted-foreground">{descripcion}</span>
      </span>
    </label>
  );
}

const TEXTOS: Record<Seccion, { titulo: string; descripcion: string; errores: (keyof Formulario)[] }> = {
  automatico: { titulo: "Pago automático", descripcion: "Hasta este monto el agente paga solo si la factura cumple todo. Por encima, una persona la aprueba.", errores: ["automatico"] },
  maximo: { titulo: "Máximo por factura", descripcion: "Una factura por encima de este monto nunca se paga, ni siquiera con aprobación.", errores: ["maximo", "automatico"] },
  mensual: { titulo: "Límite mensual por proveedor", descripcion: "Lo máximo que se le paga a un mismo proveedor en el mes sin preguntar.", errores: ["mensual"] },
  acordado: { titulo: "Cuadra con lo acordado", descripcion: "Cuánto puede diferir la factura del contrato u orden de compra.", errores: ["tolerancia"] },
  presupuesto: { titulo: "Presupuesto", descripcion: "Un pago que no cabe en lo disponible del periodo no se paga.", errores: ["presupuesto"] },
  requisitos: { titulo: "Datos obligatorios", descripcion: "Si a una factura le falta uno de estos datos, espera a una persona. El monto siempre es obligatorio.", errores: [] },
  identidad: { titulo: "Cómo reconoce al proveedor", descripcion: "Con qué dato de la factura busca al proveedor en la lista.", errores: [] },
  duplicados: { titulo: "Facturas duplicadas", descripcion: "Cuántos días hacia atrás busca si ya se pagó la misma factura.", errores: ["ventana"] },
  doble: { titulo: "Dos aprobaciones", descripcion: "Desde este monto hacen falta dos personas distintas para aprobar.", errores: ["doble"] },
};

function EditorSeccion({
  seccion,
  vigente,
  permiso,
  onCerrar,
}: {
  seccion: Seccion | null;
  vigente: Reglas;
  permiso: PermisoUI;
  onCerrar: () => void;
}) {
  const router = useRouter();
  // #86: límites y presupuesto están en la moneda de las reglas (la base de la empresa).
  const monedaBase = useMonedaBase();
  const base = vigente.moneda ?? monedaBase;
  const [f, setF] = useState<Formulario>(() => desdeReglas(vigente));
  const [abiertaPara, setAbiertaPara] = useState<Seccion | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Al abrir otra sección, el formulario arranca de lo vigente.
  if (seccion !== abiertaPara) {
    setAbiertaPara(seccion);
    if (seccion) setF(desdeReglas(vigente));
  }
  const { reglas, errores } = useMemo(() => aReglas(f, vigente), [f, vigente]);
  const cambiado = reglas !== null && (vigente.version === 0 || !iguales(reglas, vigente));
  const sim = useSimulacion(reglas, seccion !== null && cambiado);
  const cambiar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }));
  const error = (k: keyof Formulario): string | undefined => (errores as Errores)[k];
  const erroresSeccion = seccion ? TEXTOS[seccion].errores.map(error).filter(Boolean) : [];
  const seguro = sim?.estado === "lista" && sim.r.pagos_indebidos === 0;
  const puedeGuardar = permiso.ok && cambiado && erroresSeccion.length === 0 && reglas !== null && seguro && !guardando;

  async function guardar() {
    if (!puedeGuardar || !reglas) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/reglas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reglas) });
      const datos = (await res.json().catch(() => ({}))) as { version?: number; error?: string };
      if (!res.ok) throw new Error(datos.error ?? "No se pudo guardar.");
      toast.success("Cambio guardado", { description: `Versión ${datos.version}. Aplica desde la próxima factura y quedó en el registro.` });
      onCerrar();
      router.refresh();
    } catch (e) {
      toast.error("No se guardó", { description: e instanceof Error ? e.message : "Intenta de nuevo." });
    } finally {
      setGuardando(false);
    }
  }

  const t = seccion ? TEXTOS[seccion] : null;
  return (
    <Dialog open={seccion !== null} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        {seccion && t ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{t.titulo}</DialogTitle>
              <DialogDescription>{t.descripcion}</DialogDescription>
            </DialogHeader>

            <FieldGroup className="gap-4">
              {seccion === "automatico" ? (
                <CampoUsd id="r-auto" etiqueta="Paga solo hasta" valor={f.automatico} onCambio={(v) => cambiar("automatico", v)} error={error("automatico")} ayuda={`No puede superar el máximo por factura (${usd(vigente.limites.maximo_absoluto_usd, base)}).`} />
              ) : null}
              {seccion === "maximo" ? <CampoUsd id="r-max" etiqueta="Nunca pagar más de" valor={f.maximo} onCambio={(v) => cambiar("maximo", v)} error={error("maximo") ?? error("automatico")} /> : null}
              {seccion === "mensual" ? (
                <>
                  <CampoUsd id="r-mes" etiqueta="Por proveedor, al mes" valor={f.mensual} onCambio={(v) => cambiar("mensual", v)} error={error("mensual")} ayuda="Cada proveedor puede tener su propio límite en Proveedores." />
                  <Interruptor id="r8" titulo="Usar este límite" descripcion="Si lo apagas, no se mira cuánto lleva cobrado el proveedor en el mes." activo={f.activas.R8} onCambio={(v) => cambiar("activas", { ...f.activas, R8: v })} />
                </>
              ) : null}
              {seccion === "acordado" ? (
                <>
                  <Field data-invalid={error("tolerancia") ? true : undefined}>
                    <FieldLabel htmlFor="r-tol">Diferencia permitida</FieldLabel>
                    <div className="relative">
                      <Input id="r-tol" inputMode="decimal" autoFocus value={f.tolerancia} onChange={(e) => cambiar("tolerancia", e.target.value)} className="h-12 pr-10 font-mono text-lg tabular-nums" />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                    {error("tolerancia") ? <FieldError>{error("tolerancia")}</FieldError> : null}
                  </Field>
                  <Interruptor id="r5" titulo="Comparar con lo acordado" descripcion="Si lo apagas, no se revisa si el monto coincide con el contrato." activo={f.activas.R5} onCambio={(v) => cambiar("activas", { ...f.activas, R5: v })} />
                </>
              ) : null}
              {seccion === "presupuesto" ? (
                <>
                  <Field>
                    <FieldLabel>Periodo</FieldLabel>
                    <RadioGroup value={f.periodo} onValueChange={(v) => cambiar("periodo", v as Formulario["periodo"])} className="grid grid-cols-3 gap-2">
                      {(["mensual", "quincenal", "trimestral"] as const).map((p) => (
                        <label key={p} className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-xl p-3 text-sm capitalize ring-1 ring-border", f.periodo === p && "bg-superficie-2 ring-foreground/40")}>
                          <RadioGroupItem value={p} className="sr-only" />
                          {p}
                        </label>
                      ))}
                    </RadioGroup>
                  </Field>
                  <CampoUsd id="r-pre" etiqueta="Monto" valor={f.presupuesto} onCambio={(v) => cambiar("presupuesto", v)} error={error("presupuesto")} />
                  <Interruptor id="r-res" titulo="Apartar lo que espera aprobación" descripcion="Recomendado: evita pagar con dinero que una persona podría aprobar después." activo={f.reservado} onCambio={(v) => cambiar("reservado", v)} />
                </>
              ) : null}
              {seccion === "requisitos" ? (
                <div className="flex flex-col gap-1.5">
                  {CAMPOS_REQUERIBLES.map((c) => (
                    <Interruptor
                      key={c}
                      id={`req-${c}`}
                      titulo={ETIQUETA_REQUISITO[c]}
                      descripcion={f.requisitos.includes(c) ? "Obligatorio" : "Opcional"}
                      activo={f.requisitos.includes(c)}
                      onCambio={(v) => cambiar("requisitos", v ? [...f.requisitos, c] : f.requisitos.filter((x) => x !== c))}
                    />
                  ))}
                </div>
              ) : null}
              {seccion === "identidad" ? (
                <RadioGroup value={f.identidad} onValueChange={(v) => cambiar("identidad", v as Formulario["identidad"])} className="gap-2">
                  {MODOS_IDENTIDAD.map((m) => (
                    <label key={m.valor} className={cn("flex cursor-pointer items-start gap-3 rounded-xl p-3.5 ring-1 ring-border hover:bg-superficie-2", f.identidad === m.valor && "bg-superficie-2 ring-foreground/40")}>
                      <RadioGroupItem value={m.valor} className="mt-0.5" />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{m.titulo}</span>
                        <span className="text-[13px] text-muted-foreground">{m.descripcion}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              ) : null}
              {seccion === "duplicados" ? (
                <Field data-invalid={error("ventana") ? true : undefined}>
                  <FieldLabel htmlFor="r-dup">Buscar en los últimos</FieldLabel>
                  <div className="relative">
                    <Input id="r-dup" inputMode="numeric" autoFocus value={f.ventana} onChange={(e) => cambiar("ventana", e.target.value)} className="h-12 pr-14 font-mono text-lg tabular-nums" />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">días</span>
                  </div>
                  {error("ventana") ? <FieldError>{error("ventana")}</FieldError> : <FieldDescription>El mismo archivo se detecta siempre, sin importar la fecha.</FieldDescription>}
                </Field>
              ) : null}
              {seccion === "doble" ? <CampoUsd id="r-doble" etiqueta="Dos personas desde" valor={f.doble} onCambio={(v) => cambiar("doble", v)} error={error("doble")} /> : null}
            </FieldGroup>

            {cambiado && erroresSeccion.length === 0 ? <ResultadoPrueba sim={sim} /> : null}
            {!permiso.ok ? <p className="text-[13px] text-muted-foreground">{permiso.motivo}</p> : null}

            <DialogFooter className="-mx-6 -mb-6 px-6">
              <Boton variante="secundaria" onClick={onCerrar}>
                Cancelar
              </Boton>
              {permiso.ok ? (
                <Boton variante="primaria" onClick={() => void guardar()} disabled={!puedeGuardar}>
                  {guardando ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
                  {guardando ? "Guardando…" : "Guardar"}
                </Boton>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ReglasPorPasos({
  vigente,
  historial,
  simulacionInicial,
  permisoGuardar,
}: {
  vigente: Reglas;
  historial: { version: number; editada_por: string; editada_en: string }[];
  simulacionInicial: ReporteEvaluacion | null;
  permisoGuardar: PermisoUI;
}) {
  const router = useRouter();
  const monedaBase = useMonedaBase();
  const base = vigente.moneda ?? monedaBase;
  const m = (c: number) => usd(c, base);
  const [abierta, setAbierta] = useState<Seccion | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [guardandoV1, setGuardandoV1] = useState(false);
  const l = vigente.limites;
  const requeridos = vigente.requisitos?.obligatorios?.length ?? 6;
  const modo = MODOS_IDENTIDAD.find((m) => m.valor === (vigente.identidad?.modo ?? "nombre"))?.titulo;
  const v = historial.find((h) => h.version === vigente.version);
  const sinConfigurar = vigente.version === 0;
  const editada = v ? ` · ${fechaCorta(v.editada_en)}, ${v.editada_por.split(" (")[0]}` : "";
  const subtitulo = sinConfigurar ? "Valores sugeridos. Actívalos para que el agente empiece a decidir." : `Versión ${vigente.version}${editada}`;

  async function guardarSugeridas() {
    setGuardandoV1(true);
    try {
      const res = await fetch("/api/reglas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vigente) });
      const datos = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(datos.error ?? "No se pudo guardar.");
      toast.success("Reglas activadas", { description: "El agente ya decide con estos valores." });
      router.refresh();
    } catch (e) {
      toast.error("No se guardó", { description: e instanceof Error ? e.message : "Intenta de nuevo." });
    } finally {
      setGuardandoV1(false);
    }
  }

  const fila = (s: Seccion, icono: LucideIcon, color: "tinta" | "verde" | "ambar" | "azul" | "gris", valor: string) => (
    <FilaAjuste icono={icono} color={color} titulo={TEXTOS[s].titulo} valor={valor} alPulsar={() => setAbierta(s)} />
  );

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-7">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[30px] leading-tight font-semibold tracking-tight">Reglas de pago</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {subtitulo}
        </p>
      </header>

      {sinConfigurar ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-escalada-suave p-4 ring-1 ring-escalada-borde">
          <span className="flex items-center gap-2 text-sm font-semibold text-escalada-foreground">
            <AlertTriangleIcon className="size-4" aria-hidden />
            Mientras no actives las reglas, toda factura espera a una persona.
          </span>
          {permisoGuardar.ok ? (
            <Boton variante="primaria" className="self-start" onClick={() => void guardarSugeridas()} disabled={guardandoV1}>
              {guardandoV1 ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Activar reglas sugeridas
            </Boton>
          ) : null}
        </div>
      ) : null}

      {simulacionInicial ? (
        <div className="grid grid-cols-3 overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          {[
            { valor: simulacionInicial.pagos_indebidos, texto: "pagos fuera de reglas", icono: ShieldIcon, malo: simulacionInicial.pagos_indebidos > 0 },
            { valor: `${simulacionInicial.coinciden}/${simulacionInicial.total}`, texto: "decisiones correctas", icono: CheckCircle2Icon, malo: false },
            { valor: porcentajeUi(simulacionInicial.autonomia), texto: "decide solo", icono: GaugeIcon, malo: false },
          ].map((k) => (
            <div key={k.texto} className="flex flex-col gap-1 px-4 py-4 not-first:border-l not-first:border-subtle">
              <span className={cn("font-mono text-2xl font-semibold tabular-nums", k.malo && "text-frenada-foreground")}>{k.valor}</span>
              <span className="text-xs text-muted-foreground">{k.texto}</span>
            </div>
          ))}
        </div>
      ) : null}

      <GrupoAjustes titulo="Cuándo paga solo" pie="Si una factura supera estos montos, espera a una persona o no se paga.">
        {fila("automatico", WalletIcon, "verde", `Hasta ${m(l.pago_automatico_usd)}`)}
        {fila("maximo", BanknoteIcon, "tinta", m(l.maximo_absoluto_usd))}
        {fila("mensual", CalendarRangeIcon, "azul", vigente.activas.R8 ? `${m(l.mensual_por_beneficiario_default_usd)} al mes` : "Apagado")}
        {fila("acordado", PercentIcon, "ambar", vigente.activas.R5 ? `±${String(l.tolerancia_acordado_pct).replace(".", ",")} %` : "Apagado")}
      </GrupoAjustes>

      <GrupoAjustes titulo="Presupuesto">
        {fila("presupuesto", WalletIcon, "verde", `${m(vigente.presupuesto.monto_usd)} ${PERIODO[vigente.presupuesto.periodo]}`)}
      </GrupoAjustes>

      <GrupoAjustes titulo="Qué revisa en cada factura">
        {fila("requisitos", FileCheckIcon, "azul", `${requeridos + 1} datos`)}
        {fila("identidad", FingerprintIcon, "gris", modo ?? "Por nombre")}
        {fila("duplicados", CopyIcon, "ambar", `${vigente.duplicados.ventana_dias} días`)}
      </GrupoAjustes>

      <GrupoAjustes titulo="Aprobaciones" pie="Quién aprueba y hasta cuánto se cambia en Ajustes → Equipo.">
        {fila("doble", UsersIcon, "tinta", `Desde ${m(vigente.aprobacion.doble_aprobacion_desde_usd)}`)}
      </GrupoAjustes>

      <GrupoAjustes titulo="Más">
        <FilaAjuste icono={HistoryIcon} color="gris" titulo="Historial de versiones" valor={`${historial.length}`} alPulsar={() => setVerHistorial(true)} />
      </GrupoAjustes>

      <p className="px-4 text-xs leading-relaxed text-muted-foreground">
        Las reglas siempre se revisan en el mismo orden. Si algo no cuadra, el agente frena o pide a una persona; ante cualquier duda nunca paga.
      </p>

      <EditorSeccion seccion={abierta} vigente={vigente} permiso={permisoGuardar} onCerrar={() => setAbierta(null)} />

      <Sheet open={verHistorial} onOpenChange={setVerHistorial}>
        <SheetContent className="w-full gap-4 overflow-y-auto p-6 sm:max-w-md">
          <SheetHeader className="p-0">
            <SheetTitle>Historial de versiones</SheetTitle>
            <SheetDescription>Cada cambio guardado crea una versión. Ninguna se borra.</SheetDescription>
          </SheetHeader>
          <ol className="flex flex-col overflow-hidden rounded-2xl ring-1 ring-border">
            {historial.map((h) => (
              <li key={h.version} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm not-first:border-t not-first:border-subtle">
                <span className="font-mono font-semibold">v{h.version}</span>
                <span className="text-right text-xs text-muted-foreground">
                  {fechaCorta(h.editada_en)} · {h.editada_por.split(" (")[0]}
                </span>
              </li>
            ))}
          </ol>
        </SheetContent>
      </Sheet>
    </div>
  );
}
