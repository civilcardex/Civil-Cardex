import { useCallback, useMemo } from 'react';
import type { MemoriaTable } from '../../utils/exportMemoryFinal';
import {
  pisoLbl,
  pisoCorto,
  SAN_UC_IDS,
  AF_UC_IDS,
  AC_UC_IDS,
  APARATOS_DEF,
} from '../../constants';
import { isAC2 } from '../../utils/waterRowsShared';
import { useRainwater } from '../../context/RainwaterContext';
import { DIAMETROS_AF, DIAMETROS_AC } from '../../constants/hydraulicData';
import { lookupInterno, lookupInternoAC } from '../../utils/fittingsUtils';
import { computeDesignRow, hunterQ } from '../waterNetworkDesign/rowPhysics';
import { useWaterNetworkGraph } from '../waterNetworkDesign/useWaterNetworkGraph';
import { loadFromStorage } from '../../services/storageService';
import { CHEQUEOS_PRESION_KEY } from '../../constants/storage-keys';
import { buildSanConnectivity, computeSanRows, computeUdTable } from '../../utils/sanitaryRows';
import {
  buildLlBajanteAssociations,
  computeLlQMap,
  computeLlRows,
  getTributarioIds,
} from '../../utils/rainwaterRows';
import { computeWaterNetworkRows, computeAcometidaSummary } from '../../utils/waterNetworkRows';
import { computeBombaTables, computeEpTables } from '../../utils/equipmentRows';
import { computeGasRows } from '../../utils/gasRows';
import { epAlertas, bombaAlertas } from '../../utils/equipmentRows';
import { computeUcTable } from '../../utils/ucRows';
import { computeBajanteVentTable } from '../../utils/bajanteVentRows';
import { computeAccesoriosTable } from '../../utils/sanFittingsRows';
import { computeAccesoriosPorRamalTable } from '../../utils/fittingsByRamalRows';
import { computeRainDownpipesTable } from '../../utils/rainDownpipesRows';
import {
  chequeoCanalLluvia,
  BORDE_LIBRE_CANAL_CM,
  chequeoBajanteLluvia,
} from '../../utils/calcRainwater';
import { nDeCanal, cDeCubierta } from '../../constants/engineeringDataMaterials';
import { computeHeaterSelectionTables } from '../../utils/heaterSelectionRows';
import { computeResumenTuberiasTable } from '../../utils/summaryPipingRows';
import { perfilDe } from '../../constants/normasPais';
import type { Tramo } from '../../context/tramosReducer';
import type { useWorkAreaState } from '../useWorkAreaState';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

export function useInfTables(state: WorkAreaState) {
  const {
    proy,
    redesActivas,
    pisos,
    plans,
    confirmedPlanos,
    tramosSan,
    tramosLl,
    tramosAf,
    tramosAc,
    aps,
    udBase,
  } = state;
  const { bajantesLl, canalesLl, conRecolectora } = useRainwater();
  const hasSan = redesActivas.some((r) => r.id === 'san');
  const hasLl = redesActivas.some((r) => r.id === 'll');
  const hasAf = redesActivas.some((r) => r.id === 'af');
  const hasAc = redesActivas.some((r) => r.id === 'ac');
  const hasGas = redesActivas.some((r) => r.id === 'gas');
  const hasBom = redesActivas.some((r) => r.id === 'bom');
  const hasEp = redesActivas.some((r) => r.id === 'ep');
  // Rangos por país (normasPais) — identificación del proyecto.
  const perfil = perfilDe(proy.pais);

  const f2 = (n: number) => (n > 0 ? n.toFixed(2) : '—');

  // ── SAN ──
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
    return computeAccesoriosTable('san', tramosSan, plans);
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

  // ── LL ──
  /** Filas crudas del diseño de aguas lluvias (compartidas: tabla + resumen por red). */
  const llRowsCalc = useMemo(() => {
    if (!hasLl) return null;
    const tribIds = getTributarioIds(tramosLl);
    const displayTramos = tramosLl.filter(
      (t) => t._key != null && !t.esBajante && !tribIds.has(t._key) && !tribIds.has(t.id),
    );
    const associations = buildLlBajanteAssociations(tramosLl, plans);
    const qMap = computeLlQMap(tramosLl, plans, bajantesLl, associations);
    return computeLlRows(displayTramos, qMap, associations);
  }, [hasLl, tramosLl, plans, bajantesLl]);

  const llTable = useMemo<MemoriaTable | null>(() => {
    if (!hasLl) return null;
    const rows = llRowsCalc ?? [];
    return {
      title: 'Diseño de red aguas lluvias',
      headerGroups: [
        'Tramo',
        'Nivel',
        'Inicio',
        'Fin',
        'Bajantes asociados',
        'Caudal (LPS)',
        'Manning',
        'Pendiente (%)',
        { label: 'Diámetro', span: 3 },
        'Qo (LPS)',
        'Vo (m/s)',
        'Q/Qo',
        'V. real (m/s)',
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
        'Inicio',
        'Fin',
        'Bajantes asociados',
        'Caudal (LPS)',
        'Manning',
        'Pendiente (%)',
        'Calculado (")',
        'Diseño (")',
        'Interior (mm)',
        'Qo (LPS)',
        'Vo (m/s)',
        'Q/Qo',
        'V. real (m/s)',
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
        r.piso ? pisoCorto(r.piso) : '—',
        r.desde || '—',
        r.hasta || '—',
        r.bajantesAsociadas.join(', ') || '—',
        r.Q > 0 ? r.Q.toFixed(2) : '—',
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
  }, [hasLl, llRowsCalc]);

  const llBajTable = useMemo<MemoriaTable | null>(() => {
    if (!hasLl) return null;
    return computeRainDownpipesTable(tramosLl, plans, bajantesLl);
  }, [hasLl, tramosLl, plans, bajantesLl]);

  const llCanalTable = useMemo<MemoriaTable | null>(() => {
    if (!hasLl || !conRecolectora || canalesLl.length === 0) return null;
    const headers = [
      'Ramal',
      'Área parcial (m²)',
      'Otras (m²)',
      'Área total (m²)',
      'Intensidad (mm/hr)',
      'Coef. escorrentía',
      'Caudal real (LPS)',
      'Manning',
      'Pendiente (%)',
      'Base (cm)',
      'Altura (cm)',
      'Longitud (cm)',
      'Borde libre (cm)',
      'Total (cm)',
      'Caudal máximo (LPS)',
      'Chequeo',
    ];
    const rows = canalesLl.map((c) => {
      // C efectivo SOLO del material de cubierta (requisito absoluto, igual que la pantalla):
      // sin material → 0 → Q=0 y chequeo 'No cumple' (sin fallback al override manual).
      const Cder = cDeCubierta(c.materialCubierta ?? '') ?? 0;
      // REQ usuario: n SOLO del material del canal — sin material → 0 → sin cálculo ni
      // chequeo (chequeo vacío en el calc; sin fallback al manning persistido).
      const nderPdf = nDeCanal(c.materialCanal ?? '');
      const { Qreal, Qmax, chequeo, totalStr } = chequeoCanalLluvia({
        ...c,
        coeficienteC: Cder,
        manning: nderPdf ?? 0,
        muroVertical: c.muroVertical ?? 0,
        bordeLibreCm: c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM,
      });
      return [
        c.sector || '—',
        c.areaParcial || '—',
        c.areaOtras ?? 0,
        c.areaAcumulada || '—',
        c.intensidad || '—',
        Cder > 0 ? Cder : '—',
        Qreal > 0 ? Qreal.toFixed(2) : '—',
        nderPdf != null ? nderPdf.toFixed(3) : '—',
        c.pendiente,
        c.b,
        c.h,
        c.longitud ?? '—',
        10,
        totalStr,
        Qmax > 0 ? Qmax.toFixed(2) : '—',
        chequeo,
      ];
    });
    return { title: 'Chequeo capacidad canal recolectora cubierta aguas lluvias', headers, rows };
  }, [hasLl, conRecolectora, canalesLl]);

  // ── AF (calculado en fresco — sin depender de haber visitado esa pantalla) ──
  const ucAfTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    return computeUcTable('af', tramosAf, aps);
  }, [hasAf, tramosAf, aps]);

  const accAfTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    return computeAccesoriosPorRamalTable(tramosAf, 'Accesorios por ramal — agua fría');
  }, [hasAf, tramosAf]);

  const accAfDiamTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    return computeAccesoriosTable('af', tramosAf, plans);
  }, [hasAf, tramosAf, plans]);

  const afTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    const rows = computeWaterNetworkRows(
      'af',
      tramosAf,
      tramosAf,
      plans,
      proy.p_red,
      DIAMETROS_AF,
      lookupInterno as (pulg: number) => number,
    );
    if (rows.length === 0) return null;
    return {
      title: 'Diseño de red agua fría',
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
  }, [hasAf, tramosAf, plans, proy.p_red]);

  // ── Acometida (solo AF) — computeAcometidaSummary recalcula todo desde tramosAf + plans, con el
  // mismo patrón de "cálculo en fresco" que afTable/ucAfTable de arriba, así (a diferencia de una
  // versión anterior que leía un valor que WaterNetworkDesign.tsx solo persistía al abrirlo) la
  // exportación nunca depende de que el usuario haya visitado antes esa pantalla específica.
  // Las filas de Acometida usan su propio formateador (no el f2 compartido) porque f2 trata el 0
  // como "sin datos" e imprime '—' — pero aquí el 0 es un valor calculado legítimo (p. ej. Qaco
  // sin aparatos todavía) y debe leerse como 0, no como dato faltante.
  function buildAcometidaTables(): MemoriaTable[] {
    if (!hasAf) return [];
    const d = computeAcometidaSummary(tramosAf, plans, DIAMETROS_AF, proy.pais);
    if (!d) return [];
    const fmtAco = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');
    const tramosTable: MemoriaTable = {
      title: 'Tramos',
      headers: [
        'Tramo',
        'Desde',
        'Hasta',
        'Horizontal (m)',
        'Eq. Accesorios (m)',
        'Diámetro estimado',
        'Diámetro propuesto',
      ],
      rows: [
        [
          'AC-01',
          d.tr1.desde,
          d.tr1.hasta,
          fmtAco(d.tr1.h),
          fmtAco(d.tr1.le),
          fmtAco(d.tr1.diamEstimado),
          d.tr1.diamPropuesto || '—',
        ],
        [
          'AC-02',
          d.tr2.desde,
          d.tr2.hasta,
          fmtAco(d.tr2.h),
          fmtAco(d.tr2.le),
          fmtAco(d.tr2.diamEstimado),
          d.tr2.diamPropuesto || '—',
        ],
      ],
    };
    const parametrosTable: MemoriaTable = {
      title: 'Resumen de parámetros',
      side: true,
      headers: ['Parámetro', 'AC-01', 'AC-02', 'Unidad'],
      rows: [
        ['Caudal (Q)', fmtAco(d.Qaco), fmtAco(d.Qaco), 'l/s'],
        ['Diámetro interior', fmtAco(d.dInt1), fmtAco(d.dInt2), 'mm'],
        ['Velocidad', fmtAco(d.V1), fmtAco(d.V2), 'mm/s'],
        ['Longitud total', fmtAco(d.Lt1), fmtAco(d.Lt2), 'm'],
        ['Pérdidas por fricción (‰)', fmtAco(d.hfPct1), fmtAco(d.hfPct2), '‰'],
        ['Pérdidas por fricción (m)', fmtAco(d.hfM1), fmtAco(d.hfM2), 'mca'],
        ['Coeficiente C', String(d.cHW1), String(d.cHW2), '—'],
        ['Diámetro del contador', d.diamContador || '—', '', 'pulg'],
        ['Caudal nominal (Qn)', fmtAco(d.Qn), '', 'L/s'],
      ],
    };
    const verificacionTable: MemoriaTable = {
      title: 'Verificación',
      headers: ['Parámetro', 'Valor'],
      rows: [
        ['AC-01 Presión inicial (mca)', fmtAco(d.p1Ini)],
        ['AC-01 Presión final (mca)', fmtAco(d.p1Fin)],
        ['AC-02 Presión inicial (mca)', fmtAco(d.p2Ini)],
        ['AC-02 Presión final (mca)', fmtAco(d.p2Fin)],
        ['Pérdidas en contador (mca)', fmtAco(d.hfContador)],
        ['Pérdidas máximas permitidas (mca)', fmtAco(d.hfMax)],
        ['Chequeo pérdidas contador', d.hfContador <= d.hfMax ? 'O.K.' : 'NO CUMPLE'],
        [
          'Diámetro acometida vs contador',
          d.diamConformeOk ? 'Conforme' : `No conforme (+${fmtAco(d.diamDiff)}")`,
        ],
        ['Presión residual final (mca)', fmtAco(d.pResidual)],
        ['ESTADO GENERAL', d.estadoOk ? 'O.K.' : 'NO CUMPLE'],
      ],
    };
    return [tramosTable, parametrosTable, verificacionTable];
  }

  // ── AC (calculado en fresco; además se alimenta del pFin propio persistido por AF en el nodo calentador) ──
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
    return computeAccesoriosTable('ac', tramosAc, plans);
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
  const gasRowsCalc = useMemo(
    () => (hasGas ? computeGasRows(plans, proy.pais) : []),
    [hasGas, plans, proy.pais],
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

  /** Revisa si una fila ya calculada cumple los rangos (velocidad, tirante, caudal lleno):
   *  la misma regla de rangos del país, aplicada AQUÍ en fresco sobre las filas de
   *  computeSanRows/computeLlRows — antes dependía de banderas que solo escribía la
   *  página de Diseño de redes. */
  const filaEnRangoSanLl = useCallback(
    (r: { Vreal: number; Yc: number; Yn: number; DintMm: number; qqo: number }): boolean =>
      r.Vreal >= perfil.san.vMin &&
      r.Vreal <= perfil.san.vMax &&
      r.DintMm > 0 &&
      // yD de la página = max(Yc, Yn)/D (el tiro de DISEÑO manda en flujo supercrítico) —
      // usar solo Yn era más laxo exactamente donde importa.
      Math.max(r.Yc, r.Yn) / r.DintMm <= perfil.san.ydMax &&
      r.qqo <= 1.0,
    [perfil],
  );
  // Filas CON dato hidráulico (Vreal>0 ⇒ hubo Q, pendiente, Manning y diámetro): los flags
  // v_real de la página ya no intervienen en el gate ni en el semáforo.
  const conDatosSan = (sanRowsCalc ?? []).filter((r) => r.Vreal > 0);
  const conDatosLl = (llRowsCalc ?? []).filter((r) => r.Vreal > 0);
  const noTrib = useCallback((t: { tipo?: string }) => t.tipo !== 'tributario', []);
  /** Fallo de tabla: fila cuya verificación dice 'NO CUMPLE' (las '—' son filas sin datos, no fallos). */
  const filaFalla = useCallback(
    (r: {
      chequeoV: string;
      chequeoYn: string;
      chequeoFT: string;
      chequeoD?: string;
      Q?: number | null;
      DcalcPulg?: number;
      DdisPulg?: number;
    }): boolean =>
      r.chequeoV === 'NO CUMPLE' ||
      r.chequeoYn === 'NO CUMPLE' ||
      r.chequeoFT === 'NO CUMPLE' ||
      // Chequeo de diámetro de LLUVIAS (title-case): solo con datos completos.
      (r.chequeoD === 'No cumple' &&
        Number(r.Q ?? 0) > 0 &&
        Number(r.DcalcPulg ?? 0) > 0 &&
        Number(r.DdisPulg ?? 0) > 0),
    [],
  );
  // Ubicación de fallos (ped. usuario): etiqueta `${id}-${piso}` de cada elemento que incumple.
  const etiq = (id: unknown, piso: number | undefined): string => {
    const raw = String(id ?? '?');
    const corto = raw.length > 10 ? `${raw.slice(0, 4)}…` : raw;
    return `${corto}-${pisoCorto(Number(piso ?? 0))}`;
  };
  /** Fallos leídos de una MemoriaTable: filas donde una columna /chequeo/i dice 'No cumple'.
   *  sufijoDe: nivel del elemento (ej. row[1]='P2' en bajantes aguas negras) → chip `BAN1-P2`. */
  const fallosDeTabla = useCallback(
    (tbl: MemoriaTable | null, sufijoDe?: (row: unknown[]) => string): string[] => {
      if (!tbl) return [];
      const idxCh: number[] = [];
      tbl.headers.forEach((h, i) => {
        if (/chequeo/i.test(String(h))) idxCh.push(i);
      });
      if (idxCh.length === 0) return [];
      const out: string[] = [];
      for (const row of tbl.rows) {
        if (idxCh.some((i) => /^no cumple$/i.test(String(row[i] ?? '').trim()))) {
          const suf = sufijoDe?.(row) ?? '';
          out.push(suf ? `${String(row[0] ?? '—')}-${suf}` : String(row[0] ?? '—'));
        }
      }
      return out;
    },
    [],
  );
  // SAN: rango (V/Yn/D, q/Q0) + chequeos de la tabla (velocidad, tiro Yn, fuerza tractiva).
  // Las filas de computeSanRows ya excluyen tributarios y bajantes.
  const fallosSan = useMemo(
    () => [
      ...conDatosSan.filter((r) => !filaEnRangoSanLl(r)).map((r) => ({ id: r.id, piso: r.piso })),
      ...(sanRowsCalc ?? []).filter(filaFalla).map((r) => ({ id: r.id, piso: r.piso })),
    ],
    [conDatosSan, sanRowsCalc, filaEnRangoSanLl, filaFalla],
  );
  /** Chips SAN (Sanitaria) = fallos de tramos + filas 'No cumple' de la tabla de bajantes
   *  aguas negras/vent (Ventilacion). Se calcula una vez y lo usan tanto el candado de
   *  descargas (allOk) como la fila SAN del resumen. */
  const fallosSanLabs = useMemo(
    () => [
      ...fallosSan.map((t) => etiq(t.id, t.piso)),
      ...fallosDeTabla(bajVentSanTable, (row) => (row[1] && row[1] !== '—' ? String(row[1]) : '')),
    ],
    [fallosSan, fallosDeTabla, bajVentSanTable],
  );
  // LL: rango + chequeos de tabla + bajantes + canales. Filas ya sin tributarios/bajantes.
  const fallosLl = useMemo(
    () => [
      ...conDatosLl.filter((r) => !filaEnRangoSanLl(r)).map((r) => ({ id: r.id, piso: r.piso })),
      ...(llRowsCalc ?? []).filter(filaFalla).map((r) => ({ id: r.id, piso: r.piso })),
    ],
    [conDatosLl, llRowsCalc, filaEnRangoSanLl, filaFalla],
  );
  // Semáforo y chips juzgan el MISMO conjunto (solo ramales — sin tributarios): si dice
  // 'Revisar', los chips de fallo aparecen al lado (ped. usuario).
  const tramosAfJ = useMemo(() => tramosAf.filter(noTrib), [tramosAf, noTrib]);
  const tramosAcJ = useMemo(() => tramosAc.filter(noTrib), [tramosAc, noTrib]);
  // Chequeos de presión SIN depender de visitar Diseño de redes: la página persiste sus
  // resultados en CHEQUEOS_PRESION_KEY; Informes hidrata de ahí y RECALCULA la velocidad
  // en frío (qLps persistido es flujo — no depende del diámetro — y el diámetro efectivo
  // sale del tramo actual). presionOk = último chequeo persistido (cadena de acometida).
  const chequeosPresion = loadFromStorage<
    Record<string, Record<string, { velCumple?: boolean; presionOk?: boolean; qLps?: number }>>
  >(CHEQUEOS_PRESION_KEY, {});
  const afOpts = useMemo(
    () => DIAMETROS_AF.map((d) => ({ pulg: d.pulg, nominal: d.nominal, dInt: d.dInt })),
    [],
  );
  const acOpts = useMemo(
    () => DIAMETROS_AC.map((d) => ({ pulg: d.pulg, nominal: d.nominal, dInt: d.dInt })),
    [],
  );
  // Grafo de conectividad AF/AC en frío: Informes calcula su PROPIO qLps (hunterQ sobre los
  // UC acumulados) — la velocidad no depende de haber visitado Diseño de redes, ni del store
  // (los aparatos cambian desde el panel sin pasar por la página).
  const graphAf = useWaterNetworkGraph({
    plans,
    tramos: tramosAf,
    networkType: 'af',
    ucIds: AF_UC_IDS,
    ucField: 'uc_af',
  });
  const graphAc = useWaterNetworkGraph({
    plans,
    tramos: tramosAc,
    networkType: 'ac',
    ucIds: AC_UC_IDS,
    ucField: 'uc_ac',
  });
  const tr2Af = useMemo(() => tramosAf.find((t) => isAC2(t)) ?? null, [tramosAf]);
  const qacoAf = useMemo(() => {
    if (tr2Af) {
      const key = tr2Af._key || tr2Af.id;
      const q = hunterQ(graphAf.componentTotalMap[key] || 0, tr2Af.nSalidas || 0);
      if (q > 0) return q;
    }
    return 0;
  }, [tr2Af, graphAf.componentTotalMap]);
  /** Velocidad (recalculada con el diámetro actual) y presión (guardada del último cálculo)
   *  de un tramo de presión (af/ac). null = sin dato → chip "(sin verificar)" y la fila
   *  queda en Revisar. */
  const chequeoDe = useCallback(
    (t: Tramo, net: 'af' | 'ac'): { vel: boolean | null; pres: boolean | null } => {
      const key = t._key || t.id;
      const stored = chequeosPresion[net]?.[key];
      // Caudal fresco del grafo (tr2 usa el Qaco de la red); el store solo como red de
      // seguridad si el grafo no alcanza a calcularlo.
      const totalAcum = (net === 'af' ? graphAf : graphAc).componentTotalMap[key] || 0;
      const qFresco =
        net === 'af' && tr2Af && (tr2Af._key || tr2Af.id) === key
          ? qacoAf
          : hunterQ(totalAcum, t.nSalidas || 0);
      const qLps = qFresco > 0 ? qFresco : (stored?.qLps ?? t.qLps ?? 0);
      let vel: boolean | null = null;
      if (qLps > 0) {
        const c = computeDesignRow(t, {
          qprob: qLps,
          diamOpts: net === 'af' ? afOpts : acOpts,
          diamNomMap: {},
          diamIntMap: {},
          lookupFn: (net === 'af' ? lookupInterno : lookupInternoAC) as (pulg: number) => number,
        });
        const vMinMms = perfil.af.vMin * 1000;
        const vMaxMms = perfil.af.vMax * 1000;
        vel = c.Vmms > 0 ? c.Vmms >= vMinMms && c.Vmms <= vMaxMms : null;
      }
      const pres =
        typeof stored?.presionOk === 'boolean'
          ? stored.presionOk
          : typeof t.presionOk === 'boolean'
            ? t.presionOk
            : null;
      return { vel, pres };
    },
    [chequeosPresion, afOpts, acOpts, perfil, graphAf, graphAc, tr2Af, qacoAf],
  );
  const estadoPresionDe = useCallback(
    (tramos: typeof tramosAfJ, net: 'af' | 'ac') => {
      const conFallos: typeof tramos = [];
      const sinVerificar: typeof tramos = [];
      for (const t of tramos) {
        const c = chequeoDe(t, net);
        if (c.vel === false || c.pres === false) conFallos.push(t);
        else if (c.vel === null || c.pres === null) sinVerificar.push(t);
      }
      return { conFallos, sinVerificar };
    },
    [chequeoDe],
  );
  const cheqAf = useMemo(() => estadoPresionDe(tramosAfJ, 'af'), [estadoPresionDe, tramosAfJ]);
  const cheqAc = useMemo(() => estadoPresionDe(tramosAcJ, 'ac'), [estadoPresionDe, tramosAcJ]);
  const sinVerificarAf = cheqAf.sinVerificar;
  const sinVerificarAc = cheqAc.sinVerificar;
  const okAF =
    tramosAfJ.length > 0 && cheqAf.conFallos.length === 0 && cheqAf.sinVerificar.length === 0;
  const okAC =
    tramosAcJ.length > 0 && cheqAc.conFallos.length === 0 && cheqAc.sinVerificar.length === 0;
  const fallosAf = cheqAf.conFallos;
  const fallosAc = cheqAc.conFallos;
  // Mismos insumos que la MemoriaTable (rainDownpipesRows): C derivado del material y
  // manning con default 0.009 — sin esto el resumen juzga con otra fórmula que la tabla.
  // Sin filtro de área: con área 0 el chequeo ya sale '' (Q=0 → dCalc=0), el filtro sobra.
  const fallosBajLl = useMemo(
    () =>
      bajantesLl.filter(
        (b) =>
          chequeoBajanteLluvia({
            ...b,
            areaAcumulada: b.areaAcumulada || 0,
            coeficienteC: cDeCubierta(b.materialCubierta ?? '') ?? 0,
            manning: b.manning || 0.009,
          }).chequeo === 'No cumple',
      ),
    [bajantesLl],
  );
  // Nivel de cada bajante ll desde sus tramos esBajante (BajanteLl no trae piso).
  // Key por CODE visible (la tabla usa row[0]=code): ids internos de dibujo no matchean.
  const pisoDeBajLl = useMemo(
    () => new Map(tramosLl.filter((t) => t.esBajante).map((t) => [String(t.code || t.id), t.piso])),
    [tramosLl],
  );
  // Canales: misma fórmula de la tabla (C del material, n del material — sin material no hay chequeo).
  const fallosCanalLl = useMemo(
    () =>
      (canalesLl ?? [])
        .filter((c) => {
          const Cder = cDeCubierta(c.materialCubierta ?? '') ?? 0;
          const nd = nDeCanal(c.materialCanal ?? '');
          if (Cder <= 0 || nd == null) return false;
          return (
            chequeoCanalLluvia({
              ...c,
              coeficienteC: Cder,
              manning: nd,
              muroVertical: c.muroVertical ?? 0,
              bordeLibreCm: c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM,
            }).chequeo === 'No cumple'
          );
        })
        .map((c) => {
          const piso = plans.find(
            (p) => String(p.id) === String((c as { planId?: unknown }).planId),
          )?.nivel;
          return `${c.sector || 'Canal'}-${pisoCorto(Number(piso ?? 0))}`;
        }),
    [canalesLl, plans],
  );
  // AF: acometida (computeAcometidaSummary estadoOk) — la tabla la marca, el resumen la lista.
  const acometidaOk =
    computeAcometidaSummary(tramosAf, plans, DIAMETROS_AF, proy.pais)?.estadoOk !== false;
  const fallosGas = (gasRowsCalc ?? []).filter((r) => r.chequeo === 'NO');
  // Bomba AR: hoy sin filas cumple/no cumple — gate por presencia de memoria calculada.
  const alertasBomba = useMemo(() => (hasBom ? bombaAlertas() : null), [hasBom]);
  const hasCheckedNet = hasSan || hasLl || hasAf || hasAc || hasGas || hasEp || hasBom;
  // Gate ÚNICO: derivado de los mismos labs que alimentan el resumen (auditoría F-4).
  // Sin verificar (materiales sin elegir): la tabla no chequea, pero no es OK. Los chips se
  // calculan UNA vez — son insumo del gate Y de la lista del resumen (antes vivían 2 veces).
  const nivelCubierta = pisos.find((p) => p.n === 99)?.n ?? 99;
  const fallosCanalSinVerificar = useMemo(
    () =>
      (canalesLl ?? [])
        .filter((c) => {
          const Cder = cDeCubierta(c.materialCubierta ?? '') ?? 0;
          const nd = nDeCanal(c.materialCanal ?? '');
          return Cder <= 0 || nd == null;
        })
        .map((c) => {
          // El canal es de CUBIERTA por definición: nivel = c.piso (glifo) o el piso cubierta.
          return `${c.sector || 'Canal'}-${pisoCorto(Number(c.piso ?? nivelCubierta))} (sin verificar)`;
        }),
    [canalesLl, nivelCubierta],
  );
  // Bajante LL SIN material elegido: la tabla no lo chequea, pero no es OK (paralelo al canal).
  const fallosBajSinVerificar = useMemo(
    () =>
      bajantesLl
        .filter((b) => !b.materialCubierta)
        .map((b) => {
          const code = String(b.bajante || b.id);
          const pid = pisoDeBajLl.get(code);
          return `${code}${pid != null ? '-' + pisoCorto(Number(pid)) : ''} (sin verificar)`;
        }),
    [bajantesLl, pisoDeBajLl],
  );
  const canalSinVerificarHay = fallosCanalSinVerificar.length > 0;
  const bajSinVerificarHay = fallosBajSinVerificar.length > 0;
  // Sin calcular ≠ OK: una red activa sin elementos calculados bloquea la descarga igual que
  // un fallo (mismos umbrales que producen '◌ Sin calcular' en las filas del resumen).
  const allOk =
    hasCheckedNet &&
    (!hasSan || conDatosSan.length > 0) &&
    fallosSanLabs.length === 0 &&
    // Términos de lluvias TODOS bajo hasLl: bajantesLl/canalesLl vienen del espejo del
    // RainwaterContext (persiste en localStorage aunque el proyecto no tenga la red activa)
    // — sin el gate, datos stale de otra red bloqueaban la descarga con todas las filas
    // visibles en verde (reporte: "redes ok pero no deja descargar").
    (!hasLl || conDatosLl.length + bajantesLl.length + (canalesLl?.length ?? 0) > 0) &&
    (!hasLl || fallosLl.length === 0) &&
    (!hasLl || fallosBajLl.length === 0) &&
    (!hasLl || fallosCanalLl.length === 0) &&
    (!hasLl || !canalSinVerificarHay) &&
    (!hasLl || !bajSinVerificarHay) &&
    (!hasAf || okAF) &&
    acometidaOk &&
    (!hasAc || okAC) &&
    (!hasGas || fallosGas.length === 0) &&
    (!hasEp || (epAlertas() ?? []).length === 0) &&
    (!hasBom || alertasBomba === null || alertasBomba.length === 0);
  const items = useMemo<[string, string, string[]?][]>(() => {
    const rows: [string, string, string[]?][] = [
      ['PROYECTO', proy.nombre],
      ['DIRECCIÓN', proy.dir || '—'],
      ['USO', proy.uso],
      ['REDES', redesActivas.map((r) => r.lbl).join(' · ')],
      [
        'NIVELES',
        pisos
          .toSorted((a, b) => a.n - b.n)
          .map((p) => pisoLbl(p.n))
          .join(' · '),
      ],
    ];
    const labs = (fs: { id: unknown; piso?: number }[]) => fs.map((t) => etiq(t.id, t.piso));
    // SAN: chips memoizados (fallos de tramos + filas 'No cumple' de la tabla de bajantes).
    const estadoSan = fallosSanLabs.length
      ? '✗ Revisar'
      : conDatosSan.length > 0
        ? '✓ OK'
        : '◌ Sin calcular';
    const fallosLlLabs2 = [
      ...fallosLl.map((t) => etiq(t.id, t.piso)),
      ...fallosBajLl.map((b) =>
        etiq(b.bajante || b.id, pisoDeBajLl.get(String(b.bajante || b.id))),
      ),
      ...fallosCanalLl,
      ...fallosDeTabla(llBajTable),
      ...fallosCanalSinVerificar,
      ...fallosBajSinVerificar,
    ];
    const estadoLl = fallosLlLabs2.length
      ? '✗ Revisar'
      : conDatosLl.length === 0 && bajantesLl.length === 0 && (canalesLl?.length ?? 0) === 0
        ? '◌ Sin calcular'
        : '✓ OK';
    const fallosDe = (ok: boolean, labs2: string[]): string[] => (ok ? [] : labs2);
    if (hasSan) rows.push(['SANITARIA', estadoSan, fallosSanLabs]);
    if (hasLl)
      rows.push(['AGUAS LLUVIAS', estadoLl, estadoLl === '✗ Revisar' ? fallosLlLabs2 : []]);
    const sinVerificarLabs = (ts: typeof tramosAfJ) =>
      ts.map((t) => `${etiq(t.id, t.piso)} (sin verificar)`);
    const fallosAfLabs = [
      ...labs(fallosAf),
      ...sinVerificarLabs(sinVerificarAf),
      ...(acometidaOk ? [] : ['ACOMETIDA']),
    ];
    if (hasAf)
      rows.push([
        'AGUA FRÍA',
        tramosAfJ.length === 0 ? '◌ Sin calcular' : okAF && acometidaOk ? '✓ OK' : '✗ Revisar',
        fallosDe(okAF && acometidaOk, fallosAfLabs),
      ]);
    const fallosAcLabs = [...labs(fallosAc), ...sinVerificarLabs(sinVerificarAc)];
    if (hasAc)
      rows.push([
        'AGUA CALIENTE',
        tramosAcJ.length === 0 ? '◌ Sin calcular' : okAC ? '✓ OK' : '✗ Revisar',
        fallosDe(okAC, fallosAcLabs),
      ]);
    if (hasGas)
      rows.push([
        'GAS',
        (gasRowsCalc ?? []).length === 0
          ? '◌ Sin calcular'
          : fallosGas.length === 0
            ? '✓ OK'
            : '✗ Revisar',
        fallosGas.map((r) => etiq(r.id, r.piso)),
      ]);
    if (hasEp) {
      const alertasEp = epAlertas();
      rows.push([
        'EQUIPO PRESIÓN',
        alertasEp === null ? '◌ Sin calcular' : alertasEp.length === 0 ? '✓ OK' : '✗ Revisar',
        alertasEp ?? [],
      ]);
    }
    if (hasBom)
      rows.push([
        'BOMBA AR',
        alertasBomba === null ? '◌ Sin calcular' : alertasBomba.length === 0 ? '✓ OK' : '✗ Revisar',
        alertasBomba ?? [],
      ]);
    return rows;
  }, [
    proy,
    redesActivas,
    pisos,
    okAF,
    okAC,
    hasSan,
    hasLl,
    hasAf,
    hasAc,
    hasGas,
    hasEp,
    fallosSanLabs,
    fallosLl,
    fallosAf,
    fallosAc,
    fallosBajLl,
    fallosCanalLl,
    fallosCanalSinVerificar,
    fallosBajSinVerificar,
    fallosGas,
    pisoDeBajLl,
    fallosDeTabla,
    tramosAfJ,
    tramosAcJ,
    llBajTable,
    conDatosSan.length,
    conDatosLl.length,
    bajantesLl,
    canalesLl,
    gasRowsCalc,
    acometidaOk,
    hasBom,
    alertasBomba,
    sinVerificarAf,
    sinVerificarAc,
  ]);
  const estadoLabel = !hasCheckedNet
    ? '—'
    : allOk
      ? '✓ Listo para descargar'
      : '✗ Revisar redes con errores';
  const estadoColor = !hasCheckedNet ? 'var(--txt3)' : allOk ? 'var(--ok)' : 'var(--err)';

  // ── BOMBA / EP ── computeBombaTables/computeEpTables (equiposRows.ts) reconstruyen cada tabla
  // desde todas las páginas de la pantalla en fresco al momento de descargar — mismo patrón de
  // "sin dependencia de visitar pantallas, sin useMemo obsoleto" que buildAcometidaTables de
  // arriba, y una tabla por tarjeta en vez de un resumen único aplanado (coincide con lo que las
  // pantallas reales BombaARDesign/EPInputPage/EPVerificationPage muestran en sus páginas).
  const buildBombaTables = (): MemoriaTable[] => (hasBom ? computeBombaTables() : []);
  const buildEpTables = useCallback(
    (): MemoriaTable[] => (hasEp ? computeEpTables(proy.pais) : []),
    [hasEp, proy.pais],
  );

  return {
    proy,
    redesActivas,
    pisos,
    tramosSan,
    tramosLl,
    tramosAf,
    tramosAc,
    plans,
    aps,
    udBase,
    confirmedPlanos,
    bajantesLl,
    canalesLl,
    conRecolectora,
    perfil,
    f2,
    sanMergedBase,
    sanRowsCalc,
    llRowsCalc,
    hasSan,
    hasLl,
    hasAf,
    hasAc,
    hasGas,
    hasBom,
    hasEp,
    ucSanTable,
    bajVentSanTable,
    sanAccTable,
    tuberiasSanTable,
    tuberiasLlTable,
    tuberiasAfTable,
    tuberiasAcTable,
    sanTable,
    llTable,
    llBajTable,
    llCanalTable,
    ucAfTable,
    accAfTable,
    accAfDiamTable,
    afTable,
    buildAcometidaTables,
    ucAcTable,
    heaterTables,
    accAcTable,
    accAcDiamTable,
    acTable,
    gasTable,
    hasCheckedNet,
    allOk,
    items,
    estadoLabel,
    estadoColor,
    buildBombaTables,
    buildEpTables,
  };
}
