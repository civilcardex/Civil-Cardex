import type { Tramo } from '../context/tramosReducer';
import type { ApsItem } from '../context/ApparatusContext';
import { APARATOS_DEF, AF_UC_IDS, AC_UC_IDS, pisoCorto } from '../constants';
import { calcUCparcial, calcUCacumulado } from './componentHelpers';
import type { MemoriaTable, MemoriaHeaderGroup } from './exportMemoriaFinal';

const TIPO_CFG = {
  af: {
    ucIds: AF_UC_IDS,
    field: 'uc_af' as const,
    apField: 'ucaf' as const,
    title: 'agua fría',
    showTotal: true,
  },
  ac: {
    ucIds: AC_UC_IDS,
    field: 'uc_ac' as const,
    apField: 'ucac' as const,
    title: 'agua caliente',
    showTotal: false,
  },
};

export function computeUcTable(
  tipo: 'af' | 'ac',
  tramos: Tramo[],
  aps: ApsItem[],
): MemoriaTable | null {
  if (tramos.length === 0) return null;
  const { ucIds, field, apField, title, showTotal } = TIPO_CFG[tipo];

  const AP = ucIds
    .map((id) => {
      const a = APARATOS_DEF.find((x) => x.id === id);
      if (!a) return null;
      const fromAps = aps.find((p) => p.id === id);
      const merged = fromAps ? { ...a, [field]: fromAps[apField] || a[field] } : a;
      return merged;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const acumMap = showTotal ? calcUCacumulado(tramos, AP, field) : {};
  const sortedTramos = tramos
    .filter((t) => t.tipo !== 'tributario' && !t.esBajante)
    .toSorted((a, b) => (a.piso || 0) - (b.piso || 0));

  const headers = [
    'Tramo',
    'Nivel',
    'Inicio',
    'Fin',
    ...AP.map((d) => `${d.nombre} (${d[field]} UC)`),
    'Parcial',
  ];
  if (showTotal) headers.push('Total', 'Longitud (m)', 'No. desc. simult.');

  const headerGroups: (string | MemoriaHeaderGroup)[] = [
    'Tramo',
    'Nivel',
    'Inicio',
    'Fin',
    { label: 'Aparatos', span: AP.length },
  ];
  if (showTotal)
    headerGroups.push(
      { label: 'Unidades de consumo', span: 2 },
      'Longitud (m)',
      'No. desc. simult.',
    );
  else headerGroups.push('Parcial');

  const rows = sortedTramos.map((t) => {
    const parcial = calcUCparcial(t, AP, field);
    const acum = showTotal ? acumMap[t.id] || 0 : 0;
    const ini =
      t.ini && typeof t.ini === 'object'
        ? `${(t.ini as { x: number; y: number }).x},${(t.ini as { x: number; y: number }).y}`
        : t.ini || '—';
    const fin =
      t.fin && typeof t.fin === 'object'
        ? `${(t.fin as { x: number; y: number }).x},${(t.fin as { x: number; y: number }).y}`
        : t.fin || '—';
    const row: (string | number)[] = [
      t.id,
      pisoCorto(t.piso),
      ini,
      fin,
      ...AP.map((d) => t.fixtures?.[d.id] || 0),
      parcial,
    ];
    if (showTotal) {
      const vLh = t.totalL || t.Lh || 0;
      const vNS = t.nSalidas ?? 0;
      row.push(acum, vLh > 0 ? vLh.toFixed(2) : '—', vNS > 0 ? vNS : '—');
    }
    return row;
  });

  // Sumatoria row — matches the on-screen table's tfoot: per-aparato "cant × UC" subtotal, plus
  // the grand total UC for the whole network.
  const totales = AP.map((d) => {
    const cant = tramos.reduce((s, t) => s + (t.fixtures?.[d.id] || 0), 0);
    const uc = d[field] as number;
    return { cant, uc, subtotal: cant * uc };
  });
  const totalUC = totales.reduce((s, d) => s + d.subtotal, 0);
  const sumRow: (string | number)[] = [
    'Total',
    '',
    '',
    '',
    ...totales.map((d) => `${d.cant} × ${d.uc} UC`),
  ];
  sumRow.push(showTotal ? '' : totalUC);
  if (showTotal) sumRow.push(totalUC, '', '');
  rows.push(sumRow);

  return { title: `Cálculo de unidades de consumo ${title}`, headerGroups, headers, rows };
}
