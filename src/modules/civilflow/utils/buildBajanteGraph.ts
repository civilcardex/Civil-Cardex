import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import { pisoLbl } from "../constants";
import { distToPolyline } from "../lib/shared/geometry";
import { parseDescargaEnId } from "./parseDescargaEnId";
import { calcUDparcial, type UDBase } from "./componentHelpers";
import type { Tramo } from "../context/tramosReducer";
import type { RawElement } from "./drawingSync";

interface PlanEntry {
  id: string | number;
  nivel: number | null;
}
interface RamalRaw extends RawElement {
  diamPulg?: number;
}
interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
  desplazamientos?: Record<string, { dx?: number; dy?: number }>;
}

export function buildBajanteGraph(plans: PlanEntry[], tramosSan: Tramo[], udBase: UDBase[]) {
  const map: Record<string, string[]> = {};
  const vMap: Record<string, string[]> = {};
  const ventRamalDiamMap: Record<string, number> = {};

  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw as { ramales?: RamalRaw[]; bajantes?: BajanteRaw[] };
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { continue; } }

    const ramales = data.ramales || [];
    const bajantes = data.bajantes || [];

    const getBajantePos = (b: BajanteRaw) => {
      const lvl = pisoLbl(plan.nivel ?? 0);
      const disp = b.desplazamientos?.[lvl] || {};
      return {
        x: (b.x || 0) + (disp.dx || 0),
        y: (b.y || 0) + (disp.dy || 0)
      };
    };

    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const rKey = `${r.id}-${plan.id}`;

      const checkEndpoint = (pt: number[]) => {
        for (const b of bajantes) {
          const isDischargingIntoR = b.descargaEnId && (
            b.descargaEnId === `${plan.id}|${r.id}` ||
            b.descargaEnId === r.id ||
            (r.label && (b.descargaEnId === `${plan.id}|${r.label}` || b.descargaEnId === r.label))
          );
          if (isDischargingIntoR) continue;

          const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
          const bPos = getBajantePos(b);
          const dist = Math.hypot(pt[0] - bPos.x, pt[1] - bPos.y);
          if (isExplicit) {
            // Explicit link doesn't say which end — assign it to whichever endpoint is
            // geometrically closer, so a bajante at each end each claims its own.
            const otherPt = pt === pEnd ? pStart : pEnd;
            const otherDist = Math.hypot(otherPt[0] - bPos.x, otherPt[1] - bPos.y);
            if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
            continue;
          }
          if (dist < 2.0) {
            return { type: 'bajante' as const, id: b.id };
          }
        }
        let bestRx: RamalRaw | null = null;
        let minDist = Infinity;
        for (const rx of ramales) {
          if (rx.id === r.id) continue;
          if (!rx.pts || rx.pts.length < 2) continue;
          const dist = distToPolyline(pt, rx.pts);
          if (dist < 2.0 && dist < minDist) {
            minDist = dist;
            bestRx = rx;
          }
        }
        if (bestRx) {
          return { type: 'ramal' as const, id: bestRx.id };
        }
        return null;
      };

      // A ramal can have a bajante at EACH end — check both endpoints independently instead
      // of short-circuiting on the first match, otherwise the second bajante is silently
      // dropped and its discharge units never get counted.
      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null
      );

      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        if (!map[targetKey]) map[targetKey] = [];
        if (!map[targetKey].includes(rKey)) {
          map[targetKey].push(rKey);
        }
      }
    }

    const ventBajantes = bajantes.filter((b: BajanteRaw) => b.net === 'vent');
    const ventRamales = ramales.filter((r: RamalRaw) => r.net === 'vent');

    for (const vb of ventBajantes) {
       const vbKey = `${vb.id}-${plan.id}`;
       if (!vMap[vbKey]) vMap[vbKey] = [];

       for (const vr of ventRamales) {
          const isExplicit = vb.recibeDeIds && (vb.recibeDeIds.includes(vr.id) || (vr.label && vb.recibeDeIds.includes(vr.label)));
          let isConnected = isExplicit;
          if (!isConnected && vr.pts && vr.pts.length >= 2) {
             const vbPos = getBajantePos(vb);
             const d1 = Math.hypot(vr.pts[0][0] - vbPos.x, vr.pts[0][1] - vbPos.y);
             const d2 = Math.hypot(vr.pts[vr.pts.length-1][0] - vbPos.x, vr.pts[vr.pts.length-1][1] - vbPos.y);
             if (d1 < 2.0 || d2 < 2.0) isConnected = true;
          }
          if (isConnected) {
             let foundSanId: string | null = null;

             if (vr.descargaEnId) {
                const parts = parseDescargaEnId(vr.descargaEnId, plan.id);
                if (parts[1] !== vb.id && parts[1] !== vb.label) {
                   const sanKey = `${parts[1]}-${parts[0]}`;
                   if (!vMap[vbKey].includes(sanKey)) vMap[vbKey].push(sanKey);
                   continue;
                }
             }

             const sanRamales = ramales.filter((r: RamalRaw) => r.net === 'san');
             const sanBajantes = bajantes.filter((b: BajanteRaw) => b.net === 'san');

             if (vr.pts && vr.pts.length >= 2) {
                const pt1 = vr.pts[0];
                const pt2 = vr.pts[vr.pts.length - 1];

                for (const sb of sanBajantes) {
                   const sbPos = getBajantePos(sb);
                   if (Math.hypot(pt1[0] - sbPos.x, pt1[1] - sbPos.y) < 2.0 || Math.hypot(pt2[0] - sbPos.x, pt2[1] - sbPos.y) < 2.0) {
                      foundSanId = sb.id;
                      break;
                   }
                }

                if (!foundSanId) {
                   for (const sr of sanRamales) {
                      if (!sr.pts || sr.pts.length < 2) continue;
                      const d1 = distToPolyline(pt1, sr.pts);
                      const d2 = distToPolyline(pt2, sr.pts);
                      if (d1 < 2.0 || d2 < 2.0) {
                         foundSanId = sr.id;
                         break;
                      }
                   }
                }
             }

             if (foundSanId) {
                const sk = `${foundSanId}-${plan.id}`;
                if (!vMap[vbKey].includes(sk)) vMap[vbKey].push(sk);
             }
          }
       }
    }

    // Build vent ramal diameter map from drawing data
    for (const vr of ventRamales) {
      const diam = vr.diamPulg || (vr.diametro ? parseFloat(String(vr.diametro).replace(/[^0-9.]/g, '')) : 0);
      if (diam > 0) {
        ventRamalDiamMap[`${vr.id}-${plan.id}`] = diam;
      }
    }
  }



  // Add vertical connections for bajantes (from upper to lower sections)
  const bajantesGroups: Record<string, typeof tramosSan> = {};
  for (const t of tramosSan) {
    if (t.esBajante && t.id) {
      if (!bajantesGroups[t.id]) bajantesGroups[t.id] = [];
      bajantesGroups[t.id].push(t);
    }
  }

  for (const sections of Object.values(bajantesGroups)) {
    sections.sort((a, b) => (a.piso || 0) - (b.piso || 0));
    for (let i = 0; i < sections.length - 1; i++) {
      const lowerKey = sections[i]._key;
      const upperKey = sections[i + 1]._key;
      if (lowerKey && upperKey) {
        if (!map[lowerKey]) map[lowerKey] = [];
        if (!map[lowerKey].includes(upperKey)) {
          map[lowerKey].push(upperKey);
        }
      }
    }
  }

  // Add discharge connections (descargaEnId) of bajantes into lower ramales
  for (const t of tramosSan) {
    if (t.esBajante && t.descargaEnId && t._key) {
      const parts = parseDescargaEnId(t.descargaEnId, '');
      const dPlanId = parts[0];
      const targetRamalId = parts[1];
      if (targetRamalId) {
        const targetKey = `${targetRamalId}-${dPlanId}`;
        const targetExists = tramosSan.some(x => x._key === targetKey);
        if (targetExists) {
          if (!map[targetKey]) map[targetKey] = [];
          if (!map[targetKey].includes(t._key)) {
            map[targetKey].push(t._key);
          }
        }
      }
    }
  }

  // Build undirected adjacency list for all tramos
  const adj: Record<string, string[]> = {};
  for (const t of tramosSan) {
    if (t._key) {
      adj[t._key] = [];
    }
  }

  for (const [parentKey, children] of Object.entries(map)) {
    if (!adj[parentKey]) adj[parentKey] = [];
    for (const childKey of children) {
      if (!adj[childKey]) adj[childKey] = [];
      if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
      if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
    }
  }

  // Find connected components in the full graph `adj`
  const compVisited = new Set<string>();
  const components: string[][] = [];

  for (const node of Object.keys(adj)) {
    if (!compVisited.has(node)) {
      const comp: string[] = [];
      const q = [node];
      compVisited.add(node);
      while (q.length > 0) {
        const curr = q.shift()!;
        comp.push(curr);
        for (const neigh of adj[curr] || []) {
          if (!compVisited.has(neigh)) {
            compVisited.add(neigh);
            q.push(neigh);
          }
        }
      }
      components.push(comp);
    }
  }

  const getRootScore = (key: string): number => {
    const tr = tramosSan.find(x => x._key === key);
    if (!tr) return 99999999;
    const piso = tr.piso || 0;
    const isBajante = tr.esBajante;
    const id = tr.id || '';
    const match = id.match(/^([a-zA-Z]+)(\d+)?$/);
    const num = match && match[2] ? parseInt(match[2]) : 999;
    return (piso * 100000) + (isBajante ? 0 : 10000) + num;
  };

  const orientedConexiones: Record<string, string[]> = {};
  const orientedVisited = new Set<string>();

  for (const comp of components) {
    let root = comp[0];
    let minScore = getRootScore(root);
    for (const node of comp) {
      const score = getRootScore(node);
      if (score < minScore) {
        minScore = score;
        root = node;
      }
    }

    const q = [root];
    orientedVisited.add(root);
    while (q.length > 0) {
      const parent = q.shift()!;
      if (!orientedConexiones[parent]) orientedConexiones[parent] = [];
      for (const child of adj[parent] || []) {
        if (!orientedVisited.has(child)) {
          orientedVisited.add(child);
          orientedConexiones[parent].push(child);
          q.push(child);
        }
      }
    }
  }

  // Compute connected-component totals
  const tramoById: Record<string, Tramo> = {};
  for (const t of tramosSan) {
    const key = t._key || t.id;
    if (key) tramoById[key] = t;
  }
  const parcialMap: Record<string, number> = {};
  for (const t of tramosSan) {
    const key = t._key || t.id;
    if (key) parcialMap[key] = calcUDparcial(t, udBase);
  }
  return [orientedConexiones, vMap, ventRamalDiamMap, components] as const;
}
