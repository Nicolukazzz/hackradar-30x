import { BanknoteIcon, Building2Icon, KeyRoundIcon, MailIcon, SendIcon, SlidersHorizontalIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";

import { FilaAjuste, GrupoAjustes } from "@/app/_componentes/ajustes";
import { obtenerEmpresa } from "@/app/_datos/empresa";
import { exigirMiembro } from "@/app/_datos/sesion";
import { iniciales } from "@/lib/iniciales";
import { NOMBRE_ROL, puede } from "@/lib/auth/permisos";

export const metadata: Metadata = { title: "Ajustes" };

// Ajustes (#83), estilo iPhone: grupos de filas; cada una abre su pantalla por pasos.

/** Variable de entorno sin espacios; vacía cuenta como ausente. */
function variable(nombre: string): string | undefined {
  return process.env[nombre]?.trim() || undefined;
}

export default async function AjustesPage() {
  const sesion = await exigirMiembro();
  const empresa = await obtenerEmpresa();
  const admin = puede(sesion, "administrar");
  // Un canal cuenta como conectado solo si están su nombre y su secreto (sin la clave, el sondeo IMAP no arranca).
  const correo = variable("CORREO_IMAP_CLAVE") ? variable("CORREO_IMAP_USUARIO") : undefined;
  const bot = variable("TELEGRAM_BOT_TOKEN") ? variable("TELEGRAM_BOT_USUARIO")?.replace(/^@/, "") : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-7">
      <h1 className="text-[30px] leading-tight font-semibold tracking-tight">Ajustes</h1>

      {/* Tarjeta de la persona, como la cabecera de Ajustes del iPhone. */}
      <section aria-label="Tu cuenta" className="flex items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {iniciales(sesion.nombre || sesion.correo)}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-lg leading-tight font-semibold break-words">{sesion.nombre || "Sin nombre"}</span>
          <span className="text-sm break-all text-muted-foreground">{sesion.correo}</span>
          {sesion.rol ? <span className="mt-1 w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{NOMBRE_ROL[sesion.rol]}</span> : null}
        </span>
      </section>

      <div className="flex flex-col gap-7">
        <GrupoAjustes titulo="Cuenta">
          <FilaAjuste icono={KeyRoundIcon} color="gris" titulo="Contraseña" valor="Cambiar" href="/ajustes/perfil/contrasena" />
        </GrupoAjustes>

        <GrupoAjustes titulo="Empresa" pie={admin ? undefined : "Solo un administrador cambia las reglas y el equipo."}>
          <FilaAjuste icono={Building2Icon} color="azul" titulo="Datos de la empresa" valor={empresa?.nombre} href="/ajustes/empresa" />
          <FilaAjuste icono={BanknoteIcon} color="verde" titulo="Moneda y tasas" valor={empresa?.moneda_base} href="/ajustes/moneda" />
          <FilaAjuste icono={SlidersHorizontalIcon} color="ambar" titulo="Reglas de pago" valor={puede(sesion, "editar_reglas") ? undefined : "Solo ver"} href="/ajustes/reglas" />
          {admin ? <FilaAjuste icono={UsersIcon} titulo="Equipo" href="/ajustes/equipo" /> : null}
        </GrupoAjustes>

        <GrupoAjustes titulo="Canales" pie="Por donde los proveedores mandan sus facturas. Los configura el equipo técnico.">
          <FilaAjuste icono={MailIcon} color="azul" titulo="Correo" valor={correo ?? "Sin configurar"} />
          <FilaAjuste icono={SendIcon} color="azul" titulo="Telegram" valor={bot ? `@${bot}` : "Sin configurar"} />
        </GrupoAjustes>
      </div>
    </div>
  );
}
