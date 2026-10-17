"use client";

import { CircleCheckIcon, InboxIcon, ListIcon, LogOutIcon, SendIcon, SettingsIcon, ShieldCheckIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

// Barra lateral de especificación §13 "Comunes", con el aspecto del prototipo.
// #83: Reglas y Equipo pasan dentro de Ajustes.
const navegacion = [
  { titulo: "Bandeja", href: "/", icono: InboxIcon },
  { titulo: "Aprobaciones", href: "/aprobaciones", icono: CircleCheckIcon },
  { titulo: "Registro", href: "/registro", icono: ListIcon },
  { titulo: "Proveedores", href: "/proveedores", icono: SendIcon },
  { titulo: "Ajustes", href: "/ajustes", icono: SettingsIcon },
] as const;

/** Logo + rol. Lo comparten la barra lateral y la cabecera móvil. */
export function MarcaTesorero({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sidebar-primary text-sidebar-primary-foreground">
        <ShieldCheckIcon className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[17px] leading-tight font-semibold tracking-tight">Tesorero</span>
        <span className="text-xs text-sidebar-muted">Agente de cuentas por pagar</span>
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
  empresa: { nombre: string; resumen: string } | null;
  pendientes: Promise<number | null>;
}) {
  const ruta = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-6 pb-0">
        <MarcaTesorero className="px-2" />
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 pt-5">
        {empresa ? (
          <SidebarGroup className="pb-5">
            <div className="flex flex-col gap-1 rounded-xl border border-sidebar-border px-3.5 py-3">
              <span className="text-[11px] tracking-[0.08em] text-sidebar-muted uppercase">Empresa</span>
              <span className="text-sm font-semibold">{empresa.nombre}</span>
              <span className="text-xs text-sidebar-muted">{empresa.resumen}</span>
            </div>
          </SidebarGroup>
        ) : null}

        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <nav aria-label="Principal">
              <SidebarMenu className="gap-1">
                {navegacion.map(({ titulo, href, icono: Icono }) => {
                  const activa = href === "/" ? ruta === "/" : ruta.startsWith(href);
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
                        {href === "/aprobaciones" ? (
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

      <SidebarFooter className="gap-3 px-4 pb-6">
        <div className="flex flex-col gap-2.5 rounded-xl bg-sidebar-card p-3.5">
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <span aria-hidden className="size-2 rounded-full bg-sidebar-primary" />
            Agente activo
          </span>
          <p className="text-xs leading-normal text-sidebar-muted">
            Reglas v7 · solo decide, nunca mueve dinero. Prototipo para el Reto Blinka.
          </p>
        </div>

        {/* Identidad desde la sesión (#25): nada de "actuar como". */}
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-sidebar-foreground">{usuario.nombre}</span>
            <span className="truncate text-xs text-sidebar-muted">
              {NOMBRE_ROL[usuario.rol]} · {usuario.correo}
            </span>
          </span>
          <form action={salir}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOutIcon className="size-4" aria-hidden />
              Salir
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
