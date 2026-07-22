import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { calcUDparcial } from './componentHelpers';
import { pisoLbl } from '../constants';
import type { MemoriaTable, MemoriaHeaderGroup } from './exportMemoriaFinal';
import { diametroManning, caudalHunterLPS, factorSimultaneidad } from './calcSanitaryCore';
import { calcHydraulicCheck } from './hydraulicCheck';
import { DIAM_OPTIONS } from '../constants';
import { computeComponentTotals } from '../lib/shared/connectionGraph';
import { distToPolyline } from '../lib/shared/geometry';
import { parseDescargaEnId } from './parseDescargaEnId';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { DrawingData, RawElement } from './drawingSync';

interface BajanteRaw extends RawElement { x?: number; y?: number }

export interface MergedApBase { id: string; nombre: string; ud: number }

export interface SanConnectivity {
  orientedConexiones: Record<string, string[]>;
  displayMap: Record<string, string[]>;
  componentTotalMap: Record<string, number>;
}

// Single source of truth for the sanitary network's connectivity graph (which tramo discharges
// into which, used to accumulate UD totals) — shared between the on-screen DisenosSanitarios
// table and the Memorias Finales export, so both always show the same numbers.
export function buildSanConnectivity(tramosSan: Tramo[], plans: PlanItem[], mergedBase: MergedApBase[]): SanConnectivity {
  const calculoMap: Record<string, string[]> = {};

  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { continue; } }

    const ramales = data.ramales || [];
    const bajantes = (data.bajantes || []) as BajanteRaw[];

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
          const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
          if (isExplicit) {
            const otherPt = pt === pEnd ? pStart : pEnd;
            const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
            if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
            continue;
          }
          if (dist < 2.0) {
            return { type: 'bajante' as const, id: b.id };
          }
        }
        let bestRx: RawElement | null = null;
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

      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null
      );

      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
        if (!calculoMap[targetKey].includes(rKey)) {
          calculoMap[targetKey].push(rKey);
        }
      }
    }
  }

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
        if (!calculoMap[lowerKey]) calculoMap[lowerKey] = [];
        if (!calculoMap[lowerKey].includes(upperKey)) {
          calculoMap[lowerKey].push(upperKey);
        }
      }
    }
  }

  for (const t of tramosSan) {
    if (t.esBajante && t.descargaEnId && t._key) {
      const parts = parseDescargaEnId(t.descargaEnId, '');
      const dPlanId = parts[0];
      const targetRamalId = parts[1];
      if (targetRamalId) {
        const targetKey = `${targetRamalId}-${dPlanId}`;
        const targetExists = tramosSan.some(x => x._key === targetKey);
        if (targetExists) {
          if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
          if (!calculoMap[targetKey].includes(t._key)) {
            calculoMap[targetKey].push(t._key);
          }
        }
      }
    }
  }

  const adj: Record<string, string[]> = {};
  for (const t of tramosSan) {
    if (t._key) {
      adj[t._key] = [];
    }
  }

  for (const [parentKey, children] of Object.entries(calculoMap)) {
    if (!adj[parentKey]) adj[parentKey] = [];
    for (const childKey of children) {
      if (!adj[childKey]) adj[childKey] = [];
      if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
      if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
    }
  }

  const getConnectedNeighbors = (startKey: string): string[] => {
    const results = new Set<string>();
    const visited = new Set<string>();
    const queue = [startKey];
    visited.add(startKey);

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node !== startKey) {
        const tr = tramosSan.find(x => x._key === node);
        const isMainRamal = tr && tr.tipo === 'ramal' && !tr.esBajante;
        if (isMainRamal) {
          results.add(node);
          continue;
        }
      }
      for (const neighbor of adj[node] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return Array.from(results);
  };

  const displayMap: Record<string, string[]> = {};
  for (const t of tramosSan) {
    if (t._key && t.tipo === 'ramal' && !t.esBajante) {
      displayMap[t._key] = getConnectedNeighbors(t._key);
    }
  }

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

  const componentTotalMap = computeComponentTotals(
    tramosSan,
    t => t._key || t.id,
    adj,
    t => calcUDparcial(t, mergedBase),
  );

  return { orientedConexiones, displayMap, componentTotalMap };
}

export interface SanRow {
  tKey: string; id: string; piso: number;
  udPropias: number; udAcum: number;
  nSalidas: number; K: number | null; Q: number | null; n: number; sVal: number;
  DcalcPulg: number; DdisPulg: number; DintMm: number;
  Qo: number; Vo: number; qqo: number; Vreal: number; chequeoV: string;
  Yc: number; Yn: number; Froude: number; tipoFlujo: string; Ymax: number; chequeoYn: string;
  fuerzaTractiva: number; chequeoFT: string;
}

// Per-tramo hydraulic design row — same formulas as the DisenosSanitarios table (Manning
// diameter estimate + calcHydraulicCheck for the full checkpoint), shared with the memoria export.
export function computeSanRows(displayTramos: Tramo[], componentTotalMap: Record<string, number>, mergedBase: MergedApBase[]): SanRow[] {
  return displayTramos.toSorted((a, b) => (a.piso || 0) - (b.piso || 0)).map(t => {
    const tKey = t._key || `${t.id}-${t.piso}`;
    const udPropias = calcUDparcial(t, mergedBase);
    const udAcum = componentTotalMap[tKey] || 0;

    const nSalidas = t.nSalidas ?? 0;
    const K = nSalidas != null && nSalidas > 0 ? Math.round(factorSimultaneidad(nSalidas) * 100) / 100 : null;
    const n = t.nmaning || 0.009;
    const sVal = t.sPercent ?? 0;
    const S = sVal != null && sVal > 0 ? sVal / 100 : null;
    const Q = udAcum > 0 && K != null ? Math.round(caudalHunterLPS(udAcum, K) * 1000) / 1000 : null;
    const dSel = DIAM_OPTIONS.find(d => d.pulg === (t.diamDisPulg || 0)) || null;
    let DcalcPulg = 0;
    const DdisPulg = dSel ? dSel.pulg : 0;
    const DintMm = dSel ? dSel.mm : 0;
    let Qo = 0, Vo = 0, qqo = 0;
    let Vreal = 0, chequeoV = '—';
    let Yc = 0, Yn = 0, Froude = 0, tipoFlujo = '—', Ymax = 0, chequeoYn = '—';
    let fuerzaTractiva = 0, chequeoFT = '—';
    if (Q != null && Q > 0 && S != null && S > 0 && n != null && n > 0) {
      DcalcPulg = Math.round(diametroManning(Q / 1000, n, S) * 1000 / 25.4 * 100) / 100;
    }
    if (Q != null && Q > 0 && S != null && S > 0 && n != null && n > 0 && DintMm > 0) {
      const hc = calcHydraulicCheck({ Q, S, n, DintMm });
      Qo = hc.Qo; Vo = hc.Vo; qqo = hc.qqo;
      Vreal = hc.Vreal; chequeoV = hc.chequeoV;
      Yc = hc.Yc; Yn = hc.Yn; Froude = hc.Froude; tipoFlujo = hc.tipoFlujo;
      Ymax = hc.Ymax; chequeoYn = hc.chequeoYn; fuerzaTractiva = hc.fuerzaTractiva; chequeoFT = hc.chequeoFT;
    }
    return {
      tKey, id: t.id, piso: t.piso,
      udPropias, udAcum, nSalidas, K, Q, n, sVal,
      DcalcPulg, DdisPulg, DintMm,
      Qo, Vo, qqo, Vreal, chequeoV,
      Yc, Yn, Froude, tipoFlujo, Ymax, chequeoYn,
      fuerzaTractiva, chequeoFT,
    };
  });
}

// Cálculo de unidades de descarga — same connectivity graph as computeSanRows, different columns
// (aparato counts per tramo instead of the hydraulic design check).
export function computeUdTable(tramosSan: Tramo[], plans: PlanItem[], mergedBase: MergedApBase[]): MemoriaTable | null {
  const displayTramos = tramosSan.filter(t => t.tipo === 'ramal' && !t.esBajante).toSorted((a, b) => (a.piso || 0) - (b.piso || 0));
  if (displayTramos.length === 0) return null;
  const { componentTotalMap } = buildSanConnectivity(tramosSan, plans, mergedBase);

  const headers = ['Tramo', 'Nivel', 'Inicio', 'Fin', ...mergedBase.map(d => `${d.nombre} (${d.ud} UD)`), 'Parcial', 'Total'];
  const headerGroups: (string | MemoriaHeaderGroup)[] = ['Tramo', 'Nivel', 'Inicio', 'Fin', { label: 'Aparatos', span: mergedBase.length }, { label: 'Unidades de descarga', span: 2 }];
  const rows = displayTramos.map(t => {
    const tKey = t._key || `${t.id}-${t.piso}`;
    const parcial = calcUDparcial(t, mergedBase);
    const acum = componentTotalMap[tKey] || 0;
    const ini = t.ini && typeof t.ini === 'object' ? `${(t.ini as { x: number; y: number }).x},${(t.ini as { x: number; y: number }).y}` : t.ini || '—';
    const fin = t.fin && typeof t.fin === 'object' ? `${(t.fin as { x: number; y: number }).x},${(t.fin as { x: number; y: number }).y}` : t.fin || '—';
    return [t.id, pisoLbl(t.piso), ini, fin, ...mergedBase.map(d => t.fixtures[d.id] ?? 0), parcial, acum];
  });

  // Sumatoria row — matches the on-screen table's tfoot: per-aparato "cant × UD" subtotal, plus
  // the grand total UD for the whole network.
  const totales = mergedBase.map(d => {
    const cant = tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0);
    return { cant, ud: d.ud, subtotal: cant * d.ud };
  });
  const totalUD = totales.reduce((s, d) => s + d.subtotal, 0);
  rows.push(['Σ', '', '', '', ...totales.map(d => `${d.cant} × ${d.ud} UD`), '', totalUD]);

  return { title: 'Cálculo de unidades de descarga', headerGroups, headers, rows };
}
