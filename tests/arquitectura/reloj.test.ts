import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

import { CARPETAS_SIN_RELOJ } from "../../eslint.config.mjs";

// Especificación §3 y §5 (invariante 4): la lógica de decisión no lee el reloj.
// Corre la misma regla de ESLint (AST, ignora comentarios y strings) para que CI falle aunque nadie corra lint.
// Las carpetas pueden estar vacías al principio (solo .gitkeep).
const eslint = new ESLint({ errorOnUnmatchedPattern: false });

async function erroresDeReloj(codigo: string, ruta: string) {
  const [resultado] = await eslint.lintText(codigo, { filePath: ruta });
  return (resultado?.messages ?? []).filter((m) => m.ruleId === "no-restricted-syntax");
}

describe("reloj inyectado", () => {
  it.each([
    "export const t = () => Date.now();",
    "export const t = () => Date['now']();",
    "export const t = () => globalThis.Date.now();",
    "export const d = () => new Date();",
    "export const d = () => new Date;",
  ])("detecta %s", async (codigo) => {
    expect(await erroresDeReloj(codigo, "src/reglas/prueba.ts")).toHaveLength(1);
  });

  it("permite fechas a partir de `ahora` y menciones en comentarios", async () => {
    const codigo = "// nunca usar Date.now()\nexport const d = (ahora: string) => new Date(ahora);";
    expect(await erroresDeReloj(codigo, "src/dominio/reloj.ts")).toEqual([]);
  });

  it("no aplica fuera de las carpetas deterministas", async () => {
    expect(await erroresDeReloj("export const t = () => Date.now();", "src/app/prueba.ts")).toEqual([]);
  });

  it("ninguna carpeta determinista lee el reloj", async () => {
    const resultados = await eslint.lintFiles(CARPETAS_SIN_RELOJ.map((c) => `src/${c}`));
    const infractores = resultados
      .filter((r) => r.messages.some((m) => m.ruleId === "no-restricted-syntax"))
      .map((r) => r.filePath);
    expect(infractores).toEqual([]);
  });
});
