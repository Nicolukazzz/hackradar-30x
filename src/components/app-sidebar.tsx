"use client";

import { HourglassIcon, InboxIcon, LogOutIcon, SettingsIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, use } from "react";
import { usePathname } from "next/navigation";

import { salir } from "@/app/entrar/acciones";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NOMBRE_ROL, type Rol } from "@/lib/auth/permisos";
import { iniciales } from "@/lib/iniciales";
import { cn } from "@/lib/utils";

// Barra lateral de especificación §13 "Comunes". #83: Reglas y Equipo pasan dentro de Ajustes. #119: arriba va la
// empresa que usa la app (no un nombre de producto) y abajo solo quién está conectado.
const navegacion = [
  { titulo: "Bandeja", href: "/", icono: InboxIcon },
  { titulo: "Pendientes", href: "/pendientes", icono: HourglassIcon },
  { titulo: "Proveedores", href: "/proveedores", icono: UsersIcon },
  { titulo: "Ajustes", href: "/ajustes", icono: SettingsIcon },
] as const;

/** La empresa que usa la app, arriba de todo. La comparten la barra lateral y la cabecera móvil. */
export function MarcaEmpresa({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground"
      >
        {iniciales(nombre)}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[16px] leading-tight font-semibold tracking-tight text-balance">{nombre}</span>
        <span className="text-xs text-sidebar-muted">Cuentas por pagar</span>
      </span>
    </div>
  );
}

/** Badge ámbar con el conteo. Lee la promesa del layout: la página no espera a la API para pintarse. */
function BadgePendientes({ pendientes }: { pendientes: Promise<number | null> }) {
  const n = use(pendientes);
  if (!n) return null;
  return (
    <>
      <span className="sr-only">, {n} pendientes</span>
      <span
        aria-hidden
        className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-aviso px-1.5 font-mono text-xs font-bold text-aviso-foreground"
      >
        {n}
      </span>
    </>
  );
}

export function AppSidebar({
  usuario,
  empresa,
  pendientes,
}: {
  usuario: { nombre: string; correo: string; rol: Rol };
  /** #84: de la base (Ajustes → Datos de la empresa); null si no se pudo leer */
  empresa: { nombre: string } | null;
  pendientes: Promise<number | null>;
}) {
  const ruta = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-6 pb-0">
        <MarcaEmpresa nombre={empresa?.nombre ?? "Tu empresa"} className="px-2" />
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 pt-6">
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <nav aria-label="Principal">
              <SidebarMenu className="gap-1">
                {navegacion.map(({ titulo, href, icono: Icono }) => {
                  // El registro de auditoría y la factura completa se abren desde la Bandeja (#131): siguen marcando «Bandeja».
                  const activa = href === "/" ? ruta === "/" || ruta.startsWith("/registro") || ruta.startsWith("/facturas") : ruta.startsWith(href);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={activa}
                        className="h-11 gap-3 rounded-[10px] px-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-[18px]"
                        render={
                          <Link
                            href={href}
                            aria-current={activa ? "page" : undefined}
                            onClick={() => setOpenMobile(false)}
                          />
                        }
                      >
                        <Icono aria-hidden />
                        <span className="flex-1">{titulo}</span>
                        {activa ? <span aria-hidden className="size-1.5 rounded-full bg-sidebar-primary" /> : null}
                        {href === "/pendientes" ? (
                          <Suspense fallback={null}>
                            <BadgePendientes pendientes={pendientes} />
                          </Suspense>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-5">
        {/* Identidad desde la sesión (#25). Nada se corta: el correo baja de línea si no cabe. */}
        <div className="flex flex-col gap-3 rounded-2xl bg-sidebar-card p-3.5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[13px] font-semibold text-sidebar-accent-foreground"
            >
              {iniciales(usuario.nombre)}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm leading-tight font-semibold break-words text-sidebar-foreground">{usuario.nombre}</span>
              <span className="w-fit rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-medium text-sidebar-accent-foreground">
                {NOMBRE_ROL[usuario.rol]}
              </span>
              <span className="text-xs leading-snug break-all text-sidebar-muted">{usuario.correo}</span>
            </span>
          </div>
          <form action={salir}>
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-[13px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
            >
              <LogOutIcon className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
