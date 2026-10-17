import { normalizarTexto } from "@/dominio/normalizar";

// Resalta en un texto los fragmentos sospechosos (R10, ámbar) y los datos extraídos (azul), sin HTML crudo.

type Marca = { texto: string; tipo: "sospechoso" | "dato" };

const CLASES = {
  sospechoso: "rounded-[3px] bg-escalada px-0.5 text-escalada-foreground ring-1 ring-escalada-punto/40",
  dato: "rounded-[3px] bg-[#e6eeff] px-0.5 text-inherit",
} as const;

/**
 * Busca sin distinguir mayúsculas ni tildes. Marcas del mismo tipo que se pisan se unen ("Procesar sin" +
 * "sin revisión" = "Procesar sin revisión"); entre tipos distintos gana la primera (sospechoso va primero).
 */
export function Resaltado({ texto, marcas }: { texto: string; marcas: Marca[] }) {
  const normal = normalizarTexto(texto);
  const tramos: { inicio: number; fin: number; tipo: Marca["tipo"] }[] = [];
  for (const m of marcas) {
    const aguja = normalizarTexto(m.texto.trim());
    if (aguja.length < 3) continue;
    for (let i = normal.indexOf(aguja); i >= 0; i = normal.indexOf(aguja, i + aguja.length)) {
      const fin = i + aguja.length;
      const pisa = tramos.find((t) => i <= t.fin && fin >= t.inicio);
      if (!pisa) tramos.push({ inicio: i, fin, tipo: m.tipo });
      else if (pisa.tipo === m.tipo) {
        pisa.inicio = Math.min(pisa.inicio, i);
        pisa.fin = Math.max(pisa.fin, fin);
      }
    }
  }
  tramos.sort((a, b) => a.inicio - b.inicio);
  // normalizarTexto conserva la longitud de cada letra salvo las tildes combinadas; los textos del dataset vienen
  // en NFC, así que los índices coinciden. Si no coinciden, se muestra sin resaltar antes que cortar mal.
  if (normal.length !== texto.length) return <>{texto}</>;
  const partes: React.ReactNode[] = [];
  let cursor = 0;
  for (const t of tramos) {
    if (t.inicio > cursor) partes.push(texto.slice(cursor, t.inicio));
    partes.push(
      <mark key={t.inicio} className={CLASES[t.tipo]} data-tipo={t.tipo}>
        {texto.slice(t.inicio, t.fin)}
      </mark>,
    );
    cursor = t.fin;
  }
  partes.push(texto.slice(cursor));
  return <>{partes}</>;
}

export type { Marca };
