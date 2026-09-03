import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { HYDRO_DATA_STORAGE_KEY } from '../../constants/storage-keys';
import { _midpoint } from './PlanoEngineDrawing';
import { _firstSegmentAngle } from './drawingAngles';
import { type HidroDataEntry } from './deleteCascade';

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

/** Preserva el símbolo de yee doble cuando se borra uno de sus brazos: el accesorio persiste y el tronco conserva su continuidad. */
export function preserveYeeDobleAt(engine: IPlanoEngineCore, deleted: PlanoRamal): void {
  if (!deleted.yeeDobleAt || deleted.yeeDobleAt.length !== 2) return;
  const survivors = engine.ramales.filter((x) => x.net === 'san' && x.pts && x.pts.length >= 2);
  if (survivors.length === 0) return;
  let best: PlanoRamal | null = null;
  let bestD = Infinity;
  for (const yp of deleted.yeeDobleAt) {
    for (const cand of survivors) {
      let minD = Infinity;
      for (const p of cand.pts) {
        const d = Math.hypot(p[0] - yp[0], p[1] - yp[1]);
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
        const t = ((yp[0] - A[0]) * dx + (yp[1] - A[1]) * dy) / lenSq;
        const ct = Math.max(0, Math.min(1, t));
        const px = A[0] + ct * dx;
        const py = A[1] + ct * dy;
        const d = Math.hypot(yp[0] - px, yp[1] - py);
        if (d < minD) minD = d;
      }
      if (minD < bestD && minD < 20) {
        bestD = minD;
        best = cand;
      }
    }
  }
  if (best && !best.yeeDobleAt) {
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
      } catch {
        /* ignorar */
      }
    }
    // Y doble → tapón: el brazo eliminado deja extremo abierto que se cierra con tapón
    // Asignar 'tapon' al extremo de best más cercano al punto del brazo borrado
    try {
      const delPt = deleted.pts?.[0] || deleted.yeeDobleAt[0];
      const d0 = Math.hypot(best.pts[0][0] - delPt[0], best.pts[0][1] - delPt[1]);
      const d1 = Math.hypot(
        best.pts[best.pts.length - 1][0] - delPt[0],
        best.pts[best.pts.length - 1][1] - delPt[1],
      );
      const atStart = d0 <= d1;
      const accField = atStart ? 'accesorioInicio' : 'accesorioFin';
      const diamField = atStart ? 'diametroInicio' : 'diametroFin';
      if (!best[accField]) {
        (best as unknown as Record<string, unknown>)[accField] = 'tapon';
        if (!best[diamField]) (best as unknown as Record<string, unknown>)[diamField] = '2"';
        // contar en hidroData
        if (planId != null) {
          const map2 = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {});
          const kBest2 = `san_${best.id}_${planId}`;
          if (!map2[kBest2]) map2[kBest2] = { accesorios: {}, Lh: 0, nSalidas: 0 };
          if (!map2[kBest2].accesorios) map2[kBest2].accesorios = {};
          map2[kBest2].accesorios['tapon'] = (map2[kBest2].accesorios['tapon'] || 0) + 1;
          saveToStorage(HYDRO_DATA_STORAGE_KEY, map2);
        }
      }
    } catch {
      /* ignore */
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
