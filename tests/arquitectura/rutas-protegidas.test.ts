import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { API_PUBLICAS } from "@/lib/auth/rutas";

// Issue #25 (mínimo privilegio): cada route handler de src/app/api declara su rol con `conRol`,
// salvo las rutas públicas declaradas en API_PUBLICAS (webhooks con verificación propia). Migradas en #26.
const RAIZ_API = "src/app/api";

async function rutas(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const hijos = await Promise.all(
    entradas.map((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return rutas(p);
      return Promise.resolve(/^route\.(ts|tsx)$/.test(e.name) ? [p] : []);
    }),
  );
  return hijos.flat();
}

function urlDe(archivo: string): string {
  const relativa = path.relative(RAIZ_API, path.dirname(archivo)).split(path.sep).filter((s) => !/^\(.*\)$/.test(s));
  return ["/api", ...relativa].join("/").replace(/\/$/, "");
}

describe("rutas de API protegidas", () => {
  it("toda ruta no pública usa conRol", async () => {
    const pendientes: string[] = [];
    for (const archivo of await rutas(RAIZ_API)) {
      const url = urlDe(archivo);
      if (API_PUBLICAS.some((p) => url === p || url.startsWith(`${p}/`))) continue;
      const codigo = await readFile(archivo, "utf8");
      const usaConRol = /from "@\/lib\/auth\/ruta"/.test(codigo) && /conRol\(/.test(codigo);
      if (!usaConRol) pendientes.push(archivo);
    }
    expect(pendientes).toEqual([]);
  });
});
