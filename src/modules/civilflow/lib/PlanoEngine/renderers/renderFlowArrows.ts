import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState.ts';
import { indiceFrame } from './frameIndex.ts';

/** Flechas de sentido de flujo: junto a la etiqueta del ramal y en los extremos que descargan (con reglas propias para vent↔san). */

type RamalRender = IPlanoEngineCore['ramales'][number];

/** Contexto del frame que el pase de flechas de extremo necesita (índices ya construidos
 *  en renderRamales — no se reconstruyen por ramal). */
export interface FrameFlechas {
  ventRamales: RamalRender[];
  hayPuntoSanCercano: (x: number, y: number) => boolean;
  bajantesSan: IPlanoEngineCore['bajantes'];
}

interface LabelFlowArgs {
  engine: IPlanoEngineCore;
  r: RamalRender;
  col: string;
  showFlow: boolean;
  flowDx: number;
  flowDy: number;
  flowLen: number;
  cosA: number;
  sinA: number;
  nameW: number;
  labelGap: number;
  labelClear: number;
  drawX: number;
  drawY: number;
  boxH: number;
}

/**
 * Segmentos del ramal en coordenadas de PLANO, cacheados por (firma, ramal): antes se
 * reconstruía un segsCanvas (toCvs por punto) por ramal etiquetado y por frame — GC churn
 * puro en paneo. Las tuplas REFERENCIAN los arrays de pts (cero copia de coordenadas).
 * La firma viene del frame abierto (indiceFrame) — drag muta pts, la firma cambia y el
 * cache se reconstruye solo.
 */
const segsPlanoMemo = new WeakMap<
  object,
  { firma: number; porRamal: Map<unknown, Array<[number[], number[]]>> }
>();

function segsPlanoDe(
  engine: IPlanoEngineCore,
  r: RamalRender,
  firma: number,
): Array<[number[], number[]]> {
  let memo = segsPlanoMemo.get(engine as object);
  if (!memo || memo.firma !== firma) {
    memo = { firma, porRamal: new Map() };
    segsPlanoMemo.set(engine as object, memo);
  }
  const hit = memo.porRamal.get(r);
  if (hit) return hit;
  const pts = r.pts || [];
  const segs: Array<[number[], number[]]> = [];
  for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
  memo.porRamal.set(r, segs);
  return segs;
}

/**
 * Flecha de flujo anclada a la etiqueta del ramal (local +h/2, banda caja↔trazo).
 * La translate/rotate del label ya está aplicada al ctx: se dibuja en coordenadas locales
 * y el recorte contra el trazo se mide en PLANO (d_canvas = zoom·d_plano: recorte exacto
 * igual al histórico, sin convertir los segmentos a canvas por frame). Cero writes al engine.
 */
export function renderLabelFlowArrow(
  ctx: CanvasRenderingContext2D,
  {
    engine,
    r,
    col,
    showFlow,
    flowDx,
    flowDy,
    flowLen,
    cosA,
    sinA,
    nameW,
    labelGap,
    labelClear,
    drawX,
    drawY,
    boxH,
  }: LabelFlowArgs,
): void {
  if (
    !showFlow ||
    (r as unknown as { showFlowDir?: boolean }).showFlowDir === false ||
    !(flowLen > 12 * engine.zoom)
  )
    return;
  // Ítem 11a: la flecha apunta según el flujo real, no según el labelAngle. En coordenadas
  // locales del label el vector de flujo es (dot, perp); se dibuja a lo largo de él.
  const dot = flowDx * cosA + flowDy * sinA;
  const perp = -flowDx * sinA + flowDy * cosA;
  const len = Math.hypot(dot, perp) || 1;
  const ux = dot / len;
  const uy = perp / len;
  const halfSize = nameW ? nameW / 2 : 12 * engine.zoom;
  // Margen de recorte en UNIDADES DE PLANO (3·zoom px / zoom = 3 — idéntico al histórico).
  const margin = 3;
  const segs = segsPlanoDe(engine, r, indiceFrame(engine).firma);
  const distToRamal = (px: number, py: number): number => {
    let d = Infinity;
    for (const [a, b] of segs) {
      const vx = b[0] - a[0];
      const vy = b[1] - a[1];
      const l2 = vx * vx + vy * vy;
      const t2 =
        l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / l2));
      d = Math.min(d, Math.hypot(px - (a[0] + t2 * vx), py - (a[1] + t2 * vy)));
    }
    return d;
  };
  // Dibuja la flecha anclada al lado `side` de la caja (1 = banda entre caja y trazo,
  // −1 = lado opuesto). Devuelve false si el recorte la agotó. La banda restringe t·uy:
  // lado del trazo → entre el borde de caja y la tubería; lado opuesto → solo despejar
  // la caja (el recorte contra el trazo lo hace distToRamal más abajo).
  const drawFlowArrow = (side: 1 | -1): boolean => {
    const anchorY = side * (boxH / 2 + 2 * engine.zoom);
    const arrowPt = (t: number): [number, number] => {
      const lx = t * ux;
      const ly = labelGap + anchorY + t * uy;
      return [drawX + lx * cosA - ly * sinA, drawY + lx * sinA + ly * cosA];
    };
    const bandLo = side === 1 ? -1 * engine.zoom : -1e6;
    const bandHi = side === 1 ? labelClear - 4 * engine.zoom : 1 * engine.zoom;
    let tMin = -halfSize;
    let tMax = halfSize;
    if (uy > 1e-3) {
      tMin = Math.max(tMin, bandLo / uy);
      tMax = Math.min(tMax, bandHi / uy);
    } else if (uy < -1e-3) {
      tMin = Math.max(tMin, bandHi / uy);
      tMax = Math.min(tMax, bandLo / uy);
    }
    // Recorte geométrico: los extremos de la flecha se miden (en PLANO) contra la
    // polilínea del propio ramal y el lado que invade el margen se acorta por
    // iteraciones hasta despejar o agotar la flecha.
    const alPlano = (t: number): [number, number] => {
      const p = arrowPt(t);
      const w = engine.toPlane(p[0], p[1]);
      return [w.x, w.y];
    };
    for (let it = 0; it < 24 && tMax - tMin >= 4 * engine.zoom; it++) {
      const tailD = distToRamal(...alPlano(tMin));
      const tipD = distToRamal(...alPlano(tMax));
      // Punto medio: una esquina del trazo puede atravesar la flecha por el centro con
      // ambos extremos despejados.
      const midD = distToRamal(...alPlano((tMin + tMax) / 2));
      const span = tMax - tMin;
      if (tailD >= margin && tipD >= margin && midD >= margin) break;
      if (midD < margin || (tailD < margin && tipD < margin)) {
        // Acortar simétricamente conservando el tramo central.
        tMin += span * 0.2;
        tMax -= span * 0.2;
      } else if (tailD < margin) {
        tMin += span * 0.2;
      } else {
        tMax -= span * 0.2;
      }
    }
    if (tMax - tMin < 4 * engine.zoom) return false;
    ctx.save();
    ctx.translate(0, anchorY);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tMin * ux, tMin * uy);
    ctx.lineTo(tMax * ux, tMax * uy);
    ctx.stroke();
    const aSize = Math.min(6 * engine.zoom, (tMax - tMin) * 0.4);
    ctx.fillStyle = col;
    ctx.beginPath();
    const tipX = tMax * ux;
    const tipY = tMax * uy;
    const baseX = tipX - ux * aSize;
    const baseY = tipY - uy * aSize;
    const perpX = -uy;
    const perpY = ux;
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX + perpX * aSize * 0.4, baseY + perpY * aSize * 0.4);
    ctx.lineTo(baseX - perpX * aSize * 0.4, baseY - perpY * aSize * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return true;
  };
  // Abajo (banda caja-trazo); si el trazo —p. ej. en diagonal bajo una etiqueta
  // horizontal— la agota, se reintenta ENCIMA de la caja: siempre visible, nunca bajo
  // el trazo (orig. usuario: RS5 sin flecha de flujo).
  if (!drawFlowArrow(1)) drawFlowArrow(-1);
}

/**
 * Flechas amarillas de dirección en los EXTREMOS del ramal seleccionado: desvío entre
 * pisos (Ldesvio), codo reventilado vent↔san, bajante receptor san y vent por posición.
 * La dirección se resuelve por índices startIdx/nextIdx y se dibuja una sola punta.
 * Cero writes al engine.
 */
export function renderEndpointFlowArrows(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  r: RamalRender,
  frame: FrameFlechas,
): void {
  const { ventRamales, hayPuntoSanCercano, bajantesSan } = frame;
  if (!(r.pts.length >= 2 && (r.id === engine.selId || (engine.multiSel || []).includes(r.id))))
    return;
  let desvioBajante: PlanoBajante | null = null;
  const isDesvio = engine.bajantes.some((b) => {
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    if (!disp || disp.Ldesvio !== r.id) return false;
    const gx = b.x + (disp.dx || 0),
      gy = b.y + (disp.dy || 0);
    const firstPt = r.pts[0],
      lastPt = r.pts[r.pts.length - 1];
    const nearParent = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
    const nearGhost = Math.hypot(lastPt[0] - gx, lastPt[1] - gy) < 0.5;
    if (nearParent && nearGhost) {
      desvioBajante = b;
      return true;
    }
    return false;
  });

  if (isDesvio && desvioBajante) {
    const baj: PlanoBajante = desvioBajante;
    const firstPt = r.pts[0];

    let startIdx = 0,
      nextIdx = 1;

    const firstIsParent = Math.hypot(firstPt[0] - baj.x, firstPt[1] - baj.y) < 0.5;
    // La punta de flecha va SIEMPRE sobre el extremo cuyo bajante tiene dirección 'baja' — no
    // siempre el mismo lado, porque el bajante padre (source) puede ser 'sube' o 'baja' según
    // en qué piso quede el otro extremo de la asociación (ver applyBajanteAssociation). Mismo
    // criterio que el indicador de flujo permanente más arriba.
    const parentIdx = firstIsParent ? 0 : r.pts.length - 1;
    const otherIdx = firstIsParent ? r.pts.length - 1 : 0;
    if (baj.direccion === 'baja') {
      startIdx = parentIdx;
      nextIdx = otherIdx;
    } else {
      startIdx = otherIdx;
      nextIdx = parentIdx;
    }

    const firstC = engine.toCvs(r.pts[startIdx][0], r.pts[startIdx][1]);
    const secondC = engine.toCvs(r.pts[nextIdx][0], r.pts[nextIdx][1]);
    const adx = secondC.x - firstC.x,
      ady = secondC.y - firstC.y;
    const alen = Math.hypot(adx, ady);

    if (alen > 2) {
      const unx = adx / alen,
        uny = ady / alen;
      const arrowR = 10 * engine.zoom;
      const cx = firstC.x;
      const cy = firstC.y;
      ctx.save();
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom * (engine.lineWidthScale || 1);
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - unx * arrowR + uny * arrowR * 0.4, cy - uny * arrowR - unx * arrowR * 0.4);
      ctx.lineTo(cx - unx * arrowR - uny * arrowR * 0.4, cy - uny * arrowR + unx * arrowR * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else {
    let startIdx = 0;
    let nextIdx = 1;

    if (r._tribReversed && (r.tipo === 'tributario' || ['af', 'ac', 'gas'].includes(r.net))) {
      startIdx = r.pts.length - 1;
      nextIdx = r.pts.length - 2;
    }

    let isCodoReventiladoConnection = false;
    let codoEndIdx = -1;

    if (r.net === 'vent' || r.net === 'san') {
      for (const vr of ventRamales) {
        for (const idx of [0, vr.pts.length - 1]) {
          const pt = vr.pts[idx];
          // ¿Hay un punto de la red sanitaria a menos de 0.5? Índice por celda: O(1)
          // en vez de recorrer todos los puntos de todos los ramales san en cada frame.
          const connectsToSan = hayPuntoSanCercano(pt[0], pt[1]);
          if (connectsToSan) {
            const rEndIdx = [0, r.pts.length - 1].find(
              (eIdx) => Math.hypot(r.pts[eIdx][0] - pt[0], r.pts[eIdx][1] - pt[1]) < 0.5,
            );
            if (rEndIdx !== undefined) {
              isCodoReventiladoConnection = true;
              codoEndIdx = rEndIdx;
              break;
            }
          }
        }
        if (isCodoReventiladoConnection) break;
      }
    }

    if (r.net === 'san' && !isCodoReventiladoConnection) {
      for (const b of bajantesSan) {
        if (!b.recibeDeIds?.includes(r.id)) continue;
        const firstPt = r.pts[0];
        const lastPt = r.pts[r.pts.length - 1];
        const bajanteNearFirst = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
        const bajanteNearLast = Math.hypot(lastPt[0] - b.x, lastPt[1] - b.y) < 0.5;
        if (bajanteNearFirst) {
          startIdx = r.pts.length - 1;
          nextIdx = r.pts.length - 2;
        } else if (bajanteNearLast) {
          startIdx = 0;
          nextIdx = 1;
        }
        break;
      }
    }

    if (isCodoReventiladoConnection && codoEndIdx !== -1) {
      startIdx = codoEndIdx === 0 ? r.pts.length - 1 : 0;
      nextIdx = startIdx === 0 ? 1 : r.pts.length - 2;
    } else if (r.net === 'vent' && r.pts[r.pts.length - 1][0] < r.pts[0][0]) {
      startIdx = r.pts.length - 1;
      nextIdx = r.pts.length - 2;
    }

    const firstC = engine.toCvs(r.pts[startIdx][0], r.pts[startIdx][1]);
    const secondC = engine.toCvs(r.pts[nextIdx][0], r.pts[nextIdx][1]);
    const adx = secondC.x - firstC.x,
      ady = secondC.y - firstC.y;
    const alen = Math.hypot(adx, ady);
    if (alen > 2) {
      const unx = adx / alen,
        uny = ady / alen;
      const arrowR = 10 * engine.zoom;
      const cx = firstC.x;
      const cy = firstC.y;
      ctx.save();
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom * (engine.lineWidthScale || 1);
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - unx * arrowR + uny * arrowR * 0.4, cy - uny * arrowR - unx * arrowR * 0.4);
      ctx.lineTo(cx - unx * arrowR - uny * arrowR * 0.4, cy - uny * arrowR + unx * arrowR * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
