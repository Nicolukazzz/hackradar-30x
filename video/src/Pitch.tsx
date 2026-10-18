import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import { Canales } from "./escenas/Canales";
import { Cierre } from "./escenas/Cierre";
import { ComoFunciona } from "./escenas/ComoFunciona";
import { Intro } from "./escenas/Intro";
import { Llegada } from "./escenas/Llegada";
import { Moneda } from "./escenas/Moneda";
import { PorDentro } from "./escenas/PorDentro";
import { Portal } from "./escenas/Portal";
import { Roles } from "./escenas/Roles";
import { WhatsApp } from "./escenas/WhatsApp";

// Video maestro de Quadra: 10 escenas con fundidos de 0,5 s (guion en docs/pitch/guion.md).
// Duración = 139,5 s de escenas − 9 fundidos de 0,5 s = 135 s.
export const Pitch = () => {
  const { fps } = useVideoConfig();
  const fundido = <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />;
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="1 Intro" durationInFrames={5 * fps}>
        <Intro />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="2 Canales" durationInFrames={4 * fps}>
        <Canales />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="3 WhatsApp" durationInFrames={14 * fps}>
        <WhatsApp />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="4 Portal" durationInFrames={26 * fps}>
        <Portal />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="5 Llegan solas" durationInFrames={13 * fps}>
        <Llegada />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="6 Cómo funciona" durationInFrames={16 * fps}>
        <ComoFunciona />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="7 Por dentro" durationInFrames={18 * fps}>
        <PorDentro />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="8 Roles" durationInFrames={24 * fps}>
        <Roles />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="9 Moneda" durationInFrames={12.5 * fps}>
        <Moneda />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="10 Cierre" durationInFrames={7 * fps}>
        <Cierre />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
