import { AbsoluteFill, Interactive, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Captura } from "../componentes/Captura";
import { Fondo } from "../componentes/Fondo";
import { Nota } from "../componentes/Nota";
import { color } from "../tema";

// 7 · Una persona decide (16 s): Pendientes → panel de decisión → registro, con capturas reales.
const Tramo: React.FC<{ kicker: string; nota: string; src: string; tomas: React.ComponentProps<typeof Captura>["tomas"]; duracion: number; notaArriba?: boolean; notaIzquierda?: boolean }> = ({ kicker, nota, src, tomas, duracion, notaArriba, notaIzquierda }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visible = Math.min(tramo(frame, 0, 10), 1 - tramo(frame, duracion - 10, duracion));
  const n = entrada(frame, fps, 1.2 * fps, 20);
  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ position: "absolute", left: 210, top: 70, fontSize: 30, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: color.secundario }}>{kicker}</div>
      <Captura src={src} style={{ position: "absolute", left: 210, top: 140 }} ancho={1500} alto={844} tomas={tomas} />
      <Nota style={{ ...subir(n, 16), ...(notaIzquierda ? { left: 140 } : { right: 140 }), ...(notaArriba ? { top: 180 } : { bottom: 120 }) }}>{nota}</Nota>
    </AbsoluteFill>
  );
};

const PersonaDecideInner = () => {
  const { fps } = useVideoConfig();
  return (
    <Fondo>
      <Sequence name="Pendientes" durationInFrames={5 * fps} layout="none">
        <Tramo
          kicker="Pendientes"
          src="capturas/pendientes.png"
          duracion={5 * fps}
          nota="Lo que no cumple espera a una persona, con el motivo, el responsable y el plazo."
          tomas={[
            { f: 0, x: 0.5, y: 0.5, zoom: 1 },
            { f: 1.6 * fps, x: 0.55, y: 0.5, zoom: 1.45 },
            { f: 5 * fps, x: 0.55, y: 0.52, zoom: 1.5 },
          ]}
        />
      </Sequence>
      <Sequence name="Decisión" from={5 * fps - 10} durationInFrames={6 * fps + 10} layout="none">
        <Tramo
          kicker="Traza y decisión humana"
          src="capturas/decision.png"
          duracion={6 * fps + 10}
          notaArriba
          notaIzquierda
          nota="Las 11 reglas con sus valores. Comentario obligatorio; desde USD 10.000, dos firmas."
          tomas={[
            { f: 0, x: 0.72, y: 0.4, zoom: 1.6 },
            { f: 2.6 * fps, x: 0.72, y: 0.45, zoom: 1.7 },
            { f: 4 * fps, x: 0.72, y: 0.82, zoom: 1.9 },
            { f: 6 * fps, x: 0.72, y: 0.84, zoom: 1.95 },
          ]}
        />
      </Sequence>
      <Sequence name="Registro" from={11 * fps - 10} durationInFrames={5 * fps + 10} layout="none">
        <Tramo
          kicker="Registro"
          src="capturas/registro.png"
          duracion={5 * fps + 10}
          nota="Solo se agrega, nunca se edita: cualquiera entiende cada decisión sin abrir el código."
          tomas={[
            { f: 0, x: 0.5, y: 0.5, zoom: 1 },
            { f: 2 * fps, x: 0.62, y: 0.5, zoom: 1.4 },
            { f: 5 * fps, x: 0.66, y: 0.55, zoom: 1.5 },
          ]}
        />
      </Sequence>
    </Fondo>
  );
};

export const PersonaDecide = Interactive.create({ Component: PersonaDecideInner, layout: "absolute-fill" });
