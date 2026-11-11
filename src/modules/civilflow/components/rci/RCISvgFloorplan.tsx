/**
 * Fachada de los esquemas SVG de la red de rociadores del piso (RCI, Red Contra Incendio):
 * re-exporta el corte de la derivación (RCISvgCorte), la planta tipo (RCISvgPlan), la
 * instalación típica con VRP (RCISvgVrp) y los helpers de cota (RCISvgCotas). Se mantiene para
 * que los importadores no cambien. Ej: import { CorteSvg, PlanSvg } from "./RCISvgFloorplan.tsx".
 *
 * Geometría portada LITERAL del HTML de referencia CIVILFLOW_RCI_v1.7.79 (mismos viewBox,
 * mismos px): corteSVG (~2384), planSVG (~2409), vrpSVG (~3415). Las marcas de cota
 * marker-start/marker-end url(#ga) se dibujan como flechitas path (helpers Flecha/CotaH/CotaV).
 */
export { CorteSvg, type CorteDatos } from './RCISvgCorte.tsx';
export { PlanSvg, type PlanOpts } from './RCISvgPlan.tsx';
export { VrpSvg } from './RCISvgVrp.tsx';
export { Flecha, CotaH, CotaV, SVG_CSS } from './RCISvgCotas.tsx';
