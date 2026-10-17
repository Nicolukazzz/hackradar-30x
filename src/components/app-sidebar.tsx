"use client";

import { InboxIcon, ScrollTextIcon, SlidersHorizontalIcon, UserCheckIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  SidebarSeparator,
} from "@/components/ui/sidebar";

// Navegación de especificación §13. Los conteos (badge de Aprobaciones) los agrega #6.
const navegacion = [
  { titulo: "Bandeja", href: "/", icono: InboxIcon },
  { titulo: "Aprobaciones", href: "/aprobaciones", icono: UserCheckIcon },
  { titulo: "Reglas", href: "/reglas", icono: SlidersHorizontalIcon },
  { titulo: "Registro", href: "/registro", icono: ScrollTextIcon },
] as const;

export function AppSidebar() {
  const ruta = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="gap-1 px-4 pt-6">
        <span className="text-xs font-medium tracking-wide text-sidebar-foreground/60 uppercase">
          Tesorero
        </span>
        <span className="text-base font-semibold tracking-tight">Agente de cuentas por pagar</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-0.5 rounded-xl bg-sidebar-accent px-3 py-3 text-sm">
            <span className="font-medium">Nébula Studio Inc.</span>
            <span className="text-sidebar-foreground/60">Delaware, EE. UU. · opera en 5 países</span>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navegacion.map(({ titulo, href, icono: Icono }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    size="lg"
                    isActive={href === "/" ? ruta === "/" : ruta.startsWith(href)}
                    render={<Link href={href} />}
                  >
                    <Icono />
                    <span>{titulo}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 px-4 pb-6">
        <span className="flex items-center gap-2 text-sm">
          <span aria-hidden className="size-2 rounded-full bg-sidebar-primary" />
          <span>Agente activo</span>
        </span>
        <SidebarSeparator className="mx-0" />
        <p className="text-xs leading-relaxed text-sidebar-foreground/60">
          Reglas v7 · solo decide, nunca mueve dinero. Prototipo para el Reto Blinka.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
