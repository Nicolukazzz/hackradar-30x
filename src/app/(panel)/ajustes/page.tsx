import { BanknoteIcon, Building2Icon, KeyRoundIcon, MailIcon, SendIcon, SlidersHorizontalIcon, UserIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";

import { FilaAjuste, GrupoAjustes } from "@/app/_componentes/ajustes";
import { obtenerEmpresa } from "@/app/_datos/empresa";
import { exigirMiembro } from "@/app/_datos/sesion";
import { NOMBRE_ROL, puede } from "@/lib/auth/permisos";

export const metadata: Metadata = { title: "Ajustes · Agente de cuentas por pagar" };

// Ajustes (#83), estilo iPhone: grupos de filas; cada una abre su pantalla por pasos. Lo que todavía no existe queda
// marcado «Próximamente» (moneda #86) para que se vea el mapa completo.

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
    <>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight">Ajustes</h1>
        <p className="text-[15px] text-muted-foreground">
          {sesion.nombre} · {sesion.rol ? NOMBRE_ROL[sesion.rol] : ""}
        </p>
      </header>

      <div className="flex max-w-[680px] flex-col gap-7">
        <GrupoAjustes titulo="Cuenta">
          <FilaAjuste icono={UserIcon} titulo={sesion.nombre || "Mi perfil"} valor={sesion.correo} />
          <FilaAjuste icono={KeyRoundIcon} color="gris" titulo="Contraseña" valor="Cambiar" href="/ajustes/perfil/contrasena" />
        </GrupoAjustes>

        <GrupoAjustes titulo="Empresa" pie={admin ? undefined : "Solo un administrador cambia las reglas y el equipo."}>
          <FilaAjuste icono={Building2Icon} color="azul" titulo="Datos de la empresa" valor={empresa?.nombre} href="/ajustes/empresa" />
          <FilaAjuste icono={BanknoteIcon} color="verde" titulo="Moneda y tasas" proximamente />
          <FilaAjuste icono={SlidersHorizontalIcon} color="ambar" titulo="Reglas de pago" valor={puede(sesion, "editar_reglas") ? undefined : "Solo ver"} href="/ajustes/reglas" />
          {admin ? <FilaAjuste icono={UsersIcon} titulo="Equipo" href="/ajustes/equipo" /> : null}
        </GrupoAjustes>

        <GrupoAjustes titulo="Canales" pie="Por donde los proveedores mandan sus facturas. Los configura el equipo técnico.">
          <FilaAjuste icono={MailIcon} color="azul" titulo="Correo" valor={correo ?? "Sin configurar"} />
          <FilaAjuste icono={SendIcon} color="azul" titulo="Telegram" valor={bot ? `@${bot}` : "Sin configurar"} />
        </GrupoAjustes>
      </div>
    </>
  );
}
