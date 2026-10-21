import type PlanoEngine from '../../../lib/PlanoEngine/PlanoMotor.ts';
import type { PlanoGuideLine, PlanoRamal } from '../../../lib/PlanoEngine/PlanoEstado.ts';
import { ANGLE_EPS } from '../../../lib/PlanoEngine/dibujoAngulos.ts';
import { distToPolyline } from '../../../lib/shared/geometry';
import { snapGuideCrossingToEndpoint } from '../../../lib/PlanoEngine/guiaLineas.ts';

function intersectGuideWithSegment(
  p0: number[],
  p1: number[],
  q0: number[],
  q1: number[],
): { x: number; y: number } | null {
  const dx1 = p1[0] - p0[0];
  const dy1 = p1[1] - p0[1];
  const dx2 = q1[0] - q0[0];
  const dy2 = q1[1] - q0[1];
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) return null;
  const dx3 = q0[0] - p0[0];
  const dy3 = q0[1] - p0[1];
  const t = (dx3 * dy2 - dy3 * dx2) / denom;
  const x = p0[0] + t * dx1;
  const y = p0[1] + t * dy1;
  const vlen2 = dx1 * dx1 + dy1 * dy1;
  if (vlen2 < 1e-9) return null;
  const tc = Math.max(0, Math.min(1, ((x - p0[0]) * dx1 + (y - p0[1]) * dy1) / vlen2));
  if (Math.hypot(x - (p0[0] + tc * dx1), y - (p0[1] + tc * dy1)) > 12) return null;
  return { x, y };
}

export function findGuideCrossing(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
): { point: [number, number]; angle: number; ramalId: string } | null {
  if (!guide.pts || guide.pts.length < 2) return null;
  const p0 = guide.pts[0];
  let best: { point: [number, number]; angle: number; dist: number; ramalId: string } | null = null;
  for (let g = 0; g < guide.pts.length - 1; g++) {
    const a = guide.pts[g];
    const b = guide.pts[g + 1];
    for (const r of eng.ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const hit = intersectGuideWithSegment(a, b, r.pts[i], r.pts[i + 1]);
        if (!hit) continue;
        const dist = Math.hypot(hit.x - p0[0], hit.y - p0[1]);
        if (!best || dist < best.dist) {
          const dx = r.pts[i + 1][0] - r.pts[i][0];
          const dy = r.pts[i + 1][1] - r.pts[i][1];
          best = { point: [hit.x, hit.y], angle: Math.atan2(dy, dx), dist, ramalId: r.id };
        }
      }
    }
  }
  return best;
}

export function guidePolylineSide(
  guidePts: [number, number][],
  crossPt: [number, number],
): { sideA: [number, number][]; sideB: [number, number][] } {
  let bestSeg = 0;
  let bestD = Infinity;
  for (let i = 0; i < guidePts.length - 1; i++) {
    const a = guidePts[i];
    const b = guidePts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) continue;
    const t = Math.max(
      0,
      Math.min(1, ((crossPt[0] - a[0]) * dx + (crossPt[1] - a[1]) * dy) / lenSq),
    );
    const d = Math.hypot(crossPt[0] - (a[0] + t * dx), crossPt[1] - (a[1] + t * dy));
    if (d < bestD) {
      bestD = d;
      bestSeg = i;
    }
  }
  const cross: [number, number] = [crossPt[0], crossPt[1]];
  const a = guidePts[bestSeg];
  const b = guidePts[bestSeg + 1];
  const segLen2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  const tSeg =
    segLen2 < 1e-9
      ? 0
      : ((cross[0] - a[0]) * (b[0] - a[0]) + (cross[1] - a[1]) * (b[1] - a[1])) / segLen2;
  const sideA: [number, number][] = [];
  for (let i = 0; i <= bestSeg; i++) sideA.push([guidePts[i][0], guidePts[i][1]]);
  const lastA = sideA[sideA.length - 1];
  if (Math.hypot(lastA[0] - cross[0], lastA[1] - cross[1]) < 0.5) {
    sideA[sideA.length - 1] = cross;
  } else if (tSeg <= 1) {
    sideA.push(cross);
  } else {
    if (bestSeg + 1 < guidePts.length)
      sideA.push([guidePts[bestSeg + 1][0], guidePts[bestSeg + 1][1]]);
    sideA.push(cross);
  }
  const sideB: [number, number][] = [cross];
  for (let i = bestSeg + 1; i < guidePts.length; i++) {
    const p = guidePts[i];
    if (Math.hypot(p[0] - cross[0], p[1] - cross[1]) < 0.5) continue;
    sideB.push([p[0], p[1]]);
  }
  return { sideA, sideB };
}

export function netAllowedSteps(net: string): (45 | 90)[] {
  if (net === 'san' || net === 'll' || net === 'vent') return [45];
  return [90];
}

export function isGuideRelativeAngleValid(
  pStart: [number, number],
  pEnd: [number, number],
  hostAngleRad: number,
  net: string,
  tipo: string | undefined,
  snapOn: boolean,
): boolean {
  if (!snapOn && (net === 'ac' || net === 'af' || net === 'gas')) return true;
  const dx = pEnd[0] - pStart[0];
  const dy = pEnd[1] - pStart[1];
  if (Math.hypot(dx, dy) < 0.1) return true;
  const guideDeg = ((Math.atan2(dy, dx) * 180) / Math.PI) % 360;
  const hostDeg = ((hostAngleRad * 180) / Math.PI) % 360;
  const diffDeg = (((guideDeg - hostDeg) % 360) + 360) % 360;
  const diffMod180 = diffDeg % 180;
  if (diffMod180 <= ANGLE_EPS || diffMod180 >= 180 - ANGLE_EPS) return false;
  const isTributarioAcAf = (net === 'af' || net === 'ac') && tipo === 'tributario';
  const isGas = net === 'gas';
  if (isTributarioAcAf || isGas) {
    return Math.abs(diffMod180 - 90) <= ANGLE_EPS;
  }
  const rem = diffMod180 % 45;
  return rem <= ANGLE_EPS || rem >= 45 - ANGLE_EPS;
}

export function guideEndTouchesNetwork(
  eng: PlanoEngine,
  pt: [number, number],
  net?: string,
): boolean {
  const TOL = 0.6;
  const sameGroup = (other: string | undefined) =>
    !!net &&
    (other === net || ((net === 'san' || net === 'vent') && (other === 'san' || other === 'vent')));
  for (const r of eng.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    if (net && !sameGroup(r.net)) continue;
    if (distToPolyline(pt, r.pts) < TOL) return true;
  }
  return false;
}

export function getPadreHostAngle(padre: PlanoRamal, crossPt: [number, number]): number | null {
  if (!padre.pts || padre.pts.length < 2) return null;
  const TOL = 0.6;
  for (let i = 0; i < padre.pts.length - 1; i++) {
    const a = padre.pts[i];
    const b = padre.pts[i + 1];
    const d = Math.hypot(crossPt[0] - a[0], crossPt[1] - a[1]);
    const d2 = Math.hypot(crossPt[0] - b[0], crossPt[1] - b[1]);
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len2 = vx * vx + vy * vy;
    if (len2 < 1e-9) continue;
    const t = ((crossPt[0] - a[0]) * vx + (crossPt[1] - a[1]) * vy) / len2;
    if (t < -0.02 || t > 1.02) {
      if (d > TOL && d2 > TOL) continue;
    }
    return Math.atan2(vy, vx);
  }
  return null;
}

export function resolveGuideNet(eng: PlanoEngine, guide: PlanoGuideLine): string {
  const crossing = findGuideCrossing(eng, guide);
  if (!crossing) return guide.net;
  const ramal = eng.ramales.find((r) => r.id === crossing.ramalId);
  return ramal?.net || guide.net;
}

export function snapGuideArrivalToHost(
  guidePts: [number, number][],
  hostAngRad: number,
  net: string,
  tipo: string | undefined,
): [number, number][] | null {
  const n = guidePts.length;
  if (n < 2) return guidePts;
  const tip = guidePts[n - 1];
  const prev = guidePts[n - 2];
  const dx = tip[0] - prev[0];
  const dy = tip[1] - prev[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return guidePts;
  const arrDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const hostDeg = (hostAngRad * 180) / Math.PI;
  const rel = (((arrDeg - hostDeg) % 180) + 180) % 180;
  const isTribAcAf = (net === 'af' || net === 'ac') && tipo === 'tributario';
  const cands = isTribAcAf || net === 'gas' ? [90] : [45, 90, 135];
  let bestRel = cands[0];
  let bestDiff = Infinity;
  for (const c of cands) {
    const d = Math.min(Math.abs(rel - c), 180 - Math.abs(rel - c));
    if (d < bestDiff) {
      bestDiff = d;
      bestRel = c;
    }
  }
  if (bestDiff > 7.5) return null;
  let delta = bestRel - rel;
  if (delta > 90) delta -= 180;
  if (delta < -90) delta += 180;
  const arrRad = ((arrDeg + delta) * Math.PI) / 180;
  const newPrev: [number, number] = [tip[0] - L * Math.cos(arrRad), tip[1] - L * Math.sin(arrRad)];
  const out = guidePts.map((p) => [p[0], p[1]] as [number, number]);
  out[n - 2] = newPrev;
  return out;
}

export function guideAngleAlertMessage(net: string, tipo: string): string {
  if (net === 'san' || net === 'll' || net === 'vent')
    return 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.';
  if (net === 'gas')
    return 'La red de gas solo permite ángulos de 90°. Usar línea guía para ajustar ángulo.';
  if ((net === 'af' || net === 'ac') && tipo === 'tributario')
    return 'Los tributarios de AF/AC solo permiten ángulos de 90°. Usar línea guía para ajustar ángulo.';
  return 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.';
}

export function resolveRamalEndsFromGuide(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
  crossing: { point: [number, number]; ramalId: string } | null,
): { pts: [number, number][] } {
  const gpts = (guide.pts || []).map((p) => [p[0], p[1]] as [number, number]);
  if (gpts.length < 2) return { pts: gpts };
  if (!crossing) return { pts: gpts };
  const gLast = gpts[gpts.length - 1];
  const nearTip = Math.hypot(gLast[0] - crossing.point[0], gLast[1] - crossing.point[1]) < 3;
  const host = eng.ramales.find((r) => r.id === crossing.ramalId);
  const nearHostEnd =
    !!host?.pts &&
    host.pts.some(
      ([ex, ey]) => Math.hypot(ex - crossing.point[0], ey - crossing.point[1]) < 16 / eng.zoom,
    );
  const snapped =
    nearTip && !nearHostEnd
      ? ([crossing.point[0], crossing.point[1]] as [number, number])
      : snapGuideCrossingToEndpoint(eng, crossing.ramalId, [crossing.point[0], crossing.point[1]]);
  const { sideA, sideB } = guidePolylineSide(gpts, [snapped[0], snapped[1]]);
  const len = (s: [number, number][]) => {
    let l = 0;
    for (let i = 0; i < s.length - 1; i++)
      l += Math.hypot(s[i + 1][0] - s[i][0], s[i + 1][1] - s[i][1]);
    return l;
  };
  const dA = Math.hypot(sideA[0][0] - snapped[0], sideA[0][1] - snapped[1]);
  const dB = Math.hypot(
    sideB[sideB.length - 1][0] - snapped[0],
    sideB[sideB.length - 1][1] - snapped[1],
  );
  let main = dA >= dB ? sideA : sideB;
  if (dA > 1 && dB > 1) main = len(sideA) >= len(sideB) ? sideA : sideB;
  const atStart =
    Math.hypot(main[0][0] - snapped[0], main[0][1] - snapped[1]) <
    Math.hypot(main[main.length - 1][0] - snapped[0], main[main.length - 1][1] - snapped[1]);
  const ordered = atStart ? [...main].reverse() : [...main];
  ordered[ordered.length - 1] = [snapped[0], snapped[1]];
  return { pts: ordered };
}
