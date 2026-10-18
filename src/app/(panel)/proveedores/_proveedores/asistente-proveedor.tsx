"use client";

import { Loader2Icon, PencilIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { SelectorOpciones, type Opcion } from "@/app/_componentes/invitacion";
import { useMonedaBase } from "@/app/_componentes/moneda-base";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MONEDAS, type Beneficiario, type Moneda } from "@/dominio/tipos";
import type { PermisoUI } from "@/lib/auth/permisos";

import { llamar, usdACentavos } from "../../ajustes/equipo/_equipo/api";

// Nuevo / editar proveedor (#107), en 4 pasos de 3–4 campos: quién es → a qué cuenta se paga → por dónde escribe y
// cuánto puede cobrar al mes → lo acordado (opcional). Telegram y el portal se vinculan con sus enlaces, no aquí.

type Paso = 1 | 2 | 3 | 4;

const TIPOS: Opcion[] = [
  { value: "proveedor", label: "Empresa proveedora" },
  { value: "contratista", label: "Persona contratista" },
];
const CUENTAS: Opcion[] = [
  { value: "cuenta", label: "Cuenta bancaria" },
  { value: "ACH", label: "ACH (EE. UU.)" },
  { value: "CLABE", label: "CLABE (México)" },
  { value: "CBU", label: "CBU (Argentina)" },
  { value: "PIX", label: "PIX (Brasil)" },
];
const MONEDAS_OPCIONES: Opcion[] = MONEDAS.map((m) => ({ value: m, label: m }));
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Formulario = {
  nombre: string;
  nit: string;
  pais: string;
  tipo: string;
  cuentaTipo: string;
  banco: string;
  ultimos4: string;
  correos: string;
  limite: string;
  referencia: string;
  concepto: string;
  monto: string;
  moneda: string;
};

/** Centavos → "3.000" o "3.000,50" (lo que se escribe en los campos). */
function aTexto(centavos: number | null): string {
  if (centavos === null) return "";
  const entero = Math.trunc(centavos / 100).toLocaleString("es-CO");
  const resto = centavos % 100;
  return resto ? `${entero},${String(resto).padStart(2, "0")}` : entero;
}

function desde(b: Beneficiario | null, base: Moneda): Formulario {
  const linea = b?.acuerdo?.lineas[0];
  return {
    nombre: b?.nombre ?? "",
    nit: b?.identificacion_fiscal ?? "",
    pais: b?.pais === "ZZ" ? "" : (b?.pais ?? ""),
    tipo: b?.tipo ?? "proveedor",
    cuentaTipo: b?.cuenta.tipo ?? "cuenta",
    banco: b && b.cuenta.banco !== "sin verificar" ? b.cuenta.banco : "",
    ultimos4: b?.cuenta.ultimos4 ?? "",
    correos: b?.canales.correos.join(", ") ?? "",
    limite: aTexto(b?.limite_mensual_usd ?? null),
    referencia: b?.acuerdo?.referencia ?? "",
    concepto: linea?.concepto ?? "",
    monto: linea ? aTexto(linea.monto.centavos) : "",
    moneda: linea?.monto.moneda ?? base,
  };
}

const lista = (texto: string) =>
  texto
    .split(/[,;\s]+/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

function errorQuien(f: Formulario): string | null {
  if (f.nombre.trim().length < 2) return "Escribe el nombre como aparece en sus facturas.";
  if (!/^[A-Za-z]{2}$/.test(f.pais.trim())) return "País: código de 2 letras (CO, MX, US…).";
  return null;
}

function errorCuenta(f: Formulario): string | null {
  if (!f.banco.trim()) return "Escribe el banco.";
  if (!/^\d{4}$/.test(f.ultimos4)) return "Escribe los últimos 4 dígitos de la cuenta.";
  return null;
}

function errorCanales(f: Formulario): string | null {
  if (lista(f.correos).some((c) => !CORREO.test(c))) return "Hay un correo que no es válido.";
  const limite = usdACentavos(f.limite);
  if (Number.isNaN(limite) || limite === 0) return "El límite mensual no es un monto válido.";
  return null;
}

function errorAcuerdo(f: Formulario): string | null {
  if (!f.referencia.trim() && !f.concepto.trim() && !f.monto.trim()) return null; // sin acuerdo: válido
  if (!f.referencia.trim() || !f.concepto.trim()) return "Para registrar lo acordado escribe referencia y concepto (o deja los tres vacíos).";
  const monto = usdACentavos(f.monto);
  if (monto === null || Number.isNaN(monto) || monto === 0) return "Escribe el monto acordado.";
  return null;
}

/** Errores por paso: Continuar se habilita cuando el paso está completo y válido. */
function errores(f: Formulario): Record<Paso, string | null> {
  return { 1: errorQuien(f), 2: errorCuenta(f), 3: errorCanales(f), 4: errorAcuerdo(f) };
}

function cuerpo(f: Formulario, estado: Beneficiario["estado"]) {
  const monto = usdACentavos(f.monto);
  const conAcuerdo = Boolean(f.referencia.trim() && f.concepto.trim() && monto);
  return {
    nombre: f.nombre.trim(),
    identificacion_fiscal: f.nit.trim() || null,
    pais: f.pais.trim().toUpperCase(),
    tipo: f.tipo,
    categoria: null,
    cuenta: { tipo: f.cuentaTipo, banco: f.banco.trim(), ultimos4: f.ultimos4 },
    correos: lista(f.correos),
    limite_mensual_usd: usdACentavos(f.limite),
    acuerdo: conAcuerdo ? { referencia: f.referencia.trim(), concepto: f.concepto.trim(), monto: { centavos: monto, moneda: f.moneda } } : null,
    estado,
  };
}

const TITULOS: Record<Paso, { titulo: string; descripcion: string }> = {
  1: { titulo: "¿Quién es?", descripcion: "El nombre tal como aparece en sus facturas y su identificación fiscal. Con esto el agente lo reconoce." },
  2: { titulo: "¿A qué cuenta se le paga?", descripcion: "Si una factura trae otra cuenta, el agente no paga: la escala (R4)." },
  3: { titulo: "¿Por dónde escribe?", descripcion: "Las facturas que lleguen desde estos correos se reconocen como suyas (R11). El límite mensual es opcional." },
  4: { titulo: "¿Qué se acordó?", descripcion: "Opcional. Si lo registras, el agente frena lo que no cuadre con este monto (R5). Si no, cada factura espera a una persona." },
};

export function AsistenteProveedor({ permiso, proveedor }: { permiso: PermisoUI; proveedor?: Beneficiario }) {
  const router = useRouter();
  const base = useMonedaBase();
  const editar = Boolean(proveedor);
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>(1);
  const [f, setF] = useState<Formulario>(() => desde(proveedor ?? null, base));
  const [ocupado, iniciar] = useTransition();
  const e = errores(f);
  const cambiar = (campo: keyof Formulario) => (valor: string) => setF((x) => ({ ...x, [campo]: valor }));

  function abrir() {
    setF(desde(proveedor ?? null, base));
    setPaso(1);
    setAbierto(true);
  }

  function guardar() {
    iniciar(async () => {
      try {
        const datos = cuerpo(f, proveedor?.estado ?? "activo");
        if (proveedor) await llamar(`/api/proveedores/${proveedor.id}`, "PATCH", datos);
        else await llamar("/api/proveedores", "POST", datos);
        toast.success(editar ? `${datos.nombre} actualizado` : `${datos.nombre} agregado`, { description: "El cambio quedó en el registro." });
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error("No se guardó el proveedor", { description: err instanceof Error ? err.message : undefined });
      }
    });
  }

  if (!permiso.ok) {
    return editar ? null : (
      <div className="flex flex-col items-end gap-1.5">
        <Boton variante="primaria" disabled>
          <PlusIcon aria-hidden />
          Nuevo proveedor
        </Boton>
        <span className="max-w-[260px] text-right text-[13px] text-muted-foreground">{permiso.motivo}</span>
      </div>
    );
  }

  const { titulo, descripcion } = TITULOS[paso];
  const error = e[paso];
  // En el paso 1 vacío no se regaña: el botón deshabilitado ya lo dice.
  const mostrarError = Boolean(error) && (paso !== 1 || f.nombre.trim().length >= 2);

  return (
    <>
      {editar ? (
        <Button variant="ghost" className="h-11 gap-1.5 px-3" onClick={abrir}>
          <PencilIcon aria-hidden />
          Editar
        </Button>
      ) : (
        <Boton variante="primaria" onClick={abrir}>
          <PlusIcon aria-hidden />
          Nuevo proveedor
        </Boton>
      )}
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <span className="text-xs text-muted-foreground">
              {editar ? `Editar ${proveedor?.nombre} · ` : ""}Paso {paso} de 4
            </span>
            <DialogTitle className="text-lg">{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4">
            {paso === 1 ? (
              <>
                <Campo id="prov-nombre" etiqueta="Nombre" valor={f.nombre} onCambio={cambiar("nombre")} placeholder="Ej.: Estudio Nuevo S.A.S." autoFocus />
                <Campo id="prov-nit" etiqueta="NIT o identificación fiscal" valor={f.nit} onCambio={cambiar("nit")} placeholder="Ej.: 900.123.456-7" ayuda="Opcional. RUT, RFC, CUIT, CNPJ o Tax ID también sirven." />
                <div className="grid grid-cols-[96px_1fr] gap-3">
                  <Campo id="prov-pais" etiqueta="País" valor={f.pais} onCambio={(v) => cambiar("pais")(v.toUpperCase().slice(0, 2))} placeholder="CO" />
                  <Field>
                    <FieldLabel htmlFor="prov-tipo">Tipo</FieldLabel>
                    <SelectorOpciones id="prov-tipo" opciones={TIPOS} valor={f.tipo} onCambio={cambiar("tipo")} />
                  </Field>
                </div>
              </>
            ) : null}
            {paso === 2 ? (
              <>
                <Field>
                  <FieldLabel htmlFor="prov-cuenta-tipo">Tipo de cuenta</FieldLabel>
                  <SelectorOpciones id="prov-cuenta-tipo" opciones={CUENTAS} valor={f.cuentaTipo} onCambio={cambiar("cuentaTipo")} />
                </Field>
                <Campo id="prov-banco" etiqueta="Banco" valor={f.banco} onCambio={cambiar("banco")} placeholder="Ej.: Bancolombia" autoFocus />
                <Campo
                  id="prov-ultimos4"
                  etiqueta="Últimos 4 dígitos"
                  valor={f.ultimos4}
                  onCambio={(v) => cambiar("ultimos4")(v.replaceAll(/\D/g, "").slice(0, 4))}
                  placeholder="4471"
                  mono
                  inputMode="numeric"
                  ayuda="Solo se guardan los últimos 4: es lo que se compara con la factura."
                />
              </>
            ) : null}
            {paso === 3 ? (
              <>
                <Campo id="prov-correos" etiqueta="Correos de facturación" valor={f.correos} onCambio={cambiar("correos")} placeholder="facturacion@proveedor.com" autoFocus ayuda="Opcional. Varios separados por coma." />
                <Campo id="prov-limite" etiqueta={`Límite mensual (${base})`} valor={f.limite} onCambio={cambiar("limite")} placeholder="Vacío = el de las reglas" mono inputMode="decimal" ayuda="Opcional. Sobre este total en el mes, sus facturas se escalan (R8)." />
              </>
            ) : null}
            {paso === 4 ? (
              <>
                <Campo id="prov-referencia" etiqueta="Referencia" valor={f.referencia} onCambio={cambiar("referencia")} placeholder="Ej.: OC-118 o CT-2026" autoFocus mono />
                <Campo id="prov-concepto" etiqueta="Concepto" valor={f.concepto} onCambio={cambiar("concepto")} placeholder="Ej.: Hosting mensual" />
                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <Campo id="prov-monto" etiqueta="Monto acordado" valor={f.monto} onCambio={cambiar("monto")} placeholder="1.240" mono inputMode="decimal" />
                  <Field>
                    <FieldLabel htmlFor="prov-moneda">Moneda</FieldLabel>
                    <SelectorOpciones id="prov-moneda" opciones={MONEDAS_OPCIONES} valor={f.moneda} onCambio={cambiar("moneda")} />
                  </Field>
                </div>
              </>
            ) : null}
            {mostrarError ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>

          <DialogFooter className="-mx-6 -mb-6 px-6">
            {paso > 1 ? (
              <Boton variante="secundaria" onClick={() => setPaso((p) => (p - 1) as Paso)} disabled={ocupado}>
                Atrás
              </Boton>
            ) : null}
            {paso < 4 ? (
              <Boton variante="primaria" onClick={() => setPaso((p) => (p + 1) as Paso)} disabled={Boolean(error)}>
                Continuar
              </Boton>
            ) : (
              <Boton variante="primaria" onClick={guardar} disabled={Boolean(error) || ocupado || Object.values(e).some(Boolean)}>
                {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <SaveIcon aria-hidden />}
                {etiquetaGuardar(ocupado, editar)}
              </Boton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function etiquetaGuardar(ocupado: boolean, editar: boolean): string {
  if (ocupado) return "Guardando…";
  return editar ? "Guardar cambios" : "Agregar proveedor";
}

function Campo(p: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  placeholder?: string;
  ayuda?: string;
  autoFocus?: boolean;
  mono?: boolean;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <Field>
      <FieldLabel htmlFor={p.id}>{p.etiqueta}</FieldLabel>
      <Input
        id={p.id}
        autoComplete="off"
        autoFocus={p.autoFocus}
        placeholder={p.placeholder}
        inputMode={p.inputMode}
        value={p.valor}
        onChange={(ev) => p.onCambio(ev.target.value)}
        className={p.mono ? "h-11 font-mono tabular-nums" : "h-11"}
      />
      {p.ayuda ? <FieldDescription>{p.ayuda}</FieldDescription> : null}
    </Field>
  );
}
