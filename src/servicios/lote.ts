// Orquestador de lote: "Procesar facturas nuevas" (§12 POST /api/procesar, §8 pasos 5–7).
// Toma los documentos del escenario que aún no se procesaron, corre el motor en orden de llegada
// y agrega una DECISION_AGENTE por documento al registro.
//
// Extracción: EXTRACCION=golden (por defecto) usa la extracción esperada del escenario, para que la
// demo dé exactamente el resultado del prototipo sin gastar LLM. EXTRACCION=real usa el extractor de #4
// (parser sin IA + LLM_PROVIDER) sobre los archivos originales.

import { avisarEscaladas } from "@/avisos";
import type { DecisionAgente, DocumentoRecibido, Extraccion } from "@/dominio/tipos";
import { cacheEnDisco } from "@/extraccion/cache";
import { extraer } from "@/extraccion/extraer";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";
import { procesarLote } from "@/reglas/motor";
import type { Repositorio } from "@/repositorio/repositorio";

/** Cuántos documentos se procesaron y cuántos quedaron en cada decisión. */
export type ResumenLote = {
  procesadas: number;
  resumen: Record<DecisionAgente, number>;
};

/** «Procesar facturas nuevas» del modo demo: decide los documentos del escenario que faltan, en orden de llegada. */
export async function procesarPendientes(repo: Repositorio): Promise<ResumenLote> {
  // En exclusiva: dos "Procesar" seguidos (doble clic) no procesan dos veces ni chocan en los ids.
  return repo.enExclusiva(() => procesar(repo));
}

async function procesar(repo: Repositorio): Promise<ResumenLote> {
  const [pendientes, datos, reglas, historial, esc] = await Promise.all([
    repo.pendientes(),
    repo.datosComunes(),
    repo.reglasVigentes(),
    repo.registro(),
    repo.escenario(),
  ]);
  const resumen: Record<DecisionAgente, number> = { PAGAR: 0, FRENAR: 0, ESCALAR: 0, RECHAZADA_NO_FACTURA: 0 };
  if (pendientes.length === 0 || !esc) return { procesadas: 0, resumen };

  const docs: { doc: DocumentoRecibido; ext: Extraccion }[] = [];
  if (process.env.EXTRACCION === "real") {
    // Una por vez: los LLM gratis limitan peticiones por minuto. Los adjuntos se resuelven desde la carpeta del escenario.
    const deps = { llm: proveedorDesdeEntorno(), cache: cacheEnDisco(), dirBase: esc.carpeta };
    for (const p of pendientes) docs.push({ doc: p.doc, ext: await extraer(p.doc, deps) });
  } else {
    docs.push(...pendientes.map((p) => ({ doc: p.doc, ext: p.ext })));
  }
  // `ahora` del escenario: la demo decide como si fuera el 16-oct-2026 a las 09:24 (determinista).
  const { resultados, entradas } = procesarLote(docs, { datos, reglas, historial, ahora: esc.config.ahora });

  // Primero la decisión, después el documento: un documento nunca queda "procesado" sin su DECISION_AGENTE.
  const porRef = new Map(docs.map((d) => [d.doc.ref_interna, d.doc]));
  for (const e of entradas) {
    await repo.agregarEntrada(e);
    const doc = porRef.get(e.ref_interna);
    if (doc) await repo.guardarDocumento(doc);
  }
  avisarEscaladas(entradas, esc.config.ahora); // #68: a quien aprueba, en segundo plano
  for (const r of resultados) resumen[r.decision]++;
  return { procesadas: entradas.length, resumen };
}
