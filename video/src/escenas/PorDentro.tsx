import { AbsoluteFill, Interactive, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Captura, type Toma } from "../componentes/Captura";
import { Camara } from "../componentes/Camara";
import { Encabezado } from "../componentes/Encabezado";
import { Fondo } from "../componentes/Fondo";
import { Nota } from "../componentes/Nota";

// 7 · Por dentro (18 s): la traza de una factura real del set (OMI-3381): por qué no se pagó, la instrucción escondida
// resaltada e ignorada, y las 11 reglas con sus valores. Es lo que nos diferencia: cada decisión se puede auditar.
const Toma3: React.FC<{ src: string; tomas: Toma[]; duracion: number; nota: string; notaArriba?: boolean }> = ({ src, tomas, duracion, nota, notaArriba }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visible = Math.min(tramo(frame, 0, 10), 1 - tramo(frame, duracion - 10, duracion));
  const n = entrada(frame, fps, 0.8 * fps, 20);
  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <Captura src={src} style={{ position: "absolute", left: 140, top: 300 }} ancho={1260} alto={709} tomas={tomas} />
      <Nota style={{ ...subir(n, 16), left: 1440, right: 120, maxWidth: 360, ...(notaArriba ? { top: 300 } : { top: 300 }) }}>{nota}</Nota>
    </AbsoluteFill>
  );
};

const PorDentroInner = () => {
  const { fps } = useVideoConfig();
  return (
    <Fondo>
      <Encabezado kicker="Por dentro · la traza" titulo="Cada decisión, explicada y auditable." />
      <Sequence name="Por qué" durationInFrames={6 * fps} layout="none">
        <Toma3
          src="capturas/traza-omi.png"
          duracion={6 * fps}
          nota="Por qué no se pagó, en una frase que cualquiera entiende."
          tomas={[
            { f: 0, x: 0.5, y: 0.25, zoom: 1.25 },
            { f: 6 * fps, x: 0.45, y: 0.27, zoom: 1.6 },
          ]}
        />
      </Sequence>
      <Sequence name="Instrucción escondida" from={6 * fps - 10} durationInFrames={6 * fps + 10} layout="none">
        <Toma3
          src="capturas/traza-omi.png"
          duracion={6 * fps + 10}
          nota="El texto que intenta engañar al agente se resalta y se ignora."
          tomas={[
            { f: 0, x: 0.35, y: 0.62, zoom: 1.9 },
            { f: 6 * fps, x: 0.35, y: 0.66, zoom: 2.2 },
          ]}
        />
      </Sequence>
      <Sequence name="Reglas" from={12 * fps - 10} durationInFrames={6 * fps + 10} layout="none">
        <Toma3
          src="capturas/traza-omi-reglas.png"
          duracion={6 * fps + 10}
          nota="11 reglas en código, con los valores que comparó."
          tomas={[
            { f: 0, x: 0.72, y: 0.72, zoom: 1.6 },
            { f: 6 * fps, x: 0.72, y: 0.9, zoom: 1.8 },
          ]}
        />
      </Sequence>
      <Camara clip="por-dentro" tamano={240} />
    </Fondo>
  );
};

export const PorDentro = Interactive.create({ Component: PorDentroInner, layout: "absolute-fill" });
