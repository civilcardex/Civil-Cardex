import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { SAN_ACCESORIOS, ACCESORIOS_HIDRO, GAS_ACCESORIOS } from '../constants';
import { HYDRO_DATA_STORAGE_KEY, TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { diamPulgFromLabel } from './diamPulgFromLabel';
import { isLdesvioRamalId } from './associateBajanteAcrossFloors';
import { fmtPulg } from './formatUtils';
import { distToSegment } from '../lib/shared/geometry';
import { dropAllZeroColumns, type MemoriaTable } from './exportMemoriaFinal';

interface HidroEntry {
  accesorios?: Record<string, number>;
}

// Marcadores de tee escritos en los vértices del cuerpo de un ramal (accMed) o en sus extremos
// (accesorioInicio/Fin) — cada uno tiene entrada de catálogo (ACCESORIOS_HIDRO / GAS_ACCESORIOS);
// el auto-tee del montante y el selector de accesorios de mitad de cuerpo persisten tees SOLO
// aquí (nunca en hidroData como fuente primaria de conteo), así que el resumen debe contarlas del
// dibujo, no de los tramos.
const TEES_ACC_MED = new Set([
  'teeDirecto',
  'teeReduccion',
  'teeLado',
  'teeSube',
  'teeBaja',
  'teeTapon',
  'teeLlaveTerminal',
  'te_linea',
  'te_ramal',
]);

// Tees de las redes hidro que calcHydroAccessories arrastra a hidroData desde accMed/extremos —
// en la tabla se cuentan SOLO desde los marcadores del dibujo (con nomenclatura de tres brazos),
// así que esta ruta se excluye en AF/AC/gas para no duplicarlas.
const HYDRO_TEE_IDS = new Set([
  'teeDirecto',
  'teeReduccion',
  'teeLado',
  'teeSube',
  'teeBaja',
  'teeTapon',
  'teeLlaveTerminal',
  'te_linea',
  'te_ramal',
]);

// Codons de 90° puestos a MITAD de ramal (accMed, sobre un quiebre del trazo). En AF/AC/LL el
// glifo no se dibuja (el arco del quiebre ya es el codo) pero la pieza SÍ se compra — el resumen
// los muestra en su propia columna "Codo medio 90°". calcHydroAccessories los arrastra a hidroData
// con el mismo id de catálogo del codo elegido, así que esa porción se resta de la ruta hidroData
// y se cuenta una sola vez desde los marcadores del dibujo.
const ACC_MED_CODOS = new Set(['codo90rc', 'codo90rm', 'codo90rl', 'codo90rmSube', 'codo90rmBaja']);

// Todos los codos de 90° (variantes corto/medio/largo + sube/baja). En AF/AC/LL se resumen en UNA
// sola columna "Codo medio 90°": el sube/baja solo describe cómo se instala (hacia arriba o hacia
// abajo), no cambia la pieza, y rc/rm/rl son el mismo codo de 90° en el plano. San conserva sus
// filas de catálogo.
const CODO_90_IDS = new Set(['codo90rc', 'codo90rm', 'codo90rl', 'codo90rmSube', 'codo90rmBaja']);

const CODO_MEDIO_90 = {
  id: 'codoMedio90',
  emoji: '🔩',
  nombre: 'Codo medio 90°',
  icono: '/iconos_civilflow/accesorios/codo90rm.webp',
  cat: 'Codos',
};

/**
 * Bug 2: conteo REAL de bushings — cada conexión de un ramal MENOR (más chico) contra un elemento
 * MAYOR (ramal de mayor diámetro o bajante/montante con más diámetro) es UNA reducción-bushing.
 * Puro: solo geometría + diámetros, testable sin fixtures. Clave `${mayor}_${menor}` (pulgadas).
 * Un extremo del menor debe caer sobre el cuerpo/vértice del mayor (tol 0.5, misma que usa el
 * resto de la detección de uniones del módulo). Bajantes se chequean primero: la conexión ramal→
 * montante es el caso de bushing más común y evita doble conteo cuando un ramal mayor y un
 * bajante comparten el punto.
 */
const BUSHING_TOL = 0.5;

export function computeBushingCounts(
  minors: Array<{ id: string; diametro: string; pts: number[][] }>,
  majors: Array<{ id: string; diametro: string; pts: number[][] }>,
  bajantes: Array<{ id: string; diametro: string; x: number; y: number }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const pulg = (d: string): number => diamPulgFromLabel(d);
  const add = (mayor: number, menor: number) => {
    const k = `${mayor}_${menor}`;
    counts[k] = (counts[k] || 0) + 1;
  };
  for (const m of minors) {
    const dm = pulg(m.diametro);
    if (dm <= 0 || !m.pts || m.pts.length < 2) continue;
    for (const ep of [m.pts[0], m.pts[m.pts.length - 1]]) {
      let matchedBajante = false;
      for (const b of bajantes) {
        const db = pulg(b.diametro);
        if (db <= dm) continue;
        if (Math.hypot(ep[0] - b.x, ep[1] - b.y) <= BUSHING_TOL) {
          add(db, dm);
          matchedBajante = true;
          break;
        }
      }
      if (matchedBajante) continue;
      // Un extremo en la UNIÓN de dos ramales mayores (tee 6"-6" donde descarga el de 4") es
      // una reducción contra CADA mayor que toca el punto — sin break al primero, o la unión
      // RAC1+RAC3 del caso real contaría 1 bushing en vez de 2.
      for (const M of majors) {
        if (M.id === m.id) continue;
        const dM = pulg(M.diametro);
        if (dM <= dm) continue;
        for (let i = 0; i < M.pts.length - 1; i++) {
          if (distToSegment(ep, M.pts[i], M.pts[i + 1]) <= BUSHING_TOL) {
            add(dM, dm);
            break;
          }
        }
      }
    }
  }
  return counts;
}

export function computeAccesoriosTable(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  tramos: Tramo[],
  plans: PlanItem[],
): MemoriaTable | null {
  const catalog =
    net === 'san' || net === 'll'
      ? SAN_ACCESORIOS
      : net === 'gas'
        ? // En gas las seis variantes de codo 90° (estándar/radio largo × horizontal/sube/baja)
          // se fusionan por TIPO: la orientación no cambia la pieza, y la tabla queda con una
          // sola fila por codo ("Codo 90° estándar horizontal" y "Codo 90° radio largo
          // horizontal") que suma todas las orientaciones (ver codoTarget abajo).
          GAS_ACCESORIOS.filter((a) => !a.id.endsWith('_sube') && !a.id.endsWith('_baja'))
        : ACCESORIOS_HIDRO;
  const title =
    net === 'san'
      ? 'Resumen de accesorios sanitarios por diámetro'
      : net === 'll'
        ? 'Resumen de accesorios por diámetro — aguas lluvias'
        : net === 'af'
          ? 'Resumen de accesorios por diámetro — agua fría'
          : net === 'ac'
            ? 'Resumen de accesorios por diámetro — agua caliente'
            : 'Resumen de accesorios por diámetro — gas';
  const drawingRamales: Array<{
    id: string;
    label: string;
    diametro: string;
    pts: number[][];
    accMed?: Record<string, string>;
    accesorioInicio?: string;
    accesorioFin?: string;
    planId: string;
  }> = [];
  // Item 7: para san, también se leen los ramales de ventilación — la unión vent↔san se muestra
  // con el diámetro de ambos ramales (san×vent) en el resumen.
  const ventRamales: Array<{
    id: string;
    label: string;
    diametro: string;
    pts: number[][];
    planId: string;
  }> = [];
  // Los tributarios del dibujo sirven como "hijos" para derivar el diámetro del brazo de una
  // tee/yee (en AF/AC el brazo es casi siempre un tributario, que no está en drawingRamales).
  const tribDrawing: Array<{
    id: string;
    label: string;
    diametro: string;
    pts: number[][];
    accesorioInicio?: string;
    accesorioFin?: string;
    accMed?: Record<string, string>;
    planId: string;
  }> = [];
  // Bajantes/montantes del dibujo (para conteo de bushing: un ramal menor que conecta a un
  // bajante de mayor diámetro necesita reducción).
  const bajanteDrawing: Array<{ id: string; diametro: string; x: number; y: number }> = [];
  for (const plan of plans || []) {
    if (plan.status !== 'confirmed') continue;
    const raw = loadFromStorage<unknown>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw as
      | {
          ramales?: Array<{
            id: string;
            label?: string;
            diametro?: string;
            pts?: number[][];
            tipo?: string;
            net?: string;
            accMed?: Record<string, string>;
            accesorioInicio?: string;
            accesorioFin?: string;
          }>;
          bajantes?: Array<{
            id?: string;
            x?: number;
            y?: number;
            dNominal?: string;
            diametro?: string;
          }>;
        }
      | string;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        continue;
      }
    }
    const bajantes =
      (
        data as {
          bajantes?: Array<{
            id?: string;
            x?: number;
            y?: number;
            dNominal?: string;
            diametro?: string;
          }>;
        }
      ).bajantes || [];
    for (const b of bajantes) {
      if (b.x == null || b.y == null) continue;
      bajanteDrawing.push({
        id: String(b.id || ''),
        diametro: b.dNominal || b.diametro || '',
        x: b.x,
        y: b.y,
      });
    }
    const ramales = (
      (
        data as {
          ramales?: Array<{
            id: string;
            label?: string;
            diametro?: string;
            pts?: number[][];
            tipo?: string;
            net?: string;
            accMed?: Record<string, string>;
            accesorioInicio?: string;
            accesorioFin?: string;
          }>;
        }
      ).ramales || []
    ).filter(
      (r) => (r.net === net || (net === 'san' && r.net === 'vent')) && !isLdesvioRamalId(r.id),
    );
    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      if (r.net === 'vent') {
        ventRamales.push({
          id: r.id,
          label: r.label || r.id,
          diametro: r.diametro || '',
          pts: r.pts,
          planId: String(plan.id),
        });
      } else if (r.tipo === 'tributario') {
        tribDrawing.push({
          id: r.id,
          label: r.label || r.id,
          diametro: r.diametro || '',
          pts: r.pts,
          accesorioInicio: r.accesorioInicio || '',
          accesorioFin: r.accesorioFin || '',
          accMed: r.accMed,
          planId: String(plan.id),
        });
      } else {
        drawingRamales.push({
          id: r.id,
          label: r.label || r.id,
          diametro: r.diametro || '',
          pts: r.pts,
          accMed: r.accMed,
          accesorioInicio: r.accesorioInicio || '',
          accesorioFin: r.accesorioFin || '',
          planId: String(plan.id),
        });
      }
    }
  }

  // Yees sanitarias: detección por VÉRTICE replicando calcSanitaryAccessories — en cada punto
  // donde se cruzan 3-4 brazos sanitarios con aproximación en Y (|cos| ∈ [0.4, 0.85]) hay UNA
  // yee (no una por par de ramales: cuando la tubería principal está dibujada como dos ramales
  // unidos en el mismo punto, el enfoque por pares contaba la misma unión dos veces — M1→M2 y
  // M2→M1 — y luego la emparejaba como yee doble). Cada brazo lleva el diámetro de su ramal:
  // Principal₁×Principal₂×Derivación.
  const yeeJunctions: {
    x: number;
    y: number;
    m1: string;
    m2: string;
    branch: string;
    hostKey: string;
  }[] = [];
  if (net === 'san') {
    const allSan: Array<{
      id: string;
      planId: string;
      diametro: string;
      pts: number[][];
      trib: boolean;
    }> = [
      ...drawingRamales.map((r) => ({ ...r, trib: false })),
      ...tribDrawing.map((r) => ({ ...r, trib: true })),
    ];
    const diamOf = (r: { diametro: string }) => fmtPulg(diamPulgFromLabel(r.diametro));
    const seenPts = new Set<string>();
    for (const r of allSan) {
      if (r.pts.length < 2) continue;
      for (const P of r.pts) {
        const pKey = `${P[0].toFixed(3)}_${P[1].toFixed(3)}`;
        if (seenPts.has(pKey)) continue;
        seenPts.add(pKey);
        type Vec = { x: number; y: number; ramal: (typeof allSan)[number] };
        const vectors: Vec[] = [];
        const pushVec = (pt: number[], ramal: (typeof allSan)[number]) => {
          const dx = pt[0] - P[0];
          const dy = pt[1] - P[1];
          const len = Math.hypot(dx, dy);
          if (len > 0.1) vectors.push({ x: dx / len, y: dy / len, ramal });
        };
        for (const rr of allSan) {
          let isVertex = false;
          for (let i = 0; i < rr.pts.length; i++) {
            if (Math.hypot(rr.pts[i][0] - P[0], rr.pts[i][1] - P[1]) < 0.5) {
              isVertex = true;
              if (i > 0) pushVec(rr.pts[i - 1], rr);
              if (i < rr.pts.length - 1) pushVec(rr.pts[i + 1], rr);
            }
          }
          if (!isVertex) {
            for (let i = 0; i < rr.pts.length - 1; i++) {
              const A = rr.pts[i];
              const B = rr.pts[i + 1];
              const dx = B[0] - A[0];
              const dy = B[1] - A[1];
              const lenSq = dx * dx + dy * dy;
              if (lenSq <= 0.001) continue;
              let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / lenSq;
              t = Math.max(0, Math.min(1, t));
              const projX = A[0] + t * dx;
              const projY = A[1] + t * dy;
              const dist = Math.hypot(P[0] - projX, P[1] - projY);
              if (dist >= 0.5) continue;
              const lenA = Math.hypot(A[0] - P[0], A[1] - P[1]);
              const lenB = Math.hypot(B[0] - P[0], B[1] - P[1]);
              if (lenA > 0.5 && lenB > 0.5) {
                pushVec(A, rr);
                pushVec(B, rr);
              }
            }
          }
        }
        const uniq: Vec[] = [];
        for (const v of vectors) {
          if (!uniq.some((u) => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v);
        }
        if (uniq.length < 3 || uniq.length > 4) continue;
        let bi = -1;
        let bj = -1;
        let bestDot = 1;
        for (let i = 0; i < uniq.length; i++)
          for (let j = i + 1; j < uniq.length; j++) {
            const d = uniq[i].x * uniq[j].x + uniq[i].y * uniq[j].y;
            if (d < bestDot) {
              bestDot = d;
              bi = i;
              bj = j;
            }
          }
        if (bestDot >= -0.9) continue;
        const branches = uniq.filter((_, k) => k !== bi && k !== bj);
        if (branches.length === 0) continue;
        const cosVal = Math.abs(branches[0].x * uniq[bj].x + branches[0].y * uniq[bj].y);
        // Yee: derivación en ~45° — mismo rango |cos| ∈ [0.4, 0.85] que el engine;
        // perpendicular (~0, tee) o colineal (~1, empalme de línea) no cuenta como yee.
        if (cosVal < 0.4 || cosVal > 0.85) continue;
        const m1 = diamOf(uniq[bi].ramal);
        const m2 = diamOf(uniq[bj].ramal);
        const a1 = m1 && m1 !== '—' ? m1 : m2 || '';
        const a2 = m2 && m2 !== '—' ? m2 : m1 || '';
        const branchDiam = diamOf(branches[0].ramal);
        if (!a1 || !a2 || !branchDiam || branchDiam === '—') continue;
        // Se atribuye a un ramal NO tributario del punto (la tubería principal) para que el
        // resumen la muestre en la fila de ese tramo; si todos son tributarios, al primero.
        const pairRamals = [uniq[bi].ramal, uniq[bj].ramal];
        const main = pairRamals.find((ram) => !ram.trib) || pairRamals[0];
        yeeJunctions.push({
          x: P[0],
          y: P[1],
          m1: a1,
          m2: a2,
          branch: branchDiam,
          hostKey: `${main.id}-${main.planId}`,
        });
      }
    }
  }

  const yeeDiams: Record<string, { simple: string[]; doble: string[] }> = {};
  // Item 7: combos san×vent para uniones vent↔san, clasificando por ángulo — en Y (≈45°) va a
  // yeeSimple; perpendicular (≈90°) va a codoReventilado. Mismo criterio que calcSanitaryAccessories.
  const ventYeeCombos: Record<string, string[]> = {};
  const ventCodoCombos: Record<string, string[]> = {};
  if (net === 'san') {
    for (const v of ventRamales) {
      const vDiamStr = fmtPulg(diamPulgFromLabel(v.diametro));
      if (!vDiamStr || vDiamStr === '—') continue;
      const vEnds = [v.pts[0], v.pts[v.pts.length - 1]];
      const vVec = [v.pts[1][0] - v.pts[0][0], v.pts[1][1] - v.pts[0][1]];
      const vLen = Math.hypot(vVec[0], vVec[1]);
      for (const parent of drawingRamales) {
        let near = false;
        let segDx = 0,
          segDy = 0;
        for (const ep of vEnds) {
          for (let i = 0; i < parent.pts.length - 1; i++) {
            const [ax, ay] = parent.pts[i];
            const [bx, by] = parent.pts[i + 1];
            if (distToSegment(ep, [ax, ay], [bx, by] as [number, number]) < 0.5) {
              near = true;
              segDx = bx - ax;
              segDy = by - ay;
              break;
            }
          }
          if (near) break;
        }
        if (!near) continue;
        const pk = `${parent.id}-${parent.planId}`;
        // Nomenclatura Yee: cada brazo de la Y — la tubería principal pasa recta (dos brazos del
        // mismo diámetro) y el vent entra por el tercer brazo: san×san×vent.
        const parentDiamStr = fmtPulg(diamPulgFromLabel(parent.diametro));
        const combo = `${parentDiamStr}×${parentDiamStr}×${vDiamStr}`;
        const segLen = Math.hypot(segDx, segDy);
        const dot = Math.abs(
          (segDx / segLen) * (vVec[0] / vLen) + (segDy / segLen) * (vVec[1] / vLen),
        );
        const isY = vLen > 0.1 && segLen > 0.1 && Math.abs(dot - Math.cos(Math.PI / 4)) < 0.15;
        const target = isY ? ventYeeCombos : ventCodoCombos;
        if (!target[pk]) target[pk] = [];
        if (!target[pk].includes(combo)) target[pk].push(combo);
      }
    }
    // Emparejamiento de uniones: dos uniones a ≤10 mm en el mismo punto forman una yee doble
    // (mismo DOBLE_YEE_MM del engine); las uniones en puntos distintos son yees simples
    // separadas, aunque compartan diámetro.
    const byHost: Record<string, (typeof yeeJunctions)[number][]> = {};
    for (const j of yeeJunctions) {
      if (!byHost[j.hostKey]) byHost[j.hostKey] = [];
      byHost[j.hostKey].push(j);
    }
    for (const [hostKey, js] of Object.entries(byHost)) {
      const yd = (yeeDiams[hostKey] = yeeDiams[hostKey] || { simple: [], doble: [] });
      const used = new Set<number>();
      for (let i = 0; i < js.length; i++) {
        if (used.has(i)) continue;
        let partner = -1;
        for (let j = i + 1; j < js.length; j++) {
          if (used.has(j)) continue;
          if (Math.hypot(js[j].x - js[i].x, js[j].y - js[i].y) <= 10) {
            partner = j;
            break;
          }
        }
        if (partner >= 0) {
          used.add(i);
          used.add(partner);
          yd.doble.push(`${js[i].m1}×${js[i].m2}×${js[i].branch}×${js[partner].branch}`);
        } else {
          used.add(i);
          yd.simple.push(`${js[i].m1}×${js[i].m2}×${js[i].branch}`);
        }
      }
    }
    // Las uniones vent↔san en Y se tratan como yee simple con sus tres brazos.
    for (const t of tramos) {
      if (t.esBajante || t.tipo === 'tributario') continue;
      const tKey = String(t._key || `${t.id}-${t.planId}`);
      const yd = yeeDiams[tKey];
      const ventYeeC = ventYeeCombos[tKey] || [];
      if ((!yd || (yd.simple.length === 0 && yd.doble.length === 0)) && ventYeeC.length === 0)
        continue;
      if (!yeeDiams[tKey]) yeeDiams[tKey] = { simple: [], doble: [] };
      ventYeeC.forEach((combo) => {
        if (!yeeDiams[tKey].simple.includes(combo)) yeeDiams[tKey].simple.push(combo);
      });
    }
  }

  const hidroData = loadFromStorage<Record<string, HidroEntry>>(HYDRO_DATA_STORAGE_KEY, {});
  // Catálogo visible de la tabla: en AF/AC/LL se agrega "Codo medio 90°" — columna propia de los
  // codons puestos a mitad de ramal (ver ACC_MED_CODOS). No entra al catálogo real para no
  // aparecer en dropdowns de selección ni en otras tablas.
  const summaryCatalog =
    net === 'af' || net === 'ac' || net === 'll' ? [...catalog, CODO_MEDIO_90] : catalog;
  const totals: Record<string, Record<string, number>> = {};
  // El codo sube/baja es el MISMO codo 90° — la distinción solo dice cómo se instala (apunta
  // hacia arriba o hacia abajo), no cambia la pieza. En AF/AC/LL todo codo de 90° (rc/rm/rl y
  // sube/baja, a mitad de ramal o en un extremo) se resume en la columna "Codo medio 90°"; en
  // san se generaliza a "Codo 90°".
  const codoTarget = (id: string): string => {
    if (net !== 'san' && CODO_90_IDS.has(id)) return 'codoMedio90';
    if (id === 'codo90rmSube' || id === 'codo90rmBaja') return 'codo90rm';
    // Gas: sube/baja suman en su tipo base (estándar o radio largo) — misma pieza, otra
    // orientación de instalación.
    if (id === 'codos_90_std_sube' || id === 'codos_90_std_baja') return 'codos_90_std';
    if (id === 'codos_90_rl_sube' || id === 'codos_90_rl_baja') return 'codos_90_rl';
    return id;
  };
  const addAcc = (diam: string, accId: string, count: number) => {
    if (!totals[diam]) {
      totals[diam] = {};
      for (const a of summaryCatalog) totals[diam][a.id] = 0;
    }
    totals[diam][codoTarget(accId)] += count;
  };

  // Codons de mitad de ramal (accMed) por tramo — se cuentan desde los marcadores del dibujo en
  // la columna "Codo medio 90°" (abajo) y esa misma porción se resta de lo que calcHydroAccessories
  // arrastró a hidroData con el id de catálogo del codo elegido, para no contarla dos veces. El
  // codo de 45° (codo45rc) va en su propia fila de catálogo, con el mismo patrón de dedupe.
  const accMedCodoCounts: Record<string, Record<string, number>> = {};
  const accMed45Counts: Record<string, Record<string, number>> = {};
  const countAccMedCodos = (r: { id: string; planId: string; accMed?: Record<string, string> }) => {
    if (!r.accMed) return;
    const key = String(r.id) + '-' + String(r.planId);
    const m = (accMedCodoCounts[key] = accMedCodoCounts[key] || {});
    const m45 = (accMed45Counts[key] = accMed45Counts[key] || {});
    for (const accId of Object.values(r.accMed)) {
      if (ACC_MED_CODOS.has(accId)) m[accId] = (m[accId] || 0) + 1;
      else if (accId === 'codo45rc') m45['codo45rc'] = (m45['codo45rc'] || 0) + 1;
    }
  };
  for (const r of drawingRamales) countAccMedCodos(r);
  for (const r of tribDrawing) countAccMedCodos(r);

  // En AF/AC el diámetro puede vivir como número (diamDisPulg/diamPulg) aunque el string
  // `diametro` venga vacío o con especificación extra — se prefiere el string parseado y se cae
  // al valor numérico para que la columna de diámetro no quede en "—".
  const pulgOf = (d: string | undefined, num?: number): number =>
    diamPulgFromLabel(d || '') || num || 0;

  // Mapa id→pulgadas de los tramos, para respaldar el diámetro de ramales del dibujo cuyo
  // string `diametro` venga vacío (AF/AC guardan el número en diamDisPulg/diamPulg).
  const pulgById: Record<string, number> = {};
  for (const t of tramos) {
    if (t.esBajante) continue;
    const p = pulgOf(t.diametro || t.diametroOriginal, t.diamDisPulg || t.diamPulg);
    pulgById[t.id] = p;
    pulgById[`${t.id}-${t.planId}`] = p;
  }

  tramos.forEach((t) => {
    if (t.esBajante) return;
    const mainDiamStr = fmtPulg(
      pulgOf(t.diametro || t.diametroOriginal, t.diamDisPulg || t.diamPulg),
    );
    if (t.tipo === 'tributario') {
      const accIni = t.accesorioInicio;
      if (accIni) {
        const dStr = fmtPulg(
          pulgOf(t.diametroInicio || t.diametro || t.diametroOriginal, t.diamDisPulg || t.diamPulg),
        );
        const accId =
          accIni === 'codoSube' ? 'codo90rmSube' : accIni === 'codoBaja' ? 'codo90rmBaja' : accIni;
        addAcc(dStr, accId, 1);
      }
      const accFin = t.accesorioFin;
      if (accFin) {
        const dStr = fmtPulg(
          pulgOf(t.diametroFin || t.diametro || t.diametroOriginal, t.diamDisPulg || t.diamPulg),
        );
        const accId =
          accFin === 'codoSube' ? 'codo90rmSube' : accFin === 'codoBaja' ? 'codo90rmBaja' : accFin;
        addAcc(dStr, accId, 1);
      }
      // Accesorios implícitos que ya cuenta hidroData para el tributario — codo 90° sube junto a
      // un aparato en AF/AC, codo de bajante en LL, accMed, codoReventilado san autodetectado —
      // se suman con dedupe contra lo ya contado de accesorioInicio/Fin (replicando el alias
      // teeLado de calcHydroAccessories para que la resta no quede corta).
      const key = `${net}_${t.id}_${t.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const direct: Record<string, number> = {};
      const teeLadoAlias = new Set(['teeTapon', 'teeLlaveTerminal', 'teeSube', 'teeBaja']);
      const directAccId = (acc: string) =>
        acc === 'codoSube' ? 'codo90rmSube' : acc === 'codoBaja' ? 'codo90rmBaja' : acc;
      for (const acc of [t.accesorioInicio, t.accesorioFin]) {
        if (!acc) continue;
        const id = directAccId(acc);
        direct[id] = (direct[id] || 0) + 1;
        if (teeLadoAlias.has(id)) direct['teeLado'] = (direct['teeLado'] || 0) + 1;
      }
      const codoMed = accMedCodoCounts[String(t._key || `${t.id}-${t.planId}`)] || {};
      const codo45Med = accMed45Counts[String(t._key || `${t.id}-${t.planId}`)] || {};
      for (const a of catalog) {
        if ((net === 'af' || net === 'ac' || net === 'gas') && HYDRO_TEE_IDS.has(a.id)) continue;
        const extra = Math.max(
          0,
          (srcAcc[a.id] || 0) - (direct[a.id] || 0) - (codoMed[a.id] || 0) - (codo45Med[a.id] || 0),
        );
        if (extra > 0) addAcc(mainDiamStr, a.id, extra);
      }
    } else {
      const key = `${net}_${t.id}_${t.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const tKey = String(t._key || `${t.id}-${t.planId}`);
      const yd = yeeDiams[tKey] || { simple: [], doble: [] };
      const ventC = ventCodoCombos[tKey] || [];
      const codoMed = accMedCodoCounts[tKey] || {};
      const codo45Med = accMed45Counts[tKey] || {};
      for (const a of catalog) {
        const v = Math.max(0, (srcAcc[a.id] || 0) - (codoMed[a.id] || 0) - (codo45Med[a.id] || 0));
        if (a.id === 'yeeSimple') {
          // Nomenclatura Yee Simple: se muestra el diámetro de CADA brazo de la Y —
          // Principal×Principal×Reducción (o Principal×Principal×Principal si la derivación
          // es del mismo diámetro).
          if (yd.simple.length > 0) yd.simple.forEach((diamCombo) => addAcc(diamCombo, a.id, 1));
          else if (v > 0) addAcc(`${mainDiamStr}×${mainDiamStr}×${mainDiamStr}`, a.id, v);
        } else if (a.id === 'yeeDoble') {
          // Yee doble: dos derivaciones — Principal×Principal×Red×Red.
          if (yd.doble.length > 0) yd.doble.forEach((diamCombo) => addAcc(diamCombo, a.id, 1));
          else if (v > 0)
            addAcc(`${mainDiamStr}×${mainDiamStr}×${mainDiamStr}×${mainDiamStr}`, a.id, v);
        } else if (a.id === 'codoReventilado') {
          // Item 7: un codo reventilado que une san con vent muestra el diámetro de ambos
          // ramales (san×vent), no solo el del ramal sanitario.
          if (ventC.length > 0) ventC.forEach((combo) => addAcc(combo, a.id, v));
          else if (v > 0) addAcc(mainDiamStr, a.id, v);
        } else if (v > 0) {
          // Las tees hidro (AF/AC/gas) se cuentan SOLO desde los marcadores del dibujo
          // (bloque más abajo) para darles la nomenclatura de tres brazos sin duplicarlas.
          if ((net === 'af' || net === 'ac' || net === 'gas') && HYDRO_TEE_IDS.has(a.id)) continue;
          addAcc(mainDiamStr, a.id, v);
        }
      }
    }
  });

  // Gas (y cualquier red sin `tramos`): los accesorios de extremo/inicio se leen directo del
  // dibujo (hidroData key `${net}_${id}_${planId}`, que calcHydroAccessories escribe).
  if (net === 'gas') {
    for (const r of drawingRamales) {
      const key = `gas_${r.id}_${r.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const mainDiamStr = fmtPulg(diamPulgFromLabel(r.diametro) || pulgById[r.id] || 0);
      for (const a of catalog) {
        if (HYDRO_TEE_IDS.has(a.id)) continue;
        const v = srcAcc[a.id] || 0;
        if (v > 0) addAcc(mainDiamStr, a.id, v);
      }
    }
  }

  // Tees dibujadas a mitad de cuerpo (marcadores accMed) o en extremos (accesorioInicio/Fin) —
  // una por marcador. Nomenclatura (misma que la Y): se muestra el diámetro de CADA ramal que
  // compone la tee — Principal₁×Principal₂×Derivación. La derivación es el ramal cuyo extremo
  // toca el punto del marcador y NO es colineal con el host (tee en 90° o 45°); el segundo
  // brazo de la línea es la continuación colineal del host (reducción) o el propio host si no
  // hay reducción. Sin derivación se cae a una sola medida.
  if (net !== 'san') {
    const addTeeRow = (
      mainDiamStr: string,
      accId: string,
      pt: number[] | undefined,
      host: { id: string; pts: number[][] },
    ) => {
      let branchDiam = '';
      let contDiam = '';
      if (pt && host.pts.length >= 2) {
        const diamOf = (child: { id: string; diametro: string; planId: string }) =>
          fmtPulg(
            diamPulgFromLabel(child.diametro) ||
              pulgById[child.id] ||
              pulgById[`${child.id}-${child.planId}`] ||
              0,
          );
        // Dirección del host en el punto del marcador (el signo es irrelevante: se usa |dot|).
        let hdx = 0;
        let hdy = 0;
        for (let i = 0; i < host.pts.length - 1; i++) {
          const [ax, ay] = host.pts[i];
          const [bx, by] = host.pts[i + 1];
          if (distToSegment(pt, [ax, ay], [bx, by]) < 0.5) {
            hdx = bx - ax;
            hdy = by - ay;
            break;
          }
        }
        if (hdx === 0 && hdy === 0) {
          hdx = host.pts[1][0] - host.pts[0][0];
          hdy = host.pts[1][1] - host.pts[0][1];
        }
        const hLen = Math.hypot(hdx, hdy);
        const holders: {
          cont: { d: number; diam: string } | null;
          branch: { d: number; diam: string } | null;
        } = { cont: null, branch: null };
        const consider = (
          child: { pts: number[][]; id: string; diametro: string; planId: string },
          diamStr: string,
        ) => {
          if (!diamStr || diamStr === '—') return;
          for (const e of [child.pts[0], child.pts[child.pts.length - 1]]) {
            const d = Math.hypot(e[0] - pt[0], e[1] - pt[1]);
            if (d >= 1) continue;
            const [ea, eb] =
              e === child.pts[0]
                ? [child.pts[1], child.pts[0]]
                : [child.pts[child.pts.length - 2], child.pts[child.pts.length - 1]];
            const cDx = eb[0] - ea[0];
            const cDy = eb[1] - ea[1];
            const cLen = Math.hypot(cDx, cDy);
            if (cLen <= 0.1 || hLen <= 0.1) continue;
            const dot = Math.abs((hdx / hLen) * (cDx / cLen) + (hdy / hLen) * (cDy / cLen));
            if (dot >= 0.9) {
              // Colineal con el host: es la CONTINUACIÓN de la línea (reducción), no la
              // derivación — se usa como segundo brazo del diámetro.
              if (!holders.cont || d < holders.cont.d) holders.cont = { d, diam: diamStr };
            } else if (!holders.branch || d < holders.branch.d) {
              holders.branch = { d, diam: diamStr };
            }
          }
        };
        // El brazo de una tee es casi siempre un tributario (AF/AC) — se escanea primero para
        // que gane en empates de distancia; entre todos gana el extremo más cercano al marcador.
        for (const child of tribDrawing) {
          if (child.id === host.id) continue;
          consider(child, diamOf(child));
        }
        for (const child of drawingRamales) {
          if (child.id === host.id) continue;
          consider(child, diamOf(child));
        }
        branchDiam = holders.branch ? holders.branch.diam : '';
        contDiam = holders.cont ? holders.cont.diam : '';
      }
      if (branchDiam) addAcc(`${mainDiamStr}×${contDiam || mainDiamStr}×${branchDiam}`, accId, 1);
      else addAcc(mainDiamStr, accId, 1);
    };

    for (const r of drawingRamales) {
      const mainDiamStr = fmtPulg(diamPulgFromLabel(r.diametro) || pulgById[r.id] || 0);
      if (!mainDiamStr || mainDiamStr === '—') continue;
      if (r.accMed) {
        for (const [key, accId] of Object.entries(r.accMed)) {
          // Codons a mitad de ramal — columna propia "Codo medio 90°": en AF/AC el glifo ya no se
          // dibuja (el arco del quiebre es el codo), pero la pieza se compra y debe contarse.
          // El codo de 45° (auto-aplicado en quiebres de 45° de AF/AC) va en su fila de catálogo.
          if (ACC_MED_CODOS.has(accId)) {
            addAcc(mainDiamStr, 'codoMedio90', 1);
            continue;
          }
          if (accId === 'codo45rc') {
            addAcc(mainDiamStr, 'codo45rc', 1);
            continue;
          }
          if (!TEES_ACC_MED.has(accId)) continue;
          if (!catalog.some((a) => a.id === accId)) continue;
          const m = key.match(/^accMed(\d+)$/);
          const idx = m ? parseInt(m[1], 10) : -1;
          const pt = idx >= 0 ? r.pts[idx] : undefined;
          addTeeRow(mainDiamStr, accId, pt, r);
        }
      }
      if (r.accesorioInicio && TEES_ACC_MED.has(r.accesorioInicio)) {
        if (catalog.some((a) => a.id === r.accesorioInicio)) {
          addTeeRow(mainDiamStr, r.accesorioInicio, r.pts[0], r);
        }
      }
      if (r.accesorioFin && TEES_ACC_MED.has(r.accesorioFin)) {
        if (catalog.some((a) => a.id === r.accesorioFin)) {
          addTeeRow(mainDiamStr, r.accesorioFin, r.pts[r.pts.length - 1], r);
        }
      }
    }

    // Tributarios: sus tees de extremo no tienen derivación (la tee cierra la línea), así que
    // siempre van con una sola medida.
    for (const child of tribDrawing) {
      const mainDiamStr = fmtPulg(diamPulgFromLabel(child.diametro) || pulgById[child.id] || 0);
      if (!mainDiamStr || mainDiamStr === '—') continue;
      if (child.accMed) {
        for (const accId of Object.values(child.accMed)) {
          if (ACC_MED_CODOS.has(accId)) addAcc(mainDiamStr, 'codoMedio90', 1);
          else if (accId === 'codo45rc') addAcc(mainDiamStr, 'codo45rc', 1);
        }
      }
      for (const accId of [child.accesorioInicio || '', child.accesorioFin || '']) {
        if (!accId || !TEES_ACC_MED.has(accId)) continue;
        if (!catalog.some((a) => a.id === accId)) continue;
        addAcc(mainDiamStr, accId, 1);
      }
    }
  }

  const totalsByDiameter = Object.entries(totals)
    .map(([diametro, accesorios]) => ({ diametro, accesorios }))
    .filter((row) => Object.values(row.accesorios).some((count) => count > 0))
    .sort((a, b) => {
      const aMain = a.diametro.split('×')[0].trim();
      const bMain = b.diametro.split('×')[0].trim();
      return diamPulgFromLabel(bMain) - diamPulgFromLabel(aMain);
    });

  if (totalsByDiameter.length === 0) return null;

  // F2 + Bug 2: diámetros presentes y conteo REAL de bushings (af/ac/gas) — cada conexión de un
  // ramal menor contra un elemento mayor (ramal o bajante) es una reducción. Los menores
  // incluyen tributarios (el brazo de una tee casi siempre lo es); los mayores son los ramales
  // y bajantes del dibujo.
  let diamsPresent: string[] | undefined;
  let bushingCounts: Record<string, number> | undefined;
  if (net === 'af' || net === 'ac' || net === 'gas') {
    const seen = new Set<number>();
    for (const r of drawingRamales) {
      const p = diamPulgFromLabel(r.diametro) || pulgById[r.id] || 0;
      if (p > 0) seen.add(p);
    }
    if (seen.size >= 2) diamsPresent = [...seen].sort((a, b) => b - a).map(String);
    const minors = [
      ...drawingRamales.map((r) => ({ id: r.id, diametro: r.diametro, pts: r.pts })),
      ...tribDrawing.map((r) => ({ id: r.id, diametro: r.diametro, pts: r.pts })),
    ];
    const majors = drawingRamales.map((r) => ({ id: r.id, diametro: r.diametro, pts: r.pts }));
    const counts = computeBushingCounts(minors, majors, bajanteDrawing);
    if (Object.keys(counts).length > 0) bushingCounts = counts;
  }

  const headers = ['Diámetro', ...summaryCatalog.map((a) => a.nombre), 'Total'];
  const rows = totalsByDiameter.map((row) => {
    const total = Object.values(row.accesorios).reduce((s, n) => s + n, 0);
    return [row.diametro, ...summaryCatalog.map((a) => row.accesorios[a.id] || 0), total];
  });

  return dropAllZeroColumns(
    {
      title,
      headers,
      rows,
      ...(diamsPresent ? { diamsPresent } : {}),
      ...(bushingCounts ? { bushingCounts } : {}),
    },
    1,
    1,
  );
}
