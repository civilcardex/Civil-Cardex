// Movimiento del ratón en modo dibujo y doble clic (fin de ramal/guía/área).// Extraídos verbatim de lineTool.
import type { IPlanoEngineCore } from './PlanoState';

import { finishRamal } from './finishRamal';
import { commitOpenGuide } from './guideLines';
import { finishArea } from './drawingUtils';
import { dimSnapEnd } from './annotationTools';

/** Pide un render al mover el mouse cuando hay un dibujo activo (ramal, cota o área) en curso.
 *  @param engine Instancia del motor. @param x Coordenada X de canvas. @param y Coordenada Y de
 *  canvas. */
export function handleDrawingMouseMove(engine: IPlanoEngineCore, x: number, y: number): void {
  if (
    engine.activeRamal ||
    engine._dimStart ||
    engine._guideStart ||
    engine._canalStart ||
    engine._canalEje ||
    engine.activeArea
  ) {
    engine.mouseX = x;
    engine.mouseY = y;
    // PUNTO 3: preview de cota CON snap — lo que se ve durante el arrastre es exactamente
    // lo que se aterriza al hacer clic (mismo comportamiento visual que ramales/tributarios).
    if (engine._dimStart) {
      // Solo hay punto previo cuando el snap está activo (el marcador indica anclaje).
      // ojo: x/y llegan en CANVAS — convertir a PLANO antes de aplicar el snap (mezclar
      // sistemas estiraba el preview a un punto lejísimo, orig. usuario).
      const pp = engine.toPlane(x, y);
      engine._dimPreviewPt = engine.snapMode ? dimSnapEnd(engine, engine._dimStart, pp) : null;
    }
    engine.scheduleRender();
  }
}

/** Termina el ramal o área activos al hacer doble clic. @param engine Instancia del motor. */
export function handleDoubleClick(engine: IPlanoEngineCore): void {
  if (engine.tool === 'line' && engine.activeRamal && engine.activeRamal.pts.length >= 2) {
    finishRamal(engine);
  }
  if (engine.tool === 'area' && engine.activeArea && engine.activeArea.pts.length >= 3) {
    finishArea(engine);
  }
  // Ítem 2: doble-click commitea la guía multisegmento en construcción.
  if (engine.tool === 'guide' && engine._guidePts && engine._guidePts.length >= 2) {
    commitOpenGuide(engine);
  }
  // Canal: el 2º click de un doble-clic queda como "fase 1" fantasma justo después del
  // commit de ancho — se cancela para no abrir un canal nuevo accidental (y era la vía por
  // la que un canal nacía con 1 cm: el click fantasma caía a ~0 del eje).
  if (engine.tool === 'canal' && engine._canalStart && !engine._canalEje) {
    engine._canalStart = null;
    engine.render();
  }
}
