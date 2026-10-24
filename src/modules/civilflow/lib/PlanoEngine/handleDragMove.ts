import type { IPlanoEngineCore, PlanoBajante } from './PlanoState.ts';
import { dragMultiSelect } from './drags/dragMultiSelect.ts';
import { dragRamalBody } from './drags/dragRamalBody.ts';
import { dragGhost, dragBajante } from './drags/dragBajante.ts';
import {
  dragGuide,
  dragLabel,
  dragText,
  dragTextResize,
  dragCanalResize,
  dragDimLabel,
  dragDim,
  dragAreaVertex,
  dragArea,
} from './drags/dragAnnotations.ts';
import { dragVertex } from './drags/dragVertex.ts';
import type { DragCtx } from './drags/dragContext.ts';

/**
 * Dispatcher de mousemove en arrastre: cada campo de estado de gesto (multiDrag, ramalDrag,
 * bajDrag, ptDrag, …) tiene SU módulo en drags/ — aquí solo se decide cuál corre. El orden de
 * las comprobaciones es el mismo del monolito original y cada rama retorna siempre (un gesto
 * excluye a los demás). Los índices del frame (ramalesPorId/bajantesQueReciben) los consumen
 * bajDrag y ptDrag y se construyen PEREZOSOS: solo esas 2 de las 14 ramas los usaban, y el
 * dispatcher corre por cuadro.
 */
export function handleDragMove(engine: IPlanoEngineCore, x: number, y: number): void {
  // Índices del frame, construidos UNA vez y solo si una rama los pide.
  let ctx: DragCtx | null = null;
  const ctxDe = (): DragCtx => {
    if (ctx) return ctx;
    // Índice id→ramal del plano: el arrastre de un bajante busca sus ramales por id (un
    // .find sobre TODOS los ramales por cada uno) — y el arrastre corre por cuadro.
    const ramalesPorId = new Map(engine.ramales.map((r) => [r.id, r]));
    // Índice inverso: quién bajante recibe a cada ramal. El .includes por bajante (por cada
    // ramal arrastrado) era O(bajantes × recibeDeIds).
    const bajantesQueReciben = new Map<string, PlanoBajante[]>();
    for (const bb of engine.bajantes) {
      for (const rid of bb.recibeDeIds || []) {
        const lista = bajantesQueReciben.get(rid);
        if (lista) lista.push(bb);
        else bajantesQueReciben.set(rid, [bb]);
      }
    }
    return (ctx = { ramalesPorId, bajantesQueReciben });
  };
  if (engine.multiDrag) return dragMultiSelect(engine, x, y);
  if (engine.guideDrag) return dragGuide(engine, x, y);
  if (engine.ramalDrag) return dragRamalBody(engine, x, y);
  if (engine.ghostDrag) return dragGhost(engine, x, y);
  if (engine.bajDrag) return dragBajante(engine, x, y, ctxDe());
  if (engine.lblDrag) return dragLabel(engine, x, y);
  if (engine.txtDrag) return dragText(engine, x, y);
  if (engine.txtResize) return dragTextResize(engine, x, y);
  if (engine.canalResizeDrag) return dragCanalResize(engine, x, y);
  if (engine.dimLblDrag) return dragDimLabel(engine, x, y);
  if (engine.dimDrag) return dragDim(engine, x, y);
  if (engine.areaPtDrag) return dragAreaVertex(engine, x, y);
  if (engine.areaDrag) return dragArea(engine, x, y);
  if (engine.ptDrag) return dragVertex(engine, x, y, ctxDe());
}
