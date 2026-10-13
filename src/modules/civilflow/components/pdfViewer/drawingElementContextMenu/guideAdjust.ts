import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoGuideLine, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import {
  checkRamalAngles,
  detectAccesorioTrigger,
  _firstSegmentAngle,
} from '../../../lib/PlanoEngine/drawingAngles';
import {
  autoSplitJunctionAndSumFlow,
  flowVecAt,
  ramalFlowDirectionCheck,
} from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import { allocTributaryNumber, rootTributarioLabel } from '../../../lib/PlanoEngine/PlanoState';
import { distToPolyline } from '../../../lib/shared/geometry';
import { snapGuideCrossingToEndpoint } from '../../../lib/PlanoEngine/guideLines';
import { calculateRamalLength } from '../../../lib/PlanoEngine/ramalMeasure';
import { asociarRamalABajantes } from '../../../lib/PlanoEngine/drawingUtils';
import {
  findGuideCrossing,
  getPadreHostAngle,
  guideAngleAlertMessage,
  isGuideRelativeAngleValid,
  netAllowedSteps,
  snapGuideArrivalToHost,
} from './guideGeometry';

export function autoAdjustGuide(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
  setSelElement: (el: PlanoElement | null) => void,
  selElement: PlanoElement | null,
): void {
  const live = eng.guideLines.find((g) => g.id === guide.id) || guide;
  if (!live.pts || live.pts.length < 2) return;
  const crossing = findGuideCrossing(eng, live);
  if (!crossing) {
    eng.triggerAlert(
      'Sin cruce con ramal',
      'La línea guía no cruza ningún ramal: dibújala hasta el trazo al que quiere conectar antes de ajustar el ángulo.',
    );
    return;
  }
  const host = eng.ramales.find((r) => r.id === crossing.ramalId);
  if (!host || !host.pts || host.pts.length < 2) return;
  const step = netAllowedSteps(host.net)[0] ?? 45;
  const C = crossing.point;
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < live.pts.length - 1; i++) {
    const p = live.pts[i];
    const q = live.pts[i + 1];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) continue;
    const t = Math.max(0, Math.min(1, ((C[0] - p[0]) * dx + (C[1] - p[1]) * dy) / lenSq));
    const d = Math.hypot(C[0] - (p[0] + t * dx), C[1] - (p[1] + t * dy));
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  const s0 = live.pts[bestI];
  const s1 = live.pts[bestI + 1];
  const segLen = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) || 1;
  const d1x = (s1[0] - s0[0]) / segLen;
  const d1y = (s1[1] - s0[1]) / segLen;
  const dot0 = (s0[0] - C[0]) * d1x + (s0[1] - C[1]) * d1y;
  const dot1 = (s1[0] - C[0]) * d1x + (s1[1] - C[1]) * d1y;
  const dist0 = Math.hypot(s0[0] - C[0], s0[1] - C[1]);
  const dist1 = Math.hypot(s1[0] - C[0], s1[1] - C[1]);
  const a: [number, number] =
    dot1 > 0 && dot0 <= 0
      ? [s0[0], s0[1]]
      : dot0 > 0 && dot1 <= 0
        ? [s1[0], s1[1]]
        : dist0 <= dist1
          ? [s0[0], s0[1]]
          : [s1[0], s1[1]];
  const hAng = crossing.angle;
  const cands: Array<{ ux: number; uy: number; turn: number }> = [];
  for (const sgn of [1, -1] as const) {
    const base = hAng + (sgn * step * Math.PI) / 180;
    for (const flip of [0, Math.PI] as const) {
      const ux = Math.cos(base + flip);
      const uy = Math.sin(base + flip);
      if (ux * (C[0] - a[0]) + uy * (C[1] - a[1]) <= 0) continue;
      const dot = Math.max(-1, Math.min(1, d1x * ux + d1y * uy));
      cands.push({ ux, uy, turn: (Math.acos(dot) * 180) / Math.PI });
    }
  }
  cands.sort((x, y) => x.turn - y.turn);
  if (cands.length === 0) return;
  let hit: [number, number] | null = null;
  for (const cand of cands) {
    let hitT = Infinity;
    let candHit: [number, number] | null = null;
    for (let i = 0; i < host.pts.length - 1; i++) {
      const q0 = host.pts[i];
      const q1 = host.pts[i + 1];
      const ex = q1[0] - q0[0];
      const ey = q1[1] - q0[1];
      const den = cand.ux * ey - cand.uy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const tt = ((q0[0] - a[0]) * ey - (q0[1] - a[1]) * ex) / den;
      const s = ((q0[0] - a[0]) * cand.uy - (q0[1] - a[1]) * cand.ux) / den;
      if (tt > 0.5 && s >= -0.02 && s <= 1.02 && tt < hitT) {
        hitT = tt;
        candHit = [a[0] + tt * cand.ux, a[1] + tt * cand.uy];
      }
    }
    if (candHit) {
      hit = candHit;
      break;
    }
  }
  if (!hit) {
    eng.triggerAlert(
      'Ajuste no posible',
      `El rayo a ${step}° no alcanza el trazo cruzado desde el vértice de la guía. Acércala primero.`,
    );
    return;
  }
  const snapped = snapGuideCrossingToEndpoint(eng, host.id, hit);
  const endPt: [number, number] = [snapped[0], snapped[1]];
  if (Math.hypot(endPt[0] - a[0], endPt[1] - a[1]) < 0.5) return;
  live.pts = [...live.pts.slice(0, bestI), a, endPt, ...live.pts.slice(bestI + 2)];
  if (selElement?.id === live.id) setSelElement({ ...live });
  eng.render();
  eng._markDirty();
}

export function buildTribFromGuide(
  eng: PlanoEngine,
  padre: PlanoRamal,
  crossPt: [number, number],
  freeEnd: [number, number],
  id: string,
  viaPts?: [number, number][],
): PlanoRamal | null {
  const pStart: [number, number] = [freeEnd[0], freeEnd[1]];
  const pEnd: [number, number] = [crossPt[0], crossPt[1]];
  const via: [number, number][] = (viaPts || [])
    .map((p) => [p[0], p[1]] as [number, number])
    .filter(
      (p) =>
        Math.hypot(p[0] - pStart[0], p[1] - pStart[1]) > 1e-6 &&
        Math.hypot(p[0] - pEnd[0], p[1] - pEnd[1]) > 1e-6,
    );
  let fullPts: [number, number][] = [pStart, ...via, pEnd];
  const hostAng = getPadreHostAngle(padre, crossPt);
  const snapOn = (eng as unknown as { snapMode?: boolean }).snapMode ?? true;
  const arrivalSeg: [number, number][] =
    fullPts.length >= 2
      ? [fullPts[fullPts.length - 2], fullPts[fullPts.length - 1]]
      : [pStart, pEnd];
  let corrected: [number, number][] | null = fullPts;
  if (hostAng !== null) {
    corrected = snapGuideArrivalToHost(fullPts, hostAng, padre.net, 'tributario');
    if (!corrected) {
      eng.triggerAlert('Ángulo no permitido', guideAngleAlertMessage(padre.net, 'tributario'));
      return null;
    }
  }
  const angleOk =
    hostAng !== null
      ? isGuideRelativeAngleValid(
          corrected[corrected.length - 2],
          corrected[corrected.length - 1],
          hostAng,
          padre.net,
          'tributario',
          snapOn,
        )
      : checkRamalAngles(fullPts, padre.net, 'tributario', snapOn);
  if (!angleOk) {
    eng.triggerAlert('Ángulo no permitido', guideAngleAlertMessage(padre.net, 'tributario'));
    return null;
  }
  if (corrected !== fullPts) {
    fullPts = corrected;
    arrivalSeg[0] = fullPts[fullPts.length - 2];
    arrivalSeg[1] = fullPts[fullPts.length - 1];
  }
  void arrivalSeg;
  let tribReversedForFlow: boolean | undefined;
  if (padre.net === 'san' || padre.net === 'll' || padre.net === 'vent') {
    const flowEx = flowVecAt(padre, crossPt, 1);
    if (flowEx) {
      const flowNew = [arrivalSeg[1][0] - arrivalSeg[0][0], arrivalSeg[1][1] - arrivalSeg[0][1]];
      if (flowNew[0] * flowEx[0] + flowNew[1] * flowEx[1] > 0) {
        tribReversedForFlow = true;
      }
    }
  }
  const isPadreTrib = padre.tipo === 'tributario';
  const padreLabel = isPadreTrib
    ? rootTributarioLabel(eng.ramales, padre.id)
    : padre.label || padre.id;
  const cnt = allocTributaryNumber(eng, padreLabel);
  const label = `T${cnt}${padreLabel}`;
  const newTrib: PlanoRamal = {
    id,
    net: padre.net,
    tipo: 'tributario',
    padre: padre.id,
    pts: fullPts,
    totalL: +calculateRamalLength(fullPts, eng).toFixed(3),
    label,
    ini: '',
    fin: '',
    piso: String(eng.nivelActual?.n ?? ''),
    dz: '',
    uc: 0,
    nSalidas: 1,
    labelX: (pStart[0] + pEnd[0]) / 2,
    labelY: (pStart[1] + pEnd[1]) / 2,
    labelAngle: _firstSegmentAngle(fullPts),
    material: padre.material || eng._ramalDefaults?.material || '',
    diametro: padre.net === 'vent' ? '2"' : '',
    pendiente: 2,
    bloqueado: true,
    _tribReversed: tribReversedForFlow,
    showLength: true,
    showName: true,
    showGuide: true,
    showFlowDir: true,
    showMatDiamPend: true,
    _sinAccMedInterior: true,
  };
  if (padre.net === 'vent' || padre.net === 'san' || padre.net === 'll') {
    let flowErr = ramalFlowDirectionCheck(eng, newTrib, [newTrib], 0.5);
    if (flowErr) {
      newTrib._tribReversed = !newTrib._tribReversed;
      flowErr = ramalFlowDirectionCheck(eng, newTrib, [newTrib], 0.5);
      if (flowErr) newTrib._tribReversed = !newTrib._tribReversed;
    }
    if (flowErr) {
      eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
      return null;
    }
  }
  eng.ramales.push(newTrib);
  (eng as unknown as { _guideTributary?: boolean })._guideTributary = true;
  autoSplitJunctionAndSumFlow(eng, newTrib);
  (eng as unknown as { _guideTributary?: boolean })._guideTributary = false;
  {
    const splitAtCross = eng.ramales.some((r) => r.mergesFrom && r.mergesFrom[1] === newTrib.id);
    if (!splitAtCross) {
      const touchesPadre =
        (padre.pts || []).some((p) => Math.hypot(p[0] - crossPt[0], p[1] - crossPt[1]) < 0.6) ||
        (padre.pts && padre.pts.length >= 2 && distToPolyline(crossPt, padre.pts) < 0.6);
      if (touchesPadre && (padre.net === 'san' || padre.net === 'll')) {
        newTrib._tribReversed = false;
      }
      const TOL_EP = 0.5;
      const sameGroup = (a: string, b: string) =>
        a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
      const receptor = eng.ramales.find(
        (r) =>
          r.id !== newTrib.id &&
          r.id !== newTrib.padre &&
          r.tipo !== 'tributario' &&
          sameGroup(r.net, newTrib.net) &&
          !!r.pts &&
          r.pts.length >= 2 &&
          Math.hypot(r.pts[0][0] - crossPt[0], r.pts[0][1] - crossPt[1]) < TOL_EP,
      );
      if (receptor) {
        const recLbl = receptor.label || receptor.id;
        newTrib.padre = receptor.id;
        newTrib.label = `T${allocTributaryNumber(eng, recLbl)}${recLbl}`;
      }
    }
  }
  scrubGuideJunctionAccessories(eng, crossPt);
  {
    const assoc = asociarRamalABajantes(eng, newTrib, false);
    if (assoc.alert) eng.triggerAlert(assoc.alert.title, assoc.alert.msg);
    if (assoc.rejected) {
      eng.ramales = eng.ramales.filter((x) => x.id !== newTrib.id);
      eng.render();
      return null;
    }
  }
  return newTrib;
}

export function scrubGuideJunctionAccessories(eng: PlanoEngine, pt: [number, number]): void {
  const TOL = 0.5;
  for (const r of eng.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    if (Math.hypot(r.pts[0][0] - pt[0], r.pts[0][1] - pt[1]) < TOL) r.accesorioInicio = '';
    if (Math.hypot(r.pts[r.pts.length - 1][0] - pt[0], r.pts[r.pts.length - 1][1] - pt[1]) < TOL)
      r.accesorioFin = '';
  }
}

export function resolveGuideJunctionAccessory(eng: PlanoEngine, ramalId: string): void {
  const r = eng.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return;
  if (r.net !== 'af' && r.net !== 'ac' && r.net !== 'gas') return;
  const trigger = detectAccesorioTrigger(eng, ramalId);
  if (!trigger || trigger.isTee) return;
  const accId =
    trigger.angleDeg === 45
      ? r.net === 'gas'
        ? 'codos_45'
        : 'codo45'
      : r.net === 'gas'
        ? 'codos_90_std'
        : 'codo90rm';
  const TOL = 0.5;
  if (Math.hypot(r.pts[0][0] - trigger.point[0], r.pts[0][1] - trigger.point[1]) < TOL) {
    r.accesorioInicio = accId;
  } else {
    r.accesorioFin = accId;
  }
}
