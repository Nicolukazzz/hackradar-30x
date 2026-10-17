import { describe, expect, it, vi } from "vitest";

import { GET as getMisFacturas } from "@/app/api/portal/facturas/route";
import { decidir } from "@/aprobaciones/decidir";
import { facturasDelProveedor } from "@/servicios/portal";

import { comoProveedor, comoSesion, entradaDe, peticion, repoProcesado, TESORERIA } from "../api/ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("../api/ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

const URL_PORTAL = { urlPortal: "https://portal.example/portal" };

describe("Mis facturas (#12)", () => {
  it("cada proveedor ve solo lo que mandó desde sus canales vinculados", async () => {
    const repo = await repoProcesado();
    const pixel = await facturasDelProveedor(repo, "ben-pixel-co", URL_PORTAL);
    expect(pixel.map((f) => f.factura_numero)).toEqual(["PX-77"]);
    const diego = await facturasDelProveedor(repo, "ben-diego-herrera", URL_PORTAL);
    expect(diego.map((f) => f.factura_numero).sort()).toEqual(["F-0093", "F-0101"]);
    const ana = await facturasDelProveedor(repo, "ben-ana-maria-gomez", URL_PORTAL);
    expect(ana.map((f) => f.factura_numero)).toEqual(["FAC-1041"]);
    // Servicios Ómicron no está en la lista: nadie ve OMI-3381 como propia
    for (const b of ["ben-pixel-co", "ben-diego-herrera", "ben-ana-maria-gomez"]) {
      expect((await facturasDelProveedor(repo, b, URL_PORTAL)).some((f) => f.factura_numero === "OMI-3381")).toBe(false);
    }
  });

  it("estados para el proveedor, sin reglas internas; la decisión humana reemplaza la del agente", async () => {
    const repo = await repoProcesado();
    const px = (await facturasDelProveedor(repo, "ben-pixel-co", URL_PORTAL))[0];
    expect(px).toMatchObject({ estado: "no_se_pagara", monto: { centavos: 260000, moneda: "USD" } });
    const lf = await entradaDe(repo, "LF-2026-10");
    expect((await facturasDelProveedor(repo, "ben-lucia-fernandez", URL_PORTAL))[0]?.estado).toBe("en_revision");
    await decidir({ ref: lf.ref_interna, accion: "aprobar", comentario: "Hito final revisado internamente", aprobador_id: "lm" }, { repo, ahora: "2026-10-16T15:00:00-05:00" });
    const despues = (await facturasDelProveedor(repo, "ben-lucia-fernandez", URL_PORTAL))[0];
    expect(despues?.estado).toBe("aprobada");
    expect(despues?.detalle).not.toContain("revisado internamente"); // el comentario del aprobador es interno
    for (const b of ["ben-pixel-co", "ben-diego-herrera", "ben-lucia-fernandez", "ben-estudio-sonoro"]) {
      for (const f of await facturasDelProveedor(repo, b, URL_PORTAL)) {
        expect(f.detalle).not.toMatch(/presupuesto|l[íi]mite|USD|R\d|disponible|m[áa]ximo/i);
      }
    }
  });

  it("lo recibido pero sin decisión aparece 'en revisión' (no desaparece si falló la revisión)", async () => {
    const repo = await repoProcesado();
    const { ingerir } = await import("@/ingesta/ingerir");
    const doc = await ingerir(
      { canal: "portal", remitente: { tipo: "portal", valor: "pixel.co" }, recibido_en: "2026-10-16T11:00:00-05:00", texto_mensaje: "factura nueva", adjuntos: [] },
      { repo, reloj: { ahora: () => "2026-10-16T11:00:00-05:00" } },
    );
    const pixel = await facturasDelProveedor(repo, "ben-pixel-co", URL_PORTAL);
    expect(pixel[0]).toMatchObject({ ref_interna: doc.ref_interna, estado: "en_revision", factura_numero: null });
    expect(pixel.map((f) => f.factura_numero)).toEqual([null, "PX-77"]); // más nueva primero
  });

  it("GET /api/portal/facturas: solo rol proveedor, y siempre las de su sesión", async () => {
    await repoProcesado();
    comoProveedor("ben-pixel-co");
    const res = await getMisFacturas(peticion("http://x/api/portal/facturas?beneficiario_id=ben-diego-herrera"));
    expect(res.status).toBe(200);
    expect((await res.json()).map((f: { factura_numero: string }) => f.factura_numero)).toEqual(["PX-77"]);
    comoSesion(TESORERIA);
    expect((await getMisFacturas(peticion("http://x/api/portal/facturas"))).status).toBe(403);
    comoSesion(null);
    expect((await getMisFacturas(peticion("http://x/api/portal/facturas"))).status).toBe(401);
  });
});
