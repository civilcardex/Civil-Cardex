import type { IPlanoEngineCore } from '../PlanoState.ts';
import { calculateRamalLength } from '../PlanoEngineDrawing.ts';
import { indexRamales, indexBajantes, indexGuias, indexAreas, indexCotas } from './dragContext.ts';

/** Arrastre de SELECCIÓN MÚLTIPLE: traslada rígidamente todo el grupo (ramales, bajantes,
 *  textos, guías, áreas y cotas) desde sus posiciones originales + delta — cada tipo con su
 *  rama de `origData`. La etiqueta ABSOLUTA desde los originales (no +=) evita el disparo. */
export function dragMultiSelect(engine: IPlanoEngineCore, x: number, y: number): void {
  const tp = engine.toPlane(x, y);
  const dx = tp.x - engine.multiDrag!.startX;
  const dy = tp.y - engine.multiDrag!.startY;
  const ramalesById = indexRamales(engine);
  const bajantesById = indexBajantes(engine);
  const textAnnotsById = new Map(engine.textAnnots.map((tt) => [tt.id, tt]));
  const guiasById = indexGuias(engine);
  const areasById = indexAreas(engine);
  const cotasById = indexCotas(engine);
  for (const id of Object.keys(engine.multiDrag!.origData)) {
    const orig = engine.multiDrag!.origData[id];
    if (!orig) continue;
    if (orig.type === 'ramal') {
      const r = ramalesById.get(id);
      if (r) {
        r.pts = (orig.origPts || []).map((p) => [p[0] + dx, p[1] + dy]);
        r.labelX = (orig.origLabelX || 0) + dx;
        r.labelY = (orig.origLabelY || 0) + dy;
        r.labelAngle = orig.origLabelAngle || 0;
        r.totalL = calculateRamalLength(r.pts, engine);
      }
    } else if (orig.type === 'bajante') {
      const b = bajantesById.get(id);
      if (b) {
        b.x = (orig.origX || 0) + dx;
        b.y = (orig.origY || 0) + dy;
        b.labelX = (orig.origLabelX || 0) + dx;
        b.labelY = (orig.origLabelY || 0) + dy;
      }
    } else if (orig.type === 'text') {
      const t = textAnnotsById.get(id);
      if (t) {
        t.x = (orig.origX || 0) + dx;
        t.y = (orig.origY || 0) + dy;
      }
    } else if (orig.type === 'guide') {
      // Guía = UNA entidad: se trasladan TODOS sus vértices.
      const g = guiasById.get(id);
      if (g) {
        g.pts = (orig.origPts || []).map((p) => [p[0] + dx, p[1] + dy]);
      }
    } else if (orig.type === 'area') {
      // ÁREA del grupo: trasladar vértices + etiqueta.
      const a = areasById.get(id);
      if (a) {
        a.pts = (orig.origPts || []).map((p) => [p[0] + dx, p[1] + dy]);
        // Etiqueta ABSOLUTA desde los originales (mismo patrón que la rama ramal):
        // `+= dx` acumulaba el delta TOTAL en cada mousemove y la etiqueta salía
        // disparada fuera del canvas (orig. usuario: "desaparece del todo").
        if (orig.origLabelX != null) a.labelX = orig.origLabelX + dx;
        if (orig.origLabelY != null) a.labelY = orig.origLabelY + dy;
      }
    } else if (orig.type === 'dim') {
      // COTA del grupo: trasladar extremos (origPts = [p1, p2]) + etiqueta si fue arrastrada.
      const dm = cotasById.get(id);
      const op = orig.origPts || [];
      if (dm && op.length >= 2) {
        dm.x1 = op[0][0] + dx;
        dm.y1 = op[0][1] + dy;
        dm.x2 = op[1][0] + dx;
        dm.y2 = op[1][1] + dy;
        if (orig.origLabelX != null) dm.lblX = orig.origLabelX + dx;
        if (orig.origLabelY != null) dm.lblY = orig.origLabelY + dy;
      }
    }
  }
  engine.scheduleRender();
}
