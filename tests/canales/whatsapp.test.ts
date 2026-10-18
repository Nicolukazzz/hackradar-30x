// Canal WhatsApp (#79): número no vinculado escala por R11, vinculación con enlace firmado de un solo uso, ESTADO y
// webhook (verificación GET y firma X-Hub-Signature-256). Nunca se llama a Meta de verdad.

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/canales/whatsapp/webhook/route";
import { crearTokenVinculo } from "@/canales/telegram/vinculo";
import { firmaValida } from "@/canales/whatsapp/cliente";
import { type DependenciasWhatsapp, type MensajeWhatsapp, mensajesDe, recibirWhatsapp, WebhookSchema } from "@/canales/whatsapp/recibir";
import { extractorGolden } from "@/ingesta/cargar-escenario";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";

vi.mock("server-only", () => ({}));
vi.stubEnv("LLM_PROVIDER", "ninguno");

const AHORA = "2026-10-16T10:00:00-05:00";
const SECRETO = "whatsapp:verificar-0123456789";
const NUMERO = "573001112233";

let repo: Repositorio;
let deps: DependenciasWhatsapp;
let textoJpo10: string;

const texto = (body: string, id = "wamid.1"): MensajeWhatsapp => ({ from: NUMERO, id, type: "text", text: { body } });

beforeEach(async () => {
  repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
  const u = JSON.parse(await readFile("tests/fixtures/telegram/jpo-10.json", "utf8")) as { message: { text: string } };
  textoJpo10 = u.message.text;
  deps = {
    repo,
    ahora: AHORA,
    extractor: await extractorGolden("lote-demo-oct"),
    whatsapp: { descargarArchivo: () => Promise.reject(new Error("no existe")) },
    secreto: SECRETO,
    confiarNumero: true,
  };
});

describe("seguridad (R11)", () => {
  it("un número no vinculado nunca termina en PAGAR: escala por R11", async () => {
    const r = await recibirWhatsapp(texto(textoJpo10), deps);
    expect(r.entrada?.canal).toBe("whatsapp");
    expect(r.entrada?.decision).toBe("ESCALAR");
    expect(r.entrada?.reglas_que_fallaron).toContain("R11");
    expect(r.respuesta).not.toMatch(/R\d|límite/);
  });

  it("vincular con enlace: la siguiente factura por ese número cumple R11; el enlace no sirve dos veces", async () => {
    const token = crearTokenVinculo("ben-juan-pablo-ortiz", AHORA, SECRETO);
    const v = await recibirWhatsapp(texto(`VINCULAR ${token}`), deps);
    expect(v.respuesta).toContain("Juan Pablo Ortiz");
    expect((await repo.datosComunes()).beneficiarios.find((b) => b.id === "ben-juan-pablo-ortiz")?.canales.whatsapp).toBe(NUMERO);

    const r = await recibirWhatsapp(texto(textoJpo10, "wamid.2"), deps);
    expect(r.entrada?.decision).toBe("PAGAR");
    expect(r.respuesta).toMatch(/^Recibimos tu factura JPO-10\. Ref INT-2026-\d{6}\. Estado: aprobada para pago\.$/);

    const otra = await recibirWhatsapp({ ...texto(`vincular ${token}`), from: "573009998877" }, deps);
    expect(otra.respuesta).toMatch(/ya no sirve/);
  });

  it("un token de Telegram (otra clave) no vincula por WhatsApp", async () => {
    const token = crearTokenVinculo("ben-juan-pablo-ortiz", AHORA, "secreto-de-telegram");
    expect((await recibirWhatsapp(texto(`VINCULAR ${token}`), deps)).respuesta).toMatch(/ya no sirve/);
  });

  it("/simular sin confiar en el número: queda no verificado y VINCULAR no vale", async () => {
    const token = crearTokenVinculo("ben-juan-pablo-ortiz", AHORA, SECRETO);
    const d = { ...deps, confiarNumero: false };
    expect((await recibirWhatsapp(texto(`VINCULAR ${token}`), d)).respuesta).toMatch(/ya no sirve/);
    const r = await recibirWhatsapp(texto(textoJpo10), d);
    expect((await repo.documento(r.entrada!.ref_interna))?.remitente.valor).toBe(`no-verificado:${NUMERO}`);
    expect(r.entrada?.decision).toBe("ESCALAR");
  });
});

describe("ESTADO y mensajes que no son factura", () => {
  it("ESTADO solo responde refs del mismo número", async () => {
    const r = await recibirWhatsapp(texto(textoJpo10), deps);
    const ref = r.entrada!.ref_interna;
    expect((await recibirWhatsapp(texto(`ESTADO ${ref}`), deps)).respuesta).toContain(ref);
    expect((await recibirWhatsapp({ ...texto(`estado ${ref}`), from: "573009998877" }, deps)).respuesta).toMatch(/No encontramos/);
  });

  it("un saludo recibe la ayuda y no crea documento; un audio se rechaza", async () => {
    expect((await recibirWhatsapp(texto("hola"), deps)).entrada).toBeUndefined();
    const audio = await recibirWhatsapp({ from: NUMERO, id: "wamid.a", type: "audio" }, deps);
    expect(audio.ignorado).toBe("tipo audio");
    expect(await repo.documentos()).toHaveLength(0);
  });
});

describe("webhook", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("GET responde el challenge solo con el verify token correcto", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "mi-token");
    const ok = await GET(new Request("http://x/api/canales/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=mi-token&hub.challenge=12345"));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("12345");
    const mal = await GET(new Request("http://x/api/canales/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=12345"));
    expect(mal.status).toBe(403);
  });

  it("POST con firma inválida → 401", async () => {
    for (const [k, v] of Object.entries({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "1", WHATSAPP_APP_SECRET: "s", WHATSAPP_VERIFY_TOKEN: "v" })) vi.stubEnv(k, v);
    const r = await POST(new Request("http://x", { method: "POST", body: "{}", headers: { "x-hub-signature-256": "sha256=00" } }));
    expect(r.status).toBe(401);
  });

  it("firma y forma del payload de Meta", () => {
    const cuerpo = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", messages: [texto("hola")], statuses: [] } }] }],
    });
    const firma = `sha256=${createHmac("sha256", "s").update(cuerpo).digest("hex")}`;
    expect(firmaValida(cuerpo, firma, "s")).toBe(true);
    expect(firmaValida(`${cuerpo} `, firma, "s")).toBe(false);
    expect(mensajesDe(WebhookSchema.parse(JSON.parse(cuerpo)))).toHaveLength(1);
  });
});
