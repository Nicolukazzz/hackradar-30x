import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { contarPendientes } from "@/app/_datos/aprobaciones";
import { AppSidebar, MarcaTesorero } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { obtenerSesion } from "@/lib/auth/sesion";
import { obtenerEmpresa } from "@/app/_datos/empresa";
import { resumenOperacion } from "@/empresa/datos";

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  // Sin sesión (o cuenta desactivada) → /entrar. Cuenta que no es miembro de la empresa (#51) → /sin-permiso.
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/entrar");
  if (!sesion.rol) redirect("/sin-permiso");

  // La barra lateral guarda si quedó abierta en la cookie `sidebar_state` (componente Sidebar de shadcn).
  const abierta = (await cookies()).get("sidebar_state")?.value !== "false";
  // Sin await: el badge de pendientes llega por streaming (Suspense en la barra lateral) y no frena la página.
  const pendientes = contarPendientes();
  const empresa = await obtenerEmpresa();

  return (
    <SidebarProvider defaultOpen={abierta}>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-[10px] bg-brand px-4 py-3 font-semibold text-brand-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <AppSidebar
        usuario={{ nombre: sesion.nombre, correo: sesion.correo, rol: sesion.rol }}
        empresa={empresa ? { nombre: empresa.nombre, resumen: resumenOperacion(empresa) } : null}
        pendientes={pendientes}
      />
      {/* Equivale a SidebarInset, pero como div: así la cabecera móvil es un banner propio y <main> solo tiene el contenido. */}
      <div data-slot="sidebar-inset" className="relative flex w-full min-w-0 flex-1 flex-col bg-background">
        {/* En móvil la barra lateral se vuelve menú superior: marca + botón que abre el panel. */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-sidebar px-4 text-sidebar-foreground md:hidden">
          <MarcaTesorero />
          <SidebarTrigger
            aria-label="Abrir menú"
            className="size-11 rounded-[10px] text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:size-5"
          />
        </header>
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pt-6 pb-12 outline-none md:px-8 md:pt-7"
        >
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
