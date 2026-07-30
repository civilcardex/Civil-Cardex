import type { Tramo } from '../context/tramosReducer';
import { ACCESORIOS_HIDRO, pisoCorto } from '../constants';
import { dropAllZeroColumns, type MemoriaTable } from './exportMemoriaFinal';

const ACCESORIOS_COLS = ACCESORIOS_HIDRO.filter((a) => a.id !== 'llaveTerminal');

export function computeAccesoriosPorRamalTable(
  tramos: Tramo[],
  title: string,
): MemoriaTable | null {
  const validTramos = tramos.filter((t) => t.tipo !== 'tributario');
  if (validTramos.length === 0) return null;
  const headers = ['Tramo', ...ACCESORIOS_COLS.map((a) => a.nombre)];
  const rows = validTramos.map((t) => {
    const base = t.label || t.id;
    const lbl = t.piso != null ? `${base}-${pisoCorto(t.piso)}` : base;
    return [lbl, ...ACCESORIOS_COLS.map((a) => t.accesorios?.[a.id] || 0)];
  });
  return dropAllZeroColumns({ title, headers, rows });
}
