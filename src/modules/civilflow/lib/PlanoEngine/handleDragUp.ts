/**
 * Fin del arrastre en el motor (mouse up): consolida lo que el gesto dejó — cerrar el ramal dibujado con sus chequeos de dirección/ángulos, auto-split en nudos, asociación a bajantes/canales y actualización del fantasma entrepisos (XFG) y del LD_ (ramal desvío entrepisos).
 * Dispatcher: los bloques viven en drags/ (marqueeSelect, dragUpBajante, dragUpVertex,
 * dragUpRamalBody, dragValidation) — contrapartes de los drag-move de drags/.
 * Ej: soltar el extremo de un ramal sobre un bajante escribe la asociación al instante (asociarRamalABajantes).
 */
import type { IPlanoEngineCore } from './PlanoState.ts';
import { confirmarMarquee } from './drags/marqueeSelect.ts';
import { dragUpGhost, dragUpBajante } from './drags/dragUpBajante.ts';
import { dragUpVertex } from './drags/dragUpVertex.ts';
import { dragUpRamalBody } from './drags/dragUpRamalBody.ts';

/**
 * CONTRATO move→up: los backups `_dragBackupPts`, `_dragLinkedBackupPts`, `_bajDragBackupPts`
 * y `_bajDragBackupXY` los ESCRIBE el move (handleDragMove.ts / drags/*) y SOLO los módulos
 * dragUp* los consumen y limpian. Los 15 flags de arrastre (marqueeRect, guideDrag, multiDrag,
 * ghostDrag, lblDrag, txtDrag, txtResize, canalResizeDrag, dimLblDrag, bajDrag, areaDrag,
 * areaPtDrag, dimDrag, ptDrag, ramalDrag) se limpian aquí, en ESTE orden — cada bloque
 * corresponde a un gesto que handleDragMove pudo iniciar.
 */

/** Cierra el gesto de arrastre: confirma marquee (selección por caja), suelta el arrastre de
 *  elementos y resuelve uniones/snapping del punto final. Ej: soltar un ramal sobre la cabeza
 *  de otro forma el nudo con su split automático. */
export function handleDragUp(engine: IPlanoEngineCore, isCtrl: boolean = false): void {
  if (confirmarMarquee(engine, isCtrl)) return;
  if (engine.guideDrag) {
    engine.guideDrag = null;
    engine._markDirty();
    engine.render();
  }
  if (engine.multiDrag) {
    engine.multiDrag = null;
    engine._markDirty();
    engine.render();
  }
  dragUpGhost(engine);
  if (engine.lblDrag) {
    engine._markDirty();
    engine.lblDrag = null;
  }
  if (engine.txtDrag) {
    engine._markDirty();
    engine.txtDrag = null;
  }
  if (engine.txtResize) {
    engine._markDirty();
    engine.txtResize = null;
  }
  if (engine.canalResizeDrag) {
    engine._markDirty();
    engine.canalResizeDrag = null;
  }
  if (engine.dimLblDrag) {
    engine._markDirty();
    engine.dimLblDrag = null;
  }
  dragUpBajante(engine);
  if (engine.areaDrag) {
    engine._markDirty();
    engine.areaDrag = null;
  }
  if (engine.areaPtDrag) {
    engine._markDirty();
    engine.areaPtDrag = null;
  }
  if (engine.dimDrag) {
    engine._markDirty();
    engine.dimDrag = null;
  }
  dragUpVertex(engine);
  dragUpRamalBody(engine);
}
