import type { EngineFull } from '../engineFull.ts';
import { zoomAnclado } from '../planoCamera.ts';
import { handleDragMove } from '../handleDragMove.ts';
import { handleDrawingMouseMove } from '../PlanoEngineDrawing.ts';

/**
 * Movimiento del puntero sobre el lienzo: pinch (≥2 dedos, zoom anclado al punto medio), paneo,
 * arrastre activo (ramalDrag, bajDrag, multiDrag…), marquee de selección o preview del trazo en
 * curso. Movido tal cual de PlanoEngine._onMouseMoveHandler — el método de la clase solo delega.
 */
export function handlePointerMove(engine: EngineFull, e: MouseEvent | TouchEvent): void {
  // PINCH (≥2 dedos): zoom anclado al punto medio — modo consulta móvil/tablet. Con varios
  // dedos no se dibuja ni se arrastra nada; el estado de drag queda congelado hasta levantar.
  if (e instanceof TouchEvent && e.touches.length >= 2) {
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const rect = engine._cachedRect();
    const mx = (a.clientX + b.clientX) / 2 - rect.left;
    const my = (a.clientY + b.clientY) / 2 - rect.top;
    if (engine._pinchDist0 == null) {
      engine._pinchDist0 = dist;
      engine._pinchZoom0 = engine.zoom;
      engine._pinchMid0 = { mx, my };
      return;
    }
    /* Pan del gesto (estándar de mapas, ped. usuario 2026-11-25): el delta del punto medio
     *  traslada el plano; zoomAnclado se aplica DESPUÉS y ancla el zoom sobre la posición YA
     *  paneada — zoom y pan conviven en el mismo arrastre. Funciona con cualquier herramienta
     *  activa: el 2.º dedo nunca dibuja (el trazo va por el pending de 1 dedo en canvasSetup). */
    if (engine._pinchMid0) {
      engine.offX += mx - engine._pinchMid0.mx;
      engine.offY += my - engine._pinchMid0.my;
    }
    engine._pinchMid0 = { mx, my };
    // zoomAnclado solo repinta cuando cambia la escala; el paneo puro (distancia constante
    // o zoom ya saturado) también tiene que dibujar el nuevo offset.
    const zoomAntes = engine.zoom;
    zoomAnclado(engine, (engine._pinchZoom0 * dist) / engine._pinchDist0, mx, my);
    if (engine.zoom === zoomAntes) engine.scheduleRender();
    return;
  }
  engine._pinchDist0 = null;
  engine._pinchMid0 = null;
  const { x, y } = engine._getPos(e);
  engine._lastMouseCvs = { x, y };
  if (engine.panning) {
    engine.offX = x - engine.panX0;
    engine.offY = y - engine.panY0;
    engine.scheduleRender();
    return;
  }
  const hasDrag =
    engine.ghostDrag ||
    engine.guideDrag ||
    engine.bajDrag ||
    engine.canalResizeDrag ||
    engine.lblDrag ||
    engine.txtDrag ||
    engine.txtResize ||
    engine.dimLblDrag ||
    engine.dimDrag ||
    engine.areaDrag ||
    engine.areaPtDrag ||
    engine.ptDrag ||
    engine.ramalDrag ||
    engine.multiDrag;
  if (hasDrag) {
    handleDragMove(engine, x, y);
  } else if (engine.marqueeRect) {
    engine.marqueeRect.x2 = x;
    engine.marqueeRect.y2 = y;
    engine.scheduleRender();
  } else if (
    engine.activeRamal ||
    engine._dimStart ||
    engine._guideStart ||
    engine._canalStart ||
    engine._canalEje ||
    engine.activeArea
  ) {
    handleDrawingMouseMove(engine, x, y);
  }
}
