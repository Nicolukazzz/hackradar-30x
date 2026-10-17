import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vitest";

// #84: el nombre de la empresa sale de la base (Ajustes → Datos de la empresa), nunca escrito en pantallas.
// Si este test falla, usar `obtenerEmpresa()` (src/app/_datos/empresa.ts) en vez del texto fijo.

const RAIZ = path.resolve(__dirname, "../..");
const CARPETAS = ["src/app", "src/components"];

async function archivos(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true });
  const todos = await Promise.all(
    entradas.map((e) => (e.isDirectory() ? archivos(path.join(dir, e.name)) : Promise.resolve(/\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []))),
  );
  return todos.flat();
}

it("ninguna pantalla ni componente escribe «Nébula» a mano", async () => {
  const lista = (await Promise.all(CARPETAS.map((c) => archivos(path.join(RAIZ, c))))).flat();
  expect(lista.length).toBeGreaterThan(20);
  const conNombre: string[] = [];
  for (const f of lista) if (/N[ée]bula/.test(await readFile(f, "utf8"))) conNombre.push(path.relative(RAIZ, f));
  expect(conNombre).toEqual([]);
});
