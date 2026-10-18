import { Interactive, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { Captura } from "../componentes/Captura";
import { Fondo } from "../componentes/Fondo";
import { Nota } from "../componentes/Nota";
import { color } from "../tema";

// 5 · La bandeja (14 s): captura real de la app (escenario lote-demo-oct) con paneo y zoom a lo importante.
const NotaTemporal: React.FC<{ desde: number; hasta: number; style: React.CSSProperties; children: React.ReactNode }> = ({ desde, hasta, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = Math.min(entrada(frame, fps, desde, 18), 1 - entrada(frame, fps, hasta, 12));
  return <Nota style={{ ...style, ...subir(p, 16) }}>{children}</Nota>;
};

const RecorridoBandejaInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = entrada(frame, fps, 0);
  return (
    <Fondo>
      <div style={{ ...subir(k, 12), position: "absolute", left: 210, top: 70, fontSize: 30, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: color.secundario }}>
        La bandeja de tesorería
      </div>
      <Captura
        src="capturas/bandeja.png"
        style={{ position: "absolute", left: 210, top: 140 }}
        ancho={1500}
        alto={844}
        tomas={[
          { f: 0, x: 0.5, y: 0.5, zoom: 1 },
          { f: 1.5 * fps, x: 0.5, y: 0.5, zoom: 1 },
          { f: 3 * fps, x: 0.56, y: 0.24, zoom: 1.6 },
          { f: 6 * fps, x: 0.56, y: 0.24, zoom: 1.6 },
          { f: 7.3 * fps, x: 0.45, y: 0.4, zoom: 1.75 },
          { f: 9.5 * fps, x: 0.45, y: 0.4, zoom: 1.75 },
          { f: 10.8 * fps, x: 0.46, y: 0.82, zoom: 1.5 },
          { f: 14 * fps, x: 0.46, y: 0.82, zoom: 1.5 },
        ]}
      />
      <Sequence from={0} layout="none">
        <NotaTemporal desde={3.3 * fps} hasta={6.2 * fps} style={{ right: 140, bottom: 120 }}>
          4 esperan a una persona, 5 se aprobaron solas y 3 se frenaron.
        </NotaTemporal>
        <NotaTemporal desde={7.6 * fps} hasta={9.8 * fps} style={{ right: 140, bottom: 120 }}>
          El presupuesto del mes ya descuenta lo apartado para lo que espera aprobación.
        </NotaTemporal>
        <NotaTemporal desde={11 * fps} hasta={14.5 * fps} style={{ right: 140, top: 180 }}>
          Cada factura con su estado. A la derecha, lo que el agente leyó.
        </NotaTemporal>
      </Sequence>
    </Fondo>
  );
};

export const RecorridoBandeja = Interactive.create({ Component: RecorridoBandejaInner, layout: "absolute-fill" });
