"use client";

import { CheckIcon, Loader2Icon, Undo2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Boton, ChipRegla, Monto, etiquetaCanal, fechaHora, hora } from "@/app/_componentes";
import type { TarjetaAprobacion as Datos } from "@/app/_datos/aprobaciones";
import type { EntradaRegistro } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// Tarjeta de una factura escalada (§13.3). Flujo (§10): Aprobar/Rechazar → comentario obligatorio →
// confirmar → 5 s para deshacer → POST /api/aprobaciones/:ref. Hasta el POST nada queda en el registro;
// después ya no se deshace (se agrega otra entrada).

type Accion = "aprobar" | "rechazar";
type Paso = { tipo: "listo" } | { tipo: "escribiendo"; accion: Accion } | { tipo: "esperando"; accion: Accion; quedan: number } | { tipo: "enviando"; accion: Accion };

const SEGUNDOS_DESHACER = 5;
const COMENTARIO_MINIMO = 5;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Chips solo de las reglas que fallaron: "R9 · 4.500,00 > 3.000,00" (o el id solo si no hay comparación). */
function chips(t: Datos): string[] {
  return t.reglas_que_fallaron.map((id) => t.comparaciones.find((c) => c.startsWith(`${id} `)) ?? id);
}

export function TarjetaAprobacion({ t, permiso }: { t: Datos; permiso: { ok: true } | { ok: false; motivo: string } }) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>({ tipo: "listo" });
  const [comentario, setComentario] = useState("");
  const [agregar, setAgregar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reloj = useRef<ReturnType<typeof setInterval>>(undefined);
  const campo = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useEffect(() => () => clearInterval(reloj.current), []);
  useEffect(() => {
    if (paso.tipo === "escribiendo") campo.current?.focus();
  }, [paso.tipo]);

  const numero = t.factura_numero ?? t.ref_interna;
  const a = t.beneficiario ?? "beneficiario sin nombre legible";
  const comentarioOk = comentario.trim().length >= COMENTARIO_MINIMO;
  const segundaFirma = t.requiere_doble_aprobacion && t.firmas.length > 0;
  const urgente = t.asignacion?.urgente ?? false;

  async function enviar(accion: Accion) {
    setPaso({ tipo: "enviando", accion });
    try {
      const res = await fetch(`/api/aprobaciones/${encodeURIComponent(t.ref_interna)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, comentario: comentario.trim(), ...(t.puede_agregar_a_lista && accion === "aprobar" ? { agregar_a_lista: agregar } : {}) }),
      });
      const datos = (await res.json().catch(() => ({}))) as Partial<EntradaRegistro> & { error?: string };
      if (!res.ok) throw new Error(datos.error ?? "No se pudo registrar la decisión. Intenta de nuevo.");
      const titulo =
        datos.decision === "APROBADA_HUMANO"
          ? `${numero} aprobada`
          : datos.decision === "RECHAZADA_HUMANO"
            ? `${numero} rechazada`
            : `${numero}: primera firma registrada`;
      toast.success(titulo, {
        description:
          datos.decision === null ? "Falta una segunda aprobación de otra persona." : "Quedó en el registro con tu comentario.",
        action: datos.id ? { label: "Ver en el registro", onClick: () => router.push(`/registro?entrada=${datos.id}`) } : undefined,
      });
      // Refresca la lista y el badge de la barra lateral (la tarjeta desaparece si ya no está pendiente).
      router.refresh();
      setPaso({ tipo: "listo" });
      setComentario("");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo registrar la decisión.";
      setError(mensaje);
      toast.error("No se registró la decisión", { description: mensaje });
      setPaso({ tipo: "escribiendo", accion });
    }
  }

  function confirmar(accion: Accion) {
    if (!comentarioOk) return;
    setError(null);
    setPaso({ tipo: "esperando", accion, quedan: SEGUNDOS_DESHACER });
    let quedan = SEGUNDOS_DESHACER;
    clearInterval(reloj.current);
    reloj.current = setInterval(() => {
      quedan -= 1;
      if (quedan > 0) setPaso({ tipo: "esperando", accion, quedan });
      else {
        clearInterval(reloj.current);
        void enviar(accion);
      }
    }, 1000);
  }

  function deshacer() {
    clearInterval(reloj.current);
    setPaso({ tipo: "escribiendo", accion: paso.tipo === "esperando" ? paso.accion : "aprobar" });
  }

  return (
    <article
      aria-labelledby={`${id}-ben`}
      className={cn("flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 sm:p-6", urgente ? "ring-frenada-punto/60" : "ring-border")}
    >
      <div className="flex flex-wrap gap-6">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
            <span className="font-mono text-[13px] font-semibold">{numero}</span>
            <span>
              {capital(etiquetaCanal(t.canal))} · {hora(t.recibido_en)}
            </span>
          </span>
          <h2 id={`${id}-ben`} className="text-xl font-semibold tracking-tight text-balance">
            {a}
          </h2>
          <span className="text-[13px] text-muted-foreground">{t.beneficiario_detalle}</span>
          <span className="mt-1.5 text-[26px] leading-tight font-semibold">
            <Monto usd={t.monto_usd_centavos} />
          </span>
          {t.monto_original && t.monto_original.moneda !== "USD" ? (
            <span className="text-xs text-muted-foreground">
              <Monto dinero={t.monto_original} />
              {t.tasa_usada ? ` · tasa ${t.tasa_usada}` : ""}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-[2_1_360px] flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Por qué se escaló</span>
            <span className="flex flex-wrap gap-1.5">
              {chips(t).map((c) => (
                <ChipRegla key={c} texto={c} tono="escalar" className="whitespace-normal" />
              ))}
            </span>
            <p className="text-[15px] leading-relaxed text-pretty">{t.explicacion}</p>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[10px] bg-superficie-2 px-3.5 py-3">
            <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Si apruebas</span>
            <span className="text-sm leading-relaxed text-texto-3">{t.si_apruebas}</span>
          </div>
          <span className="text-[13px] text-muted-foreground">
            {t.reglas_ok} de {t.reglas_total} reglas cumplen o no aplican.
          </span>
        </div>

        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-3">
          {t.asignacion ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Asignada a</span>
                <span className="text-sm font-semibold">
                  {t.asignacion.aprobador.nombre} ({t.asignacion.aprobador.rol})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Responder antes de</span>
                <span className={cn("text-sm font-semibold", urgente && "text-frenada-foreground")}>
                  {urgente ? `Hoy, ${hora(t.asignacion.responder_antes_de)}` : fechaHora(t.asignacion.responder_antes_de)}
                </span>
              </div>
            </>
          ) : null}
          {t.requiere_doble_aprobacion ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Doble aprobación</span>
              <span className="text-sm font-semibold">{t.firmas.length} de 2 firmas</span>
              {t.firmas.map((f) => (
                <span key={f.momento} className="text-xs text-muted-foreground">
                  {f.nombre.replace(/\s*\([^)]*\)\s*$/, "")} · {fechaHora(f.momento)}
                </span>
              ))}
            </div>
          ) : null}
          <Link
            href={`/facturas/${t.ref_interna}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-link hover:underline"
          >
            Ver documento y traza completa →
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-subtle pt-4">
        {paso.tipo === "listo" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {t.puede_agregar_a_lista ? (
              <label className="flex min-h-11 items-center gap-2.5 text-sm">
                <input type="checkbox" checked={agregar} onChange={(e) => setAgregar(e.target.checked)} className="size-[18px] accent-primary" />
                Agregar a {a} a la lista permitida para pagos futuros
              </label>
            ) : (
              <span className="text-[13px] text-muted-foreground">
                {permiso.ok ? "Se pedirá un comentario antes de confirmar." : permiso.motivo}
              </span>
            )}
            <div className="flex flex-wrap gap-2.5">
              <Boton variante="peligro" disabled={!permiso.ok} onClick={() => setPaso({ tipo: "escribiendo", accion: "rechazar" })}>
                Rechazar
              </Boton>
              <Boton variante="primaria" disabled={!permiso.ok} onClick={() => setPaso({ tipo: "escribiendo", accion: "aprobar" })}>
                {segundaFirma ? "Dar la segunda firma" : "Aprobar pago"}
              </Boton>
            </div>
          </div>
        ) : paso.tipo === "escribiendo" ? (
          <form
            className="flex flex-col gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              confirmar(paso.accion);
            }}
          >
            <label htmlFor={`${id}-comentario`} className="text-sm font-medium">
              {paso.accion === "aprobar" ? `¿Por qué apruebas el pago a ${a}?` : `¿Por qué rechazas ${numero}?`}
            </label>
            <textarea
              id={`${id}-comentario`}
              ref={campo}
              value={comentario}
              maxLength={1000}
              rows={2}
              required
              aria-describedby={`${id}-ayuda`}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={paso.accion === "aprobar" ? "Ej.: Hito final entregado y revisado por producto." : "Ej.: No reconocemos este proveedor."}
              className="min-h-20 w-full resize-y rounded-[10px] border border-borde-fuerte bg-card px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <span id={`${id}-ayuda`} className="text-xs text-muted-foreground">
              Obligatorio, al menos {COMENTARIO_MINIMO} caracteres. Queda en el registro con tu nombre.
              {paso.accion === "aprobar" && agregar ? ` También se agregará a ${a} a la lista permitida.` : ""}
            </span>
            {error ? (
              <p role="alert" className="rounded-[10px] bg-frenada px-3 py-2 text-sm font-medium text-frenada-foreground">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2.5">
              <Boton
                type="button"
                variante="secundaria"
                onClick={() => {
                  setError(null);
                  setPaso({ tipo: "listo" });
                }}
              >
                Cancelar
              </Boton>
              <Boton type="submit" variante={paso.accion === "aprobar" ? "primaria" : "peligro"} disabled={!comentarioOk}>
                {paso.accion === "aprobar" ? (
                  <>
                    <CheckIcon aria-hidden />
                    Aprobar <Monto usd={t.monto_usd_centavos} />
                  </>
                ) : (
                  <>
                    <XIcon aria-hidden />
                    Rechazar {numero}
                  </>
                )}
              </Boton>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3" role="status" aria-live="polite">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1",
                paso.accion === "aprobar" ? "text-pagada-foreground ring-pagada-punto" : "text-frenada-foreground ring-frenada-punto",
              )}
            >
              {paso.tipo === "enviando" ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
              {paso.accion === "aprobar" ? "Aprobada por ti" : "Rechazada por ti"}
              {paso.tipo === "esperando" ? ` · se registra en ${paso.quedan} s` : " · registrando…"}
            </span>
            <Boton variante="secundaria" onClick={deshacer} disabled={paso.tipo === "enviando"}>
              <Undo2Icon aria-hidden />
              Deshacer
            </Boton>
          </div>
        )}
      </div>
    </article>
  );
}
