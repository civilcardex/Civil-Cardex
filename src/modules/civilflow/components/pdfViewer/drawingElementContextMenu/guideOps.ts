import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoRamal, PlanoGuideLine, PlanoElement } from '../../../lib/PlanoEngine/PlanoState';
import {
  ANGLE_EPS,
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

// Rota pts[1] alrededor de pts[0] (el pivote fijo) en el paso de grados con signo dado,
// validando el resultado contra las mismas reglas de ángulo que debería obedecer un ramal
// real de esa red — así una línea guía nunca puede quedar rotada a un ángulo que su
// conversión posterior "Crear ramal" no aceptaría.
// Intersección guía/segmento acotado por ambos lados: el cruce debe caer cerca de la
// EXTENSIÓN REAL de la guía (≤12 unid del segmento p0-p1) y dentro del ramal (s∈[−0.02,1.02]).
// Sin el límite del lado guía, la EXTENSIÓN de otro segmento de la guía producía cruces
// fantasma lejísimos del toque real (la vertical de una guía en L cruzando el tronco "por
// extensión") y la conversión validaba contra un punto de conexión inexistente.
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

// Busca el ramal más cercano que cruce CUALQUIER segmento de la guía (ítem 2) y devuelve
// ese punto de cruce junto con la dirección del propio segmento del ramal — los botones de
// rotación forman su ángulo respecto a ESTA, no a la orientación actual de la guía, que es
// precisamente el sentido de dibujar una guía a través de un ramal.
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

// Ítem 2: parte la polyline de la guía en el punto de cruce — lado A [p0..cruce], lado B
// [cruce..pLast]. El cruce cae sobre el segmento con distancia mínima al punto.
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
  // ¿El cruce cae INTERIOR al segmento bestSeg o MÁS ALLÁ de su punta (extensión)?
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
    // Cruce INTERIOR: sideA termina EN el cruce — la punta sobrante queda en sideB (pedido
    // usuario: la guía ajustada no atraviesa el trazo).
    sideA.push(cross);
  } else {
    // Cruce por la EXTENSIÓN (la guía queda corta): el lado se EXTIENDE hasta el cruce.
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

// La tubería san/ll/vent solo gira con codos de 45°; AF/AC y gas solo de 90° — coincide con la
// misma regla por red que `checkRamalAngles`/`drawingAngles.ts` aplica en otros sitios para los
// ramales reales, aplicada aquí como filtro de UX sobre qué botones de rotación se muestran
// (ver GuideLineMenu más abajo).
export function netAllowedSteps(net: string): (45 | 90)[] {
  if (net === 'san' || net === 'll' || net === 'vent') return [45];
  return [90];
}

// ¿El ángulo RELATIVO entre la guía y el ramal que cruza es válido? Cuando la guía
// conecta a un ramal existente, la validación debe ser relativa (perpendicularidad)
// y no absoluta contra la grilla — p. ej. ramal a 30° + guía a 120° (90° relativa)
// es válida aunque 120° absoluto falle el %90. Guías libres se validan absoluto.
// snapOn=false en af/ac/gas desactiva la validación (igual que checkRamalAngles).
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
  // Paralelo (0° o 180°) nunca es tributario válido
  if (diffMod180 <= ANGLE_EPS || diffMod180 >= 180 - ANGLE_EPS) return false;
  const isTributarioAcAf = (net === 'af' || net === 'ac') && tipo === 'tributario';
  const isGas = net === 'gas';
  if (isTributarioAcAf || isGas) {
    // Solo 90° relativa
    return Math.abs(diffMod180 - 90) <= ANGLE_EPS;
  }
  // san/ll/vent y ramales af/ac no-tributarios: múltiplos de 45° (45/90/135)
  const rem = diffMod180 % 45;
  return rem <= ANGLE_EPS || rem >= 45 - ANGLE_EPS;
}

// ¿El punto toca la red existente (extremo de un ramal o su cuerpo)? Para orientar el flujo
// de ramales creados desde guía: san/ll drenan SIEMPRE hacia el extremo apoyado en la red —
// el sentido en que se dibujó la guía no debe influir en la flecha (orig. usuario).
// @param net red del ramal por orientar: SOLO esa red cuenta como apoyo (san admite vent,
// que comparte sus uniones) — sin filtro, un roce con un ramal af/ac/gas invertía la flecha.
export function guideEndTouchesNetwork(
  eng: PlanoEngine,
  pt: [number, number],
  net?: string,
): boolean {
  const TOL = 0.6;
  // Mismo agrupamiento que el motor: san y vent comparten uniones.
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

function getPadreHostAngle(padre: PlanoRamal, crossPt: [number, number]): number | null {
  if (!padre.pts || padre.pts.length < 2) return null;
  const TOL = 0.6;
  for (let i = 0; i < padre.pts.length - 1; i++) {
    const a = padre.pts[i];
    const b = padre.pts[i + 1];
    const d = Math.hypot(crossPt[0] - a[0], crossPt[1] - a[1]);
    const d2 = Math.hypot(crossPt[0] - b[0], crossPt[1] - b[1]);
    // punto sobre segmento (incluye tolerancia de 2% del largo) — mismo criterio que intersectGuideWithSegment
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len2 = vx * vx + vy * vy;
    if (len2 < 1e-9) continue;
    const t = ((crossPt[0] - a[0]) * vx + (crossPt[1] - a[1]) * vy) / len2;
    if (t < -0.02 || t > 1.02) {
      // también probar cercanía al extremo (snapGuideCrossingToEndpoint puede haber movido el punto exactamente al extremo)
      if (d > TOL && d2 > TOL) continue;
    }
    return Math.atan2(vy, vx);
  }
  return null;
}

// Una guía se dibuja con `net: activeNet` fijado en el momento de dibujarla — si el usuario
// cambia de red activa después (o la dibujó con la red "equivocada" activa por descuido), ese
// campo queda desalineado con lo que la guía realmente está cruzando en el plano. Los botones de
// ángulo, la validación y el ramal/tributario que finalmente se crea deben reflejar SIEMPRE la
// red del ramal real que la guía toca, no el valor congelado al dibujarla — así el menú "detecta
// automáticamente" la red correcta en vez de exigir que el usuario la haya elegido bien de
// antemano. Si la guía no cruza ningún ramal (línea guía libre), no hay nada que detectar y se
// conserva `guide.net` como mejor valor disponible.
export function resolveGuideNet(eng: PlanoEngine, guide: PlanoGuideLine): string {
  const crossing = findGuideCrossing(eng, guide);
  if (!crossing) return guide.net;
  const ramal = eng.ramales.find((r) => r.id === crossing.ramalId);
  return ramal?.net || guide.net;
}

// Corrección fina de la LLEGADA de una guía al trazo (±7.5°): la validación de conversión
// exige la llegada a 45°/90° EXACTA relativa al host; una guía freehand llega a 44.3° y la
// alerta "Ángulo no permitido" se disparaba siempre. Este helper rota el vértice previo a la
// punta alrededor de la punta (el punto de conexión queda anclado) para dejar la llegada en
// el ángulo legal más cercano. @returns pts corregidos, o null si el desfase supera 7.5°.
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
  if (bestDiff > 7.5) return null; // demasiado lejos de cualquier ángulo legal
  let delta = bestRel - rel;
  if (delta > 90) delta -= 180;
  if (delta < -90) delta += 180;
  const arrRad = ((arrDeg + delta) * Math.PI) / 180;
  const newPrev: [number, number] = [tip[0] - L * Math.cos(arrRad), tip[1] - L * Math.sin(arrRad)];
  const out = guidePts.map((p) => [p[0], p[1]] as [number, number]);
  out[n - 2] = newPrev;
  return out;
}

/** Ajuste automático de la guía al ángulo de la red (únicos botones "Ajustar a 45°/90°"):
 *  detecta el cruce con el trazo existente, elige solo la orientación (el giro mínimo) y
 *  REEMPLAZA la porción que cruza: recorta el sobrante de la guía más allá del trazo y remata
 *  con un segundo segmento a XX° respecto al ramal — la guía termina EN el trazo, sin
 *  atravesarlo. El doblez queda sobre la propia línea original (el segmento 1 conserva su
 *  trayectoria) y el punto real de conexión lo determina el sistema. Multisegmento: solo el
 *  segmento conectador cambia; los demás quedan intactos. */
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

  // Segmento conectador: el más cercano al cruce; d1 = su dirección; a = extremo por donde
  // LLEGA la guía; b = la punta que ya sobrepasó el trazo (dot con d1 > 0 desde el cruce).
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
  // `a` = el vértice por donde la guía LLEGA (pivote del ajuste, existente); `b` = la punta que
  // sobrepasó el trazo (el pedazo que el usuario quiere eliminado).
  const a: [number, number] =
    dot1 > 0 && dot0 <= 0
      ? [s0[0], s0[1]]
      : dot0 > 0 && dot1 <= 0
        ? [s1[0], s1[1]]
        : dist0 <= dist1
          ? [s0[0], s0[1]]
          : [s1[0], s1[1]];

  // Direcciones legales de llegada (host ± step), orientadas desde `a` hacia el trazo y con el
  // giro mínimo respecto a la dirección dibujada — auto-orientación, sin lados para elegir.
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

  // Aterrizaje: el rayo legal desde `a` contra cada segmento del host (el más cercano). El
  // primer candidato por giro que alcance el trazo gana.
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
  if (Math.hypot(endPt[0] - a[0], endPt[1] - a[1]) < 0.5) return; // aterrizaje degenerado
  // El segmento conectador se re-angula alrededor de `a` y aterriza en el trazo: la punta que
  // sobraba (b y todo lo que la seguía en ese tramo) desaparece — la guía ya NO cruza.
  live.pts = [...live.pts.slice(0, bestI), a, endPt, ...live.pts.slice(bestI + 2)];
  if (selElement?.id === live.id) setSelElement({ ...live });
  eng.render();
  eng._markDirty();
}

/** Recorte del trazo existente tras conectar (§5-6 del pedido): cuando la conversión parte el
 *  ramal cruzado en el punto de conexión (autoSplit), una de las dos mitades puede quedar como
 *  muerta — un muerto sin nada conectado en su extremo lejano. Se recorta SOLO esa mitad, y
 *  solo si exactamente una de las dos lo es (si ambas o ninguna tienen conexiones, no se toca
 *  nada). Nunca borra la guía ni sus segmentos. */
export function guideAngleAlertMessage(net: string, tipo: string): string {
  if (net === 'san' || net === 'll' || net === 'vent')
    return 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.';
  if (net === 'gas')
    return 'La red de gas solo permite ángulos de 90°. Usar línea guía para ajustar ángulo.';
  if ((net === 'af' || net === 'ac') && tipo === 'tributario')
    return 'Los tributarios de AF/AC solo permiten ángulos de 90°. Usar línea guía para ajustar ángulo.';
  return 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.';
}

// Ordena la polyline de la guía para "Crear ramal" (ítem 2): el flujo va hacia el cruce y el
// extremo cercano queda anclado al cruce exacto — con snap al extremo del ramal cruzado
// cuando cae cerca, igual que la ruta de tributario. Sin cruce se conserva el orden.
// Si el cruce es interior, se toma el lado más largo (el otro se descarta con la guía).
export function resolveRamalEndsFromGuide(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
  crossing: { point: [number, number]; ramalId: string } | null,
): { pts: [number, number][] } {
  const gpts = (guide.pts || []).map((p) => [p[0], p[1]] as [number, number]);
  if (gpts.length < 2) return { pts: gpts };
  if (!crossing) return { pts: gpts };
  // Si la PUNTA de la guía ya toca el trazo (guía ajustada), el anclaje es EXACTO en ese
  // punto — sin salto al extremo del ramal (snap 16/zoom), que movía la conexión del sitio
  // donde el trazo quedó recortado (pedido usuario: "ambos conectados en sus extremos").
  const gLast = gpts[gpts.length - 1];
  const nearTip = Math.hypot(gLast[0] - crossing.point[0], gLast[1] - crossing.point[1]) < 3;
  // El snap al vértice del host SOLO se evita cuando el cruce está a mitad de cuerpo (guía
  // ajustada: anclaje exacto). Cerca del vértice del host sí ajusta al vértice (codo 90°).
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
  // Lado cuyo extremo libre está más lejos del cruce = lado principal (equivale al "lejano
  // primero" de la guía de 2 puntos).
  const dA = Math.hypot(sideA[0][0] - snapped[0], sideA[0][1] - snapped[1]);
  const dB = Math.hypot(
    sideB[sideB.length - 1][0] - snapped[0],
    sideB[sideB.length - 1][1] - snapped[1],
  );
  let main = dA >= dB ? sideA : sideB;
  // Cruce interior: el ramal toma el lado más largo para no nacer flotando a mitad de la guía.
  if (dA > 1 && dB > 1) main = len(sideA) >= len(sideB) ? sideA : sideB;
  // Orientar flujo hacia el cruce (el cruce va al final) y anclar el final al punto exacto.
  const atStart =
    Math.hypot(main[0][0] - snapped[0], main[0][1] - snapped[1]) <
    Math.hypot(main[main.length - 1][0] - snapped[0], main[main.length - 1][1] - snapped[1]);
  const ordered = atStart ? [...main].reverse() : [...main];
  ordered[ordered.length - 1] = [snapped[0], snapped[1]];
  return { pts: ordered };
}

// Núcleo compartido de creación de un tributario desde línea guía (botón singular y el plural
// del ítem 1.3): construye el tributario [freeEnd → cruce] (ítem 2: con los vértices
// intermedios viaPts si la guía es multisegmento), valida ángulo/flujo, lo empuja y lo
// parte si cae a mitad de cuerpo de su padre (autoSplitJunctionAndSumFlow). Devuelve el
// tributario o null si algo bloqueó la creación (la alerta ya se disparó).
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
  // Validación relativa al ramal padre cuando la guía lo cruza (ítems 4/5):
  // con host a 30° y guía a 120° la relativa es 90° válida aunque la absoluta falle.
  // Guías libres no tienen host → validación absoluta clásica.
  // Validación de guía: SOLO el segmento de LLEGADA, relativo al padre — el ajuste a 45°/90°
  // garantiza ese ángulo y el doblez interior del resto de la guía es decisión del usuario
  // (la regla absoluta bloqueaba conversiones legítimas de guías ajustadas).
  const hostAng = getPadreHostAngle(padre, crossPt);
  const snapOn = (eng as unknown as { snapMode?: boolean }).snapMode ?? true;
  const arrivalSeg: [number, number][] =
    fullPts.length >= 2
      ? [fullPts[fullPts.length - 2], fullPts[fullPts.length - 1]]
      : [pStart, pEnd];
  // Corrección fina de la llegada (±7.5°) antes de validar — igual que "Crear ramal".
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
  // San/ll/vent: mismo pre-alineamiento que el botón "Crear ramal" — sin esto,
  // autoSplitJunctionAndSumFlow aborta en silencio la división cuando el sentido no coincide con
  // el del padre (tributario queda suelto, sin símbolo, con la alerta "Dirección de flujo
  // incorrecta"). En af/ac/gas esto se sobrescribe de todos modos (autoSplit fuerza la cola del
  // tributario hacia la unión). Se usa el vector LOCAL del padre en el punto de cruce
  // (flowVecAt), no el global pts[0]→pts[last].
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
    // Ítem 1: etiqueta en el punto medio del trazo real con el ángulo de su
    // primer segmento (igual que los ramales manuales).
    labelX: (pStart[0] + pEnd[0]) / 2,
    labelY: (pStart[1] + pEnd[1]) / 2,
    labelAngle: _firstSegmentAngle(fullPts),
    // El tributario nace del mismo material que el ramal al que se une (el padre) — sin esto
    // la etiqueta del canvas no mostraba material (matDrawingLabel('') = ''), a diferencia de
    // los ramales dibujados a mano, que lo heredan de _ramalDefaults en finishRamal.
    material: padre.material || eng._ramalDefaults?.material || '',
    // Red vent: nace en 2" como los trazos dibujados a mano (orig. usuario).
    diametro: padre.net === 'vent' ? '2"' : '',
    pendiente: 2,
    bloqueado: true,
    _tribReversed: tribReversedForFlow,
    showLength: true,
    showName: true,
    showGuide: true,
    showFlowDir: true,
    showMatDiamPend: true,
    // Sin glifos de accesorio en los dobleces internos: los codos dibujados son parte del
    // trazo de la guía (detectAccesorioTrigger los saltaría en cada _markDirty).
    _sinAccMedInterior: true,
  };
  // Ítem 5: un tributario vent creado desde guía que termina fluyendo HACIA la unión san (codo
  // reventilado) se bloquea aquí — autoSplit no valida uniones extremo-con-extremo. Misma
  // validación pre-push para san/ll: los tributarios creados desde línea guía deben cumplir la
  // dirección de flujo de la red.
  // Auto-corrección primero (flip de orientación); si aun así contraviene la dirección,
  // SE BLOQUEA con alerta (orig. usuario: T1T3 se creó en contraria porque el "allow" final
  // la dejaba pasar).
  if (padre.net === 'vent' || padre.net === 'san' || padre.net === 'll') {
    let flowErr = ramalFlowDirectionCheck(eng, newTrib, [newTrib], 0.5);
    if (flowErr) {
      newTrib._tribReversed = !newTrib._tribReversed;
      flowErr = ramalFlowDirectionCheck(eng, newTrib, [newTrib], 0.5);
      if (flowErr) newTrib._tribReversed = !newTrib._tribReversed; // restaurar orientación
    }
    if (flowErr) {
      eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
      return null;
    }
  }
  eng.ramales.push(newTrib);
  // Igual que un tributario terminado a mano sobre su padre: parte al padre en existing+
  // downstream en el punto de cruce y fija la dirección del tributario (cola hacia la unión).
  // Flag transitorio: el padre de un tributario de guía es el ramal cruzado (explícito) — no
  // debe validarse contra la selección manual de padre en la barra (orig. #5).
  (eng as unknown as { _guideTributary?: boolean })._guideTributary = true;
  autoSplitJunctionAndSumFlow(eng, newTrib);
  (eng as unknown as { _guideTributary?: boolean })._guideTributary = false;
  // Unión extremo-con-extremo (sin split): el tributario no partió nada. Si el cruce toca
  // al padre se fuerza _tribReversed=false en san/ll (drenan HACIA la unión; el split a mitad
  // de cuerpo ya lo deja así, pero aquí no hay split que lo reescriba y el ajuste previo
  // puede haberlo dejado en true — flecha invertida, orig. usuario).
  // Ítem 3 (todas las redes): si en el cruce NACE otro ramal (pts[0] en el punto — el tramo
  // autocreado aguas abajo, o dibujado antes continuando la línea), ESE es el padre real del
  // tributario y su label debe referenciarlo, no al tramo aguas arriba que existía antes
  // (orig. usuario: T2RS7 en la unión RS7|RS8 cuando descarga a RS8). Si el receptor ES el
  // propio padre, no hay nada que cambiar.
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
  // El usuario pide que una conversión de línea guía a tributario NO dibuje NINGÚN símbolo de
  // accesorio (codo/tee) en la unión — ni siquiera uno que viniera persistido de una conversión
  // anterior con código viejo. En el punto de cruce se anula todo accesorio de extremo que otro
  // ramal (padre, downstream o el propio tributario) tuviera anclado.
  scrubGuideJunctionAccessories(eng, crossPt);
  // Igual que un trazo terminado a mano (finishRamal): asociar extremos a bajantes
  // (alimentaIds/recibeDeIds + ini/fin). Sin esto el tributario quedaba suelto del bajante
  // aunque naciera sobre él. La guard central puede rechazar (p.ej. tributario sobre
  // bajante): se retira el trazo con alerta, igual que en dibujo manual.
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

// Ítem usuario (guías): elimina cualquier accesorioInicio/Fin anclado en los ramales cuyo
// extremo coincide con el punto de la unión de conversión, para que no quede el glifo "C90"/tee
// persistido por código viejo. El codo de SEGMENTOS (arco) que sí se quiere se asigna DESPUÉS,
// por resolveGuideJunctionAccessory, en el handler del botón.
function scrubGuideJunctionAccessories(eng: PlanoEngine, pt: [number, number]): void {
  const TOL = 0.5;
  for (const r of eng.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    if (Math.hypot(r.pts[0][0] - pt[0], r.pts[0][1] - pt[1]) < TOL) r.accesorioInicio = '';
    if (Math.hypot(r.pts[r.pts.length - 1][0] - pt[0], r.pts[r.pts.length - 1][1] - pt[1]) < TOL)
      r.accesorioFin = '';
  }
}

// El usuario pidió "eliminar cualquier símbolo de accesorio" — pero matizó: el disco "C90" no,
// el símbolo de SEGMENTOS (arco 90°) sí. En la conversión de guía a tributario/ramal con esquina
// en L, la unión se resuelve sin modal: se escribe el codo de plano (codo90rm/codos_90_std /
// codo45/codos_45) en el extremo del ramal que forma la esquina, y el render dibuja el arco.
// Una tee geométrica (3 brazos, p. ej. el botón plural) no recibe codo — se queda con su tick.
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
