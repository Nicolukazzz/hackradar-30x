import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { Fondo } from "../componentes/Fondo";
import { color } from "../tema";

// 1 · Intro (5 s): nombre y promesa.
export const Marca: React.FC<{ tamano?: number }> = ({ tamano = 120 }) => (
  <div style={{ width: tamano, height: tamano, borderRadius: tamano * 0.26, backgroundColor: color.acento, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: tamano * 0.42, height: tamano * 0.42, borderRadius: tamano * 0.1, border: `${tamano * 0.075}px solid ${color.tinta}` }} />
  </div>
);

const IntroInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = entrada(frame, fps, 4, 30);
  const nombre = entrada(frame, fps, 10, 30);
  const lema = entrada(frame, fps, 1.4 * fps, 30);
  return (
    <Fondo oscuro>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ opacity: logo, scale: String(0.7 + 0.3 * logo) }}>
            <Marca tamano={150} />
          </div>
          <div style={{ ...subir(nombre, 30), fontSize: 180, fontWeight: 700, letterSpacing: "-0.05em" }}>Quadra</div>
        </div>
        <div style={{ ...subir(lema, 20), marginTop: 40, fontSize: 52, fontWeight: 500, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.01em" }}>
          Tus facturas, decididas solas. <span style={{ color: color.acento }}>Dentro de tus reglas.</span>
        </div>
      </div>
    </Fondo>
  );
};

export const Intro = Interactive.create({ Component: IntroInner, layout: "absolute-fill" });
