import { describe, expect, it, vi } from "vitest";

import { DELETE as deleteInvitacion } from "@/app/api/equipo/invitaciones/[id]/route";
import { POST as postInvitacion } from "@/app/api/equipo/invitaciones/route";
import { DELETE as deleteMiembro, PATCH as patchMiembro } from "@/app/api/equipo/miembros/[id]/route";
import { GET as getEquipo } from "@/app/api/equipo/route";
import { aceptar } from "@/equipo/servicio";

import { CUENTA, comoCuenta, comoSesion, equipoActual, peticion, repoProcesado } from "./ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

const invitarCon = (body: unknown) => postInvitacion(peticion("http://x/api/equipo/invitaciones", { method: "POST", body: JSON.stringify(body) }));
const ctxMiembro = (id: string) => ({ params: Promise.resolve({ id }) }) as RouteContext<"/api/equipo/miembros/[id]">;
const ctxInvitacion = (id: string) => ({ params: Promise.resolve({ id }) }) as RouteContext<"/api/equipo/invitaciones/[id]">;
const patch = (id: string, body: unknown) => patchMiembro(peticion(`http://x/api/equipo/miembros/${id}`, { method: "PATCH", body: JSON.stringify(body) }), ctxMiembro(id));

describe("/api/equipo (#51)", () => {
  it("solo un admin ve el equipo, invita y cambia roles; aprobador y tesorería → 403; sin sesión → 401", async () => {
    await repoProcesado();
    for (const rol of ["aprobador", "tesoreria"] as const) {
      comoCuenta(`Persona ${rol}`, rol);
      expect((await getEquipo(peticion("http://x/api/equipo"))).status).toBe(403);
      expect((await invitarCon({ rol: "admin", correo_esperado: "x@y.example" })).status).toBe(403);
      expect((await patch(CUENTA.usuario_id, { rol: "tesoreria" })).status).toBe(403);
    }
    comoSesion(null);
    expect((await getEquipo(peticion("http://x/api/equipo"))).status).toBe(401);
  });

  it("admin invita → enlace /unirse/<token>; la persona acepta y aparece en el equipo con su rol", async () => {
    await repoProcesado();
    const res = await invitarCon({ rol: "aprobador", limite_aprobacion_usd: 500000, correo_esperado: "nueva@x.example" });
    expect(res.status).toBe(201);
    const { invitacion, enlace, correo_enviado } = await res.json();
    expect(correo_enviado).toBe(false); // sin buzón configurado en tests: la pantalla muestra el enlace
    expect(enlace).toMatch(/^http:\/\/localhost:3000\/unirse\/[A-Za-z0-9_-]{43}$/);
    expect(invitacion).not.toHaveProperty("token_hash");
    equipoActual().agregarCuenta({ usuario_id: "u-nueva", nombre: "Nueva", correo: "nueva@x.example" });
    const nueva = { usuario_id: "u-nueva", correo: "nueva@x.example", nombre: "Nueva", rol: null, limite_aprobacion_usd: null };
    expect(await aceptar(equipoActual(), enlace.split("/unirse/")[1], nueva)).toBe("aceptada");
    const equipo = await (await getEquipo(peticion("http://x/api/equipo"))).json();
    expect(equipo.miembros.map((m: { usuario_id: string; rol: string }) => [m.usuario_id, m.rol])).toEqual([["u-ana", "admin"], ["u-nueva", "aprobador"]]);
    expect(equipo.invitaciones[0]).toMatchObject({ id: invitacion.id, estado: "usada" });
    expect(JSON.stringify(equipo)).not.toContain("token");
  });

  it("cuerpo inválido → 400; revocar dos veces → 404; el único admin no se baja de rol ni se quita (409)", async () => {
    await repoProcesado();
    expect((await invitarCon({ rol: "dueño" })).status).toBe(400);
    expect((await invitarCon({ rol: "aprobador", dias_vigencia: 90, correo_esperado: "x@y.example" })).status).toBe(400);
    expect((await invitarCon({ rol: "tesoreria" })).status).toBe(400); // #80: sin correo no se crea
    const { invitacion } = await (await invitarCon({ rol: "tesoreria", correo_esperado: "t@y.example" })).json();
    const revocarla = () => deleteInvitacion(peticion(`http://x/api/equipo/invitaciones/${invitacion.id}`, { method: "DELETE" }), ctxInvitacion(invitacion.id));
    expect((await revocarla()).status).toBe(200);
    expect((await revocarla()).status).toBe(404);
    const r = await patch(CUENTA.usuario_id, { rol: "aprobador" });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("al menos un administrador");
    const quitar = await deleteMiembro(peticion(`http://x/api/equipo/miembros/${CUENTA.usuario_id}`, { method: "DELETE" }), ctxMiembro(CUENTA.usuario_id));
    expect(quitar.status).toBe(409);
  });

  it("admin cambia a otra persona de aprobador a tesorería y la quita; después esa cuenta no ve nada", async () => {
    await repoProcesado();
    comoCuenta("Beto Ruiz", "aprobador", 500000);
    comoSesion(CUENTA);
    expect(await (await patch("u-beto-ruiz", { rol: "tesoreria" })).json()).toMatchObject({ rol: "tesoreria", limite_aprobacion_usd: null });
    const quitar = await deleteMiembro(peticion("http://x/api/equipo/miembros/u-beto-ruiz", { method: "DELETE" }), ctxMiembro("u-beto-ruiz"));
    expect(quitar.status).toBe(200);
    expect((await equipoActual().miembros("nebula")).map((m) => m.usuario_id)).toEqual(["u-ana"]);
  });
});
