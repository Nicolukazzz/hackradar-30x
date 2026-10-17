import { describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "@/app/api/empresa/route";
import { obtenerRepositorio } from "@/repositorio";

import { comoCuenta, comoSesion, peticion, repoProcesado } from "./ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

const cambiar = (body: unknown) => PATCH(peticion("http://x/api/empresa", { method: "PATCH", body: JSON.stringify(body) }));

describe("/api/empresa (#84)", () => {
  it("cualquier miembro la ve; solo un admin la cambia; sin sesión 401", async () => {
    await repoProcesado();
    comoCuenta("Teo", "tesoreria");
    expect((await (await GET(peticion("http://x/api/empresa"))).json()).nombre).toBe("Nébula Studio Inc.");
    expect((await cambiar({ nombre: "Otra" })).status).toBe(403);
    comoSesion(null);
    expect((await GET(peticion("http://x/api/empresa"))).status).toBe(401);
  });

  it("admin cambia el nombre: queda en la empresa y una entrada CAMBIO_EMPRESA en el registro", async () => {
    const repo = await repoProcesado();
    const antes = (await repo.registro()).length;
    const res = await cambiar({ nombre: "Orbita Labs Inc.", paises_operacion: ["US", "CL"] });
    expect(res.status).toBe(200);
    const { empresa, entrada } = await res.json();
    expect(empresa).toMatchObject({ nombre: "Orbita Labs Inc.", paises_operacion: ["US", "CL"], jurisdiccion: "Delaware, EE. UU." });
    expect(entrada).toMatchObject({ tipo: "CAMBIO_EMPRESA", ref_interna: "CONFIG-EMPRESA-NEBULA", actor: { tipo: "humano" } });
    expect(entrada.explicacion).toContain("cambió el nombre de «Nébula Studio Inc.» a «Orbita Labs Inc.» y los países de operación");
    const r = await obtenerRepositorio();
    expect((await r.registro()).length).toBe(antes + 1);
    expect((await r.datosComunes()).empresa.nombre).toBe("Orbita Labs Inc.");
  });

  it("sin cambios real: no escribe en el registro; cuerpo inválido 400", async () => {
    const repo = await repoProcesado();
    const antes = (await repo.registro()).length;
    expect((await (await cambiar({ nombre: "Nébula Studio Inc." })).json()).entrada).toBeNull();
    expect((await repo.registro()).length).toBe(antes);
    expect((await cambiar({})).status).toBe(400);
    expect((await cambiar({ moneda_base: "COP" })).status).toBe(400);
    expect((await cambiar({ paises_operacion: ["XX"] })).status).toBe(400);
  });
});
