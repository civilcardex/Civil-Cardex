/** Tablas de memoria técnica para la red san (Sanitaria): UD (Unidades de Desague), accesorios, bajante-vent y resúmenes de tuberías (también sirve ll/af/ac). Ej: el ramal con 1 inodoro sale con sus UD acumuladas, caudal Hunter y diámetro por Manning (formula de flujo en tuberia). */
import { useMemo } from 'react';
import { f2 } from './tableHelpers.ts';
import type { MemoriaTable } from '../../utils/exportReportFinal.ts';
import type { useWorkAreaState } from '../useWorkAreaState.ts';
import { pisoCorto, SAN_UC_IDS, APARATOS_DEF } from '../../constants';
import { buildSanConnectivity, computeSanRows, computeUdTable } from '../../utils/sanitaryRows.ts';
import { computeBajanteVentTable } from '../../utils/bajanteVentRows.ts';
import { computeAccesoriosTableLarga } from '../../utils/sanFittingsRows.ts';
import { computeResumenTuberiasTable } from '../../utils/summaryPipingRows.ts';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

/** Tablas de la red SAN (aguas negras): UC, accesorios, bajante-vent y tuberías. */
export function useSanTables(args: {
  pisos: WorkAreaState['pisos'];
  plans: WorkAreaState['plans'];
  tramosSan: WorkAreaState['tramosSan'];
  aps: WorkAreaState['aps'];
  udBase: WorkAreaState['udBase'];
  hasSan: boolean;
  hasLl: boolean;
  hasAf: boolean;
  hasAc: boolean;
}) {
  const { pisos, plans, tramosSan, aps, udBase, hasSan, hasLl, hasAf, hasAc } = args;
  const sanMergedBase = useMemo(
    () =>
      SAN_UC_IDS.map((id) => {
        const fromAps = aps.find((p) => p.id === id);
        const def = APARATOS_DEF.find((d) => d.id === id);
        return { id, nombre: def?.nombre || id, ud: fromAps?.ud ?? def?.ud ?? 0 };
      }),
    [aps],
  );

  const ucSanTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    return computeUdTable(tramosSan, plans, sanMergedBase);
  }, [hasSan, tramosSan, plans, sanMergedBase]);

  const bajVentSanTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    return computeBajanteVentTable(tramosSan, plans, udBase, pisos);
  }, [hasSan, tramosSan, plans, udBase, pisos]);

  const sanAccTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    return computeAccesoriosTableLarga('san', tramosSan, plans);
  }, [hasSan, tramosSan, plans]);

  const tuberiasSanTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    return computeResumenTuberiasTable('san', plans);
  }, [hasSan, plans]);

  const tuberiasLlTable = useMemo<MemoriaTable | null>(() => {
    if (!hasLl) return null;
    return computeResumenTuberiasTable('ll', plans);
  }, [hasLl, plans]);

  const tuberiasAfTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    return computeResumenTuberiasTable('af', plans);
  }, [hasAf, plans]);

  const tuberiasAcTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    return computeResumenTuberiasTable('ac', plans);
  }, [hasAc, plans]);

  /** Filas crudas del diseño sanitario (compartidas: tabla + resumen por red). */
  const sanRowsCalc = useMemo(() => {
    if (!hasSan) return null;
    const mergedBase = sanMergedBase;
    const displayTramos = tramosSan.filter((t) => t.tipo === 'ramal' && !t.esBajante);
    const { componentTotalMap, fullChildrenMap } = buildSanConnectivity(
      tramosSan,
      plans,
      mergedBase,
    );
    return computeSanRows(displayTramos, componentTotalMap, mergedBase, tramosSan, fullChildrenMap);
  }, [hasSan, tramosSan, plans, sanMergedBase]);

  const sanTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    const rows = sanRowsCalc ?? [];
    return {
      title: 'Diseño de red sanitaria',
      headerGroups: [
        'Tramo',
        'Nivel',
        { label: 'Unidades de descarga', span: 3 },
        'No. Descargas',
        'K',
        'Caudal (LPS)',
        'Manning',
        'Pendiente (%)',
        { label: 'Diámetro', span: 3 },
        'Qo (LPS)',
        'Vo (m/s)',
        'Q/Qo',
        'Velocidad real (m/s)',
        'Chequeo velocidad',
        'Yc (mm)',
        'Yn (mm)',
        'Froude',
        'Flujo',
        'Ymax (mm)',
        'Yn vs Yc',
        { label: 'Fuerza Tractiva', span: 2 },
      ],
      headers: [
        'Tramo',
        'Nivel',
        'Propia',
        'Otros',
        'Total',
        'No. Descargas',
        'K',
        'Caudal (LPS)',
        'Manning',
        'Pendiente (%)',
        'Calculado (")',
        'Diseño (")',
        'Interior (mm)',
        'Qo (LPS)',
        'Vo (m/s)',
        'Q/Qo',
        'Velocidad real (m/s)',
        'Chequeo velocidad',
        'Yc (mm)',
        'Yn (mm)',
        'Froude',
        'Flujo',
        'Ymax (mm)',
        'Yn vs Yc',
        'Real (kg/m²)',
        '>0.15',
      ],
      rows: rows.map((r) => [
        r.id,
        pisoCorto(r.piso),
        r.udPropias,
        Math.max(0, r.udAcum - r.udPropias),
        r.udAcum,
        r.nSalidas || '—',
        r.K != null ? r.K.toFixed(2) : '—',
        r.Q != null && r.Q > 0 ? r.Q.toFixed(2) : '—',
        r.n > 0 ? r.n.toFixed(3) : '—',
        r.sVal > 0 ? r.sVal : '—',
        r.DcalcPulg > 0 ? r.DcalcPulg.toFixed(2) : '—',
        r.DdisPulg > 0 ? r.DdisPulg : '—',
        r.DintMm > 0 ? r.DintMm : '—',
        f2(r.Qo),
        f2(r.Vo),
        f2(r.qqo),
        f2(r.Vreal),
        r.chequeoV,
        f2(r.Yc),
        f2(r.Yn),
        f2(r.Froude),
        r.tipoFlujo,
        f2(r.Ymax),
        r.chequeoYn,
        f2(r.fuerzaTractiva),
        r.chequeoFT,
      ]),
    };
  }, [hasSan, sanRowsCalc]);

  return {
    sanMergedBase,
    ucSanTable,
    bajVentSanTable,
    sanAccTable,
    tuberiasSanTable,
    tuberiasLlTable,
    tuberiasAfTable,
    tuberiasAcTable,
    sanRowsCalc,
    sanTable,
  };
}
