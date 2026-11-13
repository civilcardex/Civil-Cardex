/** Modelo de la tabla de gas (gas) para el Informe: filas calculadas en fresco desde los
 *  planos confirmados (Renouard (formula de perdida en gas)), la MemoriaTable con sus 21
 *  columnas y los fallos para el resumen. Ej: sin planos con gas, gasTable queda null. */
import { useMemo } from 'react';
import type { MemoriaTable } from '../../../utils/exportReportFinal.ts';
import { pisoCorto } from '../../../constants';
import { computeGasRows } from '../../../utils/gasRows.ts';
import type { useWorkAreaState } from '../../useWorkAreaState.ts';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

/** Tabla de gas + fallos; los consumen la memoria descargable, el candado allOk y la fila
 *  GAS del resumen. */
export function useGasInforme(args: {
  hasGas: boolean;
  plans: WorkAreaState['plans'];
  pais: WorkAreaState['proy']['pais'];
}) {
  const { hasGas, plans, pais } = args;
  const gasRowsCalc = useMemo(
    () => (hasGas ? computeGasRows(plans, pais) : []),
    [hasGas, plans, pais],
  );

  const gasTable = useMemo<MemoriaTable | null>(() => {
    if (!hasGas) return null;
    const rows = gasRowsCalc;
    if (rows.length === 0) return null;
    return {
      title: 'Diseño de red de gas',
      headers: [
        'Tramo',
        'Nivel',
        'Inicio',
        'Final',
        'Material',
        'DN',
        'D int (mm)',
        'K',
        'Long (m)',
        'Q consumo (m³/h)',
        'F. altitud',
        'F. temperatura',
        'F. densidad rel.',
        'Q diseño (m³/h)',
        'Le (m)',
        'ΔP (mbar)',
        'ΔP acum (mbar)',
        'Vel (m/s)',
        'Pres. ini (mbar)',
        'Pres. fin (mbar)',
        'Chequeo',
      ],
      rows: rows.map((r) => [
        r.id,
        pisoCorto(r.piso),
        r.ini,
        r.fin,
        r.material || '—',
        r.dn || '—',
        r.dInt > 0 ? r.dInt.toFixed(2) : '—',
        r.K > 0 ? String(r.K) : '—',
        r.longitud > 0 ? r.longitud.toFixed(2) : '—',
        r.qConsumo.toFixed(2),
        r.fAlt.toFixed(2),
        r.fTemp.toFixed(2),
        r.fDens.toFixed(2),
        r.qDiseno.toFixed(2),
        r.le.toFixed(2),
        r.dP.toFixed(2),
        r.dPAcum.toFixed(2),
        r.vel.toFixed(2),
        r.pIni.toFixed(2),
        r.pFin.toFixed(2),
        r.chequeo,
      ]),
    };
  }, [hasGas, gasRowsCalc]);

  const fallosGas = (gasRowsCalc ?? []).filter((r) => r.chequeo === 'NO');

  return { gasRowsCalc, gasTable, fallosGas };
}
