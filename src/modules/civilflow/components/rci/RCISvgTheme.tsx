/**
 * Paleta compartida de los esquemas SVG del módulo RCI (Red Contra Incendio): los colores del
 * tema (fijos para memoria impresa / variables CSS del repo), los colores de tipología, el
 * formateador numérico es-CO y los estilos CSS de los <svg>. Los esquemas en sí viven en
 * RCISvgSeismic (sismo), RCISvgPump (cuarto de bombas) y RCISvgCanvas (curvas de canvas).
 * Ej: <svg style={SVG_CSS}> con stroke={COL_TEMA.steel}.
 */
import type { CSSProperties } from 'react';

/** svg a ancho completo del contenedor, sin salto de línea (equivale a .sv / .pumpsvg del HTML). */
const SVG_CSS: CSSProperties = { width: '100%', height: 'auto', display: 'block' };

/** Nota al pie de los esquemas tipo "referencia" (la clase .note del HTML). */
const NOTA_CSS: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 11.5,
  lineHeight: 1.45,
  color: 'var(--txt2)',
};

/* ---------------- Paleta ---------------- */

/** Paleta de un esquema RCI: cada clave es un color listo para SVG/canvas (fill/stroke).
 *  Con el tema del repo los valores son var(--x) (solo SVG); para canvas use hex resueltos. */
export interface TemaRci {
  fire: string;
  fireS: string;
  steel: string;
  warn: string;
  warnS: string;
  ok: string;
  okS: string;
  muted: string;
  ink: string;
  line: string;
  lineStrong: string;
  surf: string;
  calc: string;
  /** Fondo de la zona "Análisis del montante" (rgba verde muy suave, como .zm del HTML). */
  zmF: string;
  /** Fondo de la zona "Red del piso" (rgba rojo muy suave, como .zr del HTML). */
  zrF: string;
  /** Familia tipográfica para los <text> del SVG o el font corto de canvas. */
  font: string;
}

/** Paleta FIJA del HTML (memoria impresa / rep=true / canvas): hex directos, sin variables. */
const COL_RCI: TemaRci = {
  fire: '#B3131B',
  fireS: '#F8E3E4',
  steel: '#2F5D7C',
  warn: '#9A600C',
  warnS: '#FBEFD6',
  ok: '#1E7A4C',
  okS: '#E1F2E8',
  muted: '#5A6875',
  ink: '#17222B',
  line: '#D3DAE0',
  lineStrong: '#AEB8C1',
  surf: '#FFFFFF',
  calc: '#F4F6F8',
  zmF: 'rgba(30,122,76,.08)',
  zrF: 'rgba(179,19,27,.05)',
  font: 'sans-serif',
};

/** Variante con las variables CSS del repo (pantalla): misma estructura que COL_RCI.
 *  Solo sirve en SVG/JSX (los var(--x) no se resuelven dentro de un canvas). */
export const COL_TEMA: TemaRci = {
  fire: 'var(--rci, #f87171)',
  fireS: 'rgba(240,69,69,.12)',
  steel: 'var(--af, #2F5D7C)',
  warn: 'var(--warn, #f5a623)',
  warnS: 'rgba(245,166,35,.12)',
  ok: 'var(--succ, #5DBB83)',
  okS: 'rgba(93,187,131,.14)',
  muted: 'var(--txt2)',
  ink: 'var(--txt)',
  line: 'var(--line)',
  lineStrong: 'var(--txt3, #8a9496)',
  surf: 'var(--bg2)',
  calc: 'var(--bg3)',
  zmF: 'rgba(30,122,76,.10)',
  zrF: 'rgba(179,19,27,.08)',
  font: 'var(--body, sans-serif)',
};

/** Elige paleta: rep (memoria impresa) usa los hex fijos del HTML; pantalla usa el tema. */
export const temaRci = (rep = false): TemaRci => (rep ? COL_RCI : COL_TEMA);

/** Paleta con colores RESUELTOS (hex) leídos de las variables CSS del documento: la que hay
 *  que pasarle a dibujaRectFuegoDibujo/dibujaCurvaBomba cuando el esquema va sobre canvas.
 *  Ej: dibujaCurvaBomba(cv.getContext('2d')!, cv.clientWidth, 360, R.bomba, temaResuelto()). */
export function temaResuelto(): TemaRci {
  const fijo = COL_RCI;
  if (typeof window === 'undefined' || typeof document === 'undefined') return fijo;
  const cs = getComputedStyle(document.documentElement);
  const v = (nombre: string, defecto: string): string =>
    (cs.getPropertyValue(nombre) || '').trim() || defecto;
  return {
    ...fijo,
    fire: v('--rci', fijo.fire),
    steel: v('--af', fijo.steel),
    warn: v('--warn', fijo.warn),
    ok: v('--succ', '#5DBB83'),
    muted: v('--txt2', fijo.muted),
    ink: v('--txt', fijo.ink),
    line: v('--line', fijo.line),
    lineStrong: v('--txt3', fijo.lineStrong),
    surf: v('--bg2', fijo.surf),
    calc: v('--bg3', fijo.calc),
    font: 'sans-serif',
  };
}

/* ---------------- Colores de tipología (TCOL del HTML: sin rojos) ---------------- */

/** Colores por tipología del HTML (T1..Tn): sin rojos, que quedan para montante y gabinetes. */
const TCOL = [
  '#2F5D7C',
  '#1E7A4C',
  '#B07A12',
  '#6B4FA0',
  '#0F7C86',
  '#4E5A65',
  '#8A5A2B',
  '#3B7A2A',
  '#5B6FB5',
  '#7A8B2E',
];

/** Color de una tipología por su id ("T3" → tercera de la lista, cíclico). Ej: colorTip('T11') === TCOL[0]. */
export const colorTip = (id: string): string => TCOL[(+id.slice(1) - 1) % TCOL.length] || TCOL[0];

/* ---------------- Números ---------------- */

/** Coma decimal es-CO, "—" si no es finito — canónico en lib/rci/fmtEs (el fmt del HTML).
 *  Ej: fmtNum(12.5) === "12,50"; fmtNum(NaN) === "—". */
export { fmtEs as fmtNum } from '../../lib/rci/fmtEs.ts';
import { fmtEs as fmtNum } from '../../lib/rci/fmtEs.ts';

/** fmtNum a 2 decimales (el n2 del HTML, usado dentro de las cotas de los esquemas). */
export const n2 = (x: number | null | undefined): string => fmtNum(x, 2);

/** Paso "bonito" para ejes de gráfico (1/2/5×10^n): reparte ~5-6 divisiones.
 *  Ej: niceStep(28) === 20 (m = 2,8 → 2×10); niceStep(0.04) === 0.05. */
export function niceStep(x: number): number {
  if (!(x > 0) || !isFinite(x)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
export { COL_RCI, SVG_CSS, NOTA_CSS };
