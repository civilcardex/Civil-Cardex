/**
 * Mouse up en el canvas: suelta el paneo (cursor según herramienta) y cierra el gesto de
 * arrastre vía handleDragUp. Extraído verbatim de PlanoEngine.ts — contraparte de
 * pointerDown/pointerMove del mismo folder.
 * Ej: soltar tras arrastrar un ramal consolida su asociación a bajantes.
 */
import type { IPlanoEngineCore } from '../PlanoState.ts';
import { handleDragUp } from '../handleDragUp.ts';

export function handlePointerUp(engine: IPlanoEngineCore, e: MouseEvent | TouchEvent): void {
  if (engine.panning) {
    engine.panning = false;
    engine.canv.style.cursor =
      engine.tool === 'pan' ? 'grab' : engine.tool === 'sel' ? 'default' : 'crosshair';
  }
  // Guard typeof: en node (tests sin jsdom) el constructor MouseEvent no existe y `instanceof`
  // lanzaría ReferenceError; en browser/jsdom es siempre true y el chequeo es idéntico.
  const isCtrl =
    (typeof MouseEvent !== 'undefined' && e instanceof MouseEvent && e.ctrlKey) || false;
  handleDragUp(engine, isCtrl);
}
