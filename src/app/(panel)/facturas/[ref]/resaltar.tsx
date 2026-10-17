// Resalta en un texto los fragmentos sospechosos (R10, ámbar) y los datos extraídos (azul), sin HTML crudo.
//
// Los fragmentos de R10 llegan tal como aparecen en el documento (el detector del motor los recorta del
// original), así que se buscan literalmente: sin normalizar no hay índices que traducir y nunca se corta
// mal un texto con tildes descompuestas o caracteres que cambian de largo al pasar a minúsculas.

export type Marca = { texto: string; tipo: "sospechoso" | "dato" };
type Tramo = { inicio: number; fin: number; tipo: Marca["tipo"] };

const CLASES = {
  sospechoso: "rounded-[3px] bg-escalada px-0.5 text-escalada-foreground ring-1 ring-escalada-punto/40",
  dato: "rounded-[3px] bg-dato px-0.5 text-inherit",
} as const;

/** Todas las apariciones literales de `aguja` en `texto`. */
function apariciones(texto: string, aguja: string): { inicio: number; fin: number }[] {
  const r: { inicio: number; fin: number }[] = [];
  if (aguja.length < 3) return r;
  for (let i = texto.indexOf(aguja); i >= 0; i = texto.indexOf(aguja, i + aguja.length)) r.push({ inicio: i, fin: i + aguja.length });
  return r;
}

/** Une tramos que se pisan (no los que solo se tocan) en orden. */
function unir(lista: Tramo[]): Tramo[] {
  const r: Tramo[] = [];
  for (const t of [...lista].sort((a, b) => a.inicio - b.inicio)) {
    const ultimo = r.at(-1);
    if (ultimo && t.inicio < ultimo.fin) ultimo.fin = Math.max(ultimo.fin, t.fin);
    else r.push({ ...t });
  }
  return r;
}

/**
 * Tramos sin solaparse, en orden: los del mismo tipo que se pisan se unen ("Procesar sin" + "sin revisión"
 * = "Procesar sin revisión"); un dato que pisa un fragmento sospechoso se descarta (el sospechoso manda).
 */
export function tramos(texto: string, marcas: readonly Marca[]): Tramo[] {
  const de = (tipo: Marca["tipo"]): Tramo[] =>
    marcas.filter((m) => m.tipo === tipo).flatMap((m) => apariciones(texto, m.texto.trim()).map((a) => ({ ...a, tipo })));
  const sospechosos = unir(de("sospechoso"));
  // Cada dato se descarta por separado si pisa un sospechoso, y recién después se unen los que quedan.
  const datos = unir(de("dato").filter((d) => !sospechosos.some((s) => d.inicio < s.fin && d.fin > s.inicio)));
  return [...sospechosos, ...datos].sort((a, b) => a.inicio - b.inicio);
}

export function Resaltado({ texto, marcas }: { texto: string; marcas: Marca[] }) {
  const partes: React.ReactNode[] = [];
  let cursor = 0;
  for (const t of tramos(texto, marcas)) {
    if (t.inicio > cursor) partes.push(texto.slice(cursor, t.inicio));
    partes.push(
      <mark key={`${t.tipo}-${t.inicio}`} className={CLASES[t.tipo]} data-tipo={t.tipo}>
        {texto.slice(t.inicio, t.fin)}
      </mark>,
    );
    cursor = t.fin;
  }
  partes.push(texto.slice(cursor));
  return <>{partes}</>;
}
