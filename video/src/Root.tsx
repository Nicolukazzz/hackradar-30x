import { Composition, Folder } from "remotion";
import { Rotulo } from "./componentes/Rotulo";
import { Cierre } from "./escenas/Cierre";
import { ComoFunciona } from "./escenas/ComoFunciona";
import { Gancho } from "./escenas/Gancho";
import { Metricas } from "./escenas/Metricas";
import { PersonaDecide } from "./escenas/PersonaDecide";
import { Problema } from "./escenas/Problema";
import { RecorridoBandeja } from "./escenas/RecorridoBandeja";
import { Trampas } from "./escenas/Trampas";
import { Veredictos } from "./escenas/Veredictos";
import { Pitch } from "./Pitch";

// 1920×1080 a 30 fps. Cada escena se puede abrir y exportar sola; `Pitch` las une.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Pitch" component={Pitch} durationInFrames={3810} fps={30} width={1920} height={1080} />
      <Folder name="Escenas">
        <Composition id="E1-Gancho" component={Gancho} durationInFrames={240} fps={30} width={1920} height={1080} />
        <Composition id="E2-Problema" component={Problema} durationInFrames={420} fps={30} width={1920} height={1080} />
        <Composition id="E3-ComoFunciona" component={ComoFunciona} durationInFrames={540} fps={30} width={1920} height={1080} />
        <Composition id="E4-Veredictos" component={Veredictos} durationInFrames={420} fps={30} width={1920} height={1080} />
        <Composition id="E5-Bandeja" component={RecorridoBandeja} durationInFrames={420} fps={30} width={1920} height={1080} />
        <Composition id="E6-Trampas" component={Trampas} durationInFrames={720} fps={30} width={1920} height={1080} />
        <Composition id="E7-PersonaDecide" component={PersonaDecide} durationInFrames={480} fps={30} width={1920} height={1080} />
        <Composition id="E8-Metricas" component={Metricas} durationInFrames={390} fps={30} width={1920} height={1080} />
        <Composition id="E9-Cierre" component={Cierre} durationInFrames={300} fps={30} width={1920} height={1080} />
      </Folder>
      <Folder name="Presentador">
        <Composition
          id="Rotulo"
          component={Rotulo}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ nombre: "Nombre del presentador", rol: "Equipo · HackRadar 30X" }}
        />
      </Folder>
    </>
  );
};
