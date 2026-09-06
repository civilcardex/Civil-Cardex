import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { HYDRO_DATA_STORAGE_KEY } from '../../constants/storage-keys';
import { _midpoint } from './PlanoEngineDrawing';
import { _firstSegmentAngle } from './drawingAngles';
import { type HidroDataEntry } from './deleteCascade';
import { devError } from '../../../../utils/devError';

// Ítem 9/v2: borrar una MITAD de un ramal dividido (no la rama entrante) debe borrar TODA la
// división — las dos mitades colineales + la rama que la partió. Si solo se borra una mitad,
// quedan restos de la línea dividida y el usuario tiene que borrar dos veces. La rama entrante
// (mergesFrom[1]) NO se expande: borrarla re-une las mitades (comportamiento actual).
// Excepción yee doble: los ramales del brazo principal de una yee doble se borran individualmente
// (el símbolo persiste), no como cluster — ver isYeeDobleInvolved.
// ponytail: transitive closure — chain A-D1-D2 shares same logical ramal, deleting any half deletes whole cluster
/** Conjunto completo de mitades del mismo ramal lógico (cierre transitivo de mergesFrom): borrar una mitad borra toda la división. Las yees dobles se excluyen. */
export function splitMembersFor(engine: IPlanoEngineCore, ramalId: string): string[] {
  if (isYeeDobleInvolved(engine, ramalId)) return [];
  // divisor deletion must not expand (merge path)
  if (engine.ramales.some((r) => r.mergesFrom && r.mergesFrom[1] === ramalId)) return [];
  const d = engine.ramales.find((r) => r.id === ramalId);
  const isHalf =
    !!d?.mergesFrom || engine.ramales.some((r) => r.mergesFrom && r.mergesFrom[0] === ramalId);
  if (!isHalf) return [];
  // BFS over merges edges: collect whole connected component — but skip yeeDoble hosts (deben borrarse solo segmento)
  const S = new Set<string>([ramalId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const r of engine.ramales) {
      if (!r.mergesFrom) continue;
      if (r.yeeDobleAt && r.yeeDobleAt.length === 2) continue;
      if (engine.ramales.some((x) => x.id === r.id && x.yeeDobleAt && x.yeeDobleAt.length === 2))
        continue;
      const [u, i] = r.mergesFrom;
      const did = r.id;
      // no expandir si algún miembro ya es yeeDoble
      if (
        [u, i, did].some((id) =>
          engine.ramales.some((x) => x.id === id && x.yeeDobleAt && x.yeeDobleAt.length === 2),
        )
      )
        continue;
      const touches = S.has(u) || S.has(i) || S.has(did);
      if (!touches) continue;
      for (const nid of [u, i, did]) {
        if (nid && !S.has(nid) && engine.ramales.some((x) => x.id === nid)) {
          // no meter yeeDoble hosts en el set
          const cand = engine.ramales.find((x) => x.id === nid);
          if (cand && cand.yeeDobleAt && cand.yeeDobleAt.length === 2) continue;
          S.add(nid);
          expanded = true;
        }
      }
    }
  }
  S.delete(ramalId);
  return [...S];
}

// Yee doble: eximir del borrado en bloque — los ramales del brazo principal de una yee doble
// deben poder borrarse individualmente (el símbolo persiste), no como cluster colineal.
function isYeeDobleInvolved(engine: IPlanoEngineCore, ramalId: string): boolean {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r) return false;
  if (r.yeeDobleAt && r.yeeDobleAt.length === 2) return true;
  const pts = r.pts || [];
  if (pts.length < 2) return false;
  for (const other of engine.ramales) {
    if (!other.yeeDobleAt || other.yeeDobleAt.length !== 2) continue;
    for (const yp of other.yeeDobleAt) {
      for (const rp of pts) {
        if (Math.hypot(yp[0] - rp[0], yp[1] - rp[1]) < 20) return true;
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i];
        const B = pts[i + 1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) continue;
        const t = ((yp[0] - A[0]) * dx + (yp[1] - A[1]) * dy) / lenSq;
        const ct = Math.max(0, Math.min(1, t));
        const px = A[0] + ct * dx;
        const py = A[1] + ct * dy;
        if (Math.hypot(yp[0] - px, yp[1] - py) < 0.5) return true;
      }
    }
  }
  return false;
}

/** Eje del tronco de una yee doble EN UN PUNTO: busca entre los brazos sobrevivientes un par
 *  OPUESTO (colineal antiparalelo, dot < −0.9) — el tronco pasante o partido en piezas que se
 *  encuentran ahí. Devuelve el vector del primer brazo del par, o null si no hay tronco vivo. */
function trunkAxisAt(survivors: PlanoRamal[], p: number[]): { x: number; y: number } | null {
  const vecs: number[][] = [];
  for (const sr of survivors) {
    const pts = sr.pts || [];
    let isVertex = false;
    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]) < 0.5) {
        isVertex = true;
        if (i > 0) {
          const dx = pts[i - 1][0] - p[0];
          const dy = pts[i - 1][1] - p[1];
          const l = Math.hypot(dx, dy);
          if (l > 0.1) vecs.push([dx / l, dy / l]);
        }
        if (i < pts.length - 1) {
          const dx = pts[i + 1][0] - p[0];
          const dy = pts[i + 1][1] - p[1];
          const l = Math.hypot(dx, dy);
          if (l > 0.1) vecs.push([dx / l, dy / l]);
        }
      }
    }
    if (!isVertex) {
      // cuerpo atravesado: dos brazos opuestos a lo largo del segmento que contiene a p
      for (let i = 0; i + 1 < pts.length; i++) {
        const A = pts[i];
        const B = pts[i + 1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const l2 = dx * dx + dy * dy;
        if (l2 < 1e-6) continue;
        const t = ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2;
        if (t <= 0.001 || t >= 0.999) continue;
        if (Math.hypot(p[0] - (A[0] + t * dx), p[1] - (A[1] + t * dy)) < 0.5) {
          const l = Math.sqrt(l2);
          vecs.push([dx / l, dy / l]);
          vecs.push([-dx / l, -dy / l]);
        }
      }
    }
  }
  const uniq: number[][] = [];
  for (const v of vecs) {
    if (!uniq.some((u) => u[0] * v[0] + u[1] * v[1] > 0.99)) uniq.push(v);
  }
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      if (uniq[i][0] * uniq[j][0] + uniq[i][1] * uniq[j][1] < -0.9) {
        return { x: uniq[i][0], y: uniq[i][1] };
      }
    }
  }
  return null;
}

/** Preserva el símbolo de yee doble cuando se borra un brazo del TRONCO: el accesorio persiste
 *  y el tronco conserva su continuidad. Los LATERALES (tributario o ramal) no preservan nada:
 *  borrar uno deja la yee viva (tronco + otro lateral) sin tapón ni re-anclaje (orig. usuario). */
export function preserveYeeDobleAt(
  engine: IPlanoEngineCore,
  deleted: PlanoRamal,
  excludeId?: string,
): void {
  if (!deleted.yeeDobleAt || deleted.yeeDobleAt.length !== 2) return;
  const survivors = engine.ramales.filter((x) => x.net === 'san' && x.pts && x.pts.length >= 2);
  if (survivors.length === 0) return;

  // ¿Era LATERAL o TRONCO? Solo el TRONCO deja un extremo abierto que se tapa. Borrar un
  // LATERAL deja la yee viva (tronco + otro lateral) SIN tapón ni re-anclaje (orig. usuario:
  // borrar RS2/RS4 creaba tapón; PERO el segmento terminal del tronco MÁS ALLÁ de una unión
  // sí es tronco y su extremo abierto SÍ se tapa — orig. usuario). Discriminador: DIRECCIÓN
  // del brazo borrado contra el EJE del tronco de la doble.
  // · Doble de DOS uniones [P1,P2]: eje = P1→P2 (colineal aunque el tronco esté partido).
  // · Doble en UN punto [P,P]: eje = el par OPUESTO de brazos sobrevivientes en el punto
  //   (tronco pasante o partido en piezas). Sin par no hay eje → no se clasifica → tapón.
  // El lateral entra a ~45°/90° (|dot| < 0.9); el tronco a ~0°/180° (|dot| ≥ 0.9).
  const f1 = deleted.yeeDobleAt[0];
  const f2 = deleted.yeeDobleAt[1];
  // Punto de la yee doble que ocupaba el brazo borrado: el más cercano a su trazo.
  const delPt =
    [...deleted.yeeDobleAt].toSorted(
      (a, b) => minDistToPts(a, deleted.pts || []) - minDistToPts(b, deleted.pts || []),
    )[0] || deleted.yeeDobleAt[0];
  let dirIn: { x: number; y: number } | null = null;
  for (const q of deleted.pts || []) {
    const d = Math.hypot(q[0] - delPt[0], q[1] - delPt[1]);
    if (d > 1) {
      dirIn = { x: (delPt[0] - q[0]) / d, y: (delPt[1] - q[1]) / d };
      break;
    }
  }
  let axis: { x: number; y: number } | null = null;
  if (Math.hypot(f2[0] - f1[0], f2[1] - f1[1]) >= 0.5) {
    const l = Math.hypot(f2[0] - f1[0], f2[1] - f1[1]);
    axis = { x: (f2[0] - f1[0]) / l, y: (f2[1] - f1[1]) / l };
  } else {
    axis = trunkAxisAt(survivors, f1);
  }
  // Regla del usuario consolidada: borrar un TRIBUTARIO de la doble SIEMPRE deja el extremo
  // abierto → tapón (T1RS1/T1RS2, vertical o diagonal — orig. usuario). El discriminador por
  // dirección aplica solo a RAMALES: lateral a ~45° sin tapón (RS2/RS4), colineal al eje =
  // tronco → tapón. El recorte con borrador (trim) sigue su propia ruta del codo.
  const isLateral =
    deleted.tipo !== 'tributario' &&
    !!axis &&
    !!dirIn &&
    Math.abs(axis.x * dirIn.x + axis.y * dirIn.y) < 0.9;
  // Retira tapones anclados (extremos o accMed) a <0.5 de `p` en cualquier ramal san. Lo usa el
  // borrado de un LATERAL: si quedó un tapón persistido de un estado anterior anclado en esa
  // unión, muere con el lateral — el recuento (dueño del dibujo) lo saca de hidroData.
  const removeTaponAtPt = (p: number[]): void => {
    for (const rr of engine.ramales) {
      if (rr.net !== 'san' || !rr.pts || rr.pts.length < 2) continue;
      const at = (q: number[]) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5;
      if (rr.accesorioInicio === 'tapon' && at(rr.pts[0])) rr.accesorioInicio = '';
      if (rr.accesorioFin === 'tapon' && at(rr.pts[rr.pts.length - 1])) rr.accesorioFin = '';
      if (rr.accMed) {
        for (const [k, v] of Object.entries(rr.accMed)) {
          if (v !== 'tapon') continue;
          const m = k.match(/^accMed(\d+)$/);
          const idx = m ? parseInt(m[1], 10) : -1;
          if (idx >= 0 && rr.pts[idx] && at(rr.pts[idx])) delete rr.accMed[k];
        }
      }
    }
  };
  if (isLateral) {
    removeTaponAtPt(delPt);
    return;
  }

  // A partir de aquí, el brazo borrado es el TRONCO (o un caso degenerado sin eje/dirección).
  // La pieza borrada YA terminaba en tapón (es la que el caso anterior tapó): el tapón muere
  // con ella — no se re-ubica al vecino ni se re-cuenta (orig. usuario: borrar RS1 "movía"
  // el tapón al ramal de al lado).
  if (
    (deleted.accesorioInicio || '') === 'tapon' ||
    (deleted.accesorioFin || '') === 'tapon' ||
    Object.values(deleted.accMed || {}).includes('tapon')
  ) {
    return;
  }

  // Puertos abiertos que deja el brazo TRONCO borrado: los puntos de la doble que tocaba.
  // El segmento MEDIO entre las dos uniones abre DOS puertos (P1 y P2) — antes solo se tapaba
  // el más cercano y el otro quedaba abierto sin símbolo (orig. usuario: borraba el segmento
  // y no aparecía el tapón).
  const touchesPt = (p: number[]): boolean => {
    for (const q of deleted.pts || []) {
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5) return true;
    }
    for (let i = 0; i + 1 < (deleted.pts?.length || 0); i++) {
      const A = deleted.pts![i];
      const B = deleted.pts![i + 1];
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-9) continue;
      const t = ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / lenSq;
      if (t <= 0.001 || t >= 0.999) continue;
      if (Math.hypot(p[0] - (A[0] + t * dx), p[1] - (A[1] + t * dy)) < 0.5) return true;
    }
    return false;
  };
  const ports: number[][] = [];
  for (const p of [f1, f2]) {
    if (!ports.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5) && touchesPt(p)) {
      ports.push(p);
    }
  }
  if (ports.length === 0) ports.push(delPt);

  for (const port of ports) {
    // Dirección del brazo borrado ENTRANDO a este puerto: el continuo colineal es el BRAZO
    // PRINCIPAL restante — el tapón va ahí, no en un lateral a distancia 0 (orig. usuario).
    let dirInPort: { x: number; y: number } | null = null;
    for (const q of deleted.pts || []) {
      const d = Math.hypot(q[0] - port[0], q[1] - port[1]);
      if (d > 1) {
        dirInPort = { x: (port[0] - q[0]) / d, y: (port[1] - q[1]) / d };
        break;
      }
    }
    let best: PlanoRamal | null = null;
    let bestD = Infinity;
    let bestScore = -Infinity;
    for (const cand of survivors) {
      if (excludeId && cand.id === excludeId) continue;
      let minD = Infinity;
      for (const p of cand.pts) {
        const d = Math.hypot(p[0] - port[0], p[1] - port[1]);
        if (d < minD) minD = d;
      }
      // también distancia a segmento para troncos que pasan por el punto sin vértice exacto
      for (let i = 0; i < cand.pts.length - 1; i++) {
        const A = cand.pts[i];
        const B = cand.pts[i + 1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) continue;
        const t = ((port[0] - A[0]) * dx + (port[1] - A[1]) * dy) / lenSq;
        const ct = Math.max(0, Math.min(1, t));
        const px = A[0] + ct * dx;
        const py = A[1] + ct * dy;
        const d = Math.hypot(port[0] - px, port[1] - py);
        if (d < minD) minD = d;
      }
      if (minD >= 20) continue;
      // Colinealidad del brazo del sobreviviente con el entrante: el punto del cand más lejano
      // al puerto define su dirección de salida del punto.
      let score = 0;
      if (dirInPort) {
        let far: number[] | null = null;
        let farD = -1;
        for (const p of cand.pts) {
          const d = Math.hypot(p[0] - port[0], p[1] - port[1]);
          if (d > farD) {
            farD = d;
            far = p;
          }
        }
        if (far && farD > 1) {
          const outX = (far[0] - port[0]) / farD;
          const outY = (far[1] - port[1]) / farD;
          score = dirInPort.x * outX + dirInPort.y * outY;
        }
      }
      // Preferir colineal (score alto — continuo del brazo principal); desempate por distancia.
      // Margen 0.1: colineal (1.0) debe ganar a un lateral a 45° (0.707).
      if (score > bestScore + 0.1 || (Math.abs(score - bestScore) <= 0.1 && minD < bestD)) {
        bestD = minD;
        best = cand;
        bestScore = score;
      }
    }
    if (!best) continue;
    if (!best.yeeDobleAt) {
      best.yeeDobleAt = deleted.yeeDobleAt;
      const planId = engine._loadedPlanId;
      if (planId != null) {
        try {
          const map = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {});
          const kDel = `san_${deleted.id}_${planId}`;
          const kBest = `san_${best.id}_${planId}`;
          const delEntry = map[kDel];
          const yeeVal = delEntry?.accesorios?.['yeeDoble'] ?? 1;
          if (!map[kBest]) map[kBest] = { accesorios: {}, Lh: 0, nSalidas: 0 };
          if (!map[kBest].accesorios) map[kBest].accesorios = {};
          map[kBest].accesorios['yeeDoble'] = yeeVal;
          saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
        } catch (e) {
          devError('PlanoEngine:', e);
        }
      }
    }
    placeTaponOnHost(engine, best, port);
  }
  // Memoria de un pase para calcSanitaryAccessories: estos tapones son del caso doble VIVO
  // (puertos recién tapados) — su limpieza de banderas muertas no debe retirarlos en la
  // misma pasada (la geometría L resultante es idéntica al desarme viejo).
  if (ports.length > 0) {
    (engine as unknown as { _taponKeepPts?: number[][] })._taponKeepPts = ports.map((p) => [
      p[0],
      p[1],
    ]);
  }
}

/** Distancia mínima de un punto a una lista de vértices. */
function minDistToPts(p: number[], pts: number[][]): number {
  let d = Infinity;
  for (const q of pts) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1]));
  return d;
}

/** Tapón en el punto `pt` del brazo principal `host`: extremo libre → accesorioInicio/Fin;
 *  vértice intermedio → accMed{idx}. El punto de yee puede caer a MITAD de un segmento del
 *  tronco (la unión la detecta el lateral que toca el cuerpo) — ahí se inserta un vértice en
 *  `pt` y se ancla el accMed a él (reindexando los accMed posteriores). Diámetro = el del
 *  brazo principal (host.diametro) y conteo +1 en hidroData. No pisa un accesorio ya presente. */
export function placeTaponOnHost(engine: IPlanoEngineCore, host: PlanoRamal, pt: number[]): void {
  if (!host.pts || host.pts.length < 2) return;
  let bestIdx = 0;
  let bestD = Infinity;
  for (let i = 0; i < host.pts.length; i++) {
    const d = Math.hypot(host.pts[i][0] - pt[0], host.pts[i][1] - pt[1]);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  if (bestD > 1) {
    // Proyección sobre el segmento más cercano: si `pt` cae sobre el cuerpo (no en un
    // vértice), se inserta como vértice nuevo del host.
    let segIdx = -1;
    let segD = Infinity;
    for (let i = 0; i + 1 < host.pts.length; i++) {
      const A = host.pts[i];
      const B = host.pts[i + 1];
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      const l2 = dx * dx + dy * dy;
      if (l2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((pt[0] - A[0]) * dx + (pt[1] - A[1]) * dy) / l2));
      const d = Math.hypot(pt[0] - (A[0] + t * dx), pt[1] - (A[1] + t * dy));
      if (d < segD) {
        segD = d;
        segIdx = i;
      }
    }
    if (segIdx === -1 || segD > 1) return;
    host.pts.splice(segIdx + 1, 0, [pt[0], pt[1]]);
    // Reindexar accMed posteriores al punto insertado (accMed{v} = accesorio en vértice v).
    if (host.accMed) {
      const shifted: Record<string, string> = {};
      for (const [k, v] of Object.entries(host.accMed)) {
        const m = k.match(/^accMed(\d+)$/);
        const idx = m ? parseInt(m[1], 10) : -1;
        shifted[idx >= segIdx + 1 ? `accMed${idx + 1}` : k] = v;
      }
      host.accMed = shifted;
    }
    bestIdx = segIdx + 1;
  }
  const h = host as unknown as Record<string, unknown>;
  const accField =
    bestIdx === 0 ? 'accesorioInicio' : bestIdx === host.pts.length - 1 ? 'accesorioFin' : null;
  if (accField) {
    if (h[accField]) return;
    h[accField] = 'tapon';
    const diamField = accField === 'accesorioInicio' ? 'diametroInicio' : 'diametroFin';
    if (!h[diamField]) h[diamField] = host.diametro || '2"';
  } else if (host.accMed?.[`accMed${bestIdx}`]) {
    return;
  } else {
    if (!host.accMed) host.accMed = {};
    host.accMed[`accMed${bestIdx}`] = 'tapon';
  }
  const planId = engine._loadedPlanId;
  if (planId != null) {
    try {
      const map = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {});
      const kBest = `san_${host.id}_${planId}`;
      if (!map[kBest]) map[kBest] = { accesorios: {}, Lh: 0, nSalidas: 0 };
      if (!map[kBest].accesorios) map[kBest].accesorios = {};
      map[kBest].accesorios['tapon'] = (map[kBest].accesorios['tapon'] || 0) + 1;
      saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
    } catch (e) {
      devError('PlanoEngine:', e);
    }
  }
}

/** ¿El ramal borrado era parte de una yee doble? Por bandera propia o por coincidencia de posición con los brazos de otra. */
export function isDeletedYeeDoblePart(engine: IPlanoEngineCore, deleted: PlanoRamal): boolean {
  if (deleted.yeeDobleAt && deleted.yeeDobleAt.length === 2) return true;
  const pts = deleted.pts || [];
  for (const other of engine.ramales) {
    if (!other.yeeDobleAt || other.yeeDobleAt.length !== 2) continue;
    for (const yp of other.yeeDobleAt) {
      for (const rp of pts) {
        if (Math.hypot(yp[0] - rp[0], yp[1] - rp[1]) < 20) return true;
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i];
        const B = pts[i + 1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) continue;
        const t = ((yp[0] - A[0]) * dx + (yp[1] - A[1]) * dy) / lenSq;
        const ct = Math.max(0, Math.min(1, t));
        const px = A[0] + ct * dx;
        const py = A[1] + ct * dy;
        if (Math.hypot(yp[0] - px, yp[1] - py) < 0.5) return true;
      }
    }
  }
  return false;
}
