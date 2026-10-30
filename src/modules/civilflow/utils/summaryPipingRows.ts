import type { PlanItem } from '../context/PlansContext.tsx';
import { leerDocDePlan } from './readPlanDrawing';
import { diamPulgFromLabel } from './diamInchesFromLabel.ts';
import { isLdesvioRamalId } from './associateBajanteAcrossFloors';
import { dropAllZeroColumns, type MemoriaTable } from './exportReportFinal.ts';

const NET_LABELS: Record<string, string> = {
  san: 'Sanitaria',
  ll: 'Aguas Lluvias',
  af: 'Agua Fría',
  ac: 'Agua Caliente',
  gas: 'Gas',
};

interface ResumenRow {
  diametro: string;
  material: string;
  longitud: number;
}

/** Tabla "Resumen de tuberías" de la memoria: una fila por (diámetro × material) en todos los planos confirmados, sumando totalL (m) de cada ramal de la red — lista rápida de materiales instalados. */
export function computeResumenTuberiasTable(net: string, plans: PlanItem[]): MemoriaTable | null {
  const groups: Record<string, ResumenRow> = {};
  for (const plan of plans || []) {
    if (plan.status !== 'confirmed') continue;
    const data = leerDocDePlan(plan.id);
    if (!data) continue;
    for (const r of (
      data as {
        ramales?: Array<{
          id?: string;
          net?: string;
          diametro?: string;
          material?: string;
          totalL?: number;
        }>;
      } as {
        ramales?: Array<{
          id?: string;
          net?: string;
          diametro?: string;
          material?: string;
          totalL?: number;
        }>;
      }
    ).ramales || []) {
      if (isLdesvioRamalId(r.id)) continue;
      if (r.net !== net) continue;
      if (!r.totalL || r.totalL <= 0) continue;
      const diam = r.diametro || '';
      const mat = r.material || '';
      const key = `${diam}│${mat}`;
      if (!groups[key]) groups[key] = { diametro: diam, material: mat, longitud: 0 };
      groups[key].longitud += r.totalL;
    }
  }

  const rows = Object.values(groups)
    .filter((g) => g.longitud > 0)
    .sort(
      (a, b) =>
        diamPulgFromLabel(b.diametro) - diamPulgFromLabel(a.diametro) ||
        a.material.localeCompare(b.material),
    );
  if (rows.length === 0) return null;

  const table: MemoriaTable = {
    title: `Resumen de tuberías — ${NET_LABELS[net] || net}`,
    headers: ['Diámetro', 'Material', 'Longitud (m)'],
    rows: rows.map((g) => [
      g.diametro || '—',
      g.material || '—',
      Math.round(g.longitud * 100) / 100,
    ]),
  };
  return dropAllZeroColumns(table, 0, 0);
}
