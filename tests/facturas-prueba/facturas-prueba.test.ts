// Facturas de prueba (`facturas-de-prueba/`, scripts/facturas-prueba): cada PDF, subido por el portal de su proveedor,
// termina en lo que promete su README. Corre la app de verdad (ingesta, parser sin IA y motor), sin LLM: las imágenes
// las lee el modelo en producción y aquí se omiten.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { relojFijo } from "@/dominio/reloj";
import type { DecisionAgente, EntradaRegistro, IdRegla } from "@/dominio/tipos";
import { ninguno } from "@/extraccion/llm/ninguno";
import { ingerir } from "@/ingesta/ingerir";
import { extractorReal, procesarDocumento } from "@/ingesta/pipeline";
import type { Repositorio } from "@/repositorio/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { crearProveedor } from "@/servicios/proveedores";
import { sinVersion } from "@/servicios/reglas";

const CARPETA = path.join("facturas-de-prueba");
const AHORA = "2026-10-18T10:00:00-05:00";
const ADMIN = { id: "admin", nombre: "Admin de prueba", rol: "Administrador", limite_usd: null, principal: true, iniciales: "AP" };

type Proveedor = { nombre: string; correos: string[] };

/** Esperado de cada trampa en PDF (las imágenes las lee el modelo: no se prueban sin LLM). */
const TRAMPAS: Record<string, { decision: DecisionAgente; reglas: IdRegla[]; manual?: true }> = {
  "02-no-cuadra-brightpath-bp-1045.pdf": { decision: "FRENAR", reglas: ["R5"] },
  "03-cuenta-nueva-camila-cc-21.pdf": { decision: "ESCALAR", reglas: ["R4"] },
  "04-sobre-limite-vertice-fe-118.pdf": { decision: "ESCALAR", reglas: ["R9"] },
  "05-instruccion-oculta-andes-fe-2050.pdf": { decision: "ESCALAR", reglas: ["R10"] },
  "06-proveedor-desconocido-delta.pdf": { decision: "FRENAR", reglas: ["R3"], manual: true },
  "08-suma-no-cuadra-maya-a-7320.pdf": { decision: "ESCALAR", reglas: ["R1"] },
  "09-moneda-distinta-tropical-ts-219.pdf": { decision: "ESCALAR", reglas: ["R5"] },
  "11-no-es-factura-folleto-maya.pdf": { decision: "RECHAZADA_NO_FACTURA", reglas: [] },
};

let repo: Repositorio;
let proveedores: Proveedor[];
const reloj = relojFijo(AHORA);

/** El proveedor que cobra, por el prefijo del archivo (`andes-…`, `05-…-andes-…`). */
function correoDe(archivo: string): string {
  const nombre: Record<string, string> = {
    andes: "Andes Software", camila: "Camila Restrepo", maya: "Logística Maya", tropical: "Tropical Sound", pampa: "Pampa Code",
    cordillera: "Cordillera Data", inti: "Inti Consultores", brightpath: "Brightpath", costa: "Costa Azul", nodo: "Nodo Verde", vertice: "Vértice",
  };
  const clave = Object.keys(nombre).find((k) => archivo.includes(`${k}-`) || archivo.includes(`-${k}.`)) ?? "";
  const p = proveedores.find((x) => x.nombre.startsWith(nombre[clave] ?? "?"));
  if (!p) throw new Error(`sin proveedor para ${archivo}`);
  return p.correos[0]!;
}

/** Sube un PDF como lo hace el portal (#85): canal portal, remitente = correo del proveedor. */
async function subir(sub: string, archivo: string, manual = false): Promise<EntradaRegistro> {
  const bytes = await readFile(path.join(CARPETA, sub, archivo));
  const doc = await ingerir(
    {
      canal: manual ? "carga_manual" : "portal",
      remitente: { tipo: "correo", valor: manual ? "admin@nebula.example" : correoDe(archivo) },
      recibido_en: AHORA,
      adjuntos: [{ nombre: archivo, mime: "application/pdf", bytes_base64: bytes.toString("base64") }],
    },
    { repo, reloj },
  );
  return procesarDocumento(doc.ref_interna, { repo, ahora: AHORA, extractor: extractorReal({ llm: ninguno }) });
}

beforeAll(async () => {
  // Escenario del CI sin documentos: aporta reglas v7 y tasas fijas. El presupuesto sube para que alcance para todo.
  repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
  const vigentes = await repo.reglasVigentes();
  await repo.guardarReglas(sinVersion({ ...vigentes, presupuesto: { ...vigentes.presupuesto, monto_usd: 50_000_000 } }));
  proveedores = JSON.parse(await readFile(path.join(CARPETA, "proveedores.json"), "utf8")) as Proveedor[];
  for (const p of proveedores) await crearProveedor(repo, p, ADMIN, AHORA);
});

describe("facturas de prueba", () => {
  it("cada PDF de pagan/ se paga solo, sin LLM", async () => {
    const pdfs = (await readdir(path.join(CARPETA, "pagan"))).filter((a) => a.endsWith(".pdf")).sort();
    expect(pdfs.length).toBeGreaterThanOrEqual(20);
    for (const archivo of pdfs) {
      const e = await subir("pagan", archivo);
      expect({ archivo, decision: e.decision, fallaron: e.reglas_que_fallaron }).toEqual({ archivo, decision: "PAGAR", fallaron: [] });
    }
  });

  it("cada trampa en PDF termina en lo que dice el README", async () => {
    for (const [archivo, esperado] of Object.entries(TRAMPAS)) {
      const e = await subir("trampas", archivo, esperado.manual);
      expect({ archivo, decision: e.decision }).toEqual({ archivo, decision: esperado.decision });
      for (const r of esperado.reglas) expect(e.reglas_que_fallaron, archivo).toContain(r);
    }
  });

  it("solo hay PDF e imágenes", async () => {
    for (const sub of ["pagan", "trampas"]) {
      for (const a of await readdir(path.join(CARPETA, sub))) expect(a, sub).toMatch(/\.(pdf|png|jpg)$/);
    }
  });
});
