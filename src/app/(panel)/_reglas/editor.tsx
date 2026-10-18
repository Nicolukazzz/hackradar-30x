"use client";

import { AlertTriangleIcon, CheckCircle2Icon, HistoryIcon, Loader2Icon, RotateCcwIcon, SaveIcon, ShieldIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Boton, Tarjeta, TarjetaEncabezado, TarjetaPie, fechaCorta, porcentajeUi } from "@/app/_componentes";
import type { ReporteEvaluacion, UsoTasa } from "@/app/_datos/reglas";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatearTasa } from "@/dominio/dinero";
import {
  CAMPOS_REQUERIBLES,
  REGLAS_EDITABLES,
  REQUERIDOS_POR_DEFECTO,
  type Aprobador,
  type CampoRequerible,
  type IdRegla,
  type ModoIdentidad,
  type Reglas,
} from "@/dominio/tipos";
import type { PermisoUI } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

import { escribirDecimal, escribirUsd, leerDecimal, leerUsd } from "./numeros";

// Editor de reglas (§13.4). El borrador vive en el cliente; cada cambio válido se simula contra el set de
// prueba (POST /api/reglas/simular, 400 ms de espera) y "Guardar como v{n}" se bloquea si la simulación
// aprueba algún pago fuera de reglas. El servidor vuelve a simular al guardar (409), así que el bloqueo
// de aquí es solo para avisar antes.

// Nombres de §4.2 (la UI no importa src/reglas).
const REGLAS: Record<IdRegla, string> = {
  R1: "Extracción completa y confiable",
  R2: "No es duplicada",
  R3: "Beneficiario en la lista permitida",
  R4: "Cuenta destino es la registrada",
  R5: "Cuadra con lo acordado",
  R6: "Bajo el máximo absoluto por pago",
  R7: "Presupuesto disponible del periodo",
  R8: "Límite mensual por beneficiario",
  R9: "Bajo el límite de pago automático",
  R10: "Sin instrucciones dirigidas al agente",
  R11: "Remitente verificado",
};
const ESCALAN: IdRegla[] = ["R1", "R3", "R4", "R8", "R9", "R10", "R11"];
const FRENAN: IdRegla[] = ["R2", "R5", "R6", "R7"];
const ORDEN = Object.keys(REGLAS) as IdRegla[];

const MONEDAS: Record<string, string> = {
  COP: "peso colombiano",
  MXN: "peso mexicano",
  BRL: "real brasileño",
  ARS: "peso argentino",
  CLP: "peso chileno",
  PEN: "sol peruano",
  EUR: "euro",
};

const ETIQUETA_REQUISITO: Record<CampoRequerible, string> = {
  beneficiario_nombre: "Nombre de quien cobra",
  numero: "Número de factura",
  fecha_emision: "Fecha de emisión",
  fecha_vencimiento: "Fecha de vencimiento",
  cuenta_destino_ultimos4: "Cuenta destino",
  concepto: "Concepto",
  referencia_acuerdo: "Referencia al acuerdo (OC, contrato)",
  identificacion_fiscal: "NIT o identificación fiscal",
};

const MODOS_IDENTIDAD: { valor: ModoIdentidad; titulo: string; descripcion: string }[] = [
  { valor: "nombre", titulo: "Por nombre", descripcion: "El nombre de la factura igual al registrado (sin tildes, mayúsculas ni S.A.S.)." },
  { valor: "nombre_y_nit", titulo: "Nombre y NIT", descripcion: "Los dos deben ser del mismo proveedor. Lo más estricto." },
  { valor: "nit", titulo: "Solo NIT", descripcion: "La identificación fiscal manda, aunque el nombre esté escrito distinto." },
];

type Formulario = {
  automatico: string;
  maximo: string;
  mensual: string;
  tolerancia: string;
  periodo: Reglas["presupuesto"]["periodo"];
  presupuesto: string;
  reservado: boolean;
  ventana: string;
  doble: string;
  activas: Record<IdRegla, boolean>;
  identidad: ModoIdentidad;
  requisitos: CampoRequerible[];
};

type Errores = Partial<Record<keyof Formulario, string>>;

function desdeReglas(r: Reglas): Formulario {
  return {
    automatico: escribirUsd(r.limites.pago_automatico_usd),
    maximo: escribirUsd(r.limites.maximo_absoluto_usd),
    mensual: escribirUsd(r.limites.mensual_por_beneficiario_default_usd),
    tolerancia: escribirDecimal(r.limites.tolerancia_acordado_pct),
    periodo: r.presupuesto.periodo,
    presupuesto: escribirUsd(r.presupuesto.monto_usd),
    reservado: r.presupuesto.contar_escalado_como_reservado,
    ventana: String(r.duplicados.ventana_dias),
    doble: escribirUsd(r.aprobacion.doble_aprobacion_desde_usd),
    activas: { ...r.activas },
    identidad: r.identidad?.modo ?? "nombre",
    requisitos: [...(r.requisitos?.obligatorios ?? REQUERIDOS_POR_DEFECTO)],
  };
}

/** Formulario → Reglas candidatas (misma versión base) o errores por campo. */
function aReglas(f: Formulario, base: Reglas): { reglas: Reglas | null; errores: Errores } {
  const errores: Errores = {};
  const usd = (k: "automatico" | "maximo" | "mensual" | "presupuesto" | "doble") => {
    const v = leerUsd(f[k]);
    if (v === null || v <= 0) errores[k] = "Escribe un monto mayor que 0, por ejemplo 3.000,00.";
    return v ?? 0;
  };
  const automatico = usd("automatico");
  const maximo = usd("maximo");
  const mensual = usd("mensual");
  const presupuesto = usd("presupuesto");
  const doble = usd("doble");
  const tolerancia = leerDecimal(f.tolerancia);
  if (tolerancia === null || tolerancia > 100) errores.tolerancia = "Escribe un porcentaje entre 0 y 100.";
  const ventana = /^\d+$/.test(f.ventana.trim()) ? Number(f.ventana) : null;
  if (ventana === null || ventana < 1 || ventana > 365) errores.ventana = "Escribe un número de días entre 1 y 365.";
  if (!errores.automatico && !errores.maximo && automatico > maximo)
    errores.automatico = `No puede superar el máximo absoluto por pago (R6, USD ${escribirUsd(maximo)}).`;
  if (Object.keys(errores).length > 0) return { reglas: null, errores };
  return {
    errores,
    reglas: {
      ...base,
      limites: { pago_automatico_usd: automatico, maximo_absoluto_usd: maximo, mensual_por_beneficiario_default_usd: mensual, tolerancia_acordado_pct: tolerancia ?? 0 },
      presupuesto: { periodo: f.periodo, monto_usd: presupuesto, contar_escalado_como_reservado: f.reservado },
      duplicados: { ...base.duplicados, ventana_dias: ventana ?? base.duplicados.ventana_dias },
      aprobacion: { doble_aprobacion_desde_usd: doble },
      activas: f.activas,
      // Sin cambio respecto a la base, se deja como estaba (las versiones sin `identidad` son "por nombre").
      ...(f.identidad === (base.identidad?.modo ?? "nombre") ? {} : { identidad: { modo: f.identidad } }),
      ...(mismoConjunto(f.requisitos, base.requisitos?.obligatorios ?? REQUERIDOS_POR_DEFECTO)
        ? {}
        : { requisitos: { obligatorios: CAMPOS_REQUERIBLES.filter((c) => f.requisitos.includes(c)) } }),
    },
  };
}

const mismoConjunto = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Igualdad de valores sin importar el orden de las claves (Supabase guarda las reglas en jsonb, que lo cambia). */
function mismoValor(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => mismoValor((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

const iguales = (a: Reglas, b: Reglas) => mismoValor({ ...a, version: 0, editada_por: "", editada_en: "" }, { ...b, version: 0, editada_por: "", editada_en: "" });

/** Huella estable (claves ordenadas) para saber qué valores se simularon. */
function huellaDe(r: Reglas): string {
  const ordenar = (v: unknown): unknown =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort((a, b) => a.localeCompare(b)).map((k) => [k, ordenar((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(ordenar(r));
}

export type FilaBeneficiario = {
  id: string;
  nombre: string;
  detalle: string;
  cuenta: string;
  acuerdo: string;
  monto: string;
  limite: string;
  activo: boolean;
};

/** `huella`: qué valores se simularon. Guardar solo vale si coinciden con los del formulario. */
type Simulacion =
  | { estado: "lista"; r: ReporteEvaluacion; huella: string }
  | { estado: "cargando"; r: ReporteEvaluacion | null }
  | { estado: "error"; mensaje: string; r: ReporteEvaluacion | null };

export function EditorReglas({
  vigente,
  historial,
  simulacionInicial,
  usoTasas,
  aprobadores,
  beneficiarios,
  permisoGuardar,
}: {
  /** guardar una versión nueva: solo `editar_reglas` (#51). Sin permiso se puede simular igual. */
  permisoGuardar: PermisoUI;
  vigente: Reglas;
  historial: { version: number; editada_por: string; editada_en: string }[];
  simulacionInicial: ReporteEvaluacion | null;
  usoTasas: UsoTasa[];
  aprobadores: Aprobador[];
  beneficiarios: FilaBeneficiario[];
}) {
  const router = useRouter();
  // Solo las monedas que aparecen en el lote; si ninguna, todas (tabla de referencia).
  const tasas = usoTasas.some((u) => u.facturas > 0) ? usoTasas.filter((u) => u.facturas > 0) : usoTasas;
  const [f, setF] = useState(() => desdeReglas(vigente));
  const [sim, setSim] = useState<Simulacion>(() =>
    simulacionInicial
      ? { estado: "lista", r: simulacionInicial, huella: huellaDe(vigente) }
      : { estado: "error", mensaje: "No hay un set de prueba cargado para simular.", r: null },
  );
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const { reglas, errores } = useMemo(() => aReglas(f, vigente), [f, vigente]);
  // Versión 0 (#106): la empresa aún no guardó reglas. Los valores son sugeridos y siempre se ofrece guardar la v1.
  const sinConfigurar = vigente.version === 0;
  const cambiado = sinConfigurar || (reglas !== null ? !iguales(reglas, vigente) : true);
  const siguiente = vigente.version + 1;
  const huella = reglas ? huellaDe(reglas) : null;
  const simulada = sim.estado === "lista" ? sim.huella : null;

  // Simulación en vivo: 400 ms después del último cambio válido. Un cambio nuevo cancela la petición anterior.
  useEffect(() => {
    if (!huella || !reglas || huella === simulada) return;
    const control = new AbortController();
    const t = setTimeout(async () => {
      setSim((s) => ({ estado: "cargando", r: s.r }));
      try {
        const res = await fetch("/api/reglas/simular", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reglas),
          signal: control.signal,
        });
        const datos = (await res.json().catch(() => ({}))) as ReporteEvaluacion & { error?: string };
        if (!res.ok) throw new Error(datos.error ?? "No se pudo simular.");
        setSim({ estado: "lista", r: datos, huella });
      } catch (e) {
        if (control.signal.aborted) return;
        setSim((s) => ({ estado: "error", mensaje: e instanceof Error ? e.message : "No se pudo simular.", r: s.r }));
      }
    }, 400);
    return () => {
      clearTimeout(t);
      control.abort();
    };
    // `reglas` cambia de identidad en cada render; `huella` resume su valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella, simulada]);

  const r = sim.r;
  const inseguro = r !== null && r.pagos_indebidos > 0;
  const motivoBloqueo = !permisoGuardar.ok
    ? `${permisoGuardar.motivo} Puedes simular sin guardar.`
    : !reglas
    ? "Corrige los campos marcados para poder guardar."
    : sim.estado === "cargando" || (sim.estado === "lista" && simulada !== huella)
      ? "Esperando la simulación…"
      : sim.estado === "error"
        ? "No se pudo simular: no se puede guardar sin probar las reglas."
        : inseguro
          ? `Con estos valores el agente aprobaría ${r.pagos_indebidos === 1 ? "1 pago" : `${r.pagos_indebidos} pagos`} fuera de reglas. No se puede guardar.`
          : null;
  const puedeGuardar = cambiado && motivoBloqueo === null && !guardando;

  function cambiar<K extends keyof Formulario>(k: K, v: Formulario[K]) {
    setConfirmando(false);
    setF((x) => ({ ...x, [k]: v }));
  }

  async function guardar() {
    if (!reglas || !puedeGuardar) return;
    setGuardando(true);
    try {
      // version, editada_por y editada_en los reemplaza el servidor (sesión y reloj), aunque vengan en el cuerpo.
      const res = await fetch("/api/reglas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reglas) });
      const datos = (await res.json().catch(() => ({}))) as { version?: number; error?: string };
      if (!res.ok) throw new Error(datos.error ?? "No se pudieron guardar las reglas.");
      toast.success(`Reglas v${datos.version ?? siguiente} guardadas`, {
        description: "Aplican desde el próximo lote. El cambio quedó en el registro.",
        action: { label: "Ver en el registro", onClick: () => router.push("/registro?decision=todas&actor=humano") },
      });
      setConfirmando(false);
      router.refresh();
    } catch (e) {
      toast.error("No se guardaron las reglas", { description: e instanceof Error ? e.message : "Intenta de nuevo." });
    } finally {
      setGuardando(false);
    }
  }

  const v = historial.find((h) => h.version === vigente.version);
  let mensajeBarra = "Cambios sin guardar. La simulación no aprueba pagos fuera de reglas.";
  if (confirmando) mensajeBarra = `¿Guardar como v${siguiente}? Aplica desde el próximo lote y queda en el registro.`;
  else if (sinConfigurar) mensajeBarra = "Valores sugeridos. Revísalos y guarda la versión 1 para que el agente empiece a decidir.";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[700px] flex-col gap-1.5">
          {sinConfigurar ? (
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-escalada-foreground">
              <AlertTriangleIcon className="size-3.5" aria-hidden />
              Sin configurar · hasta guardar la versión 1, toda factura espera a una persona
            </span>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              Versión {vigente.version}
              {v ? ` · editada el ${fechaCorta(v.editada_en)} por ${v.editada_por.replace(/\s*\([^)]*\)\s*$/, "")}` : ""}
            </span>
          )}
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Reglas de pago</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            El agente solo paga lo que cumple todas estas reglas. Lo que falla una regla de frenar no se paga; lo que falla una regla de escalar espera
            a una persona. Los cambios aplican desde el próximo lote.
          </p>
        </div>
        <details className="group relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[10px] border border-borde-fuerte bg-card px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <HistoryIcon className="size-4" aria-hidden />
            Historial de versiones
          </summary>
          <ol className="absolute right-0 z-10 mt-2 flex w-72 flex-col overflow-hidden rounded-2xl bg-card text-sm shadow-lg ring-1 ring-border">
            {historial.map((h) => (
              <li key={h.version} className="flex items-baseline justify-between gap-3 border-subtle px-4 py-3 not-first:border-t">
                <span className="font-mono font-semibold">v{h.version}</span>
                <span className="text-right text-xs text-muted-foreground">
                  {fechaCorta(h.editada_en)} · {h.editada_por.replace(/\s*\([^)]*\)\s*$/, "")}
                  {h.version === vigente.version ? " · vigente" : ""}
                </span>
              </li>
            ))}
          </ol>
        </details>
      </header>

      <CajaSimulacion sim={sim} inseguro={inseguro} />

      <Tarjeta as="section" aria-labelledby="ide">
        <TarjetaEncabezado id="ide" titulo="Cómo se reconoce a quien cobra · R3" descripcion="Con qué dato de la factura el agente busca al proveedor en la lista. Si falta ese dato, escala." />
        <RadioGroup
          value={f.identidad}
          onValueChange={(v) => cambiar("identidad", v as ModoIdentidad)}
          name="identidad"
          aria-label="Cómo se reconoce a quien cobra"
          className="grid gap-2.5 px-6 pb-6 sm:grid-cols-3"
        >
          {MODOS_IDENTIDAD.map((m) => (
            <label
              key={m.valor}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5 transition-colors hover:bg-superficie-2",
                f.identidad === m.valor && "border-foreground/40 bg-superficie-2",
              )}
            >
              <RadioGroupItem value={m.valor} className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{m.titulo}</span>
                <span className="text-[13px] leading-snug text-muted-foreground">{m.descripcion}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </Tarjeta>

      <Tarjeta as="section" aria-labelledby="req">
        <TarjetaEncabezado id="req" titulo="Qué debe traer la factura · R1" descripcion="Si falta un dato marcado, la factura espera a una persona. Un dato que llega pero no se lee bien siempre escala." />
        <div className="grid gap-2 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-superficie-2 p-3.5 text-sm">
            <Checkbox checked disabled aria-describedby="req-monto" />
            <span className="flex flex-col">
              <span className="font-medium">Monto y moneda</span>
              <span id="req-monto" className="text-[13px] text-muted-foreground">
                Siempre: sin monto no hay límites que comparar.
              </span>
            </span>
          </label>
          {CAMPOS_REQUERIBLES.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3.5 text-sm transition-colors hover:bg-superficie-2">
              <Checkbox
                checked={f.requisitos.includes(c)}
                onCheckedChange={(v) => cambiar("requisitos", v ? [...f.requisitos, c] : f.requisitos.filter((x) => x !== c))}
              />
              <span className="font-medium">{ETIQUETA_REQUISITO[c]}</span>
            </label>
          ))}
        </div>
        {f.requisitos.includes("cuenta_destino_ultimos4") ? null : (
          <p className="mx-6 mb-6 flex items-start gap-2 rounded-[10px] bg-escalada px-3.5 py-3 text-[13px] leading-relaxed text-escalada-foreground">
            <AlertTriangleIcon className="mt-0.5 size-4 flex-none" aria-hidden />
            Sin cuenta en la factura, el agente pagará a la cuenta registrada del proveedor. Si una factura trae otra cuenta, igual se escala (R4).
          </p>
        )}
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta as="section" aria-labelledby="lim">
          <TarjetaEncabezado id="lim" titulo="Límites por pago" descripcion="Montos en USD después de convertir con la tasa fija." />
          <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
            <Campo id="r9" etiqueta="Límite de pago automático · R9" prefijo="USD" valor={f.automatico} error={errores.automatico} onChange={(x) => cambiar("automatico", x)} ayuda="Por encima de este monto, el agente escala a una persona." />
            <Campo id="r6" etiqueta="Máximo absoluto por pago · R6" prefijo="USD" valor={f.maximo} error={errores.maximo} onChange={(x) => cambiar("maximo", x)} ayuda="Por encima de este monto, el agente frena el pago." />
            <Campo id="r8" etiqueta="Límite mensual por beneficiario · R8" prefijo="USD" valor={f.mensual} error={errores.mensual} onChange={(x) => cambiar("mensual", x)} ayuda="Valor por defecto; cada beneficiario puede tener el suyo." />
            <Campo id="r5" etiqueta="Tolerancia contra lo acordado · R5" sufijo="%" valor={f.tolerancia} error={errores.tolerancia} onChange={(x) => cambiar("tolerancia", x)} ayuda="Diferencia máxima con el contrato u orden de compra." />
          </div>
        </Tarjeta>

        <Tarjeta as="section" aria-labelledby="pre">
          <TarjetaEncabezado id="pre" titulo="Presupuesto del periodo · R7" descripcion="Un pago que no cabe en lo disponible se frena." />
          <div className="flex flex-col gap-4 px-6 pb-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="periodo" className="text-sm font-medium">
                  Periodo
                </label>
                <select id="periodo" value={f.periodo} onChange={(e) => cambiar("periodo", e.target.value as Formulario["periodo"])} className={CONTROL}>
                  <option value="mensual">Mensual</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="trimestral">Trimestral</option>
                </select>
              </div>
              <Campo id="r7" etiqueta="Presupuesto" prefijo="USD" valor={f.presupuesto} error={errores.presupuesto} onChange={(x) => cambiar("presupuesto", x)} />
            </div>
            <label className="flex items-start gap-3 rounded-[10px] bg-superficie-2 px-3.5 py-3 text-sm leading-relaxed">
              <input type="checkbox" checked={f.reservado} onChange={(e) => cambiar("reservado", e.target.checked)} className="mt-1 size-[18px] flex-none accent-primary" />
              <span>
                <strong className="font-semibold">Contar lo escalado como reservado.</strong> Evita que el agente pague con dinero que una persona podría
                aprobar después.
              </span>
            </label>
          </div>
          {tasas.length > 0 ? (
            <div className="border-t border-subtle px-6 py-4">
              <h3 className="mb-2 text-sm font-semibold">Tasas de cambio fijas del periodo</h3>
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 font-medium">Moneda</th>
                    <th scope="col" className="py-1 text-right font-medium">1 USD =</th>
                    <th scope="col" className="py-1 text-right font-medium">Uso en el lote</th>
                  </tr>
                </thead>
                <tbody>
                  {tasas.map((u) => (
                    <tr key={u.moneda} className="border-t border-subtle">
                      <td className="py-1.5">
                        <span className="font-mono">{u.moneda}</span>
                        {MONEDAS[u.moneda] ? <span className="text-muted-foreground"> · {MONEDAS[u.moneda]}</span> : null}
                      </td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{formatearTasa(u.moneda, { periodo: "", base: "USD", tasas: { [u.moneda]: u.tasa } })?.slice(u.moneda.length + 1)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{u.facturas === 1 ? "1 factura" : `${u.facturas} facturas`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <TarjetaPie>Tabla fija ficticia, sin datos de mercado reales. Cada decisión guarda la tasa que usó.</TarjetaPie>
        </Tarjeta>

        <ListaReglas id="esc" titulo="Cuándo escalar a una persona" descripcion="El pago se reserva y espera aprobación." ids={ESCALAN} activas={f.activas} onToggle={(id, x) => cambiar("activas", { ...f.activas, [id]: x })} />

        <ListaReglas id="fre" titulo="Cuándo frenar el pago" descripcion="No se paga. Queda en el registro con su motivo." ids={FRENAN} activas={f.activas} onToggle={(id, x) => cambiar("activas", { ...f.activas, [id]: x })}>
          <div className="border-t border-subtle px-6 py-4">
            <Campo id="dup" etiqueta="Ventana para buscar duplicados · R2" sufijo="días" valor={f.ventana} error={errores.ventana} onChange={(x) => cambiar("ventana", x)} modo="numeric" />
          </div>
        </ListaReglas>
      </div>

      <TablaBeneficiarios filas={beneficiarios} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta as="section" aria-labelledby="apr">
          <TarjetaEncabezado id="apr" titulo="Quién aprueba" descripcion="Las personas a las que el agente asigna lo escalado." />
          <ul className="flex flex-col gap-2.5 px-6">
            {aprobadores.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-[12px] bg-superficie-2 px-3.5 py-3">
                <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-primary font-mono text-sm font-semibold text-primary-foreground">
                  {a.iniciales}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{a.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.rol} · {a.limite_usd === null ? "aprueba cualquier monto" : `hasta USD ${escribirUsd(a.limite_usd).replace(/,00$/, "")}`}
                  </span>
                </span>
                {a.principal ? <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-brand-foreground">Principal</span> : null}
              </li>
            ))}
          </ul>
          <div className="px-6 pt-4 pb-6">
            <Campo id="doble" etiqueta="Dos aprobaciones desde" prefijo="USD" valor={f.doble} error={errores.doble} onChange={(x) => cambiar("doble", x)} ayuda="Desde este monto hacen falta dos personas distintas." />
          </div>
        </Tarjeta>

        <Tarjeta as="section" aria-labelledby="ord">
          <TarjetaEncabezado id="ord" titulo="Orden de evaluación" descripcion="Código determinístico. El modelo de lenguaje solo lee la factura; nunca decide." />
          <ol className="flex flex-wrap gap-2 px-6">
            {ORDEN.map((id) => (
              <li
                key={id}
                title={REGLAS[id]}
                className={cn(
                  "rounded-full px-2.5 py-1 font-mono text-xs font-semibold",
                  FRENAN.includes(id) ? "bg-frenada text-frenada-foreground" : "bg-escalada text-escalada-foreground",
                  !f.activas[id] && "opacity-50 line-through",
                )}
              >
                {id}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-4 px-6 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-frenada-punto" />
              Si falla, frena
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-escalada-punto" />
              Si falla, escala
            </span>
          </div>
          <ol className="mx-6 mt-4 mb-6 flex flex-col gap-1.5 rounded-[12px] bg-superficie-2 px-4 py-3.5 text-sm leading-relaxed">
            <li>
              <strong>1.</strong> Si falla una regla de frenar → <strong>Frenar</strong>.
            </li>
            <li>
              <strong>2.</strong> Si no, si falla una de escalar → <strong>Escalar</strong>.
            </li>
            <li>
              <strong>3.</strong> Si todas cumplen → <strong>Pagar</strong>.
            </li>
            <li>
              <strong>4.</strong> Si falta un dato o algo es ambiguo → <strong>Escalar</strong>. Nunca Pagar.
            </li>
          </ol>
        </Tarjeta>
      </div>

      {/* Barra fija con los cambios pendientes: guardar es una acción con confirmación (crea una versión nueva). */}
      {cambiado ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-3.5 text-primary-foreground shadow-lg" role="region" aria-label="Cambios sin guardar">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            {motivoBloqueo ? <AlertTriangleIcon className={cn("size-4 flex-none", inseguro ? "text-frenada" : "text-aviso")} aria-hidden /> : <CheckCircle2Icon className="size-4 flex-none text-brand" aria-hidden />}
            <span aria-live="polite">
              {motivoBloqueo ?? mensajeBarra}
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            <Boton
              variante="fantasma"
              className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              onClick={() => {
                setConfirmando(false);
                setF(desdeReglas(vigente));
              }}
            >
              <RotateCcwIcon aria-hidden />
              Descartar
            </Boton>
            {confirmando ? (
              <Boton variante="acento" onClick={guardar} disabled={!puedeGuardar}>
                {guardando ? <Loader2Icon className="animate-spin" aria-hidden /> : <SaveIcon aria-hidden />}
                Sí, guardar v{siguiente}
              </Boton>
            ) : (
              <Boton variante="acento" onClick={() => setConfirmando(true)} disabled={!puedeGuardar}>
                <SaveIcon aria-hidden />
                Guardar como v{siguiente}
              </Boton>
            )}
          </span>
        </div>
      ) : null}
    </>
  );
}

const CONTROL =
  "min-h-11 w-full rounded-[10px] border border-borde-fuerte bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-frenada-punto";


function Campo({
  id,
  etiqueta,
  valor,
  onChange,
  error,
  ayuda,
  prefijo,
  sufijo,
  modo = "decimal",
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  error?: string;
  ayuda?: string;
  prefijo?: string;
  sufijo?: string;
  modo?: "decimal" | "numeric";
}) {
  const desc = [error ? `${id}-error` : null, ayuda ? `${id}-ayuda` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      <div className="relative flex items-center">
        {prefijo ? <span className="pointer-events-none absolute left-3 font-mono text-xs text-muted-foreground">{prefijo}</span> : null}
        <input
          id={id}
          type="text"
          inputMode={modo}
          autoComplete="off"
          spellCheck={false}
          value={valor}
          aria-invalid={error ? true : undefined}
          aria-describedby={desc}
          onChange={(e) => onChange(e.target.value)}
          className={cn(CONTROL, "font-mono tabular-nums", prefijo && "pl-12", sufijo && "pr-14")}
        />
        {sufijo ? <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground">{sufijo}</span> : null}
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-xs font-medium text-frenada-foreground">
          {error}
        </span>
      ) : ayuda ? (
        <span id={`${id}-ayuda`} className="text-xs text-muted-foreground">
          {ayuda}
        </span>
      ) : null}
    </div>
  );
}

function ListaReglas({
  id,
  titulo,
  descripcion,
  ids,
  activas,
  onToggle,
  children,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  ids: IdRegla[];
  activas: Record<IdRegla, boolean>;
  onToggle: (id: IdRegla, activa: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <Tarjeta as="section" aria-labelledby={id}>
      <TarjetaEncabezado id={id} titulo={titulo} descripcion={descripcion} />
      <ul className="flex flex-col pb-2">
        {ids.map((r) => {
          const editable = REGLAS_EDITABLES.includes(r);
          return (
            <li key={r} className="border-t border-subtle">
              <label className={cn("flex min-h-12 items-center gap-3 px-6 py-2.5", editable && "cursor-pointer hover:bg-superficie-2/60")}>
                <input
                  type="checkbox"
                  checked={activas[r]}
                  disabled={!editable}
                  onChange={(e) => onToggle(r, e.target.checked)}
                  className="size-[18px] flex-none accent-primary disabled:opacity-60"
                />
                <span className="w-9 flex-none font-mono text-xs font-semibold text-muted-foreground">{r}</span>
                <span className={cn("min-w-0 flex-1 text-sm", !activas[r] && "text-muted-foreground line-through")}>{REGLAS[r]}</span>
                <span
                  className={cn(
                    "flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    editable ? "bg-brand/40 text-brand-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {editable ? "Editable" : "Siempre activa"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {children}
    </Tarjeta>
  );
}

function CajaSimulacion({ sim, inseguro }: { sim: Simulacion; inseguro: boolean }) {
  const r = sim.r;
  const distintos = r?.documentos.filter((d) => !d.coincide) ?? [];
  return (
    <Tarjeta as="section" aria-labelledby="sim" className={cn(inseguro && "ring-2 ring-frenada-punto")}>
      <TarjetaEncabezado
        id="sim"
        titulo="Prueba las reglas antes de guardar"
        descripcion={
          r
            ? `Corre el set de prueba de ${r.total} facturas (normales y trampa) con estos valores y compara contra la decisión esperada.`
            : "Corre el set de prueba con estos valores y compara contra la decisión esperada."
        }
      >
        <span className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          {sim.estado === "cargando" ? (
            <>
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Simulando…
            </>
          ) : sim.estado === "error" ? (
            <span className="text-frenada-foreground">{sim.mensaje}</span>
          ) : (
            "Se simula sola al cambiar un valor"
          )}
        </span>
      </TarjetaEncabezado>
      {r ? (
        <div className={cn("grid grid-cols-3 gap-px border-t border-subtle bg-subtle transition-opacity", sim.estado === "cargando" && "opacity-60")}>
          <Cifra valor={`${r.coinciden}/${r.total}`} etiqueta="coinciden" />
          <Cifra valor={r.pagos_indebidos} etiqueta="pagos fuera de reglas" malo={r.pagos_indebidos > 0} icono />
          <Cifra valor={porcentajeUi(r.autonomia)} etiqueta="autonomía" />
        </div>
      ) : null}
      {inseguro ? (
        <p role="alert" className="flex items-start gap-2 border-t border-frenada-punto/30 bg-frenada px-6 py-3 text-sm font-medium text-frenada-foreground">
          <AlertTriangleIcon className="mt-0.5 size-4 flex-none" aria-hidden />
          Con estos valores el agente pagaría facturas que no debe. Guardar queda bloqueado hasta corregirlo.
        </p>
      ) : null}
      {distintos.length > 0 ? (
        <TarjetaPie className="flex flex-col gap-1.5">
          <span className="font-semibold text-foreground">Cambian respecto a lo esperado:</span>
          <ul className="flex flex-col gap-1">
            {distintos.map((d) => (
              <li key={d.ref_interna}>
                <span className="font-mono">{d.factura_numero ?? d.ref_interna}</span>
                {d.beneficiario ? ` · ${d.beneficiario}` : ""}: esperaba <strong>{TEXTO[d.esperado]}</strong>, ahora <strong className={d.obtenido === "PAGAR" ? "text-frenada-foreground" : undefined}>{TEXTO[d.obtenido]}</strong>
              </li>
            ))}
          </ul>
        </TarjetaPie>
      ) : null}
    </Tarjeta>
  );
}

const TEXTO = { PAGAR: "pagar", FRENAR: "frenar", ESCALAR: "escalar", RECHAZADA_NO_FACTURA: "no es factura" } as const;

function Cifra({ valor, etiqueta, malo = false, icono = false }: { valor: React.ReactNode; etiqueta: string; malo?: boolean; icono?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 bg-card px-4 py-4 sm:px-6", malo && "bg-frenada")}>
      <span className={cn("flex items-center gap-2 font-mono text-2xl font-semibold tabular-nums sm:text-3xl", malo && "text-frenada-foreground")}>
        {icono ? <ShieldIcon className={cn("size-5", malo ? "text-frenada-punto" : "text-pagada-punto")} aria-hidden /> : null}
        {valor}
      </span>
      <span className={cn("text-[13px] text-muted-foreground", malo && "text-frenada-foreground")}>{etiqueta}</span>
    </div>
  );
}

function TablaBeneficiarios({ filas }: { filas: FilaBeneficiario[] }) {
  const [q, setQ] = useState("");
  const [todos, setTodos] = useState(false);
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const encontradas = q ? filas.filter((b) => norm(`${b.nombre} ${b.detalle} ${b.acuerdo}`).includes(norm(q))) : filas;
  const visibles = todos || q ? encontradas : encontradas.slice(0, 8);
  return (
    <Tarjeta as="section" aria-labelledby="ben">
      <TarjetaEncabezado id="ben" titulo="Beneficiarios permitidos · R3, R4, R5" descripcion="A quién puede pagar el agente sin preguntar, a qué cuenta y por cuánto.">
        <label htmlFor="buscar-ben" className="sr-only">
          Buscar beneficiario
        </label>
        <input
          id="buscar-ben"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar beneficiario…"
          autoComplete="off"
          className={cn(CONTROL, "w-60 max-w-full")}
        />
      </TarjetaEncabezado>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-t border-border bg-superficie-2 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-6 py-2.5">Beneficiario</th>
              <th scope="col" className="px-2 py-2.5">Cuenta registrada</th>
              <th scope="col" className="px-2 py-2.5">Acuerdo</th>
              <th scope="col" className="px-2 py-2.5 text-right">Monto acordado</th>
              <th scope="col" className="px-2 py-2.5 text-right">Límite mensual</th>
              <th scope="col" className="px-6 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((b) => (
              <tr key={b.id} className="border-t border-subtle align-top">
                <td className="px-6 py-3">
                  <span className="flex flex-col">
                    <span className="font-medium">{b.nombre}</span>
                    <span className="text-xs text-muted-foreground">{b.detalle}</span>
                  </span>
                </td>
                <td className="px-2 py-3 font-mono text-[13px]">{b.cuenta}</td>
                <td className="px-2 py-3 text-[13px] text-texto-3">{b.acuerdo}</td>
                <td className="px-2 py-3 text-right font-mono text-[13px] tabular-nums">{b.monto}</td>
                <td className="px-2 py-3 text-right font-mono text-[13px] tabular-nums">{b.limite}</td>
                <td className="px-6 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", b.activo ? "bg-pagada text-pagada-foreground" : "bg-muted text-muted-foreground")}>
                    {b.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
              </tr>
            ))}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                  Ningún beneficiario coincide con «{q}».
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TarjetaPie className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Mostrando {visibles.length} de {filas.length} · las cuentas se muestran enmascaradas · todos los datos son ficticios. Para agregar uno, apruébalo
          desde Aprobaciones con «Agregar a la lista permitida».
        </span>
        {!q && filas.length > 8 ? (
          <button type="button" onClick={() => setTodos((x) => !x)} className="min-h-11 font-medium text-link hover:underline">
            {todos ? "Ver menos" : `Ver los ${filas.length}`}
          </button>
        ) : null}
      </TarjetaPie>
    </Tarjeta>
  );
}
