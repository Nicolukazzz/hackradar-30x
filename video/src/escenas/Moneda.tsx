import { Interactive, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { entrada, subir } from "../animar";
import { Encabezado } from "../componentes/Encabezado";
import { Fondo } from "../componentes/Fondo";
import { color, fuenteMono, sombra } from "../tema";

// 9 · Moneda (12 s): la empresa elige su moneda base y todo (presupuesto, límites, facturas) se convierte con la tasa
// del día. Tasas del set de prueba: COP 4.200 · MXN 18,50 · EUR 0,92 · BRL 5,50 por USD.
const monedas = [
  { codigo: "USD", nombre: "Dólar", tasa: 1, dec: 2 },
  { codigo: "COP", nombre: "Peso colombiano", tasa: 4200, dec: 0 },
  { codigo: "MXN", nombre: "Peso mexicano", tasa: 18.5, dec: 2 },
  { codigo: "EUR", nombre: "Euro", tasa: 0.92, dec: 2 },
  { codigo: "BRL", nombre: "Real", tasa: 5.5, dec: 2 },
];
const montos = [
  { etiqueta: "Presupuesto del mes", usd: 60000 },
  { etiqueta: "Paga solo hasta", usd: 3000 },
  { etiqueta: "Factura de CloudNorte", usd: 1240 },
];
const PASO = 2.1; // segundos por moneda
const INICIO = 1.2;

const MonedaInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps - INICIO) / PASO;
  const i = Math.max(0, Math.min(monedas.length - 1, Math.floor(t)));
  const anterior = monedas[Math.max(0, i - 1)];
  const actual = monedas[i];
  const avance = i === 0 ? 1 : interpolate((t - i) * PASO, [0, 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const tasa = i === 0 ? 1 : anterior.tasa + (actual.tasa - anterior.tasa) * avance;
  const panel = entrada(frame, fps, 0.3 * fps, 24);
  const ANCHO_OPCION = 250;
  return (
    <Fondo>
      <Encabezado kicker="Ajustes · moneda base" titulo="Piensa en la moneda de tu empresa." />
      <div style={{ ...subir(panel, 30), position: "absolute", left: 140, right: 140, top: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 56 }}>
        {/* Selector segmentado con indicador que se desliza */}
        <div style={{ position: "relative", display: "flex", backgroundColor: color.sutil, borderRadius: 999, padding: 8, border: `1px solid ${color.borde}` }}>
          <div
            style={{
              position: "absolute",
              top: 8,
              bottom: 8,
              left: 8 + interpolate(avance, [0, 1], [Math.max(0, i - 1), i]) * ANCHO_OPCION,
              width: ANCHO_OPCION,
              borderRadius: 999,
              backgroundColor: color.tinta,
              boxShadow: sombra,
            }}
          />
          {monedas.map((m, k) => (
            <div key={m.codigo} style={{ position: "relative", width: ANCHO_OPCION, textAlign: "center", padding: "18px 0", fontSize: 34, fontWeight: 600, color: k === i ? "#fff" : color.secundario }}>
              {m.codigo}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 36, width: "100%" }}>
          {montos.map((m) => (
            <div key={m.etiqueta} style={{ flex: 1, backgroundColor: color.superficie, borderRadius: 28, boxShadow: sombra, border: `1px solid ${color.borde}`, padding: "34px 36px", minWidth: 0 }}>
              <div style={{ fontSize: 28, color: color.secundario }}>{m.etiqueta}</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 4, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 30, fontWeight: 600, color: color.secundario }}>{actual.codigo}</span>
                <span style={{ fontFamily: fuenteMono, fontSize: 56, fontWeight: 600, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: color.pagada.texto }}>
                  {(m.usd * tasa).toLocaleString("es-CO", { minimumFractionDigits: actual.dec, maximumFractionDigits: actual.dec })}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 30, color: color.secundario }}>
          {actual.nombre} · límites, presupuesto y facturas se convierten con la tasa de la fecha de cada factura
        </div>
      </div>
    </Fondo>
  );
};

export const Moneda = Interactive.create({ Component: MonedaInner, layout: "absolute-fill" });
