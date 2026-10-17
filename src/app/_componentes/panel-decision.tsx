"use client";

import { CheckIcon, Loader2Icon, Undo2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { MINIMO_COMENTARIO } from "@/aprobaciones/decidir";
import { formatearUsd } from "@/dominio/dinero";
import { cn } from "@/lib/utils";

import { Boton } from "./boton";

// Decisión humana sobre una factura escalada (§10, §13.2 y §13.3). Dos pasos: elegir y confirmar.
// "Deshacer" vuelve atrás ANTES de confirmar; una vez registrada, la decisión no se borra (registro append-only).

// El mismo mínimo que exige decidir() en el servidor.
const MINIMO = MINIMO_COMENTARIO;

/** "Servicios Ómicron S.A." + "." no debe quedar "S.A..". */
const sinPuntoFinal = (t: string) => t.replace(/\.$/, "");

type Accion = "aprobar" | "rechazar";

/** Quién decide: sale de la sesión en el servidor (#25), nunca del cliente. */
export type AprobadorCorto = { id: string; nombre: string; limite_usd: number | null };

export type PropsPanelDecision = {
  refInterna: string;
  factura: string | null;
  beneficiario: string | null;
  montoUsd: number | null;
  puedeAgregarALista: boolean;
  requiereDobleAprobacion: boolean;
  /** `cubre`: el límite de quien firmó primero alcanza el monto (§10) */
  firmas: { aprobador_id: string; nombre: string; cubre: boolean }[];
  actual: AprobadorCorto | null;
  /** por qué la cuenta no puede decidir (rol sin `aprobar`, #51); se muestra en vez del panel */
  motivoSinPermiso?: string;
  /** id del textarea, para enlazar "Decidir ahora" */
  idComentario?: string;
  className?: string;
};

export function PanelDecision(p: PropsPanelDecision) {
  const router = useRouter();
  const idBase = useId();
  const idComentario = p.idComentario ?? `${idBase}-comentario`;
  const [comentario, setComentario] = useState("");
  const [agregar, setAgregar] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);
  const [enviando, iniciar] = useTransition();

  const usd = p.montoUsd === null ? null : `USD ${formatearUsd(p.montoUsd)}`;
  const comentarioOk = comentario.trim().length >= MINIMO;
  const firmaPropia = p.firmas.some((f) => f.aprobador_id === p.actual?.id);
  const superaLimite =
    p.actual !== null && p.actual.limite_usd !== null && p.montoUsd !== null && p.montoUsd > p.actual.limite_usd;
  // Con doble aprobación, una firma sin límite suficiente vale como firma de control (§10) si la otra sí lo tiene:
  // la primera puede ser de control, y la segunda también si la primera ya cubre el monto (igual que decidir()).
  const primeraCubre = p.firmas.some((f) => f.cubre);
  const bloqueoLimite = superaLimite && (!p.requiereDobleAprobacion || (p.firmas.length > 0 && !primeraCubre));
  // El servidor agrega a la lista con la firma que cierra la aprobación, nunca con la primera de dos.
  const puedeAgregar = p.puedeAgregarALista && !(p.requiereDobleAprobacion && p.firmas.length === 0);

  let textoAprobar = usd ? `Aprobar ${usd}` : "Aprobar";
  if (p.requiereDobleAprobacion) textoAprobar = p.firmas.length === 0 ? "Aprobar (1.ª de 2 firmas)" : "Aprobar (2.ª firma)";

  function elegir(a: Accion) {
    setTocado(true);
    setError(null);
    if (!comentarioOk) return;
    setAccion(a);
  }

  function confirmar() {
    if (!accion) return;
    iniciar(async () => {
      let res: Response;
      try {
        res = await fetch(`/api/aprobaciones/${encodeURIComponent(p.refInterna)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accion, comentario: comentario.trim(), ...(agregar && puedeAgregar && accion === "aprobar" ? { agregar_a_lista: true } : {}) }),
        });
      } catch {
        // Sin red o servidor reiniciando: no se registró nada; el comentario se conserva para reintentar.
        setError("No hubo conexión con el servidor y no se registró nada. Revisa tu conexión e intenta de nuevo.");
        setAccion(null);
        return;
      }
      const datos = (await res.json().catch(() => ({}))) as { error?: string; decision?: string | null };
      if (!res.ok) {
        setError(datos.error ?? "No se pudo registrar la decisión. Intenta de nuevo.");
        setAccion(null);
        return;
      }
      const quien = p.factura ?? p.refInterna;
      if (datos.decision === null) toast.success(`Primera firma registrada para ${quien}`, { description: "Falta la aprobación de otra persona." });
      else if (accion === "aprobar") toast.success(`Aprobaste ${quien}`, { description: `${usd ?? "El monto"} pasa de reservado a pagado. Quedó en el registro.` });
      else toast.success(`Rechazaste ${quien}`, { description: `La reserva de ${usd ?? "la factura"} vuelve al presupuesto.` });
      setComentario("");
      setAccion(null);
      setAgregar(false);
      setTocado(false);
      router.refresh();
    });
  }

  if (!p.actual) {
    return (
      <p className={cn("rounded-xl bg-muted px-4 py-3 text-sm text-texto-3", p.className)}>
        {p.motivoSinPermiso ?? "Tu cuenta no puede decidir sobre esta factura."}
      </p>
    );
  }

  if (accion) {
    const aprobar = accion === "aprobar";
    return (
      <div role="group" aria-labelledby={`${idBase}-conf`} className={cn("flex flex-col gap-3 rounded-xl bg-superficie-2 p-4 ring-1 ring-border", p.className)}>
        <p id={`${idBase}-conf`} className="text-sm leading-relaxed">
          {aprobar ? (
            <>
              Vas a <strong className="font-semibold">aprobar</strong> el pago de <span className="font-mono">{usd ?? "esta factura"}</span>
              {p.beneficiario ? ` a ${sinPuntoFinal(p.beneficiario)}` : ""}
              {p.requiereDobleAprobacion && p.firmas.length === 0 ? " como primera de dos firmas" : ""}
              {agregar && puedeAgregar ? `, y agregar a ${sinPuntoFinal(p.beneficiario ?? "este beneficiario")} a la lista permitida` : ""}.
            </>
          ) : (
            <>
              Vas a <strong className="font-semibold">rechazar</strong> el pago{p.beneficiario ? ` a ${sinPuntoFinal(p.beneficiario)}` : ""}. La reserva vuelve al presupuesto.
            </>
          )}{" "}
          Queda en el registro como {p.actual.nombre} con tu comentario y no se puede borrar después de confirmar.
        </p>
        <blockquote className="border-l-2 border-borde-fuerte pl-3 text-sm text-texto-3">«{comentario.trim()}»</blockquote>
        <div className="flex flex-wrap gap-2.5">
          <Boton variante={aprobar ? "primaria" : "peligro"} onClick={confirmar} disabled={enviando} autoFocus>
            {enviando ? <Loader2Icon className="animate-spin" aria-hidden /> : aprobar ? <CheckIcon aria-hidden /> : <XIcon aria-hidden />}
            {enviando ? "Registrando…" : aprobar ? "Confirmar aprobación" : "Confirmar rechazo"}
          </Boton>
          <Boton variante="secundaria" onClick={() => setAccion(null)} disabled={enviando}>
            <Undo2Icon aria-hidden />
            Deshacer
          </Boton>
        </div>
      </div>
    );
  }

  const errorComentario = tocado && !comentarioOk;
  return (
    <div className={cn("flex flex-col gap-3.5", p.className)}>
      {p.firmas.length > 0 ? (
        <p className="rounded-xl bg-escalada px-4 py-3 text-sm text-escalada-foreground">
          1 de 2 firmas: ya aprobó {p.firmas.map((f) => f.nombre).join(", ")}. Falta la aprobación de otra persona.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idComentario} className="text-[13px] font-semibold">
          Comentario (obligatorio)
        </label>
        <textarea
          id={idComentario}
          name="comentario"
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          onBlur={() => setTocado(comentario.length > 0)}
          maxLength={1000}
          aria-invalid={errorComentario}
          aria-describedby={errorComentario ? `${idBase}-err-com` : undefined}
          placeholder="Ej.: no reconocemos este proveedor; pedir verificación por otro canal…"
          className="w-full resize-y rounded-[10px] border border-borde-fuerte bg-card p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-frenada-punto"
        />
        {errorComentario ? (
          <span id={`${idBase}-err-com`} className="text-[13px] text-frenada-foreground">
            Escribe al menos {MINIMO} caracteres: el comentario explica tu decisión en el registro.
          </span>
        ) : null}
      </div>
      {puedeAgregar ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={agregar} onChange={(e) => setAgregar(e.target.checked)} className="size-[18px] accent-primary" />
          Agregar a {p.beneficiario ?? "este beneficiario"} a la lista permitida para pagos futuros
        </label>
      ) : null}
      {bloqueoLimite ? (
        <p className="text-[13px] text-frenada-foreground">
          Supera tu límite de aprobación (USD {formatearUsd(p.actual.limite_usd ?? 0)}). Puedes rechazarla o pedirle a un aprobador con límite suficiente que la apruebe.
        </p>
      ) : null}
      {firmaPropia ? <p className="text-[13px] text-texto-3">Ya firmaste esta factura: la segunda aprobación debe ser de otra persona.</p> : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-frenada px-4 py-3 text-sm text-frenada-foreground">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        <Boton variante="peligro" onClick={() => elegir("rechazar")}>
          Rechazar pago
        </Boton>
        <Boton variante="primaria" onClick={() => elegir("aprobar")} disabled={bloqueoLimite || firmaPropia || p.montoUsd === null}>
          {textoAprobar}
        </Boton>
      </div>
    </div>
  );
}
