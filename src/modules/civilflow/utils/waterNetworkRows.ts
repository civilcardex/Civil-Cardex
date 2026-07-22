import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { AF_UC_IDS, AC_UC_IDS, APARATOS_DEF, matHazenC } from '../constants';
import { calcUCparcial } from './componentHelpers';
import { calcLeAcces } from './accesoriosUtils';
import { computeComponentTotals } from '../lib/shared/connectionGraph';
import { distToPolyline } from '../lib/shared/geometry';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { DrawingData, RawElement } from './drawingSync';
import { CONTADORES as CONTADORES_CAT } from '../pages/catalog/catalogData';
import { findContadorBajante } from './writeDiameterToDrawing';

interface BajanteRaw extends RawElement { x?: number; y?: number }

const isAf = (t: string) => t === 'af';
const isContador = (s: string) => s.startsWith('CNT') || s.startsWith('cntAF');

const isAC1 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
  if (isContador(fin) && !isContador(ini) && !ini.startsWith('M') && !ini.startsWith('B')) return true;
  return false;
};

const isAC2 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return false;
  if (isContador(ini)) return true;
  if (isContador(fin) && (ini.startsWith('M') || ini.startsWith('B'))) return true;
  return false;
};

// Same sigla → code transform PlanoEngineNetwork.ts applies when writing a fixture's abbreviation
// into a ramal's ini/fin: "Duc:" -> "DUC".
const APARATO_PMAX_BY_CODE: Record<string, number> = Object.fromEntries(
  APARATOS_DEF.map(a => [a.sigla.replace(':', '').trim().toUpperCase(), a.pmax])
);
const HEATER_LOSS_FACTOR = 0.9;

export interface WnRow {
  id: string; ini: string; fin: string; piso: number;
  udPropia: number; udTotal: number; nDesc: number; K: number;
  Qprob: number; diamEst: number; diamDis: string; dInt: number;
  cHW: number; Vmms: number;
  Lh: number; Lv: number; Le: number; Lt: number;
  hfPct: number; hfM: number; Pin: number; Pfin: number;
}

// Snapshot version of WaterNetworkDesign.tsx's own row computation (connectivity graph, pressure
// tree, Hazen-Williams losses) — used by the on-screen table via live component state (diameter
// picks pending save, manual pressure edits) and, here, as a pure function using only what's
// already persisted on the Tramo objects, so the memoria export never depends on the user having
// opened that specific screen first.
export function computeWaterNetworkRows(
  networkType: 'af' | 'ac',
  tramosOwn: Tramo[],
  tramosAf: Tramo[],
  plans: PlanItem[],
  pRedStr: string,
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>,
  lookupFn: (pulg: number) => number,
): WnRow[] {
  const tramos = tramosOwn;
  const DIAM_OPTS = diamTable.map(d => ({ pulg: d.pulg, nominal: d.nominal, label: d.nominal, dInt: d.dInt }));
  const ucIds = isAf(networkType) ? AF_UC_IDS : AC_UC_IDS;
  const ucField = isAf(networkType) ? 'uc_af' : 'uc_ac';
  const AP = ucIds
    .map((id) => {
      const a = APARATOS_DEF.find((x) => x.id === id);
      return a ? { id: a.id, uc: a[ucField as 'uc_af' | 'uc_ac'] } : null;
    })
    .filter((x): x is { id: string; uc: number } => x !== null);

  // ── Connectivity graph + directed pressure tree (mirrors the useMemo in WaterNetworkDesign.tsx) ──
  const calculoMap: Record<string, string[]> = {};
  const bajanteNodes: Array<{ key: string; x: number; y: number; nivel: number }> = [];

  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { continue; } }

    const ramales = (data.ramales || []).filter((r) => r.net === networkType);
    const bajantes = (data.bajantes || []).filter((b): b is BajanteRaw => b.net === networkType);
    for (const b of bajantes) {
      if (b.x == null || b.y == null) continue;
      bajanteNodes.push({ key: `${b.id}-${plan.id}`, x: b.x, y: b.y, nivel: plan.nivel });
    }

    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const rKey = `${r.id}-${plan.id}`;

      const checkEndpoint = (pt: number[]) => {
        for (const b of bajantes) {
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
        if (bestRx) return { type: 'ramal' as const, id: bestRx.id };
        return null;
      };

      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null
      );

      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
        if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
      }
    }
  }

  const usedNode = new Set<number>();
  for (let i = 0; i < bajanteNodes.length; i++) {
    if (usedNode.has(i)) continue;
    const group = [bajanteNodes[i]];
    usedNode.add(i);
    for (let j = i + 1; j < bajanteNodes.length; j++) {
      if (usedNode.has(j)) continue;
      if (Math.hypot(bajanteNodes[j].x - bajanteNodes[i].x, bajanteNodes[j].y - bajanteNodes[i].y) < 2.0) {
        group.push(bajanteNodes[j]);
        usedNode.add(j);
      }
    }
    if (group.length < 2) continue;
    group.sort((a, b) => a.nivel - b.nivel);
    for (let k = 0; k < group.length - 1; k++) {
      const a = group[k].key, b = group[k + 1].key;
      if (!calculoMap[a]) calculoMap[a] = [];
      if (!calculoMap[a].includes(b)) calculoMap[a].push(b);
    }
  }

  const adj: Record<string, string[]> = {};
  for (const t of tramos) {
    const key = t._key || t.id;
    adj[key] = [];
  }
  for (const [parentKey, children] of Object.entries(calculoMap)) {
    if (!adj[parentKey]) adj[parentKey] = [];
    for (const childKey of children) {
      if (!adj[childKey]) adj[childKey] = [];
      if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
      if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
    }
  }

  const componentTotalMap = computeComponentTotals(
    tramos,
    t => t._key || t.id,
    adj,
    t => calcUCparcial(t, AP, 'uc'),
  );

  const rootT = isAf(networkType)
    ? tramos.find(isAC2)
    : tramos.find(t => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'));
  const rootKey = rootT ? (rootT._key || rootT.id) : null;

  const nodeParentOf: Record<string, string> = {};
  if (rootKey) {
    const visited = new Set<string>([rootKey]);
    const queue = [rootKey];
    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const neighbor of adj[node] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nodeParentOf[neighbor] = node;
          queue.push(neighbor);
        }
      }
    }
  }

  const tramoKeySet = new Set(tramos.map(t => t._key || t.id));
  const tramoParentOf: Record<string, string> = {};
  for (const t of tramos) {
    const key = t._key || t.id;
    let cur = nodeParentOf[key];
    while (cur && !tramoKeySet.has(cur)) cur = nodeParentOf[cur];
    if (cur) tramoParentOf[key] = cur;
  }

  const propiaMap: Record<string, number> = {};
  for (const t of tramos) {
    propiaMap[t._key || t.id] = calcUCparcial(t, AP, 'uc');
  }

  const pRed = parseFloat(pRedStr) || 20;
  const tramosOrden = tramos.filter(t => t.tipo !== 'tributario' && !t.esBajante && !isAC1(t)).sort((a, b) => (b.piso || 0) - (a.piso || 0));

  // ── Acometida (AF only) — same defaults WaterNetworkDesign.tsx's own useState starts with ──
  const tr1 = isAf(networkType) ? tramos.find(isAC1) : null;
  const tr2 = isAf(networkType) ? tramos.find(isAC2) : null;
  const acoContMonDiam = 1.25;
  const acoL1Default = { h: 10.00, v: 0.00, le: 0.47 };
  const acoPini = 20.00;
  const acoLeMed = 0;

  const resolvedContMonDiam = (() => {
    if (tr2) {
      if (tr2.diametroOriginal) {
        const match = diamTable.find(o => tr2.diametroOriginal?.startsWith(o.nominal));
        if (match) return match.nominal;
      }
      const match = diamTable.find(o => Math.abs(o.pulg - (tr2.diamDisPulg ?? 0)) < 0.01);
      if (match) return match.nominal;
    }
    const fallbackPulg = acoContMonDiam || 0.75;
    const match = diamTable.find(o => Math.abs(o.pulg - fallbackPulg) < 0.01);
    return match ? match.nominal : '3/4" RDE 11';
  })();
  const resolvedRedContDiam = resolvedContMonDiam;

  const resolvedL1 = (() => {
    if (tr1) {
      const opt = resolvedRedContDiam ? diamTable.find(d => d.nominal === resolvedRedContDiam) : null;
      const realPulg = opt ? opt.pulg : (tr1.diamDisPulg || 0);
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0.00, le };
    }
    return acoL1Default;
  })();

  let ucTotal = 0;
  for (const t of tramos) ucTotal += propiaMap[t._key || t.id] || 0;

  const Qaco = (() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      const total = componentTotalMap[ownKey] || 0;
      const nDesc = tr2.nSalidas || 0;
      const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      if (total > 0 && K > 0) {
        return Math.round(K * (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) * 1000) / 1000;
      }
    }
    return ucTotal > 0 ? Math.round((0.1163 * Math.pow(ucTotal, 0.6875)) * 1000) / 1000 : 0;
  })();

  const calcFila = (nominal: string, h: number, v: number, le: number, pIn: number, cHW: number) => {
    const opt = nominal ? diamTable.find(d => d.nominal === nominal) : null;
    const dInt = opt ? opt.dInt : 0;
    const V = Qaco > 0 && dInt > 0 ? Math.round((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt) * 10) / 10 : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct = Math.round(((60.1 * Math.pow(V, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(dInt, 1.167))) * 100) / 100;
    const hfM = Math.round((hfPct / 100) * Lt * 100) / 100;
    const Pfin = +(pIn - (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const cHW1 = matHazenC(tr1?.material || '') ?? 150;
  const acoL1LeTotal = resolvedL1.le + acoLeMed;
  const f1 = calcFila(resolvedRedContDiam || '', resolvedL1.h, resolvedL1.v, acoL1LeTotal, acoPini, cHW1);

  // AC has no acometida of its own — fed from the water heater, itself fed from AF's own
  // resolved pressure at the shared calentador node (persisted onto the AF Tramo as `pFin`).
  const afHeaterPfin = isAf(networkType)
    ? null
    : (tramosAf.find(t => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'))?.pFin ?? null);

  const byKey = new Map(tramosOrden.map(t => [t._key || t.id, t]));

  const pipeLoss = (t: Tramo) => {
    const ownKey = t._key || t.id;
    const isTr2Row = t === tr2;
    const total = componentTotalMap[ownKey] || 0;
    const nDesc = t.nSalidas || 0;
    const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
    const Qprob = isTr2Row ? Qaco : (total > 0 && K > 0 ? Math.round(K * (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) * 1000) / 1000 : 0);
    const disPulg = t.diamDisPulg || 0;
    const matchedOpt = (t.diametroOriginal ? DIAM_OPTS.find(o => t.diametroOriginal?.startsWith(o.nominal)) : undefined) || DIAM_OPTS.find(o => Math.abs(o.pulg - disPulg) < 0.01);
    const internoMm = matchedOpt ? matchedOpt.dInt : (lookupFn(disPulg) || 0);
    const Vmms = Qprob > 0 && internoMm > 0 ? Math.round((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm) * 10) / 10 : 0;
    const H = t.totalL || t.Lh || 0;
    const Vvert = t.Lv != null ? Number(t.Lv) : (t.deltaZ != null ? Number(t.deltaZ) : 0);
    const realPulg = matchedOpt ? matchedOpt.pulg : disPulg;
    const cHW = matHazenC(t.material || '') ?? 150;
    const Le = calcLeAcces(t.accesorios ?? {}, realPulg, cHW);
    const Lt = H + Vvert + Le;
    const hfPct = Vmms > 0 && cHW > 0 && internoMm > 0 ? Math.round(((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(internoMm, 1.167))) * 100) / 100 : 0;
    const hfM = Lt > 0 && hfPct > 0 ? Math.round((Lt * hfPct) / 1000 * 100) / 100 : 0;
    return { Vvert, hfM };
  };

  const result: Record<string, { Pin: number; Pfin: number }> = {};
  const resolving = new Set<string>();
  const resolve = (key: string): { Pin: number; Pfin: number } => {
    if (result[key]) return result[key];
    if (resolving.has(key)) return { Pin: pRed, Pfin: pRed };
    resolving.add(key);
    const t = byKey.get(key);
    if (!t) { resolving.delete(key); return { Pin: pRed, Pfin: pRed }; }

    let PinCalc: number;
    if (key === rootKey) {
      PinCalc = isAf(networkType) ? f1.Pfin : (afHeaterPfin != null ? afHeaterPfin * HEATER_LOSS_FACTOR : pRed);
    } else {
      const fixturePmax = APARATO_PMAX_BY_CODE[String(t.ini || '').toUpperCase()];
      if (fixturePmax !== undefined) {
        PinCalc = fixturePmax;
      } else {
        const parentKey = tramoParentOf[key];
        PinCalc = parentKey ? resolve(parentKey).Pfin : pRed;
      }
    }

    const Pin = PinCalc;
    const { Vvert, hfM } = pipeLoss(t);
    const Pfin = Pin - Vvert - hfM;
    resolving.delete(key);
    result[key] = { Pin, Pfin };
    return result[key];
  };
  for (const t of tramosOrden) resolve(t._key || t.id);

  return tramosOrden.map(t => {
    const ownKey = t._key || t.id;
    const propia = propiaMap[ownKey] || 0;
    const total = componentTotalMap[ownKey] || 0;
    const isTr2Row = t === tr2;
    const nDesc = t.nSalidas || 0;
    const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
    const Qprob = isTr2Row ? Qaco : (total > 0 && K > 0 ? Math.round(K * (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) * 1000) / 1000 : 0);
    const raizQ = Qprob > 0 ? Math.round(Math.sqrt(Qprob) * 100) / 100 : 0;
    const disPulg = t.diamDisPulg || 0;
    const matchedOpt = (t.diametroOriginal ? DIAM_OPTS.find(o => t.diametroOriginal?.startsWith(o.nominal)) : undefined) || DIAM_OPTS.find(o => Math.abs(o.pulg - disPulg) < 0.01);
    const internoMm = matchedOpt ? matchedOpt.dInt : (lookupFn(disPulg) || 0);
    const Vmms = Qprob > 0 && internoMm > 0 ? Math.round((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm) * 10) / 10 : 0;
    const H = t.totalL || t.Lh || 0;
    const Vvert = t.Lv != null ? Number(t.Lv) : (t.deltaZ != null ? Number(t.deltaZ) : 0);
    const realPulg = matchedOpt ? matchedOpt.pulg : disPulg;
    const cHW = matHazenC(t.material || '') ?? 150;
    const Le = calcLeAcces(t.accesorios ?? {}, realPulg, cHW);
    const Lt = H + Vvert + Le;
    const hfPct = Vmms > 0 && cHW > 0 && internoMm > 0 ? Math.round(((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(internoMm, 1.167))) * 100) / 100 : 0;
    const hfM = Lt > 0 && hfPct > 0 ? Math.round((Lt * hfPct) / 1000 * 100) / 100 : 0;
    const { Pin, Pfin } = result[ownKey] ?? { Pin: pRed, Pfin: pRed };
    return {
      id: t.id, ini: typeof t.ini === 'string' ? t.ini : '—', fin: typeof t.fin === 'string' ? t.fin : '—',
      piso: t.piso, udPropia: propia, udTotal: total,
      nDesc, K, Qprob, diamEst: raizQ,
      diamDis: matchedOpt?.nominal || '—', dInt: internoMm, cHW, Vmms,
      Lh: H, Lv: Vvert, Le, Lt,
      hfPct, hfM, Pin, Pfin,
    };
  });
}

export interface AcometidaSummary {
  tr1: { desde: string; hasta: string; h: number; le: number; diamEstimado: number; diamPropuesto: string };
  tr2: { desde: string; hasta: string; h: number; le: number; diamEstimado: number; diamPropuesto: string };
  Qaco: number; dInt1: number; dInt2: number; V1: number; V2: number; Lt1: number; Lt2: number;
  hfPct1: number; hfPct2: number; hfM1: number; hfM2: number; cHW1: number; cHW2: number;
  diamContador: string; Qn: number;
  p1Ini: number; p1Fin: number; p2Ini: number; p2Fin: number;
  hfContador: number; hfMax: number; diamConformeOk: boolean; diamDiff: number; pResidual: number;
  estadoOk: boolean;
}

function diamFractionValue(valStr: string): number {
  if (!valStr) return 0;
  if (valStr.includes('1/2')) return 0.5;
  if (valStr.includes('3/4')) return 0.75;
  if (valStr.includes('1 1/4')) return 1.25;
  if (valStr.includes('1 1/2')) return 1.5;
  const match = valStr.match(/(\d+)\/(\d+)/);
  if (match) return parseInt(match[1]) / parseInt(match[2]);
  const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

// Mirrors WaterNetworkDesign.tsx's own Acometida panel computation (same connectivity graph as
// computeWaterNetworkRows above, same calcFila formula, same fallback defaults for the un-drawn
// case) as a pure function — so, like computeWaterNetworkRows, the memoria export never depends on
// the user having opened that specific screen. Returns null only when neither AC-01 nor AC-02 has
// been drawn on any AF plan (nothing meaningful to report yet).
export function computeAcometidaSummary(
  tramosAf: Tramo[],
  plans: PlanItem[],
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>,
): AcometidaSummary | null {
  const networkType = 'af';
  const DIAM_OPTS = diamTable.map(d => ({ pulg: d.pulg, nominal: d.nominal, label: d.nominal, dInt: d.dInt }));
  const AP = AF_UC_IDS
    .map((id) => {
      const a = APARATOS_DEF.find((x) => x.id === id);
      return a ? { id: a.id, uc: a.uc_af } : null;
    })
    .filter((x): x is { id: string; uc: number } => x !== null);

  const tramos = tramosAf;
  const tr1 = tramos.find(isAC1);
  const tr2 = tramos.find(isAC2);
  // No early return when neither is drawn — SupplyConnection.tsx's own panel never hides itself
  // either; it just falls back to its default AC-01/AC-02 values (same defaults used below), so
  // the export must show the same thing the live screen would.

  // ── Connectivity graph (same as computeWaterNetworkRows) — only needed for Qaco via tr2's component total ──
  const calculoMap: Record<string, string[]> = {};
  const bajanteNodes: Array<{ key: string; x: number; y: number; nivel: number }> = [];
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { continue; } }
    const ramales = (data.ramales || []).filter((r) => r.net === networkType);
    const bajantes = (data.bajantes || []).filter((b): b is BajanteRaw => b.net === networkType);
    for (const b of bajantes) {
      if (b.x == null || b.y == null) continue;
      bajanteNodes.push({ key: `${b.id}-${plan.id}`, x: b.x, y: b.y, nivel: plan.nivel });
    }
    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const rKey = `${r.id}-${plan.id}`;
      const checkEndpoint = (pt: number[]) => {
        for (const b of bajantes) {
          const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
          const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
          if (isExplicit) {
            const otherPt = pt === pEnd ? pStart : pEnd;
            const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
            if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
            continue;
          }
          if (dist < 2.0) return { type: 'bajante' as const, id: b.id };
        }
        let bestRx: RawElement | null = null;
        let minDist = Infinity;
        for (const rx of ramales) {
          if (rx.id === r.id) continue;
          if (!rx.pts || rx.pts.length < 2) continue;
          const dist = distToPolyline(pt, rx.pts);
          if (dist < 2.0 && dist < minDist) { minDist = dist; bestRx = rx; }
        }
        if (bestRx) return { type: 'ramal' as const, id: bestRx.id };
        return null;
      };
      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null
      );
      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
        if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
      }
    }
  }
  const usedNode = new Set<number>();
  for (let i = 0; i < bajanteNodes.length; i++) {
    if (usedNode.has(i)) continue;
    const group = [bajanteNodes[i]];
    usedNode.add(i);
    for (let j = i + 1; j < bajanteNodes.length; j++) {
      if (usedNode.has(j)) continue;
      if (Math.hypot(bajanteNodes[j].x - bajanteNodes[i].x, bajanteNodes[j].y - bajanteNodes[i].y) < 2.0) {
        group.push(bajanteNodes[j]);
        usedNode.add(j);
      }
    }
    if (group.length < 2) continue;
    group.sort((a, b) => a.nivel - b.nivel);
    for (let k = 0; k < group.length - 1; k++) {
      const a = group[k].key, b = group[k + 1].key;
      if (!calculoMap[a]) calculoMap[a] = [];
      if (!calculoMap[a].includes(b)) calculoMap[a].push(b);
    }
  }
  const adj: Record<string, string[]> = {};
  for (const t of tramos) {
    const key = t._key || t.id;
    adj[key] = [];
  }
  for (const [parentKey, children] of Object.entries(calculoMap)) {
    if (!adj[parentKey]) adj[parentKey] = [];
    for (const childKey of children) {
      if (!adj[childKey]) adj[childKey] = [];
      if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
      if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
    }
  }
  const componentTotalMap = computeComponentTotals(
    tramos,
    t => t._key || t.id,
    adj,
    t => calcUCparcial(t, AP, 'uc'),
  );

  // ── Acometida-specific resolution (mirrors SupplyConnection.tsx's props exactly) ──
  const resolvedMonName = (() => {
    if (tr2) {
      const iniStr = typeof tr2.ini === 'string' ? tr2.ini : '';
      const finStr = typeof tr2.fin === 'string' ? tr2.fin : '';
      if (isContador(iniStr)) return finStr || 'Mon';
      if (isContador(finStr)) return iniStr || 'Mon';
      return iniStr || finStr || 'Mon';
    }
    return 'Mon';
  })();
  const resolvedContMonDiam = (() => {
    if (tr2) {
      if (tr2.diametroOriginal) {
        const match = diamTable.find(o => tr2.diametroOriginal?.startsWith(o.nominal));
        if (match) return match.nominal;
      }
      const match = diamTable.find(o => Math.abs(o.pulg - (tr2.diamDisPulg ?? 0)) < 0.01);
      if (match) return match.nominal;
    }
    const match = diamTable.find(o => Math.abs(o.pulg - 1.25) < 0.01);
    return match ? match.nominal : '3/4" RDE 11';
  })();
  const resolvedRedContDiam = resolvedContMonDiam;

  const resolvedL1 = (() => {
    if (tr1) {
      const opt = resolvedRedContDiam ? diamTable.find(d => d.nominal === resolvedRedContDiam) : null;
      const realPulg = opt ? opt.pulg : (tr1.diamDisPulg || 0);
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0, le };
    }
    return { h: 10.00, v: 0, le: 0.47 };
  })();
  const resolvedL2 = (() => {
    if (tr2) {
      const opt = resolvedContMonDiam ? diamTable.find(d => d.nominal === resolvedContMonDiam) : null;
      const realPulg = opt ? opt.pulg : (tr2.diamDisPulg || 0);
      const cHW = matHazenC(tr2.material || '') ?? 150;
      const le = calcLeAcces(tr2.accesorios ?? {}, realPulg, cHW);
      return { h: tr2.totalL || tr2.Lh || 0, v: 0, le };
    }
    return { h: 7.54, v: 0, le: 0 };
  })();

  let ucTotal = 0;
  for (const t of tramos) ucTotal += calcUCparcial(t, AP, 'uc');

  const Qaco = (() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      const total = componentTotalMap[ownKey] || 0;
      const nDesc = tr2.nSalidas || 0;
      const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      if (total > 0 && K > 0) {
        return Math.round(K * (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) * 1000) / 1000;
      }
    }
    return ucTotal > 0 ? Math.round((0.1163 * Math.pow(ucTotal, 0.6875)) * 1000) / 1000 : 0;
  })();

  const calcFila = (nominal: string, h: number, v: number, le: number, pIn: number, cHW: number) => {
    const opt = nominal ? diamTable.find(d => d.nominal === nominal) : null;
    const dInt = opt ? opt.dInt : 0;
    const V = Qaco > 0 && dInt > 0 ? Math.round((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt) * 10) / 10 : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct = Math.round(((60.1 * Math.pow(V, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(dInt, 1.167))) * 100) / 100;
    const hfM = Math.round((hfPct / 100) * Lt * 100) / 100;
    const Pfin = +(pIn - (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const cHW1 = matHazenC(tr1?.material || '') ?? 150;
  const cHW2 = matHazenC(tr2?.material || '') ?? 150;
  const acoPini = 20.00;
  const acoLeMed = 0;
  const acoL1LeTotal = resolvedL1.le + acoLeMed;
  const f1 = calcFila(resolvedRedContDiam || '', resolvedL1.h, resolvedL1.v, acoL1LeTotal, acoPini, cHW1);
  const f2 = calcFila(resolvedContMonDiam || '', resolvedL2.h, resolvedL2.v, resolvedL2.le, f1.Pfin, cHW2);

  // ── Contador selection: dynamic from a bajante's diameter, mirroring WaterNetworkDesign.tsx ──
  let acoContIx = 2;
  const found = findContadorBajante(plans, networkType);
  if (found && found.bajante.dNominal) {
    const dNom = String(found.bajante.dNominal).replace('½', '1/2').replace('¾', '3/4');
    const idx = CONTADORES_CAT.findIndex(c => `${c.dn}"` === dNom);
    if (idx !== -1) acoContIx = idx;
  }
  const contadorSel = CONTADORES_CAT[acoContIx] || CONTADORES_CAT[0];
  const hfContador = Qaco > 0 && contadorSel.q > 0
    ? Math.round(10 * Math.pow(Qaco / contadorSel.q, 2) * 100) / 100
    : 0;
  const acoHfMax = 5.0;
  const pResidual = +((f1.Pfin - f2.Pfin).toFixed(2));
  const okPresion = f1.Pfin > f2.Pfin;

  const diamPropuesto1 = DIAM_OPTS.find(o => o.nominal === resolvedRedContDiam)?.label || resolvedRedContDiam || '';
  const diamPropuesto2 = DIAM_OPTS.find(o => o.nominal === resolvedContMonDiam)?.label || resolvedContMonDiam || '';
  const dValAco = diamFractionValue(resolvedRedContDiam || '');
  const dValCont = diamFractionValue(contadorSel.dn || '0');
  const diamDiff = dValAco - dValCont;
  const diamConformeOk = diamDiff <= 0.5;

  return {
    tr1: { desde: 'Red Pública', hasta: 'Contador', h: resolvedL1.h, le: acoL1LeTotal, diamEstimado: Qaco > 0 ? Math.sqrt(Qaco) : 0, diamPropuesto: diamPropuesto1 },
    tr2: { desde: 'Contador', hasta: resolvedMonName || '—', h: resolvedL2.h, le: resolvedL2.le, diamEstimado: Qaco > 0 ? Math.sqrt(Qaco) : 0, diamPropuesto: diamPropuesto2 },
    Qaco, dInt1: f1.dInt, dInt2: f2.dInt, V1: f1.V, V2: f2.V, Lt1: f1.Lt, Lt2: f2.Lt,
    hfPct1: f1.hfPct, hfPct2: f2.hfPct, hfM1: f1.hfM, hfM2: f2.hfM, cHW1, cHW2,
    diamContador: contadorSel.dn || '—', Qn: contadorSel.q || 0,
    p1Ini: acoPini, p1Fin: f1.Pfin, p2Ini: f1.Pfin, p2Fin: f2.Pfin,
    hfContador, hfMax: acoHfMax, diamConformeOk, diamDiff, pResidual,
    estadoOk: okPresion && hfContador <= acoHfMax,
  };
}
