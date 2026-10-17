import { describe, expect, it, vi } from "vitest";

import { enviarRespuesta } from "@/canales/correo/buzon";
import { configSalienteDesdeEntorno, enviarCorreo } from "@/canales/correo/saliente";

const config = { apiKey: "xkeysib-prueba", remitente: "facturas@nebula.example" };
const ok = () => vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ messageId: "<1@brevo>" }), { status: 201 }));
const cuerpo = (f: ReturnType<typeof ok>) => JSON.parse(String(f.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;

describe("configSalienteDesdeEntorno", () => {
  it("sin llave no hay correo saliente", () => {
    expect(configSalienteDesdeEntorno({ CORREO_REMITENTE: "a@b.example" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
  it("el remitente cae al usuario del buzón si no se fija", () => {
    expect(configSalienteDesdeEntorno({ BREVO_API_KEY: " k ", CORREO_IMAP_USUARIO: "buzon@b.example" } as unknown as NodeJS.ProcessEnv)).toEqual({
      apiKey: "k",
      remitente: "buzon@b.example",
    });
  });
});

describe("enviarCorreo", () => {
  it("llama a Brevo con la llave, el remitente, copia oculta y cabeceras", async () => {
    const f = ok();
    await enviarCorreo(config, { para: ["a@b.example"], bcc: ["c@d.example"], asunto: "Hola", texto: "t", html: "<p>t</p>", nombre: "Laura", cabeceras: { "Auto-Submitted": "auto-generated" } }, { fetch: f });
    const [url, init] = f.mock.calls[0] ?? [];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init?.headers as Record<string, string>)["api-key"]).toBe("xkeysib-prueba");
    expect(cuerpo(f)).toEqual({
      sender: { name: "Laura", email: "facturas@nebula.example" },
      to: [{ email: "a@b.example" }],
      bcc: [{ email: "c@d.example" }],
      subject: "Hola",
      textContent: "t",
      htmlContent: "<p>t</p>",
      headers: { "Auto-Submitted": "auto-generated" },
    });
  });

  it("lanza si Brevo rechaza el correo", async () => {
    const f = vi.fn<typeof fetch>(async () => new Response('{"message":"sender not valid"}', { status: 400 }));
    await expect(enviarCorreo(config, { para: ["a@b.example"], asunto: "x", texto: "x" }, { fetch: f })).rejects.toThrow(/brevo 400: .*sender not valid/);
  });

  it("corta si Brevo no responde (nunca deja el botón cargando)", async () => {
    const f = vi.fn<typeof fetch>(
      (_u, init) => new Promise((_r, rechazar) => init?.signal?.addEventListener("abort", () => rechazar(init.signal?.reason))),
    );
    await expect(enviarCorreo(config, { para: ["a@b.example"], asunto: "x", texto: "x" }, { fetch: f, timeoutMs: 20 })).rejects.toThrow();
  });
});

describe("enviarRespuesta", () => {
  it("responde en el mismo hilo y marca la respuesta como automática", async () => {
    const f = ok();
    await enviarRespuesta(config, { para: "billing@cloudnorte.example", asunto: "Re: INV-2210", texto: "Recibida", en_respuesta_a: "<m1@cloudnorte>" }, f);
    expect(cuerpo(f).headers).toEqual({ "Auto-Submitted": "auto-replied", "In-Reply-To": "<m1@cloudnorte>", References: "<m1@cloudnorte>" });
  });
});
