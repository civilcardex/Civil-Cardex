import {
  NETS,
  allocNetNumber,
  allocTributaryNumber,
  rootTributarioLabel,
  uniqRamalId,
} from './PlanoState';
import type { PlanoRamal, IPlanoEngineCore } from './PlanoState';
import { devError } from '../../../../utils/devError';
import { _firstSegmentAngle, angleAtHalfLength, detectAccesorioTrigger } from './drawingAngles';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { DEFAULT_PENDIENTE_PCT } from '../../constants';
import {
  isRamalBajanteConnectionAllowed,
  junctionHasIncomingFlow,
  junctionHasOutgoingFlow,
} from '../../utils/flowDirection';
import { flipRamalFlow, ramalFlowDirectionCheck } from './drawingFlow';
import { _statusMsg, calculateRamalLength } from './ramalMeasure';
import {
  autoSplitJunctionAndSumFlow,
  detectTributaryPadre,
  checkRamalAnglesExcludingConnections,
} from './junctionAutoSplit';
import { _nextLabel, _midpoint } from './drawingUtils';

/** Termina el ramal activo: valida ángulos, crea el PlanoRamal, auto-divide uniones y asocia
 *  con bajantes. @param engine Instancia del motor. */
export function finishRamal(engine: IPlanoEngineCore): void {
  engine._yeeFlashKey = null;
  if (!engine.activeRamal || engine.activeRamal.pts.length < 1) return;
  if (engine.activeRamal.pts.length < 2) {
    engine.activeRamal = null;
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  if (engine.activeRamal.id) {
    const existing = engine.ramales.find((r) => r.id === engine.activeRamal!.id);
    if (existing) {
      const origPts = existing.pts;
      existing.pts = engine.activeRamal.pts;
      existing.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
      // Ítem 2/5: la edición de un ramal existente también puede crear (o romper) uniones — se
      // valida la dirección de flujo ANTES de autoSplit; si la nueva geometría conecta contra la
      // dirección del ramal principal (o un vent llega a una unión reventilado), se restaura la
      // geometría anterior y se aborta, en vez de dejar el ramal editado con una unión inválida.
      if (existing.net === 'san' || existing.net === 'll' || existing.net === 'vent') {
        const flowErr = ramalFlowDirectionCheck(engine, existing, [], 0.5);
        if (flowErr) {
          engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
          existing.pts = origPts;
          existing.totalL = calculateRamalLength(origPts, engine);
          engine.activeRamal = null;
          engine._markDirty();
          engine.render();
          return;
        }
      }
      autoSplitJunctionAndSumFlow(engine, existing);
      engine.activeRamal = null;
      engine.selId = existing.id;
      engine._emitSelect(existing);
      engine._emitStatus(_statusMsg(engine));
      engine.render();
      engine._markDirty();
      return;
    }
  }

  // Continuación por LLEGADA a extremo: si un ramal nuevo aterriza exactamente en el
  // extremo de otro ramal existente (misma red), extender ese ramal existente en vez de
  // crear uno nuevo separado. Esto hace que el quiebre quede como vértice interior del
  // mismo pts[] y el símbolo de codo 45/90 se dibuje automático (drawRamalPath).
  // try/catch: si el merge lanza por cualquier razón, se cae a la creación normal del ramal.
  try {
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
            const linked =
              o.net === ex.net ||
              ((o.net === 'san' || o.net === 'vent') && (ex.net === 'san' || ex.net === 'vent'));
            if (!linked) continue;
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
          if (
            Math.hypot(nStart[0] - eStart[0], nStart[1] - eStart[1]) < TOL &&
            ok(eStart, ex.ini)
          ) {
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
            const junctionIdx =
              effMode === 'nStart-eEnd' ? target.pts.length - 1 : effInc.length - 1;
            // Si el extremo de target que se interioriza tenía accesorio, pasarlo a accMed
            const accToMove =
              effMode === 'nStart-eEnd' ? target.accesorioFin : target.accesorioInicio;
            const diamToMove =
              effMode === 'nStart-eEnd' ? target.diametroFin : target.diametroInicio;
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
            if (!checkRamalAnglesExcludingConnections(engine, target)) {
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
              return;
            }
          }
        }
      }
    }
  } catch (e) {
    devError('finishRamal merge-extremo:', e);
    // merge falló — continuar con la creación normal del ramal abajo
  }
  if (!engine.activeRamal) return;

  const def = engine._ramalDefaults || { material: '', diametro: '', pendiente: 0 };
  const net = NETS.find((n) => n.id === engine.activeRamal!.net);
  const netPfx = net ? net.lbl : 'R';
  const isTrib = engine.tipoTramo === 'tributario';
  // Autodetección de padre prioriza geometría: evita stale RS1 cuando barra quedó en RS1
  const autoPadre = isTrib
    ? detectTributaryPadre(engine, engine.activeRamal!.pts, engine.activeRamal!.net)
    : null;
  const padreId = isTrib ? autoPadre || engine.padreTributario : null;
  const padreObj = padreId ? engine.ramales.find((r) => r.id === padreId) : null;
  const padreLbl = padreId
    ? padreObj?.tipo === 'tributario'
      ? rootTributarioLabel(engine.ramales, padreId)
      : padreObj?.label || padreId
    : '';
  const cnt = isTrib
    ? allocTributaryNumber(engine, padreLbl)
    : allocNetNumber(engine, engine.activeRamal!.net, 'ramal', (n) =>
        engine.ramales.some((r) => r.id === `${netPfx}${n}` || r.label === `${netPfx}${n}`),
      );
  const id = isTrib ? uniqRamalId() : netPfx + cnt;
  const firstAngle = angleAtHalfLength(engine.activeRamal.pts);

  const [midX, midY] = _midpoint(engine.activeRamal.pts);
  const labelX = midX;
  const labelY = midY;

  const r: PlanoRamal = {
    id,
    net: engine.activeRamal!.net,
    tipo: engine.activeRamal!.tipo,
    padre: padreId,
    pts: engine.activeRamal!.pts,
    totalL: calculateRamalLength(engine.activeRamal!.pts, engine),
    label: isTrib && padreId ? `T${cnt}${padreLbl}` : _nextLabel(engine),
    ini: '',
    fin: '',
    piso: String(engine.nivelActual?.n ?? ''),
    dz: '',
    uc: 0,
    nSalidas: 1,
    labelX: labelX,
    labelY: labelY,
    labelAngle: firstAngle,
    material: def.material || '',
    // Item 3: todo ramal de ventilación nuevo nace con diámetro 2" por defecto
    // (no solo visual del desplegable — el valor almacenado). Si _ramalDefaults
    // trae un diámetro, se respeta; el 2" es el fallback cuando no hay default.
    // Fix issue #3: tributario nunca hereda 4" por defecto — solo inodoro requiere 4"
    // (ramalMenu/FixturesPanel lo asignan explícitamente al elegir aparato). Tributario
    // nace vacío (vent: 2" fallback) para no forzar 4" sin aparato.
    diametro: isTrib
      ? engine.activeRamal!.net === 'vent' && !def.diametro
        ? '2"'
        : ''
      : engine.activeRamal!.net === 'vent' && !def.diametro
        ? '2"'
        : def.diametro || '',
    // Ítem 4: los ramales sanitarios nuevos nacen con pendiente por defecto 2% cuando no se
    // eligió explícitamente otra. El default del selector para san ya trae DEFAULT_PENDIENTE_PCT
    // desde PdfViewer; este fallback cubre el caso de _ramalDefaults ausente o pendiente sin
    // valor (0/null). Otras redes conservan su default.
    pendiente:
      engine.activeRamal!.net === 'san' &&
      (typeof def.pendiente !== 'number' || def.pendiente === 0)
        ? DEFAULT_PENDIENTE_PCT
        : typeof def.pendiente === 'number'
          ? def.pendiente
          : 0,
    bloqueado: true,
    showLength: true,
    showName: true,
    showGuide: true,
    showFlowDir: true,
    showMatDiamPend: true,
  };

  // Validación de dirección de flujo (san/vent/ll): todo ramal que se conecta a otro debe llevar
  // la dirección de flujo del ramal principal — p.ej. si el ramal principal fluye a la derecha,
  // el ramal que se conecta también debe fluir a la derecha (dot(flujoEntrante, flujoPrincipal) >
  // 0). Si el usuario lo dibujó contra la dirección del principal, se bloquea la creación con
  // una alerta en vez de crear en silencio una unión contraflujo. Solo aplica a uniones del
  // mismo grupo de red (san↔vent comparten la subred). El chequeo usa el helper compartido con
  // vectores LOCALES por extremo/ramal tocado (ítem 2, antes usaba el vector global del ramal,
  // que se equivocaba en ramales doblados) e incluye la regla del codo reventilado vent↔san
  // (ítem 5: el vent debe fluir alejándose de la unión).
  const pointOnSegment = (p: number[], a: number[], b: number[], tol: number): boolean => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return Math.hypot(p[0] - a[0], p[1] - a[1]) < tol;
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    if (t < 0.02 || t > 0.98) return false;
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    return Math.hypot(p[0] - px, p[1] - py) < tol;
  };
  if (r.net === 'san' || r.net === 'll' || r.net === 'vent') {
    const TOL = 0.5;
    // Item 10: un tributario san/ll/vent se crea apuntando hacia la unión — si el extremo que
    // toca otro ramal quedó en pts[0], se voltea para que la flecha quede mirando a la unión.
    const touchesRamal = (ep: number[]): boolean => {
      for (const other of engine.ramales) {
        if (other.id === r.id || !other.pts || other.pts.length < 2) continue;
        const sameGroup =
          other.net === r.net ||
          ((other.net === 'san' || other.net === 'vent') && (r.net === 'san' || r.net === 'vent'));
        if (!sameGroup) continue;
        const oEps = [other.pts[0], other.pts[other.pts.length - 1]];
        if (oEps.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL)) return true;
        for (let i = 0; i < other.pts.length - 1; i++) {
          if (pointOnSegment(ep, other.pts[i], other.pts[i + 1], TOL)) return true;
        }
      }
      return false;
    };
    // ¿El punto cae sobre el CUERPO (interior de un segmento, no extremo) de otro ramal?
    const onBody = (p: number[]): boolean => {
      for (const other of engine.ramales) {
        if (!other.pts || other.pts.length < 2 || other.id === r.id) continue;
        if (other.net !== r.net) continue;
        for (let i = 0; i < other.pts.length - 1; i++) {
          const [ax, ay] = other.pts[i];
          const [bx, by] = other.pts[i + 1];
          const dx = bx - ax,
            dy = by - ay;
          const lenSq = dx * dx + dy * dy;
          if (lenSq < 0.0001) continue;
          const t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / lenSq;
          if (t < 0.03 || t > 0.97) continue;
          const px = ax + t * dx,
            py = ay + t * dy;
          if (Math.hypot(p[0] - px, p[1] - py) < 0.6) return true;
        }
      }
      return false;
    };
    if (r.tipo === 'tributario' || r.pts.length >= 2) {
      const t0 = touchesRamal(r.pts[0]);
      const t1 = touchesRamal(r.pts[r.pts.length - 1]);
      // Un ramal/tributario que ATERRIZA en el CUERPO de otro ramal (split por cuerpo):
      // san/ll/vent debe fluir HACIA la unión (free→body), af/ac/gas DESDE la unión.
      // Para san, si el inicio toca cuerpo y el fin es libre, invertir para que fluya hacia el cuerpo.
      if (r.net === 'san' || r.net === 'll' || r.net === 'vent') {
        if (t0 && !t1 && onBody(r.pts[0])) {
          flipRamalFlow(r);
        }
      } else if (t1 && !t0 && onBody(r.pts[r.pts.length - 1])) {
        flipRamalFlow(r);
      }
      // Tributario: además de lo anterior, si empieza tocando un ramal y termina libre, fluye
      // desde la unión (comportamiento original).
      if (r.tipo === 'tributario' && t0 && !t1) {
        flipRamalFlow(r);
      }
    }
    // Ítem 2/5: chequeo pre-push con el helper compartido (r aún no está en engine.ramales, se
    // pasa como extra). Aborto limpio: sin push, activeRamal = null + alerta.
    // Solo tributarios se auto-orientan al aterrizar en cuerpo — ramales deben validar flujo
    const landsOnBody =
      (r.pts.length >= 2 && onBody(r.pts[r.pts.length - 1])) ||
      (r.pts.length >= 2 && onBody(r.pts[0]));
    const skipFlowForBody = landsOnBody && r.tipo === 'tributario';
    const flowErr = skipFlowForBody ? null : ramalFlowDirectionCheck(engine, r, [r], TOL);
    if (flowErr) {
      engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
      engine.activeRamal = null;
      engine._markDirty();
      engine.render();
      return;
    }
  } else if (r.net === 'af' || r.net === 'ac' || r.net === 'gas') {
    const TOL = 0.5;
    // r todavía no está en engine.ramales, así que se incluye explícitamente junto al array vivo.
    const candidates = [r, ...engine.ramales];
    for (const ep of [r.pts[0], r.pts[r.pts.length - 1]]) {
      if (!junctionHasOutgoingFlow(candidates, r.net, ep, TOL)) {
        engine.triggerAlert(
          'Conexión sin salida',
          'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo saliendo de ella.',
        );
        engine.activeRamal = null;
        engine._markDirty();
        engine.render();
        return;
      }
    }
    for (const ep of [r.pts[0], r.pts[r.pts.length - 1]]) {
      if (!junctionHasIncomingFlow(candidates, r.net, ep, TOL)) {
        engine.triggerAlert(
          'Conexión sin entrada',
          'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo entrando a ella.',
        );
        engine.activeRamal = null;
        engine._markDirty();
        engine.render();
        return;
      }
    }
  }

  engine.ramales.push(r);
  // Bug #7: el segmento de CONEXIÓN (extremo que pega a otro ramal existente o a un bajante)
  // tiene el ángulo dictado por la geometría del ramal existente, no por la cuadrícula — no se
  // valida. Validar solo los segmentos libres (los que no tocan nada).
  if (!checkRamalAnglesExcludingConnections(engine, r)) {
    engine.triggerAlert(
      'Ángulo no recomendado',
      r.net === 'san' || r.net === 'll'
        ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 0° y 45°. Usar línea guía para ajustar ángulo.'
        : (r.net === 'af' || r.net === 'ac') && r.tipo === 'tributario'
          ? 'Los tributarios de AF/AC solo permiten ángulos de 90°. Usar línea guía para ajustar ángulo.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
    );
    engine.ramales.pop();
    engine.activeRamal = null;
    engine._markDirty();
    engine.render();
    return;
  }
  autoSplitJunctionAndSumFlow(engine, r);
  // Asocia el ramal con un bajante si su extremo cae en el centro del bajante. Un ramal solo
  // puede LLEGAR a un bajante (real o fantasma) — nunca EMPEZAR ahí — por pedido explícito;
  // handleLineDown ya bloquea el clic mismo de empezar un ramal fresco ahí, esto es el cinturón
  // y tirantes sobre los extremos del ramal TERMINADO (también cubre conexiones creadas por
  // arrastre). Un fantasma desplazado se empareja contra su propia posición desplazada del piso
  // actual; un fantasma sin desplazar o un bajante real emparejan en su (b.x, b.y) simple.
  if (r.pts.length >= 2) {
    const TOLLERANCE = 0.5;
    const lastIdx = r.pts.length - 1;
    const lvl = engine.nivelActual?.label ?? '';
    const displacedFantasmaIds = new Set(
      engine
        .getBajantesFantasma()
        .filter((b) => {
          const disp = b.desplazamientos?.[lvl];
          return !!disp && (Math.abs(disp.dx) > 0.5 || Math.abs(disp.dy) > 0.5);
        })
        .map((b) => b.id),
    );
    for (const epIdx of [0, lastIdx]) {
      const isArrival = epIdx === lastIdx;
      if (!isArrival) continue;
      const ep = r.pts[epIdx];
      const baj = engine.bajantes.find((b) => {
        if (b.net !== r.net || engine._hiddenNets.has(b.net)) return false;
        // El extremo en snapMode puede aterrizar en el BORDE del círculo del bajante (proyección
        // de ángulo válido), no en el centro — la tolerancia de asociación cubre el radio del
        // símbolo para que el ramal quede igualmente conectado.
        const rimTol = (b._circ?.r || 8 * engine.zoom) / (engine.zoom || 1) + TOLLERANCE;
        if (displacedFantasmaIds.has(b.id)) {
          const disp = b.desplazamientos?.[lvl];
          const bx = b.x + (disp?.dx || 0);
          const by = b.y + (disp?.dy || 0);
          return Math.hypot(bx - ep[0], by - ep[1]) < rimTol;
        }
        return Math.hypot(b.x - ep[0], b.y - ep[1]) < rimTol;
      });
      if (baj && !baj.recibeDeIds.includes(r.id)) {
        // Límite: hasta 2 ramales por bajante (orig. #14)
        if (baj.recibeDeIds.length >= 2) {
          engine.triggerAlert(
            'Bajante completo',
            'Este bajante ya tiene 2 ramales conectados (máximo permitido).',
          );
          continue;
        }
        // 14.2 Y doble: laterales must be same diam
        if (baj.recibeDeIds.length === 1) {
          const existing = engine.ramales.find((x) => x.id === baj.recibeDeIds[0]);
          if (existing && existing.diametro && r.diametro) {
            const p1 = diamPulgFromLabel(existing.diametro);
            const p2 = diamPulgFromLabel(r.diametro);
            if (p1 > 0 && p2 > 0 && Math.abs(p1 - p2) > 0.01) {
              engine.triggerAlert(
                'Diámetros no compatibles',
                'Los dos ramales que llegan a un mismo bajante (Y doble) deben tener el mismo diámetro en sus brazos laterales.',
              );
              continue;
            }
          }
        }
        // Guardia centralizada de dirección — un bajante 'baja' solo puede RECIBIR flujo, así
        // que nunca se permite que el INICIO de un ramal (pts[0]) se asocie con uno. Sin esto,
        // un ramal cuyo inicio dibujado por el usuario cae sobre un bajante 'baja' tomaría esa
        // asociación en silencio, creando exactamente el estado del reporte de bug (RS5-P1
        // saliendo de BAN4-P1 con dirección "Baja").
        const epIdxTyped = epIdx === 0 ? 0 : r.pts.length - 1;
        if (!isRamalBajanteConnectionAllowed(engine, r, epIdxTyped, baj)) continue;
        if (!baj.recibeDeIds.includes(r.id)) baj.recibeDeIds.push(r.id);
        // Auto-rellenar ini/fin del ramal
        const bajCode = baj.code || baj.id;
        if (epIdx === 0) {
          r.ini = bajCode;
        } else {
          r.fin = bajCode;
        }
      }
    }
  }
  // Correr _markDirty ANTES de revisar el modal para que autoDetectRamalConnections tenga
  // oportunidad de detectar cualquier unión nueva que el usuario acaba de crear al terminar
  // el ramal.
  engine.activeRamal = null;
  engine.selId = r.id;
  engine._emitSelect(r);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();

  // AF/AC/gas: detectar codos/tees en cambios de ángulo, cruces perpendiculares y uniones
  // formadas con otro ramal dibujado por separado — compartido con handleDragUp para que un
  // arrastre pueda disparar el mismo modal cuando crea una de estas uniones. Las uniones de
  // san/ll/vent se auto-crean vía calcSanitaryAccessories + renderJunctions — sin modal.
  if ((r.net === 'af' || r.net === 'ac' || r.net === 'gas') && engine.triggerAccesorioModal) {
    const trigger = detectAccesorioTrigger(engine, r.id);
    if (trigger) engine.triggerAccesorioModal(trigger);
  }
}

/** ¿El ángulo de cruce entre el ramal nuevo y los existentes es válido para la red? Bloquea con alerta los cruces no recomendados (san/ll solo 45°, af/ac sin uniones de 45°). */
export function checkCrossRamalAngle(
  engine: IPlanoEngineCore,
  pA: number[],
  pB: number[],
  skipId: string,
): boolean {
  for (const r of engine.ramales) {
    if (r.id === skipId || !r.pts || r.pts.length < 2) continue;
    const netId = r.net || engine.activeNet;
    const isSanOrLl = netId === 'san' || netId === 'll';
    const isAfAc = netId === 'af' || netId === 'ac';
    for (let si = 0; si < r.pts.length - 1; si++) {
      const [ax, ay] = r.pts[si],
        [bx, by] = r.pts[si + 1];
      const segLen = Math.hypot(bx - ax, by - ay);
      if (segLen < 0.1) continue;
      const t = ((pB[0] - ax) * (bx - ax) + (pB[1] - ay) * (by - ay)) / (segLen * segLen);
      if (t >= 0 && t <= 1) {
        const projDist = Math.abs((bx - ax) * (ay - pB[1]) - (by - ay) * (ax - pB[0])) / segLen;
        if (projDist < 0.5) {
          const a1 = (Math.atan2(pB[1] - pA[1], pB[0] - pA[0]) * 180) / Math.PI;
          const a2 = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
          let diff = Math.abs(a2 - a1) % 360;
          if (diff > 180) diff = 360 - diff;
          const internalAngle = 180 - diff;
          let isAllowed = false;
          if (isSanOrLl) {
            isAllowed =
              diff <= 46 || diff >= 134 || Math.abs(diff - 45) <= 10 || Math.abs(diff - 135) <= 10;
          } else if (isAfAc) {
            // AF/AC solo forma una tee (90°) en una unión — nada de fusiones estilo yee de 45°,
            // por pedido explícito. Misma tolerancia que usa la detección isTee de
            // renderJunctions.ts.
            isAllowed = Math.abs(internalAngle - 90) <= 15;
          } else {
            isAllowed = internalAngle >= 50;
          }
          if (!isAllowed) {
            engine.triggerAlert(
              'Ángulo no recomendado',
              isSanOrLl
                ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
                : isAfAc
                  ? 'Las redes de agua caliente o agua fria no permiten uniones de 45° entre trazos. Usar línea guía para ajustar ángulo.'
                  : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
            );
            return false;
          }
        }
      }
    }
  }
  return true;
}
