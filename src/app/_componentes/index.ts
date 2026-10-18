// Componentes compartidos de las pantallas (#6, especificación §13 "Comunes" y §15).
// Ejemplos vivos en /_dev/componentes (solo en desarrollo).
export { BarraConfianza } from "./barra-confianza";
export { Boton, type VarianteBoton } from "./boton";
export { ChipRegla } from "./chip-regla";
export { EncabezadoPagina } from "./encabezado";
export { Kpi } from "./kpi";
export { Monto } from "./monto";
export { PILDORA, PildoraDecision, PildoraResultado } from "./pildora-decision";
export { Tarjeta, TarjetaEncabezado, TarjetaPie } from "./tarjeta";
export * from "./formato";
export { PanelDecision, type AprobadorCorto, type PropsPanelDecision } from "./panel-decision";
export { VistaFactura } from "./vista-factura";
export { CorreccionesProvider, useCorrecciones } from "./correcciones";
export { MontoDudoso, razonMontoDudoso } from "./monto-dudoso";
