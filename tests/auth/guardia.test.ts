import { describe, expect, it, vi } from "vitest";

import { crearGuardia, type EventoAuditoria } from "@/lib/auth/guardia";
import { ErrorAuth, type Sesion } from "@/lib/auth/permisos";

const cuenta: Sesion = { usuario_id: "u-1", correo: "ana@empresa.example", nombre: "Ana", rol: "admin", limite_aprobacion_usd: null };

function preparar(sesion: Sesion | null) {
  const eventos: EventoAuditoria[] = [];
  const { conSesion } = crearGuardia({ obtenerSesion: async () => sesion, auditar: (e) => eventos.push(e) });
  const manejador = vi.fn(async (_req: Request, _ctx: unknown, s: Sesion) => Response.json({ nombre: s.nombre }));
  return { eventos, manejador, ruta: conSesion(manejador) };
}

const ctx = { params: Promise.resolve({}) };

describe("conSesion", () => {
  it("sin sesión → 401 y no llama al manejador", async () => {
    const { ruta, manejador, eventos } = preparar(null);
    const res = await ruta(new Request("http://app.test/api/x"), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Inicia sesión para continuar." });
    expect(manejador).not.toHaveBeenCalled();
    expect(eventos).toEqual([{ tipo: "401", usuario_id: null, ruta: "/api/x" }]);
  });


  it("con sesión pasa la sesión al manejador", async () => {
    const { ruta, manejador } = preparar(cuenta);
    const res = await ruta(new Request("http://app.test/api/x"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nombre: "Ana" });
    expect(manejador.mock.calls[0]?.[2]).toBe(cuenta);
  });

  it("#51: cuenta sin empresa → 403 con motivo y no llama al manejador", async () => {
    const { ruta, manejador, eventos } = preparar({ ...cuenta, rol: null });
    const res = await ruta(new Request("http://app.test/api/x"), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("no pertenece a la empresa");
    expect(manejador).not.toHaveBeenCalled();
    expect(eventos[0]).toMatchObject({ tipo: "403", usuario_id: "u-1" });
  });

  it("#51: permiso de la ruta según el rol (tesorería no aprueba; aprobador no edita reglas)", async () => {
    const eventos: EventoAuditoria[] = [];
    const conRol = (rol: Sesion["rol"]) => crearGuardia({ obtenerSesion: async () => ({ ...cuenta, rol }), auditar: (e) => eventos.push(e) }).conSesion;
    const ok = async () => Response.json({ ok: true });
    const pedir = () => new Request("http://app.test/api/x");
    expect((await conRol("tesoreria")(ok, { permiso: "aprobar" })(pedir(), ctx)).status).toBe(403);
    expect((await conRol("tesoreria")(ok)(pedir(), ctx)).status).toBe(200);
    expect((await conRol("aprobador")(ok, { permiso: "aprobar" })(pedir(), ctx)).status).toBe(200);
    expect((await conRol("aprobador")(ok, { permiso: "editar_reglas" })(pedir(), ctx)).status).toBe(403);
    expect((await conRol("admin")(ok, { permiso: "administrar" })(pedir(), ctx)).status).toBe(200);
  });

  it("POST con Origin ajeno → 403 (CSRF)", async () => {
    const { ruta, manejador } = preparar(cuenta);
    const req = new Request("http://app.test/api/x", { method: "POST", headers: { origin: "https://malo.example" } });
    const res = await ruta(req, ctx);
    expect(res.status).toBe(403);
    expect(manejador).not.toHaveBeenCalled();
  });

  it("POST sin Origin → 403", async () => {
    const { ruta } = preparar(cuenta);
    const res = await ruta(new Request("http://app.test/api/x", { method: "POST" }), ctx);
    expect(res.status).toBe(403);
  });

  it("POST del mismo origen pasa", async () => {
    const { ruta } = preparar(cuenta);
    const req = new Request("http://app.test/api/x", { method: "POST", headers: { origin: "http://app.test" } });
    expect((await ruta(req, ctx)).status).toBe(200);
  });

  it("POST detrás de proxy usa x-forwarded-host", async () => {
    const { ruta } = preparar(cuenta);
    const req = new Request("http://10.0.0.5:8080/api/x", {
      method: "POST",
      headers: { origin: "https://web.example", "x-forwarded-host": "web.example" },
    });
    expect((await ruta(req, ctx)).status).toBe(200);
  });

  it("ErrorAuth lanzado dentro del manejador (p. ej. regla del dominio) → su status", async () => {
    const eventos: EventoAuditoria[] = [];
    const { conSesion } = crearGuardia({ obtenerSesion: async () => cuenta, auditar: (e) => eventos.push(e) });
    const ruta = conSesion(async () => {
      throw new ErrorAuth(403, "Supera tu límite de aprobación");
    });
    const res = await ruta(new Request("http://app.test/api/aprobaciones/INT-1"), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Supera tu límite de aprobación" });
    expect(eventos).toEqual([
      { tipo: "403", usuario_id: "u-1", ruta: "/api/aprobaciones/INT-1", motivo: "Supera tu límite de aprobación" },
    ]);
  });

  it("otros errores del manejador no se tragan", async () => {
    const { conSesion } = crearGuardia({ obtenerSesion: async () => cuenta, auditar: () => {} });
    const ruta = conSesion(async () => {
      throw new Error("boom");
    });
    await expect(ruta(new Request("http://app.test/api/x"), ctx)).rejects.toThrow("boom");
  });
});
