import { LinkIcon, UserPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { formatearUsd } from "@/dominio/dinero";
import { salir } from "@/app/entrar/acciones";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { obtenerAlmacenEquipo } from "@/equipo";
import { vistaInvitacion } from "@/equipo/servicio";
import { DESCRIPCION_ROL, NOMBRE_ROL } from "@/lib/auth/permisos";
import { obtenerSesion } from "@/lib/auth/sesion";
import { relojSistema } from "@/lib/reloj-sistema";

import { unirme } from "./acciones";

export const metadata: Metadata = { title: "Unirme al equipo · Agente de cuentas por pagar", referrer: "no-referrer" };

// Enlace de invitación (#51). Sin sesión, el proxy manda a /entrar y vuelve aquí. Un enlace inválido, vencido,
// revocado o usado muestra la misma página: no se dice cuál de los cuatro.
const MENSAJES: Record<string, string> = {
  invalida: "Este enlace ya no sirve: venció, se usó o lo revocaron. Pide uno nuevo a quien te invitó.",
  otro_correo: "Esta invitación es para otra cuenta. Sal y entra con el correo al que te invitaron.",
  ya_miembro: "Tu cuenta ya pertenece a la empresa. Si necesitas otro rol, pídeselo a un administrador.",
};

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Empty className="max-w-md flex-none rounded-2xl border bg-card py-14">{children}</Empty>
    </main>
  );
}

function SalirBoton({ texto }: { texto: string }) {
  return (
    <form action={salir}>
      <Button type="submit" variant="ghost" className="h-11 px-4">
        {texto}
      </Button>
    </form>
  );
}

export default async function PaginaUnirse({ params, searchParams }: PageProps<"/unirse/[token]">) {
  const [{ token }, sp, sesion] = await Promise.all([params, searchParams, obtenerSesion()]);
  const resultado = typeof sp.resultado === "string" ? sp.resultado : null;

  if (sesion?.rol) {
    return (
      <Marco>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserPlusIcon />
          </EmptyMedia>
          <EmptyTitle>Ya eres parte del equipo</EmptyTitle>
          <EmptyDescription>
            Tu cuenta ({sesion.correo}) está en Nébula Studio como {NOMBRE_ROL[sesion.rol]}. Este enlace no cambia tu rol.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/" className={buttonVariants({ className: "h-11 px-5" })}>
            Ir al panel
          </Link>
        </EmptyContent>
      </Marco>
    );
  }

  const vista = await vistaInvitacion(await obtenerAlmacenEquipo(), token, relojSistema().ahora());
  if (!vista || !sesion) {
    return (
      <Marco>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LinkIcon />
          </EmptyMedia>
          <EmptyTitle>Este enlace no es válido</EmptyTitle>
          <EmptyDescription>{MENSAJES.invalida}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{sesion ? <SalirBoton texto="Salir" /> : null}</EmptyContent>
      </Marco>
    );
  }

  const limite = vista.rol === "aprobador" ? (vista.limite_aprobacion_usd === null ? "sin límite de monto" : `hasta USD ${formatearUsd(vista.limite_aprobacion_usd)} por pago`) : null;
  const error = resultado ? (MENSAJES[resultado] ?? MENSAJES.invalida) : null;

  return (
    <Marco>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UserPlusIcon />
        </EmptyMedia>
        <EmptyTitle>Te invitaron a Nébula Studio Inc.</EmptyTitle>
        <EmptyDescription>
          Rol: <strong className="font-semibold text-foreground">{NOMBRE_ROL[vista.rol]}</strong>
          {limite ? `, ${limite}` : ""}. {DESCRIPCION_ROL[vista.rol]}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="gap-3">
        <p className="text-sm text-muted-foreground">
          Te unirás con <span className="font-medium text-foreground">{sesion.correo}</span>.
        </p>
        {error ? (
          <p role="alert" className="rounded-[10px] bg-frenada px-3 py-2 text-sm text-frenada-foreground">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <form action={unirme.bind(null, token)}>
            <Button type="submit" className="h-11 px-5">
              Unirme al equipo
            </Button>
          </form>
          <SalirBoton texto="No es mi cuenta" />
        </div>
      </EmptyContent>
    </Marco>
  );
}
