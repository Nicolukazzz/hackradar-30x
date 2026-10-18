import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Fondo } from "../componentes/Fondo";
import { color } from "../tema";
import { Marca } from "./Intro";

// 10 · Cierre (8 s): la promesa en tres líneas (las del brief de Blinka) y la firma.
const lineas = ["Paga solo lo que debe.", "Explica cada decisión.", "Nunca se pasa de los límites."];

const CierreInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const salida = 1 - tramo(frame, 3.4 * fps, 4 * fps);
  const firma = entrada(frame, fps, 4.1 * fps, 30);
  const sub = entrada(frame, fps, 4.7 * fps, 30);
  return (
    <Fondo oscuro>
      <div style={{ position: "absolute", left: 160, top: 300, opacity: salida }}>
        {lineas.map((l, i) => (
          <div key={l} style={{ ...subir(entrada(frame, fps, 8 + i * 0.7 * fps, 30), 30), fontSize: 110, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.12, color: i === 2 ? color.acento : "#fff" }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 1 - salida }}>
        <div style={{ ...subir(firma, 30), display: "flex", alignItems: "center", gap: 32 }}>
          <Marca tamano={140} />
          <div style={{ fontSize: 170, fontWeight: 700, letterSpacing: "-0.05em" }}>Quadra</div>
        </div>
        <div style={{ ...subir(sub, 20), marginTop: 36, fontSize: 40, color: "rgba(255,255,255,0.7)" }}>Hackathon 30X</div>
      </div>
    </Fondo>
  );
};

export const Cierre = Interactive.create({ Component: CierreInner, layout: "absolute-fill" });
