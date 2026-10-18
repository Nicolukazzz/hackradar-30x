// «Probar con facturas de ejemplo» (#162): el catálogo se lee bien, cada factura llega como la mandaría su proveedor
// por el portal (y se paga si cumple), la de un proveedor desconocido llega como carga manual y nada fuera del
// catálogo se puede enviar.

import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import { ninguno } from "@/extraccion/llm/ninguno";
import { extractorReal } from "@/ingesta/pipeline";
import type { Sesion } from "@/lib/auth/permisos";
import type { Repositorio } from "@/repositorio/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { catalogoEjemplos, enviarEjemplo } from "@/servicios/facturas-ejemplo";
import { crearProveedor } from "@/servicios/proveedores";
import { sinVersion } from "@/servicios/reglas";

const AHORA = "2026-10-18T10:00:00-05:00";
const ADMIN: Sesion = { usuario_id: "u-admin", correo: "admin@nebula.example", nombre: "Admin", rol: "admin", limite_aprobacion_usd: null };
const AUTOR = { id: "admin", nombre: "Admin", rol: "Administrador", limite_usd: null, principal: true, iniciales: "AD" };

let repo: Repositorio;
const deps = () => ({ repo, ahora: AHORA, extractor: extractorReal({ llm: ninguno }) });

beforeAll(async () => {
  repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
  const vigentes = await repo.reglasVigentes();
  await repo.guardarReglas(sinVersion({ ...vigentes, presupuesto: { ...vigentes.presupuesto, monto_usd: 50_000_000 } }));
  for (const p of JSON.parse(await readFile("facturas-de-prueba/proveedores.json", "utf8")) as unknown[]) await crearProveedor(repo, p, AUTOR, AHORA);
});

describe("facturas de ejemplo", () => {
  it("el catálogo trae las 41 facturas, solo PDF e imágenes", async () => {
    const c = await catalogoEjemplos();
    expect(c).toHaveLength(41);
    expect(c.filter((f) => f.carpeta === "pagan")).toHaveLength(30);
    expect(c.every((f) => /\.(pdf|png|jpg)$/.test(f.archivo))).toBe(true);
  });

  it("llega por el portal con el correo del proveedor y se paga sola", async () => {
    const r = await enviarEjemplo("andes-fe-2041.pdf", ADMIN, deps());
    expect(r.estado).toBe("PAGAR");
    const doc = await repo.documento(r.ref_interna);
    expect(doc?.canal).toBe("portal");
    expect(doc?.remitente).toEqual({ tipo: "correo", valor: "facturacion@andessoftware.example" });
  });

  it("el proveedor desconocido llega como carga manual de quien la envía y se frena (R3)", async () => {
    const r = await enviarEjemplo("06-proveedor-desconocido-delta.pdf", ADMIN, deps());
    expect(r.estado).toBe("FRENAR");
    expect((await repo.documento(r.ref_interna))?.remitente).toEqual({ tipo: "correo", valor: ADMIN.correo });
  });

  it("no envía nada fuera del catálogo", async () => {
    for (const archivo of ["no-existe.pdf", "../data/empresa.json", "../../package.json", "pagan/andes-fe-2041.pdf"]) {
      await expect(enviarEjemplo(archivo, ADMIN, deps()), archivo).rejects.toThrow("no está en el set de ejemplo");
    }
  });
});
