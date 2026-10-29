import type { PlanoRamal, PlanoBajante, IPlanoEngineCore } from './PlanoState.ts';
import { pointToSegmentDist } from './HitTester.ts';
import { purgarEstadoRamalesBorrados } from './deleteCascade.ts';
import { angleAtHalfLength } from './drawingAngles.ts';
import { _midpoint } from './drawingUtils.ts';

/** Borra la punta de la tubería más cercana a donde hiciste clic. Los dobleces del medio no se
 *  borran con esto: para eso está el borrador. */
export function deleteSegmentAt(engine: IPlanoEngineCore, cx: number, cy: number): void {
  // Ventana anti-alerta del sweep de aparatos (orig. usuario: borrar no debe alertar
  // "Aparato no permitido" por estados transitorios). [] = solo abre la ventana, sin ids.
  engine._emitDelete([]);
  const plane = engine.toPlane(cx, cy);
  const HIT_DIST = 10 / engine.zoom;
  let bestR: PlanoRamal | null = null,
    bestIdx = -1,
    bestD = Infinity;

  for (const r of engine.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length; i++) {
      const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
        bestR = r;
      }
    }
    if (bestD <= HIT_DIST) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const d = pointToSegmentDist(
        plane.x,
        plane.y,
        r.pts[i][0],
        r.pts[i][1],
        r.pts[i + 1][0],
        r.pts[i + 1][1],
      );
      if (d < bestD) {
        bestD = d;
        bestR = r;
        const dA = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
        const dB = Math.hypot(plane.x - r.pts[i + 1][0], plane.y - r.pts[i + 1][1]);
        bestIdx = dA <= dB ? i : i + 1;
      }
    }
  }
  if (!bestR || bestIdx < 0 || bestD > HIT_DIST) return;
  const r = bestR;
  if (bestIdx > 0 && bestIdx < r.pts.length - 1) {
    engine._emitStatus(
      '⚠ No se puede eliminar un segmento intermedio. Solo se pueden eliminar extremos.',
    );
    return;
  }
  if (r.pts.length <= 2) {
    // Borrado = SOLO el trazo borrador (pedido usuario): los tributarios que colgaban no se
    // borran en cascada — el sanado global los re-ancla a la raíz que nombra su label.
    engine.ramales = engine.ramales.filter((x) => x.id !== r.id);
    // Purga conteos del piso (aparatos/hidro/gas) — el id puede reutilizarse al redibujar.
    purgarEstadoRamalesBorrados(engine, [r.id]);
    if (r.tipo !== 'tributario') engine._renumberRamales(r.net);
    engine.selId = null;
    engine._emitSelect(null);
  } else {
    r.pts.splice(bestIdx, 1);
    if (r.labelAngle == null) r.labelAngle = angleAtHalfLength(r.pts);
    r.totalL = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      r.totalL += engine.pxToM(
        Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]),
      );
    }
    r.totalL = +r.totalL.toFixed(3);
    const [mx, my] = _midpoint(r.pts);
    r.labelX = mx;
    r.labelY = my;
  }
  engine.render();
  engine._markDirty();
}

/** La herramienta borrador: un clic sobre cualquier elemento lo borra. Tuberías: el ramal
 *  COMPLETO con sus símbolos (orig. usuario 2026-10-29). Para recortar puntas existe la
 *  herramienta de borrar segmento (deleteSegmentAt). */
export function handleEraseDown(engine: IPlanoEngineCore, cx: number, cy: number): void {
  // Ventana anti-alerta del sweep de aparatos: borrar genera estados transitorios que el
  // sweep flagueaba (orig. usuario). [] = solo abre la ventana, sin ids.
  engine._emitDelete([]);
  engine.selectAt(cx, cy);
  const selId = engine.selId;
  const sel = engine.getSelected();

  if (!sel || !selId) {
    engine._emitStatus('No se encontró nada para borrar bajo el cursor');
    return;
  }

  const isText = engine.textAnnots.some((t) => t.id === selId);
  const isArea = engine.areas.some((a) => a.id === selId);
  const isGuide = engine.guideLines.some((g) => g.id === selId);
  const tipo = (sel as Partial<PlanoBajante & PlanoRamal>).tipo;

  if (
    tipo === 'bajante' ||
    tipo === 'montante' ||
    tipo === 'caja_san' ||
    tipo === 'caja_ll' ||
    tipo === 'red_publica' ||
    tipo === 'contador' ||
    tipo === 'calentador' ||
    tipo === 'canal' ||
    isArea ||
    isText ||
    isGuide ||
    selId.startsWith('DIM')
  ) {
    engine.deleteSelected();
    engine._emitSelect(null);
    engine.selId = null;
    engine._emitStatus('Elemento eliminado');
    engine.render();
    engine._markDirty();
    return;
  }

  if (tipo === 'ramal' || tipo === 'tributario') {
    eraseRamalAt(engine, sel as PlanoRamal, cx, cy);
    return;
  }
}

/** Borrador sobre una tubería ya seleccionada: borra el ramal COMPLETO con sus accMed
 *  (símbolos). Antes recortaba/partía por los vértices con símbolo — el ramal quedaba troceado
 *  (orig. usuario). Para recortar puntas existe deleteSegmentAt. */
export function eraseRamalAt(
  engine: IPlanoEngineCore,
  r: PlanoRamal,
  _cx: number,
  _cy: number,
): void {
  // Path del teclado (Supr sobre ramal seleccionado): mismo anti-alerta que el borrador.
  engine._emitDelete([]);
  // El ramal del brazo de una yee doble ya tenía borrado completo con noMerge propio
  // (recortarlo lo dejaba huérfano — orig. usuario); la regla general lo cubre igual.
  const isDivisor = engine.ramales.some((x) => x.mergesFrom && x.mergesFrom[1] === r.id);
  engine.deleteSelected(undefined, { noMerge: !isDivisor });
  engine._emitSelect(null);
  engine.selId = null;
  engine._emitStatus('Ramal eliminado');
  engine.render();
  engine._markDirty();
}
