// El cargador golden vive en src/evaluacion/escenario.ts (lo usan la API y la evaluación).
export { beneficiarioDelRemitente } from "@/ingesta/ingerir";
export {
  cargarGolden,
  type DocGolden,
  type EscenarioGolden,
  extraccionDesdePlana,
} from "@/evaluacion/escenario";
