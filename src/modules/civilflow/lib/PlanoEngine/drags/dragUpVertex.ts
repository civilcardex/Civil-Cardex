/**
 * Soltar el arrastre de un VÉRTICE de ramal (dragVertex lo movió): valida ángulos (con
 * rotación de rescate al pegar sobre bajante), padre correcto, dirección de flujo, split en T
 * y asociación a bajantes — cada rechazo revierte con los backups del move (contrato
 * move→up: _dragBackupPts/_dragLinkedBackupPts los escribe handleDragMove y SOLO aquí se
 * consumen). Extraído verbatim de handleDragUp.ts.
 * Ej: soltar el extremo dentro de un bajante escribe recibeDeIds/alimentaIds con rollback.
 */
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import {
  autoSplitJunctionAndSumFlow,
  checkRamalAnglesExcludingConnections,
  puntoEnCaja,
} from '../PlanoEngineDrawing.ts';
import { asociarRamalABajantes } from '../drawingUtils.ts';
import { dragFlowCheck, draggedOntoWrongPadre, tryRotateToValidAngle } from './dragValidation.ts';
import { checkAccesorioTrigger } from './dragUpRamalBody.ts';

/** Vértice soltado: cadena de validaciones en orden — ángulos (primaryOk/linkedOk, con
 *  excepción de llegada a caja) → padre → flujo → autoSplit → asociación a bajantes. */
export function dragUpVertex(engine: IPlanoEngineCore): void {
  if (!engine.ptDrag) return;
  const rId = engine.ptDrag.id;
  const linkedPts = engine.ptDrag.linkedPts;
  const ptIdx = engine.ptDrag.ptIdx;
  engine.ptDrag = null;
  engine._markDirty();
  const ram = engine.ramales.find((r) => r.id === rId);
  const linkedRamales = (linkedPts || [])
    .map((l) => engine.ramales.find((r) => r.id === l.id))
    .filter((r): r is PlanoRamal => !!r);

  // El par san/vent de un codo reventilado debe revertirse junto — si solo se revierte un lado,
  // el arrastre dejaría la unión partida en vez de simplemente deshecha.
  // Bug #7: excluir segmentos de conexión (extremo que toca otro ramal/bajante) — su ángulo
  // lo dicta la geometría existente, no la cuadrícula.
  const primaryOk = ram ? checkRamalAnglesExcludingConnections(engine, ram) : true;
  const linkedOk = linkedRamales.every((r) => checkRamalAnglesExcludingConnections(engine, r));

  // Entrada a caja (orig. usuario): el ángulo de llegada lo dicta la caja, no la
  // cuadrícula — si el extremo arrastrado cayó dentro de una caja de la red, NO se valida
  // por ángulo (sin alerta ni rollback); el flujo y el split sí se validan abajo.
  const droppedInCaja = ram ? puntoEnCaja(engine, ram.pts[ptIdx], ram.net) : false;
  if (ram && (!primaryOk || !linkedOk) && !droppedInCaja) {
    // Un arrastre de extremo que se PEGÓ sobre un bajante (handleDragMove fija el punto
    // exactamente sobre el bajante) no debe revertirse — perder la conexión que el usuario
    // acaba de hacer es peor que perder el punto exacto del cursor. Se rota el ramal alrededor
    // del bajante (que queda fijo) hasta el ángulo válido más cercano. La rotación es rígida,
    // así que solo arregla violaciones absolutas de paso de segmento; las violaciones de giro
    // interno siguen revirtiéndose abajo.
    const rotatedOk = tryRotateToValidAngle(engine, ram, ptIdx, linkedOk);
    if (rotatedOk) {
      engine._dragBackupPts = null;
      engine._dragLinkedBackupPts = null;
      engine._markDirty();
      engine.render();
    } else {
      engine.triggerAlert(
        'Ángulo no recomendado',
        ram.net === 'san' || ram.net === 'll'
          ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
      );
      if (engine._dragBackupPts) {
        ram.pts = engine._dragBackupPts;
        engine._dragBackupPts = null;
      }
      const linkedBackups = engine._dragLinkedBackupPts;
      if (linkedBackups) {
        for (const r of linkedRamales) {
          if (linkedBackups[r.id]) r.pts = linkedBackups[r.id];
        }
      }
      engine._dragLinkedBackupPts = null;
      engine._markDirty();
      engine.render();
    }
  } else if (ram && ram.tipo === 'tributario' && draggedOntoWrongPadre(engine, ram)) {
    // Advertencia "Ramal padre incorrecto" inhabilitada — se permite el movimiento, pero la
    // dirección de flujo SÍ se valida: trib→ramal y trib→trib como ramal→ramal (orig. usuario).
    const flowErr = dragFlowCheck(engine, ram, linkedRamales);
    if (flowErr) {
      engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
      if (engine._dragBackupPts) {
        ram.pts = engine._dragBackupPts;
        engine._dragBackupPts = null;
      }
      const linkedBackups = engine._dragLinkedBackupPts;
      if (linkedBackups) {
        for (const r of linkedRamales) {
          if (linkedBackups[r.id]) r.pts = linkedBackups[r.id];
        }
      }
      engine._dragLinkedBackupPts = null;
      engine._markDirty();
      engine.render();
    } else {
      engine._dragLinkedBackupPts = null;
      engine._markDirty();
      engine.render();
    }
  } else {
    const flowErr = ram ? dragFlowCheck(engine, ram, linkedRamales) : null;
    if (ram && flowErr) {
      engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
      if (engine._dragBackupPts) {
        ram.pts = engine._dragBackupPts;
        engine._dragBackupPts = null;
      }
      const linkedBackups = engine._dragLinkedBackupPts;
      if (linkedBackups) {
        for (const r of linkedRamales) {
          if (linkedBackups[r.id]) r.pts = linkedBackups[r.id];
        }
      }
      engine._dragLinkedBackupPts = null;
      engine._markDirty();
      engine.render();
    } else {
      const blocked = ram ? autoSplitJunctionAndSumFlow(engine, ram) : false;
      if (ram && blocked) {
        // Conexión bloqueada (a tributario): revertir el arrastre como el caso de flujo.
        if (engine._dragBackupPts) {
          ram.pts = engine._dragBackupPts;
          engine._dragBackupPts = null;
        }
        const linkedBackups = engine._dragLinkedBackupPts;
        if (linkedBackups) {
          for (const r of linkedRamales) {
            if (linkedBackups[r.id]) r.pts = linkedBackups[r.id];
          }
        }
        engine._dragLinkedBackupPts = null;
        engine._markDirty();
        engine.render();
      } else {
        // Soltar un extremo SOBRE un bajante asocia igual que dibujarlo ahí
        // (recibeDeIds/alimentaIds + ini/fin) — antes el trazo quedaba visualmente
        // conectado pero suelto (sin checks en paneles, sin UDs heredadas, sin espejo
        // de salida). La guard central puede rechazar (tope/red): se revierte el
        // arrastre como los demás casos. Un extremo que YA estaba asociado (suelto
        // dentro de la caja del símbolo) no se duplica: asociar salta los ya escritos.
        const assocBajs = new Map(
          engine.bajantes.map((b) => [
            b.id,
            {
              recibe: [...(b.recibeDeIds || [])],
              alimenta: [...(b.alimentaIds || [])],
              dNominal: b.dNominal || '',
            },
          ]),
        );
        const assocR = ram ? { ini: ram.ini, fin: ram.fin, diametro: ram.diametro } : null;
        const assoc = ram
          ? asociarRamalABajantes(engine, ram, false)
          : { rejected: false as const, alert: undefined };
        if (assoc.alert) engine.triggerAlert(assoc.alert.title, assoc.alert.msg);
        if (assoc.rejected && ram && assocR) {
          for (const b of engine.bajantes) {
            const s = assocBajs.get(b.id);
            if (!s) continue;
            b.recibeDeIds = s.recibe;
            b.alimentaIds = s.alimenta;
            b.dNominal = s.dNominal;
          }
          ram.ini = assocR.ini;
          ram.fin = assocR.fin;
          ram.diametro = assocR.diametro;
          if (engine._dragBackupPts) {
            ram.pts = engine._dragBackupPts;
            engine._dragBackupPts = null;
          }
          engine._markDirty();
          engine.render();
        } else {
          engine._dragLinkedBackupPts = null;
          if (ram) checkAccesorioTrigger(engine, ram.id);
        }
      }
    }
  }
}
