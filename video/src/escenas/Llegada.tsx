import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { Encabezado } from "../componentes/Encabezado";
import { Fondo } from "../componentes/Fondo";
import { Pildora } from "../componentes/Pildora";
import { color, fuenteMono, sombra, type Estado } from "../tema";

// 5 · Llegan solas (14 s): la Bandeja recibe facturas en vivo; cada una entra «Leyendo…» y a los segundos queda con su
// estado y el motivo en una línea. Facturas del set de prueba y de la grabación del portal.
type Fila = { hora: string; canal: string; proveedor: string; numero: string; monto: string; estado: Estado; motivo: string; llega?: number };

const nuevas: Fila[] = [
  { hora: "09:59", canal: "Portal", proveedor: "CloudNorte S.A.S.", numero: "INV-2216", monto: "USD 1.240,00", estado: "pagada", motivo: "Cuadra con la OC-118 y la cuenta registrada", llega: 0.8 },
  { hora: "10:00", canal: "WhatsApp", proveedor: "Diego Herrera", numero: "F-0106", monto: "MXN 38.000,00", estado: "frenada", motivo: "Ya cobró este mes lo mismo con otro número", llega: 3.6 },
  { hora: "10:01", canal: "Correo", proveedor: "Mesa Legal S.A.S.", numero: "ML-560", monto: "COP 5.250.000", estado: "escalada", motivo: "Traía instrucciones ocultas para el agente", llega: 6.4 },
  { hora: "10:02", canal: "Portal", proveedor: "Lumen Diseño S.A.S.", numero: "LUM-0007", monto: "USD 95,00", estado: "escalada", motivo: "Proveedor nuevo: la primera la decide una persona", llega: 9.2 },
];
const previas: Fila[] = [
  { hora: "09:23", canal: "Telegram", proveedor: "Estudio Sonoro Ltda.", numero: "ES-4410", monto: "BRL 36.000,00", estado: "frenada", motivo: "Sin presupuesto disponible este mes" },
  { hora: "09:20", canal: "Portal", proveedor: "Lucía Fernández", numero: "LF-2026-10", monto: "USD 4.500,00", estado: "escalada", motivo: "Supera el pago automático de USD 3.000" },
  { hora: "09:17", canal: "Correo", proveedor: "Mesa Legal S.A.S.", numero: "ML-552", monto: "COP 5.250.000", estado: "pagada", motivo: "Cuadra con el honorario acordado" },
  { hora: "09:14", canal: "Portal", proveedor: "Ana María Gómez", numero: "FAC-1041", monto: "COP 8.400.000", estado: "pagada", motivo: "Cuadra con el contrato y la cuenta" },
];
const ALTO = 104;
const LEER = 1.6; // segundos que se ve «Leyendo…»

const FilaVista: React.FC<{ f: Fila; y: number; aparece: number; resuelto: number }> = ({ f, y, aparece, resuelto }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: y,
      height: ALTO,
      display: "flex",
      alignItems: "center",
      gap: 28,
      padding: "0 36px",
      borderBottom: `1px solid ${color.borde}`,
      backgroundColor: aparece < 1 || resuelto < 1 ? `rgba(200,241,105,${0.25 * (1 - resuelto)})` : "transparent",
      opacity: aparece,
    }}
  >
    <div style={{ fontFamily: fuenteMono, fontSize: 24, color: color.secundario, width: 90 }}>{f.hora}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 30, fontWeight: 600, whiteSpace: "nowrap" }}>{f.proveedor}</div>
      <div style={{ fontSize: 23, color: color.secundario, marginTop: 4, whiteSpace: "nowrap" }}>
        {resuelto > 0.5 ? f.motivo : `${f.canal} · ${f.numero}`}
      </div>
    </div>
    <div style={{ fontFamily: fuenteMono, fontSize: 28, fontWeight: 600, color: resuelto > 0.5 && f.estado === "pagada" ? color.pagada.texto : color.tinta, whiteSpace: "nowrap" }}>{f.monto}</div>
    <div style={{ width: 210, display: "flex", justifyContent: "flex-end" }}>
      {resuelto > 0.5 ? (
        <Pildora estado={f.estado} tamano={26} style={{ scale: String(0.8 + 0.2 * resuelto) }} />
      ) : (
        <span style={{ fontSize: 24, fontWeight: 600, color: color.secundario, backgroundColor: color.sutil, borderRadius: 999, padding: "8px 18px" }}>Leyendo…</span>
      )}
    </div>
  </div>
);

const LlegadaInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const marco = entrada(frame, fps, 0, 24);
  // Cuántas nuevas ya entraron (con resorte) desplaza todo hacia abajo.
  const desplazamiento = nuevas.reduce((acc, f) => acc + entrada(frame, fps, (f.llega ?? 0) * fps, 20), 0);
  const visibles = [...nuevas].reverse();
  const contar = (estado: Estado, base: number) => base + nuevas.filter((f) => f.estado === estado && frame >= ((f.llega ?? 0) + LEER) * fps).length;
  const pulso = 0.5 + 0.5 * Math.sin(frame / 6);
  return (
    <Fondo>
      <Encabezado kicker="Bandeja · en vivo" titulo="Llegan solas. Se deciden solas." />
      <div style={{ position: "absolute", right: 176, top: 340, height: 50, display: "flex", gap: 14, opacity: marco, zIndex: 2 }}>
        {([
          ["Pagadas", contar("pagada", 5), color.pagada.punto],
          ["Frenadas", contar("frenada", 5), color.frenada.punto],
          ["Escaladas", contar("escalada", 2), color.escalada.punto],
        ] as const).map(([n, v, c]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: color.sutil, borderRadius: 999, padding: "0 20px", fontSize: 22, color: color.secundario }}>
            <span style={{ width: 10, height: 10, borderRadius: 9, backgroundColor: c }} />
            {n}
            <span style={{ fontFamily: fuenteMono, fontSize: 26, fontWeight: 600, color: color.tinta }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ ...subir(marco, 30), position: "absolute", left: 140, right: 140, top: 330, height: 640, backgroundColor: color.superficie, borderRadius: 26, boxShadow: sombra, border: `1px solid ${color.borde}`, overflow: "hidden" }}>
        <div style={{ height: 70, display: "flex", alignItems: "center", gap: 14, padding: "0 36px", borderBottom: `1px solid ${color.borde}`, fontSize: 24, color: color.secundario }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: color.pagada.punto, opacity: 0.4 + 0.6 * pulso }} />
          En vivo · se actualiza sola
        </div>
        <div style={{ position: "relative", height: 570 }}>
          {visibles.map((f) => {
            const llega = (f.llega ?? 0) * fps;
            const ap = entrada(frame, fps, llega, 20);
            if (frame < llega) return null;
            const despues = nuevas.filter((o) => (o.llega ?? 0) > (f.llega ?? 0)).reduce((acc, o) => acc + entrada(frame, fps, (o.llega ?? 0) * fps, 20), 0);
            const res = entrada(frame, fps, llega + LEER * fps, 14);
            return <FilaVista key={f.numero} f={f} y={interpolate(ap, [0, 1], [-ALTO, 0]) + despues * ALTO} aparece={ap} resuelto={res} />;
          })}
          {previas.map((f, i) => (
            <FilaVista key={f.numero} f={f} y={(i + desplazamiento) * ALTO} aparece={1} resuelto={1} />
          ))}
        </div>
      </div>
    </Fondo>
  );
};

export const Llegada = Interactive.create({ Component: LlegadaInner, layout: "absolute-fill" });
