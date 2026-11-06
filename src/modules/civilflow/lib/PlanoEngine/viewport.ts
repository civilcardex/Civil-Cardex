/** Encuadre y tamaño del viewport del motor (extraído de PlanoEngine.ts por el guard de
 *  líneas): re-encuadre del dibujo tras cargar, ajuste de la hoja a la vista, re-medición del
 *  lienzo al área visible y vigilancia del contenedor con ResizeObserver.
 *  Ej: tras aterrizar un piso, loadWork dispara reEncuadrarContenido(engine) para centrar. */
import type { EngineFull } from './engineFull.ts';
import { encuadrarDibujo, ptsDeDibujoConDims, tamanoLienzoDibujo } from './planoCamera.ts';

/** Re-encuadra el DIBUJO (no la lámina) tras un loadWork: contenido nuevo → bbox nuevo →
 *  misma doctrina de entrada siempre centrado. La arbitración local-vs-BD que aterriza
 *  después del raster no puede mover los elementos a la vista (orig. usuario: «salto
 *  residual mientras se acomodan»). Sin dibujo cae a la hoja completa. Cámara quieta si el
 *  bbox y la lámina no cambiaron (mismo resultado, cero renders extra). */
export function reEncuadrarContenido(engine: EngineFull): void {
  const bbox = ptsDeDibujoConDims(engine);
  if (!bbox) {
    fitPage(engine);
    engine._encuadreKey = '';
    return;
  }
  const clave = `${bbox.minX.toFixed(1)},${bbox.minY.toFixed(1)},${bbox.maxX.toFixed(1)},${bbox.maxY.toFixed(1)}|${engine.pageW.toFixed(1)}x${engine.pageH.toFixed(1)}`;
  if (clave === engine._encuadreKey) return;
  const enc = encuadrarDibujo({
    visW: engine.cw.clientWidth,
    visH: engine.cw.clientHeight,
    pageW: engine.pageW,
    pageH: engine.pageH,
    bbox,
  });
  engine.zoom = enc.zoom;
  engine.offX = enc.offX;
  engine.offY = enc.offY;
  engine._encuadreKey = clave;
}

/** Ajusta la página PDF dentro del viewport con margen. */
export function fitPage(engine: EngineFull): void {
  if (!engine.pageW || !engine.pageH) return;
  const s = Math.min(
    (engine.cw.clientWidth - 20) / engine.pageW,
    (engine.cw.clientHeight - 36) / engine.pageH,
  );
  engine.zoom = s;
  // El lienzo mide el ÁREA VISIBLE (no la hoja): centrar es viewport − hoja·zoom. La fórmula
  // anterior (pageW·(1−s)/2) suponía un lienzo del tamaño de la hoja y dejaba la hoja
  // corrida a un lado desde que el lienzo pasó a ser la vista.
  engine.offX = (engine.cw.clientWidth - engine.pageW * s) / 2;
  engine.offY = (engine.cw.clientHeight - engine.pageH * s) / 2;
  engine.render();
}

/** Reajusta el lienzo de DIBUJO al ÁREA VISIBLE del visor (no a la hoja). Con zoom alto la
 *  hoja se sale del contenedor y este ya recorta: rasterizar fuera de la vista era el costo
 *  que trababa el paneo (hasta ~50 MP por frame, orig. usuario).
 *  En un motor DESACOPLADO (exportación de planos: contenedor fuera del DOM) no manda el
 *  viewport: ahí el tamaño lo fija `resizeCanvas` explícitamente. */
export function ensureCanvasSize(engine: EngineFull): void {
  if (!engine.cw || !engine.cw.isConnected) return;
  const t = tamanoLienzoDibujo({
    visW: engine.cw.clientWidth || 0,
    visH: engine.cw.clientHeight || 0,
  });
  if (t.w === engine._canvasW && t.h === engine._canvasH) return;
  engine._canvasW = t.w;
  engine._canvasH = t.h;
  engine.resizeCanvas(t.w, t.h);
}

/** Empieza a vigilar el tamaño del contenedor visible. */
export function watchContainerSize(engine: EngineFull): void {
  if (engine._observarResize || !engine.cw || typeof ResizeObserver === 'undefined') return;
  engine._observarResize = new ResizeObserver(() => {
    // El observer dispara también con el cambio de tamaño del lienzo (que cuelga del
    // contenedor): se compara el tamaño para no re-pintar en bucle. scheduleRender (no
    // render) coalesca la ráfaga del RO durante la transición CSS de las barras.
    ensureCanvasSize(engine);
    engine.scheduleRender();
  });
  engine._observarResize.observe(engine.cw);
}

/** Deja de vigilar el contenedor (destroy). */
export function stopWatchingContainerSize(engine: EngineFull): void {
  engine._observarResize?.disconnect();
  engine._observarResize = null;
}
