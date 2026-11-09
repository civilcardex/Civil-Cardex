/** Dibujo automático de la red rci (Red Contra Incendio) con los S/L del proyecto: sembrar
 *  rociadores colgantes sobre un ramal cada S (m) desde el INICIO del trazo (pts[0]) y crear
 *  ramales paralelos al primero separados L (m) con numeración RRCIn consecutiva.
 *  Ej: sembrarRociadores(eng, 'RRCI1', 3.2) deja un rociador en la cabeza y uno cada 3,2 m. */
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState.ts';
import { cmToPlanePx } from './planoCoords.ts';
import { calculateRamalLength } from './ramalMeasure.ts';
import { nextFreeRamalId } from './planoNumbering.ts';
import { _firstSegmentAngle } from './drawingAngles.ts';
import { distSegSeg } from '../shared/geometry.ts';
import { factorMPorPx } from './planoCoords.ts';

/** Recorre la polilínea desde pts[0] y devuelve el punto (y el índice de inserción) que está a
 *  `distPx` px acumulados. null si la distancia se pasa del final. */
function puntoADistancia(
  pts: number[][],
  distPx: number,
): { x: number; y: number; idx: number; dist: number } | null {
  let acum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const seg = Math.hypot(dx, dy);
    if (acum + seg >= distPx) {
      const t = seg > 0 ? (distPx - acum) / seg : 0;
      return { x: pts[i][0] + dx * t, y: pts[i][1] + dy * t, idx: i + 1, dist: distPx };
    }
    acum += seg;
  }
  return null;
}

/** Corre las claves accMed{n} del índice `desde` en `delta` (shift del splice de vértices,
 *  mismo criterio de midRamalAccessorySelector). */
function shiftAccMed(
  accMed: Record<string, string>,
  desde: number,
  delta: number,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(accMed)) {
    const m = k.match(/^accMed(\d+)$/);
    const n = m ? +m[1] : null;
    if (n !== null && n >= desde) out[`accMed${n + delta}`] = v;
    else out[k] = v;
  }
  return out;
}

/** Distancia mínima (px) entre la polilínea del muro y la polilínea dada (mín entre todos sus
 *  segmentos). Infinity si alguna está vacía. Ej: distMuroAPoli(muro.pts, ramal.pts). */
function distMuroAPoli(muro: number[][], pts: number[][]): number {
  let mejor = Infinity;
  for (let i = 0; i < muro.length - 1; i++) {
    for (let j = 0; j < pts.length - 1; j++) {
      mejor = Math.min(mejor, distSegSeg(muro[i], muro[i + 1], pts[j], pts[j + 1]));
    }
  }
  return mejor;
}

/** Siembra rociadores colgantes ('rociador') sobre el ramal cada `sM` metros, COMENZANDO en el
 *  extremo donde se empezó a dibujar el trazo (pts[0]): el primero va en el propio extremo
 *  (accesorioInicio, SOLO si el ramal no tenía uno) y los demás como marcadores de cuerpo
 *  (accMed). No toca los accesorios existentes (solo desplaza sus claves al insertar vértices).
 *  Devuelve cuántos rociadores NUEVOS quedaron en el ramal (inicio solo cuenta si se sembró).
 *  Ej: ramal sin inicio y 3 marcas accMed → 4. */
export function sembrarRociadores(engine: IPlanoEngineCore, ramalId: string, sM: number): number {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return 0;
  const pasoPx = cmToPlanePx(engine.scaleM, sM * 100);
  if (!(pasoPx > 0)) return 0;
  const totalPx = r.pts.reduce(
    (acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p[0] - r.pts[i - 1][0], p[1] - r.pts[i - 1][1])),
    0,
  );
  /* Puntos a insertar (dist, x, y) cada pasoPx desde el inicio, sin llegar al último vértice
   * (el rociador final queda donde caiga; no se fuerza sobre el extremo). */
  const inserciones: Array<{ x: number; y: number; idx: number; dist: number }> = [];
  for (let d = pasoPx; d < totalPx - 1e-6; d += pasoPx) {
    const p = puntoADistancia(r.pts, d);
    if (p) inserciones.push(p);
  }
  /* Sin puntos que insertar: no-op puro (no toca el ramal ni marca dirty). */
  if (!inserciones.length) return 0;
  /* Insertar ASC por distancia con offset: varias distancias caen en el MISMO segmento (mismo
   * idx), así que cada inserción corré las previas +1 — el contador global lo lleva. */
  let pts = r.pts.slice();
  let accMed = { ...(r.accMed || {}) };
  let offset = 0;
  for (const ins of [...inserciones].sort((a, b) => a.dist - b.dist)) {
    const idx = ins.idx + offset;
    pts = [...pts.slice(0, idx), [ins.x, ins.y], ...pts.slice(idx)];
    accMed = shiftAccMed(accMed, idx, 1);
    accMed[`accMed${idx}`] = 'rociador';
    offset++;
  }
  /* El +1 del conteo solo si el inicio realmente quedó con rociador (si ya tenía otro
   * accesorio se conserva y NO es un rociador nuevo). */
  const sembroInicio = r.accesorioInicio ? 0 : 1;
  engine.updateElementById(ramalId, {
    pts,
    accMed,
    accesorioInicio: r.accesorioInicio || 'rociador',
    totalL: +calculateRamalLength(pts, engine).toFixed(3),
  });
  engine.render();
  engine._markDirty();
  return inserciones.length + sembroInicio;
}

/** Lado del offset para los paralelos, relativo al sentido del trazo. */
export type LadoParalelo = 'izq' | 'der';

/** Crea `n` ramales rci paralelos al ramal dado, separados `lM` metros entre sí (el k-ésimo a
 *  k·L), desplazados en perpendicular al PRIMER segmento del trazo, hacia el lado elegido.
 *  Ids/labels consecutivos (RRCIn vía nextFreeRamalId), mismo material/pendiente que el base y
 *  sin glifos internos (los dobleces del trazo son parte del trazado). Devuelve los ids creados. */
export function crearRamalesParalelos(
  engine: IPlanoEngineCore,
  ramalId: string,
  lM: number,
  n: number,
  lado: LadoParalelo,
): string[] {
  const base = engine.ramales.find((x) => x.id === ramalId);
  if (!base || !base.pts || base.pts.length < 2 || n <= 0) return [];
  const lPx = cmToPlanePx(engine.scaleM, lM * 100);
  if (!(lPx > 0)) return [];
  const dx = base.pts[1][0] - base.pts[0][0];
  const dy = base.pts[1][1] - base.pts[0][1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [];
  /* Normal unitaria del primer segmento en coords de PANTALLA (y crece hacia abajo). Lado
   * escogido = hacia donde SALEN los paralelos (orig. usuario): 'izq' → (-dy,dx), 'der' →
   * (dy,-dx) — invertido del natural matemático para coincidir con lo que espera el dibujo. */
  const nx = lado === 'izq' ? (-dy / len) * lPx : (dy / len) * lPx;
  const ny = lado === 'izq' ? (dx / len) * lPx : (-dx / len) * lPx;
  const creados: string[] = [];
  for (let k = 1; k <= n; k++) {
    const id = nextFreeRamalId(engine.ramales, 'RRCI');
    const pts = base.pts.map(([x, y]) => [x + nx * k, y + ny * k] as [number, number]);
    const nuevo: PlanoRamal = {
      id,
      net: 'rci',
      tipo: 'ramal',
      padre: null,
      pts,
      totalL: +calculateRamalLength(pts, engine).toFixed(3),
      label: id,
      ini: '',
      fin: '',
      piso: String(engine.nivelActual?.n ?? ''),
      dz: '',
      uc: 0,
      labelX: pts[0][0] + (pts[pts.length - 1][0] - pts[0][0]) / 2,
      labelY: pts[0][1] + (pts[pts.length - 1][1] - pts[0][1]) / 2,
      labelAngle: _firstSegmentAngle(pts),
      material: base.material || engine._ramalDefaults?.material || '',
      diametro: '',
      pendiente: base.pendiente ?? 2,
      bloqueado: false,
      _sinAccMedInterior: true,
    };
    engine.ramales.push(nuevo);
    creados.push(id);
  }
  engine.render();
  engine._markDirty();
  return creados;
}

/** Chequeo EN VIVO al terminar/mover un trazo rci: SOLO los muros de su BANDA de
 *  responsabilidad (a ≤ 2·Dmuro del trazo nuevo/movido) deben quedar a ≤ Dmuro del ramal rci
 *  más cercano. Los muros más lejos esperan su propio ramal — si se exigiera cobertura TOTAL
 *  del piso en cada trazo, ningún trazo podría ser el primero en una habitación con muros en
 *  lados opuestos (la red completa sería imdibujable); la cobertura final la juzga la
 *  verificación de tabla (checks del módulo RCI). `dm` llega INYECTADO (engine.dmuroRci lo
 *  pone la capa React desde el espejo del módulo): null/≤0 → null (no aplica).
 *  Devuelve el mensaje de alerta si un muro de la banda queda descubierto (el trazo NO se
 *  crea / el movimiento se revierte), o null si pasa.
 *  Ej: muro de la banda a 2,37 m con Dmuro 1,70 → «El muro queda a 2,37 m…». */
export function chequeoMurosTrazo(
  engine: IPlanoEngineCore,
  ptsNuevos: number[][],
  dm: number | null | undefined,
): string | null {
  const muros = engine.guideLines.filter((g) => g.esMuro && g.pts && g.pts.length >= 2);
  if (!muros.length || !(dm && dm > 0)) return null;
  /* Dmuro a px del plano (las polilíneas viven en px; el factor m/px del doc lo convierte). */
  const dmPx = dm / factorMPorPx(engine.scaleM);
  const ramalesRci = engine.ramales.filter(
    (r) => r.net === 'rci' && r.tipo === 'ramal' && r.pts.length >= 2,
  );
  let peor = 0;
  for (const muro of muros) {
    /* Banda de responsabilidad: solo muros que ESTE trazo puede cubrir (a ≤ 2·Dmuro de él). */
    const dNueva = distMuroAPoli(muro.pts, ptsNuevos);
    if (dNueva > 2 * dmPx) continue;
    let mejor = dNueva;
    for (const r of ramalesRci) {
      const d = distMuroAPoli(muro.pts, r.pts);
      if (d < mejor) mejor = d;
    }
    if (mejor > dmPx + 1e-9 && mejor > peor) peor = mejor;
  }
  if (peor === 0) return null;
  const peorM = engine.pxToM(peor);
  return `El trazo no se puede crear: un muro de su zona quedaría a ${peorM.toFixed(2).replace('.', ',')} m del ramal más cercano y la distancia máxima a muro (Dmuro) es de ${String(dm).replace('.', ',')} m. Dibuje el ramal más cerca del muro o aumente Dmuro en RCI → Rociadores → Datos del rociador.`;
}
