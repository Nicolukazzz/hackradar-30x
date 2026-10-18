import { Video } from "@remotion/media";
import { AbsoluteFill, Interactive, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Camara } from "../componentes/Camara";
import { Encabezado } from "../componentes/Encabezado";
import { Etiqueta } from "../componentes/Etiqueta";
import { Fondo } from "../componentes/Fondo";
import { Pasos } from "../componentes/Pasos";
import { Ventana } from "../componentes/Ventana";

// 4 · Portal del proveedor (26 s), grabado en la app: el admin crea el acceso (enlace + código) y el proveedor entra con
// su correo y ese código y sube tres facturas a la vez.
const W = 1180;
const H = Math.round((W * 9) / 16) + 40;

/** Grabación a 1920×1080 ampliada `zoom` veces hacia (cx, cy) (proporciones). */
const Clip: React.FC<{ src: string; desde: number; duracion: number; velocidad?: number; zoom: number; cx: number; cy: number }> = ({ src, desde, duracion, velocidad = 1, zoom, cx, cy }) => {
  const { fps } = useVideoConfig();
  const w = W * zoom;
  const h = (w * 9) / 16;
  const left = Math.min(0, Math.max(W - w, W / 2 - cx * w));
  const top = Math.min(0, Math.max(H - 40 - h, (H - 40) / 2 - cy * h));
  return (
    <Video
      src={staticFile(src)}
      trimBefore={desde * fps}
      durationInFrames={Math.round((duracion * fps) / velocidad)}
      playbackRate={velocidad}
      style={{ position: "absolute", width: w, height: h, left, top }}
    />
  );
};

const Tramo: React.FC<{ duracion: number; etiqueta: string; children: React.ReactNode }> = ({ duracion, etiqueta, children }) => {
  const frame = useCurrentFrame();
  const visible = Math.min(tramo(frame, 0, 10), 1 - tramo(frame, duracion - 10, duracion));
  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <Ventana ancho={W} alto={H} titulo="Quadra" style={{ position: "absolute", left: 140, top: 300 }}>
        {children}
      </Ventana>
      <Etiqueta style={{ position: "absolute", left: 170, top: 270 }}>{etiqueta}</Etiqueta>
    </AbsoluteFill>
  );
};

const PortalInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const salto = Math.min(entrada(frame, fps, 21.2 * fps, 12), 1 - entrada(frame, fps, 22.6 * fps, 12));
  return (
    <Fondo>
      <Encabezado kicker="Canal · Portal del proveedor" titulo="Un enlace y un código. Sin crear cuentas." />
      <Sequence name="Admin crea el acceso" durationInFrames={11 * fps} layout="none">
        <Tramo duracion={11 * fps} etiqueta="Vista del administrador">
          <Clip src="medios/admin-enlace.mp4" desde={0} duracion={13.2} velocidad={1.2} zoom={1.45} cx={0.5} cy={0.5} />
        </Tramo>
      </Sequence>
      <Sequence name="Proveedor sube facturas" from={11 * fps - 10} durationInFrames={15 * fps + 10} layout="none">
        <Tramo duracion={15 * fps + 10} etiqueta="Vista del proveedor">
          <Sequence durationInFrames={Math.round(10.3 * fps)} layout="none">
            <Clip src="medios/proveedor-portal.mp4" desde={0.5} duracion={16} velocidad={1.55} zoom={1.75} cx={0.5} cy={0.42} />
          </Sequence>
          <Sequence from={Math.round(10.3 * fps)} layout="none">
            <Clip src="medios/proveedor-portal.mp4" desde={42} duracion={6.5} velocidad={1.3} zoom={1.75} cx={0.5} cy={0.42} />
          </Sequence>
        </Tramo>
      </Sequence>
      <div style={{ ...subir(salto, 10), position: "absolute", left: 140 + W / 2 - 170, top: 880, width: 340, textAlign: "center", fontSize: 26, fontWeight: 600, backgroundColor: "#101614", color: "#fff", borderRadius: 999, padding: "10px 0", opacity: interpolate(salto, [0, 1], [0, 1]) }}>
        segundos después
      </div>
      <Pasos
        style={{ position: "absolute", left: 1370, right: 100, top: 310 }}
        pasos={[
          { t: 0.8, texto: "Tesorería da acceso" },
          { t: 5.5, texto: "Enlace + código único" },
          { t: 11.5, texto: "Entra con correo y código" },
          { t: 16.5, texto: "Sube varias y ve su estado" },
        ]}
      />
      <Camara clip="portal" tamano={240} />
    </Fondo>
  );
};

export const Portal = Interactive.create({ Component: PortalInner, layout: "absolute-fill" });
