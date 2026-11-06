/** Fachada de los esquemas SVG del módulo RCI: re-exporta la paleta/tema (RCISvgTheme),
 *  el esquema sísmico (RCISvgSeismic), el del cuarto de bombas (RCISvgPump) y las curvas de
 *  canvas (RCISvgCanvas). Se mantiene para que los 10 importadores no cambien.
 *  Ej: import { colorTip, PumpSvg } from "./RCISvgSchemas.tsx" sigue igual. */
export * from './RCISvgTheme.tsx';
export { SismoSvg } from './RCISvgSeismic.tsx';
export { PumpSvg } from './RCISvgPump.tsx';
export { dibujaRectangulo, dibujaCurvaBomba } from './RCISvgCanvas.ts';
