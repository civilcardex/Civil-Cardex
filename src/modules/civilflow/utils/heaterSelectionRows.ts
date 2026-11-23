import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext.tsx';
import { APARATOS_DEF } from '../constants';
import { CAT_APS } from '../constants/engineeringDataFixtures.ts';
import { CAT_GAS } from '../constants/engineeringDataGas.ts';
import { fmt } from './formatUtils.ts';
import type { MemoriaTable } from './exportReportFinal.ts';
import { computeHeaterNetworkTotal } from './waterNetworkRows.ts';
import { hunterCurva } from './hunterCurve.ts';

// Curva de Hunter pura (decisión 2026-11-16/19): el caudal del calentador NO lleva factor de
// simultaneidad — el "Factor de simultaneidad (%)" que era editable en la pantalla (default
// 50 %, persistido en el bajante CALENTn) salió del método viejo; los bajantes viejos con
// factorSim guardado lo IGNORAN (campo huérfano, mismo patrón que n_salidas).

/** Resumen de aparatos AC del calentador (cant + UC (Unidades de Consumo) por aparato) y el
 *  totalUC del nodo raíz — udTotal del grafo manda; sin red dibujada cae a la suma de filas.
 *  ÚNICO lugar del conteo: lo usa la memoria (computeHeaterSelectionTables) y el panel vivo
 *  (HeaterSelection), que antes lo duplicaban. */
export function resumenCalentador(
  tramosAc: Tramo[],
  plans: PlanItem[],
): {
  summary: Array<{ id: string; nombre: string; cant: number; uc: number; total: number }>;
  totalUC: number;
} {
  const counts: Record<string, { cant: number; uc: number }> = {};
  for (const t of tramosAc) {
    if (!t.fixtures) continue;
    for (const [k, v] of Object.entries(t.fixtures)) {
      if (v && v > 0) {
        const apCat = CAT_APS.find((a) => a.id === k);
        if (!counts[k]) counts[k] = { cant: 0, uc: apCat ? apCat.ac : 0 };
        counts[k].cant += v;
      }
    }
  }
  const summary = Object.keys(counts)
    .map((k) => {
      const apCat = CAT_APS.find((a) => a.id === k);
      const nombre = apCat
        ? apCat.n
        : (APARATOS_DEF as unknown as Record<string, { nombre?: string }>)[k]?.nombre || k;
      const cant = counts[k].cant;
      const uc = counts[k].uc;
      return { id: k, nombre, cant, uc, total: cant * uc };
    })
    .filter((x) => x.cant > 0);
  const sumRows = summary.reduce((sum, item) => sum + item.total, 0);
  const { udTotal } = computeHeaterNetworkTotal(tramosAc, plans);
  return { summary, totalUC: udTotal > 0 ? udTotal : sumRows };
}

/** Tablas de la memoria para la selección de calentador de ac (Agua Caliente): aparatos con su UC (Unidades de Consumo), caudal probable (curva de Hunter, LPS/LPM) y qué equipo del catálogo cumple. */
export function computeHeaterSelectionTables(tramosAc: Tramo[], plans: PlanItem[]): MemoriaTable[] {
  const selectedHeaterTram = tramosAc.find((t) => t.calCapacidad !== undefined);
  const selectedHeaterId = selectedHeaterTram ? selectedHeaterTram.calCapacidad : '';
  const selectedHeater = CAT_GAS.find((g) => g.id === selectedHeaterId);

  const { summary, totalUC } = resumenCalentador(tramosAc, plans);

  // Curva de Hunter (ÚNICA copia en utils/hunterCurve.ts) — sin factor de simultaneidad.
  const caudalProbableLps = hunterCurva(totalUC);
  const caudalAjustado = caudalProbableLps * 60.0;

  const heaters = CAT_GAS.filter((g) => g.id.startsWith('cal'));
  const parsedHeaters = heaters
    .map((h) => {
      const match = h.id.match(/\d+/);
      return { ...h, cap: match ? parseInt(match[0]) : 0 };
    })
    .sort((a, b) => a.cap - b.cap);

  let recText: string;
  const suitable = parsedHeaters.find((h) => h.cap >= caudalAjustado);
  if (suitable) recText = `Recomendado: usar ${suitable.n}`;
  else if (caudalAjustado > 0)
    recText = `Recomendado: usar equipo mayor a ${parsedHeaters[parsedHeaters.length - 1]?.cap || 21} LPM o múltiples unidades`;
  else recText = 'No requiere calentador';

  let cumpleTxt = ''; // vacío = sin equipo seleccionado → la fila muestra recText ('No requiere calentador' / 'Recomendado…') en vez de un '—' mudo
  if (selectedHeaterId && selectedHeater) {
    const match = selectedHeater.id.match(/\d+/);
    const cap = match ? parseInt(match[0]) : 0;
    cumpleTxt =
      cap >= caudalAjustado
        ? `El equipo seleccionado (${selectedHeater.n}) CUMPLE con el caudal ajustado.`
        : `El equipo seleccionado (${selectedHeater.n}) NO CUMPLE. ${recText}`;
  }

  const summaryHeaders = ['Aparato', 'Cantidad', 'UC', 'Total UC'];
  const summaryRows: (string | number)[][] = summary.map((item) => [
    item.nombre,
    item.cant,
    fmt(item.uc, 2),
    fmt(item.total, 2),
  ]);
  summaryRows.push(['Total UC', '', '', fmt(totalUC, 2)]);

  const paramsHeaders = ['Parámetro', 'Valor'];
  const paramsRows: (string | number)[][] = [
    ['Caudal probable (LPS)', fmt(caudalProbableLps, 3)],
    ['Caudal de diseño (LPM)', fmt(caudalAjustado, 2)],
    ['Calentador seleccionado', selectedHeater ? selectedHeater.n : 'Ninguno'],
    ['Chequeo', cumpleTxt || recText || '—'],
  ];

  return [
    {
      title: 'Selección de calentador — aparatos (agua caliente)',
      headers: summaryHeaders,
      rows: summaryRows,
    },
    { title: 'Selección de calentador — parámetros', headers: paramsHeaders, rows: paramsRows },
  ];
}
