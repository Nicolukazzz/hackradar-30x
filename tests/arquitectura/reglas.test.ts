import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Issue #5: el motor es código puro. Sin extractor, sin UI, sin disco, sin red.
const CARPETAS = ["src/reglas", "src/registro"];
const PROHIBIDO = [/from "@\/extraccion/, /from "@\/app/, /from "node:/, /from "fs/, /\bfetch\(/, /\bprocess\.env\b/];
// cargar.ts usa node:fs; solo se permite importar sus tipos.
const SOLO_TIPOS = /^import (?!type ).*from "@\/dominio\/cargar"/m;

describe("motor sin dependencias impuras", () => {
  it.each(CARPETAS)("%s no importa extracción, app, fs ni red", async (carpeta) => {
    const archivos = (await readdir(carpeta)).filter((n) => n.endsWith(".ts"));
    expect(archivos.length).toBeGreaterThan(0);
    for (const nombre of archivos) {
      const codigo = await readFile(path.join(carpeta, nombre), "utf8");
      for (const p of PROHIBIDO) expect(codigo, `${nombre}: ${p}`).not.toMatch(p);
      expect(codigo, `${nombre}: importar cargar solo como tipo`).not.toMatch(SOLO_TIPOS);
    }
  });
});
