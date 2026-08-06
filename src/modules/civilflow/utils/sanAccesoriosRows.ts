import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { SAN_ACCESORIOS, ACCESORIOS_HIDRO } from '../constants';
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

// Marcadores de tee escritos en los vértices del cuerpo de un ramal (accMed) — cada uno tiene
// entrada de catálogo en ACCESORIOS_HIDRO; el auto-tee del montante y el selector de accesorios
// de mitad de cuerpo persisten tees SOLO aquí (nunca en hidroData), así que el resumen debe
// contarlas del dibujo, no de los tramos.
const TEES_ACC_MED = new Set([
  'teeDirecto',
  'teeReduccion',
  'teeLado',
  'teeSube',
  'teeBaja',
  'teeTapon',
  'teeLlaveTerminal',
]);

export function computeAccesoriosTable(
  net: 'san' | 'af' | 'ac',
  tramos: Tramo[],
  plans: PlanItem[],
): MemoriaTable | null {
  const catalog = net === 'san' ? SAN_ACCESORIOS : ACCESORIOS_HIDRO;
  const title =
    net === 'san'
      ? 'Resumen de accesorios sanitarios por diámetro'
      : net === 'af'
        ? 'Resumen de accesorios por diámetro — agua fría'
        : 'Resumen de accesorios por diámetro — agua caliente';
  const drawingRamales: Array<{
    id: string;
    label: string;
    diametro: string;
    pts: number[][];
    accMed?: Record<string, string>;
    planId: string;
  }> = [];
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
          }>;
        }
      ).ramales || []
    ).filter((r) => r.net === net && r.tipo !== 'tributario' && !isLdesvioRamalId(r.id));
    for (const r of ramales) {
      if (r.pts && r.pts.length >= 2) {
        drawingRamales.push({
          id: r.id,
          label: r.label || r.id,
          diametro: r.diametro || '',
          pts: r.pts,
          accMed: r.accMed,
          planId: String(plan.id),
        });
      }
    }
  }

  const labelToKey = new Map<string, string>();
  for (const t of tramos) {
    if (t.esBajante) continue;
    const lbl = t.label || t.id;
    const key = String(t._key || `${t.id}-${t.planId}`);
    if (!labelToKey.has(lbl)) labelToKey.set(lbl, key);
  }

  // Las tees san/vent se derivan del grafo de conexiones (un ramal hijo uniéndose a un padre
  // implica una yee del diámetro del hijo) — las tees hidro se dibujan explícitamente como
  // marcadores accMed en su lugar.
  const allConnections: { parentKey: string; diamStr: string }[] = [];
  if (net === 'san') {
    for (const child of tramos) {
      if (child.esBajante) continue;
      const childDiamStr = fmtPulg(diamPulgFromLabel(child.diametro || ''));
      if (!childDiamStr || childDiamStr === '—') continue;
      const parentLabel = child.padreTributarioLabel || child.padre;
      if (parentLabel) {
        const parentKey = labelToKey.get(parentLabel) || parentLabel;
        allConnections.push({ parentKey, diamStr: childDiamStr });
      }
    }
    for (const child of drawingRamales) {
      const childDiamStr = fmtPulg(diamPulgFromLabel(child.diametro));
      if (!childDiamStr || childDiamStr === '—') continue;
      const childEndpoints = [child.pts[0], child.pts[child.pts.length - 1]];
      for (const parent of drawingRamales) {
        if (parent.id === child.id) continue;
        for (const ep of childEndpoints) {
          let nearSegment = false;
          for (let i = 0; i < parent.pts.length - 1; i++) {
            if (distToSegment(ep, parent.pts[i], parent.pts[i + 1]) < 0.5) {
              nearSegment = true;
              break;
            }
          }
          if (nearSegment) {
            allConnections.push({
              parentKey: `${parent.id}-${parent.planId}`,
              diamStr: childDiamStr,
            });
            break;
          }
        }
      }
    }
  }

  const byParent: Record<string, { diamStr: string }[]> = {};
  for (const conn of allConnections) {
    if (!byParent[conn.parentKey]) byParent[conn.parentKey] = [];
    byParent[conn.parentKey].push({ diamStr: conn.diamStr });
  }

  const yeeDiams: Record<string, { simple: string[]; doble: string[] }> = {};
  if (net === 'san') {
    for (const t of tramos) {
      if (t.esBajante || t.tipo === 'tributario') continue;
      const tKey = String(t._key || `${t.id}-${t.planId}`);
      const mainDiamStr = fmtPulg(diamPulgFromLabel(t.diametro || ''));
      const myConnections = byParent[tKey] || [];
      if (myConnections.length === 0) continue;
      const byDiam: Record<string, number> = {};
      myConnections.forEach((c) => {
        byDiam[c.diamStr] = (byDiam[c.diamStr] || 0) + 1;
      });
      if (!yeeDiams[tKey]) yeeDiams[tKey] = { simple: [], doble: [] };
      for (const [diamStr, count] of Object.entries(byDiam)) {
        const dobleCount = Math.floor(count / 2);
        const simpleCount = count % 2;
        for (let i = 0; i < dobleCount; i++) yeeDiams[tKey].doble.push(`${mainDiamStr}×${diamStr}`);
        if (simpleCount > 0) yeeDiams[tKey].simple.push(`${mainDiamStr}×${diamStr}`);
      }
    }
  }

  const hidroData = loadFromStorage<Record<string, HidroEntry>>(HYDRO_DATA_STORAGE_KEY, {});
  const totals: Record<string, Record<string, number>> = {};
  const addAcc = (diam: string, accId: string, count: number) => {
    if (!totals[diam]) {
      totals[diam] = {};
      for (const a of catalog) totals[diam][a.id] = 0;
    }
    totals[diam][accId] += count;
  };

  tramos.forEach((t) => {
    if (t.esBajante) return;
    const mainDiam = t.diametro || '';
    const mainDiamStr = fmtPulg(diamPulgFromLabel(mainDiam));
    if (t.tipo === 'tributario') {
      const accIni = t.accesorioInicio;
      if (accIni) {
        const dStr = fmtPulg(diamPulgFromLabel(t.diametroInicio || mainDiam));
        const accId =
          accIni === 'codoSube' ? 'codo90rmSube' : accIni === 'codoBaja' ? 'codo90rmBaja' : accIni;
        addAcc(dStr, accId, 1);
      }
      const accFin = t.accesorioFin;
      if (accFin) {
        const dStr = fmtPulg(diamPulgFromLabel(t.diametroFin || mainDiam));
        const accId =
          accFin === 'codoSube' ? 'codo90rmSube' : accFin === 'codoBaja' ? 'codo90rmBaja' : accFin;
        addAcc(dStr, accId, 1);
      }
    } else {
      const key = `${net}_${t.id}_${t.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const tKey = String(t._key || `${t.id}-${t.planId}`);
      const yd = yeeDiams[tKey] || { simple: [], doble: [] };
      for (const a of catalog) {
        const v = srcAcc[a.id] || 0;
        if (v <= 0) continue;
        if (a.id === 'yeeSimple') {
          if (yd.simple.length > 0) yd.simple.forEach((diamCombo) => addAcc(diamCombo, a.id, 1));
          else addAcc(mainDiamStr, a.id, v);
        } else if (a.id === 'yeeDoble') {
          if (yd.doble.length > 0) yd.doble.forEach((diamCombo) => addAcc(diamCombo, a.id, 1));
          else addAcc(mainDiamStr, a.id, v);
        } else {
          addAcc(mainDiamStr, a.id, v);
        }
      }
    }
  });

  // Tees dibujadas a mitad de cuerpo (marcadores accMed) — por diámetro de ramal, una por
  // marcador.
  if (net !== 'san') {
    for (const r of drawingRamales) {
      if (!r.accMed) continue;
      const mainDiamStr = fmtPulg(diamPulgFromLabel(r.diametro));
      if (!mainDiamStr || mainDiamStr === '—') continue;
      for (const accId of Object.values(r.accMed)) {
        if (TEES_ACC_MED.has(accId)) addAcc(mainDiamStr, accId, 1);
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

  const headers = ['Diámetro', ...catalog.map((a) => a.nombre), 'Total'];
  const rows = totalsByDiameter.map((row) => {
    const total = Object.values(row.accesorios).reduce((s, n) => s + n, 0);
    return [row.diametro, ...catalog.map((a) => row.accesorios[a.id] || 0), total];
  });

  return dropAllZeroColumns({ title, headers, rows }, 1, 1);
}
