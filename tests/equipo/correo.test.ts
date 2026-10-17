// Crear empleado (#80): plantilla del correo, envío inyectado y reenvío.

import { describe, expect, it, vi } from "vitest";

import { correoInvitacion } from "@/equipo/correo";
import { crearAlmacenEquipoMemoria } from "@/equipo/memoria";
import { crearEmpleado, reenviar, vistaInvitacion } from "@/equipo/servicio";
import { EMPRESA_ID } from "@/equipo/tipos";
import type { Sesion } from "@/lib/auth/permisos";

const AHORA = "2026-10-17T10:00:00-05:00";
const ADMIN: Sesion = { usuario_id: "u-admin", correo: "admin@empresa.example", nombre: "Laura Méndez", rol: "admin", limite_aprobacion_usd: null };

function almacen() {
  const a = crearAlmacenEquipoMemoria({ ahora: () => AHORA });
  a.agregarCuenta({ usuario_id: ADMIN.usuario_id, nombre: ADMIN.nombre, correo: ADMIN.correo });
  a.agregarMiembro(EMPRESA_ID, ADMIN.usuario_id, "admin");
  return a;
}

describe("correo de invitación (#80)", () => {
  const c = correoInvitacion({ empresa: "Acme <S.A.>", rol: "aprobador", invitador: "Laura", enlace: "https://app.example/unirse/abc", expira_en: "2026-10-20T15:00:00.000Z" });

  it("formal, con empresa, rol, enlace y vencimiento en hora de Bogotá; texto y HTML", () => {
    expect(c.asunto).toBe("Acme <S.A.>: crea tu cuenta en el agente de cuentas por pagar");
    expect(c.texto).toContain("con el rol de Aprobador");
    expect(c.texto).toContain("https://app.example/unirse/abc");
    expect(c.texto).toContain("20 de octubre de 2026");
    expect(c.html).toContain('href="https://app.example/unirse/abc"');
    expect(c.html).toContain("Crear mi cuenta");
  });

  it("escapa el HTML de los nombres", () => {
    expect(c.html).toContain("Acme &lt;S.A.&gt;");
    expect(c.html).not.toContain("<S.A.>");
  });
});

describe("crearEmpleado y reenviar (#80)", () => {
  it("crea la invitación con el correo y lo envía a esa dirección; si el envío falla, igual devuelve el enlace", async () => {
    const a = almacen();
    const enviar = vi.fn<(para: string, correo: { texto: string }, remitente: string) => Promise<boolean>>(async () => true);
    const r = await crearEmpleado(a, ADMIN, { rol: "tesoreria", correo_esperado: "Nuevo@Empresa.example" }, AHORA, { empresa: "Acme", enviar });
    expect(r.correo_enviado).toBe(true);
    expect(enviar).toHaveBeenCalledWith("nuevo@empresa.example", expect.objectContaining({ asunto: expect.stringContaining("Acme") }), "Acme");
    expect(enviar.mock.calls[0]?.[1]?.texto).toContain(r.enlace);

    const fallo = await crearEmpleado(a, ADMIN, { rol: "tesoreria", correo_esperado: "otro@empresa.example" }, AHORA, {
      empresa: "Acme",
      enviar: async () => {
        throw new Error("SMTP caído");
      },
    });
    expect(fallo).toMatchObject({ correo_enviado: false, enlace: expect.stringContaining("/unirse/") });
  });

  it("reenviar revoca el enlace anterior y manda uno nuevo al mismo correo", async () => {
    const a = almacen();
    const deps = { empresa: "Acme", enviar: vi.fn(async () => true) };
    const primero = await crearEmpleado(a, ADMIN, { rol: "aprobador", limite_aprobacion_usd: 300000, correo_esperado: "x@empresa.example" }, AHORA, deps);
    const segundo = await reenviar(a, ADMIN, primero.invitacion.id, AHORA, deps);
    expect(segundo.invitacion).toMatchObject({ rol: "aprobador", limite_aprobacion_usd: 300000, correo_esperado: "x@empresa.example" });
    expect(segundo.enlace).not.toBe(primero.enlace);
    expect(await vistaInvitacion(a, primero.enlace.split("/unirse/")[1] ?? "", AHORA)).toBeNull();
    expect(await vistaInvitacion(a, segundo.enlace.split("/unirse/")[1] ?? "", AHORA)).toMatchObject({ correo_esperado: "x@empresa.example" });
  });
});
