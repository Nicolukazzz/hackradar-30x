// Enlaces de proveedor (#85): un solo uso, el proveedor escribe su correo y recibe un id de conexión. Para uno de la
// lista el correo queda vinculado (R11); para uno nuevo solo se registra. La app no envía correos.

import { beforeEach, describe, expect, it } from "vitest";

import { hashToken } from "@/equipo/token";
import { beneficiarioDelRemitente } from "@/ingesta/ingerir";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";
import type { AlmacenEnlaces } from "@/vinculos/almacen";
import { crearAlmacenEnlacesMemoria } from "@/vinculos/memoria";
import { estadoEnlace, generarConexionId } from "@/vinculos/reglas";
import { crearEnlace, listarEnlaces, revocarEnlace, usarEnlace, vistaEnlace } from "@/vinculos/servicio";
import { ErrorVinculo, MENSAJE_CORREO_OCUPADO, MENSAJE_INVALIDO } from "@/vinculos/tipos";

const AHORA = "2026-10-16T10:00:00-05:00";
const ADMIN = { usuario_id: "00000000-0000-4000-8000-00000000000a" };

let almacen: AlmacenEnlaces;
let repo: Repositorio;

beforeEach(async () => {
  almacen = crearAlmacenEnlacesMemoria();
  repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
});

const tokenDe = (url: string) => url.split("/vincular/")[1] ?? "";
const correosDe = async (id: string) => (await repo.datosComunes()).beneficiarios.find((b) => b.id === id)?.canales.correos;

describe("crear y ver (#85)", () => {
  it("enlace para un proveedor de la lista: token de 43 caracteres, en el almacén solo su hash, vence en 7 días", async () => {
    const { url, enlace } = await crearEnlace(almacen, repo, ADMIN, { beneficiario_id: "ben-cloudnorte" }, AHORA);
    const token = tokenDe(url);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(enlace).toMatchObject({ estado: "activo", beneficiario_id: "ben-cloudnorte", nombre: "CloudNorte S.A.S.", correo: null, conexion_id: null });
    expect(Date.parse(enlace.expira_en) - Date.parse(AHORA)).toBe(7 * 24 * 3600 * 1000);
    expect(JSON.stringify(await almacen.listar())).not.toContain(token);
    expect(await almacen.porHash(hashToken(token))).not.toBeNull();
    expect(await vistaEnlace(almacen, repo, token, AHORA)).toEqual({ nombre: "CloudNorte S.A.S.", existente: true, empresa: "Nébula Studio Inc." });
  });

  it("valida la entrada: beneficiario de la lista y activo, o un nombre", async () => {
    await expect(crearEnlace(almacen, repo, ADMIN, { beneficiario_id: "ben-no-existe" }, AHORA)).rejects.toMatchObject({ estado: 404 });
    await expect(crearEnlace(almacen, repo, ADMIN, { nombre: "x" }, AHORA)).rejects.toMatchObject({ estado: 400 });
    await expect(crearEnlace(almacen, repo, ADMIN, { nombre: "Lumen", beneficiario_id: "ben-cloudnorte" }, AHORA)).rejects.toBeInstanceOf(ErrorVinculo);
    const { enlace } = await crearEnlace(almacen, repo, ADMIN, { nombre: "  Lumen Diseño S.A.S. " }, AHORA);
    expect(enlace).toMatchObject({ beneficiario_id: null, nombre: "Lumen Diseño S.A.S." });
  });

  it("un token mal formado, inexistente, vencido o revocado no muestra nada", async () => {
    const { url, enlace } = await crearEnlace(almacen, repo, ADMIN, { nombre: "Lumen" }, AHORA);
    const token = tokenDe(url);
    expect(await vistaEnlace(almacen, repo, "corto", AHORA)).toBeNull();
    expect(await vistaEnlace(almacen, repo, "A".repeat(43), AHORA)).toBeNull();
    expect(await vistaEnlace(almacen, repo, token, "2026-10-23T10:00:01-05:00")).toBeNull();
    await revocarEnlace(almacen, enlace.id, AHORA);
    expect(await vistaEnlace(almacen, repo, token, AHORA)).toBeNull();
    expect((await listarEnlaces(almacen, AHORA))[0]?.estado).toBe("revocado");
    await expect(revocarEnlace(almacen, enlace.id, AHORA)).rejects.toMatchObject({ estado: 404 });
  });
});

describe("usar el enlace", () => {
  it("proveedor de la lista: el correo queda vinculado (R11), id de conexión, entrada en el registro y no sirve dos veces", async () => {
    const { url } = await crearEnlace(almacen, repo, ADMIN, { beneficiario_id: "ben-cloudnorte" }, AHORA);
    const token = tokenDe(url);
    const r = await usarEnlace(almacen, repo, token, { correo: " Facturas@CloudNorte.example " }, AHORA);
    expect(r).toMatchObject({ nombre: "CloudNorte S.A.S.", existente: true, correo: "facturas@cloudnorte.example" });
    expect(r.conexion_id).toMatch(/^PRV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);

    expect(await correosDe("ben-cloudnorte")).toEqual(["billing@cloudnorte.example", "facturas@cloudnorte.example"]);
    const bs = (await repo.datosComunes()).beneficiarios;
    expect(beneficiarioDelRemitente({ tipo: "correo", valor: "facturas@cloudnorte.example" }, bs)).toBe("ben-cloudnorte");

    const entrada = (await repo.registro({ tipo: ["CAMBIO_BENEFICIARIOS"] })).at(-1);
    expect(entrada).toMatchObject({ ref_interna: `CANAL-CORREO-${r.conexion_id}`, beneficiario: "CloudNorte S.A.S.", canal: "correo", sha256: hashToken(token) });
    expect(entrada?.explicacion).toContain("facturas@cloudnorte.example");
    expect(entrada?.explicacion).toContain("R11");

    const [listado] = await listarEnlaces(almacen, AHORA);
    expect(listado).toMatchObject({ estado: "usado", correo: "facturas@cloudnorte.example", conexion_id: r.conexion_id });
    await expect(usarEnlace(almacen, repo, token, { correo: "otro@cloudnorte.example" }, AHORA)).rejects.toThrow(MENSAJE_INVALIDO);
    expect(await vistaEnlace(almacen, repo, token, AHORA)).toBeNull();
  });

  it("proveedor nuevo: el correo solo se registra; no se vincula a ningún beneficiario (R3 y R11 siguen escalando)", async () => {
    const { url } = await crearEnlace(almacen, repo, ADMIN, { nombre: "Lumen Diseño S.A.S." }, AHORA);
    const r = await usarEnlace(almacen, repo, tokenDe(url), { correo: "pagos@lumen.example" }, AHORA);
    expect(r).toMatchObject({ existente: false, correo: "pagos@lumen.example" });
    const bs = (await repo.datosComunes()).beneficiarios;
    expect(beneficiarioDelRemitente({ tipo: "correo", valor: "pagos@lumen.example" }, bs)).toBeNull();
    const entrada = (await repo.registro({ tipo: ["CAMBIO_BENEFICIARIOS"] })).at(-1);
    expect(entrada?.explicacion).toContain("R3");
  });

  it("un correo que ya es de otro proveedor se rechaza sin gastar el enlace", async () => {
    const { url } = await crearEnlace(almacen, repo, ADMIN, { beneficiario_id: "ben-cloudnorte" }, AHORA);
    const token = tokenDe(url);
    await expect(usarEnlace(almacen, repo, token, { correo: "facturas@mesalegal.example" }, AHORA)).rejects.toThrow(MENSAJE_CORREO_OCUPADO);
    const nuevo = await crearEnlace(almacen, repo, ADMIN, { nombre: "Suplantador" }, AHORA);
    await expect(usarEnlace(almacen, repo, tokenDe(nuevo.url), { correo: "billing@cloudnorte.example" }, AHORA)).rejects.toMatchObject({ estado: 409 });
    expect(await correosDe("ben-mesa-legal")).toEqual(["facturas@mesalegal.example"]);
    // El enlace sigue activo: el proveedor puede corregir el correo.
    expect((await usarEnlace(almacen, repo, token, { correo: "billing@cloudnorte.example" }, AHORA)).existente).toBe(true);
    expect(await correosDe("ben-cloudnorte")).toEqual(["billing@cloudnorte.example"]);
  });

  it("valida el correo y el token", async () => {
    const { url } = await crearEnlace(almacen, repo, ADMIN, { beneficiario_id: "ben-cloudnorte" }, AHORA);
    await expect(usarEnlace(almacen, repo, tokenDe(url), { correo: "no-es-correo" }, AHORA)).rejects.toMatchObject({ estado: 400 });
    await expect(usarEnlace(almacen, repo, tokenDe(url), { correo: "a@b.example", extra: 1 }, AHORA)).rejects.toMatchObject({ estado: 400 });
    await expect(usarEnlace(almacen, repo, "x".repeat(43), { correo: "a@b.example" }, AHORA)).rejects.toMatchObject({ estado: 404 });
  });

  it("el correo vinculado sobrevive a «Reiniciar demo», como Telegram", async () => {
    const { url } = await crearEnlace(almacen, repo, ADMIN, { beneficiario_id: "ben-cloudnorte" }, AHORA);
    await usarEnlace(almacen, repo, tokenDe(url), { correo: "facturas@cloudnorte.example" }, AHORA);
    await repo.reiniciar("admin@nebula.example");
    expect(await correosDe("ben-cloudnorte")).toContain("facturas@cloudnorte.example");
  });
});

describe("reglas", () => {
  it("id de conexión: base32 de Crockford, sin letras que se confundan", () => {
    expect(generarConexionId(new Uint8Array([0, 1, 2, 3, 31, 32, 63, 255]))).toBe("PRV-0123-Z0ZZ");
    for (let i = 0; i < 200; i++) expect(generarConexionId()).not.toMatch(/[ILOU]/);
  });

  it("estado: usado gana a vencido; revocado gana a vencido", () => {
    const base = { id: "x", beneficiario_id: null, nombre: "n", creado_por: null, creado_en: AHORA, expira_en: "2026-10-17T00:00:00Z", revocado_en: null, usado_en: null, correo: null, conexion_id: null };
    expect(estadoEnlace(base, AHORA)).toBe("activo");
    expect(estadoEnlace(base, "2026-10-18T00:00:00Z")).toBe("vencido");
    expect(estadoEnlace({ ...base, usado_en: AHORA, correo: "a@b.c", conexion_id: "PRV-0000-0000" }, "2026-10-18T00:00:00Z")).toBe("usado");
    expect(estadoEnlace({ ...base, revocado_en: AHORA }, "2026-10-18T00:00:00Z")).toBe("revocado");
  });
});
