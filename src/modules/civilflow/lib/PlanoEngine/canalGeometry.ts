import type { IPlanoEngineCore } from './PlanoState.ts';

/** Caja inclinada de un canal recolector de lluvias (ll): dónde arranca, cuánto mide de largo
 *  (longitud) y de ancho (base), en pixels de plano, y su inclinación. Sirve para responder
 *  "¿este punto cae dentro del canal?" aunque el canal esté torcido. */
export interface CanalOBB {
  x: number;
  y: number;
  w: number;
  h: number;
  angRad: number;
}

/** Calcula la caja (OBB) de un canal a partir de sus datos: si ya guarda ángulo lo respeta; si es
 *  de una versión vieja, lo reconstruye. Es LA medida única que usan motor y tablas de lluvias
 *  (si cada uno calculara distinto, el mismo canal daría resultados distintos). */
export function canalMarco(
  pxPerCm: number,
  c: {
    x?: number;
    y?: number;
    longitud?: number;
    base?: number;
    angulo?: number;
    _canalFlowDir?: 'derecha' | 'izquierda' | 'abajo' | 'arriba';
  },
): CanalOBB {
  const ox = c.x ?? 0;
  const oy = c.y ?? 0;
  const w0 = Math.max(0, (c.longitud || 0) * pxPerCm);
  const h0 = Math.max(0, (c.base || 0) * pxPerCm);
  if (c.angulo != null) return { x: ox, y: oy, w: w0, h: h0, angRad: (c.angulo * Math.PI) / 180 };
  const dir = c._canalFlowDir;
  if (dir === 'izquierda') return { x: ox + w0, y: oy + h0, w: w0, h: h0, angRad: Math.PI };
  if (dir === 'arriba') return { x: ox, y: oy + h0, w: h0, h: w0, angRad: -Math.PI / 2 };
  if (dir === 'abajo' || h0 > w0 + 1e-9)
    return { x: ox + w0, y: oy, w: h0, h: w0, angRad: Math.PI / 2 };
  return { x: ox, y: oy, w: w0, h: h0, angRad: 0 };
}

/** OBB puro (sin engine) desde un doc de storage + px por cm: lo usan las tablas de
 *  lluvias que leen pisos no cargados. */
export function canalOBBDe(
  pxPerCm: number,
  c: { x?: number; y?: number; longitud?: number; base?: number; angulo?: number },
): CanalOBB {
  return canalMarco(pxPerCm, c);
}

/** Pasa un punto del plano al "mundo del canal": como si el canal fuera horizontal desde su
 *  origen, midiendo a lo largo (lx) y a lo ancho (ly). Es la base de todos los tests de
 *  dentro/fuera. */
export function canalToLocal(obb: CanalOBB, px: number, py: number): { lx: number; ly: number } {
  const dx = px - obb.x;
  const dy = py - obb.y;
  const c = Math.cos(obb.angRad);
  const s = Math.sin(obb.angRad);
  return { lx: dx * c + dy * s, ly: -dx * s + dy * c };
}

/** Devuelve al plano real un punto que estaba en el "mundo del canal" (la inversa de
 *  canalToLocal). */
export function canalToWorld(obb: CanalOBB, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(obb.angRad);
  const s = Math.sin(obb.angRad);
  return { x: obb.x + lx * c - ly * s, y: obb.y + lx * s + ly * c };
}

/** ¿Este punto cae dentro del canal (con un margen pad, en pixels de plano)? Es lo que decide si
 *  un ramal de lluvias toca el canal. */
export function puntoEnCanalOBB(obb: CanalOBB, px: number, py: number, pad = 0): boolean {
  const { lx, ly } = canalToLocal(obb, px, py);
  return lx >= -pad && lx <= obb.w + pad && ly >= -pad && ly <= obb.h + pad;
}

/** Distancia en px de plano de un punto al OBB (0 si está dentro). */
export function distPuntoACanalOBB(obb: CanalOBB, px: number, py: number): number {
  const { lx, ly } = canalToLocal(obb, px, py);
  const dx = lx < 0 ? -lx : lx > obb.w ? lx - obb.w : 0;
  const dy = ly < 0 ? -ly : ly > obb.h ? ly - obb.h : 0;
  return Math.hypot(dx, dy);
}

/** Las 4 esquinas del canal llevadas al plano real (para dibujarlo o hacerle hit-test). */
export function esquinasCanalOBB(obb: CanalOBB): Array<{ x: number; y: number }> {
  return [
    canalToWorld(obb, 0, 0),
    canalToWorld(obb, obb.w, 0),
    canalToWorld(obb, obb.w, obb.h),
    canalToWorld(obb, 0, obb.h),
  ];
}

/** OBB de un canal vivo del engine (dims en cm → px de plano). */
export function canalOBBEngine(
  engine: IPlanoEngineCore,
  canal: {
    x?: number;
    y?: number;
    longitud?: number;
    base?: number;
    angulo?: number;
    _canalFlowDir?: 'derecha' | 'izquierda' | 'abajo' | 'arriba';
  },
): CanalOBB {
  return canalMarco(engine.cmToPlanePx(1), canal);
}

/** Cuántos pixels de plano mide 1 cm real (sale de la escala scaleM del proyecto). Lanza error si
 *  la escala es inválida: sin este número todo el módulo de canales mediría cualquier cosa. */
export function pxPerCmDe(engine: { cmToPlanePx(cm: number): number }): number {
  const v = engine.cmToPlanePx(1);
  if (!(v > 0)) throw new Error('escala_invalida');
  return v;
}

/** Deja el ancho (base) siempre en el lado CORTO y el largo en el lado largo: si el canal quedó
 *  "atravesado" (más ancho que largo), lo gira -90° para que las fórmulas de lluvias cuadren. */
export function normalizarCanal(
  pxPerCm: number,
  c: { x: number; y: number; longitud?: number; base?: number; angulo?: number },
): boolean {
  const w = c.longitud || 0;
  const h = c.base || 0;
  if (h <= w + 1e-9) {
    if (c.angulo == null) {
      c.angulo = 0;
      return true;
    }
    return false;
  }
  const a = c.angulo ?? 0;
  const rad = (a * Math.PI) / 180;
  const hPx = h * pxPerCm;
  c.x = c.x + -Math.sin(rad) * hPx;
  c.y = c.y + Math.cos(rad) * hPx;
  c.longitud = h;
  c.base = w;
  c.angulo = a - 90;
  return true;
}

/** Normaliza grados a (-180, 180]. */
export function norm180(deg: number): number {
  const m = (((deg + 180) % 360) + 360) % 360;
  return m - 180;
}

/** Un canal se dibuja en 3 clics: 1º el origen, 2º marca el eje (largo y dirección), 3º el ancho.
 *  Esto es lo que queda de la fase 1 (el largo en cm y el ángulo del eje). */
export interface TrazoCanalEje {
  longitudCm: number;
  angulo: number;
  p2: { x: number; y: number };
}

/** Traduce los 2 primeros clics del canal a largo (cm) y ángulo, con imán a horizontal/vertical si
 *  el usuario traza cerca (±15°): así los canales quedan rectos aunque el pulso tiemble. */
export function geometriaCanalDesdePuntos(
  s: { x: number; y: number },
  p: { x: number; y: number },
  pxToM: (d: number) => number,
): TrazoCanalEje | null {
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  if (Math.hypot(dx, dy) < 1e-9) return null;
  const axDeg0 = (Math.atan2(dy, dx) * 180) / Math.PI;
  let axDeg = axDeg0;
  let p2 = { x: p.x, y: p.y };
  let bestOff = Infinity;
  let bestK = 0;
  for (const k of [0, 90, 180, 270]) {
    const off = Math.abs(norm180(axDeg0 - k));
    if (off < bestOff) {
      bestOff = off;
      bestK = k;
    }
  }
  if (bestOff <= 15) {
    const t = bestOff / 15;
    const w = 1 - t * t * (3 - 2 * t);
    axDeg = bestK + (1 - w) * norm180(axDeg0 - bestK);
    const rad = (axDeg * Math.PI) / 180;
    const proj = dx * Math.cos(rad) + dy * Math.sin(rad);
    p2 = { x: s.x + Math.cos(rad) * proj, y: s.y + Math.sin(rad) * proj };
  }
  const longitudCm = +(pxToM(Math.hypot(p2.x - s.x, p2.y - s.y)) * 100).toFixed(1);
  if (longitudCm < 1) return null;
  return { longitudCm, angulo: norm180(axDeg), p2 };
}

/** El canal completo, ya con su ancho (3er clic): origen, ancho, largo, ángulo y hacia dónde
 *  fluye el agua (para la flechita). */
export interface TrazoCanal {
  x: number;
  y: number;
  baseCm: number;
  longitudCm: number;
  angulo: number;
  flujo: 'derecha' | 'izquierda' | 'abajo' | 'arriba';
}

export function geometriaCanalAncho(
  eje: { x1: number; y1: number; x2: number; y2: number },
  p: { x: number; y: number },
  pxToM: (d: number) => number,
  pxPerCm: number,
): TrazoCanal | null {
  const dx = eje.x2 - eje.x1;
  const dy = eje.y2 - eje.y1;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return null;
  const axDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const t = ((p.x - eje.x1) * dx + (p.y - eje.y1) * dy) / (L * L);
  const x2e = t > 1 ? eje.x1 + dx * t : eje.x2;
  const y2e = t > 1 ? eje.y1 + dy * t : eje.y2;
  const Le = Math.hypot(x2e - eje.x1, y2e - eje.y1);
  const cross = dx * (p.y - eje.y1) - dy * (p.x - eje.x1);
  const distPx = Math.abs(cross) / L;
  const baseCm = Math.max(1, +(pxToM(distPx) * 100).toFixed(1));
  const longitudCm = +(pxToM(Le) * 100).toFixed(1);
  if (longitudCm < 1) return null;
  let ox = eje.x1;
  let oy = eje.y1;
  if (cross < 0) {
    const rad = (axDeg * Math.PI) / 180;
    const wPx = baseCm * pxPerCm;
    ox = eje.x1 + Math.sin(rad) * wPx;
    oy = eje.y1 - Math.cos(rad) * wPx;
  }
  const c = Math.cos((axDeg * Math.PI) / 180);
  const sn = Math.sin((axDeg * Math.PI) / 180);
  return {
    x: ox,
    y: oy,
    baseCm,
    longitudCm,
    angulo: norm180(axDeg),
    flujo:
      Math.abs(c) >= Math.abs(sn) ? (c > 0 ? 'derecha' : 'izquierda') : sn > 0 ? 'abajo' : 'arriba',
  };
}

/** Un canal más angosto que 20 cm no es realista: se rechaza el trazo. */
export const CANAL_ANCHO_MIN_CM = 20;

/** Si el 3er clic cae casi sobre el eje (menos de 20 cm y menos de 6 px), empuja el ancho al
 *  mínimo. La vista previa y el canal final usan LA MISMA regla, así que lo que se ve al dibujar
 *  es exactamente lo que queda. */
export function puntoAnchoMinimo(
  eje: { x1: number; y1: number; x2: number; y2: number },
  p: { x: number; y: number },
  pxPerCm: number,
): { x: number; y: number } {
  const dx = eje.x2 - eje.x1;
  const dy = eje.y2 - eje.y1;
  const L = Math.hypot(dx, dy);
  if (!(L > 0)) return p;
  const cross = dx * (p.y - eje.y1) - dy * (p.x - eje.x1);
  const dist = Math.abs(cross) / L;
  const minPx = CANAL_ANCHO_MIN_CM * pxPerCm;
  if (!(dist < minPx && dist < 6)) return p;
  const sgn = cross >= 0 ? 1 : -1;
  const nx = (-dy / L) * sgn;
  const ny = (dx / L) * sgn;
  const t = ((p.x - eje.x1) * dx + (p.y - eje.y1) * dy) / (L * L);
  const fx = eje.x1 + dx * t;
  const fy = eje.y1 + dy * t;
  return { x: fx + nx * minPx, y: fy + ny * minPx };
}

/** Arregla al cargar los canales guardados por versiones viejas (sin ángulo): deduce el ángulo
 *  real y reordena ancho/largo para que el rectángulo mire hacia donde debe. */
export function sanearCanalLegacy(
  pxPerCm: number,
  c: {
    x: number;
    y: number;
    longitud?: number;
    base?: number;
    angulo?: number;
    _canalFlowDir?: 'derecha' | 'izquierda' | 'abajo' | 'arriba';
  },
): boolean {
  if (c.angulo != null) return normalizarCanal(pxPerCm, c);
  const wCm = c.longitud || 0;
  const hCm = c.base || 0;
  const dir = c._canalFlowDir;
  if (dir === 'izquierda' && hCm <= wCm + 1e-9) {
    c.x += wCm * pxPerCm;
    c.y += hCm * pxPerCm;
    c.angulo = 180;
    normalizarCanal(pxPerCm, c);
    return true;
  }
  if (dir === 'izquierda') {
    c.x += wCm * pxPerCm;
    c.longitud = hCm;
    c.base = wCm;
    c.angulo = 90;
    return true;
  }
  if (dir === 'arriba' || dir === 'abajo' || hCm > wCm + 1e-9) {
    if (dir === 'arriba') c.y += hCm * pxPerCm;
    else c.x += wCm * pxPerCm;
    c.longitud = hCm;
    c.base = wCm;
    c.angulo = dir === 'arriba' ? -90 : 90;
    normalizarCanal(pxPerCm, c);
    return true;
  }
  c.angulo = 0;
  return true;
}

/** Si un ramal de lluvias (ll) toca la boca de un canal pero perdió su marca esCanalId, la
 *  reconstruye: así sigue contándose como ramal de canal y no como uno más de diseño.
 *  @returns cuántos ramales se repararon. */
export function sanearEsCanalIdFaltante(
  pxPerCm: number,
  ramales: Array<{
    id?: string;
    net?: string;
    tipo?: string;
    pts?: number[][];
    esCanalId?: string | null;
  }>,
  canales: Array<{
    id?: string;
    x?: number;
    y?: number;
    longitud?: number;
    base?: number;
    angulo?: number;
  }>,
): number {
  const obbs = canales
    .filter((c) => c.id != null && c.x != null && c.y != null)
    .map((c) => ({ id: String(c.id), obb: canalOBBDe(pxPerCm, c as { x: number; y: number }) }));
  if (obbs.length === 0) return 0;
  let n = 0;
  for (const r of ramales || []) {
    if (r.net !== 'll' || r.esCanalId || !r.pts || r.pts.length < 2) continue;
    const p0 = r.pts[0];
    const p1 = r.pts[r.pts.length - 1];
    if (!p0 || !p1) continue;
    for (const { id, obb } of obbs) {
      const boca = (px: number, py: number): boolean => {
        const { lx, ly } = canalToLocal(obb, px, py);
        const pad = 0;
        const enBanda = (lx >= -pad && lx <= pad) || (lx >= obb.w - pad && lx <= obb.w + pad);
        return enBanda && ly >= -pad && ly <= obb.h + pad;
      };
      const b0 = boca(p0[0], p0[1]);
      const b1 = boca(p1[0], p1[1]);
      if ((b0 || b1) && !(b0 && b1)) {
        r.esCanalId = id;
        n++;
        break;
      }
    }
  }
  return n;
}
