// Lectura del cuerpo con tope (#26, #14): corta apenas pasa el límite y nunca carga en memoria un cuerpo gigante.

import { ErrorSubida } from "@/servicios/subida";

/** Cuerpo completo de la petición, leído por partes. 413 apenas supera `maximo` (aunque no declare su tamaño). */
export async function cuerpoLimitado(req: Request, maximo: number, mensaje: string): Promise<Buffer<ArrayBuffer>> {
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (declarado > maximo) throw new ErrorSubida(413, mensaje);
  if (!req.body) throw new ErrorSubida(400, "El cuerpo está vacío.");
  const partes: Uint8Array[] = [];
  let total = 0;
  const lector = req.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await lector.cancel();
      throw new ErrorSubida(413, mensaje);
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}
