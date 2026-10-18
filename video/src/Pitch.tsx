import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { getStaticFiles, staticFile, useVideoConfig } from "remotion";
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

// Video maestro de Quadra: apertura del presentador + 10 escenas con fundidos de 0,5 s (guion en docs/pitch/guion.md).
// La voz en off sale de `public/voz/<escena>.m4a` (si existe) y empieza con su escena.
// Duración = 160 s de escenas − 10 fundidos de 0,5 s = 155 s.

/** Voz en off de una escena, solo si el archivo está en `public/voz/`. */
const Voz: React.FC<{ nombre: string }> = ({ nombre }) => {
  const ruta = `voz/${nombre}.m4a`;
  return getStaticFiles().some((f) => f.name === ruta) ? <Audio src={staticFile(ruta)} /> : null;
};

export const Pitch = () => {
  const { fps } = useVideoConfig();
  const fundido = <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />;
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="0 Presentador" durationInFrames={14.5 * fps}>
        <Presentador />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="1 Intro" durationInFrames={5 * fps}>
        <Intro />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="2 Canales" durationInFrames={5 * fps}>
        <Canales />
        <Voz nombre="canales" />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="3 WhatsApp" durationInFrames={14 * fps}>
        <WhatsApp />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="4 Portal" durationInFrames={29 * fps}>
        <Portal />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="5 Llegan solas" durationInFrames={13 * fps}>
        <Llegada />
        <Voz nombre="llegada" />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="6 Cómo funciona" durationInFrames={18 * fps}>
        <ComoFunciona />
        <Voz nombre="como-funciona" />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="7 Por dentro" durationInFrames={18 * fps}>
        <PorDentro />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="8 Roles" durationInFrames={24 * fps}>
        <Roles />
        <Voz nombre="roles" />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="9 Moneda" durationInFrames={12.5 * fps}>
        <Moneda />
        <Voz nombre="moneda" />
      </TransitionSeries.Sequence>
      {fundido}
      <TransitionSeries.Sequence name="10 Cierre" durationInFrames={7 * fps}>
        <Cierre />
        <Voz nombre="cierre" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
