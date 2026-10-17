import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { POST as postSimular } from "@/app/api/canales/correo/simular/route";
import { autenticacionDe, correoAEntrada, PREFIJO_NO_VERIFICADO } from "@/canales/correo/normalizar";
import { recibirCorreo, type ResultadoCorreo } from "@/canales/correo/recibir";
import { cargarEscenario } from "@/dominio/cargar";
import { extractorGolden } from "@/ingesta/cargar-escenario";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";

import { comoSesion, CUENTA, peticion } from "../api/ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("../api/ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));
vi.stubEnv("LLM_PROVIDER", "ninguno");

/** Resultado de un correo que sí se procesó (no automático). */
function decidido(r: ResultadoCorreo) {
  if (r.ignorado !== null) throw new Error(`ignorado: ${r.ignorado}`);
  return r;
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const AHORA = "2026-10-16T09:24:00-05:00";

describe("correo .eml → DocumentoEntrante (#14)", () => {
  it("los 5 correos del lote demo dan lo mismo que su .meta.json (remitente, asunto, cuerpo y adjunto)", async () => {
    const esc = await cargarEscenario("lote-demo-oct");
    const correos = esc.documentos.filter((d) => d.archivo_original.endsWith(".eml"));
    expect(correos).toHaveLength(5);
    for (const meta of correos) {
      const { entrada } = await correoAEntrada(await readFile(path.join(esc.carpeta, meta.archivo_original)), { recibido_en: meta.recibido_en, exigirAutenticacion: false });
      expect(entrada).toMatchObject({ canal: "correo", remitente: meta.remitente, asunto: meta.asunto, texto_mensaje: meta.texto_mensaje });
      const esperado = await readFile(path.join(esc.carpeta, meta.adjuntos[0]!.ruta!));
      expect(sha(Buffer.from(entrada.adjuntos[0]!.bytes_base64!, "base64"))).toBe(sha(esperado));
    }
  });

  it("Authentication-Results: un fail basta para no confiar; sin cabecera = sin dato", () => {
    expect(autenticacionDe(["mx.google.com; spf=pass smtp.mailfrom=x; dkim=pass header.i=@x; dmarc=pass"])).toBe("pasa");
    // SPF y DKIM pueden pasar para OTRO dominio: sin dmarc=pass no hay prueba de que el From sea real
    expect(autenticacionDe(["mx.google.com; spf=pass smtp.mailfrom=atacante.example; dkim=pass header.i=@atacante.example"])).toBe("sin_dato");
    expect(autenticacionDe(["mx.google.com; spf=softfail smtp.mailfrom=x; dkim=pass"])).toBe("falla");
    expect(autenticacionDe(["mx.google.com; dmarc=fail (p=REJECT)"])).toBe("falla");
    expect(autenticacionDe([])).toBe("sin_dato");
  });
});

describe("recibirCorreo de punta a punta", () => {
  it("SPF fail: remitente no verificado aunque el From sea de CloudNorte → R11 escala y no se responde", async () => {
    const esc = await cargarEscenario("lote-demo-oct");
    const eml = await readFile(path.join(esc.carpeta, "documentos/002-inv-2210.eml"));
    const falsificado = Buffer.concat([Buffer.from("Authentication-Results: mx.google.com; spf=fail smtp.mailfrom=billing@cloudnorte.example\r\n"), eml]);
    const repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
    const r = decidido(await recibirCorreo(falsificado, { repo, ahora: AHORA, extractor: await extractorGolden("lote-demo-oct"), urlPortal: "x" }));
    expect(r.entrada.decision).toBe("ESCALAR");
    expect(r.entrada.reglas_que_fallaron).toContain("R11");
    expect(r.respuesta).toBeNull();
    expect((await repo.documento(r.entrada.ref_interna))?.remitente.valor).toBe(`${PREFIJO_NO_VERIFICADO}billing@cloudnorte.example`);
  });

  it("remitente no autorizado (pagos-cloudnorte@gmail.example) → ESCALAR R11 y respuesta que invita a vincular", async () => {
    const esc = await cargarEscenario("trampas-extra");
    const eml = await readFile(path.join(esc.carpeta, "documentos/011-inv-2245.eml"));
    const repo = await crearRepositorioMemoria("trampas-extra", undefined, { lote: "vacio" });
    const r = decidido(
      await recibirCorreo(eml, { repo, ahora: esc.config.ahora, extractor: await extractorGolden("trampas-extra"), urlPortal: "https://app.example/portal", exigirAutenticacion: false }),
    );
    expect(r.entrada).toMatchObject({ decision: "ESCALAR", reglas_que_fallaron: ["R11"] });
    expect(r.respuesta).toMatchObject({ para: "pagos-cloudnorte@gmail.example", asunto: expect.stringMatching(/^Re: /) });
    expect(r.respuesta?.texto).toContain("https://app.example/portal");
    expect(r.respuesta?.texto).not.toContain("INV-2245"); // no confirma la factura a un remitente no verificado
  });
});

describe("buzón real: ante la duda, no verificado; automáticos ignorados (review #41)", () => {
  async function conCabeceras(cabeceras: string, archivo = "documentos/002-inv-2210.eml") {
    const esc = await cargarEscenario("lote-demo-oct");
    return Buffer.concat([Buffer.from(cabeceras), await readFile(path.join(esc.carpeta, archivo))]);
  }
  const deps = async () => ({
    repo: await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" }),
    ahora: AHORA,
    extractor: await extractorGolden("lote-demo-oct"),
    urlPortal: "x",
    buzonPropio: "facturas.nebula.demo@gmail.com",
  });

  it("sin dmarc=pass (dominio sin DMARC, SPF de otro dominio) el From de CloudNorte no se acepta: R11 escala", async () => {
    const eml = await conCabeceras("Authentication-Results: mx.google.com; spf=pass smtp.mailfrom=atacante.example\r\n");
    const r = decidido(await recibirCorreo(eml, await deps()));
    expect(r.entrada.decision).toBe("ESCALAR");
    expect(r.entrada.reglas_que_fallaron).toContain("R11");
  });

  it("con dmarc=pass el mismo correo se paga", async () => {
    const eml = await conCabeceras("Authentication-Results: mx.google.com; dkim=pass; spf=pass; dmarc=pass (p=REJECT) header.from=cloudnorte.example\r\n");
    expect(decidido(await recibirCorreo(eml, await deps())).entrada.decision).toBe("PAGAR");
  });

  it("rebotes, respuestas automáticas y lo que manda el propio buzón no se ingieren ni se responden", async () => {
    const d = await deps();
    expect(await recibirCorreo(await conCabeceras("Auto-Submitted: auto-replied\r\n"), d)).toEqual({ ignorado: "auto-submitted" });
    expect(await recibirCorreo(await conCabeceras("Precedence: bulk\r\n"), d)).toEqual({ ignorado: "precedence" });
    const rebote = Buffer.from("From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>\r\nSubject: Delivery Status Notification\r\n\r\nNo se entregó.");
    expect(await recibirCorreo(rebote, d)).toEqual({ ignorado: "remitente de sistema" });
    const propio = Buffer.from("From: facturas.nebula.demo@gmail.com\r\nSubject: Re: algo\r\n\r\nRecibimos tu factura.");
    expect(await recibirCorreo(propio, d)).toEqual({ ignorado: "enviado por el propio buzón" });
    expect(await d.repo.documentos()).toHaveLength(0);
  });

  it("un adjunto que no pasa la validación del portal (HTML disfrazado de PDF) se descarta", async () => {
    const eml = Buffer.from(
      [
        "From: billing@cloudnorte.example",
        "Subject: Invoice",
        'Content-Type: multipart/mixed; boundary="b"',
        "",
        "--b",
        "Content-Type: text/plain",
        "",
        "Adjunto la factura.",
        "--b",
        "Content-Type: application/pdf",
        'Content-Disposition: attachment; filename="factura.pdf"',
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from("<html><script>alert(1)</script></html>").toString("base64"),
        "--b--",
        "",
      ].join("\r\n"),
    );
    const { entrada } = await correoAEntrada(eml, { recibido_en: AHORA, exigirAutenticacion: false });
    expect(entrada.adjuntos).toEqual([]);
  });
});

describe("POST /api/canales/correo/simular", () => {
  it("los .eml del lote demo, por el parser sin IA, dan las decisiones esperadas; el cuerpo de OMI-3381 dispara R10", async () => {
    fijarRepositorio(await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" }));
    comoSesion(CUENTA);
    const esc = await cargarEscenario("lote-demo-oct");
    for (const meta of esc.documentos.filter((d) => d.archivo_original.endsWith(".eml"))) {
      const eml = await readFile(path.join(esc.carpeta, meta.archivo_original));
      const res = await postSimular(peticion("http://x/api/canales/correo/simular", { method: "POST", body: eml, headers: { "content-type": "message/rfc822" } }));
      expect(res.status).toBe(201);
      const r = await res.json();
      const esperado = esc.esperado.find((e) => e.documento === meta.archivo_original)!;
      expect([meta.archivo_original, r.estado, r.reglas_que_fallaron]).toEqual([meta.archivo_original, esperado.decision, esperado.reglas_que_fallan]);
    }
  });

  it("un cuerpo de más de 10 MB → 413 sin leerlo entero", async () => {
    comoSesion(CUENTA);
    const grande = new Uint8Array(10 * 1024 * 1024 + 1);
    const res = await postSimular(peticion("http://x/api/canales/correo/simular", { method: "POST", body: grande }));
    expect(res.status).toBe(413);
  });

  it("sin sesión → 401", async () => {
    comoSesion(null);
    const res = await postSimular(peticion("http://x/api/canales/correo/simular", { method: "POST", body: "From: a@b.example\r\n\r\nhola" }));
    expect(res.status).toBe(401);
  });
});
