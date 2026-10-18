import { Video } from "@remotion/media";
import { AbsoluteFill, Interactive, staticFile } from "remotion";
import { rutaCamara } from "../componentes/Camara";
import { Fondo } from "../componentes/Fondo";
import { color, fuente } from "../tema";

// 0 · Presentador en cámara (apertura). Toma de `public/camara/intro.mov` (o .mp4); sin archivo, un marcador.
const PresentadorInner = () => {
  const ruta = rutaCamara("intro");
  return (
    <Fondo oscuro>
      {ruta ? (
        <Video src={staticFile(ruta)} objectFit="cover" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      ) : (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: fuente, fontSize: 48, color: color.acento }}>
          camara/intro.mp4
        </AbsoluteFill>
      )}
    </Fondo>
  );
};

export const Presentador = Interactive.create({ Component: PresentadorInner, layout: "absolute-fill" });
