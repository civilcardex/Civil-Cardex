import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { SAN_ACCESORIOS } from '../constants';
import { HYDRO_DATA_STORAGE_KEY, TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { diamPulgFromLabel } from './diamPulgFromLabel';
import { fmtPulg } from './formatUtils';
import { distToSegment } from '../lib/shared/geometry';
import type { MemoriaTable } from './exportMemoriaFinal';

interface HidroEntry { accesorios?: Record<string, number> }

export function computeSanAccesoriosTable(tramosSan: Tramo[], plans: PlanItem[]): MemoriaTable | null {
  const drawingRamales: Array<{ id: string; label: string; diametro: string; pts: number[][]; planId: string }> = [];
  for (const plan of plans || []) {
    if (plan.status !== 'confirmed') continue;
    const raw = loadFromStorage<unknown>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw as { ramales?: Array<{ id: string; label?: string; diametro?: string; pts?: number[][]; tipo?: string; net?: string }> } | string;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { continue; } }
    const ramales = ((data as { ramales?: Array<{ id: string; label?: string; diametro?: string; pts?: number[][]; tipo?: string; net?: string }> }).ramales || []).filter((r) => r.net === 'san' && r.tipo !== 'tributario');
    for (const r of ramales) {
      if (r.pts && r.pts.length >= 2) {
        drawingRamales.push({ id: r.id, label: r.label || r.id, diametro: r.diametro || '', pts: r.pts, planId: String(plan.id) });
      }
    }
  }

  const labelToKey = new Map<string, string>();
  for (const t of tramosSan) {
    if (t.esBajante) continue;
    const lbl = t.label || t.id;
    const key = String(t._key || `${t.id}-${t.planId}`);
    if (!labelToKey.has(lbl)) labelToKey.set(lbl, key);
  }

  const allConnections: { parentKey: string; diamStr: string }[] = [];
  for (const child of tramosSan) {
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
          if (distToSegment(ep, parent.pts[i], parent.pts[i + 1]) < 0.5) { nearSegment = true; break; }
        }
        if (nearSegment) {
          allConnections.push({ parentKey: `${parent.id}-${parent.planId}`, diamStr: childDiamStr });
          break;
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
  for (const t of tramosSan) {
    if (t.esBajante || t.tipo === 'tributario') continue;
    const tKey = String(t._key || `${t.id}-${t.planId}`);
    const mainDiamStr = fmtPulg(diamPulgFromLabel(t.diametro || ''));
    const myConnections = byParent[tKey] || [];
    if (myConnections.length === 0) continue;
    const byDiam: Record<string, number> = {};
    myConnections.forEach(c => { byDiam[c.diamStr] = (byDiam[c.diamStr] || 0) + 1; });
    if (!yeeDiams[tKey]) yeeDiams[tKey] = { simple: [], doble: [] };
    for (const [diamStr, count] of Object.entries(byDiam)) {
      const dobleCount = Math.floor(count / 2);
      const simpleCount = count % 2;
      for (let i = 0; i < dobleCount; i++) yeeDiams[tKey].doble.push(`${mainDiamStr}×${diamStr}`);
      if (simpleCount > 0) yeeDiams[tKey].simple.push(`${mainDiamStr}×${diamStr}`);
    }
  }

  const hidroData = loadFromStorage<Record<string, HidroEntry>>(HYDRO_DATA_STORAGE_KEY, {});
  const totals: Record<string, Record<string, number>> = {};
  const addAcc = (diam: string, accId: string, count: number) => {
    if (!totals[diam]) {
      totals[diam] = {};
      for (const a of SAN_ACCESORIOS) totals[diam][a.id] = 0;
    }
    totals[diam][accId] += count;
  };

  tramosSan.forEach(t => {
    if (t.esBajante) return;
    const mainDiam = t.diametro || '';
    const mainDiamStr = fmtPulg(diamPulgFromLabel(mainDiam));
    if (t.tipo === 'tributario') {
      const accIni = t.accesorioInicio;
      if (accIni) {
        const dStr = fmtPulg(diamPulgFromLabel(t.diametroInicio || mainDiam));
        const accId = accIni === 'codoSube' ? 'codo90rmSube' : (accIni === 'codoBaja' ? 'codo90rmBaja' : accIni);
        addAcc(dStr, accId, 1);
      }
      const accFin = t.accesorioFin;
      if (accFin) {
        const dStr = fmtPulg(diamPulgFromLabel(t.diametroFin || mainDiam));
        const accId = accFin === 'codoSube' ? 'codo90rmSube' : (accFin === 'codoBaja' ? 'codo90rmBaja' : accFin);
        addAcc(dStr, accId, 1);
      }
    } else {
      const key = `san_${t.id}_${t.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const tKey = String(t._key || `${t.id}-${t.planId}`);
      const yd = yeeDiams[tKey] || { simple: [], doble: [] };
      for (const a of SAN_ACCESORIOS) {
        const v = srcAcc[a.id] || 0;
        if (v <= 0) continue;
        if (a.id === 'yeeSimple') {
          if (yd.simple.length > 0) yd.simple.forEach(diamCombo => addAcc(diamCombo, a.id, 1));
          else addAcc(mainDiamStr, a.id, v);
        } else if (a.id === 'yeeDoble') {
          if (yd.doble.length > 0) yd.doble.forEach(diamCombo => addAcc(diamCombo, a.id, 1));
          else addAcc(mainDiamStr, a.id, v);
        } else {
          addAcc(mainDiamStr, a.id, v);
        }
      }
    }
  });

  const totalsByDiameter = Object.entries(totals)
    .map(([diametro, accesorios]) => ({ diametro, accesorios }))
    .filter(row => Object.values(row.accesorios).some(count => count > 0))
    .sort((a, b) => {
      const aMain = a.diametro.split('×')[0].trim();
      const bMain = b.diametro.split('×')[0].trim();
      return diamPulgFromLabel(bMain) - diamPulgFromLabel(aMain);
    });

  if (totalsByDiameter.length === 0) return null;

  const headers = ['Diámetro', ...SAN_ACCESORIOS.map(a => a.nombre), 'Total'];
  const rows = totalsByDiameter.map(row => {
    const total = Object.values(row.accesorios).reduce((s, n) => s + n, 0);
    return [row.diametro, ...SAN_ACCESORIOS.map(a => row.accesorios[a.id] || 0), total];
  });

  return { title: 'Resumen de accesorios sanitarios por diámetro', headers, rows };
}
