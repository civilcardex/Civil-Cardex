import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoGuideLine, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import { ANGLE_EPS, sameNetGroup } from '../../../lib/PlanoEngine/drawingAngles.ts';
import { distToPolyline } from '../../../lib/shared/geometry';
import { snapGuideCrossingToEndpoint } from '../../../lib/PlanoEngine/guideLines.ts';
import { REDES_PRESION } from '../../../lib/PlanoEngine/nodos.ts';

/** Punto donde la guía CORTA de verdad al segmento del ramal (los dos parámetros acotados al
 *  segmento), o null si solo pasa cerca. Antes se aceptaba cualquier cruce a menos de 12 px y se
 *  proyectaba al extremo del anfitrión: el ancla caía fuera del cuerpo, el recorte y el split en
 *  T no encontraban dónde unir, y el angulo se medía contra un segmento que no era.
 *  Ej: guía que termina a 8 px del ramal → null (no hay corte). */
function intersectGuideWithSegment(
  p0: number[],
  p1: number[],
  q0: number[],
  q1: number[],
): { x: number; y: number } | null {
  const rx = p1[0] - p0[0];
  const ry = p1[1] - p0[1];
  const sx = q1[0] - q0[0];
  const sy = q1[1] - q0[1];
  const lr = Math.hypot(rx, ry);
  const ls = Math.hypot(sx, sy);
  if (lr < 1e-6 || ls < 1e-6) return null;
  // Margen de medio píxel convertido a parámetro: un vértice compartido cuenta como corte.
  const epsR = 0.5 / lr;
  const epsS = 0.5 / ls;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) {
    // COLINEAL: si la guía se solapa con el segmento, el corte es el extremo del solape más
    // lejano al inicio de la guía (el punto donde deja de acompañarlo).
    const distAlSegmento = Math.abs((q0[0] - p0[0]) * ry - (q0[1] - p0[1]) * rx) / lr;
    if (distAlSegmento > 0.5) return null;
    const proy = (pt: number[]) => ((pt[0] - p0[0]) * rx + (pt[1] - p0[1]) * ry) / (lr * lr);
    const t0 = Math.min(proy(q0), proy(q1));
    const t1 = Math.max(proy(q0), proy(q1));
    const desde = Math.max(0, t0);
    const hasta = Math.min(1, t1);
    if (hasta < desde - epsR) return null;
    const t = Math.max(desde, Math.min(1, hasta));
    return { x: p0[0] + t * rx, y: p0[1] + t * ry };
  }
  const t = ((q0[0] - p0[0]) * sy - (q0[1] - p0[1]) * sx) / denom;
  const u = ((q0[0] - p0[0]) * ry - (q0[1] - p0[1]) * rx) / denom;
  if (t < -epsR || t > 1 + epsR) return null;
  if (u < -epsS || u > 1 + epsS) return null;
  const tc = Math.max(0, Math.min(1, t));
  return { x: p0[0] + tc * rx, y: p0[1] + tc * ry };
}

/** Cruce de la guía con un ramal: el más cercano a la PUNTA de la guía (el extremo que el
 *  usuario lleva hasta el trazo). `net` limita la búsqueda a la red seleccionada (+ su grupo
 *  sanitario): antes una guía san "cruzaba" el primer ramal AF que pasara cerca y el menú
 *  aplicaba las reglas de 90° de AF/AC.
 *  Ej: guía san que pasa junto a un ramal AF y termina en uno san → cruce = el san. */
export function findGuideCrossing(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
  net?: string,
): { point: [number, number]; angle: number; ramalId: string } | null {
  if (!guide.pts || guide.pts.length < 2) return null;
  const tip = guide.pts[guide.pts.length - 1];
  let best: { point: [number, number]; angle: number; dist: number; ramalId: string } | null = null;
  for (let g = 0; g < guide.pts.length - 1; g++) {
    const a = guide.pts[g];
    const b = guide.pts[g + 1];
    for (const r of eng.ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      if (net && !sameNetGroup(String(r.net || ''), net)) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const hit = intersectGuideWithSegment(a, b, r.pts[i], r.pts[i + 1]);
        if (!hit) continue;
        const dist = Math.hypot(hit.x - tip[0], hit.y - tip[1]);
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
  // `snapOn` se conserva en la firma por compatibilidad, pero YA NO exime: la presión se valida
  // igual con el snap apagado (antes `!snapOn` devolvía true y cualquier ángulo entraba).
  void snapOn;
  void tipo;
  const dx = pEnd[0] - pStart[0];
  const dy = pEnd[1] - pStart[1];
  if (Math.hypot(dx, dy) < 0.1) return true;
  const guideDeg = ((Math.atan2(dy, dx) * 180) / Math.PI) % 360;
  const hostDeg = ((hostAngleRad * 180) / Math.PI) % 360;
  const diffDeg = (((guideDeg - hostDeg) % 360) + 360) % 360;
  const diffMod180 = diffDeg % 180;
  if (diffMod180 <= ANGLE_EPS || diffMod180 >= 180 - ANGLE_EPS) return false;
  // Matriz por red: san/ll SOLO un giro de 45° contra el trazo anfitrión (45° o su espejo 135°;
  // 90° y 180° quedan fuera); presión (af/ac/gas) SOLO 90°; vent es libre después del primer
  // tramo y conserva los múltiplos de 45°.
  if (net === 'san' || net === 'll')
    return Math.abs(diffMod180 - 45) <= ANGLE_EPS || Math.abs(diffMod180 - 135) <= ANGLE_EPS;
  if (net === 'af' || net === 'ac' || net === 'gas') return Math.abs(diffMod180 - 90) <= ANGLE_EPS;
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

/** ¿El punto aterriza sobre el CUERPO de un ramal de esa red (interior de un segmento, sin contar
 *  las puntas)? Ese aterrizaje es la T de verdad — caer en un vértice es una unión de extremo a
 *  extremo y no se recorta ni se voltea nada.
 *  Ej: (50,100) sobre el tramo (0,100)-(200,100) → true; sobre (0,100) → false. */
export function puntoSobreCuerpoDeRamal(
  eng: PlanoEngine,
  pt: [number, number],
  net: string,
): boolean {
  const TOL = 0.6;
  for (const r of eng.ramales) {
    if (!r.pts || r.pts.length < 2 || r.net !== net) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, ay] = r.pts[i];
      const [bx, by] = r.pts[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.0001) continue;
      const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / lenSq;
      if (t < 0.03 || t > 0.97) continue;
      const px = ax + t * dx;
      const py = ay + t * dy;
      if (Math.hypot(pt[0] - px, pt[1] - py) < TOL) return true;
    }
  }
  return false;
}

/** ¿Hay que voltear el ramal que se crea desde una guía? La respuesta depende la red, igual que
 *  el sentido de un trazo manual: en presión (af/ac/gas/rci) el ramal SALE de la unión (el agua va
 *  del tronco al aparato) y en san/ll DRENA hacia la conexión.
 *  `resolveRamalEndsFromGuide` deja el cruce al final — correcto para san/ll, pero en presión eso
 *  deja el ramal ENTRANDO a la T: el motor no puede deducir el sentido y abre el modal "Sentido
 *  del tramo nuevo" (regla 5). Voltearlo antes del split lo resuelve en silencio.
 *  Ej: guía af que termina sobre el cuerpo de un tronco af → true. */
export function debeVoltearRamalDeGuia(eng: PlanoEngine, pts: number[][], net: string): boolean {
  if (pts.length < 2) return false;
  const first: [number, number] = [pts[0][0], pts[0][1]];
  const last: [number, number] = [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  if (REDES_PRESION.has(net)) {
    return puntoSobreCuerpoDeRamal(eng, last, net) && !guideEndTouchesNetwork(eng, first, net);
  }
  if (net === 'san' || net === 'll') {
    return guideEndTouchesNetwork(eng, first, net) && !guideEndTouchesNetwork(eng, last, net);
  }
  return false;
}

/** Ángulos (rad) de TODOS los segmentos del padre que pasan por `crossPt` (tolerancia 0.6).
 *  En un vértice hay dos y la validación debe poder usar cualquiera de los dos — antes se
 *  devolvía el primero que apareciera y el ángulo bueno se descartaba al azar.
 *  Ej: tributario que llega a la esquina de un padre en L → sirve el segmento que dé 45°. */
export function getPadreHostAngles(padre: PlanoRamal, crossPt: [number, number]): number[] {
  const out: number[] = [];
  if (!padre.pts || padre.pts.length < 2) return out;
  const TOL = 0.6;
  const norm = (a: number) => {
    const g = ((a * 180) / Math.PI) % 180;
    return ((g % 180) + 180) % 180;
  };
  for (let i = 0; i < padre.pts.length - 1; i++) {
    const a = padre.pts[i];
    const b = padre.pts[i + 1];
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len2 = vx * vx + vy * vy;
    if (len2 < 1e-9) continue;
    const t = ((crossPt[0] - a[0]) * vx + (crossPt[1] - a[1]) * vy) / len2;
    const tc = Math.max(0, Math.min(1, t));
    const d = Math.hypot(crossPt[0] - (a[0] + tc * vx), crossPt[1] - (a[1] + tc * vy));
    if (d > TOL) continue;
    const ang = Math.atan2(vy, vx);
    // ¿Ya está ese ángulo? Comparación directa (out tiene 1-3 valores): un `.some` dentro del
    // bucle de puntos sería un foco O(n²) para el guard G8.
    let repetido = false;
    for (const o of out) if (Math.abs(norm(o) - norm(ang)) <= ANGLE_EPS) repetido = true;
    if (!repetido) out.push(ang);
  }
  return out;
}

export function getPadreHostAngle(padre: PlanoRamal, crossPt: [number, number]): number | null {
  const all = getPadreHostAngles(padre, crossPt);
  return all.length ? all[0] : null;
}

/** Red a la que pertenece la guía: la SELECCIONADA manda (orig. usuario: "la red seleccionada
 *  manda; nunca apliques reglas ni mensajes de otra red"). Antes se devolvía la red del ramal
 *  que la guía cruzara, así que una guía san que pasaba cerca de un AF mostraba las reglas de
 *  90° de AF/AC y creaba el ramal en la red equivocada.
 *  Ej: red activa san + guía que cruza un ramal af → san. */
export function resolveGuideNet(eng: PlanoEngine, guide: PlanoGuideLine): string {
  return eng.activeNet || guide.net;
}

export function snapGuideArrivalToHost(
  guidePts: [number, number][],
  hostAngRad: number,
  net: string,
  tipo: string | undefined,
): [number, number][] | null {
  const n = guidePts.length;
  if (n < 2) return guidePts;
  void tipo; // la matriz ya no distingue tipo: la red decide (san/ll 45°, presión 90°)
  const tip = guidePts[n - 1];
  const prev = guidePts[n - 2];
  const dx = tip[0] - prev[0];
  const dy = tip[1] - prev[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return guidePts;
  const arrDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const hostDeg = (hostAngRad * 180) / Math.PI;
  const rel = (((arrDeg - hostDeg) % 180) + 180) % 180;
  // Matriz por red: presión SOLO 90° contra el trazo; san/ll SOLO 45° (de un lado o del otro:
  // una llegada a 135° relativos también deja un giro de 45°); vent conserva el ruteo libre
  // después del primer tramo (45/90/135).
  const cands =
    net === 'san' || net === 'll'
      ? [45, 135]
      : net === 'af' || net === 'ac' || net === 'gas'
        ? [90]
        : [45, 90, 135];
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
  void tipo;
  if (net === 'san' || net === 'll')
    return 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.';
  if (net === 'vent')
    return 'La red de ventilación solo permite ángulos de 45°. Usar línea guía para ajustar ángulo.';
  // Presión (af/ac/gas): un solo mensaje de 90° — el mismo para ramal y tributario.
  return 'Las redes de presión (AF (Agua Fría), AC (Agua Caliente) y gas) solo permiten ángulos de 90°. Usar línea guía para ajustar ángulo.';
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
