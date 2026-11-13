/** Chequeo de presión de las redes af (Agua Fria)/ac (Agua Caliente) para el resumen del
 *  Informe: recalcula la velocidad en frío con el grafo de conectividad y el Q del propio
 *  Informe, y mezcla la presión guardada del último chequeo de Diseño de redes. Ej: un
 *  montante se excluye del juicio (sin verificación propia), un ramal sin dato queda
 *  "(sin verificar)" y bloquea la descarga igual que un fallo. */
import { useCallback, useMemo } from 'react';
import { AF_UC_IDS, AC_UC_IDS } from '../../../constants';
import type { PerfNormas } from '../../../constants/countryStandards';
import { DIAMETROS_AF, DIAMETROS_AC } from '../../../constants/hydraulicsData.ts';
import { computeDesignRow, hunterQ } from '../../waterNetworkDesign/rowPhysics.ts';
import { useWaterNetworkGraph } from '../../waterNetworkDesign/useWaterNetworkGraph.ts';
import { loadFromStorage } from '../../../services/storageService.ts';
import { CHEQUEOS_PRESION_KEY } from '../../../constants/storage-keys.ts';
import { computeAcometidaSummary } from '../../../utils/waterNetworkRows.ts';
import { lookupInterno, lookupInternoAC } from '../../../utils/fittingsUtils.ts';
import { isAC2 } from '../../../utils/waterRowsShared.ts';
import type { Tramo } from '../../../context/tramosReducer';
import type { useWorkAreaState } from '../../useWorkAreaState.ts';
import { noTrib } from './complianceShared.ts';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

/** Estado af/ac para el resumen: conjuntos juzgados (sin tributarios), OK/fallos/sin
 *  verificar por red y el gate de la acometida. */
export function usePresionAfAc(args: {
  plans: WorkAreaState['plans'];
  tramosAf: WorkAreaState['tramosAf'];
  tramosAc: WorkAreaState['tramosAc'];
  pais: WorkAreaState['proy']['pais'];
  perfil: PerfNormas;
}) {
  const { plans, tramosAf, tramosAc, pais, perfil } = args;
  // Semáforo y chips juzgan el MISMO conjunto (solo ramales — sin tributarios): si dice
  // 'Revisar', los chips de fallo aparecen al lado (ped. usuario).
  const tramosAfJ = useMemo(() => tramosAf.filter(noTrib), [tramosAf]);
  const tramosAcJ = useMemo(() => tramosAc.filter(noTrib), [tramosAc]);
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
        // Montante fuera (orig. usuario): sin verificación propia, bloqueaba la descarga como "MAC1_ac-P2 (sin verificar)".
        if (t.tipo === 'montante') continue;
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
  // AF: acometida (computeAcometidaSummary estadoOk) — la tabla la marca, el resumen la lista.
  const acometidaOk =
    computeAcometidaSummary(tramosAf, plans, DIAMETROS_AF, pais)?.estadoOk !== false;
  return {
    tramosAfJ,
    tramosAcJ,
    okAF,
    okAC,
    fallosAf,
    fallosAc,
    sinVerificarAf,
    sinVerificarAc,
    acometidaOk,
  };
}
