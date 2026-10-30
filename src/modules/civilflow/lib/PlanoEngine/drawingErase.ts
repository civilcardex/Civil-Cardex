import type { PlanoRamal, PlanoBajante, IPlanoEngineCore } from './PlanoState.ts';

/** La herramienta borrador: un clic sobre cualquier elemento lo borra. Tuberías: el ramal
 *  COMPLETO con sus símbolos (doctrina 2026-10-29). No recorta puntas: no existe herramienta
 *  de recorte por segmento. */
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
 *  (orig. usuario). */
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
