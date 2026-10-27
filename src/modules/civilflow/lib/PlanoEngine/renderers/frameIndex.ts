// Índice geométrico del frame: dice qué ramales TOCAN un punto (vértice a <0.5) y cuáles PASAN
// por él (cuerpo a <0.5) sin recorrer toda la lista. Antes, cada codo y cada unión barrían
// `engine.ramales` completos: con 400 ramales el render costaba ~650 ms por frame (orig. usuario:
// el paneo/zoom "trabado"). Ahora es una consulta por celda.
//
// El índice se reconstruye sólo cuando la geometría cambia (`firmaGeometria`): durante el paneo
// y el zoom no se toca — el mismo dibujo, otra cámara.
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

/** Vértice concreto de un ramal (ramal + índice del punto). */
export interface RefVertice {
  r: PlanoRamal;
  i: number;
}

/** Consultas del frame sobre la geometría de los ramales. */
export interface IndiceFrame {
  /** Vértices a menos de 0.5 unidades del punto (misma tolerancia del código original). */
  tocan(x: number, y: number): RefVertice[];
  /** Ramales cuyo CUERPO pasa a menos de 0.5 del punto (extremos a más de 0.5). */
  cruzan(x: number, y: number): PlanoRamal[];
  /** Ramal dueño de un array de puntos (identidad, como el `find(rm => rm.pts === pts)`). */
  porPts(pts: number[][]): PlanoRamal | undefined;
  /** Ramales que declaran ese `padre` (tributarios de un ramal). */
  hijosDe(padreId: string): PlanoRamal[];
  /** Posición del ramal en `engine.ramales` (reproduce el orden del barrido original). */
  orden(r: PlanoRamal): number;
  /** Firma de la geometría con la que se construyó (para reutilizarlo entre frames). */
  firma: number;
  /** Ramales de vent — el codo reventilado los consulta por frame (antes: filter por frame). */
  ventRamales: PlanoRamal[];
  /** Ramales de san. */
  sanRamales: PlanoRamal[];
  /** Bajantes de san. */
  bajantesSan: IPlanoEngineCore['bajantes'];
  /** ¿Hay un punto san a menos de 0.5 de (x,y)? (celdas de 0.5 — misma tolerancia). */
  hayPuntoSan(x: number, y: number): boolean;
  /** bbox de un ramal (o null si no tiene pts) — prefiltra snaps por radio grande. */
  bboxDe(r: PlanoRamal): [number, number, number, number] | null;
}

const TOL = 0.5;
/** Celda de los vértices: con tolerancia 0.5 basta mirar el vecindario 3×3. */
const CELDA_V = 1;
/** Celda de los cuerpos de ramal (más gruesa: un segmento largo cruza muchas celdas finas). */
const CELDA_S = 32;
/** Celda del índice de puntos sanitarios (tolerancia del codo reventilado = 0.5). */
const CELDA_PUNTOS_SAN = 0.5;

const clave = (cx: number, cy: number) => `${cx},${cy}`;

/** Recorre las celdas que toca un segmento (Amanatides–Woo). En empate marca las dos vecinas
 *  para no perder la celda que el segmento sólo roza en la esquina. */
function celdasDeSegmento(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  visitar: (cx: number, cy: number) => void,
): void {
  const cx0 = Math.floor(x0 / CELDA_S);
  const cy0 = Math.floor(y0 / CELDA_S);
  const cx1 = Math.floor(x1 / CELDA_S);
  const cy1 = Math.floor(y1 / CELDA_S);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const pasoX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const pasoY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const dX = dx !== 0 ? Math.abs(CELDA_S / dx) : Infinity;
  const dY = dy !== 0 ? Math.abs(CELDA_S / dy) : Infinity;
  let tX = dx !== 0 ? ((cx0 + (pasoX > 0 ? 1 : 0)) * CELDA_S - x0) / dx : Infinity;
  let tY = dy !== 0 ? ((cy0 + (pasoY > 0 ? 1 : 0)) * CELDA_S - y0) / dy : Infinity;
  let cx = cx0;
  let cy = cy0;
  visitar(cx, cy);
  let guarda = 0;
  while ((cx !== cx1 || cy !== cy1) && guarda++ < 100000) {
    if (tX === tY) {
      if (pasoX) {
        cx += pasoX;
        visitar(cx, cy);
      }
      if (pasoY) {
        cy += pasoY;
        visitar(cx, cy);
      }
      tX += dX;
      tY += dY;
    } else if (tX < tY) {
      cx += pasoX;
      tX += dX;
      visitar(cx, cy);
    } else {
      cy += pasoY;
      tY += dY;
      visitar(cx, cy);
    }
  }
}

/** ¿El cuerpo del ramal (sus segmentos) pasa a menos de 0.5 del punto, con los extremos lejos?
 *  Es el mismo predicado que usaba el render de codos: un vértice encima del tubo de otro ramal
 *  no lleva arco de codo (es una tee). */
function cuerpoCerca(r: PlanoRamal, x: number, y: number): boolean {
  const pts = r.pts;
  if (!pts || pts.length < 2) return false;
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s];
    const b = pts[s + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.001) continue;
    let t = ((x - a[0]) * dx + (y - a[1]) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    if (Math.hypot(x - px, y - py) >= TOL) continue;
    const lenA = Math.hypot(a[0] - x, a[1] - y);
    const lenB = Math.hypot(b[0] - x, b[1] - y);
    if (lenA > TOL && lenB > TOL) return true;
  }
  return false;
}

function construir(eng: IPlanoEngineCore, firma: number): IndiceFrame {
  const vertices = new Map<string, RefVertice[]>();
  const cuerpos = new Map<string, PlanoRamal[]>();
  const porPts = new Map<unknown, PlanoRamal>();
  const hijos = new Map<string, PlanoRamal[]>();
  const orden = new Map<PlanoRamal, number>();
  const bboxes = new Map<PlanoRamal, [number, number, number, number]>();
  // Puntos sanitarios por celda de 0.5 (el codo reventilado consulta "¿hay punto san cerca?"
  // por ramal y frame — antes el flatMap + Map se reconstruían en CADA render, pan/zoom incluido).
  const puntosSan = new Map<string, number[][]>();
  const ventRamales: PlanoRamal[] = [];
  const sanRamales: PlanoRamal[] = [];
  let n = 0;
  for (const r of eng.ramales) {
    orden.set(r, n++);
    const pts = r.pts;
    if (r.net === 'vent') ventRamales.push(r);
    else if (r.net === 'san') sanRamales.push(r);
    if (pts && pts.length >= 2) {
      let minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      for (const p of pts) {
        if (p[0] < minx) minx = p[0];
        if (p[0] > maxx) maxx = p[0];
        if (p[1] < miny) miny = p[1];
        if (p[1] > maxy) maxy = p[1];
      }
      bboxes.set(r, [minx, miny, maxx, maxy]);
    }
    if (!pts) continue;
    if (r.net === 'san') {
      for (const p of pts) {
        const k = clave(Math.floor(p[0] / CELDA_PUNTOS_SAN), Math.floor(p[1] / CELDA_PUNTOS_SAN));
        const arr = puntosSan.get(k);
        if (arr) arr.push(p);
        else puntosSan.set(k, [p]);
      }
    }
    porPts.set(pts, r);
    if (r.padre) {
      const lista = hijos.get(r.padre);
      if (lista) lista.push(r);
      else hijos.set(r.padre, [r]);
    }
    for (let i = 0; i < pts.length; i++) {
      const k = clave(Math.floor(pts[i][0] / CELDA_V), Math.floor(pts[i][1] / CELDA_V));
      const lista = vertices.get(k);
      if (lista) lista.push({ r, i });
      else vertices.set(k, [{ r, i }]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      // Una celda puede recibir el mismo ramal varias veces: se dedupe con la última.
      celdasDeSegmento(a[0], a[1], b[0], b[1], (cx, cy) => {
        const k = clave(cx, cy);
        const lista = cuerpos.get(k);
        if (!lista) cuerpos.set(k, [r]);
        else if (lista[lista.length - 1] !== r) lista.push(r);
      });
    }
  }
  const bajantesSan = eng.bajantes.filter((b) => b.net === 'san');
  return {
    firma,
    ventRamales,
    sanRamales,
    bajantesSan,
    bboxDe: (r) => bboxes.get(r) ?? null,
    porPts: (pts) => porPts.get(pts),
    hijosDe: (padreId) => hijos.get(padreId) || [],
    orden: (r) => orden.get(r) ?? -1,
    hayPuntoSan(x, y) {
      const cx = Math.floor(x / CELDA_PUNTOS_SAN);
      const cy = Math.floor(y / CELDA_PUNTOS_SAN);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const arr = puntosSan.get(clave(cx + dx, cy + dy));
          if (!arr) continue;
          for (const p of arr) {
            if (Math.hypot(x - p[0], y - p[1]) < 0.5) return true;
          }
        }
      }
      return false;
    },
    tocan(x, y) {
      const out: RefVertice[] = [];
      const cx0 = Math.floor(x / CELDA_V);
      const cy0 = Math.floor(y / CELDA_V);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const lista = vertices.get(clave(cx0 + dx, cy0 + dy));
          if (!lista) continue;
          for (const ref of lista) {
            const p = ref.r.pts[ref.i];
            if (Math.hypot(p[0] - x, p[1] - y) < TOL) out.push(ref);
          }
        }
      }
      return out;
    },
    cruzan(x, y) {
      const out: PlanoRamal[] = [];
      const vistos = new Set<PlanoRamal>();
      const cx0 = Math.floor(x / CELDA_S);
      const cy0 = Math.floor(y / CELDA_S);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const lista = cuerpos.get(clave(cx0 + dx, cy0 + dy));
          if (!lista) continue;
          for (const r of lista) {
            if (vistos.has(r)) continue;
            if (cuerpoCerca(r, x, y)) {
              vistos.add(r);
              out.push(r);
            }
          }
        }
      }
      return out;
    },
  };
}

/** Mezcla barata de números/textos para detectar cambios de geometría (FNV-1a). */
function mezclar(h: number, n: number): number {
  let x = h ^ (n | 0);
  x = Math.imul(x, 16777619);
  return x >>> 0;
}

/** Firma de TODO lo que cambia la geometría visible (puntos, etiquetas, bajantes, áreas, textos
 *  y redes ocultas). Si no cambió, el índice del frame anterior sigue sirviendo: durante el
 *  paneo y el zoom no se reconstruye nada. */
export function firmaGeometria(eng: IPlanoEngineCore): number {
  let h = 2166136261 >>> 0;
  const num = (n: number | undefined) => {
    h = mezclar(h, Math.round((n || 0) * 100));
  };
  const txt = (s: string | null | undefined) => {
    if (s) {
      for (let i = 0; i < s.length; i++) h = mezclar(h, s.charCodeAt(i));
      h = mezclar(h, s.length);
    }
    h = mezclar(h, 0x2c);
  };
  const ramales = eng.ramales;
  h = mezclar(h, ramales.length);
  for (const r of ramales) {
    txt(r.id);
    txt(r.padre);
    txt(r.net);
    num(r.labelX);
    num(r.labelY);
    h = mezclar(h, r.labelMoved ? 1 : 0);
    const pts = r.pts || [];
    h = mezclar(h, pts.length);
    for (const p of pts) {
      num(p[0]);
      num(p[1]);
    }
  }
  const bajantes = eng.bajantes;
  h = mezclar(h, bajantes.length);
  for (const b of bajantes) {
    txt(b.id);
    txt(b.net);
    num(b.x);
    num(b.y);
    num((b as { _circ?: { r?: number } })._circ?.r);
  }
  const areas = eng.areas || [];
  h = mezclar(h, areas.length);
  for (const a of areas) {
    txt(a.net);
    for (const p of (a as { pts?: number[][] }).pts || []) {
      num(p[0]);
      num(p[1]);
    }
  }
  const textos = eng.textAnnots || [];
  h = mezclar(h, textos.length);
  for (const t of textos) {
    const caja = (t as { _box?: { x: number; y: number; w: number; h: number } })._box;
    num(caja?.x);
    num(caja?.y);
    num(caja?.w);
    num(caja?.h);
  }
  const ocultas = eng._hiddenNets ? [...eng._hiddenNets].sort().join('|') : '';
  txt(ocultas);
  return h;
}

const cache = new WeakMap<object, IndiceFrame>();

/** Índice abierto por el render en curso (todos los renderers del frame comparten uno solo). */
let enFrame: { eng: object; idx: IndiceFrame } | null = null;

/** Abre el frame de render: calcula el índice UNA vez y lo deja disponible para todos los
 *  renderers de esa pasada (`indiceFrame`). Sin cambios de geometría se reutiliza el anterior,
 *  así el paneo y el zoom no reconstruyen nada. */
export function iniciarFrame(eng: IPlanoEngineCore): IndiceFrame {
  const firma = firmaGeometria(eng);
  let idx = cache.get(eng as object);
  if (!idx || idx.firma !== firma) {
    idx = construir(eng, firma);
    cache.set(eng as object, idx);
  }
  enFrame = { eng: eng as object, idx };
  return idx;
}

/** Cierra el frame abierto (el render terminó: cualquier cambio posterior reconstruye). */
export function terminarFrame(): void {
  enFrame = null;
}

/** Índice de la geometría para el render en curso. Fuera de un render (tests, utilidades que
 *  dibujan suelto) se resuelve por firma, con la misma caché. */
export function indiceFrame(eng: IPlanoEngineCore): IndiceFrame {
  if (enFrame && enFrame.eng === (eng as object)) return enFrame.idx;
  const firma = firmaGeometria(eng);
  const previo = cache.get(eng as object);
  if (previo && previo.firma === firma) return previo;
  const nuevo = construir(eng, firma);
  cache.set(eng as object, nuevo);
  return nuevo;
}
