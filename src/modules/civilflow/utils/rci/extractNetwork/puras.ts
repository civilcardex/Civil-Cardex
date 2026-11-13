// Helpers puros del extractor RCI: tolerancias y regexes de contacto, lectura del contrato con
// el motor de dibujo, geometría (distancias, proyecciones sobre polilíneas, ángulos), accesorios
// dibujados, álgebra de posiciones del tronco y la decisión de conexión de un ramal. Todo sin
// estado: entra dibujo, sale decisión. Ej: mejorConexion dice dónde cuelga R1 del tronco.
import { num } from '../../../lib/rci/hydraulics.ts';
import type { RawElement } from '../../drawingSyncTypes.ts';
import type { AccDib, Punto, TrazoDib, TramoTronco } from './types.ts';

/** Techo por defecto en Fase 1 (m sobre el NPT (Nivel de Piso Terminado)); la tipología lo mandará después. */
export const TECHO_DEF = 5.3;
/** Altura de la derivación del montante por defecto (m sobre el NPT), si el dibujo no trae altDeriv. */
export const ALT_DERIV_DEF = 2.5;
/** Material por defecto del montante (el mismo que asume building.ts cuando falta). */
export const MAT_DEF = 'Acero SCH 10';

/** Tolerancia de contacto extremo-extremo entre trazos, en px (la de junctionAutoSplit). */
export const TOL_PUNTO = 0.5;
/** Tolerancia de contacto con un bajante/montante, en px (la de canalSeal). */
export const TOL_BAJANTE = 2;
/** Giro (grados) a partir del cual el flujo entrante a un nudo "gira" y lleva la tee. */
export const UMBRAL_GIRO = 30;
/** Dos apeaduros a menos de esta distancia (m a lo largo del tronco) son el MISMO nudo. */
export const GAP_NUDO = 0.05;

export const RE_ROCIADOR = /rociador/i;
export const RE_TEE = /tee/i;
export const RE_CODO90 = /codo90|codos_90/i;
export const RE_CODO45 = /codo45|codos_45/i;

/* =================== Contrato con la Fase 2 (PlanoEngine) ===================
 * ÚNICO punto donde se lee cada cosa del dibujo: si la Fase 2 cambia algo,
 * el ajuste se hace AQUÍ y no en el resto del extractor.
 * - Rociador dibujado = accesorio del ramal con tipo 'rociador' (AÚN no existe en el
 *   catálogo del motor: si Fase 2 usa otro nombre/tipo, se cambia solo contarRociadores).
 * - Montante RCI = elemento bajante con net 'rci' y tipo 'montante' (YA ATERRIZÓ en
 *   PlanoBajante): su `altDeriv?: number` (m sobre el NPT, default 2.5 — leerAltDeriv).
 *   Material/diámetro: `material` / `dNominal || diametro` (hoy vacíos en el montante).
 * - Gabinete (YA ATERRIZÓ como bajante con tipo 'gabinete' y campo `montante` con el
 *   código del montante que lo alimenta): el estado gris NO lo consume todavía — no hay
 *   sección de gabinetes en RciState; la fase de diseño de gabinetes lo leerá de aquí.
 * ========================================================================== */

/** Rociadores dibujados en el ramal: accesorios cuyo tipo dice "rociador" — los
 *  marcados NO FLUYE (flag NF justo antes del '#': 'rociadorNF#3', 'rociadorMontanteNF#5')
 *  se EXCLUYEN del conteo (ped. usuario: fluye/no fluye decide el cálculo). */
export function contarRociadores(el: RawElement): number {
  const fluye = (v: unknown): boolean =>
    !!v && RE_ROCIADOR.test(String(v)) && !/NF(?:#|$)/.test(String(v));
  let n = 0;
  if (fluye(el.accesorioInicio)) n++;
  if (fluye(el.accesorioFin)) n++;
  for (const v of Object.values(el.accMed || {})) if (fluye(v)) n++;
  return n;
}

/** altDeriv del montante dibujado (m sobre el NPT); null si el elemento no la trae. */
export function leerAltDeriv(el: RawElement): number | null {
  return num((el as { altDeriv?: unknown }).altDeriv);
}

/** Material dibujado en el elemento (vacío = el dibujo no lo trae). */
export function leerMaterial(el: RawElement): string {
  return String(el.material || '');
}

/** Diámetro dibujado (vacío = el dibujo no lo trae). */
export function leerDn(el: RawElement): string {
  return String(el.dNominal || el.diametro || '');
}

/* ============================ Geometría ============================ */

/** Endpoints de un trazo: inicio (pts[0]) y fin (último punto); null si el trazo es degenerado. */
export function extremos(el: RawElement): [Punto, Punto] | null {
  const pts = el.pts;
  if (!pts || pts.length < 2) return null;
  return [
    { x: pts[0][0], y: pts[0][1] },
    { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] },
  ];
}

/** Distancia de un punto a un segmento (px). */
export function distASegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Longitud del segmento i de una polilínea (px). */
export function lonSeg(pts: number[][], i: number): number {
  return Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
}

/** Longitud total de una polilínea (px); nunca 0, para poder dividir por ella sin guardas. */
export function totalPxDe(pts: number[][]): number {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += lonSeg(pts, i);
  return total || 1;
}

/** Punto más cercano de una polilínea: fracción de arco (0..1 desde pts[0]) y distancia (px). */
export function masCercanoEnPolilinea(p: Punto, pts: number[][]): { frac: number; dist: number } {
  let mejor = { frac: 0, dist: Infinity };
  let acum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = { x: pts[i][0], y: pts[i][1] },
      b = { x: pts[i + 1][0], y: pts[i + 1][1] };
    const d = distASegmento(p, a, b);
    if (d < mejor.dist) {
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      mejor = { frac: (acum + t * lonSeg(pts, i)) / totalPxDe(pts), dist: d };
    }
    acum += lonSeg(pts, i);
  }
  return mejor;
}

/** Ángulo entre dos direcciones, en grados (0 = misma dirección). */
export function anguloEntre(ux: number, uy: number, vx: number, vy: number): number {
  const nu = Math.hypot(ux, uy),
    nv = Math.hypot(vx, vy);
  if (nu === 0 || nv === 0) return 0;
  const c = (ux * vx + uy * vy) / (nu * nv);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/* ============================ Accesorios ============================ */

/** Accesorios del trazo: accMed<i> (vértice i) + accesorioInicio/Fin (extremos). */
export function accesoriosDe(el: RawElement): AccDib[] {
  const out: AccDib[] = [];
  const med = el.accMed || {};
  for (const k of Object.keys(med)) {
    const m = /^accMed(\d+)$/.exec(k);
    if (m && med[k]) out.push({ tipo: med[k], idx: +m[1] });
  }
  const last = (el.pts || []).length - 1;
  if (el.accesorioInicio) out.push({ tipo: el.accesorioInicio, idx: 0 });
  if (el.accesorioFin) out.push({ tipo: el.accesorioFin, idx: Math.max(0, last) });
  return out;
}

/** Cuántos accesorios de la lista casan con un patrón (codo90, tee…). */
export function contarAcc(acc: readonly { tipo: string }[], re: RegExp): number {
  let n = 0;
  for (const a of acc) if (re.test(a.tipo)) n++;
  return n;
}

/** Tees dibujadas en un vértice concreto (para no auto-asignar donde el dibujo ya puso una). */
export function teesEnVertice(acc: readonly AccDib[], idx: number): number {
  let n = 0;
  for (const a of acc) if (a.idx === idx && RE_TEE.test(a.tipo)) n++;
  return n;
}

/** ¿Hay un codo dibujado en el vértice idx? (el "quiebre de planta" que ya existe). */
export function codoEnVertice(acc: readonly AccDib[], idx: number): boolean {
  for (const a of acc) {
    if (a.idx === idx && (RE_CODO90.test(a.tipo) || RE_CODO45.test(a.tipo))) return true;
  }
  return false;
}

/* ==================== Álgebra de posiciones del tronco ==================== */

/** Letra del nudo i: A, B, …, Z y después N27, N28… (una planta no llega a 26, pero por si acaso). */
export function letraNudo(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : 'N' + (i + 1);
}

/** El trazo del tronco que aloja una posición: `esFin` busca el trazo donde la posición es su
 *  extremo de derivación (para llegar); si no, donde es su extremo remoto (para salir). */
export function troncoQueAloja(
  troncoPos: readonly TramoTronco[],
  pos: number,
  esFin: boolean,
): TramoTronco | null {
  for (const x of troncoPos) {
    if (esFin ? pos > x.o - 1e-9 && pos <= x.fin + 1e-9 : pos >= x.o - 1e-9 && pos < x.fin - 1e-9)
      return x;
  }
  return null;
}

/** Índice del vértice del trazo alojado más cercano a una posición del tronco. */
export function idxDePos(x: TramoTronco, pos: number): number {
  const pts = x.t.el.pts || [];
  const fracTronco = Math.max(0, Math.min(1, (pos - x.o) / (x.t.L || 1)));
  const f = x.remotoEsA ? fracTronco : 1 - fracTronco;
  return Math.max(0, Math.min(pts.length - 1, Math.round(f * (pts.length - 1))));
}

/** Dirección del flujo (remoto → derivación) con la que el tronco SALE de una posición: el
 *  segmento que sigue. Ej: en el nudo B decide si T1 llega colineal a T2 o si su flujo gira. */
export function dirSalidaTronco(troncoPos: readonly TramoTronco[], pos: number): Punto | null {
  const aloj = troncoQueAloja(troncoPos, pos, false);
  if (!aloj) return null;
  const pts = aloj.t.el.pts || [];
  const n = pts.length;
  const fracTronco = Math.max(0, Math.min(1, (pos - aloj.o) / (aloj.t.L || 1)));
  const f = aloj.remotoEsA ? fracTronco : 1 - fracTronco;
  const k = Math.max(0, Math.min(n - 2, Math.floor(f * (n - 1))));
  const sgn = aloj.remotoEsA ? 1 : -1;
  return { x: sgn * (pts[k + 1][0] - pts[k][0]), y: sgn * (pts[k + 1][1] - pts[k][1]) };
}

/* ==================== Decisión de conexión ==================== */

/** Mejor conexión de un ramal: su punta más cercana al tronco, al montante (derivación) o a un
 *  ramal ya conectado (cadena ramal→ramal hereda su nudo). Null si nada queda a TOL_PUNTO.
 *  PARALELOS copia pura (ped. usuario): con el conector eliminado, la copia cuelga de la base
 *  por PROXIMIDAD — tolerancia = la longitud del ramal conectado convertida a px (mPorPx del
 *  doc): su extremo cae a la distancia de separación (≤ L) sobre la polilínea y hereda el nudo.
 *  Ej: copia a 1,5 m de la base (113 px a escala 0,5) conecta si la base mide ≥ 1,5 m. */
export function mejorConexion(
  t: TrazoDib,
  troncoPos: readonly TramoTronco[],
  posMont: Punto,
  posDer: number,
  trazos: readonly TrazoDib[],
  conectados: ReadonlyMap<number, { pos: number; punto: Punto }>,
  mPorPx: number,
): { pos: number; punto: Punto } | null {
  /* RUTA CRÍTICA por flechas (ped. usuario): la COLA del trazo (t.a = pts[0]) es el lado de
   * aguas ARRIBA — donde entra el flujo. Jerarquía de contacto: (1) EXACTO en la cola
   * (montante o tronco), (2) exacto en la cabeza, (3) proximidad difusa (tolPar) en la cola,
   * (4) difusa en la cabeza — un contacto EXACTO de la cabeza gana a una proximidad de la
   * cola (los paralelos siguen conectando: su contacto es difuso en ambas puntas y la cola
   * manda). Sin nada: null (trazo suelto). */
  const evalTip = (
    p: Punto,
  ): {
    exact: { pos: number; punto: Punto } | null;
    fuzzy: { pos: number; punto: Punto } | null;
  } => {
    let exact: { pos: number; punto: Punto } | null = null;
    let exactD = Infinity;
    let fuzzy: { pos: number; punto: Punto } | null = null;
    let fuzzyD = Infinity;
    const dDer = Math.hypot(p.x - posMont.x, p.y - posMont.y);
    if (dDer < TOL_BAJANTE && dDer < exactD) {
      exactD = dDer;
      exact = { pos: posDer, punto: p };
    }
    for (const x of troncoPos) {
      const mc = masCercanoEnPolilinea(p, x.t.el.pts || []);
      if (mc.dist < TOL_PUNTO && mc.dist < exactD) {
        exactD = mc.dist;
        exact = { pos: x.o + (x.remotoEsA ? mc.frac : 1 - mc.frac) * x.t.L, punto: p };
      }
    }
    for (const o of trazos) {
      const c = conectados.get(o.orden);
      if (!c) continue;
      const mc = masCercanoEnPolilinea(p, o.el.pts || []);
      const tolPar = Math.max(TOL_PUNTO, (o.L || 0) / mPorPx);
      if (mc.dist < tolPar && mc.dist < fuzzyD) {
        fuzzyD = mc.dist;
        fuzzy = { pos: c.pos, punto: p };
      }
    }
    return { exact, fuzzy };
  };
  const a = evalTip(t.a); // cola: aguas arriba — manda en su nivel
  const b = evalTip(t.b);
  return a.exact || b.exact || a.fuzzy || b.fuzzy;
}
