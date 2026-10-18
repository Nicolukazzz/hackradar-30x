import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { Encabezado } from "../componentes/Encabezado";
import { Fondo } from "../componentes/Fondo";
import { color, fuenteMono, sombra } from "../tema";

// 8 · Resultados (13 s): números de `npm run evaluar -- --todos --extraccion golden` (30 facturas, 3 escenarios).
const formato = (n: number, decimales: number) => n.toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

const Tile: React.FC<{ criterio: string; valor: (p: number) => string; pie: string; desde: number; tono: string }> = ({ criterio, valor, pie, desde, tono }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = entrada(frame, fps, desde, 30);
  const cuenta = interpolate(frame, [desde, desde + 1.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ ...subir(p, 40), flex: 1, backgroundColor: color.superficie, borderRadius: 28, boxShadow: sombra, border: `1px solid ${color.borde}`, padding: "40px 44px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600, color: color.secundario }}>
        <span style={{ width: 14, height: 14, borderRadius: 99, backgroundColor: tono }} />
        {criterio}
      </div>
      <div style={{ fontFamily: fuenteMono, fontSize: 124, fontWeight: 600, letterSpacing: "-0.04em", marginTop: 16, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{valor(cuenta)}</div>
      <div style={{ fontSize: 32, lineHeight: 1.35, marginTop: 10 }}>{pie}</div>
    </div>
  );
};

const MetricasInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pie = entrada(frame, fps, 6 * fps, 30);
  return (
    <Fondo>
      <Encabezado kicker="Resultados en el set de prueba" titulo="Los tres criterios del reto" />
      <div style={{ position: "absolute", left: 140, right: 140, top: 380, display: "flex", gap: 36 }}>
        <Tile criterio="Seguridad" valor={() => "0"} pie="pagos fuera de reglas en 30 facturas, 15 de ellas trampas" desde={0.8 * fps} tono={color.pagada.punto} />
        <Tile criterio="Autonomía" valor={(p) => `${formato(83.3 * p, 1)} %`} pie="del lote demo decidido bien sin una persona" desde={1.6 * fps} tono={color.escalada.punto} />
        <Tile criterio="Explicabilidad" valor={(p) => `${Math.round(30 * p)}/30`} pie="decisiones como se esperaban, cada una con su explicación" desde={2.4 * fps} tono={color.enlace} />
      </div>
      <div style={{ ...subir(pie, 20), position: "absolute", left: 140, right: 140, top: 900, fontSize: 30, color: color.secundario }}>
        11 reglas en código · miles de facturas aleatorias en pruebas de propiedades · el CI bloquea cualquier pago indebido
      </div>
    </Fondo>
  );
};

export const Metricas = Interactive.create({ Component: MetricasInner, layout: "absolute-fill" });
