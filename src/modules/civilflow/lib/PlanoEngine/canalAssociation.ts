import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from './PlanoState';

/**
 * Calcula si un clic (x, y) toca este bajante y qué tan cerca está del símbolo.
 * Devuelve Infinity si no tocó nada, o 1 si acertó. El canal de lluvias se clickea sobre
 * su rectángulo visible (no sobre el círculo de los demás tipos) porque ese círculo,
 * calculado con la diagonal, quedaba mucho más grande que el dibujo.
 */
/** ¿El clic cayó dentro del rectángulo del canal? Devuelve 1 si sí, Infinity si no; padPx
 *  agranda el rectángulo unos píxeles para que sea más fácil de acertar. */
export function canalRectHitDistance(b: PlanoBajante, x: number, y: number, padPx = 0): number {
  const box = b._canalBox;
  if (!box) return Infinity;
  if (
    x < box.x - padPx ||
    x > box.x + box.w + padPx ||
    y < box.y - padPx ||
    y > box.y + box.h + padPx
  )
    return Infinity;
  return 1;
}

export function bajanteHitDistance(b: PlanoBajante, x: number, y: number): number {
  if (b.tipo === 'canal') {
    const box = b._canalBox;
    if (!box) return Infinity;
    const scale = 1.1;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const hw = (box.w * scale) / 2;
    const hh = (box.h * scale) / 2;
    if (x < cx - hw || x > cx + hw || y < cy - hh || y > cy + hh) return Infinity;
    // Ojo con el tamaño: un canal puede ser mucho más largo que los ~50px que los callers usan
    // como "distancia máxima para elegir el símbolo más cercano". Si devolviéramos la distancia
    // real al centro, un canal largo quedaría "lejísimo" aunque el clic esté encima. Como
    // ya sabemos que el clic está DENTRO del canal, devolvemos 1 (un número chico fijo) — eso
    // basta para que gane la comparación de cercanía.
    return 1;
  }
  if (!b._circ) return Infinity;
  const d = Math.hypot(x - b._circ.x, y - b._circ.y);
  return d < b._circ.r ? d : Infinity;
}

// Asociación explícita bajante→canal por ID (b.canalId), NO por posición geométrica. Un bajante
// asociado es parte de la geometría del canal: no se selecciona ni arrastra por sí mismo — todo
// clic sobre él (cuerpo, etiqueta o fantasma) se redirige al canal, que al moverse lo lleva con
// sus asociados. Incluye fantasmas entre pisos: los clones heredan canalId del padre.
export function bajanteAsociadoACanal(b: { tipo?: string; canalId?: string | null }): boolean {
  return b.tipo === 'bajante' && !!b.canalId;
}

/** Rectángulo orientado del canal en px de plano: origen + dims locales + ángulo. El eje
 *  local X es SIEMPRE el lado largo (longitud); el Y, el corto (base). Con angulo 0 es el
 *  AABB de siempre. */
interface CanalOBB {
  x: number;
  y: number;
  w: number;
  h: number;
  angRad: number;
}

/** Marco efectivo del canal: con `angulo` lo respeta; sin él (legacy) reconstruye el
 *  marco desde `_canalFlowDir` (izquierda→180, arriba→-90, abajo→90, resto→0) o, sin
 *  flowDir, desde la forma (base>longitud→90). En todos los casos el rectángulo mundo es
 *  el AABB clásico. Una sola verdad para motor y tablas. */
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
  // Orígenes elegidos para que el conjunto mundo coincida con el AABB clásico en cada caso
  // (verificado esquina por esquina: 180° ancla abajo-derecha, ±90° arriba/abajo-derecha).
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

/** Lleva un punto mundo al marco local del canal (origen + rotación inversa). */
export function canalToLocal(obb: CanalOBB, px: number, py: number): { lx: number; ly: number } {
  const dx = px - obb.x;
  const dy = py - obb.y;
  const c = Math.cos(obb.angRad);
  const s = Math.sin(obb.angRad);
  return { lx: dx * c + dy * s, ly: -dx * s + dy * c };
}

/** Lleva un punto del marco local al mundo (origen + rotación). */
function canalToWorld(obb: CanalOBB, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(obb.angRad);
  const s = Math.sin(obb.angRad);
  return { x: obb.x + lx * c - ly * s, y: obb.y + lx * s + ly * c };
}

/** ¿El punto mundo cae dentro del OBB (pad en px de plano)? */
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

/** Las 4 esquinas mundo del OBB, en orden (0,0)-(w,0)-(w,h)-(0,h) del marco local. */
export function esquinasCanalOBB(obb: CanalOBB): Array<{ x: number; y: number }> {
  return [
    canalToWorld(obb, 0, 0),
    canalToWorld(obb, obb.w, 0),
    canalToWorld(obb, obb.w, obb.h),
    canalToWorld(obb, 0, obb.h),
  ];
}

/** OBB de un canal vivo del engine (dims en cm → px de plano). */
function canalOBBEngine(engine: IPlanoEngineCore, canal: PlanoBajante): CanalOBB {
  return canalMarco(engine.cmToPlanePx(1), canal);
}

/** px de plano por cm según el engine — única fuente, derivada de cmToPlanePx (sin el
 *  toFixed de pxToM, que a 1 px redondeaba y desviaba ~1.8%: el re-ancla de normalizarCanal
 *  quedaba descuadrado respecto del render). Falla fuerte si la escala no es positiva. */
export function pxPerCmDe(engine: { cmToPlanePx(cm: number): number }): number {
  const v = engine.cmToPlanePx(1);
  if (!(v > 0)) throw new Error('escala_invalida');
  return v;
}

/** Normaliza base=LADO CORTO y longitud=LADO LARGO (ítem 5 usuario). Si el marco queda
 *  con h>w, rota -90° y re-ancla el origen (o' = o + R·(0,h)) para que el rectángulo
 *  mundo NO se mueva. Devuelve true si tocó algo. */

export function normalizarCanal(
  pxPerCm: number,
  c: { x: number; y: number; longitud?: number; base?: number; angulo?: number },
): boolean {
  const w = c.longitud || 0;
  const h = c.base || 0;
  if (h <= w + 1e-9) {
    // Ya normal (o degenerado): solo siembra angulo 0 si falta.
    if (c.angulo == null) {
      c.angulo = 0;
      return true;
    }
    return false;
  }
  // h>w: rota el marco -90° y re-ancla el origen con o' = o + R(A)·(0,h) para que el
  // rectángulo mundo quede idéntico (R(-90)·(u,v) = (v,-u): el eje largo pasa al X).
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

/** Fase 1 del canal (el 2º clic fija el eje): longitud/ángulo del eje + extremo ya ajustado.
 *  El ancho lo define el 3er clic con geometriaCanalAncho. */
interface TrazoCanalEje {
  /** Longitud del eje en cm. */
  longitudCm: number;
  angulo: number;
  /** Extremo del eje ajustado (= p, o su proyección al eje cardinal si roza ≤15°). */
  p2: { x: number; y: number };
}

/** Geometría de un canal desde 2 puntos del plano. La creación y el ghost comparten esta
 *  matemática: SIEMPRE modo eje (orig. usuario: horizontal/vertical también fijan el eje con
 *  el 2º clic y definen el ancho con un 3er clic, igual que en diagonal — el ancho ya no sale
 *  "de casualidad" del arrastre). Cerca de un cardinal (≤15°) hay IMÁN SUAVE (orig. usuario:
 *  el paso vertical/horizontal ↔ diagonal debe ser prácticamente inexistente): el ángulo se
 *  funde con el cardinal por smoothstep — continuo en el borde de 15° y casi exacto a ≤2°;
 *  en diagonal el ángulo es libre. Base siempre corta (ítem 5 usuario, al crear). */
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
    // Imán suave: w=1 pegado al cardinal → w=0 en 15° (smoothstep, sin salto en el borde).
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

/** Geometría del canal comprometida (fase de ancho, 3er clic): eje p1→p2 fijo, ancho =
 *  distancia perpendicular del punto al eje (mínimo 1cm, igual que el resize). El rectángulo
 *  va del lado del punto (origen desplazado) para que el clic caiga sobre el borde — sin
 *  cambios de lado a lado una vez comprometido (el ghost ya lo mostró). Devuelve null si el
 *  eje es degenerado. */
interface TrazoCanal {
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
  // ALARGAR EN VIVO (orig. usuario: no se podía alargar al crearlo): si el cursor proyecta
  // MÁS ALLÁ del extremo del eje (t > 1), el canal crece hasta ese pie — un solo gesto
  // define largo y ancho. El ancho sigue siendo la distancia perpendicular a la RECTA.
  const t = ((p.x - eje.x1) * dx + (p.y - eje.y1) * dy) / (L * L);
  const x2e = t > 1 ? eje.x1 + dx * t : eje.x2;
  const y2e = t > 1 ? eje.y1 + dy * t : eje.y2;
  const Le = Math.hypot(x2e - eje.x1, y2e - eje.y1);
  // Distancia perpendicular con signo: >0 = lado +Y local (mismo que el ancho provisional).
  const cross = dx * (p.y - eje.y1) - dy * (p.x - eje.x1);
  const distPx = Math.abs(cross) / L;
  const baseCm = Math.max(1, +(pxToM(distPx) * 100).toFixed(1));
  const longitudCm = +(pxToM(Le) * 100).toFixed(1);
  if (longitudCm < 1) return null;
  // Lado del punto: si cae en −Y, el origen se desplaza para que el rect quede de ese lado
  // con el mismo ángulo (o' = o + R·(0,−W), espejo de normalizarCanal).
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

/** Ancho mínimo útil del canal en cm: un clic a <6 px del eje (doble-clic de término, jitter)
 *  es accidental y se infla a este ancho en vez de crear un canal degenerado. ÚNICO umbral
 *  compartido por ghost (renderCanal) y commit (drawingCreations) — WYSIWYG. */
export const CANAL_ANCHO_MIN_CM = 20;

/** Guardarraíl del ancho compartido por ghost y commit (mismo criterio EXACTO): si el punto
 *  cae a <CANAL_ANCHO_MIN_CM cm Y <6 px del eje, se respeta su lado pero se aleja
 *  perpendicularmente al mismo pie de proyección hasta el ancho mínimo. Devuelve el MISMO
 *  objeto si no aplica (decidible por identidad). */
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
/** Sanado de carga para canales legacy (sin `angulo`, con base=Y y longitud=X): materializa
 *  el marco efectivo de canalMarco (flowDir manda; sin él, la forma) con el mismo rectángulo
 *  mundo, más base-corta vía normalizarCanal. Idempotente. */
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
    // Legacy inconsistente (h > w): con dims swapped el marco que preserva el AABB clásico
    // (x..x+w, y..y+h — verificado contra canalMarco: R90·(u,v)=(−v,u)) es angulo=90 con
    // o'=(x+w, y). normalizarCanal sería no-op tras el swap (base≤longitud ya cumple).
    c.x += wCm * pxPerCm;
    c.longitud = hCm;
    c.base = wCm;
    c.angulo = 90;
    return true;
  }
  if (dir === 'arriba' || dir === 'abajo' || hCm > wCm + 1e-9) {
    // Arriba (-90, origen abajo-izquierda) o abajo/vertical (+90, origen arriba-derecha);
    // en ambos el swap deja base-corta. (Un 'derecha' inconsistente con h>w cae aquí.)
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

/** Re-deriva `esCanalId` faltante (docs pre-migración, copias viejas): ramal ll con
 *  EXACTAMENTE un extremo dentro del OBB de un canal adopta su id — misma regla que
 *  detectarCanalEnExtremos al dibujar. Nunca pisa marcas existentes. Devuelve cuántos marcó. */
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
      // BOCA del canal solamente (ronda 9 C-2): el extremo cae en la banda del borde CORTO
      // del OBB — proyección local x en [-pad, pad] (boca origen) o [w-pad, w+pad] (boca
      // final). Inferir sobre cualquier punto del OBB marcaba colectores/LDs que pasan por
      // debajo del glifo y los borraba de las tablas de diseño en cada carga.
      const boca = (px: number, py: number): boolean => {
        const { lx, ly } = canalToLocal(obb, px, py);
        const pad = 0;
        const enBanda = (lx >= -pad && lx <= pad) || (lx >= obb.w - pad && lx <= obb.w + pad);
        return enBanda && ly >= -pad && ly <= obb.h + pad;
      };
      const b0 = boca(p0[0], p0[1]);
      const b1 = boca(p1[0], p1[1]);
      // Con los DOS extremos en la boca no hay marca (ambiguo — igual que al dibujar).
      if ((b0 || b1) && !(b0 && b1)) {
        r.esCanalId = id;
        n++;
        break;
      }
    }
  }
  return n;
}

/** ¿El punto (x, y) cae dentro del canal? */
function pointInCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): boolean {
  return puntoEnCanalOBB(canalOBBEngine(engine, canal), x, y);
}

/**
 * Busca el canal de lluvias que contiene el punto (x, y). Si el bajante ya estaba asociado
 * a un canal (`preferId`), se prefiere ese aunque se solape con otro: al arrastrar, el
 * bajante no "salta" de canal al pasar sobre un vecino. Sin asociación previa, se busca
 * cualquier canal que contenga el punto.
 */
export function resolveCanalForPoint(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  preferId?: string | null,
): PlanoBajante | null {
  if (preferId) {
    const preferred = engine.bajantes.find((c) => c.id === preferId && c.tipo === 'canal');
    if (preferred && pointInCanal(engine, preferred, x, y)) return preferred;
  }
  return (
    engine.bajantes.find(
      (c) => c.tipo === 'canal' && c.net === 'll' && pointInCanal(engine, c, x, y),
    ) || null
  );
}

/** Mueve el punto (x, y) hacia adentro del canal si quedó fuera de él — sirve para que el
 *  bajante nunca quede "colgado" medio por fuera del canal al arrastrarlo. */
function clampToCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): { x: number; y: number } {
  const obb = canalOBBEngine(engine, canal);
  const { lx, ly } = canalToLocal(obb, x, y);
  return canalToWorld(obb, Math.min(Math.max(lx, 0), obb.w), Math.min(Math.max(ly, 0), obb.h));
}

/**
 * Posiciona un bajante de lluvia dentro del canal y devuelve a qué canal quedó asociado.
 * Encuentra el canal del punto, recorta la posición para que quede dentro y devuelve el id
 * del canal (o null si quedó fuera de todo canal, desasociándolo). Se usa al crear y al
 * arrastrar un bajante.
 */
export function resolveAndClampToCanal(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  preferId?: string | null,
): { x: number; y: number; canalId: string | null } {
  const canal = resolveCanalForPoint(engine, x, y, preferId);
  if (!canal) return { x, y, canalId: null };
  const clamped = clampToCanal(engine, canal, x, y);
  return { ...clamped, canalId: canal.id };
}

// ===== Ramal de canal (orig. usuario: la asociación canal↔bajante vive SOLO en ramales que el
// usuario dibuja del canal al bajante; ninguna asociación es automática por cercanía) =====

/** Resultado de detectar el origen canal de un trazo recién dibujado. */
interface CanalOrigenDet {
  canal: PlanoBajante | null;
  /** El extremo que cayó dentro del canal es la LLEGADA (último punto) — hay que invertir la
   *  polilínea para que el flujo nazca en el canal (canal→bajante). */
  voltear: boolean;
}

/** Detecta si un trazo nace y/o termina dentro del rect de un canal. Con los DOS extremos
 *  dentro no hay marca (el usuario dibujó por dentro del canal: ambiguo). */
export function detectarCanalEnExtremos(engine: IPlanoEngineCore, pts: number[][]): CanalOrigenDet {
  if (!pts || pts.length < 2) return { canal: null, voltear: false };
  const p0 = pts[0];
  const p1 = pts[pts.length - 1];
  const c0 = resolveCanalForPoint(engine, p0[0], p0[1]);
  const c1 = resolveCanalForPoint(engine, p1[0], p1[1]);
  if (c0 && c1) return { canal: null, voltear: false };
  if (c0) return { canal: c0, voltear: false };
  if (c1) return { canal: c1, voltear: true };
  return { canal: null, voltear: false };
}

// Diámetro espejo eliminado (orig. usuario ronda 2): el ramal de canal nace con diámetro
// default 2" editable — ya no copia el dNominal del bajante.

/** Ramales de canal que nacen de este canal. */
export function ramalesDelCanal(engine: IPlanoEngineCore, canalId: string): PlanoRamal[] {
  return engine.ramales.filter((r) => r.esCanalId === canalId);
}

/** Sello automático canal↔bajante por ramal (orig. usuario): un ramal ll con un extremo
 *  dentro del OBB del canal y el otro sobre un bajante ll registra la asociación en los
 *  campos explícitos (b.canalId; esCanalId si nace del canal) para que menús y paneles la
 *  muestren sin marcar a mano. Solo SUMA (nunca limpia ni pisa un valor manual distinto:
 *  quitarla es mover el trazo), mismo criterio geométrico que las tablas (≤2). Corre tras
 *  autoDetect+poda en _markDirty/carga; nunca lanza (escala inválida = no-op). */
export function sellarAsociacionesCanalBajante(engine: IPlanoEngineCore): void {
  let pxPerCm = 0;
  try {
    pxPerCm = pxPerCmDe(engine);
  } catch {
    return;
  }
  const canales = (engine.bajantes || []).filter((b) => b.tipo === 'canal' && b.net === 'll');
  if (canales.length === 0) return;
  const bajantes = (engine.bajantes || []).filter((b) => b.net === 'll' && b.tipo === 'bajante');
  if (bajantes.length === 0) return;
  for (const c of canales) {
    if (c.x == null || c.y == null) continue;
    const obb = canalOBBDe(pxPerCm, c);
    const enCanal = (pt: number[]): boolean => puntoEnCanalOBB(obb, pt[0], pt[1], 4);
    for (const r of engine.ramales || []) {
      if (r.net !== 'll' || !r.pts || r.pts.length < 2) continue;
      const pS = r.pts[0];
      const pE = r.pts[r.pts.length - 1];
      const naceDelCanal = enCanal(pS);
      if (!naceDelCanal && !enCanal(pE)) continue;
      const pBaj = naceDelCanal ? pE : pS;
      const b = bajantes.find(
        (bb) =>
          bb.x != null &&
          bb.y != null &&
          Math.hypot(pBaj[0] - (bb.x as number), pBaj[1] - (bb.y as number)) < 2,
      );
      if (!b) continue;
      if (!b.canalId) b.canalId = c.id;
      if (naceDelCanal && !r.esCanalId) r.esCanalId = c.id;
    }
  }
}

/** Asociación EXPLÍCITA ramal-de-canal → bajante (panel derecho / menú contextual): mueve la
 *  membresía en recibeDeIds de los bajantes ll y refleja fin. null = desasociar. Cualquier
 *  llegada previa dibujada a otro bajante se reemplaza. */
export function moverAsociacionCanal(
  engine: IPlanoEngineCore,
  ramalId: string,
  bajanteId: string | null,
): void {
  for (const b of engine.bajantes) {
    if (!b.recibeDeIds?.includes(ramalId)) continue;
    if (bajanteId && b.id === bajanteId) continue;
    b.recibeDeIds = b.recibeDeIds.filter((rid) => rid !== ramalId);
  }
  const ramal = engine.ramales.find((r) => r.id === ramalId);
  if (bajanteId) {
    const b = engine.bajantes.find((x) => x.id === bajanteId);
    if (b) {
      if (!b.recibeDeIds) b.recibeDeIds = [];
      if (!b.recibeDeIds.includes(ramalId)) b.recibeDeIds.push(ramalId);
      // fin refleja el destino; el diámetro NO se toca (default 2" editable, orig. usuario).
      if (ramal) ramal.fin = b.code || b.id;
    }
  } else if (ramal) {
    ramal.fin = '';
  }
  engine._markDirty();
}
