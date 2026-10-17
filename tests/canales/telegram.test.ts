// Canal Telegram (#13): fixtures del lote demo, vinculación con enlace firmado de un solo uso, /estado y webhook.
// Nunca se llama a Telegram de verdad.

import { readFile } from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as webhook } from "@/app/api/canales/telegram/webhook/route";
import { recibirTelegram, pareceFactura, type DependenciasTelegram, type UpdateTelegram } from "@/canales/telegram/recibir";
import { crearTokenVinculo, leerTokenVinculo } from "@/canales/telegram/vinculo";
import { extractorGolden } from "@/ingesta/cargar-escenario";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";

vi.mock("server-only", () => ({}));
vi.stubEnv("LLM_PROVIDER", "ninguno");

const AHORA = "2026-10-16T10:00:00-05:00";
const SECRETO = "secreto-de-prueba-0123456789";
const FOTO = "data/escenarios/lote-demo-oct/documentos/012-es-4410.png";

async function fixture(nombre: string): Promise<UpdateTelegram> {
  return JSON.parse(await readFile(`tests/fixtures/telegram/${nombre}.json`, "utf8")) as UpdateTelegram;
}

const conChat = (u: UpdateTelegram, chat: number, cambios: Partial<NonNullable<UpdateTelegram["message"]>> = {}): UpdateTelegram => ({
  ...u,
  message: { ...u.message!, chat: { id: chat, type: "private" }, ...cambios },
});

let repo: Repositorio;
let deps: DependenciasTelegram;

beforeEach(async () => {
  repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
  const foto = await readFile(FOTO);
  deps = {
    repo,
    ahora: AHORA,
    extractor: await extractorGolden("lote-demo-oct"),
    telegram: {
      async descargarArchivo(id) {
        if (id === "es-4410") return foto;
        throw new Error("no existe");
      },
    },
    secreto: SECRETO,
    confiarChat: true,
  };
});

describe("fixtures del lote demo por Telegram", () => {
  it("JPO-10 (chat vinculado de Juan Pablo) → PAGAR y responde la ref y el estado, sin reglas internas", async () => {
    const r = await recibirTelegram(await fixture("jpo-10"), deps);
    expect(r.entrada?.decision).toBe("PAGAR");
    expect(r.respuesta).toMatch(/^Recibimos tu factura JPO-10\. Ref INT-2026-\d{6}\. Estado: aprobada para pago\.$/);
  });

  it("F-0101 (Diego cambió de cuenta) → ESCALAR por R4", async () => {
    const r = await recibirTelegram(await fixture("f-0101"), deps);
    expect(r.entrada?.decision).toBe("ESCALAR");
    expect(r.entrada?.reglas_que_fallaron).toEqual(["R4"]);
    expect(r.respuesta).toContain("en revisión");
    expect(r.respuesta).not.toMatch(/R\d|límite|9083/);
  });

  it("ES-4410 (foto): toma la de mayor resolución, la guarda como original y no paga (supera el límite automático)", async () => {
    const r = await recibirTelegram(await fixture("es-4410"), deps);
    expect(r.entrada?.decision).not.toBe("PAGAR");
    expect(r.entrada?.reglas_que_fallaron).toContain("R9");
    expect((await repo.leerArchivo(r.entrada!.ref_interna))?.mime).toBe("image/png");
    expect(r.respuesta).toMatch(/^Recebemos sua fatura/);
  });
});

describe("seguridad (R11)", () => {
  it("un chat no vinculado nunca termina en PAGAR: escala por R11 y se le dice cómo vincularse", async () => {
    const r = await recibirTelegram(conChat(await fixture("jpo-10"), 999999), deps);
    expect(r.entrada?.decision).toBe("ESCALAR");
    expect(r.entrada?.reglas_que_fallaron).toContain("R11");
    expect(r.respuesta).toContain("pide a tu contacto en el equipo de finanzas el enlace para vincular este chat");
    expect(r.respuesta).not.toContain("JPO-10"); // R11: no se confirma el número de factura
  });

  it("/simular en producción (confiarChat: false): aunque diga ser el chat de Juan Pablo, R11 escala; /start no vincula", async () => {
    const sinConfiar = { ...deps, confiarChat: false };
    const r = await recibirTelegram(await fixture("jpo-10"), sinConfiar);
    expect(r.entrada?.decision).toBe("ESCALAR");
    expect(r.entrada?.reglas_que_fallaron).toContain("R11");
    const token = crearTokenVinculo("ben-juan-pablo-ortiz", AHORA, SECRETO);
    const v = await recibirTelegram(conChat(await fixture("jpo-10"), 555, { text: `/start ${token}` }), sinConfiar);
    expect(v.respuesta).toMatch(/ya no sirve/);
    expect((await repo.datosComunes()).beneficiarios.find((b) => b.id === "ben-juan-pablo-ortiz")?.canales.telegram_chat_id).toBe("700100004");
  });

  it("grupos no: solo chats privados", async () => {
    const u = await fixture("jpo-10");
    const r = await recibirTelegram({ ...u, message: { ...u.message!, chat: { id: -100, type: "group" } } }, deps);
    expect(r.entrada).toBeUndefined();
  });
});

describe("vincular con /start <token> (#13)", () => {
  it("token firmado: adulterado, vencido o de otro secreto → no sirve", () => {
    const t = crearTokenVinculo("ben-diego-herrera", AHORA, SECRETO);
    expect(t.length).toBeLessThanOrEqual(64);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(leerTokenVinculo(t, AHORA, SECRETO)).toBe("ben-diego-herrera");
    expect(leerTokenVinculo(`${t.slice(0, -1)}${t.endsWith("A") ? "B" : "A"}`, AHORA, SECRETO)).toBeNull();
    expect(leerTokenVinculo(t, "2026-10-19T10:00:01-05:00", SECRETO)).toBeNull();
    expect(leerTokenVinculo(t, AHORA, "otro-secreto")).toBeNull();
  });

  it("vincula el chat, queda en el registro y el mismo enlace no sirve dos veces; después sus facturas pagan", async () => {
    const token = crearTokenVinculo("ben-juan-pablo-ortiz", AHORA, SECRETO);
    const v = await recibirTelegram(conChat(await fixture("jpo-10"), 555, { text: `/start ${token}` }), deps);
    expect(v.respuesta).toBe("Listo, Juan Pablo Ortiz. Este chat quedó vinculado: ya puedes enviarme tus facturas aquí.");
    const [cambio] = await repo.registro({ tipo: ["CAMBIO_BENEFICIARIOS"] });
    expect(cambio).toMatchObject({ beneficiario: "Juan Pablo Ortiz", canal: "telegram" });
    expect(cambio?.sha256).not.toContain(token);

    const otraVez = await recibirTelegram(conChat(await fixture("jpo-10"), 777, { text: `/start ${token}` }), deps);
    expect(otraVez.respuesta).toMatch(/ya no sirve/);

    expect((await recibirTelegram(conChat(await fixture("jpo-10"), 555), deps)).entrada?.decision).toBe("PAGAR");
    // El chat anterior (700100004) ya no es de Juan Pablo.
    expect((await recibirTelegram(await fixture("jpo-10"), deps)).entrada?.reglas_que_fallaron).toContain("R11");
  });
});

describe("/estado y mensajes sueltos", () => {
  it("/estado de una ref propia responde el estado; de otro chat, como si no existiera", async () => {
    const r = await recibirTelegram(await fixture("f-0101"), deps);
    const ref = r.entrada!.ref_interna;
    const propio = await recibirTelegram(conChat(await fixture("f-0101"), 700100003, { text: `/estado ${ref.toLowerCase()}` }), deps);
    expect(propio.respuesta).toContain(`Ref ${ref}. Estado: en revisión`);
    const ajeno = await recibirTelegram(conChat(await fixture("f-0101"), 700100004, { text: `/estado ${ref}` }), deps);
    expect(ajeno.respuesta).toMatch(/No encontramos esa referencia/);
  });

  it("un saludo no se ingiere: responde la ayuda", async () => {
    const r = await recibirTelegram(conChat(await fixture("jpo-10"), 700100004, { text: "hola" }), deps);
    expect(r.entrada).toBeUndefined();
    expect(r.respuesta).toMatch(/^Hola\. Envíame aquí tu factura/);
    expect(pareceFactura("hola, ¿cómo están?")).toBe(false);
    expect(pareceFactura("Factura F-0200 por USD 500,00")).toBe(true);
  });
});

describe("POST /api/canales/telegram/webhook", () => {
  const enviados: { url: string; cuerpo: unknown }[] = [];

  beforeEach(() => {
    enviados.length = 0;
    fijarRepositorio(repo);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", SECRETO);
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      enviados.push({ url, cuerpo: JSON.parse(String(init?.body ?? "null")) });
      return Response.json({ ok: true, result: {} });
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
  });

  const pedir = async (u: unknown, secreto?: string) =>
    webhook(new Request("http://x/api/canales/telegram/webhook", { method: "POST", body: JSON.stringify(u), headers: secreto ? { "x-telegram-bot-api-secret-token": secreto } : {} }));

  it("sin la cabecera secreta correcta → 401 y no procesa nada", async () => {
    expect((await pedir(await fixture("jpo-10"))).status).toBe(401);
    expect((await pedir(await fixture("jpo-10"), "otro")).status).toBe(401);
    expect(enviados).toHaveLength(0);
  });

  it("con la cabecera: procesa y responde por sendMessage al mismo chat", async () => {
    const res = await pedir(await fixture("f-0101"), SECRETO);
    expect(res.status).toBe(200);
    expect((await res.json()).ref_interna).toMatch(/^INT-2026-/);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(enviados[0]?.cuerpo).toMatchObject({ chat_id: "700100003" });
  });

  it("sin configurar → 503", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect((await pedir(await fixture("jpo-10"), SECRETO)).status).toBe(503);
  });
});
