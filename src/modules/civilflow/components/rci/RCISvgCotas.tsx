/**
 * Helpers de cota de los esquemas SVG de RCI (Red Contra Incendio): reemplazan los markers
 * url(#ga) del HTML de referencia como paths de flechita. Extraído verbatim de RCISvgFloorplan.
 * Ej: <CotaH x1={0} x2={80} y={16} /> dibuja la línea con flechas hacia afuera en ambos extremos.
 */
import type { CSSProperties } from 'react';
import { COL_TEMA } from './RCISvgSchemas';

/** Estilo común de los svg de esquema: ancho completo, alto proporcional al viewBox. */
export const SVG_CSS: CSSProperties = { width: '100%', height: 'auto', display: 'block' };

/** Flechita de cota: el chevron del marcador "ga" del HTML como path, apuntando en `dir`. */
export function Flecha({
  x,
  y,
  dir,
  col = COL_TEMA.muted,
}: {
  x: number;
  y: number;
  dir: 'l' | 'r' | 'u' | 'd';
  col?: string;
}) {
  const d =
    dir === 'r'
      ? `M${x - 4.2} ${y - 2.8}L${x} ${y}L${x - 4.2} ${y + 2.8}`
      : dir === 'l'
        ? `M${x + 4.2} ${y - 2.8}L${x} ${y}L${x + 4.2} ${y + 2.8}`
        : dir === 'd'
          ? `M${x - 2.8} ${y - 4.2}L${x} ${y}L${x + 2.8} ${y - 4.2}`
          : `M${x - 2.8} ${y + 4.2}L${x} ${y}L${x + 2.8} ${y + 4.2}`;
  return <path d={d} fill="none" style={{ stroke: col, strokeWidth: 1.5 }} />;
}

/** Cota horizontal con flechas hacia afuera en ambos extremos (marker-start/end del HTML). */
export function CotaH({
  x1,
  x2,
  y,
  col = COL_TEMA.muted,
}: {
  x1: number;
  x2: number;
  y: number;
  col?: string;
}) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} style={{ stroke: col, strokeWidth: 1 }} />
      <Flecha x={x1} y={y} dir="l" col={col} />
      <Flecha x={x2} y={y} dir="r" col={col} />
    </g>
  );
}

/** Cota vertical con flechas hacia afuera (arriba y abajo). */
export function CotaV({
  x,
  y1,
  y2,
  col = COL_TEMA.muted,
}: {
  x: number;
  y1: number;
  y2: number;
  col?: string;
}) {
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} style={{ stroke: col, strokeWidth: 1 }} />
      <Flecha x={x} y={y1} dir="u" col={col} />
      <Flecha x={x} y={y2} dir="d" col={col} />
    </g>
  );
}
