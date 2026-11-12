/** Lo que comparten los pasos de la Guía de diseño RCI: los estilos (franjas y texto del HTML
 *  de referencia, con variables del repo), los prefijos de verificación que la guía consulta y
 *  el paquete de props con el que la fachada RCIGuideSteps alimenta a cada paso.
 *  Ej: <PasoRiesgo ctx={ctx} chk={chk} /> usa TXT/UL/GST para pintar "Clasifique el riesgo". */
import type { CSSProperties } from 'react';
import type { RciCtx } from '../RCIUI.tsx';
import type { Verificacion } from '../../../lib/rci/types.ts';

/** Prefijos de verificación que la guía consulta (el chk(lab) del HTML, por startsWith). */
export const PREFIJOS_CHK = [
  'Riesgo NFPA 13 compatible',
  'Altura de arrume',
  'Separación entre rociadores',
  'Separación entre ramales',
  'Área por rociador',
  'Distancia a muro',
] as const;
/** Unión de esos prefijos: los enlaces «Ir al dato» de la guía saltan a la verificación cuyo id empieza con él. */
export type PrefijoChk = (typeof PREFIJOS_CHK)[number];

/** Props comunes de los pasos: el ctx vivo del proyecto más lo que la fachada ya resolvió
 *  (chk/chkMap sobre las verificaciones). La fachada pasa los 4 a todos; cada paso toma los
 *  que usa. */
export interface PropsPasoGuia {
  ctx: RciCtx;
  /** Salta a la sección del dato pendiente (los «Corregir» del paso ¿Listo para dibujar?). */
  irGo: (go: string[]) => void;
  /** Estado ('CUMPLE'/'NO CUMPLE'/'PENDIENTE') de la verificación cuyo label empieza con el prefijo. */
  chk: (p: PrefijoChk) => string;
  /** Mapa prefijo → verificación (para el «Corregir» con el go real del motor). */
  chkMap: Map<PrefijoChk, Verificacion>;
}

const TXT: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: 'var(--txt2)',
  margin: '6px 0',
};
const UL: CSSProperties = {
  margin: '6px 0',
  paddingLeft: 20,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: 'var(--txt2)',
};
/** Franja .gstate del HTML: fondo del color de cálculo (COL_TEMA.calc = var(--bg3)). */
const GST: CSSProperties = {
  padding: '8px 10px',
  background: 'var(--bg3)',
  borderRadius: 5,
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 10px',
  alignItems: 'center',
  fontSize: 12,
  margin: '10px 0 0',
};
const GCAP: CSSProperties = {
  fontSize: 10.5,
  color: 'var(--txt3)',
  margin: '4px 0',
  fontFamily: 'var(--mono)',
};
/* maxWidth 620: el SVG del paso baja a ~240px de alto y los pasos 2/5 caben sin scroll. */
const BLOQUE: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: 8,
  background: 'var(--bg2)',
  minWidth: 0,
};
/* Compacto SOLO para los pasos 2 y 5 (los que pedía sin scroll): SVG a ~240px de alto. */
const BLOQUE_COMPACTO: CSSProperties = { ...BLOQUE, maxWidth: 620, margin: '0 auto' };
/* Fila de DOS esquemas lado a lado (el .gpair del HTML de referencia): auto-fit — 2 columnas
 * cuando caben (~840px+), 1 columna debajo. Responsive sin media queries. */
const GPAIR: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
  gap: 14,
  alignItems: 'stretch',
};
const BTN_CHICO: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt)',
  borderRadius: 'var(--r)',
  padding: '3px 10px',
  fontSize: 11.5,
  cursor: 'pointer',
  fontFamily: 'var(--body)',
  whiteSpace: 'nowrap',
};

export { TXT, UL, GST, GCAP, BLOQUE, BLOQUE_COMPACTO, GPAIR, BTN_CHICO };
