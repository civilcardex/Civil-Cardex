import {
  NETS,
  allocNetNumber,
  allocTributaryNumber,
  rootTributarioLabel,
  uniqRamalId,
} from './PlanoState';
import type { PlanoRamal, PlanoBajante, IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';
import { _firstSegmentAngle, angleAtHalfLength } from './drawingAngles';
import { _statusMsg, calculateRamalLength } from './ramalMeasure';
import { _midpoint } from './drawingUtils';

/** Elimina el extremo del ramal más cercano al clic; los vértices intermedios no se pueden eliminar (solo con el borrador). */
export function deleteSegmentAt(engine: IPlanoEngineCore, cx: number, cy: number): void {
  const plane = engine.toPlane(cx, cy);
  const HIT_DIST = 10 / engine.zoom;
  let bestR: PlanoRamal | null = null,
    bestIdx = -1,
    bestD = Infinity;

  for (const r of engine.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length; i++) {
      const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
        bestR = r;
      }
    }
    if (bestD <= HIT_DIST) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const d = pointToSegmentDist(
        plane.x,
        plane.y,
        r.pts[i][0],
        r.pts[i][1],
        r.pts[i + 1][0],
        r.pts[i + 1][1],
      );
      if (d < bestD) {
        bestD = d;
        bestR = r;
        const dA = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
        const dB = Math.hypot(plane.x - r.pts[i + 1][0], plane.y - r.pts[i + 1][1]);
        bestIdx = dA <= dB ? i : i + 1;
      }
    }
  }
  if (!bestR || bestIdx < 0 || bestD > HIT_DIST) return;
  const r = bestR;
  if (bestIdx > 0 && bestIdx < r.pts.length - 1) {
    engine._emitStatus(
      '⚠ No se puede eliminar un segmento intermedio. Solo se pueden eliminar extremos.',
    );
    return;
  }
  if (r.pts.length <= 2) {
    engine.ramales = engine.ramales.filter((x) => x.id !== r.id && x.padre !== r.id);
    if (r.tipo !== 'tributario') engine._renumberRamales(r.net);
    engine.selId = null;
    engine._emitSelect(null);
  } else {
    r.pts.splice(bestIdx, 1);
    if (r.labelAngle == null) r.labelAngle = angleAtHalfLength(r.pts);
    r.totalL = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      r.totalL += engine.pxToM(
        Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]),
      );
    }
    r.totalL = +r.totalL.toFixed(3);
    const [mx, my] = _midpoint(r.pts);
    r.labelX = mx;
    r.labelY = my;
  }
  engine.render();
  engine._markDirty();
}

/** Maneja un clic con la herramienta de borrar activa: selecciona el elemento bajo el cursor y
 *  lo borra o recorta un segmento de extremo de ramal. @param engine Instancia del motor.
 *  @param cx Coordenada X de canvas. @param cy Coordenada Y de canvas. */
export function handleEraseDown(engine: IPlanoEngineCore, cx: number, cy: number): void {
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

/**
 * Aplica la regla de "recortar-o-borrar" del borrador a un ramal ya seleccionado, sin
 * volver a pasar por selectAt — la usa el manejador de teclado, que ya tiene la selección
 * y la posición del cursor, y no debe perderla. Misma lógica que el borrador con clic.
 */
/** Parte un ramal en dos eliminando el segmento `segIdx` (el clic del borrador): la parte
 *  inicial se queda en `r` y se crea un ramal nuevo con la parte final. Los accesorios del
 *  punto de corte se reubican al extremo del tramo que les corresponde. */
function splitRamalAtSegment(engine: IPlanoEngineCore, r: PlanoRamal, segIdx: number): void {
  const downstreamPts = r.pts.slice(segIdx + 1);
  if (downstreamPts.length < 2) return;
  const upPts = r.pts.slice(0, segIdx + 1);
  // Accesorio que estaba en el punto de corte (pts[segIdx]) pasa a ser el extremo final de la
  // mitad superior.
  const accAtCut =
    r.accMed?.[`accMed${segIdx}`] || (segIdx === r.pts.length - 1 ? r.accesorioFin : '');
  // Redistribuir accMed: los índices <= segIdx quedan en la mitad superior; los > segIdx van a
  // la mitad inferior desplazados.
  const upAccMed: Record<string, string> = {};
  const downAccMed: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.accMed || {})) {
    const m = k.match(/^accMed(\d+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    if (idx < segIdx) upAccMed[`accMed${idx}`] = v;
    else if (idx > segIdx + 1) downAccMed[`accMed${idx - (segIdx + 1)}`] = v;
  }
  const upLast = upPts.length - 1;
  if (accAtCut) upAccMed[`accMed${upLast}`] = accAtCut;
  // El accesorioInicio del downstream (antiguo accMed en pts[segIdx+1], si existía).
  const downStartAcc = r.accMed?.[`accMed${segIdx + 1}`] || '';

  const netDef = NETS.find((n) => n.id === r.net);
  const pfx = netDef ? netDef.lbl : 'R';
  const isTrib = r.tipo === 'tributario';
  const rootLabel = isTrib ? rootTributarioLabel(engine.ramales, r.id) : '';
  const cnt = isTrib
    ? allocTributaryNumber(engine, rootLabel)
    : allocNetNumber(engine, r.net, 'ramal', (n) =>
        engine.ramales.some((x) => x.id === `${pfx}${n}` || x.label === `${pfx}${n}`),
      );
  const newId = isTrib ? uniqRamalId() : pfx + cnt;
  const [downLabelX, downLabelY] = _midpoint(downstreamPts);
  const downLabelAngle = angleAtHalfLength(downstreamPts);
  const downstream: PlanoRamal = {
    ...r,
    id: newId,
    pts: downstreamPts,
    totalL: calculateRamalLength(downstreamPts, engine),
    label: isTrib ? `T${cnt}${rootLabel}` : `${pfx}${cnt}`,
    labelX: downLabelX,
    labelY: downLabelY,
    labelAngle: downLabelAngle,
    accMed: downAccMed,
    accesorioInicio: downStartAcc || '',
    diametroInicio: '',
    mergesFrom: undefined,
  };

  // Truncar la mitad superior.
  const upLen = calculateRamalLength(upPts, engine);
  r.pts = upPts;
  r.totalL = upLen;
  r.accMed = upAccMed;
  if (accAtCut) {
    r.accesorioFin = accAtCut;
    delete r.accMed[`accMed${upLast}`];
  } else {
    r.accesorioFin = '';
  }
  r.labelX = _midpoint(upPts)[0];
  r.labelY = _midpoint(upPts)[1];
  if (r.labelAngle == null) r.labelAngle = angleAtHalfLength(upPts);

  engine.ramales.push(downstream);
}

/** Borrador sobre un ramal ya seleccionado: recorta desde el segmento clicado, o borra el ramal completo si tiene un solo segmento. */
export function eraseRamalAt(
  engine: IPlanoEngineCore,
  r: PlanoRamal,
  cx: number,
  cy: number,
): void {
  const plane = engine.toPlane(cx, cy);
  const HIT_DIST = 10 / engine.zoom;

  let bestIdx = -1,
    bestSegIdx = -1,
    bestD = Infinity;
  for (let i = 0; i < r.pts.length; i++) {
    const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
      bestSegIdx = -1;
    }
  }
  if (bestD > HIT_DIST) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const d = pointToSegmentDist(
        plane.x,
        plane.y,
        r.pts[i][0],
        r.pts[i][1],
        r.pts[i + 1][0],
        r.pts[i + 1][1],
      );
      if (d < bestD) {
        bestD = d;
        bestSegIdx = i;
        const dA = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
        const dB = Math.hypot(plane.x - r.pts[i + 1][0], plane.y - r.pts[i + 1][1]);
        bestIdx = dA <= dB ? i : i + 1;
      }
    }
  }

  // Si tiene más de 2 puntos y se hizo clic en un segmento extremo, recorta el extremo. UN
  // RAMAL MIEMBRO DE UNA DIVISIÓN (mergesFrom propio, pareja upstream de otra división, o la
  // RAMA ENTRANTE que la causó) NO se recorta: borrar un miembro debe borrar la división
  // completa (deleteSelected expande splitMembersFor) o re-unir las mitades (rama entrante) —
  // recortar un punto solo quita "un segmento a la vez" y el usuario tiene que borrar 2 veces.
  const isSplitMember =
    !!r.mergesFrom ||
    engine.ramales.some(
      (m) => m.mergesFrom && (m.mergesFrom[0] === r.id || m.mergesFrom[1] === r.id),
    );
  // ponytail: straight polyline (all points collinear) should delete whole, not trim one side — division point is not a real bend
  const isStraight = (() => {
    if (r.pts.length <= 2) return true;
    const baseDx = r.pts[1][0] - r.pts[0][0];
    const baseDy = r.pts[1][1] - r.pts[0][1];
    const baseLen = Math.hypot(baseDx, baseDy);
    if (baseLen < 1e-6) return false;
    for (let i = 2; i < r.pts.length; i++) {
      const dx = r.pts[i][0] - r.pts[i - 1][0];
      const dy = r.pts[i][1] - r.pts[i - 1][1];
      const cross = baseDx * dy - baseDy * dx;
      const dot = baseDx * dx + baseDy * dy;
      if (Math.abs(cross) > 1e-6 || dot < 0) return false;
    }
    return true;
  })();
  const isEndpoint = bestIdx === 0 || bestIdx === r.pts.length - 1;
  const canTrim = r.pts.length > 2 && !isSplitMember && !isStraight;
  // Segmento intermedio clickeado: partir el ramal en dos en ese segmento
  // (cada mitad conserva su parte; el segmento clickeado queda eliminado).
  const isMidSegmentClick =
    bestSegIdx > 0 && bestSegIdx < r.pts.length - 2 && r.pts.length >= 4 && !isSplitMember;
  if (isMidSegmentClick) {
    splitRamalAtSegment(engine, r, bestSegIdx);
    engine._emitSelect(null);
    engine.selId = null;
    engine._emitStatus('Segmento eliminado — ramal dividido');
  } else {
    if (!isEndpoint && canTrim) {
      const d0 = Math.hypot(plane.x - r.pts[0][0], plane.y - r.pts[0][1]);
      const dLast = Math.hypot(
        plane.x - r.pts[r.pts.length - 1][0],
        plane.y - r.pts[r.pts.length - 1][1],
      );
      bestIdx = d0 <= dLast ? 0 : r.pts.length - 1;
    }
    if (canTrim && (bestIdx === 0 || bestIdx === r.pts.length - 1)) {
      r.pts.splice(bestIdx, 1);
      r.totalL = calculateRamalLength(r.pts, engine);
      if (r.labelAngle == null) r.labelAngle = angleAtHalfLength(r.pts);
      const [mx, my] = _midpoint(r.pts);
      r.labelX = mx;
      r.labelY = my;
      engine._emitSelect(null);
      engine.selId = null;
      engine._emitStatus('Segmento extremo recortado');
    } else {
      // Si es el único segmento (2 puntos) o miembro de división, borra completo
      engine.deleteSelected();
      engine._emitSelect(null);
      engine.selId = null;
      engine._emitStatus('Ramal eliminado');
    }
  }
  engine.render();
  engine._markDirty();
}
