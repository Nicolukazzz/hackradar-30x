import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import { ComoFunciona } from "./escenas/ComoFunciona";
import { Cierre } from "./escenas/Cierre";
import { Gancho } from "./escenas/Gancho";
import { Metricas } from "./escenas/Metricas";
import { PersonaDecide } from "./escenas/PersonaDecide";
import { Problema } from "./escenas/Problema";
import { RecorridoBandeja } from "./escenas/RecorridoBandeja";
import { Trampas } from "./escenas/Trampas";
import { Veredictos } from "./escenas/Veredictos";

// Video maestro: las 9 escenas en orden con un fundido corto entre cada una (guion en docs/pitch/guion.md).
// Duración = suma de escenas − 8 fundidos de 0,5 s = 131 s − 4 s = 127 s.
export const Pitch = () => {
  const { fps } = useVideoConfig();
  const fundido = <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />;
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="1 Gancho" durationInFrames={8 * fps}>
        <Gancho />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="2 Problema" durationInFrames={14 * fps}>
        <Problema />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="3 Cómo funciona" durationInFrames={18 * fps}>
        <ComoFunciona />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="4 Veredictos" durationInFrames={14 * fps}>
        <Veredictos />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="5 Bandeja" durationInFrames={14 * fps}>
        <RecorridoBandeja />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="6 Trampas" durationInFrames={24 * fps}>
        <Trampas />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="7 Persona decide" durationInFrames={16 * fps}>
        <PersonaDecide />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="8 Métricas" durationInFrames={13 * fps}>
        <Metricas />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="9 Cierre" durationInFrames={10 * fps}>
        <Cierre />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
