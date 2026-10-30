import type { EngineFull } from '../engineFull.ts';
import { NETS } from '../PlanoState.ts';
import { TOOL_DOWN } from '../planoToolDispatch.ts';
import { hitTestRightClick, hitTestBajanteLabelForDrag } from '../PlanoEngineHitTesting.ts';
import { handleSelectDown } from '../handleMouseDown.ts';

/**
 * Primer clic/touch del lienzo: reparte entre paneo, menú contextual (clic derecho), terminar
 * el ramal en curso, selección (tool 'sel') o la herramienta activa (TOOL_DOWN). Movido tal cual
 * de PlanoEngine._onDownHandler — el método de la clase solo delega. Ej: clic derecho con ramal
 * a medias → finishRamal() y retorna.
 */
export function handlePointerDown(engine: EngineFull, e: MouseEvent | TouchEvent): void {
  // Congelado (cambio de piso en vuelo): el motor aún muestra el piso ANTERIOR — dibujar
  // o arrastrar aquí crea trazos que loadWork destruirá al aterrizar la BD (y el undo
  // los revivirían como fotocopia cross-piso). Pan y rueda siguen vivos (solo mirar).
  if (engine._frozen) return;
  // 2º dedo del pinch (o palma apoyada): NO re-ejecutar hit-test/selección/dibujo — el
  // touchstart de CADA dedo entra aquí y crearía vértices o selecciones fantasma.
  if (e instanceof TouchEvent && e.touches.length > 1) return;
  const { x, y } = engine._getPos(e);

  if ((e instanceof MouseEvent && e.button === 1) || engine.tool === 'pan') {
    engine.panning = true;
    engine.panX0 = x - engine.offX;
    engine.panY0 = y - engine.offY;
    engine.canv.style.cursor = 'grabbing';
    return;
  }

  if (e instanceof MouseEvent && e.button === 2) {
    // Clic derecho durante el dibujo de un ramal: terminar el ramal
    if (engine.activeRamal && engine.tool === 'line') {
      engine.finishRamal();
      return;
    }
    const hit = hitTestRightClick(engine, x, y, e.clientX, e.clientY);
    if (hit) {
      const el = hit.element;
      // No cambiar la selección con el clic derecho — solo mostrar el menú contextual
      if (engine._onContextMenuCb) {
        engine._onContextMenuCb(
          el,
          hit.clientX,
          hit.clientY,
          hit.isGhostClick,
          hit.ramalEndpoint || null,
          hit.midRamalHit || null,
        );
      }
      engine.render();
    }
    return;
  }

  // Doble clic durante el dibujo de un ramal: terminar el ramal (solo efectivo con botón
  // izquierdo)
  if (e instanceof MouseEvent && e.detail >= 2 && engine.activeRamal && engine.tool === 'line') {
    engine.finishRamal();
    return;
  }

  if (engine._lockedNets.has(engine.activeNet)) return;

  // Red OCULTA (orig. usuario): no se puede dibujar en ella — los trazos nacerían
  // invisibles. El aviso MODAL ya salió al SELECCIONAR la red (handleSelectNet en el
  // visor); aquí solo estado, sin duplicar la modal. Selección también: los hits de
  // redes ocultas se filtran en los hit-tests.
  if (engine.tool !== 'sel' && engine._hiddenNets.has(engine.activeNet)) {
    const netObj = NETS.find((n) => n.id === engine.activeNet);
    engine._emitStatus(
      `${netObj ? netObj.name : engine.activeNet} está oculta — muéstrala en la barra de redes para dibujar en ella.`,
    );
    return;
  }

  if (engine.activeNetworks && !engine.activeNetworks.has(engine.activeNet)) {
    const netObj = NETS.find((n) => n.id === engine.activeNet);
    const netName = netObj ? netObj.name : engine.activeNet;
    engine.triggerAlert(
      'Red inactiva',
      `Debe activar la red de ${netName} en la información general`,
    );
    return;
  }

  const p = engine.toPlane(x, y);

  if (engine.tool === 'sel') {
    const lblDragResult = hitTestBajanteLabelForDrag(engine, x, y);
    if (lblDragResult) {
      // Este hit-test solo coincide con la posición REAL de la etiqueta del bajante (_labelBox
      // / labelX,Y) — nunca revisa el _ghostLabelBox desplazado del fantasma — así que siempre
      // es un arrastre de etiqueta del padre. _lblDragIsParent debe fijarse aquí explícitamente:
      // esta ruta se saltea handleSelectDown por completo (retorno temprano), así que sin esto
      // conservaba cualquier valor viejo de la INTERACCIÓN ANTERIOR. Si esa interacción previa
      // había seleccionado el renderizado FANTASMA del mismo bajante (_lblDragIsParent en
      // false), arrastrar lo que parecía la etiqueta real aquí escribía en silencio en
      // ghostData — moviendo el fantasma a la posición del clic en vez de la etiqueta real que
      // el usuario arrastraba.
      engine._lblDragIsParent = true;
      engine.lblDrag = lblDragResult;
      return;
    }
    handleSelectDown(
      engine,
      x,
      y,
      e instanceof MouseEvent && (e.ctrlKey || false),
      e instanceof MouseEvent && e.shiftKey,
    );
  } else {
    // Dispatch de herramientas (extraído a planoToolDispatch): la escalera de 13
    // if/else era el último bloque largo de este método.
    TOOL_DOWN[engine.tool]?.(engine, p.x, p.y, x, y);
  }
}
