import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';
import { bboxDePuntos, type BboxDibujo } from '../../lib/PlanoEngine/planoCamera.ts';

/**
 * Rectángulo del dibujo del plano (px de plano) para encuadrar la vista sin el fondo de la lámina.
 * Ej: piso con un ramal y un bajante -> caja de esos trazos; sin dibujo -> null.
 * @param eng - motor con el plano cargado.
 * @returns rectángulo del dibujo, o null si no hay nada trazado.
 */
export function bboxDelDibujo(eng: IPlanoEngineCore | null): BboxDibujo | null {
  if (!eng) return null;
  const pts: Array<{ x: number; y: number }> = [];
  for (const r of eng.ramales || []) {
    for (const p of r.pts || []) pts.push({ x: p[0], y: p[1] });
  }
  for (const b of eng.bajantes || []) {
    if (typeof b.x === 'number' && typeof b.y === 'number') pts.push({ x: b.x, y: b.y });
  }
  for (const a of eng.areas || []) {
    for (const p of (a as { pts?: number[][] }).pts || []) pts.push({ x: p[0], y: p[1] });
  }
  return bboxDePuntos(pts);
}
