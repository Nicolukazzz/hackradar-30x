// Genera docs/api-ejemplos.md con respuestas reales de cada endpoint de §12 sobre el lote demo.
//   npx tsx scripts/api/ejemplos.ts
// Listas largas se recortan a los primeros elementos (se indica cuántos se omitieron).

import { writeFile } from "node:fs/promises";

import { decidir } from "@/aprobaciones/decidir";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { obtenerAprobaciones } from "@/servicios/aprobaciones";
import { obtenerBandeja } from "@/servicios/bandeja";
import { evaluarSinRegistrar } from "@/servicios/evaluar";
import { obtenerFactura } from "@/servicios/facturas";
import { procesarPendientes } from "@/servicios/lote";
import { obtenerRegistro, registroACsv } from "@/servicios/registro";
import { obtenerReglas, simularReglas } from "@/servicios/reglas";

function recortar(v: unknown, max = 2): unknown {
  if (Array.isArray(v)) {
    const r = v.slice(0, max).map((x) => recortar(x, max));
    return v.length > max ? [...r, `… ${v.length - max} más`] : r;
  }
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, recortar(x, k === "evaluaciones" || k === "linea_tiempo" ? 11 : max)]));
  return v;
}

const bloque = (titulo: string, nota: string, datos: unknown) =>
  `## ${titulo}\n\n${nota}\n\n\`\`\`json\n${JSON.stringify(recortar(datos), null, 2)}\n\`\`\`\n`;

async function main() {
  const repo = await crearRepositorioMemoria("lote-demo-oct");
  const partes: string[] = [
    "# Ejemplos de respuesta de la API (§12)\n",
    "Generado por `npx tsx scripts/api/ejemplos.ts` sobre `lote-demo-oct` (REPOSITORIO=memoria, EXTRACCION=golden). " +
      "Listas recortadas. Tipos en `src/servicios/*.ts` (`RespuestaBandeja`, `RespuestaFactura`, `RespuestaAprobaciones`, `RespuestaReglas`, `RespuestaRegistro`, `ReporteEvaluacion`). " +
      "Errores: `{ \"error\": \"…\" }` con 400/401/403/404/409.\n",
    "Identidad: `POST /api/aprobaciones/:ref` y `POST /api/reglas` toman al aprobador de la cookie demo `actuar_como` (`POST /api/demo/actuar-como { aprobador_id }`), nunca del body. #25 la reemplaza por la sesión de Supabase.\n",
  ];
  const procesado = await procesarPendientes(repo);
  partes.push(
    bloque("POST /api/procesar", "Procesa los documentos pendientes del escenario. Idempotente.", procesado),
    bloque("GET /api/bandeja", "`?decision=todas|pagar|frenar|escalar&q=`.", await obtenerBandeja(repo)),
    bloque("GET /api/facturas/:ref", "Ejemplo: `INT-2026-000011` (OMI-3381).", await obtenerFactura(repo, "INT-2026-000011")),
    "## GET /api/documentos/:ref/archivo\n\nEl archivo original (PDF, PNG, `.eml`, `.txt` de chat) con su `content-type`. `?adjunto=0` devuelve el PDF dentro de un correo.\n",
    bloque("GET /api/aprobaciones", "`?orden=vencimiento|monto`.", await obtenerAprobaciones(repo)),
  );
  const lf = await decidir(
    { ref: "INT-2026-000008", accion: "aprobar", comentario: "Hito final entregado y revisado.", aprobador_id: "lm" },
    { repo, ahora: "2026-10-16T15:10:00-05:00" },
  );
  const [reglas, simulacion, registro] = [await obtenerReglas(repo), await simularReglas(repo, await repo.reglasVigentes()), await obtenerRegistro(repo)];
  partes.push(
    bloque("POST /api/aprobaciones/:ref", "Cuerpo `{ \"accion\": \"aprobar\"|\"rechazar\", \"comentario\": \"…\", \"agregar_a_lista\"?: true }` → 201 con la `EntradaRegistro` nueva.", lf.entrada),
    bloque("GET /api/reglas", "", reglas),
    bloque("POST /api/reglas/simular", "Cuerpo: `Reglas`. Sin registrar nada.", simulacion),
    "## POST /api/reglas\n\nCuerpo: `Reglas` sin `version` (autoría y fecha las pone el servidor). Solo el aprobador principal. → 201 `{ \"version\": 8, \"reporte\": ReporteEvaluacion }`; 409 con `reporte` si la simulación da pagos fuera de reglas.\n",
    bloque("GET /api/registro", "`?decision=todas|pagar|frenar|escalar|humanas&actor=agente|humano&q=`. Más nuevas primero, agrupadas por día.", registro),
  );
  const csv = registroACsv((await repo.registro()).slice(-2)).trim();
  partes.push(`## GET /api/registro/export.csv · export.json\n\nCSV con BOM y las 15 columnas de §9; JSON con el arreglo completo.\n\n\`\`\`csv\n${csv}\n\`\`\`\n`);
  const omi = (await repo.registro()).find((e) => e.factura_numero === "OMI-3381");
  if (omi?.extraccion) partes.push(bloque("POST /api/evaluar", "Cuerpo `{ \"extraccion\": Extraccion, \"beneficiario_id\"?: string }` → `ResultadoMotor`, sin registrar.", await evaluarSinRegistrar(repo, omi.extraccion)));
  partes.push("## POST /api/ingesta\n\n501 hasta #11.\n\n## POST /api/demo/reiniciar · POST /api/demo/actuar-como\n\nSolo demo (REPOSITORIO=memoria): vuelve al estado inicial / elige con qué aprobador se actúa.\n");
  await writeFile("docs/api-ejemplos.md", partes.join("\n"));
  console.log("docs/api-ejemplos.md escrito");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
