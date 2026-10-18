import { AbsoluteFill, Interactive, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Captura, type Toma } from "../componentes/Captura";
import { Encabezado } from "../componentes/Encabezado";
import { Etiqueta } from "../componentes/Etiqueta";
import { Fondo } from "../componentes/Fondo";
import { color } from "../tema";

// 8 · Roles (24 s): lo que ve cada persona. Capturas tomadas con la cuenta admin; el rótulo dice de qué rol es la vista.
const Vista: React.FC<{ etiqueta: string; texto: string; src: string; tomas: Toma[]; duracion: number }> = ({ etiqueta, texto, src, tomas, duracion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visible = Math.min(tramo(frame, 0, 10), 1 - tramo(frame, duracion - 10, duracion));
  const e = entrada(frame, fps, 6, 20);
  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <Captura src={src} style={{ position: "absolute", left: 140, top: 330 }} ancho={1640} alto={640} tomas={tomas} />
      <div style={{ ...subir(e, 16), position: "absolute", left: 170, top: 300, display: "flex", alignItems: "center", gap: 24 }}>
        <Etiqueta>{etiqueta}</Etiqueta>
        <span style={{ fontSize: 30, fontWeight: 500, color: color.tinta, backgroundColor: "rgba(247,248,245,0.92)", padding: "10px 18px", borderRadius: 14 }}>{texto}</span>
      </div>
    </AbsoluteFill>
  );
};

const RolesInner = () => {
  const { fps } = useVideoConfig();
  return (
    <Fondo>
      <Encabezado kicker="Roles" titulo="Cada persona ve lo que le toca." />
      <Sequence name="Tesorero" durationInFrames={8 * fps} layout="none">
        <Vista
          etiqueta="Vista del tesorero"
          texto="Recibe, carga y sigue cada factura"
          src="capturas/bandeja-nuevas.png"
          duracion={8 * fps}
          tomas={[
            { f: 0, x: 0.55, y: 0.2, zoom: 1.2 },
            { f: 8 * fps, x: 0.5, y: 0.55, zoom: 1.35 },
          ]}
        />
      </Sequence>
      <Sequence name="Aprobador" from={8 * fps - 10} durationInFrames={8 * fps + 10} layout="none">
        <Vista
          etiqueta="Vista del aprobador"
          texto="Solo decide lo que el agente escaló"
          src="capturas/decision.png"
          duracion={8 * fps + 10}
          tomas={[
            { f: 0, x: 0.72, y: 0.55, zoom: 1.5 },
            { f: 8 * fps, x: 0.72, y: 0.84, zoom: 1.7 },
          ]}
        />
      </Sequence>
      <Sequence name="Administrador" from={16 * fps - 10} durationInFrames={8 * fps + 10} layout="none">
        <Vista
          etiqueta="Vista del administrador"
          texto="Define reglas, proveedores, equipo y moneda"
          src="capturas/ajustes.png"
          duracion={8 * fps + 10}
          tomas={[
            { f: 0, x: 0.5, y: 0.3, zoom: 1.25 },
            { f: 8 * fps, x: 0.5, y: 0.5, zoom: 1.35 },
          ]}
        />
      </Sequence>
    </Fondo>
  );
};

export const Roles = Interactive.create({ Component: RolesInner, layout: "absolute-fill" });
