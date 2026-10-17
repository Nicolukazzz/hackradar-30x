import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Especificación §3: dominio y reglas reciben `ahora` inyectado. Este test es la red de
// seguridad en CI (la regla ESLint equivalente vive en eslint.config.mjs).
const CARPETAS = ["src/dominio", "src/reglas"];
const PROHIBIDO = /Date\.now\s*\(|new\s+Date\s*\(\s*\)/;

function archivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosTs(ruta);
    return /\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

describe("reloj inyectado", () => {
  it("el detector reconoce los patrones prohibidos", () => {
    expect(PROHIBIDO.test("const t = Date.now();")).toBe(true);
    expect(PROHIBIDO.test("const d = new Date();")).toBe(true);
    expect(PROHIBIDO.test("const d = new Date(ctx.ahora);")).toBe(false);
  });

  it.each(CARPETAS)("%s no lee el reloj", (carpeta) => {
    const infractores = archivosTs(carpeta).filter((ruta) =>
      PROHIBIDO.test(readFileSync(ruta, "utf8")),
    );
    expect(infractores).toEqual([]);
  });
});
