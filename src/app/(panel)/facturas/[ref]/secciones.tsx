import { PildoraResultado, Tarjeta, TarjetaEncabezado, TarjetaPie, fechaCorta, hora } from "@/app/_componentes";
import type { HitoLineaTiempo, RespuestaFactura } from "@/app/_datos/facturas";
import type { IdRegla } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

import { type FilaDato, TablaDatos } from "./datos-editables";

// Secciones de la traza (§13.2) que no tienen interacción: datos extraídos, reglas y línea de tiempo.

/**
 * "COP 4.200,00" (1 base = 4.200 COP, así se guarda en el registro) → "1 USD = 4.200,00 COP". Si la tasa es menor que 1
 * (empresa en COP, factura en USD: "USD 0,00025") se muestra al revés, como se lee una TRM: "1 USD = 4.000,00 COP".
 */
export function trm(tasa: string, base: string): string {
  const [moneda, numero] = tasa.split(" ");
  if (!moneda || !numero) return tasa;
  const valor = Number(numero.replaceAll(".", "").replace(",", "."));
  if (Number.isFinite(valor) && valor > 0 && valor < 1) {
    const inversa = (1 / valor).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `1 ${moneda} = ${inversa} ${base}`;
  }
  return `1 ${base} = ${numero} ${moneda}`;
}

/** Filas de «Datos extraídos» (#129: el total al final; cada dato corregible con su clave). */
function campos(f: RespuestaFactura): FilaDato[] {
  const ext = f.extraccion;
  if (!ext) return [];
  // Moneda para un monto que no se leyó: la de otro monto de la factura, si no la base con la que se decidió.
  const moneda = ext.subtotal?.valor?.moneda ?? ext.impuestos?.valor?.moneda ?? f.entrada.moneda_base ?? "USD";
  const fila = (etiqueta: string, clave: FilaDato["clave"], tipo: FilaDato["tipo"], c: { valor: unknown; confianza: number } | undefined): FilaDato => ({
    etiqueta,
    clave,
    tipo,
    valor: (c?.valor ?? null) as FilaDato["valor"],
    confianza: c?.confianza ?? 0,
    moneda,
  });
  const lista: FilaDato[] = [
    fila("Beneficiario", "beneficiario_nombre", "texto", ext.beneficiario_nombre),
    fila("Número", "numero", "mono", ext.numero),
    fila("Emisión", "fecha_emision", "fecha", ext.fecha_emision),
    fila("Vencimiento", "fecha_vencimiento", "fecha", ext.fecha_vencimiento),
    fila("Cuenta destino", "cuenta_destino_ultimos4", "cuenta", ext.cuenta_destino_ultimos4),
    fila("Concepto", "concepto", "texto", ext.concepto),
  ];
  if (ext.subtotal?.valor) lista.push(fila("Subtotal", "subtotal", "dinero", ext.subtotal));
  if (ext.impuestos?.valor) lista.push(fila("Impuestos", "impuestos", "dinero", ext.impuestos));
  if (ext.referencia_acuerdo?.valor) {
    const hito = ext.hito_numero?.valor ? ` · hito ${ext.hito_numero.valor}` : "";
    lista.push({ ...fila("Acuerdo", hito ? null : "referencia_acuerdo", "mono", ext.referencia_acuerdo), valor: ext.referencia_acuerdo.valor + hito });
  }
  // El total va al final, debajo de subtotal e impuestos, como en una factura (#126).
  lista.push({ ...fila("Total", "monto_total", "dinero", ext.monto_total), total: true });
  // Factura en otra moneda que la de la empresa: la TRM con la que se convirtió y el total en la moneda de la empresa.
  const total = ext.monto_total.valor;
  const base = f.entrada.moneda_base ?? "USD";
  if (total && total.moneda !== base && f.entrada.monto_usd_centavos !== null) {
    const fecha = ext.fecha_emision.valor;
    const nota = fecha ? `de ${fechaCorta(fecha)}` : "de hoy";
    if (f.entrada.tasa_usada) {
      lista.push({ etiqueta: "TRM de emisión", clave: null, tipo: "mono", valor: trm(f.entrada.tasa_usada, base), confianza: 1, moneda: base, nota });
    }
    lista.push({ etiqueta: `Total en ${base}`, clave: null, tipo: "dinero", valor: { centavos: f.entrada.monto_usd_centavos, moneda: base }, confianza: 1, moneda: base, total: true, nota: "calculado" });
  }
  return lista;
}

const NOMBRE_LECTOR: Record<string, string> = { gemini: "Gemini", groq: "Groq", anthropic: "Claude", ninguno: "ninguno" };

/** Doble lectura: qué hizo cada modelo. "Gemini leyó · Groq falló (groq: HTTP 404)". */
function textoLectores(f: RespuestaFactura): string | null {
  const lectores = f.extraccion?.senales_llm.lectores;
  if (!lectores?.length) return null;
  const partes = lectores.map((l) => {
    const n = NOMBRE_LECTOR[l.proveedor] ?? l.proveedor;
    if (l.estado === "leyo") return `${n} leyó`;
    return `${n} ${l.estado === "fallo" ? "falló" : "no devolvió datos"}${l.detalle ? ` (${l.detalle})` : ""}`;
  });
  const uno = lectores.filter((l) => l.estado === "leyo").length < 2;
  return `Doble lectura: ${partes.join(" · ")}.${uno ? " Con un solo modelo nada llega a 2 de 3 coincidencias: queda en 50 % y escala." : ""}`;
}

export function DatosExtraidos({ f }: { f: RespuestaFactura }) {
  const lista = campos(f);
  const lectores = textoLectores(f);
  return (
    <Tarjeta as="section" aria-labelledby="ext">
      <TarjetaEncabezado id="ext" titulo="Datos extraídos" descripcion="Umbral de confianza: 90%" />
      {lectores ? <p className="border-t border-subtle px-6 py-3 text-[13px] text-muted-foreground">{lectores}</p> : null}
      {lista.length === 0 ? (
        <p className="border-t border-border px-6 py-5 text-sm text-muted-foreground">No se pudieron extraer datos de este documento.</p>
      ) : (
        <TablaDatos filas={lista} />
      )}
    </Tarjeta>
  );
}

function lista(ids: IdRegla[]): string {
  if (ids.length <= 1) return ids.join("");
  return `${ids.slice(0, -1).join(", ")} y ${ids.at(-1)}`;
}

/** "Resultado: Escalar · fallaron R3, R10 y R11, ninguna regla de frenar falló" */
/**
 * ESCALAR: qué falló y por qué no se frenó. Una regla de frenar INDETERMINADA (sin dato confiable) no frena:
 * escala, porque ante la duda siempre decide una persona (§4.2). Sin reglas listadas fue un error del motor (§5 paso 4).
 */
function detalleEscalar(evaluaciones: RespuestaFactura["evaluaciones"], fallan: IdRegla[]): string {
  if (fallan.length === 0) return "el agente no pudo evaluar las reglas y escaló por seguridad";
  const dudas = evaluaciones.filter((e) => e.si_falla === "FRENAR" && e.resultado === "INDETERMINADO").map((e) => e.id);
  const fallo = `${fallan.length > 1 ? "fallaron" : "falló"} ${lista(fallan)}`;
  if (dudas.length === 0) return `${fallo}; ninguna regla de frenar falló`;
  const verbo = dudas.length > 1 ? "quedaron sin poder evaluarse" : "quedó sin poder evaluarse";
  return `${fallo}; ${lista(dudas)} ${verbo} y una duda siempre escala, nunca frena ni paga`;
}

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
      return { decision: "Escalar", detalle: detalleEscalar(evaluaciones, fallan) };
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
  neutro: "bg-punto-neutro",
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
