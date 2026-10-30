/**
 * Modelo de la tabla de diseño sanitario: aparatos fusionados, conectividad del árbol del
 * piso, filas de chequeo hidráulico (UD -> Hunter -> Manning) y el handler de cambio de
 * diámetro. Todo lo que es CÁLCULO vive aquí; SanitaryDesign solo arma la pantalla.
 * Ej: con 2 lavamanos en RS1 (4 UD) y K 0.8 -> sanRows trae Q = caudalHunterLPS(4, 0.8) L/s.
 */
import { useCallback, useEffect, useMemo } from 'react';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { DIAM_OPTIONS_SAN, SAN_UC_IDS, APARATOS_DEF } from '../../constants';
import { caudalHunterLPS, factorSimultaneidad } from '../../utils/calcSanitaryCore.ts';
import { calcHydraulicCheck } from '../../utils/hydraulicCheck.ts';
import { perfilDe } from '../../constants/countryStandards';
import {
  buildSanConnectivity,
  computeSanRows,
  type MergedApBase,
  type SanRow,
} from '../../utils/sanitaryRows.ts';
import { aplicarCambioDiametroSan } from '../sanDiamChange.ts';

/** Firma del escritor de tramos sanitarios (la misma de TramosContext). */
export type UpdTramoSan = (id: string, field: string, val: string | number | boolean) => void;

/** Lo que la pantalla de diseño sanitario necesita para pintar su tabla. */
export interface SanitaryRowsModel {
  /** Aparatos de la red con su UD (Unidades de Descarga) final (override del usuario). */
  mergedBase: MergedApBase[];
  /** Ramales dibujados (sin bajantes): las filas de la tabla. */
  displayTramos: Tramo[];
  /** Quién descarga en quién, para las insignias "Otros" de la columna UD. */
  conexionesDisplay: Record<string, string[]>;
  /** UD acumuladas por clave de tramo. */
  componentTotalMap: Record<string, number>;
  fullChildrenMap: Record<string, string[]>;
  /** Conteo por aparato sobre TODOS los tramos (tabla de totales). */
  totales: Array<{ id: string; nombre: string; ud: number; cant: number }>;
  /** Suma de UD del proyecto: cant * ud de cada aparato. */
  totalUD: number;
  /** Filas de cálculo hidráulico por tramo (lo que pinta la tabla). */
  sanRows: SanRow[];
  /** Clave "id-piso" -> etiqueta legible (RS1, T1RS1…) para las insignias "Otros". */
  keyToLabel: Map<string, string>;
  /** Cambio de diámetro de diseño: recalcula el tramo y sus hijos y escribe al dibujo. */
  handleDiamChange: (tramoId: string, newPulg: number) => void;
}

/**
 * Calcula y mantiene el modelo de la tabla sanitaria. Además PERSISTE el punto de chequeo
 * hidráulico (velocidad + relación de llenado) en cada Tramo para que la insignia SANITARIA
 * de InfTab lea un resultado real en lugar de valores permanentemente indefinidos.
 */
export function useSanitaryRows({
  pais,
  tramosSan,
  aps,
  plans,
  updTramoSan,
}: {
  /** País del proyecto: define el perfil de rangos (velocidad, fuerza tractiva). */
  pais: string;
  tramosSan: Tramo[];
  aps: Array<{ id: string; ud?: number }>;
  plans: PlanItem[];
  updTramoSan: UpdTramoSan;
}): SanitaryRowsModel {
  const mergedBase = useMemo(() => {
    const defMap = new Map(APARATOS_DEF.map((d) => [d.id, d]));
    return SAN_UC_IDS.map((id) => {
      const fromAps = aps.find((p) => p.id === id);
      const def = defMap.get(id);
      return { id, nombre: def?.nombre || id, ud: fromAps?.ud ?? def?.ud ?? 0 };
    });
  }, [aps]);

  const displayTramos = useMemo(() => {
    return tramosSan.filter((t) => t.tipo === 'ramal' && !t.esBajante);
  }, [tramosSan]);

  const {
    displayMap: conexionesDisplay,
    componentTotalMap,
    fullChildrenMap,
  } = useMemo(
    () => buildSanConnectivity(tramosSan, plans, mergedBase),
    [plans, tramosSan, mergedBase],
  );

  const handleDiamChange = useCallback(
    (tramoId: string, newPulg: number) =>
      aplicarCambioDiametroSan(tramoId, newPulg, {
        tramosSan,
        fullChildrenMap,
        plans,
        updTramoSan,
      }),
    [updTramoSan, plans, fullChildrenMap, tramosSan],
  );

  // ponytail: readable label (RS1, T1RS1...) for "Otros" badges — not raw tributario ids (T1780...)
  const keyToLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tramosSan) {
      const k = t._key || `${t.id}-${t.piso}`;
      m.set(k, t.label || t.id);
    }
    return m;
  }, [tramosSan]);

  // Persiste el punto de chequeo hidráulico (velocidad + relación de llenado) en cada Tramo
  // para que la insignia SANITARIA de InfTab lea un resultado real en lugar de los valores
  // por defecto permanentemente indefinidos.
  useEffect(() => {
    for (const t of displayTramos) {
      const tKey = t._key || `${t.id}-${t.piso}`;
      const idKey = t._key || t.id;
      const udAcum = componentTotalMap[tKey] || 0;
      const nSalidas = t.nSalidas ?? 0;
      const K = nSalidas > 0 ? Math.round(factorSimultaneidad(nSalidas) * 100) / 100 : null;
      const n = t.nmaning || 0.009;
      const sVal = t.sPercent ?? 0;
      const S = sVal > 0 ? sVal / 100 : null;
      const Q =
        udAcum > 0 && K != null ? Math.round(caudalHunterLPS(udAcum, K) * 1000) / 1000 : null;
      const dSel = DIAM_OPTIONS_SAN.find((d) => d.pulg === (t.diamDisPulg || 0)) || null;
      const DintMm = dSel ? dSel.mm : 0;
      let v_real = 0,
        yD = 0,
        qQ0 = 0;
      if (Q != null && Q > 0 && S != null && S > 0 && n > 0 && DintMm > 0) {
        const hc = calcHydraulicCheck({ Q, S, n, DintMm, lim: perfilDe(pais).san });
        v_real = hc.Vreal;
        yD = Math.round((Math.max(hc.Yc, hc.Yn) / DintMm) * 1000) / 1000;
        qQ0 = hc.qqo;
      }
      if (t.v_real !== v_real) updTramoSan(idKey, 'v_real', v_real);
      if (t.yD !== yD) updTramoSan(idKey, 'yD', yD);
      if (t.qQ0 !== qQ0) updTramoSan(idKey, 'qQ0', qQ0);
    }
  }, [displayTramos, componentTotalMap, updTramoSan, pais]);

  const totales = useMemo(
    () =>
      mergedBase.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        ud: d.ud,
        cant: tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0),
      })),
    [mergedBase, tramosSan],
  );

  const totalUD = useMemo(
    () => totales.reduce((s, d) => s + (d.cant || 0) * (d.ud || 0), 0),
    [totales],
  );

  const sanRows = useMemo(
    () => computeSanRows(displayTramos, componentTotalMap, mergedBase, tramosSan, fullChildrenMap),
    [displayTramos, componentTotalMap, mergedBase, tramosSan, fullChildrenMap],
  );

  return {
    mergedBase,
    displayTramos,
    conexionesDisplay,
    componentTotalMap,
    fullChildrenMap,
    totales,
    totalUD,
    sanRows,
    keyToLabel,
    handleDiamChange,
  };
}
