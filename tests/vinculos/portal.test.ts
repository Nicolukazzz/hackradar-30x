// Portal del proveedor (#85): el admin crea enlace con nombre, correo y código; el proveedor entra solo si correo y
// código coinciden, y sube facturas que decide el motor (R11 solo cumple si el correo ya es canal del beneficiario).

import { readFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("LLM_PROVIDER", "ninguno");

import { dependenciasCanal } from "@/canales/dependencias";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";
import { crearValorSesion, hashValor, sesionValida } from "@/vinculos/acceso";
import type { AlmacenEnlaces } from "@/vinculos/almacen";
import { formatearCodigo, generarCodigo, normalizarCodigo } from "@/vinculos/codigo";
import { crearAlmacenEnlacesMemoria } from "@/vinculos/memoria";
import { borrarEnlace, cambiarCodigo, crearEnlace, enlaceActivo, entrar, enviarFactura, listarEnlaces, misEnvios, revocarEnlace } from "@/vinculos/servicio";
import { MENSAJE_INVALIDO, MENSAJE_NO_COINCIDE } from "@/vinculos/tipos";

const AHORA = "2026-10-16T10:00:00-05:00";
const ADMIN = { usuario_id: "00000000-0000-4000-8000-00000000000a" };
const DOCS = "data/escenarios/lote-demo-oct/documentos";

let almacen: AlmacenEnlaces;
let repo: Repositorio;

beforeEach(async () => {
  almacen = crearAlmacenEnlacesMemoria();
  repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
});

const tokenDe = (url: string) => url.split("/vincular/")[1] ?? "";
const crear = (nombre: string, correo: string, codigo = "K7M2-Q9XD") => crearEnlace(almacen, repo, ADMIN, { nombre, correo, codigo }, AHORA);

describe("código", () => {
  it("8 caracteres de Crockford, formato XXXX-XXXX; se normaliza lo que escribe una persona", () => {
    expect(generarCodigo(new Uint8Array([0, 1, 2, 3, 31, 32, 63, 255]))).toBe("0123-Z0ZZ");
    for (let i = 0; i < 100; i++) expect(generarCodigo()).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizarCodigo(" k7m2 q9xd ")).toBe("K7M2Q9XD");
    expect(normalizarCodigo("O1IL-0000")).toBe("0111" + "0000");
    expect(normalizarCodigo("K7M2-Q9X")).toBeNull();
    expect(normalizarCodigo("K7M2-Q9XU")).toBeNull();
    expect(formatearCodigo("K7M2Q9XD")).toBe("K7M2-Q9XD");
  });
});

describe("crear (admin)", () => {
  it("guarda nombre y correo, devuelve URL y código una sola vez; en el almacén solo hashes", async () => {
    const r = await crear("CloudNorte S.A.S.", "Billing@CloudNorte.example");
    expect(r.codigo).toBe("K7M2-Q9XD");
    expect(tokenDe(r.url)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.enlace).toMatchObject({ estado: "activo", nombre: "CloudNorte S.A.S.", correo: "billing@cloudnorte.example", beneficiario_id: "ben-cloudnorte" });
    expect(Date.parse(r.enlace.expira_en) - Date.parse(AHORA)).toBe(30 * 24 * 3600 * 1000);
    const guardado = JSON.stringify(await almacen.listar());
    expect(guardado).not.toContain(tokenDe(r.url));
    expect(guardado).not.toContain("K7M2");
    expect(guardado).not.toContain("codigo_hash");
  });

  it("proveedor nuevo: correo que no es de nadie de la lista", async () => {
    expect((await crear("Lumen Diseño S.A.S.", "hola@lumendiseno.example")).enlace.beneficiario_id).toBeNull();
  });

  it("valida nombre, correo y código; un código repetido se rechaza (409)", async () => {
    await expect(crear("x", "a@b.example")).rejects.toMatchObject({ estado: 400 });
    await expect(crear("Lumen", "no-correo")).rejects.toMatchObject({ estado: 400 });
    await expect(crear("Lumen", "a@b.example", "123")).rejects.toMatchObject({ estado: 400 });
    await crear("Lumen", "a@b.example");
    await expect(crear("Otro", "c@d.example", "k7m2q9xd")).rejects.toMatchObject({ estado: 409 });
  });
});

describe("entrar (proveedor)", () => {
  it("entra solo si correo y código coinciden; el mensaje no dice cuál falló", async () => {
    const r = await crear("CloudNorte S.A.S.", "billing@cloudnorte.example");
    const token = tokenDe(r.url);
    await expect(entrar(almacen, token, { correo: "otro@cloudnorte.example", codigo: "K7M2-Q9XD" }, AHORA)).rejects.toThrow(MENSAJE_NO_COINCIDE);
    await expect(entrar(almacen, token, { correo: "billing@cloudnorte.example", codigo: "K7M2-Q9XE" }, AHORA)).rejects.toThrow(MENSAJE_NO_COINCIDE);
    const e = await entrar(almacen, token, { correo: " BILLING@cloudnorte.example ", codigo: "k7m2 q9xd" }, AHORA);
    expect(e.id).toBe(r.enlace.id);
    expect((await listarEnlaces(almacen, AHORA))[0]?.ultimo_acceso).toBe(AHORA);
  });

  it("enlace inválido, vencido o revocado: no se puede entrar", async () => {
    const r = await crear("Lumen", "a@b.example");
    const token = tokenDe(r.url);
    const datos = { correo: "a@b.example", codigo: "K7M2-Q9XD" };
    await expect(entrar(almacen, "x".repeat(43), datos, AHORA)).rejects.toThrow(MENSAJE_INVALIDO);
    await expect(entrar(almacen, token, datos, "2026-11-16T10:00:01-05:00")).rejects.toThrow(MENSAJE_INVALIDO);
    await revocarEnlace(almacen, r.enlace.id, AHORA);
    await expect(entrar(almacen, token, datos, AHORA)).rejects.toThrow(MENSAJE_INVALIDO);
    await expect(revocarEnlace(almacen, r.enlace.id, AHORA)).rejects.toMatchObject({ estado: 404 });
  });

  it("cambiar el código: el anterior deja de servir y la sesión abierta se cierra", async () => {
    const r = await crear("Lumen", "a@b.example");
    const token = tokenDe(r.url);
    const e = await entrar(almacen, token, { correo: "a@b.example", codigo: "K7M2-Q9XD" }, AHORA);
    const { valor } = crearValorSesion(e.id, e.codigo_hash, AHORA);
    expect(sesionValida(valor, e.id, e.codigo_hash, AHORA)).toBe(true);

    expect(await cambiarCodigo(almacen, r.enlace.id, { codigo: "AAAA-BBBB" }, AHORA)).toEqual({ codigo: "AAAA-BBBB" });
    await expect(entrar(almacen, token, { correo: "a@b.example", codigo: "K7M2-Q9XD" }, AHORA)).rejects.toThrow(MENSAJE_NO_COINCIDE);
    const nuevo = (await enlaceActivo(almacen, token, AHORA))!;
    expect(sesionValida(valor, nuevo.id, nuevo.codigo_hash, AHORA)).toBe(false);
    await expect(entrar(almacen, token, { correo: "a@b.example", codigo: "aaaabbbb" }, AHORA)).resolves.toMatchObject({ id: r.enlace.id });
  });
});

describe("borrar accesos (#119)", () => {
  it("solo se borra un acceso revocado o vencido; uno activo no", async () => {
    const r = await crear("Lumen", "a@b.example");
    await expect(borrarEnlace(almacen, r.enlace.id, AHORA)).rejects.toMatchObject({ estado: 404 });
    await revocarEnlace(almacen, r.enlace.id, AHORA);
    await borrarEnlace(almacen, r.enlace.id, AHORA);
    expect(await listarEnlaces(almacen, AHORA)).toHaveLength(0);
    const v = await crear("Otro", "c@d.example", "BBBB-CCCC");
    await borrarEnlace(almacen, v.enlace.id, "2026-11-16T10:00:01-05:00");
    expect(await listarEnlaces(almacen, AHORA)).toHaveLength(0);
  });
});

describe("sesión (cookie firmada)", () => {
  it("vale 2 horas, solo para su enlace y no se puede adulterar", () => {
    const h = hashValor("codigo:K7M2Q9XD");
    const { valor } = crearValorSesion("id-1", h, AHORA);
    expect(sesionValida(valor, "id-1", h, "2026-10-16T11:59:00-05:00")).toBe(true);
    expect(sesionValida(valor, "id-1", h, "2026-10-16T12:00:01-05:00")).toBe(false);
    expect(sesionValida(valor, "id-2", h, AHORA)).toBe(false);
    expect(sesionValida(`${valor}x`, "id-1", h, AHORA)).toBe(false);
    expect(sesionValida(valor.replace(/^id-1/, "id-2"), "id-2", h, AHORA)).toBe(false);
    expect(sesionValida(undefined, "id-1", h, AHORA)).toBe(false);
  });
});

describe("subir facturas", () => {
  async function subir(nombre: string, correo: string, archivo: string) {
    const r = await crear(nombre, correo);
    const e = (await enlaceActivo(almacen, tokenDe(r.url), AHORA))!;
    const bytes = new Uint8Array(await readFile(`${DOCS}/${archivo}`));
    const envio = await enviarFactura(e, { bytes, nombre: archivo.split("/").at(-1)! }, { ...(await dependenciasCanal(repo)), ahora: AHORA });
    return { e, envio };
  }

  // Extractor real sin LLM (parser por etiquetas, #4): los PDF del dataset se leen igual que la extracción esperada.
  it("proveedor de la lista con su correo registrado: entra por la ingesta como correo vinculado y la decide el motor", async () => {
    const { e, envio } = await subir("Ana María Gómez", "ana.gomez@amg-estudio.example", "001-fac-1041.pdf");
    expect(envio).toMatchObject({ estado: "aprobada", nombre_archivo: "001-fac-1041.pdf" });
    const doc = await repo.documento(envio.ref_interna);
    expect(doc).toMatchObject({ canal: "portal", remitente: { tipo: "correo", valor: "ana.gomez@amg-estudio.example" }, beneficiario_remitente_id: "ben-ana-maria-gomez" });
    const decision = (await repo.registro({ ref_interna: envio.ref_interna })).find((x) => x.tipo === "DECISION_AGENTE");
    expect(decision?.reglas_que_fallaron).not.toContain("R11");
    expect(await misEnvios(repo, e)).toHaveLength(1);
  });

  it("proveedor nuevo: se escala (R3, R11) y el proveedor solo ve «en revisión», sin reglas", async () => {
    const { envio } = await subir("Tecnologías Delta SpA", "nuevo@delta.example", "adjuntos/009-td-001.pdf");
    expect(envio.estado).toBe("en_revision");
    expect(envio.mensaje).not.toMatch(/R\d/);
    const decision = (await repo.registro({ ref_interna: envio.ref_interna })).find((x) => x.tipo === "DECISION_AGENTE");
    expect(decision?.decision).toBe("ESCALAR");
    expect(decision?.reglas_que_fallaron).toEqual(expect.arrayContaining(["R3", "R11"]));
  });
});
