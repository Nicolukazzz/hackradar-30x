"use client";

import { CheckIcon, Loader2Icon, MailIcon, MessageCircleIcon, SendIcon, UserPlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { llamar } from "@/app/_componentes/llamar";
import { Monto } from "@/app/_componentes/monto";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ProveedorPorConfirmar, ResultadoConfiar } from "@/aprobaciones/proveedores-nuevos";
import type { RemitentePorConfirmar, RespuestaRemitente, ResultadoConfirmar } from "@/aprobaciones/remitentes";
import type { Moneda } from "@/dominio/tipos";
import { sinPuntoDoble } from "@/dominio/normalizar";
import type { PermisoUI } from "@/lib/auth/permisos";

// Por confirmar (2026-10-18). Remitentes: un proveedor de la lista escribió desde un correo, Telegram o WhatsApp que no
// tiene vinculado. Se responde una sola pregunta por remitente, sin abrir cada factura: «¿es de este proveedor?».
// Sí → se vincula y sus facturas pendientes se vuelven a evaluar (las que cumplen todo se pagan solas). No → se rechazan.

const ICONO = { correo: MailIcon, telegram: SendIcon, whatsapp: MessageCircleIcon } as const;

function canal(r: RemitentePorConfirmar["remitente"]): string {
  if (r.tipo === "correo") return r.valor;
  if (r.tipo === "telegram") return `Telegram · chat ${r.valor}`;
  return `WhatsApp · +${r.valor}`;
}

type FacturaEsperando = { monto_usd_centavos: number | null; moneda_base: Moneda };

/** Total de las que esperan. Una factura sin total confiable no suma 0: se dice que su monto está por confirmar (#149). */
function TotalEspera({ facturas, moneda }: { facturas: readonly FacturaEsperando[]; moneda: Moneda }) {
  const seguras = facturas.filter((f) => f.monto_usd_centavos !== null && f.moneda_base === moneda);
  const dudosas = facturas.length - seguras.length;
  const total = seguras.reduce((s, f) => s + (f.monto_usd_centavos ?? 0), 0);
  const porConfirmar = <span className="text-escalada-foreground">{dudosas === facturas.length ? "monto por confirmar" : `${dudosas} por confirmar`}</span>;
  if (seguras.length === 0) return porConfirmar;
  return (
    <>
      <Monto usd={total} moneda={moneda} />
      {dudosas > 0 && <> + {porConfirmar}</>}
    </>
  );
}

function resumen(r: ResultadoConfirmar, proveedor: string): string {
  if (r.respuesta === "no") return `${r.rechazadas === 1 ? "1 factura rechazada" : `${r.rechazadas} facturas rechazadas`}. No se vinculó nada.`;
  const partes = [
    r.pagadas > 0 && `${r.pagadas} pagada${r.pagadas === 1 ? "" : "s"}`,
    r.siguen_escaladas > 0 && `${r.siguen_escaladas} sigue${r.siguen_escaladas === 1 ? "" : "n"} pendiente${r.siguen_escaladas === 1 ? "" : "s"} por otra razón`,
    r.frenadas > 0 && `${r.frenadas} frenada${r.frenadas === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `Vinculado a ${proveedor}. ${partes.join(" · ") || "Sin facturas por reevaluar"}.`;
}

function Pregunta({ g, confirmar }: { g: RemitentePorConfirmar; confirmar: PermisoUI }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [pidiendo, setPidiendo] = useState<RespuestaRemitente | null>(null);
  const Icono = ICONO[g.remitente.tipo];
  const n = g.facturas.length;
  const otras = g.facturas.filter((f) => f.otras_reglas.length > 0).length;

  function responder(respuesta: RespuestaRemitente) {
    iniciar(async () => {
      try {
        const r = await llamar<ResultadoConfirmar>("/api/por-confirmar/remitente", "POST", { remitente: g.remitente, beneficiario_id: g.beneficiario_id, respuesta });
        toast.success(respuesta === "si" ? "Remitente confirmado" : "Remitente rechazado", { description: resumen(r, g.beneficiario) });
        router.refresh();
      } catch (e) {
        toast.error("No se guardó la respuesta", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <li className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-escalada text-escalada-foreground">
          <Icono className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] leading-snug">
            ¿<span className="font-mono text-[14px] break-all">{canal(g.remitente)}</span> es de <span className="font-medium">{g.beneficiario}</span>?
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {n === 1 ? "1 factura espera" : `${n} facturas esperan`} · <TotalEspera facturas={g.facturas} moneda={g.moneda_base} /> ·{" "}
            {g.facturas.map((f, i) => (
              <span key={f.ref_interna}>
                {i > 0 && ", "}
                <Link href={`/facturas/${f.ref_interna}`} className="font-mono text-link hover:underline">
                  {f.factura_numero ?? f.ref_interna}
                </Link>
              </span>
            ))}
          </p>
          {otras > 0 && (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {otras === n ? "Además fallan otras reglas: aunque confirmes, seguirá" : `${otras} de ${n} fallan otras reglas: aunque confirmes, seguirán`} pendiente{otras === 1 ? "" : "s"} por esa razón.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" className="h-11 gap-1.5" disabled={!confirmar.ok || ocupado} onClick={() => setPidiendo("no")}>
          <XIcon aria-hidden />
          No es de ellos
        </Button>
        <Button className="h-11 gap-1.5" disabled={!confirmar.ok || ocupado} onClick={() => setPidiendo("si")}>
          {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
          Sí, es de {g.beneficiario}
        </Button>
      </div>
      <AlertDialog open={pidiendo !== null} onOpenChange={(abierto) => !abierto && setPidiendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pidiendo === "si" ? `¿Vincular a ${g.beneficiario}?` : `¿Rechazar ${n === 1 ? "su factura" : `sus ${n} facturas`}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {pidiendo === "si"
                ? sinPuntoDoble(`${canal(g.remitente)} quedará vinculado a ${g.beneficiario}. El agente vuelve a revisar ${n === 1 ? "su factura" : `sus ${n} facturas`}: lo que cumpla todas las reglas se paga solo; lo demás sigue pendiente con su motivo. Queda en el registro.`)
                : `Si ${canal(g.remitente)} no es de ${g.beneficiario}, puede ser alguien haciéndose pasar por el proveedor. ${n === 1 ? "La factura se rechaza" : "Las facturas se rechazan"} y no se vincula nada. Queda en el registro.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={() => pidiendo && responder(pidiendo)}>
              {pidiendo === "si" ? "Sí, vincular" : "Rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function resumenConfiar(r: ResultadoConfiar, nombre: string): string {
  if (r.respuesta === "no") return `${r.rechazadas === 1 ? "1 factura rechazada" : `${r.rechazadas} facturas rechazadas`}. ${nombre} no se agregó.`;
  const partes = [
    r.aprobadas > 0 && `${r.aprobadas} aprobada${r.aprobadas === 1 ? "" : "s"}`,
    r.primeras_firmas > 0 && `${r.primeras_firmas} con tu firma, falta una segunda`,
    r.siguen_pendientes - r.primeras_firmas > 0 && `${r.siguen_pendientes - r.primeras_firmas} sigue${r.siguen_pendientes - r.primeras_firmas === 1 ? "" : "n"} pendiente${r.siguen_pendientes - r.primeras_firmas === 1 ? "" : "s"} por otra razón o por tu límite`,
  ].filter(Boolean);
  return `${nombre} quedó en tus proveedores. ${partes.join(" · ") || "Sin facturas por aprobar"}.`;
}

function PreguntaProveedor({ g, confirmar }: { g: ProveedorPorConfirmar; confirmar: PermisoUI }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [pidiendo, setPidiendo] = useState<RespuestaRemitente | null>(null);
  const n = g.facturas.length;
  const solo = g.facturas.filter((f) => f.solo_por_ser_nuevo).length;
  const moneda = g.facturas[0]?.moneda_base ?? "USD";

  function responder(respuesta: RespuestaRemitente) {
    iniciar(async () => {
      try {
        const r = await llamar<ResultadoConfiar>("/api/por-confirmar/proveedor", "POST", { clave: g.clave, respuesta });
        toast.success(respuesta === "si" ? `Confías en ${g.nombre}` : `No confías en ${g.nombre}`, { description: resumenConfiar(r, g.nombre) });
        router.refresh();
      } catch (e) {
        toast.error("No se guardó la respuesta", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <li className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-escalada text-escalada-foreground">
          <UserPlusIcon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] leading-snug">
            <span className="font-medium">{g.nombre}</span> es un proveedor nuevo. ¿Confiar siempre?
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {n === 1 ? "1 factura espera" : `${n} facturas esperan`} · <TotalEspera facturas={g.facturas} moneda={moneda} /> ·{" "}
            {g.facturas.map((f, i) => (
              <span key={f.ref_interna}>
                {i > 0 && ", "}
                <Link href={`/facturas/${f.ref_interna}`} className="font-mono text-link hover:underline">
                  {f.factura_numero ?? f.ref_interna}
                </Link>
              </span>
            ))}
          </p>
          {solo < n && (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {n - solo === 1 ? "1 falla" : `${n - solo} fallan`} otras reglas: aunque confíes, {n - solo === 1 ? "seguirá pendiente" : "seguirán pendientes"} por esa razón.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" className="h-11 gap-1.5" disabled={!confirmar.ok || ocupado} onClick={() => setPidiendo("no")}>
          <XIcon aria-hidden />
          No
        </Button>
        <Button className="h-11 gap-1.5" disabled={!confirmar.ok || ocupado} onClick={() => setPidiendo("si")}>
          {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
          Sí, confiar siempre
        </Button>
      </div>
      <AlertDialog open={pidiendo !== null} onOpenChange={(abierto) => !abierto && setPidiendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pidiendo === "si" ? `¿Agregar a ${g.nombre} a tus proveedores?` : `¿No confiar en ${g.nombre}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {pidiendo === "si"
                ? `Queda en la lista con la cuenta y el canal de su factura más reciente. ${solo === 0 ? "Ninguna de sus facturas se aprueba ahora: todas fallan otras reglas." : `Se ${solo === 1 ? "aprueba la factura que esperaba" : `aprueban las ${solo} facturas que esperaban`} solo por ser nuevo, con tu límite de aprobación.`} Sus próximas facturas se deciden con las reglas normales. Queda en el registro.`
                : `No se agrega a la lista y ${n === 1 ? "su factura se rechaza" : `sus ${n} facturas se rechazan`}. Queda en el registro.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={() => pidiendo && responder(pidiendo)}>
              {pidiendo === "si" ? "Sí, confiar siempre" : "No confiar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

export function PorConfirmar({ remitentes, proveedores, confirmar }: { remitentes: RemitentePorConfirmar[]; proveedores: ProveedorPorConfirmar[]; confirmar: PermisoUI }) {
  if (remitentes.length === 0 && proveedores.length === 0) return null;
  return (
    <section aria-labelledby="por-confirmar-titulo" className="overflow-hidden rounded-2xl border bg-card">
      <header className="border-b px-5 py-4">
        <h2 id="por-confirmar-titulo" className="text-[15px] font-semibold">
          Por confirmar
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Responde una vez y no tienes que revisar cada factura: lo que esperaba solo por esto se resuelve, lo demás sigue pendiente con su motivo.
          {!confirmar.ok && ` ${confirmar.motivo}`}
        </p>
      </header>
      <ul className="divide-y">
        {proveedores.map((g) => (
          <PreguntaProveedor key={g.clave} g={g} confirmar={confirmar} />
        ))}
        {remitentes.map((g) => (
          <Pregunta key={`${g.remitente.tipo}:${g.remitente.valor}:${g.beneficiario_id}`} g={g} confirmar={confirmar} />
        ))}
      </ul>
    </section>
  );
}
