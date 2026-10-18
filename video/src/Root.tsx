import { Composition, Folder } from "remotion";
import { Rotulo } from "./componentes/Rotulo";
import { Canales } from "./escenas/Canales";
import { Cierre } from "./escenas/Cierre";
import { ComoFunciona } from "./escenas/ComoFunciona";
import { Intro } from "./escenas/Intro";
import { Llegada } from "./escenas/Llegada";
import { Moneda } from "./escenas/Moneda";
import { PorDentro } from "./escenas/PorDentro";
import { Portal } from "./escenas/Portal";
import { Presentador } from "./escenas/Presentador";
import { Roles } from "./escenas/Roles";
import { WhatsApp } from "./escenas/WhatsApp";
import { Pitch } from "./Pitch";

// 1920×1080 a 30 fps. Cada escena se puede abrir y exportar sola; `Pitch` las une.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Pitch" component={Pitch} durationInFrames={4650} fps={30} width={1920} height={1080} />
      <Folder name="Escenas">
        <Composition id="E00-Presentador" component={Presentador} durationInFrames={435} fps={30} width={1920} height={1080} />
        <Composition id="E01-Intro" component={Intro} durationInFrames={150} fps={30} width={1920} height={1080} />
        <Composition id="E02-Canales" component={Canales} durationInFrames={150} fps={30} width={1920} height={1080} />
        <Composition id="E03-WhatsApp" component={WhatsApp} durationInFrames={420} fps={30} width={1920} height={1080} />
        <Composition id="E04-Portal" component={Portal} durationInFrames={870} fps={30} width={1920} height={1080} />
        <Composition id="E05-Llegada" component={Llegada} durationInFrames={390} fps={30} width={1920} height={1080} />
        <Composition id="E06-ComoFunciona" component={ComoFunciona} durationInFrames={540} fps={30} width={1920} height={1080} />
        <Composition id="E07-PorDentro" component={PorDentro} durationInFrames={540} fps={30} width={1920} height={1080} />
        <Composition id="E08-Roles" component={Roles} durationInFrames={720} fps={30} width={1920} height={1080} />
        <Composition id="E09-Moneda" component={Moneda} durationInFrames={375} fps={30} width={1920} height={1080} />
        <Composition id="E10-Cierre" component={Cierre} durationInFrames={210} fps={30} width={1920} height={1080} />
      </Folder>
      <Folder name="Presentador">
        <Composition
          id="Rotulo"
          component={Rotulo}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ nombre: "Nombre del presentador", rol: "Equipo Quadra · Hackathon 30X" }}
        />
      </Folder>
    </>
  );
};
