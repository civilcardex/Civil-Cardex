import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { pisoCorto } from '../constants';

import type { MemoriaTable, MemoriaHeaderGroup } from './exportMemoriaFinal';
import { buildSanConnectivity, type MergedApBase } from './sanConnectivity';

// Cálculo de unidades de descarga — mismo grafo de conectividad que computeSanRows, columnas
// distintas (conteos de aparato por tramo en vez del chequeo de diseño hidráulico).
/** Tabla de unidades de descarga por tramo: el mismo grafo del chequeo sanitario, con conteos de aparato en vez de hidráulica. */
export function computeUdTable(
  tramosSan: Tramo[],
  plans: PlanItem[],
  mergedBase: MergedApBase[],
): MemoriaTable | null {
  // Excluir ventilación: solo descarga sanitaria
  const sanOnly = tramosSan.filter(
    (t) =>
      (t.net || (t as unknown as { _net?: string })._net) !== 'vent' &&
      !(t.id || '').startsWith('BREV'),
  );
  const ramales = sanOnly
    .filter((t) => t.tipo === 'ramal' && !t.esBajante)
    .toSorted((a, b) => (a.piso || 0) - (b.piso || 0));
  const bajantes = sanOnly
    .filter((t) => t.esBajante)
    .toSorted((a, b) => (a.piso || 0) - (b.piso || 0));
  const displayTramos = [...ramales, ...bajantes].toSorted((a, b) => {
    if ((a.piso || 0) !== (b.piso || 0)) return (a.piso || 0) - (b.piso || 0);
    if (a.esBajante !== b.esBajante) return a.esBajante ? 1 : -1;
    return 0;
  });
  if (displayTramos.length === 0) return null;
  const {
    componentTotalMap,
    displayMap: _displayMap,
    fullChildrenMap,
  } = buildSanConnectivity(sanOnly, plans, mergedBase);

  const headers = [
    'Ramal/Bajante',
    'Nivel',
    'Inicio',
    'Fin',
    ...mergedBase.map((d) => `${d.nombre} (${d.ud} UD)`),
    'Unidades de descarga totales',
  ];
  const headerGroups: (string | MemoriaHeaderGroup)[] = [
    'Ramal/Bajante',
    'Nivel',
    'Inicio',
    'Fin',
    { label: 'Aparatos', span: mergedBase.length },
    'Unidades de descarga totales',
  ];
  const rows = displayTramos.map((t) => {
    const tKey = t._key || `${t.id}-${t.piso}`;
    const acum = componentTotalMap[tKey] || 0;
    // Para bajante, acum ya incluye tributarios vía displayMap; no duplicar ramal
    const ini =
      t.ini && typeof t.ini === 'object'
        ? `${(t.ini as { x: number; y: number }).x},${(t.ini as { x: number; y: number }).y}`
        : t.ini || '—';
    const fin =
      t.fin && typeof t.fin === 'object'
        ? `${(t.fin as { x: number; y: number }).x},${(t.fin as { x: number; y: number }).y}`
        : t.fin || '—';
    // Desglose incluye tributarios y ramales que llegan vía fullChildrenMap (transitivo)
    // — para ramal y bajante, suma aparatos de todos los descendientes (tributarios + ramales)
    const getAllDescendants = (start: string): string[] => {
      const visited = new Set<string>([start]);
      const stack = [...(fullChildrenMap[start] || [])];
      const out: string[] = [];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        out.push(cur);
        for (const child of fullChildrenMap[cur] || []) if (!visited.has(child)) stack.push(child);
      }
      return out;
    };
    const descendantKeys = getAllDescendants(tKey);
    // Filtrar a tramos con aparatos (ramal/tributario) para desglose
    const extraFixtures: Record<string, number> = { ...t.fixtures };
    for (const ck of descendantKeys) {
      const ct = sanOnly.find((x) => (x._key || `${x.id}-${x.piso}`) === ck);
      if (!ct || ct.esBajante) continue;
      if (ct.tipo !== 'ramal' && ct.tipo !== 'tributario') continue;
      for (const d of mergedBase)
        extraFixtures[d.id] = (extraFixtures[d.id] || 0) + (ct.fixtures[d.id] || 0);
    }
    // Para bajante: extraFixtures ya incluye ramales/tribs descendientes; para ramal también
    const fixtureVals = mergedBase.map((d) => extraFixtures[d.id] ?? 0);
    return [t.id, pisoCorto(t.piso), ini, fin, ...fixtureVals, acum];
  });

  // Fila de sumatoria — solo san, excluye vent
  const totales = mergedBase.map((d) => {
    const cant = sanOnly.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0);
    return { cant, ud: d.ud, subtotal: cant * d.ud };
  });
  const totalUD = totales.reduce((s, d) => s + d.subtotal, 0);
  rows.push(['Total', '', '', '', ...totales.map((d) => `${d.cant} × ${d.ud} UD`), totalUD]);

  return { title: 'Cálculo de unidades de descarga', headerGroups, headers, rows };
}
