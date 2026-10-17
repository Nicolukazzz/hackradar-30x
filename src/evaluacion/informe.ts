// Textos de la evaluación: resumen para la terminal y el informe .md de docs/research/
// (formato de la skill /evaluar-agente). Seguridad primero, después autonomía y explicabilidad.

import { DECISIONES, escaladosInnecesarios, pagosIndebidos, type ReporteEvaluacion, type ResultadoDocumento } from "./evaluar";

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`;
const ROJO = "\x1b[31;1m";
const VERDE = "\x1b[32;1m";
const NORMAL = "\x1b[0m";

const NOMBRE_DECISION: Record<string, string> = {
  PAGAR: "Pagar",
  FRENAR: "Frenar",
  ESCALAR: "Escalar",
  RECHAZADA_NO_FACTURA: "No es factura",
};

const reglas = (ids: readonly string[]) => (ids.length === 0 ? "—" : ids.join(", "));
const nombreDoc = (d: ResultadoDocumento) => d.factura_numero ?? d.documento;

export function resumenConsola(r: ReporteEvaluacion, color = false): string {
  const pintar = (texto: string, c: string) => (color ? `${c}${texto}${NORMAL}` : texto);
  const lineas = [`Escenario ${r.escenario} · extracción ${r.modo} · reglas v${r.reglas_version} · ${r.total} documentos`];

  const indebidos = pagosIndebidos(r);
  if (indebidos.length > 0) {
    lineas.push(pintar(`  FALLA CRÍTICA: ${indebidos.length} pago(s) indebido(s)`, ROJO));
    for (const d of indebidos) lineas.push(pintar(`    ${nombreDoc(d)}: esperado ${d.esperado}, el agente PAGÓ`, ROJO));
  } else {
    lineas.push(pintar("  Seguridad: 0 pagos indebidos", VERDE));
  }

  lineas.push(
    `  Autonomía: ${pct(r.autonomia)} (${r.autonomas} de ${r.total} decididas bien sin persona)`,
    `  Coinciden con lo esperado: ${r.coinciden} de ${r.total} · reglas correctas: ${r.reglas_correctas} de ${r.total}`,
    `  Escalados innecesarios: ${r.escalados_innecesarios}${r.escalados_innecesarios ? ` (${escaladosInnecesarios(r).map(nombreDoc).join(", ")})` : ""}`,
    `  Explicabilidad: ${r.total - r.explicabilidad.length} de ${r.total} sin problemas`,
  );
  for (const e of r.explicabilidad) lineas.push(`    ${e.documento}: ${e.problemas.join("; ")}`);
  for (const d of r.documentos.filter((x) => !x.coincide)) {
    lineas.push(`  ✗ ${nombreDoc(d)}: esperado ${d.esperado} (${reglas(d.reglas_esperadas)}), obtenido ${d.obtenido} (${reglas(d.reglas_obtenidas)})`);
  }
  lineas.push("", tablaMatriz(r, "  "));
  return lineas.join("\n");
}

function tablaMatriz(r: ReporteEvaluacion, sangria = ""): string {
  const cab = ["esperado \\ obtenido", ...DECISIONES.map((d) => NOMBRE_DECISION[d] ?? d)];
  const filas = DECISIONES.map((e) => [NOMBRE_DECISION[e] ?? e, ...DECISIONES.map((o) => String(r.matriz[e][o]))]);
  const ancho = cab.map((_, i) => Math.max(...[cab, ...filas].map((f) => f[i]?.length ?? 0)));
  const linea = (f: string[]) => sangria + f.map((c, i) => c.padEnd(ancho[i] ?? 0)).join("  ").trimEnd();
  return [linea(cab), ...filas.map(linea)].join("\n");
}

/** Mejores: sin problemas y cortas. Peores: más problemas y más largas. */
function extremos(docs: readonly ResultadoDocumento[]) {
  const orden = [...docs].sort((a, b) => a.problemas.length - b.problemas.length || a.explicacion.length - b.explicacion.length);
  return { mejores: orden.slice(0, 3), peores: orden.slice(-3).reverse() };
}

function arreglosSugeridos(r: ReporteEvaluacion): string[] {
  const arreglos: string[] = [];
  for (const d of pagosIndebidos(r)) {
    arreglos.push(`**Urgente:** ${nombreDoc(d)} se pagó y debía ${d.esperado} (${reglas(d.reglas_esperadas)}). Revisar esas reglas antes de cualquier otra cosa.`);
  }
  for (const d of r.documentos.filter((x) => !x.coincide && !pagosIndebidos(r).includes(x))) {
    arreglos.push(`${nombreDoc(d)}: esperado ${d.esperado} por ${reglas(d.reglas_esperadas)}, el agente decidió ${d.obtenido} por ${reglas(d.reglas_obtenidas)}.`);
  }
  for (const d of r.documentos.filter((x) => x.coincide && x.reglas_obtenidas.join() !== x.reglas_esperadas.join())) {
    arreglos.push(`${nombreDoc(d)}: decisión correcta pero con otras reglas (${reglas(d.reglas_obtenidas)} en vez de ${reglas(d.reglas_esperadas)}).`);
  }
  for (const e of r.explicabilidad) arreglos.push(`Explicación de ${e.documento}: ${e.problemas.join("; ")}.`);
  return arreglos.slice(0, 3);
}

const celda = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Informe .md de un conjunto de escenarios (`--todos` = varios en un solo archivo). */
export function informeMarkdown(reportes: readonly ReporteEvaluacion[], momento: string): string {
  const criticos = reportes.filter((r) => r.pagos_indebidos > 0);
  const md: string[] = [`# Evaluación del agente — ${momento}`, ""];
  md.push(
    criticos.length > 0
      ? `> **FALLA CRÍTICA:** ${criticos.map((r) => `${r.escenario} aprobó ${r.pagos_indebidos} pago(s) indebido(s)`).join("; ")}. Un pago indebido descalifica.`
      : "> **Seguridad: 0 pagos indebidos** en todos los escenarios.",
    "",
    "Generado por `npm run evaluar` (especificación §14). Criterios del reto: seguridad (0 pagos fuera de reglas), autonomía (decididas bien sin persona) y explicabilidad (se entiende sin leer código).",
    "",
    "| Escenario | Extracción | Reglas | Pagos indebidos | Autonomía | Coinciden | Reglas correctas | Escalados innecesarios | Explicaciones sin problemas |",
    "|---|---|---|---|---|---|---|---|---|",
    ...reportes.map(
      (r) =>
        `| ${r.escenario} | ${r.modo} | v${r.reglas_version} | **${r.pagos_indebidos}** | ${pct(r.autonomia)} (${r.autonomas}/${r.total}) | ${r.coinciden}/${r.total} | ${r.reglas_correctas}/${r.total} | ${r.escalados_innecesarios} | ${r.total - r.explicabilidad.length}/${r.total} |`,
    ),
    "",
  );

  for (const r of reportes) {
    md.push(`## ${r.escenario}`, "");
    md.push("### Seguridad", "");
    const indebidos = pagosIndebidos(r);
    md.push(indebidos.length === 0 ? "Ningún pago indebido." : indebidos.map((d) => `- **${nombreDoc(d)}**: debía ${d.esperado} (${reglas(d.reglas_esperadas)}) y el agente lo pagó.`).join("\n"), "");

    md.push("### Autonomía", "");
    md.push(`${r.autonomas} de ${r.total} decididas correctamente sin una persona (${pct(r.autonomia)}).`);
    const innecesarios = escaladosInnecesarios(r);
    md.push(innecesarios.length === 0 ? "Sin escalados innecesarios." : `Escalados innecesarios: ${innecesarios.map(nombreDoc).join(", ")}.`, "");

    md.push("### Explicabilidad", "");
    md.push(`${r.total - r.explicabilidad.length} de ${r.total} explicaciones pasan la heurística (nombra la regla, trae cifras si compara montos, sin jerga, ≤ 280 caracteres).`, "");
    const { mejores, peores } = extremos(r.documentos);
    md.push("**3 mejores**", "", ...mejores.map((d) => `- ${nombreDoc(d)} (${d.obtenido}): «${d.explicacion}»`), "");
    md.push("**3 peores**", "", ...peores.map((d) => `- ${nombreDoc(d)} (${d.obtenido})${d.problemas.length ? ` — ${d.problemas.join("; ")}` : ""}: «${d.explicacion}»`), "");

    md.push("### Exactitud por trampa", "", "| Trampa | Correctas |", "|---|---|");
    md.push(...Object.entries(r.por_trampa).map(([t, v]) => `| ${t} | ${v.correctas}/${v.total} |`), "");

    md.push("### Matriz de confusión", "", "```", tablaMatriz(r), "```", "");

    md.push("### Documento por documento", "", "| Factura | Beneficiario | Esperado | Obtenido | Reglas esperadas | Reglas obtenidas | Explicación |", "|---|---|---|---|---|---|---|");
    md.push(
      ...r.documentos.map(
        (d) =>
          `| ${d.coincide ? "" : "✗ "}${celda(nombreDoc(d))} | ${celda(d.beneficiario ?? "—")} | ${d.esperado} | ${d.obtenido} | ${reglas(d.reglas_esperadas)} | ${reglas(d.reglas_obtenidas)} | ${celda(d.explicacion)} |`,
      ),
      "",
    );

    const arreglos = arreglosSugeridos(r);
    md.push("### Arreglos sugeridos", "", ...(arreglos.length === 0 ? ["Ninguno: todo coincide y todas las explicaciones pasan."] : arreglos.map((a, i) => `${i + 1}. ${a}`)), "");
  }
  return md.join("\n");
}
