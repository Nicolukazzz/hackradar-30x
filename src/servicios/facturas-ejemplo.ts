// «Probar con facturas de ejemplo» (#162): el jurado prueba la app sin descargar archivos ni entrar a cada portal. Lee
// el catálogo de `facturas-de-prueba/` (lo genera scripts/facturas-prueba) y envía la factura elegida por el mismo
// camino que el portal de su proveedor: canal `portal` y remitente = el correo del proveedor, así R11 la verifica igual
// que si la hubiera subido él. La de un proveedor desconocido llega como carga manual de quien la envía.
// Solo se puede enviar un archivo que esté en el catálogo: el nombre nunca arma una ruta libre.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { Sesion } from "@/lib/auth/permisos";

import { type DependenciasSubida, ErrorSubida, type ResultadoSubida, subirDocumento } from "./subida";

/** Carpeta del set, relativa a la raíz del proyecto (viaja con el deploy, como `data/`). */
export const CARPETA_EJEMPLOS = "facturas-de-prueba";

const EntradaCatalogoSchema = z.strictObject({
  archivo: z.string().regex(/^[a-z0-9][a-z0-9.-]*\.(pdf|png|jpg)$/),
  carpeta: z.enum(["pagan", "trampas"]),
  proveedor: z.string().min(1),
  correo: z.email().nullable(),
  canal: z.enum(["portal", "carga_manual"]),
  numero: z.string().nullable(),
  formato: z.enum(["pdf", "png", "jpg"]),
  efecto: z.enum(["limpio", "escaneo", "foto", "borroso"]),
  total: z.string().nullable(),
  esperado: z.enum(["PAGAR", "FRENAR", "ESCALAR", "RECHAZADA_NO_FACTURA"]),
  reglas: z.array(z.string()),
  motivo: z.string(),
});

/** Una factura del set con lo que se espera que decida el agente. */
export type FacturaEjemplo = z.infer<typeof EntradaCatalogoSchema>;

/** Catálogo validado. Sin carpeta (instalación sin el set) devuelve lista vacía. */
export async function catalogoEjemplos(raiz: string = process.cwd()): Promise<FacturaEjemplo[]> {
  let crudo: string;
  try {
    // turbopackIgnore: lectura en tiempo de ejecución de un archivo fijo del proyecto.
    crudo = await readFile(path.join(/*turbopackIgnore: true*/ raiz, CARPETA_EJEMPLOS, "facturas.json"), "utf8");
  } catch {
    return [];
  }
  return z.array(EntradaCatalogoSchema).parse(JSON.parse(crudo));
}

/**
 * Envía una factura del catálogo como lo haría su proveedor por el portal y devuelve la decisión del agente. Lanza
 * 400 si el archivo no está en el catálogo. La de un proveedor desconocido llega como carga manual de `sesion`.
 */
export async function enviarEjemplo(archivo: string, sesion: Sesion, deps: DependenciasSubida, raiz: string = process.cwd()): Promise<ResultadoSubida & { factura: FacturaEjemplo }> {
  const factura = (await catalogoEjemplos(raiz)).find((f) => f.archivo === archivo);
  if (!factura) throw new ErrorSubida(400, "Esa factura no está en el set de ejemplo.");
  const ruta = path.join(/*turbopackIgnore: true*/ raiz, CARPETA_EJEMPLOS, factura.carpeta, factura.archivo);
  const bytes = new Uint8Array(await readFile(/*turbopackIgnore: true*/ ruta));
  const origen =
    factura.canal === "portal" && factura.correo
      ? { canal: "portal" as const, remitente: { tipo: "correo" as const, valor: factura.correo } }
      : undefined;
  const r = await subirDocumento({ bytes, nombre: factura.archivo }, sesion, deps, origen);
  return { ...r, factura };
}
