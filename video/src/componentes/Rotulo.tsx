import { AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig, type InteractivitySchema } from "remotion";
import { entrada, tramo } from "../animar";
import { color, fuente } from "../tema";

// Rótulo inferior del presentador. Se exporta con fondo transparente (WebM) para ponerlo encima del video de cámara.
type Props = { readonly nombre: string; readonly rol: string };

const RotuloInner: React.FC<Props> = ({ nombre, rol }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = Math.min(entrada(frame, fps, 6, 24), 1 - tramo(frame, durationInFrames - 15, durationInFrames));
  return (
    <AbsoluteFill style={{ fontFamily: fuente }}>
      <div style={{ position: "absolute", left: 120, bottom: 110, display: "flex", alignItems: "stretch", gap: 0, opacity: p, translate: `${(1 - p) * -40}px 0px` }}>
        <div style={{ width: 10, borderRadius: 5, backgroundColor: color.acento }} />
        <div style={{ marginLeft: 22, backgroundColor: "rgba(16,22,20,0.88)", borderRadius: 18, padding: "22px 34px" }}>
          <div style={{ fontSize: 50, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>{nombre}</div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.75)", marginTop: 6 }}>{rol}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const schema = {
  nombre: { type: "string", default: "Nombre del presentador", description: "Nombre" },
  rol: { type: "string", default: "Equipo Quadra · Hackathon 30X", description: "Rol" },
} as const satisfies InteractivitySchema;

export const Rotulo = Interactive.create({ Component: RotuloInner, layout: "absolute-fill", schema });
