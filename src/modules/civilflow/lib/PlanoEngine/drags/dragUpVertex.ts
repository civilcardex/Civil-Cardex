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
import { verificaSRociadores, renumeraRociadores } from '../RCIAutoDraw.ts';

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
  /* ROCIADOR ARRastrado (ped. usuario 2026-11-13): un vértice interior con rociador rci se
   * PROYECTA al eje del ramal (queda sobre su polilínea) y se verifica la separación S —
   * hueco > S revierte el arrastre con los backups del move. */
  const idxV = ptIdx;
  const accV = ram?.accMed?.[`accMed${idxV}`];
  if (
    ram &&
    ram.net === 'rci' &&
    accV &&
    /rociador/i.test(accV) &&
    idxV > 0 &&
    idxV < ram.pts.length - 1 &&
    engine._dragBackupPts
  ) {
    // Proyectar al punto más cercano del propio ramal SIN el vértice (clamp al segmento).
    let mejor: number[] | null = null;
    let mejorD = Infinity;
    for (let i = 0; i < ram.pts.length - 1; i++) {
      if (i !== idxV - 1 && i !== idxV) continue;
      const ax = ram.pts[i][0];
      const ay = ram.pts[i][1];
      const bx = ram.pts[i + 1][0];
      const by = ram.pts[i + 1][1];
      const px = ram.pts[idxV][0];
      const py = ram.pts[idxV][1];
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const q = [ax + dx * t, ay + dy * t];
      const d = Math.hypot(px - q[0], py - q[1]);
      if (d < mejorD) {
        mejorD = d;
        mejor = q;
      }
    }
    if (mejor) ram.pts[idxV] = mejor;
    // S EXACTA (ped. usuario 2026-11-13): el hueco debe coincidir con S. Al mover a mano la
    // coincidencia exacta es improbable — SE ALERTA la desviación pero la posición (ya
    // proyectada al eje del ramal) se conserva: revertir haría imposible mover a mano.
    const errS = verificaSRociadores(engine, ram.id);
    if (errS) engine.triggerAlert('Separación de rociadores', errS);
    renumeraRociadores(engine);
    engine._dragBackupPts = null;
    engine._markDirty();
    engine.render();
    return;
  }
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
