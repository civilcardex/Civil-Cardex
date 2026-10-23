import { useMemo } from 'react';
import { f2 } from './tableHelpers.ts';
import type { MemoriaTable } from '../../utils/exportReportFinal.ts';
import type { useWorkAreaState } from '../useWorkAreaState.ts';
import { useRainwater } from '../../context/RainwaterContext.tsx';
import { pisoCorto } from '../../constants';
import { nDeCanal, cDeCubierta } from '../../constants/engineeringDataMaterials.ts';
import { chequeoCanalLluvia, BORDE_LIBRE_CANAL_CM } from '../../utils/calcRainwater.ts';
import {
  buildLlBajanteAssociations,
  computeLlQMap,
  computeLlRows,
  getTributarioIds,
} from '../../utils/rainwaterRows.ts';
import { computeRainDownpipesTable } from '../../utils/rainDownpipesRows.ts';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;
type RainwaterState = ReturnType<typeof useRainwater>;

/** Tablas de la red LL (lluvias): filas, bajantes y canales. */
export function useLlTables(args: {
  plans: WorkAreaState['plans'];
  tramosLl: WorkAreaState['tramosLl'];
  bajantesLl: RainwaterState['bajantesLl'];
  canalesLl: RainwaterState['canalesLl'];
  conRecolectora: boolean;
  hasLl: boolean;
}) {
  const { plans, tramosLl, bajantesLl, canalesLl, conRecolectora, hasLl } = args;
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
  return {
    llRowsCalc,
    llTable,
    llBajTable,
    llCanalTable,
  };
}
