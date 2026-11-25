/** Dónde se tocó el elemento seleccionado (extremo, cuerpo o fantasma): el MISMO cálculo del
 *  clic derecho, para que el botón «Opciones» de las tablets abra el menú con las secciones de
 *  ese punto. Primero prueba el último toque sobre el lienzo; si no cayó en este elemento (p. ej.
 *  se eligió desde la lista), busca un punto de su cuerpo. Sin punto, el menú abre sin las
 *  secciones que dependen de él. Ej: toque en la punta de un ramal sanitario → ese extremo. */
import { hitTestRightClick } from '../../../lib/PlanoEngine/PlanoEngineHitTesting.ts';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement } from '../../../lib/PlanoEngine/PlanoState.ts';
import type { ContextMenuState } from './context.ts';

type HitDelMenu = Pick<ContextMenuState, 'isGhostClick' | 'ramalEndpoint' | 'midRamalHit'>;

export function hitDelSeleccionado(
  engine: PlanoEngine,
  element: PlanoElement,
  toque?: { x: number; y: number } | null,
): HitDelMenu {
  const prueba = (x: number, y: number): HitDelMenu | null => {
    const hit = hitTestRightClick(engine, x, y, 0, 0);
    return hit && hit.element.id === element.id
      ? {
          isGhostClick: hit.isGhostClick,
          ramalEndpoint: hit.ramalEndpoint || null,
          midRamalHit: hit.midRamalHit || null,
        }
      : null;
  };
  const d = toque ?? engine._lastDown;
  let hit = d ? prueba(d.x, d.y) : null;
  const pts = (element as { pts?: number[][] }).pts;
  for (let i = 0; !hit && pts && i < pts.length - 1; i++) {
    const c = engine.toCvs((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    hit = prueba(c.x, c.y);
  }
  return hit ?? {};
}
