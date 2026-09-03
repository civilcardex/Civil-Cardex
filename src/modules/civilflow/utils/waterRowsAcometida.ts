import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { AF_UC_IDS, APARATOS_DEF, matHazenC } from '../constants';
import { calcUCparcial } from './componentHelpers';
import { calcLeAcces } from './accesoriosUtils';
import { computeComponentTotals } from '../lib/shared/connectionGraph';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { DrawingData, RawElement } from './drawingSync';
import { CONTADORES as CONTADORES_CAT } from '../pages/catalog/catalogData';
import { findContadorBajante } from './writeDiameterToDrawing';
import { isLdesvioRamalId } from './associateBajanteAcrossFloors';
import { distToPolyline } from '../lib/shared/geometry';
import { isContador, isAC1, isAC2, type BajanteRaw } from './waterRowsShared';

/** Resumen de la acometida: tramos red→contador y contador→montante, con presiones y validez. */
export interface AcometidaSummary {
  tr1: {
    desde: string;
    hasta: string;
    h: number;
    le: number;
    diamEstimado: number;
    diamPropuesto: string;
  };
  tr2: {
    desde: string;
    hasta: string;
    h: number;
    le: number;
    diamEstimado: number;
    diamPropuesto: string;
  };
  Qaco: number;
  dInt1: number;
  dInt2: number;
  V1: number;
  V2: number;
  Lt1: number;
  Lt2: number;
  hfPct1: number;
  hfPct2: number;
  hfM1: number;
  hfM2: number;
  cHW1: number;
  cHW2: number;
  diamContador: string;
  Qn: number;
  p1Ini: number;
  p1Fin: number;
  p2Ini: number;
  p2Fin: number;
  hfContador: number;
  hfMax: number;
  diamConformeOk: boolean;
  diamDiff: number;
  pResidual: number;
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

// Espeja el cálculo del panel Acometida propio de WaterNetworkDesign.tsx (mismo grafo de
// conectividad que computeWaterNetworkRows de arriba, misma fórmula calcFila, mismos defaults de
// respaldo para el caso no-dibujado) como función pura — para que, como computeWaterNetworkRows,
// la exportación de memorias nunca dependa de que el usuario haya abierto esa pantalla. Devuelve
// null solo cuando ni AC-01 ni AC-02 se han dibujado en ningún plano AF (nada significativo que
// reportar aún).
/** Calcula el panel de acometida (dos tramos + contador) desde los tramos dibujados, espejando el cálculo en vivo de la tabla de diseño. */
export function computeAcometidaSummary(
  tramosAf: Tramo[],
  plans: PlanItem[],
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>,
): AcometidaSummary | null {
  const networkType = 'af';
  const DIAM_OPTS = diamTable.map((d) => ({
    pulg: d.pulg,
    nominal: d.nominal,
    label: d.nominal,
    dInt: d.dInt,
  }));
  const AP = AF_UC_IDS.map((id) => {
    const a = APARATOS_DEF.find((x) => x.id === id);
    return a ? { id: a.id, uc: a.uc_af } : null;
  }).filter((x): x is { id: string; uc: number } => x !== null);

  const tramos = tramosAf;
  const tr1 = tramos.find(isAC1);
  const tr2 = tramos.find(isAC2);
  // Sin retorno temprano cuando ninguno está dibujado — el panel propio de SupplyConnection.tsx
  // tampoco se oculta nunca; solo cae a sus valores default de AC-01/AC-02 (los mismos defaults
  // usados abajo), así que la exportación debe mostrar lo mismo que vería la pantalla viva.

  // ── Grafo de conectividad (igual que computeWaterNetworkRows) — solo se necesita para Qaco vía el total de componente de tr2 ──
  const calculoMap: Record<string, string[]> = {};
  const bajanteNodes: Array<{ key: string; x: number; y: number; nivel: number }> = [];
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    const ramales = (data.ramales || []).filter(
      (r) => r.net === networkType && !isLdesvioRamalId(r.id),
    );
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
          const isExplicit =
            b.recibeDeIds &&
            (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
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
          if (dist < 2.0 && dist < minDist) {
            minDist = dist;
            bestRx = rx;
          }
        }
        if (bestRx) return { type: 'ramal' as const, id: bestRx.id };
        return null;
      };
      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null,
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
      if (
        Math.hypot(bajanteNodes[j].x - bajanteNodes[i].x, bajanteNodes[j].y - bajanteNodes[i].y) <
        2.0
      ) {
        group.push(bajanteNodes[j]);
        usedNode.add(j);
      }
    }
    if (group.length < 2) continue;
    group.sort((a, b) => a.nivel - b.nivel);
    for (let k = 0; k < group.length - 1; k++) {
      const a = group[k].key,
        b = group[k + 1].key;
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
    (t) => t._key || t.id,
    adj,
    (t) => calcUCparcial(t, AP, 'uc'),
  );

  // ── Resolución específica de acometida (espeja las props de SupplyConnection.tsx exactamente) ──
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
        const match = diamTable.find((o) => tr2.diametroOriginal?.startsWith(o.nominal));
        if (match) return match.nominal;
      }
      const match = diamTable.find((o) => Math.abs(o.pulg - (tr2.diamDisPulg ?? 0)) < 0.01);
      if (match) return match.nominal;
    }
    const match = diamTable.find((o) => Math.abs(o.pulg - 1.25) < 0.01);
    return match ? match.nominal : '3/4" RDE 11';
  })();
  const resolvedRedContDiam = resolvedContMonDiam;

  const resolvedL1 = (() => {
    if (tr1) {
      const opt = resolvedRedContDiam
        ? diamTable.find((d) => d.nominal === resolvedRedContDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr1.diamDisPulg || 0;
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0, le };
    }
    return { h: 10.0, v: 0, le: 0.47 };
  })();
  const resolvedL2 = (() => {
    if (tr2) {
      const opt = resolvedContMonDiam
        ? diamTable.find((d) => d.nominal === resolvedContMonDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr2.diamDisPulg || 0;
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
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      if (total > 0 && K > 0) {
        return (
          Math.round(
            K *
              (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
              1000,
          ) / 1000
        );
      }
    }
    return ucTotal > 0 ? Math.round(0.1163 * Math.pow(ucTotal, 0.6875) * 1000) / 1000 : 0;
  })();

  const calcFila = (
    nominal: string,
    h: number,
    v: number,
    le: number,
    pIn: number,
    cHW: number,
  ) => {
    const opt = nominal ? diamTable.find((d) => d.nominal === nominal) : null;
    const dInt = opt ? opt.dInt : 0;
    const V =
      Qaco > 0 && dInt > 0
        ? Math.round(((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt)) * 10) / 10
        : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct =
      Math.round(
        ((60.1 * Math.pow(V, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(dInt, 1.167))) * 100,
      ) / 100;
    const hfM = Math.round((hfPct / 100) * Lt * 100) / 100;
    const Pfin = +(pIn - (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const cHW1 = matHazenC(tr1?.material || '') ?? 150;
  const cHW2 = matHazenC(tr2?.material || '') ?? 150;
  const acoPini = 20.0;
  const acoLeMed = 0;
  const acoL1LeTotal = resolvedL1.le + acoLeMed;
  const f1 = calcFila(
    resolvedRedContDiam || '',
    resolvedL1.h,
    resolvedL1.v,
    acoL1LeTotal,
    acoPini,
    cHW1,
  );
  const f2 = calcFila(
    resolvedContMonDiam || '',
    resolvedL2.h,
    resolvedL2.v,
    resolvedL2.le,
    f1.Pfin,
    cHW2,
  );

  // ── Selección de contador: dinámica desde el diámetro de un bajante, espejando WaterNetworkDesign.tsx ──
  let acoContIx = 2;
  const found = findContadorBajante(plans, networkType);
  if (found && found.bajante.dNominal) {
    const dNom = String(found.bajante.dNominal).replace('½', '1/2').replace('¾', '3/4');
    const idx = CONTADORES_CAT.findIndex((c) => `${c.dn}"` === dNom);
    if (idx !== -1) acoContIx = idx;
  }
  const contadorSel = CONTADORES_CAT[acoContIx] || CONTADORES_CAT[0];
  const hfContador =
    Qaco > 0 && contadorSel.q > 0
      ? Math.round(10 * Math.pow(Qaco / contadorSel.q, 2) * 100) / 100
      : 0;
  const acoHfMax = 5.0;
  const pResidual = +(f1.Pfin - f2.Pfin).toFixed(2);
  const okPresion = f1.Pfin > f2.Pfin;

  const diamPropuesto1 =
    DIAM_OPTS.find((o) => o.nominal === resolvedRedContDiam)?.label || resolvedRedContDiam || '';
  const diamPropuesto2 =
    DIAM_OPTS.find((o) => o.nominal === resolvedContMonDiam)?.label || resolvedContMonDiam || '';
  const dValAco = diamFractionValue(resolvedRedContDiam || '');
  const dValCont = diamFractionValue(contadorSel.dn || '0');
  const diamDiff = dValAco - dValCont;
  const diamConformeOk = diamDiff <= 0.5;

  return {
    tr1: {
      desde: 'Red Pública',
      hasta: 'Contador',
      h: resolvedL1.h,
      le: acoL1LeTotal,
      diamEstimado: Qaco > 0 ? Math.sqrt(Qaco) : 0,
      diamPropuesto: diamPropuesto1,
    },
    tr2: {
      desde: 'Contador',
      hasta: resolvedMonName || '—',
      h: resolvedL2.h,
      le: resolvedL2.le,
      diamEstimado: Qaco > 0 ? Math.sqrt(Qaco) : 0,
      diamPropuesto: diamPropuesto2,
    },
    Qaco,
    dInt1: f1.dInt,
    dInt2: f2.dInt,
    V1: f1.V,
    V2: f2.V,
    Lt1: f1.Lt,
    Lt2: f2.Lt,
    hfPct1: f1.hfPct,
    hfPct2: f2.hfPct,
    hfM1: f1.hfM,
    hfM2: f2.hfM,
    cHW1,
    cHW2,
    diamContador: contadorSel.dn || '—',
    Qn: contadorSel.q || 0,
    p1Ini: acoPini,
    p1Fin: f1.Pfin,
    p2Ini: f1.Pfin,
    p2Fin: f2.Pfin,
    hfContador,
    hfMax: acoHfMax,
    diamConformeOk,
    diamDiff,
    pResidual,
    estadoOk: okPresion && hfContador <= acoHfMax,
  };
}
