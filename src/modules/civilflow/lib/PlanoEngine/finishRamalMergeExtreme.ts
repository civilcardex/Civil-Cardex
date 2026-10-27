// Continuación de ramal por LLEGADA a extremo (merge): si un ramal nuevo aterriza
// exactamente en el extremo de otro (misma red), extiende el existente en vez de crear
// uno separado — el quiebre queda como vértice interior y el codo 45/90 se dibuja solo.
// Contrato: true = merge consumido (el caller termina); false/excepción = crear normal.
import type { PlanoRamal, IPlanoEngineCore } from './PlanoState.ts';
import { allocTributaryNumber, relabelTribChain } from './PlanoState.ts';
import { devError } from '../../../../utils/devError.ts';
import { angleAtHalfLength, sameNetGroup } from './drawingAngles.ts';
import { _statusMsg, calculateRamalLength } from './ramalMeasure.ts';
import { checkRamalAnglesExcludingConnections } from './junctionAutoSplit.ts';
import {
  _midpoint,
  maxDiametroLabel,
  ramalDischargeEnd,
  ramalContinuesPast,
} from './drawingUtils.ts';
import { distToPolyline } from '../shared/geometry';

/**
 * Intenta el merge por extremo del ramal en curso. Mueve accesorios de extremo a accMed
 * con reindex, hereda diámetro solo de ALIMENTADORES (el máximo ciego ponía diámetro a
 * trazos que entregan) y revierte TODO si el ángulo no valida (caerá a creación normal).
 * @returns true si el merge consumió el trazo (el caller debe terminar); false para seguir.
 */
export function tryMergeExtensionPorExtremo(engine: IPlanoEngineCore): boolean {
  const incomingPts = engine.activeRamal!.pts;
  if (incomingPts.length >= 2 && !engine.activeRamal!.id) {
    const TOL = 0.5;
    const isBajanteCode = (v: string) => engine.bajantes.some((b) => (b.code || b.id) === v);
    // Un punto que coincide con la posición de un bajante NO es una continuación entre ramales:
    // dos ramales que terminan en el mismo bajante son laterales separados (Y doble), no un
    // ramal extendido. Si el extremo coincidente cae sobre un bajante, se omite el merge.
    const onBajantePos = (p: number[]) =>
      engine.bajantes.some((b) => Math.hypot(b.x - p[0], b.y - p[1]) < TOL);
    const nStart = incomingPts[0];
    const nEnd = incomingPts[incomingPts.length - 1];
    if (onBajantePos(nStart) || onBajantePos(nEnd)) {
      // no mergear — dejar crear el ramal separado que conecta al bajante
    } else {
      let target: PlanoRamal | null = null;
      let mode: 'nStart-eStart' | 'nStart-eEnd' | 'nEnd-eStart' | 'nEnd-eEnd' | null = null;
      // ¿El extremo `ep` de `ex` está LIBRE (no toca otro ramal)? Para tributarios solo se
      // mergea la extensión por la PUNTA LIBRE; si el punto coincide con el padre (la tee),
      // es un segundo tributario llegando al tronco → no mergear (formaría unión T).
      const isFreeTip = (ex: PlanoRamal, ep: number[]): boolean => {
        for (const o of engine.ramales) {
          if (o.id === ex.id || !o.pts || o.pts.length < 2) continue;
          if (!sameNetGroup(o.net, ex.net)) continue;
          if (o.pts.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL)) return false;
          for (let i = 0; i < o.pts.length - 1; i++) {
            const [ax, ay] = o.pts[i];
            const [bx, by] = o.pts[i + 1];
            const dx = bx - ax,
              dy = by - ay;
            const lenSq = dx * dx + dy * dy;
            if (lenSq < 0.0001) continue;
            const t = ((ep[0] - ax) * dx + (ep[1] - ay) * dy) / lenSq;
            if (t < 0.02 || t > 0.98) continue;
            if (Math.hypot(ep[0] - (ax + t * dx), ep[1] - (ay + t * dy)) < TOL) return false;
          }
        }
        return true;
      };
      for (const ex of engine.ramales) {
        if (ex.net !== engine.activeRamal!.net) continue;
        if (!ex.pts || ex.pts.length < 2) continue;
        // Ramales y tributarios se extienden por llegada a extremo (mismo tipo). La
        // extensión de un tributario mergea en el mismo (la punta libre se vuelve
        // vértice interior → el codo 45°/90° se dibuja solo); si el punto es la tee
        // con el padre, NO se mergea (sería un segundo tributario uniéndose al tronco).
        if (ex.tipo !== engine.activeRamal!.tipo) continue;
        const eStart = ex.pts[0];
        const eEnd = ex.pts[ex.pts.length - 1];
        const trib = ex.tipo === 'tributario';
        const ok = (exEp: number[], exRef: string | null | undefined) =>
          !(exRef && isBajanteCode(exRef)) && !(trib && !isFreeTip(ex, exEp));
        if (Math.hypot(nStart[0] - eStart[0], nStart[1] - eStart[1]) < TOL && ok(eStart, ex.ini)) {
          target = ex;
          mode = 'nStart-eStart';
          break;
        }
        if (Math.hypot(nStart[0] - eEnd[0], nStart[1] - eEnd[1]) < TOL && ok(eEnd, ex.fin)) {
          target = ex;
          mode = 'nStart-eEnd';
          break;
        }
        if (Math.hypot(nEnd[0] - eStart[0], nEnd[1] - eStart[1]) < TOL && ok(eStart, ex.ini)) {
          target = ex;
          mode = 'nEnd-eStart';
          break;
        }
        if (Math.hypot(nEnd[0] - eEnd[0], nEnd[1] - eEnd[1]) < TOL && ok(eEnd, ex.fin)) {
          target = ex;
          mode = 'nEnd-eEnd';
          break;
        }
      }
      if (target && mode) {
        // Snapshot del estado original de target para revertir TODO si el ángulo no valida
        const snap = {
          pts: target.pts,
          totalL: target.totalL,
          accMed: target.accMed,
          accesorioInicio: target.accesorioInicio,
          accesorioFin: target.accesorioFin,
          diametroInicio: target.diametroInicio,
          diametroFin: target.diametroFin,
          labelX: target.labelX,
          labelY: target.labelY,
          labelAngle: target.labelAngle,
        };
        // Modos "mismo-extremo" (nStart-eStart, nEnd-eEnd): ambos extremos del trazo
        // nuevo y del target coinciden en la unión (ambas colas o ambas cabezas). Para
        // que el flujo CONTINÚE el del target (no se voltee), se revierte el TRAZO
        // NUEVO (incoming), no el target — el target preserva pts/flujo/accesorios/
        // _tribReversed intactos. El modo efectivo pasa al "extremo opuesto".
        let effInc = incomingPts;
        let effMode: 'nStart-eEnd' | 'nEnd-eStart' = mode as 'nStart-eEnd' | 'nEnd-eStart';
        if (mode === 'nStart-eStart') {
          effInc = [...incomingPts].reverse();
          effMode = 'nEnd-eStart';
        } else if (mode === 'nEnd-eEnd') {
          effInc = [...incomingPts].reverse();
          effMode = 'nStart-eEnd';
        }
        let mergedPts: number[][] | null = null;
        if (effMode === 'nStart-eEnd') mergedPts = [...target.pts, ...effInc.slice(1)];
        else if (effMode === 'nEnd-eStart') mergedPts = [...effInc.slice(0, -1), ...target.pts];
        // Nota: el caso nStart-e* ya debería haber sido capturado como "continuar" en
        // handleLineDown al empezar, pero se deja como fallback por si llega aquí.
        if (mergedPts && mergedPts.length >= 2) {
          // mover accesorio del extremo de target que se vuelve interior a accMed
          const junctionIdx = effMode === 'nStart-eEnd' ? target.pts.length - 1 : effInc.length - 1;
          // Si el extremo de target que se interioriza tenía accesorio, pasarlo a accMed
          const accToMove =
            effMode === 'nStart-eEnd' ? target.accesorioFin : target.accesorioInicio;
          const diamToMove = effMode === 'nStart-eEnd' ? target.diametroFin : target.diametroInicio;
          // Guardar accMed original antes de modificar
          const origAccMed = { ...(target.accMed || {}) };
          let newAccMed: Record<string, string> = { ...origAccMed };
          if (accToMove) {
            // para nStart-eEnd el junction está al final de target (no requiere shift)
            // para nEnd-eStart el junction está al inicio de la porción target desplazada
            if (effMode === 'nStart-eEnd') {
              newAccMed[`accMed${junctionIdx}`] = accToMove;
              target.accesorioFin = '';
              target.diametroFin = '';
            } else {
              // nEnd-eStart: se añadirá después del shift en junctionIdx
              target.accesorioInicio = '';
              target.diametroInicio = '';
            }
            // ponytail (pre-existente, copiado fiel): el DIÁMETRO del extremo que se
            // interioriza se descarta con el accesorio movido — solo el glifo viaja a
            // accMed. Recuperarlo exige un campo _diamMed que hoy no existe.
            void diamToMove;
          }
          // Reindexar accMed cuando el merge antepone puntos (nEnd-eStart)
          if (effMode === 'nEnd-eStart') {
            const shift = effInc.length - 1;
            const shifted: Record<string, string> = {};
            for (const [k, v] of Object.entries(origAccMed)) {
              const m = k.match(/^accMed(\d+)$/);
              if (!m) {
                shifted[k] = v;
                continue;
              }
              const idx = parseInt(m[1], 10);
              shifted[`accMed${idx + shift}`] = v;
            }
            newAccMed = shifted;
            if (accToMove) newAccMed[`accMed${junctionIdx}`] = accToMove;
          }
          target.accMed = newAccMed;
          // Validar ángulos del trazado resultante (excluyendo conexiones)
          target.pts = mergedPts;
          target.totalL = calculateRamalLength(mergedPts, engine);
          const [labX, labY] = _midpoint(mergedPts);
          target.labelX = labX;
          target.labelY = labY;
          if (target.labelAngle == null) target.labelAngle = angleAtHalfLength(mergedPts);
          // Herencia de diámetro en la extensión: si el ramal extendido quedó sin diámetro,
          // adopta el MAYOR solo de sus ALIMENTADORES (ramales que descargan sobre la pieza
          // fusionada) — igual que la creación. El máximo ciego ponía diámetro a trazos que
          // entregan (el usuario pide vacío; "Diámetros pendientes" lo marcará hasta asignarlo).
          // Extensión de tributario: la cadena re-etiqueta con la raíz ACTUAL del padre
          // (los trib intermedios arrastraban la raíz vieja en la etiqueta, orig. usuario).
          if (target.tipo === 'tributario') {
            relabelTribChain(engine.ramales, target.id, (suffix) =>
              allocTributaryNumber(engine, suffix),
            );
          }
          if (!target.diametro) {
            let inherited = '';
            for (const o of engine.ramales) {
              if (o.id === target.id || o.net !== target.net) continue;
              if (!o.pts || o.pts.length < 2 || !o.diametro) continue;
              const d = ramalDischargeEnd(o);
              if (!d) continue;
              if (
                distToPolyline(d, mergedPts) < 2.0 &&
                ramalContinuesPast(
                  { net: target.net, pts: mergedPts, _tribReversed: target._tribReversed },
                  d,
                  2.0,
                )
              )
                inherited = maxDiametroLabel(inherited, o.diametro);
            }
            if (!inherited) {
              const defD = (engine._ramalDefaults || { diametro: '' }).diametro || '';
              if (defD) inherited = defD;
            }
            if (inherited) target.diametro = inherited;
          }
          // Ramal de canal extendido: sin validación de ángulo (orig. usuario).
          if (!target.esCanalId && !checkRamalAnglesExcludingConnections(engine, target)) {
            // revertir TODO el estado de target
            target.pts = snap.pts;
            target.totalL = snap.totalL;
            target.accMed = snap.accMed;
            target.accesorioInicio = snap.accesorioInicio;
            target.accesorioFin = snap.accesorioFin;
            target.diametroInicio = snap.diametroInicio;
            target.diametroFin = snap.diametroFin;
            target.labelX = snap.labelX;
            target.labelY = snap.labelY;
            target.labelAngle = snap.labelAngle;
            engine.triggerAlert(
              'Ángulo no recomendado',
              target.net === 'san' || target.net === 'll'
                ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 0° y 45°. Usar línea guía para ajustar ángulo.'
                : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
            );
            // no mergear, seguir con creación normal (caerá al flujo normal abajo)
          } else {
            engine.activeRamal = null;
            engine.selId = target.id;
            engine._emitSelect(target);
            engine._emitStatus(_statusMsg(engine));
            engine.render();
            engine._markDirty();
            return true;
          }
        }
      }
    }
  }
  return false;
}

/** Wrapper con el try/catch del caller original: cualquier excepción cae a creación normal. */
export function mergeExtensionPorExtremoConFallback(engine: IPlanoEngineCore): boolean {
  try {
    return tryMergeExtensionPorExtremo(engine);
  } catch (e) {
    devError('finishRamal merge-extremo:', e);
    return false;
  }
}
