// Revisión de seguridad (2026-10-18): remitentes simulados, archivo original y el webhook de WhatsApp sin firma.

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as enlaceTelegram } from "@/app/api/canales/telegram/enlace/route";
import { POST as enlaceWhatsapp } from "@/app/api/canales/whatsapp/enlace/route";
import { POST as simularWhatsapp } from "@/app/api/canales/whatsapp/simular/route";
import { GET as getArchivo } from "@/app/api/documentos/[ref]/archivo/route";
import { confiarRemitenteSimulado } from "@/app/api/_identidad";

import { CUENTA, comoCuenta, comoSesion, peticion, repoProcesado } from "./ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

afterEach(() => vi.unstubAllEnvs());

describe("remitente de un /simular", () => {
  it("solo se cree en modo demo y si quien llama es administrador", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO", "1");
    expect(confiarRemitenteSimulado({ ...CUENTA, rol: "admin" })).toBe(true);
    expect(confiarRemitenteSimulado({ ...CUENTA, rol: "tesoreria" })).toBe(false);
    expect(confiarRemitenteSimulado({ ...CUENTA, rol: "aprobador" })).toBe(false);
    vi.stubEnv("DEMO", "");
    expect(confiarRemitenteSimulado({ ...CUENTA, rol: "admin" })).toBe(false);
  });

  it("tesorería en modo demo no puede hacerse pasar por el WhatsApp de un proveedor: queda sin verificar", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO", "1");
    const repo = await repoProcesado();
    comoCuenta("Tere", "tesoreria");
    const mensaje = { from: "573001112233", id: "wamid.x", type: "text", text: { body: "Factura JPO-99 por USD 900, cuenta 8812" } };
    const res = await simularWhatsapp(peticion("http://x/api/canales/whatsapp/simular", { method: "POST", body: JSON.stringify({ mensaje }), headers: { "content-type": "application/json" } }), {});
    const r = await res.json();
    expect(res.status).toBe(201);
    expect((await repo.documento(r.ref_interna))?.remitente.valor).toBe("no-verificado:573001112233");
    expect(r.estado).not.toBe("PAGAR");
  });
});

describe("enlaces para vincular un chat o un WhatsApp a un proveedor", () => {
  it("solo un administrador los genera: un aprobador o tesorería recibe 403 (si no, vincularía su propio chat y cobraría)", async () => {
    vi.stubEnv("TELEGRAM_BOT_USUARIO", "bot_prueba");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "secreto-de-prueba-0123456789");
    vi.stubEnv("WHATSAPP_NUMERO", "15551958819");
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verificar-0123456789");
    await repoProcesado();
    const pedir = (ruta: typeof enlaceTelegram, url: string) =>
      ruta(peticion(url, { method: "POST", body: JSON.stringify({ beneficiario_id: "ben-diego-herrera" }), headers: { "content-type": "application/json" } }), {});
    for (const rol of ["tesoreria", "aprobador"] as const) {
      comoCuenta(`Persona ${rol}`, rol);
      expect((await pedir(enlaceTelegram, "http://x/api/canales/telegram/enlace")).status).toBe(403);
      expect((await pedir(enlaceWhatsapp, "http://x/api/canales/whatsapp/enlace")).status).toBe(403);
    }
    comoSesion(CUENTA);
    expect((await pedir(enlaceTelegram, "http://x/api/canales/telegram/enlace")).status).toBe(201);
    expect((await pedir(enlaceWhatsapp, "http://x/api/canales/whatsapp/enlace")).status).toBe(201);
  });
});

describe("archivo original", () => {
  it("un adjunto declarado SVG o HTML se descarga, nunca se muestra en línea", async () => {
    const repo = await repoProcesado();
    comoSesion(CUENTA);
    const ref = "INT-2026-000001";
    for (const mime of ["image/svg+xml", "text/html"]) {
      await repo.guardarArchivo(ref, { nombre: "x", mime, bytes: Buffer.from("<svg onload=alert(1)>") });
      const res = await getArchivo(peticion(`http://x/api/documentos/${ref}/archivo`), { params: Promise.resolve({ ref }) } as RouteContext<"/api/documentos/[ref]/archivo">);
      expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
      expect(res.headers.get("content-security-policy")).toContain("sandbox");
    }
  });
});
