/**
 * Soltar el arrastre del CUERPO de un ramal (dragRamalBody lo movió): valida ángulo, padre
 * correcto y dirección de flujo (con rollback de pts y del bajante origen si es un Ldesvio),
 * chequea muros RCI y termina con la cola postDragRamal (split en T + modal de accesorios).
 * Extraído verbatim de handleDragUp.ts. Ej: soltar un ramal sobre un bajante asocia al instante.
 */
import type { IPlanoEngineCore } from '../PlanoState.ts';
import { detectAccesorioTrigger } from '../drawingAngles.ts';
import {
  autoSplitJunctionAndSumFlow,
  checkRamalAnglesExcludingConnections,
} from '../PlanoEngineDrawing.ts';
import { updateCrossFloorGhostPositionBySource } from '../../../utils/associateBajanteAcrossFloors';
import { chequeoMurosTrazo } from '../RCIAutoDraw.ts';
import { dragFlowCheck, draggedOntoWrongPadre } from './dragValidation.ts';

// Las uniones de san/ll/vent (tee/codo/yee) se crean solas vía calcSanitaryAccessories +
// renderJunctions — solo AF/AC/gas necesitan que el usuario elija el tipo de tee.
/** Cola post-arrastre común a TODA red (después de las validaciones particulares): propaga la
 *  posición del bajante de origen al piso vecino si el ramal es su Ldesvio, forma el split de
 *  unión en T (revirtiendo el arrastre si la conexión queda bloqueada) y dispara el modal de
 *  accesorios de tee si la red lo pide. Ej: postDragRamal(engine, ram, origPts, srcBaj). */
export function postDragRamal(
  engine: IPlanoEngineCore,
  ram: IPlanoEngineCore['ramales'][number],
  origPts: [number, number][] | null,
  srcBaj: IPlanoEngineCore['bajantes'][number] | null | undefined,
): void {
  if (srcBaj) {
    const sourcePlanId = String(engine._loadedPlanId ?? '');
    updateCrossFloorGhostPositionBySource(sourcePlanId, srcBaj.id, srcBaj.x, srcBaj.y);
    return;
  }
  if (autoSplitJunctionAndSumFlow(engine, ram)) {
    // Conexión bloqueada (a tributario): revertir el arrastre como el caso de flujo.
    if (origPts) {
      ram.pts = origPts;
      engine._markDirty();
      engine.render();
    }
    return;
  }
  checkAccesorioTrigger(engine, ram.id);
}

export function checkAccesorioTrigger(engine: IPlanoEngineCore, ramalId: string): void {
  if (!engine.triggerAccesorioModal) return;
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r) return;
  if (r.net !== 'af' && r.net !== 'ac' && r.net !== 'gas') return;
  const trigger = detectAccesorioTrigger(engine, ramalId);
  if (trigger) engine.triggerAccesorioModal(trigger);
}

/** Cuerpo de ramal soltado: cadena de validaciones en orden (ángulo → padre → flujo → muros
 *  RCI → cola común); cada rechazo revierte con su alerta. */
export function dragUpRamalBody(engine: IPlanoEngineCore): void {
  if (!engine.ramalDrag) return;
  const rId = engine.ramalDrag.id;
  const origPts = engine.ramalDrag.origPts;
  engine.ramalDrag = null;
  engine._markDirty();
  const ram = engine.ramales.find((r) => r.id === rId);
  // Si este ramal es un Ldesvio, al arrastrarlo también se arrastró su bajante origen (ver
  // handleDragMove.ts) — cualquier rollback de abajo debe revertir eso también, y cualquier
  // soltado exitoso debe propagar la nueva posición del bajante al storage del otro piso, igual
  // que ya lo hace un bajDrag directo.
  const srcBajId = rId.startsWith('LD_') ? rId.slice(3) : null;
  const srcBaj = srcBajId ? engine.bajantes.find((b) => b.id === srcBajId) : null;
  const origSrcXY = srcBaj ? { x: srcBaj.x, y: srcBaj.y } : null;
  if (ram && !checkRamalAnglesExcludingConnections(engine, ram)) {
    engine.triggerAlert(
      'Ángulo no recomendado',
      ram.net === 'san' || ram.net === 'll'
        ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
        : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
    );
    if (origPts) {
      ram.pts = origPts;
      if (srcBaj && origSrcXY) {
        srcBaj.x = origSrcXY.x;
        srcBaj.y = origSrcXY.y;
      }
      engine._markDirty();
      engine.render();
    }
  } else if (ram && ram.tipo === 'tributario' && draggedOntoWrongPadre(engine, ram)) {
    // Advertencia "Ramal padre incorrecto" inhabilitada — se permite el movimiento, pero la
    // dirección de flujo SÍ se valida (orig. usuario): mal direction = revertir el arrastre.
    const flowErr = dragFlowCheck(engine, ram, []);
    if (flowErr) {
      engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
      if (origPts) {
        ram.pts = origPts;
        if (srcBaj && origSrcXY) {
          srcBaj.x = origSrcXY.x;
          srcBaj.y = origSrcXY.y;
        }
        engine._markDirty();
        engine.render();
      }
    } else {
      engine._markDirty();
      engine.render();
    }
  } else if (ram) {
    const flowErr = dragFlowCheck(engine, ram, []);
    if (flowErr) {
      engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
      if (origPts) {
        ram.pts = origPts;
        if (srcBaj && origSrcXY) {
          srcBaj.x = origSrcXY.x;
          srcBaj.y = origSrcXY.y;
        }
        engine._markDirty();
        engine.render();
      }
    } else if (ram.net === 'rci' && ram.tipo === 'ramal') {
      /* Distancia de ramales a muros EN VIVO también al MOVER un trazo ya dibujado (ped.
         usuario): si el ramal movido deja un muro de su BANDA (a ≤ 2·Dmuro de él) a >
         Dmuro del ramal más cercano, el movimiento se revierte con la alerta. El ramal ya
         está movido en engine.ramales — chequeoMurosTrazo evalúa el estado post-movimiento. */
      const errMuro = chequeoMurosTrazo(engine, ram.pts, engine.dmuroRci);
      if (errMuro) {
        engine.triggerAlert('Distancia a muro', errMuro);
        if (origPts) {
          ram.pts = origPts;
          engine._markDirty();
          engine.render();
        }
      } else postDragRamal(engine, ram, origPts, srcBaj);
    } else postDragRamal(engine, ram, origPts, srcBaj);
  }
}
