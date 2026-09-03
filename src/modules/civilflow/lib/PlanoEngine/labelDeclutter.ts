import type { IPlanoEngineCore } from './PlanoState';
import { rotatedRectCorners } from './HitTester';

// Auto-orden de etiquetas: separa las etiquetas de ramal que nunca se movieron a mano
// cuando sus cajas colisionan entre sí o con trazos. Las etiquetas manuales (labelMoved)
// nunca se mueven y actúan como obstáculos fijos. Todo en px de canvas (mismo espacio que
// _labelBox); el caller convierte el centro elegido de vuelta a plano para labelX/labelY.

export interface DeclutterBox {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DeclutterSeg {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DeclutterFrame {
  placed: DeclutterBox[];
  segs: DeclutterSeg[];
}

// Aire entre cajas para no dejarlas pegadas.
const PAD = 2;
// Anillos y direcciones de la espiral de búsqueda (centros candidatos en px canvas).
const RINGS = 6;
const DIRS = 8;

function aabbsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
  pad: number,
): boolean {
  return (
    a.minX - pad < b.maxX && a.maxX + pad > b.minX && a.minY - pad < b.maxY && a.maxY + pad > b.minY
  );
}

// Intersección segmento vs AABB (slab), con la caja expandida por pad.
function segHitsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  box: { minX: number; minY: number; maxX: number; maxY: number },
  pad: number,
): boolean {
  const minX = box.minX - pad;
  const minY = box.minY - pad;
  const maxX = box.maxX + pad;
  const maxY = box.maxY + pad;
  const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  if (inside(x1, y1) || inside(x2, y2)) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    let t1 = (minX - x1) / dx;
    let t2 = (maxX - x1) / dx;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < minY || y1 > maxY) return false;
  } else {
    let t1 = (minY - y1) / dy;
    let t2 = (maxY - y1) / dy;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function boxFree(
  selfId: string,
  box: { minX: number; minY: number; maxX: number; maxY: number },
  placed: DeclutterBox[],
  segs: DeclutterSeg[],
  selfCorners?: Array<{ x: number; y: number }>,
): boolean {
  for (const p of placed) {
    if (p.id === selfId) continue;
    if (aabbsOverlap(box, p, PAD)) return false;
  }
  for (const s of segs) {
    if (s.id !== selfId || !selfCorners) {
      if (s.id === selfId) continue;
      if (segHitsBox(s.x1, s.y1, s.x2, s.y2, box, PAD)) return false;
    } else if (segHitsPoly(s.x1, s.y1, s.x2, s.y2, selfCorners)) {
      // Trazo PROPIO: prueba precisa contra el rectángulo rotado — el AABB de una caja
      // rotada sobresale del rect y daría falso choque con el trazo paralelo (que pasa
      // limpio a gap del borde). Sin esto la etiqueta podía quedar pintada sobre su
      // propia tubería y nada la corregía.
      return false;
    }
  }
  return true;
}

function pointInPoly(x: number, y: number, poly: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segIntersectsSeg(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Intersección segmento vs rectángulo rotado (polígono convexo de 4 esquinas).
function segHitsPoly(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  poly: Array<{ x: number; y: number }>,
): boolean {
  if (pointInPoly(x1, y1, poly) || pointInPoly(x2, y2, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (segIntersectsSeg(x1, y1, x2, y2, a.x, a.y, b.x, b.y)) return true;
  }
  return false;
}

// Busca un centro libre para la caja (w×h, ángulo) empezando en el centro por defecto.
// Devuelve null si el sitio por defecto ya está libre o si no hay sitio en la espiral
// (en ambos casos el caller conserva la posición actual).
export function findFreeLabelCenter(
  selfId: string,
  boxW: number,
  boxH: number,
  angle: number,
  defCx: number,
  defCy: number,
  placed: DeclutterBox[],
  segs: DeclutterSeg[],
): { x: number; y: number } | null {
  const boxAt = (cx: number, cy: number) => {
    const r = rotatedRectCorners(cx, cy, boxW, boxH, angle);
    return { minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: r.maxY, corners: r.corners };
  };
  if (boxFree(selfId, boxAt(defCx, defCy), placed, segs, boxAt(defCx, defCy).corners)) return null;
  const step = Math.max(boxW, boxH) * 0.55;
  for (let ring = 1; ring <= RINGS; ring++) {
    const rad = ring * step;
    for (let k = 0; k < DIRS; k++) {
      const a = (k / DIRS) * Math.PI * 2 + ring * 0.35;
      const cx = defCx + Math.cos(a) * rad;
      const cy = defCy + Math.sin(a) * rad;
      const b = boxAt(cx, cy);
      if (boxFree(selfId, b, placed, segs, b.corners)) return { x: cx, y: cy };
    }
  }
  return null;
}

// Foto de obstáculos del frame: cajas manuales ya calculadas (frame anterior o este) +
// cajas de sifón + etiquetas de bajantes/áreas, y todos los segmentos de ramal visibles.
// Las cajas de etiquetas auto de ESTE frame las agrega el caller (renderRamales) a
// frame.placed a medida que dibuja, para que las siguientes las eviten.
export function beginDeclutterFrame(engine: IPlanoEngineCore): DeclutterFrame {
  const placed: DeclutterBox[] = [];
  const push = (
    id: string,
    b: { minX: number; minY: number; maxX: number; maxY: number } | undefined,
  ) => {
    if (b) placed.push({ id, minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY });
  };
  for (const r of engine.ramales) {
    if (engine._hiddenNets.has(r.net)) continue;
    if (r.labelMoved && r._labelBox) push(r.id, r._labelBox);
    if (r._sifonLabelBoxIni) push(`${r.id}:sifonIni`, r._sifonLabelBoxIni);
    if (r._sifonLabelBoxFin) push(`${r.id}:sifonFin`, r._sifonLabelBoxFin);
  }
  for (const b of engine.bajantes) {
    if (b.net && engine._hiddenNets.has(b.net)) continue;
    if (b._labelBox) push(b.id, b._labelBox);
  }
  for (const a of engine.areas) {
    if (a.net && engine._hiddenNets.has(a.net)) continue;
    if (a._labelBox) push(a.id, a._labelBox);
  }
  const segs: DeclutterSeg[] = [];
  for (const r of engine.ramales) {
    if (engine._hiddenNets.has(r.net)) continue;
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const p1 = engine.toCvs(r.pts[i][0], r.pts[i][1]);
      const p2 = engine.toCvs(r.pts[i + 1][0], r.pts[i + 1][1]);
      segs.push({ id: r.id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
  }
  return { placed, segs };
}
