import type { Tramo } from '../context/tramosReducer';
import { APARATOS_DEF } from '../constants';
import { CAT_APS } from '../constants/engineeringDataFixtures';
import { CAT_GAS } from '../constants/engineeringDataGas';
import { fmt } from './formatUtils';
import type { MemoriaTable } from './exportMemoriaFinal';

export function computeHeaterSelectionTables(tramosAc: Tramo[], factorSim = 50): MemoriaTable[] {
  const selectedHeaterTram = tramosAc.find(t => t.calCapacidad !== undefined);
  const selectedHeaterId = selectedHeaterTram ? selectedHeaterTram.calCapacidad : '';
  const selectedHeater = CAT_GAS.find(g => g.id === selectedHeaterId);

  const counts: Record<string, { cant: number; uc: number }> = {};
  if (selectedHeaterTram && selectedHeaterTram.fixtures) {
    for (const [k, v] of Object.entries(selectedHeaterTram.fixtures)) {
      if (v && v > 0) {
        const apCat = CAT_APS.find(a => a.id === k);
        if (!counts[k]) counts[k] = { cant: 0, uc: apCat ? apCat.ac : 0 };
        counts[k].cant += v;
      }
    }
  }
  const summary = Object.keys(counts).map(k => {
    const apCat = CAT_APS.find(a => a.id === k);
    const nombre = apCat ? apCat.n : ((APARATOS_DEF as unknown as Record<string, { nombre?: string }>)[k]?.nombre || k);
    const cant = counts[k].cant;
    const uc = counts[k].uc;
    return { id: k, nombre, cant, uc, total: cant * uc };
  }).filter(x => x.cant > 0);

  const totalUC = summary.reduce((sum, item) => sum + item.total, 0);
  const caudalProbableLps = totalUC > 0 ? 0.1163 * Math.pow(totalUC, 0.6875) : 0;
  const caudalProbableLpm = caudalProbableLps * 60.0;
  const caudalAjustado = caudalProbableLpm * (factorSim / 100);

  const heaters = CAT_GAS.filter(g => g.id.startsWith('cal'));
  const parsedHeaters = heaters.map(h => {
    const match = h.id.match(/\d+/);
    return { ...h, cap: match ? parseInt(match[0]) : 0 };
  }).sort((a, b) => a.cap - b.cap);

  let recText: string;
  const suitable = parsedHeaters.find(h => h.cap >= caudalAjustado);
  if (suitable) recText = `Recomendado: usar ${suitable.n}`;
  else if (caudalAjustado > 0) recText = `Recomendado: usar equipo mayor a ${parsedHeaters[parsedHeaters.length - 1]?.cap || 21} LPM o múltiples unidades`;
  else recText = 'No requiere calentador';

  let cumpleTxt = '—';
  if (selectedHeaterId && selectedHeater) {
    const match = selectedHeater.id.match(/\d+/);
    const cap = match ? parseInt(match[0]) : 0;
    cumpleTxt = cap >= caudalAjustado ? `El equipo seleccionado (${selectedHeater.n}) CUMPLE con el caudal ajustado.` : `El equipo seleccionado (${selectedHeater.n}) NO CUMPLE. ${recText}`;
  }

  const summaryHeaders = ['Aparato', 'Cantidad', 'UC', 'Total UC'];
  const summaryRows: (string | number)[][] = summary.map(item => [item.nombre, item.cant, fmt(item.uc, 2), fmt(item.total, 2)]);
  summaryRows.push(['Total UC', '', '', fmt(totalUC, 2)]);

  const paramsHeaders = ['Parámetro', 'Valor'];
  const paramsRows: (string | number)[][] = [
    ['Caudal probable (LPS)', fmt(caudalProbableLps, 3)],
    ['Caudal probable (LPM)', fmt(caudalProbableLpm, 2)],
    ['Factor de simultaneidad (%)', factorSim],
    ['Caudal ajustado (LPM)', fmt(caudalAjustado, 2)],
    ['Calentador seleccionado', selectedHeater ? selectedHeater.n : 'Ninguno'],
    ['Chequeo', cumpleTxt || recText],
  ];

  return [
    { title: 'Selección de calentador — aparatos (agua caliente)', headers: summaryHeaders, rows: summaryRows },
    { title: 'Selección de calentador — parámetros', headers: paramsHeaders, rows: paramsRows },
  ];
}
