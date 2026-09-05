import {
  NETS,
  allocNetNumber,
  allocTributaryNumber,
  rootTributarioLabel,
  uniqRamalId,
} from './PlanoState';
import type { PlanoRamal, PlanoBajante, IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';
import { isDeletedYeeDoblePart } from './deleteYeePreserve';
import { assignCodoAfterBranchDelete } from './deleteJunctionCleanup';
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

  // ¿Hay tapón de yee anclado en `pt`? En ese punto no se asigna un codo de plano
  // (el tapón marca el extremo abierto del caso yee — orig. usuario).
  const taponAt = (pt: number[]) =>
    engine.ramales.some((rr) => {
      if (!rr.pts || rr.pts.length < 2) return false;
      const at = (p: number[]) => Math.hypot(p[0] - pt[0], p[1] - pt[1]) < 0.5;
      return (
        (rr.accesorioInicio === 'tapon' && at(rr.pts[0])) ||
        (rr.accesorioFin === 'tapon' && at(rr.pts[rr.pts.length - 1])) ||
        (!!rr.accMed &&
          Object.entries(rr.accMed).some(([k, v]) => {
            const m = k.match(/^accMed(\d+)$/);
            const idx = m ? parseInt(m[1], 10) : -1;
            return v === 'tapon' && idx >= 0 && !!rr.pts[idx] && at(rr.pts[idx]);
          }))
      );
    });

  // El ramal del brazo de una yee doble se borra COMPLETO con cualquier clic del borrador:
  // recortarlo/partirlo solo lo desconectaba y el resto quedaba huérfano en el plano (orig.
  // usuario). deleteSelected lo quita individualmente (sin clúster) y preserveYeeDobleAt deja
  // el tapón/símbolo de la yee en el sobreviviente.
  if (isDeletedYeeDoblePart(engine, r)) {
    const isDivisorYee = engine.ramales.some((x) => x.mergesFrom && x.mergesFrom[1] === r.id);
    engine.deleteSelected(undefined, { noMerge: !isDivisorYee });
    engine._emitSelect(null);
    engine.selId = null;
    engine._emitStatus('Brazo de yee doble eliminado');
    engine.render();
    engine._markDirty();
    return;
  }

  // Segmento a segmento, SIN excepciones (orig. usuario): ramales/tributarios se recortan o
  // parten por el segmento clicado aunque sean mitades de una división (mergesFrom), vengan de
  // líneas guía o estén conectados a cualquier cosa. Solo un ramal de 1 segmento (2 puntos) se
  // elimina completo — el segmento ES el ramal — y con noMerge para no arrastrar al resto del
  // conjunto unido.
  const isEndpoint = bestIdx === 0 || bestIdx === r.pts.length - 1;
  const canTrim = r.pts.length > 2;
  // Segmento intermedio clickeado: partir el ramal en dos en ese segmento
  // (cada mitad conserva su parte; el segmento clicado queda eliminado).
  const isMidSegmentClick = bestSegIdx > 0 && bestSegIdx < r.pts.length - 2 && r.pts.length >= 4;
  if (isMidSegmentClick) {
    // Los dos puntos del segmento eliminado quedan como extremos abiertos (fin de la mitad
    // superior, inicio de la inferior): cada uno puede formar una esquina L nueva con un ramal
    // que termina ahí — mismo chequeo que el recorte de extremo.
    const cutA = r.pts[bestSegIdx];
    const cutB = r.pts[bestSegIdx + 1];
    splitRamalAtSegment(engine, r, bestSegIdx);
    if (!taponAt(cutA)) assignCodoAfterBranchDelete(engine, cutA);
    if (!taponAt(cutB)) assignCodoAfterBranchDelete(engine, cutB);
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
      // Copia ANTES del splice (r.pts.splice muta el mismo array).
      const oldPts = r.pts.slice();
      r.pts.splice(bestIdx, 1);
      r.totalL = calculateRamalLength(r.pts, engine);
      if (r.labelAngle == null) r.labelAngle = angleAtHalfLength(r.pts);
      const [mx, my] = _midpoint(r.pts);
      r.labelX = mx;
      r.labelY = my;
      // El recorte puede dejar una esquina en L (el vértice recortado era la unión con otro
      // ramal): asignar codo de plano como haría el borrado completo — salvo que el punto
      // quedó ocupado por el tapón del caso yee (orig. usuario).
      if (!taponAt(oldPts[bestIdx])) assignCodoAfterBranchDelete(engine, oldPts[bestIdx]);
      // El recorte también ABRE el extremo opuesto del segmento eliminado: si otro ramal termina
      // ahí, nace una esquina L nueva en ese punto (desarmar una yee doble deja la esquina
      // RS1|RS2 con su codo 45 — orig. usuario).
      const openEnd = bestIdx === 0 ? r.pts[0] : r.pts[r.pts.length - 1];
      if (!taponAt(openEnd)) assignCodoAfterBranchDelete(engine, openEnd);
      engine._emitSelect(null);
      engine.selId = null;
      engine._emitStatus('Segmento extremo recortado');
    } else {
      // Ramal de un solo segmento: el segmento ES el ramal — se elimina completo. noMerge
      // (borrado quirúrgico, sin re-unir) SOLO si el ramal no partió a otro: borrar el trazo
      // que dividió un ramal debe RE-UNIR las mitades (remerge) — con noMerge el ramal seguía
      // partido (orig. usuario: RS4|RS5). Los divisores no expanden clúster (splitMembersFor
      // devuelve []), así que noMerge:false solo habilita el re-merge.
      const isDivisor = engine.ramales.some((x) => x.mergesFrom && x.mergesFrom[1] === r.id);
      engine.deleteSelected(undefined, { noMerge: !isDivisor });
      engine._emitSelect(null);
      engine.selId = null;
      engine._emitStatus('Ramal eliminado');
    }
  }
  engine.render();
  engine._markDirty();
}
