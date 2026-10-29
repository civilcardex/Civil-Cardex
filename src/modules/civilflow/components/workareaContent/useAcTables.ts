import { useMemo } from 'react';
import { f2 } from './tableHelpers.ts';
import type { MemoriaTable } from '../../utils/exportReportFinal.ts';
import type { useWorkAreaState } from '../useWorkAreaState.ts';
import { computeUcTable } from '../../utils/ucRows.ts';
import { computeAccesoriosTableLarga } from '../../utils/sanFittingsRows.ts';
import { computeAccesoriosPorRamalTable } from '../../utils/fittingsByRamalRows.ts';
import { computeWaterNetworkRows } from '../../utils/waterNetworkRows.ts';
import { computeHeaterSelectionTables } from '../../utils/heaterSelectionRows.ts';
import { DIAMETROS_AC } from '../../constants/hydraulicsData.ts';
import { lookupInternoAC } from '../../utils/fittingsUtils.ts';
import { pisoCorto } from '../../constants';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

/** Tablas de la red AC (agua caliente): UC, calentadores y accesorios. */
export function useAcTables(args: {
  proy: WorkAreaState['proy'];
  plans: WorkAreaState['plans'];
  tramosAf: WorkAreaState['tramosAf'];
  tramosAc: WorkAreaState['tramosAc'];
  aps: WorkAreaState['aps'];
  hasAc: boolean;
}) {
  const { proy, plans, tramosAf, tramosAc, aps, hasAc } = args;
  const ucAcTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    return computeUcTable('ac', tramosAc, aps);
  }, [hasAc, tramosAc, aps]);

  const heaterTables = useMemo<MemoriaTable[]>(() => {
    if (!hasAc) return [];
    return computeHeaterSelectionTables(tramosAc, plans);
  }, [hasAc, tramosAc, plans]);

  const accAcTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    return computeAccesoriosPorRamalTable(tramosAc, 'Accesorios por ramal — agua caliente');
  }, [hasAc, tramosAc]);

  const accAcDiamTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    return computeAccesoriosTableLarga('ac', tramosAc, plans);
  }, [hasAc, tramosAc, plans]);

  const acTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    const rows = computeWaterNetworkRows(
      'ac',
      tramosAc,
      tramosAf,
      plans,
      proy.p_red,
      DIAMETROS_AC,
      lookupInternoAC as (pulg: number) => number,
    );
    if (rows.length === 0) return null;
    return {
      title: 'Diseño de red agua caliente',
      headerGroups: [
        'Tramo',
        'Inicio',
        'Final',
        'Piso',
        { label: 'Unidades Consumo', span: 3 },
        'No. de descargas',
        'K',
        'Caudal (lps)',
        'Diámetro estimado',
        { label: 'Diámetro', span: 2 },
        'Coeficiente C',
        'Vel. (mm/s)',
        { label: 'Longitud (m)', span: 4 },
        { label: 'Pérdidas por fricción', span: 2 },
        { label: 'Presión', span: 2 },
      ],
      headers: [
        'Tramo',
        'Inicio',
        'Final',
        'Piso',
        'Propia',
        'Otros Ramales',
        'Total',
        'No. de descargas',
        'K',
        'Caudal (lps)',
        'Diámetro estimado',
        'Diseño',
        'Interno',
        'Coeficiente C',
        'Vel. (mm/s)',
        'Horizontal',
        'Vertical',
        'Eq. Accesorios',
        'Total',
        '%',
        'm',
        'Inicial',
        'Final',
      ],
      rows: rows.map((r) => [
        r.id,
        r.ini,
        r.fin,
        pisoCorto(r.piso),
        f2(r.udPropia),
        f2(Math.max(0, r.udTotal - r.udPropia)),
        f2(r.udTotal),
        r.nDesc > 0 ? String(r.nDesc) : '—',
        r.K > 0 ? r.K.toFixed(2) : '—',
        r.Qprob > 0 ? r.Qprob.toFixed(3) : '—',
        f2(r.diamEst),
        r.diamDis,
        f2(r.dInt),
        String(r.cHW),
        f2(r.Vmms),
        f2(r.Lh),
        f2(r.Lv),
        f2(r.Le),
        f2(r.Lt),
        f2(r.hfPct),
        f2(r.hfM),
        f2(r.Pin),
        f2(r.Pfin),
      ]),
    };
  }, [hasAc, tramosAc, tramosAf, plans, proy.p_red]);

  // ── GAS (calculado en fresco desde los datos de dibujo/accesorios persistidos — sin depender de haber visitado esa pantalla) ──
  /** Filas del diseño de gas (Gas) (compartidas: tabla + resumen por red). */
  return {
    ucAcTable,
    heaterTables,
    accAcTable,
    accAcDiamTable,
    acTable,
  };
}
