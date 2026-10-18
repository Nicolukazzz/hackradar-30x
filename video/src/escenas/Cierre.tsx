import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Fondo } from "../componentes/Fondo";
import { color } from "../tema";

// 9 · Cierre (10 s): la promesa en tres líneas (las del brief de Blinka) y la firma.
const lineas = ["Paga solo lo que debe.", "Explica cada decisión.", "Nunca se pasa de los límites."];

const CierreInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const salida = 1 - tramo(frame, 5.4 * fps, 6 * fps);
  const firma = entrada(frame, fps, 6.2 * fps, 30);
  const sub = entrada(frame, fps, 6.8 * fps, 30);
  return (
    <Fondo oscuro>
      <div style={{ position: "absolute", left: 160, top: 300, opacity: salida }}>
        {lineas.map((l, i) => (
          <div key={l} style={{ ...subir(entrada(frame, fps, 10 + i * 0.9 * fps, 30), 30), fontSize: 110, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.12, color: i === 2 ? color.acento : "#fff" }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 1 - salida }}>
        <div style={{ ...subir(firma, 30), display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ width: 120, height: 120, borderRadius: 30, backgroundColor: color.acento, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 99, border: `8px solid ${color.tinta}` }} />
          </div>
          <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.035em" }}>Agente de cuentas por pagar</div>
        </div>
        <div style={{ ...subir(sub, 20), marginTop: 36, fontSize: 40, color: "rgba(255,255,255,0.7)" }}>Reto Blinka · HackRadar 30X</div>
      </div>
    </Fondo>
  );
};

export const Cierre = Interactive.create({ Component: CierreInner, layout: "absolute-fill" });
