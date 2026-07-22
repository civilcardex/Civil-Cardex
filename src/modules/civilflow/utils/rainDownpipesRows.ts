import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import type { BajanteLL } from '../context/RainwaterContext';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { chequeoBajanteLluvia } from './calcRainwater';
import type { DrawingData } from './drawingSync';
import type { MemoriaTable } from './exportMemoriaFinal';

interface AreaRaw { areaM2?: number }
interface Row {
  key: string; bajante: string; areaParcial: number; areaAcum: number;
  intensidad: number; R: string; manning: number; diamPropuesto: number;
}

export function computeRainDownpipesTable(tramosLl: Tramo[], plans: PlanItem[], bajantesLl: BajanteLL[]): MemoriaTable | null {
  const drawingBajantes = tramosLl.filter((t) => t.esBajante);

  const areaDibujoMap: Record<string, number> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { continue; } }
    for (const b of (data.bajantes || [])) {
      if (b.net === 'll' && b.area_m2) {
        areaDibujoMap[b.code || b.id] = b.area_m2;
        areaDibujoMap[b.id] = b.area_m2;
      }
    }
  }

  const areaAcumMap: Record<string, number> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<(DrawingData & { areas?: AreaRaw[] }) | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData & { areas?: AreaRaw[] } = raw as DrawingData & { areas?: AreaRaw[] };
    if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { continue; } }
    const totalArea = (data.areas || []).reduce((s, a) => s + (a.areaM2 || 0), 0);
    areaAcumMap[String(plan.nivel)] = totalArea;
  }

  const manualMap = new Map<string, BajanteLL>();
  for (const m of bajantesLl) manualMap.set(m.bajante || m.id, m);

  const usedManual = new Set<string>();
  const rows: Row[] = [];

  for (const d of drawingBajantes) {
    const code = d.code || d.id;
    const manual = manualMap.get(code) || manualMap.get(d.id);
    if (manual) usedManual.add(manual.bajante || manual.id);
    const areaDib = areaDibujoMap[code] || areaDibujoMap[d.id] || 0;
    const areaParcial = areaDib || d.area_m2 || manual?.areaParcial || 0;
    const areaAcum = areaAcumMap[String(d.piso)] || manual?.areaAcumulada || 0;
    const rVal = d.bajR != null ? (Math.abs(d.bajR - 0.25) < 0.001 ? '1/4' : '7/24') : '7/24';
    rows.push({
      key: 'd_' + d.id + '_' + d.piso, bajante: code, areaParcial, areaAcum,
      intensidad: manual?.intensidad ?? 100, R: rVal, manning: 0.009,
      diamPropuesto: d.diamDisPulg || 0,
    });
  }

  for (const m of bajantesLl) {
    const key = m.bajante || m.id;
    if (usedManual.has(key)) continue;
    const bajDib = drawingBajantes.find((d) => d.code === m.bajante || d.id === m.bajante);
    const areaDib = areaDibujoMap[m.bajante] || 0;
    const areaParcial = areaDib || bajDib?.area_m2 || m.areaParcial || 0;
    const areaAcum = areaAcumMap[String(bajDib?.piso)] || m.areaAcumulada || 0;
    rows.push({
      key: 'm_' + m.id, bajante: m.bajante || m.id, areaParcial, areaAcum,
      intensidad: m.intensidad ?? 100, R: m.R, manning: 0.009, diamPropuesto: m.diamPropuesto,
    });
  }

  if (rows.length === 0) return null;

  const headers = ['Bajante', 'Área parcial (m²)', 'Área acum. (m²)', 'Intensidad (mm/hr)', 'Coef. escorrentía', 'Llenado', 'Q (LPS)', 'Manning', 'D calculado (")', 'D propuesto (")', 'Chequeo'];
  const tableRows = rows.map(row => {
    const { Q, dCalc, chequeo } = chequeoBajanteLluvia({ ...row, coeficienteC: 0.0278, areaAcumulada: row.areaAcum || 0 });
    return [
      row.bajante || '—', row.areaParcial > 0 ? row.areaParcial.toFixed(2) : '—', row.areaAcum > 0 ? row.areaAcum.toFixed(2) : '—',
      row.intensidad ?? 100, '0.0278', row.R || '—', Q > 0 ? Q.toFixed(2) : '—', row.manning || '—',
      dCalc > 0 ? dCalc.toFixed(2) : '—', row.diamPropuesto ? row.diamPropuesto + '"' : '—', chequeo,
    ];
  });

  return { title: 'Chequeo capacidad bajantes aguas lluvias', headers, rows: tableRows };
}
