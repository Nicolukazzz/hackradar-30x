import { cookies } from "next/headers";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  // La barra lateral guarda si quedó abierta en la cookie `sidebar_state` (componente Sidebar de shadcn).
  const abierta = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={abierta}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 md:px-10 md:py-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
