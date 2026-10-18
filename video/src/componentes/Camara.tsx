import { Video } from "@remotion/media";
import { getStaticFiles, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada } from "../animar";
import { color, fuente } from "../tema";

/**
 * El presentador en un círculo (abajo a la derecha). Si existe `public/camara/<clip>.mp4` (o `.mov`) lo reproduce; si no, deja un
 * marcador para saber dónde va al grabar (ver docs/pitch/guion.md).
 */
/** `camara/<clip>.mp4` o `.mov` si existe en `public/`; si no, null. */
export const rutaCamara = (clip: string): string | null => {
  const nombres = getStaticFiles().map((f) => f.name);
  return [`camara/${clip}.mp4`, `camara/${clip}.mov`].find((r) => nombres.includes(r)) ?? null;
};

export const Camara: React.FC<{ clip: string; tamano?: number; style?: React.CSSProperties }> = ({ clip, tamano = 300, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = entrada(frame, fps, 6, 24);
  const ruta = rutaCamara(clip);
  return (
    <div
      style={{
        position: "absolute",
        right: 120,
        bottom: 100,
        width: tamano,
        height: tamano,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: `0 0 0 8px ${color.superficie}, 0 18px 50px rgba(16,22,20,0.25)`,
        backgroundColor: color.tinta,
        opacity: p,
        scale: String(0.85 + 0.15 * p),
        ...style,
      }}
    >
      {ruta ? (
        <Video src={staticFile(ruta)} objectFit="cover" style={{ width: "100%", height: "100%" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: fuente, color: "rgba(255,255,255,0.75)" }}>
          <div style={{ width: 70, height: 70, borderRadius: "50%", border: `5px solid ${color.acento}` }} />
          <div style={{ fontSize: 26, fontWeight: 600 }}>Presentador</div>
          <div style={{ fontSize: 18, opacity: 0.7 }}>camara/{clip}.mp4</div>
        </div>
      )}
    </div>
  );
};
